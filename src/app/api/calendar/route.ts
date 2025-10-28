import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import { formatDateForDb } from '@/lib/spaced-repetition';

export async function GET(request: NextRequest) {
  try {
    const db = getDatabase();
    const searchParams = request.nextUrl.searchParams;

    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
    const month = parseInt(searchParams.get('month') || (new Date().getMonth() + 1).toString());

    // Get the date range for the entire month (plus some overlap for calendar display)
    const startDate = new Date(year, month - 1, 1);
    startDate.setDate(startDate.getDate() - 7); // Go back a week to include previous month's days
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(year, month - 1 + 1, 1);
    endDate.setDate(endDate.getDate() + 7); // Go forward a week to include next month's days
    endDate.setHours(0, 0, 0, 0);

    // Get review counts grouped by date
    const stmt = db.prepare(`
      SELECT
        DATE(next_review_at) as review_date,
        COUNT(*) as count
      FROM mistakes
      WHERE next_review_at >= ? AND next_review_at < ?
      GROUP BY DATE(next_review_at)
      ORDER BY review_date
    `);

    const reviewData = stmt.all(formatDateForDb(startDate), formatDateForDb(endDate)) as Array<{ review_date: string; count: number }>;

    // Convert to object format for easier lookup
    const reviewCounts: { [date: string]: number } = {};
    reviewData.forEach(({ review_date, count }) => {
      reviewCounts[review_date] = count;
    });

    // Get detailed mistakes for a specific date if requested
    const dateParam = searchParams.get('date');
    let mistakesForDate: any[] = [];

    if (dateParam) {
      const date = new Date(dateParam);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const mistakesStmt = db.prepare(`
        SELECT id, error_sentence, correct_sentence, explanation, type, status
        FROM mistakes
        WHERE next_review_at >= ? AND next_review_at < ?
        ORDER BY created_at DESC
      `);

      mistakesForDate = mistakesStmt.all(formatDateForDb(date), formatDateForDb(nextDate));
    }

    return NextResponse.json({
      reviewCounts,
      mistakesForDate,
      year,
      month,
      startDate: formatDateForDb(startDate),
      endDate: formatDateForDb(endDate)
    });
  } catch (error) {
    console.error('Error fetching calendar data:', error);
    return NextResponse.json({ error: 'Failed to fetch calendar data' }, { status: 500 });
  }
}