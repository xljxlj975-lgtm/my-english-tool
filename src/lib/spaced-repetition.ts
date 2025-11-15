import { format, addDays } from 'date-fns';

export const REVIEW_STAGES = [0, 3, 7, 14, 30]; // Days from creation

export function calculateNextReviewDate(
  currentStage: number,
  isCorrect: boolean,
  lastReviewedAt: Date | null,
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

  // v2.0 核心修复: 基于实际复习时间计算，而非创建时间
  // 如果从未复习过(lastReviewedAt为null)，则使用createdAt作为基准
  // 这确保了向后兼容性，同时修复了"自动推进"的bug
  const baseDate = lastReviewedAt || createdAt;
  const nextReviewAt = addDays(baseDate, daysToAdd);

  return { nextReviewAt, newStage };
}

export function getTodayReviewDate(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export function formatDateForDb(date: Date): string {
  return format(date, 'yyyy-MM-dd HH:mm:ss');
}