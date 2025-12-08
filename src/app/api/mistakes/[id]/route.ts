import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/database';
import {
  formatDateForDb,
  calculateMistakeNextReviewDate,
  calculateExpressionNextReviewDate,
  MISTAKE_REVIEW_STAGES,
  EXPRESSION_REVIEW_STAGES
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
    const { isCorrect, contentType } = await request.json();

    if (typeof isCorrect !== 'boolean') {
      return NextResponse.json({ error: 'isCorrect field is required and must be a boolean' }, { status: 400 });
    }

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
    const now = new Date();

    // Determine content type (from request or from mistake record)
    const actualContentType: ContentType = (contentType || mistake.content_type || 'mistake') as ContentType;

    // Use different SRS logic based on content type
    let nextReviewAt: Date;
    let newStage: number;
    let newStatus: string;

    if (actualContentType === 'expression') {
      // Expression: Always advances, no error marking, no decay
      const result = calculateExpressionNextReviewDate(
        mistake.review_stage,
        lastReviewedAt,
        createdAt
      );
      nextReviewAt = result.nextReviewAt;
      newStage = result.newStage;
      // Expression is "learned" when: reaches final stage OR already learned (backward compatible)
      newStatus = (newStage === EXPRESSION_REVIEW_STAGES.length - 1 || mistake.status === 'learned')
        ? 'learned'
        : 'unlearned';
    } else {
      // Mistake: Error correction with correct/incorrect + decay for overdue items
      const scheduledReviewAt = mistake.next_review_at ? new Date(mistake.next_review_at) : null;
      const result = calculateMistakeNextReviewDate(
        mistake.review_stage,
        isCorrect,
        lastReviewedAt,
        createdAt,
        scheduledReviewAt  // Pass scheduled date for decay calculation
      );
      nextReviewAt = result.nextReviewAt;
      newStage = result.newStage;

      // Mistake learned status logic (backward compatible):
      // - If incorrect: always unlearned
      // - If correct AND (reaches final stage OR already learned): learned
      // - Otherwise: unlearned
      if (!isCorrect) {
        newStatus = 'unlearned';
      } else if (newStage === MISTAKE_REVIEW_STAGES.length - 1 || mistake.status === 'learned') {
        newStatus = 'learned';
      } else {
        newStatus = 'unlearned';
      }
    }

    // Update the mistake record
    const { error: updateError } = await supabase
      .from('mistakes')
      .update({
        status: newStatus,
        next_review_at: formatDateForDb(nextReviewAt),
        review_stage: newStage,
        review_count: (mistake.review_count ?? 0) + 1,
        last_reviewed_at: formatDateForDb(now),
      })
      .eq('id', id);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      message: 'Mistake updated successfully',
      newStatus,
      nextReviewAt: formatDateForDb(nextReviewAt),
      newStage,
      contentType: actualContentType
    });
  } catch (error) {
    console.error('Error updating mistake:', error);
    return NextResponse.json({ error: 'Failed to update mistake' }, { status: 500 });
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
