import { format, addDays, differenceInCalendarDays } from 'date-fns';

/**
 * v3.0: Enhanced SRS System
 * 4级评分 + 渐进稳定增长 + 智能负载均衡
 */

// ============================================================================
// 常量定义
// ============================================================================

/**
 * v3.0: 统一的复习阶段（适用于Mistake和Expression）
 * 基础阶段：0-10级
 */
export const UNIFIED_REVIEW_STAGES = [
  1,    // Level 0: 当天（评分0时）
  1,    // Level 1
  3,    // Level 2
  7,    // Level 3
  14,   // Level 4
  21,   // Level 5
  35,   // Level 6
  50,   // Level 7
  70,   // Level 8
  100,  // Level 9
  140,  // Level 10
];

// 冷却上限：最长间隔120天
export const MAX_INTERVAL = 120;

// 评分枚举
export enum Score {
  Forgot = 0,      // 完全忘了
  Hard = 1,        // 勉强想起
  Good = 2,        // 熟练
  Perfect = 3,     // 非常熟练
}

// Legacy support
export const MISTAKE_REVIEW_STAGES = UNIFIED_REVIEW_STAGES;
export const EXPRESSION_REVIEW_STAGES = UNIFIED_REVIEW_STAGES;
export const REVIEW_STAGES = UNIFIED_REVIEW_STAGES;

// ============================================================================
// 类型定义
// ============================================================================

export interface CalculateNextReviewParams {
  currentStage: number;
  score: Score;
  lastReviewedAt: Date | null;
  nextReviewAt: Date | null;
  previousInterval: number | null;
  consecutiveHardCount: number;
  cardId: string;
  reviewLoadMap?: Record<string, number>; // 可选：未来负载分布
}

export interface CalculateNextReviewResult {
  nextReviewAt: Date;
  newStage: number;
  healthCheckAt: Date | null;
  newConsecutiveHardCount: number;
  newPreviousInterval: number;
  reappearInSession: boolean; // 是否需要当日重现
}

// ============================================================================
// 核心算法：计算下次复习
// ============================================================================

/**
 * v3.0: 统一的SRS计算函数
 *
 * @param params - 计算参数
 * @returns 下次复习时间、新阶段、健康检查时间等
 */
export function calculateNextReview(
  params: CalculateNextReviewParams
): CalculateNextReviewResult {
  const now = new Date();
  const maxStageIndex = UNIFIED_REVIEW_STAGES.length - 1;

  let newStage = params.currentStage;
  let nextInterval = 1;
  let healthCheckAt: Date | null = null;
  let newConsecutiveHardCount = params.consecutiveHardCount;
  let reappearInSession = false;

  // === 1. 根据评分决定阶段变化 ===

  switch (params.score) {
    case Score.Forgot: // 0 - 完全忘了
      // 回退2-3级，但不低于0
      newStage = Math.max(0, params.currentStage - 3);
      nextInterval = UNIFIED_REVIEW_STAGES[newStage];
      newConsecutiveHardCount = 0;
      reappearInSession = true; // 标记需要当日重现
      break;

    case Score.Hard: // 1 - 勉强想起
      // 保持当前级别，但缩短50%间隔
      newStage = params.currentStage;
      const currentInterval = params.currentStage <= maxStageIndex
        ? UNIFIED_REVIEW_STAGES[params.currentStage]
        : (params.previousInterval || 140);
      nextInterval = Math.max(1, Math.round(currentInterval * 0.5));

      // 连续两次Hard -> 当日重现
      newConsecutiveHardCount++;
      if (newConsecutiveHardCount >= 2) {
        reappearInSession = true;
        newConsecutiveHardCount = 0;
      }
      break;

    case Score.Good: // 2 - 熟练
      // 正常升级
      if (params.currentStage < maxStageIndex) {
        // 基础阶段：升1级
        newStage = params.currentStage + 1;
        nextInterval = UNIFIED_REVIEW_STAGES[newStage];
      } else {
        // 高级阶段：渐进增长
        const prevInterval = params.previousInterval || UNIFIED_REVIEW_STAGES[maxStageIndex];
        // 增长率随阶段递减: multiplier = 1 + 0.5 / sqrt(stage)
        const multiplier = 1 + (0.5 / Math.sqrt(params.currentStage + 1));
        nextInterval = Math.min(
          Math.round(prevInterval * multiplier),
          MAX_INTERVAL
        );
        newStage = maxStageIndex; // 保持在最高阶段
      }
      newConsecutiveHardCount = 0;
      break;

    case Score.Perfect: // 3 - 非常熟练
      // 加速升级
      if (params.currentStage < maxStageIndex) {
        // 基础阶段：低级时跳2级，高级时跳1级
        const jump = params.currentStage < 5 ? 2 : 1;
        newStage = Math.min(params.currentStage + jump, maxStageIndex);
        nextInterval = UNIFIED_REVIEW_STAGES[newStage];
      } else {
        // 高级阶段：加速增长 (1.8倍)
        const prevInterval = params.previousInterval || UNIFIED_REVIEW_STAGES[maxStageIndex];
        nextInterval = Math.min(
          Math.round(prevInterval * 1.8),
          MAX_INTERVAL
        );
        newStage = maxStageIndex;

        // 设置健康检查（60-90天后）
        const healthCheckDays = 60 + Math.floor(Math.random() * 30);
        healthCheckAt = addDays(now, healthCheckDays);
      }
      newConsecutiveHardCount = 0;
      break;
  }

  // === 2. 应用动态Fuzzing（负载均衡） ===
  const fuzzedInterval = applyDynamicFuzzing(
    nextInterval,
    params.cardId,
    params.reviewLoadMap
  );

  // === 3. 计算最终日期 ===
  const nextReviewAt = addDays(now, fuzzedInterval);

  return {
    nextReviewAt,
    newStage,
    healthCheckAt,
    newConsecutiveHardCount,
    newPreviousInterval: nextInterval, // 存储原始间隔（未fuzzing前）
    reappearInSession,
  };
}

