import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import { formatDateForDb } from '@/lib/spaced-repetition';

export async function GET(request: NextRequest) {
  try {
    const db = getDatabase();

    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get today's review count
    const todayStmt = db.prepare(`
      SELECT COUNT(*) as count FROM mistakes
      WHERE next_review_at >= ? AND next_review_at < ?
    `);
    const todayCount = todayStmt.get(formatDateForDb(today), formatDateForDb(tomorrow)) as { count: number };

    // Get total mistakes count
    const totalStmt = db.prepare('SELECT COUNT(*) as count FROM mistakes');
    const totalCount = totalStmt.get() as { count: number };

    // Get learned mistakes count
    const learnedStmt = db.prepare('SELECT COUNT(*) as count FROM mistakes WHERE status = ?');
    const learnedCount = learnedStmt.get('learned') as { count: number };

    // Get unlearned mistakes count
    const unlearnedStmt = db.prepare('SELECT COUNT(*) as count FROM mistakes WHERE status = ?');
    const unlearnedCount = unlearnedStmt.get('unlearned') as { count: number };

    // Get mistakes by type
    const typeStmt = db.prepare(`
      SELECT type, COUNT(*) as count
      FROM mistakes
      GROUP BY type
      ORDER BY count DESC
    `);
    const mistakesByType = typeStmt.all() as Array<{ type: string; count: number }>;

    // Get recent mistakes (last 7 days)
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentStmt = db.prepare(`
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM mistakes
      WHERE created_at >= ?
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `);
    const recentMistakes = recentStmt.all(formatDateForDb(sevenDaysAgo)) as Array<{ date: string; count: number }>;

    // Get streak (consecutive days with reviews completed)
    // This is a simplified version - in a real app, you'd track this in a separate table
    const streakStmt = db.prepare(`
      SELECT DISTINCT DATE(next_review_at) as review_date
      FROM mistakes
      WHERE status = 'learned'
      ORDER BY review_date DESC
      LIMIT 30
    `);
    const reviewDates = streakStmt.all() as Array<{ review_date: string }>;

    let streak = 0;
    const todayStr = formatDateForDb(today).split(' ')[0];

    for (const { review_date } of reviewDates) {
      if (review_date === todayStr ||
          review_date === formatDateForDb(new Date(today.getTime() - 24 * 60 * 60 * 1000)).split(' ')[0]) {
        streak++;
      } else {
        break;
      }
    }

    return NextResponse.json({
      todayReviewCount: todayCount.count,
      totalMistakes: totalCount.count,
      learnedMistakes: learnedCount.count,
      unlearnedMistakes: unlearnedCount.count,
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