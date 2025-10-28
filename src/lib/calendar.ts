import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths } from 'date-fns';

export interface CalendarDay {
  date: Date;
  dateString: string;
  dayOfWeek: number;
  hasReviews: boolean;
  reviewCount: number;
  isCurrentMonth: boolean;
  isToday: boolean;
}

export function generateCalendarData(year: number, month: number, reviewData: { [date: string]: number }): CalendarDay[] {
  const firstDayOfMonth = startOfMonth(new Date(year, month, 1));
  const lastDayOfMonth = endOfMonth(new Date(year, month, 1));

  // Get the first day to show (Sunday before the first day of month)
  const firstDayOfWeek = getDay(firstDayOfMonth);
  const startDate = new Date(firstDayOfMonth);
  startDate.setDate(startDate.getDate() - firstDayOfWeek);

  // Get the last day to show (Saturday after the last day of month)
  const endDayOfWeek = getDay(lastDayOfMonth);
  const endDate = new Date(lastDayOfMonth);
  endDate.setDate(endDate.getDate() + (6 - endDayOfWeek));

  const days = eachDayOfInterval({ start: startDate, end: endDate });
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return days.map(day => {
    const dayString = format(day, 'yyyy-MM-dd');
    const reviewCount = reviewData[dayString] || 0;

    return {
      date: day,
      dateString: dayString,
      dayOfWeek: getDay(day),
      hasReviews: reviewCount > 0,
      reviewCount,
      isCurrentMonth: day.getMonth() === month,
      isToday: day.getTime() === today.getTime()
    };
  });
}

export function getMonthName(date: Date): string {
  return format(date, 'MMMM yyyy');
}

export function getReviewStats(reviewData: { [date: string]: number }) {
  const dates = Object.keys(reviewData);
  const totalReviews = dates.reduce((sum, date) => sum + reviewData[date], 0);
  const daysWithReviews = dates.filter(date => reviewData[date] > 0).length;

  return {
    totalReviews,
    daysWithReviews,
    averagePerDay: daysWithReviews > 0 ? Math.round(totalReviews / daysWithReviews) : 0
  };
}