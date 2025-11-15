import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient, Mistake } from '@/lib/database';
import { formatDateForDb } from '@/lib/spaced-repetition';
import { getSettings } from '@/lib/settings';

/**
 * GET /api/review-queue
 *
 * Query params:
 * - mode: 'today' (default) | 'backlog' | 'continue'
 * - limit: number (optional, overrides daily_target for 'continue' mode)
 *
 * Returns review queue based on mode:
 * - today: Today's review items (limited by daily_target)
 * - backlog: All overdue items that need review
 * - continue: Additional items for clearing backlog (default 20)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const searchParams = request.nextUrl.searchParams;

    const mode = searchParams.get('mode') || 'today';
    const customLimit = searchParams.get('limit');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let query = supabase.from('mistakes').select('*');

    if (mode === 'backlog') {
      // Backlog: All items with next_review_at < today
      query = query.lt('next_review_at', formatDateForDb(today));
    } else if (mode === 'continue') {
      // Continue mode: Additional 20 items from backlog
      query = query.lt('next_review_at', formatDateForDb(today));
    } else {
      // Today mode: Items due today
      query = query
        .gte('next_review_at', formatDateForDb(today))
        .lt('next_review_at', formatDateForDb(tomorrow));
    }

    // Always order by review date (oldest first)
    query = query.order('next_review_at', { ascending: true });

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    if (!data) {
      return NextResponse.json([]);
    }

    // v2.0: Filter out items that have already been reviewed
    // An item needs review if:
    // 1. last_reviewed_at is NULL (never reviewed), OR
    // 2. last_reviewed_at < next_review_at (reviewed but scheduled for next review)
    const needsReview = (data as Mistake[]).filter((item) => {
      if (!item.last_reviewed_at) {
        // Never reviewed
        return true;
      }

      const lastReviewed = new Date(item.last_reviewed_at);
      const nextReview = new Date(item.next_review_at);

      // Need review if last review was before the scheduled next review
      return lastReviewed < nextReview;
    });

    // Apply limits based on mode
    let result: Mistake[];

    if (mode === 'today') {
      const settings = await getSettings();
      result = needsReview.slice(0, settings.daily_target);
    } else if (mode === 'continue') {
      const limit = customLimit ? parseInt(customLimit) : 20;
      result = needsReview.slice(0, limit);
    } else {
      // backlog mode: return all
      result = needsReview;
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching review queue:', error);
    return NextResponse.json({ error: 'Failed to fetch review queue' }, { status: 500 });
  }
}
