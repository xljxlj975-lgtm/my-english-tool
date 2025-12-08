import { format, addDays } from 'date-fns';

// Mistake SRS: Infinite ladder with decay [1, 3, 7, 14, 30, 60, 120, 240]
export const MISTAKE_REVIEW_STAGES = [1, 3, 7, 14, 30, 60, 120, 240];

// Expression SRS: Lightweight upgrade system [1, 7, 21, 60]
export const EXPRESSION_REVIEW_STAGES = [1, 7, 21, 60];

// Legacy support
export const REVIEW_STAGES = MISTAKE_REVIEW_STAGES;

/**
 * Calculate decay for overdue mistakes
 * If overdue_days > current_interval * 2, reduce stage by 1
 * Returns the adjusted stage (minimum 0)
 */
function applyDecay(
  currentStage: number,
  nextReviewAt: Date,
  now: Date
): number {
  if (currentStage === 0) return 0; // Already at minimum

  const currentInterval = MISTAKE_REVIEW_STAGES[currentStage];
  const overdueDays = Math.floor((now.getTime() - nextReviewAt.getTime()) / (1000 * 60 * 60 * 24));

  if (overdueDays > currentInterval * 2) {
    return Math.max(currentStage - 1, 0);
  }

  return currentStage;
}

/**
 * Calculate next review date for mistakes (error correction)
 * - If correct: move to next stage
 * - If incorrect: reset to stage 0
 * - Decay: If overdue > interval * 2, reduce stage by 1
 * - Stages: [1, 3, 7, 14, 30, 60, 120, 240] days
 */
export function calculateMistakeNextReviewDate(
  currentStage: number,
  isCorrect: boolean,
  lastReviewedAt: Date | null,
  createdAt: Date,
  nextReviewAt: Date | null = null
): { nextReviewAt: Date; newStage: number } {
  const now = new Date();

  // Apply decay if overdue (only if we have a scheduled review date)
  let adjustedStage = currentStage;
  if (nextReviewAt && now > nextReviewAt) {
    adjustedStage = applyDecay(currentStage, nextReviewAt, now);
  }

  // Then apply normal SRS logic
  let newStage = adjustedStage;
  if (isCorrect) {
    newStage = Math.min(adjustedStage + 1, MISTAKE_REVIEW_STAGES.length - 1);
  } else {
    newStage = 0;
  }

  const daysToAdd = MISTAKE_REVIEW_STAGES[newStage];
  const baseDate = lastReviewedAt || createdAt;
  const nextReview = addDays(baseDate, daysToAdd);

  return { nextReviewAt: nextReview, newStage };
}

/**
 * Calculate next review date for expressions (expression upgrade)
 * - Always moves to next stage (no error marking)
 * - No decay mechanism
 * - Stages: [1, 7, 21, 60] days
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
 * Defaults to mistake SRS logic without decay
 */
export function calculateNextReviewDate(
  currentStage: number,
  isCorrect: boolean,
  lastReviewedAt: Date | null,
  createdAt: Date
): { nextReviewAt: Date; newStage: number } {
  return calculateMistakeNextReviewDate(currentStage, isCorrect, lastReviewedAt, createdAt, null);
}

export function getTodayReviewDate(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export function formatDateForDb(date: Date): string {
  return format(date, 'yyyy-MM-dd HH:mm:ss');
}