// ============================================================================
// 动态Fuzzing（负载均衡）
// ============================================================================

/**
 * v3.0: 动态Fuzzing - 根据未来负载分散复习日期
 *
 * 策略：
 * 1. 如果没有负载数据，使用确定性静态fuzzing
 * 2. 如果有负载数据，选择负载最低的日期
 */
function applyDynamicFuzzing(
  interval: number,
  cardId: string,
  reviewLoadMap?: Record<string, number>
): number {
  // 计算模糊范围：至少3天，最多interval的20%，上限14天
  const fuzzyRange = Math.max(
    3,
    Math.min(Math.floor(interval * 0.2), 14)
  );

  // 如果没有负载数据，使用静态fuzzing
  if (!reviewLoadMap) {
    return staticFuzz(cardId, interval, fuzzyRange);
  }

  // === 动态负载均衡 ===
  const baseDate = addDays(new Date(), interval);

  // 收集候选日期
  const candidates: Array<{ date: Date; offset: number; score: number }> = [];

  for (let offset = -fuzzyRange; offset <= fuzzyRange; offset++) {
    const candidateDate = addDays(baseDate, offset);
    const dateKey = format(candidateDate, 'yyyy-MM-dd');
    const load = reviewLoadMap[dateKey] || 0;

    // 评分：负载越低越好，但也要考虑距离baseDate的偏移
    // score = load + abs(offset) * 0.5
    const score = load + Math.abs(offset) * 0.5;

    candidates.push({ date: candidateDate, offset, score });
  }

  // 选择得分最低的日期
  candidates.sort((a, b) => a.score - b.score);
  const bestCandidate = candidates[0];

  return interval + bestCandidate.offset;
}

/**
 * 静态Fuzzing（确定性，基于卡片ID）
 */
