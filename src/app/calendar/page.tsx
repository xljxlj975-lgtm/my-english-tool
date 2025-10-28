'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { format, addMonths, subMonths } from 'date-fns';
import { generateCalendarData, getMonthName, getReviewStats, CalendarDay } from '@/lib/calendar';

interface Mistake {
  id: string;
  error_sentence: string;
  correct_sentence: string;
  explanation?: string;
  type: string;
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

  useEffect(() => {
    fetchCalendarData();
  }, [currentDate]);

  const fetchCalendarData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/calendar?year=${currentDate.getFullYear()}&month=${currentDate.getMonth() + 1}`);
      const data = await response.json();
      setCalendarData(data);
    } catch (error) {
      console.error('Error fetching calendar data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMistakesForDate = async (dateString: string) => {
    try {
      const response = await fetch(`/api/calendar?date=${dateString}`);
      const data = await response.json();
      return data.mistakesForDate || [];
    } catch (error) {
      console.error('Error fetching mistakes for date:', error);
      return [];
    }
  };

  const handleDateClick = async (day: CalendarDay) => {
    if (!day.hasReviews) return;

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

  if (loading || !calendarData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  const calendarDays = generateCalendarData(
    calendarData.year,
    calendarData.month - 1,
    calendarData.reviewCounts
  );

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Review Calendar</h1>
          <Link href="/" className="text-blue-600 hover:text-blue-800">
            ← Back to Dashboard
          </Link>
        </div>

        {/* Calendar Navigation */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={goToPreviousMonth}
              className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors"
            >
              ← Previous
            </button>

            <div className="text-center">
              <h2 className="text-2xl font-semibold text-gray-800">
                {getMonthName(currentDate)}
              </h2>
              <button
                onClick={goToToday}
                className="text-sm text-blue-600 hover:text-blue-800 mt-1"
              >
                Go to Today
              </button>
            </div>

            <button
              onClick={goToNextMonth}
              className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Next →
            </button>
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-2 mb-4">
            {weekDays.map(day => (
              <div key={day} className="text-center font-semibold text-gray-600 py-2">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {calendarDays.map((day, index) => (
              <button
                key={index}
                onClick={() => handleDateClick(day)}
                disabled={!day.hasReviews && !day.isToday}
                className={`
                  aspect-square p-2 rounded-lg border transition-colors
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
                <div className="text-sm font-medium">{format(day.date, 'd')}</div>
                {day.hasReviews && (
                  <div className="text-xs text-blue-600 font-semibold mt-1">
                    {day.reviewCount}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Date Details Modal */}
        {showDateMistakes && selectedDate && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-gray-800">
                Reviews for {format(new Date(selectedDate), 'MMMM d, yyyy')}
              </h3>
              <button
                onClick={() => setShowDateMistakes(false)}
                className="text-gray-500 hover:text-gray-700"
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
                  <div key={mistake.id} className="border border-gray-200 rounded-lg p-4">
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
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">
                        Type: {mistake.type} | Status: {mistake.status}
                      </span>
                    </div>
                  </div>
                ))}

                <div className="flex justify-center pt-4">
                  <Link
                    href={`/review?date=${selectedDate}`}
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Review These Mistakes
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Calendar Stats */}
        {!showDateMistakes && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg shadow-md p-6 text-center">
              <div className="text-3xl font-bold text-blue-600 mb-2">
                {Object.values(calendarData.reviewCounts).reduce((sum, count) => sum + count, 0)}
              </div>
              <div className="text-gray-600">Total Scheduled Reviews</div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6 text-center">
              <div className="text-3xl font-bold text-green-600 mb-2">
                {Object.keys(calendarData.reviewCounts).length}
              </div>
              <div className="text-gray-600">Days with Reviews</div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6 text-center">
              <div className="text-3xl font-bold text-purple-600 mb-2">
                {Object.keys(calendarData.reviewCounts).length > 0
                  ? Math.round(
                      Object.values(calendarData.reviewCounts).reduce((sum, count) => sum + count, 0) /
                      Object.keys(calendarData.reviewCounts).length
                    )
                  : 0}
              </div>
              <div className="text-gray-600">Average per Day</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}