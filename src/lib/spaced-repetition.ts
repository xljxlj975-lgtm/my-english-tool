import { format, addDays } from 'date-fns';

export const REVIEW_STAGES = [0, 3, 7, 14, 30]; // Days from creation

export function calculateNextReviewDate(
  currentStage: number,
  isCorrect: boolean,
  createdAt: Date
): { nextReviewAt: Date; newStage: number } {
  let newStage = currentStage;

  if (isCorrect) {
    // Move to next stage if correct
    newStage = Math.min(currentStage + 1, REVIEW_STAGES.length - 1);
  } else {
    // Reset to beginning if incorrect
    newStage = 0;
  }

  const daysToAdd = REVIEW_STAGES[newStage];
  const nextReviewAt = addDays(createdAt, daysToAdd);

  return { nextReviewAt, newStage };
}

export function getTodayReviewDate(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export function formatDateForDb(date: Date): string {
  return format(date, 'yyyy-MM-dd HH:mm:ss');
}