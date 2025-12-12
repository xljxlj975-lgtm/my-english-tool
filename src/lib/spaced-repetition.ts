import { format, addDays, differenceInCalendarDays } from 'date-fns';

// Mistake SRS: Infinite ladder with decay
// Fixed stages for the beginning: [1, 3, 7, 14, 30, 60, 120, 240]
export const MISTAKE_REVIEW_STAGES = [1, 3, 7, 14, 30, 60, 120, 240];

// Expression SRS: Lightweight upgrade system [1, 7, 21, 60]
export const EXPRESSION_REVIEW_STAGES = [1, 7, 21, 60];

// Legacy support
export const REVIEW_STAGES = MISTAKE_REVIEW_STAGES;

/**
 * Deterministic fuzz based on item ID
 * Returns a small day variation based on the interval magnitude
 */
function stableFuzz(id: string, interval: number): number {
  // Simple hash from string
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash) + id.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  // Avalanche step to mix bits and avoid resonance with small modulos
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;

  const absHash = Math.abs(hash);

  let delta = 0;
  if (interval <= 7) {
    // Small intervals: -1, 0, 1
    const variants = [-1, 0, 1];
    delta = variants[absHash % variants.length];
  } else if (interval <= 30) {
    // Medium intervals: -3 to 3
    const variants = [-3, -2, -1, 0, 1, 2, 3];
    delta = variants[absHash % variants.length];
  } else {
    // Large intervals: -7 to 7
    const variants = [-7, -5, -3, -1, 0, 1, 3, 5, 7];
    delta = variants[absHash % variants.length];
  }

  // Ensure interval is at least 1 day
  return Math.max(1, interval + delta);
}

/**
 * Calculate next review date for mistakes
 * - Supports Infinite SRS: After last fixed stage, interval grows by multiplier
 * - Deterministic Fuzz: Adds ± days based on ID and interval size
 * - Decay: If overdue, growth is slowed down or interval reduced
 */
export function calculateMistakeNextReviewDate(
  currentStage: number,
  isCorrect: boolean,
  lastReviewedAt: Date | null,
  createdAt: Date,
  nextReviewAt: Date | null = null,
  id: string = 'default' // Default for backward compatibility
): { nextReviewAt: Date; newStage: number } {
  const now = new Date();
  const maxStageIndex = MISTAKE_REVIEW_STAGES.length - 1;

  // 1. Handle Incorrect Answer (Reset)
  if (!isCorrect) {
    // Reset to 0
    const newStage = 0;
    const interval = MISTAKE_REVIEW_STAGES[0];
    // No fuzz for immediate reset usually, or maybe slight fuzz to avoid stacking failures?
    // Let's keep stage 0 rigid (1 day) to enforce immediate review
    const nextReview = addDays(now, 1);
    return { nextReviewAt: nextReview, newStage };
  }

  // 2. Handle Correct Answer (Advance)
  let newStage = currentStage;
  let baseDate = lastReviewedAt || createdAt;
  let nextInterval = 1;

  // Determine if we are in "Fixed Stage" or "Infinite Phase"
  if (currentStage < maxStageIndex) {
    // --- Fixed Stage Logic ---

    // Check for Decay before advancing
    // If significantly overdue, maybe we shouldn't advance a full stage?
    // For fixed stages, we stick to the old logic: if overdue > interval*2, drop stage.
    // However, if we just got it CORRECT, we usually advance.
    // The previous logic applied decay first, then advanced.

    let effectiveStage = currentStage;
    if (nextReviewAt && now > nextReviewAt) {
      const currentInterval = MISTAKE_REVIEW_STAGES[currentStage];
      const overdueDays = differenceInCalendarDays(now, nextReviewAt);

      // If overdue by more than 2x interval, penalize
      if (overdueDays > currentInterval * 2) {
        // Drop one stage, but since we got it correct, we'll advance from that lower stage
        // Effectively: stay at current stage ( -1 + 1 = 0 change)
        effectiveStage = Math.max(0, currentStage - 1);
      }
    }

    newStage = effectiveStage + 1;
    nextInterval = MISTAKE_REVIEW_STAGES[newStage];

  } else {
    // --- Infinite Phase Logic (Stage >= maxStageIndex) ---
    // We stay at maxStageIndex visually, but interval grows
    newStage = maxStageIndex;

    // Calculate previous interval
    // Ideally: difference between scheduled review and last review
    let previousInterval = MISTAKE_REVIEW_STAGES[maxStageIndex];
    if (lastReviewedAt && nextReviewAt) {
      previousInterval = differenceInCalendarDays(nextReviewAt, lastReviewedAt);
    }
    // Safety check for bad data
    if (previousInterval <= 0) previousInterval = MISTAKE_REVIEW_STAGES[maxStageIndex];

    // Growth Multiplier
    const GROWTH_MULTIPLIER = 2.2;
    const PENALTY_MULTIPLIER = 1.5; // If overdue

    let multiplier = GROWTH_MULTIPLIER;

    // Check Decay/Overdue
    if (nextReviewAt && now > nextReviewAt) {
      const overdueDays = differenceInCalendarDays(now, nextReviewAt);
      // If overdue by 2x previous interval (serious neglect), grow slower
      if (overdueDays > previousInterval * 2) {
        multiplier = PENALTY_MULTIPLIER;
      }
    }

    nextInterval = Math.round(previousInterval * multiplier);
  }

  // 3. Apply Fuzzing
  // We apply fuzzing to the interval to spread out load
  const fuzzedInterval = stableFuzz(id, nextInterval);

  // 4. Calculate Final Date
  // Always add from NOW for SRS? Or from previous scheduled date?
  // Standard Anki/SRS often adds to NOW when reviewed.
  // "Early review" -> usually penalized. "Late review" -> calculated from now.
  const nextReview = addDays(now, fuzzedInterval);

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
  return calculateMistakeNextReviewDate(currentStage, isCorrect, lastReviewedAt, createdAt, null, 'legacy');
}

export function getTodayReviewDate(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export function formatDateForDb(date: Date): string {
  return format(date, 'yyyy-MM-dd HH:mm:ss');
}