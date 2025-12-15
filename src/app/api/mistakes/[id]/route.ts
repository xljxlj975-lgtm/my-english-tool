import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/database';
import {
  formatDateForDb,
  calculateMistakeNextReviewDate,
  calculateExpressionNextReviewDate,
  calculateNextReview,
  Score,
  MISTAKE_REVIEW_STAGES,
  EXPRESSION_REVIEW_STAGES,
  getFutureReviewLoad
} from '@/lib/spaced-repetition';
import type { ContentType } from '@/lib/content-type';

type RouteContext = {
  params: Promise<{ id: string }>;
};

// PUT /api/mistakes/[id] - Update mistake (for review)
export async function PUT(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    const supabase = getSupabaseClient();
    const { id } = await params;
    const body = await request.json();

    // v3.0: Support both new 'score' and legacy 'isCorrect'
    let score: Score;
    let isReappearance = false;

    if ('score' in body) {
      // New v3.0 API: 4-level scoring
      score = body.score as Score;
      isReappearance = body.isReappearance || false;

      if (![0, 1, 2, 3].includes(score)) {
        return NextResponse.json(
          { error: 'Invalid score. Must be 0, 1, 2, or 3.' },
          { status: 400 }
        );
      }
    } else if ('isCorrect' in body) {
      // Legacy API: boolean isCorrect
      if (typeof body.isCorrect !== 'boolean') {
        return NextResponse.json(
          { error: 'isCorrect field must be a boolean' },
          { status: 400 }
        );
      }
      score = body.isCorrect ? Score.Good : Score.Forgot;
    } else {
      return NextResponse.json(
        { error: 'Either score (0-3) or isCorrect (boolean) is required' },
        { status: 400 }
      );
    }

    const { contentType } = body;

    // Get current mistake data
    const { data: mistake, error: fetchError } = await supabase
      .from('mistakes')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      throw fetchError;
    }

    if (!mistake) {
      return NextResponse.json({ error: 'Mistake not found' }, { status: 404 });
    }

    const createdAt = new Date(mistake.created_at);
    const lastReviewedAt = mistake.last_reviewed_at ? new Date(mistake.last_reviewed_at) : null;
    const scheduledReviewAt = mistake.next_review_at ? new Date(mistake.next_review_at) : null;
    const now = new Date();

    // Determine content type (from request or from mistake record)
    const actualContentType: ContentType = (contentType || mistake.content_type || 'mistake') as ContentType;

    // v3.0: Use new calculateNextReview with 4-level scoring
    // 获取未来14天的复习负载（用于动态fuzzing）
    const reviewLoadMap = await getFutureReviewLoad(supabase, 14);

    const result = calculateNextReview({
      currentStage: mistake.review_stage,
      score,
      lastReviewedAt,
      nextReviewAt: scheduledReviewAt,
      previousInterval: mistake.previous_interval || null,
      consecutiveHardCount: mistake.consecutive_hard_count || 0,
      cardId: id,
      reviewLoadMap, // 启用动态负载均衡
    });

    // Status logic: 始终保持unlearned，除非明确退休
    const newStatus = mistake.status === 'learned' ? 'learned' : 'unlearned';

    // Update the mistake record
    const reviewCountIncrement = isReappearance ? 0 : 1;

    const { error: updateError } = await supabase
      .from('mistakes')
      .update({
        status: newStatus,
        next_review_at: formatDateForDb(result.nextReviewAt),
        review_stage: result.newStage,
        review_count: (mistake.review_count ?? 0) + reviewCountIncrement,
        last_reviewed_at: formatDateForDb(now),
        last_score: score,
        consecutive_hard_count: result.newConsecutiveHardCount,
        health_check_at: result.healthCheckAt ? formatDateForDb(result.healthCheckAt) : null,
        previous_interval: result.newPreviousInterval,
        reappear_count: 0, // 重置重现计数
      })
      .eq('id', id);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      message: 'Review recorded successfully',
      newStatus,
      nextReviewAt: formatDateForDb(result.nextReviewAt),
      newStage: result.newStage,
      healthCheckAt: result.healthCheckAt ? formatDateForDb(result.healthCheckAt) : null,
      reappearInSession: result.reappearInSession,
      consecutiveHardCount: result.newConsecutiveHardCount,
      contentType: actualContentType,
    });
  } catch (error) {
    console.error('Error updating mistake:', error);
    return NextResponse.json({ error: 'Failed to update mistake' }, { status: 500 });
  }
}

// PATCH /api/mistakes/[id] - Retire item (mark as learned without SRS)
export async function PATCH(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    const supabase = getSupabaseClient();
    const { id } = await params;
    const body = await request.json();

    // Only allow retiring items (set to "learned" with far-future date to exclude from reviews)
    if (body.retire === true) {
      // Use a far-future date (9999-12-31) instead of null to mark as retired
      // This works with the NOT NULL constraint on next_review_at
      const retiredDate = '9999-12-31T00:00:00.000Z';

      const { error: updateError } = await supabase
        .from('mistakes')
        .update({
          status: 'learned',
          next_review_at: retiredDate,
        })
        .eq('id', id);

      if (updateError) {
        throw updateError;
      }

      return NextResponse.json({
        message: 'Item retired successfully',
        status: 'learned',
        next_review_at: retiredDate,
      });
    }

    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  } catch (error) {
    console.error('Error retiring item:', error);
    return NextResponse.json({ error: 'Failed to retire item' }, { status: 500 });
  }
}

// DELETE /api/mistakes/[id] - Delete mistake
export async function DELETE(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    const supabase = getSupabaseClient();
    const { id } = await params;

    const { data, error } = await supabase
      .from('mistakes')
      .delete()
      .eq('id', id)
      .select('id')
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return NextResponse.json({ error: 'Mistake not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Mistake deleted successfully' });
  } catch (error) {
    console.error('Error deleting mistake:', error);
    return NextResponse.json({ error: 'Failed to delete mistake' }, { status: 500 });
  }
}
