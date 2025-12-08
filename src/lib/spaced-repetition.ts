import { format, addDays } from 'date-fns';

// Mistake SRS: Error correction system [1, 3, 7, 14, 30]
export const MISTAKE_REVIEW_STAGES = [1, 3, 7, 14, 30];

// Expression SRS: Expression upgrade system [1, 7, 21]
export const EXPRESSION_REVIEW_STAGES = [1, 7, 21];

// Legacy support
export const REVIEW_STAGES = MISTAKE_REVIEW_STAGES;

/**
 * Calculate next review date for mistakes (error correction)
 * - If correct: move to next stage
 * - If incorrect: reset to stage 0
 * - Stages: [1, 3, 7, 14, 30] days
 */
export function calculateMistakeNextReviewDate(
  currentStage: number,
  isCorrect: boolean,
  lastReviewedAt: Date | null,
  createdAt: Date
): { nextReviewAt: Date; newStage: number } {
  let newStage = currentStage;

  if (isCorrect) {
    newStage = Math.min(currentStage + 1, MISTAKE_REVIEW_STAGES.length - 1);
  } else {
    newStage = 0;
  }

  const daysToAdd = MISTAKE_REVIEW_STAGES[newStage];
  const baseDate = lastReviewedAt || createdAt;
  const nextReviewAt = addDays(baseDate, daysToAdd);

  return { nextReviewAt, newStage };
}

/**
 * Calculate next review date for expressions (expression upgrade)
 * - Always moves to next stage (no error marking)
 * - Stages: [1, 7, 21] days
 */
export function calculateExpressionNextReviewDate(
  currentStage: number,
  lastReviewedAt: Date | null,
  createdAt: Date
): { nextReviewAt: Date; newStage: number } {
  const newStage = Math.min(currentStage + 1, EXPRESSION_REVIEW_STAGES.length - 1);
  const daysToAdd = EXPRESSION_REVIEW_STAGES[newStage];
  const baseDate = lastReviewedAt || createdAt;
  const nextReviewAt = addDays(baseDate, daysToAdd);

  return { nextReviewAt, newStage };
}

/**
 * Legacy function for backward compatibility
 * Defaults to mistake SRS logic
 */
export function calculateNextReviewDate(
  currentStage: number,
  isCorrect: boolean,
  lastReviewedAt: Date | null,
  createdAt: Date
): { nextReviewAt: Date; newStage: number } {
  return calculateMistakeNextReviewDate(currentStage, isCorrect, lastReviewedAt, createdAt);
}

export function getTodayReviewDate(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export function formatDateForDb(date: Date): string {
  return format(date, 'yyyy-MM-dd HH:mm:ss');
}