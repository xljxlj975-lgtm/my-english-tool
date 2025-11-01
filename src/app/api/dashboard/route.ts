import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/database';
import { formatDateForDb } from '@/lib/spaced-repetition';

export async function GET() {
  try {
    const supabase = getSupabaseClient();

    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayRange = [formatDateForDb(today), formatDateForDb(tomorrow)] as const;

    const [
      todayReviewResult,
      totalResult,
      learnedResult,
      unlearnedResult,
      typeResult,
      recentResult,
      learnedReviewsResult
    ] = await Promise.all([
      supabase
        .from('mistakes')
        .select('*', { count: 'exact', head: true })
        .gte('next_review_at', todayRange[0])
        .lt('next_review_at', todayRange[1]),
      supabase.from('mistakes').select('*', { count: 'exact', head: true }),
      supabase
        .from('mistakes')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'learned'),
      supabase
        .from('mistakes')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'unlearned'),
      supabase.from('mistakes').select('type'),
      supabase
        .from('mistakes')
        .select('created_at')
        .gte('created_at', (() => {
          const sevenDaysAgo = new Date(today);
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          return formatDateForDb(sevenDaysAgo);
        })()),
      supabase
        .from('mistakes')
        .select('next_review_at')
        .eq('status', 'learned'),
    ]);

    if (todayReviewResult.error) throw todayReviewResult.error;
    if (totalResult.error) throw totalResult.error;
    if (learnedResult.error) throw learnedResult.error;
    if (unlearnedResult.error) throw unlearnedResult.error;
    if (typeResult.error) throw typeResult.error;
    if (recentResult.error) throw recentResult.error;
    if (learnedReviewsResult.error) throw learnedReviewsResult.error;

    // Get mistakes by type
    const typeCounts: Record<string, number> = {};
    (typeResult.data || []).forEach(({ type }) => {
      const key = (type as string) || 'uncategorized';
      typeCounts[key] = (typeCounts[key] || 0) + 1;
    });

    const mistakesByType = Object.entries(typeCounts)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);

    // Get recent mistakes (last 7 days)
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentCounts: Record<string, number> = {};
    (recentResult.data || []).forEach(({ created_at }) => {
      if (!created_at) return;
      const dateKey = new Date(created_at).toISOString().split('T')[0];
      recentCounts[dateKey] = (recentCounts[dateKey] || 0) + 1;
    });

    const recentMistakes = Object.entries(recentCounts)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => b.date.localeCompare(a.date));

    // Get streak (consecutive days with reviews completed)
    const reviewDateSet = new Set<string>();
    (learnedReviewsResult.data || []).forEach(({ next_review_at }) => {
      if (!next_review_at) return;
      reviewDateSet.add(new Date(next_review_at).toISOString().split('T')[0]);
    });

    let streak = 0;
    const streakDates = Array.from(reviewDateSet).sort((a, b) => b.localeCompare(a));
    if (streakDates.length > 0) {
      const cursor = new Date();
      cursor.setHours(0, 0, 0, 0);

      for (const dateStr of streakDates) {
        const cursorStr = cursor.toISOString().split('T')[0];
        if (dateStr === cursorStr) {
          streak++;
          cursor.setDate(cursor.getDate() - 1);
        } else if (new Date(dateStr) < cursor) {
          break;
        }
      }
    }

    return NextResponse.json({
      todayReviewCount: todayReviewResult.count || 0,
      totalMistakes: totalResult.count || 0,
      learnedMistakes: learnedResult.count || 0,
      unlearnedMistakes: unlearnedResult.count || 0,
      mistakesByType,
      recentMistakes,
      streak,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 });
  }
}
