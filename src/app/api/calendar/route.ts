import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/database';
import { formatDateForDb } from '@/lib/spaced-repetition';

type CalendarMistake = {
  id: string;
  error_sentence: string;
  correct_sentence: string;
  explanation: string | null;
  type: string;
  status: string;
  created_at: string | null;
};

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
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

    const { data: reviewRows, error: reviewError } = await supabase
      .from('mistakes')
      .select('next_review_at')
      .gte('next_review_at', formatDateForDb(startDate))
      .lt('next_review_at', formatDateForDb(endDate));

    if (reviewError) {
      throw reviewError;
    }

    // Convert to object format for easier lookup
    const reviewCounts: { [date: string]: number } = {};
    (reviewRows || []).forEach(({ next_review_at }) => {
      if (!next_review_at) return;
      const dateKey = new Date(next_review_at).toISOString().split('T')[0];
      reviewCounts[dateKey] = (reviewCounts[dateKey] || 0) + 1;
    });

    // Get detailed mistakes for a specific date if requested
    const dateParam = searchParams.get('date');
    let mistakesForDate: CalendarMistake[] = [];

    if (dateParam) {
      const date = new Date(dateParam);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const { data: mistakesRows, error: mistakesError } = await supabase
        .from('mistakes')
        .select<CalendarMistake>('id, error_sentence, correct_sentence, explanation, type, status, created_at')
        .gte('next_review_at', formatDateForDb(date))
        .lt('next_review_at', formatDateForDb(nextDate))
        .order('created_at', { ascending: false });

      if (mistakesError) {
        throw mistakesError;
      }

      mistakesForDate = mistakesRows ?? [];
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
