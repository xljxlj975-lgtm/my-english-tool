import { NextResponse } from 'next/server';
import { getSupabaseClient, Mistake } from '@/lib/database';
import { formatDateForDb } from '@/lib/spaced-repetition';
import { getSettings } from '@/lib/settings';

export async function GET() {
  try {
    const supabase = getSupabaseClient();

    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayRange = [formatDateForDb(today), formatDateForDb(tomorrow)] as const;

    // v2.0: 获取Daily Target设置
    const settings = await getSettings();

    const [
      todayReviewResult,
      todayAllMistakes,
      backlogMistakes,
      todayCompletedResult,
      totalResult,
      learnedResult,
      unlearnedResult,
      typeResult,
      recentResult,
      learnedReviewsResult
    ] = await Promise.all([
      // 今日复习队列（计数）
      supabase
        .from('mistakes')
        .select('*', { count: 'exact', head: true })
        .gte('next_review_at', todayRange[0])
        .lt('next_review_at', todayRange[1]),
      // v2.0: 今日所有需要复习的条目（用于过滤）
      supabase
        .from('mistakes')
        .select('*')
        .gte('next_review_at', todayRange[0])
        .lt('next_review_at', todayRange[1]),
      // v2.0: Backlog - 所有过期未复习的条目
      supabase
        .from('mistakes')
        .select('*')
        .lt('next_review_at', todayRange[0]),
      // v2.0: 今日已完成复习的数量（last_reviewed_at在今天）
      supabase
        .from('mistakes')
        .select('*', { count: 'exact', head: true })
        .gte('last_reviewed_at', todayRange[0])
        .lt('last_reviewed_at', todayRange[1]),
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
    if (todayAllMistakes.error) throw todayAllMistakes.error;
    if (backlogMistakes.error) throw backlogMistakes.error;
    if (todayCompletedResult.error) throw todayCompletedResult.error;
    if (totalResult.error) throw totalResult.error;
    if (learnedResult.error) throw learnedResult.error;
    if (unlearnedResult.error) throw unlearnedResult.error;
    if (typeResult.error) throw typeResult.error;
    if (recentResult.error) throw recentResult.error;
    if (learnedReviewsResult.error) throw learnedReviewsResult.error;

    // v2.0: 过滤出真正需要复习的条目（未复习或需要重新复习）
    const filterNeedsReview = (items: Mistake[]) => {
      return items.filter(item => {
        if (!item.last_reviewed_at) return true; // 从未复习过
        const lastReviewed = new Date(item.last_reviewed_at);
        const nextReview = new Date(item.next_review_at);
        return lastReviewed < nextReview; // 上次复习早于下次计划复习时间
      });
    };

    const todayNeedsReview = filterNeedsReview(todayAllMistakes.data || []);
    const backlogNeedsReview = filterNeedsReview(backlogMistakes.data || []);

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
      todayReviewCount: todayNeedsReview.length, // v2.0: 今日需要复习的实际数量
      todayCompletedCount: todayCompletedResult.count || 0, // v2.0: 今日已完成
      backlogCount: backlogNeedsReview.length, // v2.0: 积压数量
      dailyTarget: settings.daily_target, // v2.0: Daily Target设置
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
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to fetch dashboard data';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
