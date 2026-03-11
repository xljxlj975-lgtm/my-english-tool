'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { format, addMonths, subMonths } from 'date-fns';
import { generateCalendarData, getMonthName, CalendarDay } from '@/lib/calendar';

interface Mistake {
  id: string;
  error_sentence: string;
  correct_sentence: string;
  explanation?: string;
  status: string;
}

interface CalendarData {
  reviewCounts: { [date: string]: number };
  mistakesForDate: Mistake[];
  year: number;
  month: number;
}

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarData, setCalendarData] = useState<CalendarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showDateMistakes, setShowDateMistakes] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchCalendarData = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/calendar?year=${currentDate.getFullYear()}&month=${currentDate.getMonth() + 1}`);
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload || typeof payload !== 'object') {
        const message =
          payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
            ? payload.error
            : 'Failed to fetch calendar data';
        throw new Error(message);
      }

      const reviewCountsRaw = (payload as Record<string, unknown>).reviewCounts;
      const reviewCounts =
        reviewCountsRaw && typeof reviewCountsRaw === 'object'
          ? Object.entries(reviewCountsRaw as Record<string, unknown>).reduce<Record<string, number>>(
              (acc, [key, value]) => {
                acc[key] = typeof value === 'number' ? value : Number(value) || 0;
                return acc;
              },
              {}
            )
          : {};

      const mistakesForDateRaw = (payload as Record<string, unknown>).mistakesForDate;
      const mistakesForDate = Array.isArray(mistakesForDateRaw) ? mistakesForDateRaw : [];

      const normalized: CalendarData = {
        reviewCounts,
        mistakesForDate,
        year: Number((payload as Record<string, unknown>).year) || currentDate.getFullYear(),
        month: Number((payload as Record<string, unknown>).month) || currentDate.getMonth() + 1,
      };

      setCalendarData(normalized);
    } catch (error) {
      console.error('Error fetching calendar data:', error);
      setCalendarData(null);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to fetch calendar data');
    } finally {
      setLoading(false);
    }
  }, [currentDate]);

  useEffect(() => {
    fetchCalendarData();
  }, [fetchCalendarData]);

  const fetchMistakesForDate = async (dateString: string) => {
    try {
      const response = await fetch(`/api/calendar?date=${dateString}`);
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload || typeof payload !== 'object') {
        const message =
          payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
            ? payload.error
            : 'Failed to fetch mistakes for the selected date';
        throw new Error(message);
      }

      const mistakes = (payload as Record<string, unknown>).mistakesForDate;
      return Array.isArray(mistakes) ? mistakes : [];
    } catch (error) {
      console.error('Error fetching mistakes for date:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to fetch mistakes for the selected date');
      return [];
    }
  };

  const handleDateClick = async (day: CalendarDay) => {
    if (!day.hasReviews) return;

    setErrorMessage(null);
    const mistakes = await fetchMistakesForDate(day.dateString);
    setSelectedDate(day.dateString);
    setCalendarData(prev => prev ? { ...prev, mistakesForDate: mistakes } : null);
    setShowDateMistakes(true);
  };

  const goToPreviousMonth = () => {
    setCurrentDate(subMonths(currentDate, 1));
    setShowDateMistakes(false);
  };

  const goToNextMonth = () => {
    setCurrentDate(addMonths(currentDate, 1));
    setShowDateMistakes(false);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    setShowDateMistakes(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  if (!calendarData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-md p-6 max-w-md text-center space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">无法加载日历数据</h2>
          <p className="text-gray-600">
            {errorMessage || 'Please try again later.'}
          </p>
          <button
            onClick={fetchCalendarData}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  const calendarDays = generateCalendarData(
    calendarData.year,
    calendarData.month - 1,
    calendarData.reviewCounts
  );

  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">复习日历</h1>
          <Link href="/" className="text-sm font-medium text-blue-600 hover:text-blue-800">
            返回首页
          </Link>
        </div>

        {errorMessage && (
          <div className="mb-6 rounded-2xl border border-yellow-300 bg-yellow-100 px-4 py-3 text-yellow-800">
            {errorMessage}
          </div>
        )}

        <div className="mb-6 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200 md:p-6">
          <div className="mb-4 flex items-center justify-between gap-2">
            <button
              onClick={goToPreviousMonth}
              className="rounded-2xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200 md:px-4"
            >
              <span className="md:hidden">←</span>
              <span className="hidden md:inline">← Previous</span>
            </button>

            <div className="text-center">
              <h2 className="text-xl font-semibold text-slate-800 md:text-2xl">
                {getMonthName(currentDate)}
              </h2>
              <button
                onClick={goToToday}
                className="mt-1 text-sm text-blue-600 hover:text-blue-800"
              >
                回到今天
              </button>
            </div>

            <button
              onClick={goToNextMonth}
              className="rounded-2xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200 md:px-4"
            >
              <span className="md:hidden">→</span>
              <span className="hidden md:inline">Next →</span>
            </button>
          </div>

          <div className="mb-3 grid grid-cols-7 gap-1 md:mb-4 md:gap-2">
            {weekDays.map(day => (
              <div key={day} className="py-2 text-center text-xs font-semibold text-slate-500 md:text-sm">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1 md:gap-2">
            {calendarDays.map((day, index) => (
              <button
                key={index}
                onClick={() => handleDateClick(day)}
                disabled={!day.hasReviews && !day.isToday}
                className={`
                  aspect-square rounded-2xl border p-1.5 transition-colors md:p-2
                  ${
                    day.isToday
                      ? 'border-blue-500 bg-blue-50'
                      : day.isCurrentMonth
                      ? 'border-gray-200'
                      : 'border-gray-100 text-gray-400'
                  }
                  ${
                    day.hasReviews
                      ? 'hover:bg-blue-100 cursor-pointer'
                      : day.isToday
                      ? 'hover:bg-blue-100'
                      : 'cursor-default'
                  }
                  ${
                    selectedDate === day.dateString
                      ? 'ring-2 ring-blue-500'
                      : ''
                  }
                `}
              >
                <div className="text-xs font-medium md:text-sm">{format(day.date, 'd')}</div>
                {day.hasReviews && (
                  <div className="mt-1 text-[11px] font-semibold text-blue-600 md:text-xs">
                    {day.reviewCount}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {showDateMistakes && selectedDate && (
          <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 md:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-slate-800 md:text-xl">
                Reviews for {format(new Date(selectedDate), 'MMMM d, yyyy')}
              </h3>
              <button
                onClick={() => setShowDateMistakes(false)}
                className="text-slate-500 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            {calendarData.mistakesForDate.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-4">📚</div>
                <p className="text-gray-600">No reviews scheduled for this date.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {calendarData.mistakesForDate.map((mistake, index) => (
                  <div key={mistake.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="mb-3">
                      <span className="text-sm font-medium text-red-600 block mb-1">
                        Error ({index + 1}):
                      </span>
                      <p className="text-gray-800">{mistake.error_sentence}</p>
                    </div>
                    <div className="mb-3">
                      <span className="text-sm font-medium text-green-600 block mb-1">
                        Correct:
                      </span>
                      <p className="text-gray-800">{mistake.correct_sentence}</p>
                    </div>
                    {mistake.explanation && (
                      <div className="mb-3">
                        <span className="text-sm font-medium text-blue-600 block mb-1">
                          Explanation:
                        </span>
                        <p className="text-gray-700">{mistake.explanation}</p>
                      </div>
                    )}
                    <div className="text-sm text-gray-500">Status: {mistake.status}</div>
                  </div>
                ))}

                <div className="flex justify-center pt-4">
                  <Link
                    href={`/review?date=${selectedDate}`}
                    className="rounded-2xl bg-blue-600 px-6 py-3 text-white transition-colors hover:bg-blue-700"
                  >
                    Review These Mistakes
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}

        {!showDateMistakes && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
            <div className="rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200">
              <div className="mb-2 text-3xl font-bold text-blue-600">
                {Object.values(calendarData.reviewCounts).reduce((sum, count) => sum + count, 0)}
              </div>
              <div className="text-slate-600">总复习数</div>
            </div>

            <div className="rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200">
              <div className="mb-2 text-3xl font-bold text-green-600">
                {Object.keys(calendarData.reviewCounts).length}
              </div>
              <div className="text-slate-600">有复习的天数</div>
            </div>

            <div className="rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200">
              <div className="mb-2 text-3xl font-bold text-purple-600">
                {Object.keys(calendarData.reviewCounts).length > 0
                  ? Math.round(
                      Object.values(calendarData.reviewCounts).reduce((sum, count) => sum + count, 0) /
                      Object.keys(calendarData.reviewCounts).length
                    )
                  : 0}
              </div>
              <div className="text-slate-600">日均复习数</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
