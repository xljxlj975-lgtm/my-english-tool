import { NextResponse } from 'next/server';
import { getSupabaseClient, Mistake } from '@/lib/database';
import { formatDateForDb } from '@/lib/spaced-repetition';
import { getSettings } from '@/lib/settings';

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'object' && error !== null) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim().length > 0) {
      return message;
    }

    const details = (error as { details?: unknown }).details;
    if (typeof details === 'string' && details.trim().length > 0) {
      return details;
    }
  }

  return 'Failed to fetch dashboard data';
}

function isMissingColumnError(error: unknown, column: string): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const code = (error as { code?: unknown }).code;
  const message = (error as { message?: unknown }).message;
  const details = (error as { details?: unknown }).details;

  if (typeof code === 'string' && code.trim() === '42703') {
    return true;
  }

  const needle = column.toLowerCase();
  if (typeof message === 'string' && message.toLowerCase().includes(needle)) {
    return true;
  }

  if (typeof details === 'string' && details.toLowerCase().includes(needle)) {
    return true;
  }

  return false;
}

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
        .lt('next_review_at', todayRange[1]),
      // v2.0: 今日及之前需要复习的条目（用于过滤）
      supabase
        .from('mistakes')
        .select('*')
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

    let lastReviewedColumnMissing = false;
    if (todayCompletedResult.error) {
      if (isMissingColumnError(todayCompletedResult.error, 'last_reviewed_at')) {
        lastReviewedColumnMissing = true;
        console.warn(
          'last_reviewed_at column missing on mistakes table. Falling back to zero for todayCompletedCount. Please run the v2.0 migrations.'
        );
      } else {
        throw todayCompletedResult.error;
      }
    }

    const todayCompletedCount = lastReviewedColumnMissing
      ? 0
      : (todayCompletedResult.count || 0);

    // v2.0修复: todayReviewCount应该显示今天实际可以复习的数量（受daily_target限制）
    // 而不是所有积压的数量。这样可以避免用户看到几百个单词而感到困惑。
    const actualTodayReviewCount = Math.min(todayNeedsReview.length, settings.daily_target);

    return NextResponse.json({
      todayReviewCount: actualTodayReviewCount, // v2.0修复: 今天应该复习的数量（受daily_target限制）
      totalNeedsReview: todayNeedsReview.length, // v2.0新增: 所有需要复习的总数（包括积压）
      todayCompletedCount, // v2.0: 今日已完成
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
    return NextResponse.json({ error: extractErrorMessage(error) }, { status: 500 });
  }
}