function staticFuzz(
  cardId: string,
  interval: number,
  fuzzyRange: number
): number {
  // 使用hash算法
  let hash = 0;
  for (let i = 0; i < cardId.length; i++) {
    hash = ((hash << 5) - hash) + cardId.charCodeAt(i);
    hash |= 0;
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;

  const absHash = Math.abs(hash);
  const variants: number[] = [];

  for (let i = -fuzzyRange; i <= fuzzyRange; i++) {
    variants.push(i);
  }

  const delta = variants[absHash % variants.length];
  return Math.max(1, interval + delta);
}

// ============================================================================
// 优先级计算
// ============================================================================

/**
 * 计算卡片的优先级分数
 * 分数越高，优先级越高
 */
export function calculatePriority(card: {
  last_score?: number | null;
  next_review_at: string;
  review_stage: number;
  consecutive_hard_count?: number;
}): number {
  let priority = 0;

  // 1. 基于最后评分（40分权重）
  if (card.last_score === 0) {
    priority += 40; // 完全忘了：最高优先级
  } else if (card.last_score === 1) {
    priority += 30; // 勉强想起：高优先级
  } else if (card.last_score === 2) {
    priority += 20; // 熟练：中优先级
  } else if (card.last_score === 3) {
    priority += 5;  // 非常熟练：低优先级（健康检查）
  } else {
    priority += 15; // 未评分：中等优先级
  }

  // 2. 基于超期天数（30分权重）
  const now = new Date();
  const nextReview = new Date(card.next_review_at);
  const overdueDays = differenceInCalendarDays(now, nextReview);

  if (overdueDays > 0) {
    // 超期越久，优先级越高（每天+3分，最多30分）
    priority += Math.min(overdueDays * 3, 30);
  }

  // 3. 基于复习阶段（20分权重）
  // 低阶段（不熟练）优先级更高
  const stageScore = Math.max(0, 10 - card.review_stage);
  priority += stageScore * 2;

  // 4. 基于连续Hard次数（10分权重）
  if (card.consecutive_hard_count && card.consecutive_hard_count > 0) {
    priority += card.consecutive_hard_count * 5;
  }

  return priority;
}

// ============================================================================
// Legacy函数（向后兼容）
// ============================================================================

/**
 * Legacy: calculateMistakeNextReviewDate
 * 保持接口兼容，内部调用新的calculateNextReview
 */
export function calculateMistakeNextReviewDate(
  currentStage: number,
  isCorrect: boolean,
  lastReviewedAt: Date | null,
  createdAt: Date,
  nextReviewAt: Date | null = null,
  id: string = 'default'
): { nextReviewAt: Date; newStage: number } {
  // 将旧的isCorrect映射到新的Score系统
  const score = isCorrect ? Score.Good : Score.Forgot;

  const result = calculateNextReview({
    currentStage,
    score,
    lastReviewedAt,
    nextReviewAt,
    previousInterval: null,
    consecutiveHardCount: 0,
    cardId: id,
  });

  return {
    nextReviewAt: result.nextReviewAt,
    newStage: result.newStage,
  };
}

/**
 * Legacy: calculateExpressionNextReviewDate
 * 保持接口兼容，始终当作Good评分
 */
export function calculateExpressionNextReviewDate(
  currentStage: number,
  lastReviewedAt: Date | null,
  createdAt: Date
): { nextReviewAt: Date; newStage: number } {
  const result = calculateNextReview({
    currentStage,
    score: Score.Good,
    lastReviewedAt,
    nextReviewAt: null,
    previousInterval: null,
    consecutiveHardCount: 0,
    cardId: 'expression',
  });

  return {
    nextReviewAt: result.nextReviewAt,
    newStage: result.newStage,
  };
}

/**
 * Legacy: calculateNextReviewDate
 */
export function calculateNextReviewDate(
  currentStage: number,
  isCorrect: boolean,
  lastReviewedAt: Date | null,
  createdAt: Date
): { nextReviewAt: Date; newStage: number } {
  return calculateMistakeNextReviewDate(
    currentStage,
    isCorrect,
    lastReviewedAt,
    createdAt,
    null,
    'legacy'
  );
}

// ============================================================================
// 工具函数
// ============================================================================

export function getTodayReviewDate(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export function formatDateForDb(date: Date): string {
  return format(date, 'yyyy-MM-dd HH:mm:ss');
}

/**
 * v3.0: 获取未来N天的复习负载
 * 这个函数需要访问数据库，所以在实际使用时需要传入supabase client
 */
export async function getFutureReviewLoad(
  supabase: any,
  days: number = 14
): Promise<Record<string, number>> {
  const forecast: Record<string, number> = {};

  for (let i = 0; i < days; i++) {
    const date = addDays(new Date(), i);
    const dateKey = format(date, 'yyyy-MM-dd');

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const { data } = await supabase
      .from('mistakes')
      .select('id', { count: 'exact', head: true })
      .neq('status', 'learned')
      .gte('next_review_at', formatDateForDb(startOfDay))
      .lt('next_review_at', formatDateForDb(endOfDay));

    forecast[dateKey] = data?.length || 0;
  }

  return forecast;
}
