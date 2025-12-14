# 新SRS系统实施方案
## Enhanced Spaced Repetition System - 完整技术设计文档

**版本**: v3.0
**创建日期**: 2025-12-14
**目标**: 实现无限复习、智能负载均衡、当日重现机制

---

## 目录

1. [设计目标](#设计目标)
2. [数据库架构变更](#数据库架构变更)
3. [核心算法设计](#核心算法设计)
4. [当日重现机制](#当日重现机制)
5. [优先级与负载平衡](#优先级与负载平衡)
6. [API接口变更](#api接口变更)
7. [UI组件变更](#ui组件变更)
8. [实施路线图](#实施路线图)
9. [测试计划](#测试计划)
10. [数据迁移](#数据迁移)

---

## 设计目标

### 核心问题
1. ✅ **无限复习**：Expression类型复习4次后就停止，Mistake类型间隔很快变得极长（>1年）
2. ✅ **负载波动大**：每日复习量不稳定，某些天可能暴增到100+，某些天只有10个
3. ✅ **缺少当日巩固**：答错的卡片直接重置到次日，缺少短期记忆巩固

### 解决方案
- **4级评分系统**：0(完全忘了) / 1(勉强想起) / 2(熟练) / 3(非常熟练)
- **渐进稳定增长**：间隔最长不超过120天，确保持续复习
- **当日多次重现**：评分0/1的卡片在当前会话中重复出现2-3次
- **智能负载均衡**：优先级排序 + 动态fuzzing + 滚动机制

---

## 数据库架构变更

### 1. 新增字段到 `mistakes` 表

```sql
-- 添加新字段的迁移SQL
ALTER TABLE mistakes
  ADD COLUMN IF NOT EXISTS last_score INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS consecutive_hard_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS health_check_at TIMESTAMP DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS previous_interval INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS reappear_count INTEGER DEFAULT 0;

-- 添加索引以优化查询
CREATE INDEX IF NOT EXISTS idx_mistakes_health_check
  ON mistakes(health_check_at)
  WHERE health_check_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mistakes_next_review_score
  ON mistakes(next_review_at, last_score);
```

#### 字段说明

| 字段名 | 类型 | 说明 | 默认值 |
|--------|------|------|--------|
| `last_score` | INTEGER | 最后一次评分 (0-3) | NULL |
| `consecutive_hard_count` | INTEGER | 连续评分1的次数 | 0 |
| `health_check_at` | TIMESTAMP | 健康检查时间（评分3时设置） | NULL |
| `previous_interval` | INTEGER | 上一次的间隔天数（用于无限阶段计算） | NULL |
| `reappear_count` | INTEGER | 当日已重现次数（0-2） | 0 |

### 2. 更新 TypeScript 接口

```typescript
// src/lib/database.ts
export interface Mistake {
  id: string;
  created_at: string;
  error_sentence: string;
  correct_sentence: string;
  explanation: string | null;
  status: 'unlearned' | 'learned';
  next_review_at: string;
  review_stage: number;
  review_count: number;
  content_type?: 'mistake' | 'expression';
  last_reviewed_at?: string | null;

  // v3.0: 新增字段
  last_score?: number | null;              // 0-3评分
  consecutive_hard_count?: number;         // 连续Hard次数
  health_check_at?: string | null;         // 健康检查时间
  previous_interval?: number | null;       // 上一次间隔
  reappear_count?: number;                 // 当日重现次数
}
```

---

## 核心算法设计

### 1. 新的间隔阶段定义

```typescript
// src/lib/spaced-repetition.ts

/**
 * v3.0: 统一的复习阶段（适用于Mistake和Expression）
 * 基础阶段：1-10级
 * 高级阶段：11级+（使用渐进稳定增长算法）
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

// 评分类型
export enum Score {
  Forgot = 0,      // 完全忘了
  Hard = 1,        // 勉强想起
  Good = 2,        // 熟练
  Perfect = 3,     // 非常熟练
}
```

### 2. 核心算法：calculateNextReview

```typescript
/**
 * v3.0: 统一的SRS计算函数
 *
 * @param currentStage - 当前阶段 (0-10+)
 * @param score - 用户评分 (0-3)
 * @param lastReviewedAt - 最后复习时间
 * @param nextReviewAt - 计划复习时间
 * @param previousInterval - 上一次间隔（用于高级阶段）
 * @param consecutiveHardCount - 连续Hard次数
 * @param cardId - 卡片ID（用于fuzzing）
 * @param reviewLoadMap - 未来7天负载分布（可选）
 * @returns 下次复习时间、新阶段、健康检查时间等
 */
export function calculateNextReview(params: {
  currentStage: number;
  score: Score;
  lastReviewedAt: Date | null;
  nextReviewAt: Date | null;
  previousInterval: number | null;
  consecutiveHardCount: number;
  cardId: string;
  reviewLoadMap?: Record<string, number>; // 可选：未来负载分布
}): {
  nextReviewAt: Date;
  newStage: number;
  healthCheckAt: Date | null;
  newConsecutiveHardCount: number;
  newPreviousInterval: number;
  reappearInSession: boolean; // 是否需要当日重现
} {
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
```

### 3. 动态Fuzzing算法（负载均衡）

```typescript
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
 * 保持原有的fuzzing逻辑
 */
function staticFuzz(
  cardId: string,
  interval: number,
  fuzzyRange: number
): number {
  // 使用现有的stableFuzz逻辑
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
```

---

## 当日重现机制

### 1. 核心逻辑

**触发条件**：
- 评分 = 0（完全忘了）
- 评分 = 1 且连续2次

**重现规则**：
- 当日会话中重现2-3次
- 每次重现间隔10-15张其他卡片
- 重现时不计入review_count

### 2. 前端实现：重现队列管理

```typescript
// src/app/review/page.tsx

interface ReappearItem {
  card: Mistake;
  insertAt: number;      // 在第几张卡片后插入
  remainingCount: number; // 还需重现几次
}

export default function ReviewPage() {
  const [mainQueue, setMainQueue] = useState<Mistake[]>([]);
  const [reappearQueue, setReappearQueue] = useState<ReappearItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [cardsProcessed, setCardsProcessed] = useState(0); // 已处理的卡片数

  // 处理答题响应
  const handleReviewResponse = async (score: Score) => {
    const currentCard = mainQueue[currentIndex];

    // 调用API更新
    const response = await fetch(`/api/mistakes/${currentCard.id}`, {
      method: 'PUT',
      body: JSON.stringify({ score })
    });

    const result = await response.json();

    // 如果需要当日重现
    if (result.reappearInSession) {
      scheduleReappearance(currentCard);
    }

    // 增加已处理计数
    setCardsProcessed(prev => prev + 1);

    // 检查是否需要插入重现卡片
    checkAndInsertReappearCards();

    // 移动到下一张
    moveToNext();
  };

  // 安排重现
  const scheduleReappearance = (card: Mistake) => {
    const reappearCount = 2; // 重现2次

    for (let i = 0; i < reappearCount; i++) {
      const insertAt = cardsProcessed + (i + 1) * randomInt(10, 15);

      setReappearQueue(prev => [
        ...prev,
        {
          card: { ...card, reappear_count: i + 1 },
          insertAt,
          remainingCount: reappearCount - i,
        }
      ]);
    }
  };

  // 检查并插入重现卡片
  const checkAndInsertReappearCards = () => {
    const toInsert = reappearQueue.filter(
      item => item.insertAt <= cardsProcessed
    );

    if (toInsert.length > 0) {
      // 插入到当前队列
      const newQueue = [...mainQueue];
      toInsert.forEach(item => {
        newQueue.splice(currentIndex + 1, 0, item.card);
      });
      setMainQueue(newQueue);

      // 从重现队列移除
      setReappearQueue(prev =>
        prev.filter(item => item.insertAt > cardsProcessed)
      );
    }
  };

  // ... 其他逻辑
}
```

### 3. 后端支持：重现计数

```typescript
// src/app/api/mistakes/[id]/route.ts

export async function PUT(request: NextRequest, { params }: RouteContext) {
  const { score, isReappearance } = await request.json();

  // ... 计算nextReview等

  // 如果是重现，不增加review_count
  const reviewCountIncrement = isReappearance ? 0 : 1;

  await supabase.from('mistakes').update({
    next_review_at: formatDateForDb(nextReviewAt),
    review_stage: newStage,
    review_count: (mistake.review_count ?? 0) + reviewCountIncrement,
    last_score: score,
    consecutive_hard_count: newConsecutiveHardCount,
    // ... 其他字段
  }).eq('id', id);

  return NextResponse.json({
    reappearInSession: result.reappearInSession,
    // ... 其他数据
  });
}
```

---

## 优先级与负载平衡

### 1. 优先级系统

**优先级定义**：

```typescript
/**
 * 计算卡片的优先级分数
 * 分数越高，优先级越高
 */
function calculatePriority(card: Mistake): number {
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
```

**优先级类别**：

| 类别 | 优先级范围 | 说明 | 示例 |
|------|-----------|------|------|
| 严重错误 | 70-100 | 评分0 + 超期 | 完全忘了且已超期3天 |
| 高优先 | 50-69 | 评分1 或 评分2+超期严重 | 勉强想起、连续Hard |
| 常规复习 | 30-49 | 评分2，正常到期 | 熟练掌握，按时复习 |
| 健康检查 | 0-29 | 评分3，未超期 | 非常熟练，提前复习 |

### 2. 队列生成算法

```typescript
// src/app/api/review-queue/route.ts

export async function GET(request: NextRequest) {
  const mode = searchParams.get('mode') || 'today';
  const settings = await getSettings();

  // 1. 获取所有到期的卡片
  const { data } = await supabase
    .from('mistakes')
    .select('*')
    .neq('status', 'learned')
    .lt('next_review_at', formatDateForDb(tomorrow))
    .order('next_review_at', { ascending: true });

  // 2. 过滤出真正需要复习的
  const needsReview = data.filter(item => {
    if (!item.last_reviewed_at) return true;
    return new Date(item.last_reviewed_at) < new Date(item.next_review_at);
  });

  // 3. 计算优先级并排序
  const withPriority = needsReview.map(card => ({
    ...card,
    priority: calculatePriority(card),
  }));

  withPriority.sort((a, b) => b.priority - a.priority);

  // 4. 应用每日限制
  let result: Mistake[];

  if (mode === 'today') {
    result = withPriority.slice(0, settings.daily_target);
  } else if (mode === 'continue') {
    // 额外20个，从daily_target之后开始
    result = withPriority.slice(
      settings.daily_target,
      settings.daily_target + 20
    );
  } else {
    // backlog: 返回所有
    result = withPriority;
  }

  return NextResponse.json(result);
}
```

### 3. 负载滚动机制

```typescript
/**
 * 处理超量卡片：向后滚动1-2天
 */
async function handleOverload(
  cards: Mistake[],
  dailyTarget: number
): Promise<Mistake[]> {
  if (cards.length <= dailyTarget) {
    return cards; // 无需滚动
  }

  const todayCards = cards.slice(0, dailyTarget);
  const excessCards = cards.slice(dailyTarget);

  // 检查未来两天的负载
  const tomorrowLoad = await getReviewLoadForDate(addDays(new Date(), 1));
  const dayAfterLoad = await getReviewLoadForDate(addDays(new Date(), 2));

  // 选择负载较低的日期
  const rollToDay = tomorrowLoad < dayAfterLoad ? 1 : 2;

  // 更新超量卡片的next_review_at
  for (const card of excessCards) {
    const newDate = addDays(new Date(card.next_review_at), rollToDay);
    await supabase
      .from('mistakes')
      .update({ next_review_at: formatDateForDb(newDate) })
      .eq('id', card.id);
  }

  return todayCards;
}

/**
 * 处理不足情况：从未来拉取健康检查
 */
async function handleUnderload(
  cards: Mistake[],
  dailyTarget: number
): Promise<Mistake[]> {
  if (cards.length >= dailyTarget) {
    return cards; // 无需拉取
  }

  const deficit = dailyTarget - cards.length;

  // 从未来1-2天拉取评分3（健康检查）的卡片
  const { data: futureCards } = await supabase
    .from('mistakes')
    .select('*')
    .eq('last_score', 3)
    .gte('next_review_at', formatDateForDb(tomorrow))
    .lte('next_review_at', formatDateForDb(addDays(new Date(), 3)))
    .order('next_review_at', { ascending: true })
    .limit(deficit);

  return [...cards, ...(futureCards || [])];
}
```

### 4. 未来负载预测

```typescript
// src/app/api/dashboard/route.ts

/**
 * 获取未来7天的复习负载预测
 */
async function getFutureLoadForecast(): Promise<Record<string, number>> {
  const forecast: Record<string, number> = {};

  for (let i = 0; i < 7; i++) {
    const date = addDays(new Date(), i);
    const dateKey = format(date, 'yyyy-MM-dd');

    const count = await getReviewLoadForDate(date);
    forecast[dateKey] = count;
  }

  return forecast;
}

/**
 * 获取指定日期的复习负载
 */
async function getReviewLoadForDate(date: Date): Promise<number> {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const { data } = await supabase
    .from('mistakes')
    .select('id', { count: 'exact' })
    .neq('status', 'learned')
    .gte('next_review_at', formatDateForDb(startOfDay))
    .lt('next_review_at', formatDateForDb(endOfDay));

  return data?.length || 0;
}
```

---

## API接口变更

### 1. PUT /api/mistakes/[id] - 复习响应

**请求体**：
```typescript
{
  score: 0 | 1 | 2 | 3,        // v3.0: 4级评分
  isReappearance?: boolean      // 是否为当日重现（不计入review_count）
}
```

**响应**：
```typescript
{
  message: string;
  nextReviewAt: string;
  newStage: number;
  healthCheckAt: string | null;        // v3.0新增
  reappearInSession: boolean;          // v3.0新增：是否需要当日重现
  consecutiveHardCount: number;        // v3.0新增
}
```

**实现**：
```typescript
export async function PUT(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const { score, isReappearance = false } = await request.json();

  // 验证评分
  if (![0, 1, 2, 3].includes(score)) {
    return NextResponse.json(
      { error: 'Invalid score. Must be 0, 1, 2, or 3.' },
      { status: 400 }
    );
  }

  // 获取卡片数据
  const { data: mistake } = await supabase
    .from('mistakes')
    .select('*')
    .eq('id', id)
    .single();

  if (!mistake) {
    return NextResponse.json({ error: 'Card not found' }, { status: 404 });
  }

  // 可选：获取未来负载数据（用于动态fuzzing）
  const reviewLoadMap = await getFutureReviewLoad();

  // 计算下次复习
  const result = calculateNextReview({
    currentStage: mistake.review_stage,
    score: score as Score,
    lastReviewedAt: mistake.last_reviewed_at ? new Date(mistake.last_reviewed_at) : null,
    nextReviewAt: new Date(mistake.next_review_at),
    previousInterval: mistake.previous_interval,
    consecutiveHardCount: mistake.consecutive_hard_count || 0,
    cardId: mistake.id,
    reviewLoadMap, // 传入负载数据
  });

  // 更新数据库
  await supabase.from('mistakes').update({
    next_review_at: formatDateForDb(result.nextReviewAt),
    review_stage: result.newStage,
    review_count: mistake.review_count + (isReappearance ? 0 : 1),
    last_reviewed_at: formatDateForDb(new Date()),
    last_score: score,
    consecutive_hard_count: result.newConsecutiveHardCount,
    health_check_at: result.healthCheckAt ? formatDateForDb(result.healthCheckAt) : null,
    previous_interval: result.newPreviousInterval,
    status: 'unlearned', // 保持为unlearned（除非退休）
  }).eq('id', id);

  return NextResponse.json({
    message: 'Review recorded successfully',
    nextReviewAt: formatDateForDb(result.nextReviewAt),
    newStage: result.newStage,
    healthCheckAt: result.healthCheckAt ? formatDateForDb(result.healthCheckAt) : null,
    reappearInSession: result.reappearInSession,
    consecutiveHardCount: result.newConsecutiveHardCount,
  });
}
```

### 2. GET /api/review-queue - 获取复习队列

**新增查询参数**：
```
?mode=today|backlog|continue
&applyPriority=true|false          // v3.0新增：是否应用优先级排序
&handleOverload=true|false         // v3.0新增：是否处理超量滚动
```

**响应**：
```typescript
{
  cards: Mistake[];
  metadata: {
    totalDue: number;              // 总到期数
    returnedCount: number;         // 实际返回数
    priorityDistribution: {        // v3.0新增：优先级分布
      critical: number;            // 70-100
      high: number;                // 50-69
      normal: number;              // 30-49
      healthCheck: number;         // 0-29
    }
  }
}
```

### 3. GET /api/dashboard - 仪表板数据

**新增返回字段**：
```typescript
{
  // 原有字段
  todayReviewCount: number;
  totalNeedsReview: number;
  backlogCount: number;
  dailyTarget: number;
  todayCompletedCount: number;

  // v3.0新增
  futureLoadForecast: {            // 未来7天负载预测
    '2025-12-15': 42,
    '2025-12-16': 38,
    '2025-12-17': 51,
    // ...
  },
  priorityStats: {                 // 优先级统计
    critical: 8,
    high: 15,
    normal: 22,
    healthCheck: 5,
  },
  averageDailyLoad: number;        // 未来7天平均负载
  loadStability: 'stable' | 'volatile'; // 负载稳定性
}
```

---

## UI组件变更

### 1. MistakeCard - 4级评分按钮

**位置**: `src/components/MistakeCard.tsx`

**变更内容**：

```tsx
// 当前代码（2个按钮）：
<button onClick={onIncorrect}>Need More Practice</button>
<button onClick={onCorrect}>Got It!</button>

// 新代码（4个按钮）：
<div className="grid grid-cols-2 gap-4">
  <button
    onClick={() => onScore(0)}
    className="bg-red-600 text-white px-6 py-4 rounded-lg hover:bg-red-700"
  >
    <div className="text-2xl mb-1">😰</div>
    <div className="font-semibold">完全忘了</div>
    <div className="text-xs opacity-80">Forgot</div>
  </button>

  <button
    onClick={() => onScore(1)}
    className="bg-orange-500 text-white px-6 py-4 rounded-lg hover:bg-orange-600"
  >
    <div className="text-2xl mb-1">🤔</div>
    <div className="font-semibold">勉强想起</div>
    <div className="text-xs opacity-80">Hard</div>
  </button>

  <button
    onClick={() => onScore(2)}
    className="bg-green-600 text-white px-6 py-4 rounded-lg hover:bg-green-700"
  >
    <div className="text-2xl mb-1">✅</div>
    <div className="font-semibold">熟练</div>
    <div className="text-xs opacity-80">Good</div>
  </button>

  <button
    onClick={() => onScore(3)}
    className="bg-blue-600 text-white px-6 py-4 rounded-lg hover:bg-blue-700"
  >
    <div className="text-2xl mb-1">🚀</div>
    <div className="font-semibold">非常熟练</div>
    <div className="text-xs opacity-80">Perfect</div>
  </button>
</div>
```

**Props更新**：
```typescript
interface MistakeCardProps {
  // ... 其他props
  onScore: (score: 0 | 1 | 2 | 3) => void;  // 替代 onCorrect 和 onIncorrect
}
```

### 2. ExpressionCard - 同样的4级评分

**位置**: `src/components/ExpressionCard.tsx`

**变更**：与MistakeCard相同，将单一的"Acknowledge"按钮替换为4级评分按钮。

### 3. ReviewPage - 重现队列UI提示

**位置**: `src/app/review/page.tsx`

**新增UI元素**：

```tsx
{/* 重现标记 */}
{currentCard.reappear_count > 0 && (
  <div className="bg-yellow-100 border-l-4 border-yellow-500 p-3 mb-4">
    <div className="flex items-center">
      <div className="text-2xl mr-2">🔄</div>
      <div>
        <div className="font-semibold text-yellow-800">
          当日重现 ({currentCard.reappear_count}/2)
        </div>
        <div className="text-sm text-yellow-700">
          这是您在本次会话中第{currentCard.reappear_count + 1}次看到这张卡片
        </div>
      </div>
    </div>
  </div>
)}
```

### 4. Dashboard - 负载预测可视化

**位置**: `src/app/page.tsx` (Dashboard)

**新增组件**：

```tsx
function LoadForecastChart({ forecast }: { forecast: Record<string, number> }) {
  const maxLoad = Math.max(...Object.values(forecast));
  const dailyTarget = 50; // 从settings获取

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold mb-4">未来7天负载预测</h2>

      <div className="space-y-2">
        {Object.entries(forecast).map(([date, count]) => {
          const percentage = (count / dailyTarget) * 100;
          const isOverloaded = count > dailyTarget * 1.2;
          const isUnderloaded = count < dailyTarget * 0.5;

          return (
            <div key={date} className="flex items-center gap-3">
              <div className="w-20 text-sm text-gray-600">
                {format(new Date(date), 'MM/dd')}
              </div>

              <div className="flex-1">
                <div className="w-full bg-gray-200 rounded-full h-6 relative">
                  <div
                    className={`h-6 rounded-full transition-all ${
                      isOverloaded ? 'bg-red-500' :
                      isUnderloaded ? 'bg-blue-300' :
                      'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(percentage, 100)}%` }}
                  />

                  {/* Daily target marker */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-gray-600"
                    style={{ left: '100%' }}
                  />
                </div>
              </div>

              <div className="w-12 text-sm text-gray-700 font-medium">
                {count}
              </div>

              {isOverloaded && (
                <span className="text-xs text-red-600">⚠️ 超载</span>
              )}
              {isUnderloaded && (
                <span className="text-xs text-blue-600">💡 可拉取</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 text-sm text-gray-600">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-gray-600 rounded"></div>
          <span>每日目标: {dailyTarget}</span>
        </div>
      </div>
    </div>
  );
}
```

### 5. 优先级指示器

**新增组件**: `src/components/PriorityBadge.tsx`

```tsx
export function PriorityBadge({ priority }: { priority: number }) {
  let label = '';
  let color = '';

  if (priority >= 70) {
    label = '严重错误';
    color = 'bg-red-600 text-white';
  } else if (priority >= 50) {
    label = '高优先';
    color = 'bg-orange-500 text-white';
  } else if (priority >= 30) {
    label = '常规复习';
    color = 'bg-green-600 text-white';
  } else {
    label = '健康检查';
    color = 'bg-blue-500 text-white';
  }

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${color}`}>
      {label}
    </span>
  );
}
```

**使用**：在ReviewPage的进度条附近显示当前卡片的优先级。

---

## 实施路线图

### Phase 1: 数据库与核心算法（3-4天）

**任务清单**：
- [ ] 1.1 编写数据库迁移SQL
- [ ] 1.2 运行迁移，添加新字段
- [ ] 1.3 更新TypeScript接口（database.ts）
- [ ] 1.4 实现新的评分枚举（Score enum）
- [ ] 1.5 实现calculateNextReview函数
- [ ] 1.6 实现动态fuzzing算法
- [ ] 1.7 编写单元测试

**验收标准**：
- ✅ 所有新字段已添加到数据库
- ✅ calculateNextReview能正确处理4种评分
- ✅ 间隔计算符合设计（上限120天）
- ✅ 单元测试覆盖率 > 80%

---

### Phase 2: API接口更新（2天）

**任务清单**：
- [ ] 2.1 修改PUT /api/mistakes/[id]支持score参数
- [ ] 2.2 实现优先级计算函数
- [ ] 2.3 修改GET /api/review-queue应用优先级排序
- [ ] 2.4 实现负载查询函数
- [ ] 2.5 修改GET /api/dashboard返回未来负载预测
- [ ] 2.6 编写API集成测试

**验收标准**：
- ✅ API能接受4级评分
- ✅ 队列按优先级正确排序
- ✅ Dashboard能返回未来7天预测
- ✅ API测试全部通过

---

### Phase 3: 前端UI更新（2-3天）

**任务清单**：
- [ ] 3.1 修改MistakeCard为4个评分按钮
- [ ] 3.2 修改ExpressionCard为4个评分按钮
- [ ] 3.3 更新ReviewPage的handleReviewResponse
- [ ] 3.4 实现PriorityBadge组件
- [ ] 3.5 创建LoadForecastChart组件
- [ ] 3.6 更新Dashboard页面集成预测图表
- [ ] 3.7 UI测试与优化

**验收标准**：
- ✅ 4个评分按钮显示正确
- ✅ 点击评分按钮能正常工作
- ✅ Dashboard显示未来负载图表
- ✅ UI响应速度 < 200ms

---

### Phase 4: 当日重现机制（2-3天）

**任务清单**：
- [ ] 4.1 实现前端重现队列逻辑
- [ ] 4.2 实现scheduleReappearance函数
- [ ] 4.3 实现checkAndInsertReappearCards函数
- [ ] 4.4 添加重现标记UI
- [ ] 4.5 修改API支持isReappearance参数
- [ ] 4.6 测试重现间隔（10-15张卡）
- [ ] 4.7 端到端测试

**验收标准**：
- ✅ 评分0/1能触发当日重现
- ✅ 重现间隔正确（10-15张）
- ✅ 重现次数正确（2-3次）
- ✅ 重现卡片不计入review_count

---

### Phase 5: 负载平衡高级功能（2天，可选）

**任务清单**：
- [ ] 5.1 实现handleOverload函数（滚动机制）
- [ ] 5.2 实现handleUnderload函数（拉取机制）
- [ ] 5.3 优化动态fuzzing（集成实时负载数据）
- [ ] 5.4 添加负载平衡配置选项
- [ ] 5.5 性能测试与优化

**验收标准**：
- ✅ 超量时能自动滚动到低负载日期
- ✅ 不足时能从未来拉取健康检查
- ✅ 负载波动控制在±20%以内

---

### Phase 6: 数据迁移与兼容性（1-2天）

**任务清单**：
- [ ] 6.1 编写数据迁移脚本（为现有卡片设置默认值）
- [ ] 6.2 测试旧数据兼容性
- [ ] 6.3 编写回滚方案
- [ ] 6.4 备份生产数据
- [ ] 6.5 执行数据迁移

**验收标准**：
- ✅ 现有卡片能正常显示和复习
- ✅ 旧的review_stage能正确映射到新阶段
- ✅ 没有数据丢失

---

### Phase 7: 测试与部署（2天）

**任务清单**：
- [ ] 7.1 全面回归测试
- [ ] 7.2 性能测试（1000+卡片）
- [ ] 7.3 用户验收测试
- [ ] 7.4 文档更新
- [ ] 7.5 部署到生产环境
- [ ] 7.6 监控与修复bug

**验收标准**：
- ✅ 所有功能测试通过
- ✅ 性能满足要求
- ✅ 无Critical bug
- ✅ 文档完整

---

**总计时间**: 14-19天

---

## 测试计划

### 1. 单元测试

**文件**: `src/lib/__tests__/spaced-repetition.test.ts`

```typescript
describe('calculateNextReview', () => {
  test('Score 0 (Forgot) - 回退3级', () => {
    const result = calculateNextReview({
      currentStage: 5,
      score: Score.Forgot,
      // ... other params
    });

    expect(result.newStage).toBe(2); // 5 - 3 = 2
    expect(result.reappearInSession).toBe(true);
  });

  test('Score 1 (Hard) - 连续2次触发重现', () => {
    const result = calculateNextReview({
      currentStage: 4,
      score: Score.Hard,
      consecutiveHardCount: 1, // 已经有1次了
      // ...
    });

    expect(result.newConsecutiveHardCount).toBe(0); // 重置
    expect(result.reappearInSession).toBe(true);
  });

  test('Score 2 (Good) - 正常升级', () => {
    const result = calculateNextReview({
      currentStage: 3,
      score: Score.Good,
      // ...
    });

    expect(result.newStage).toBe(4);
    expect(result.reappearInSession).toBe(false);
  });

  test('Score 3 (Perfect) - 跳级 + 健康检查', () => {
    const result = calculateNextReview({
      currentStage: 2,
      score: Score.Perfect,
      // ...
    });

    expect(result.newStage).toBe(4); // 跳2级
    // 低阶段可能不设置健康检查
  });

  test('高级阶段 - 渐进增长', () => {
    const result = calculateNextReview({
      currentStage: 10,
      score: Score.Good,
      previousInterval: 140,
      // ...
    });

    // multiplier ≈ 1.15
    expect(result.newPreviousInterval).toBeGreaterThan(140);
    expect(result.newPreviousInterval).toBeLessThan(180);
  });

  test('间隔上限 - 不超过120天', () => {
    const result = calculateNextReview({
      currentStage: 10,
      score: Score.Perfect,
      previousInterval: 100,
      // ...
    });

    // 100 * 1.8 = 180，但应被限制为120
    expect(result.newPreviousInterval).toBe(120);
  });
});

describe('applyDynamicFuzzing', () => {
  test('无负载数据 - 使用静态fuzzing', () => {
    const fuzzed = applyDynamicFuzzing(30, 'test-id-123');
    expect(fuzzed).toBeGreaterThanOrEqual(27); // 30 - 3
    expect(fuzzed).toBeLessThanOrEqual(33);    // 30 + 3
  });

  test('有负载数据 - 选择负载最低日期', () => {
    const loadMap = {
      '2025-12-15': 60, // 高负载
      '2025-12-16': 25, // 低负载 <- 应选择
      '2025-12-17': 50,
    };

    // 模拟baseDate = 2025-12-15
    const fuzzed = applyDynamicFuzzing(1, 'test-id', loadMap);
    expect(fuzzed).toBe(2); // offset +1，选择12-16
  });
});

describe('calculatePriority', () => {
  test('评分0 + 超期 = 最高优先级', () => {
    const card = {
      last_score: 0,
      next_review_at: '2025-12-10', // 超期4天
      review_stage: 2,
      consecutive_hard_count: 0,
    };

    const priority = calculatePriority(card);
    expect(priority).toBeGreaterThan(70); // 严重错误
  });

  test('评分3 + 未超期 = 低优先级', () => {
    const card = {
      last_score: 3,
      next_review_at: '2025-12-20', // 未来
      review_stage: 8,
      consecutive_hard_count: 0,
    };

    const priority = calculatePriority(card);
    expect(priority).toBeLessThan(30); // 健康检查
  });
});
```

### 2. 集成测试

**文件**: `src/app/api/__tests__/review-flow.test.ts`

```typescript
describe('Review Flow Integration', () => {
  test('完整复习流程：答题 -> 更新 -> 队列刷新', async () => {
    // 1. 创建测试卡片
    const card = await createTestCard();

    // 2. 获取队列
    let queue = await fetch('/api/review-queue?mode=today').then(r => r.json());
    expect(queue).toContainObject({ id: card.id });

    // 3. 答题（评分2）
    await fetch(`/api/mistakes/${card.id}`, {
      method: 'PUT',
      body: JSON.stringify({ score: 2 })
    });

    // 4. 再次获取队列，应该不包含该卡片
    queue = await fetch('/api/review-queue?mode=today').then(r => r.json());
    expect(queue).not.toContainObject({ id: card.id });
  });

  test('当日重现流程', async () => {
    const card = await createTestCard();

    // 答题评分0
    const response = await fetch(`/api/mistakes/${card.id}`, {
      method: 'PUT',
      body: JSON.stringify({ score: 0 })
    }).then(r => r.json());

    expect(response.reappearInSession).toBe(true);

    // 模拟重现复习
    await fetch(`/api/mistakes/${card.id}`, {
      method: 'PUT',
      body: JSON.stringify({ score: 2, isReappearance: true })
    });

    // 验证review_count没有增加
    const updated = await getCard(card.id);
    expect(updated.review_count).toBe(1); // 只计第一次
  });
});
```

### 3. 端到端测试

使用Playwright或Cypress测试完整的用户流程：

```typescript
test('用户完成一次复习会话', async ({ page }) => {
  // 1. 登录并进入复习页面
  await page.goto('/review');
  await page.click('text=Start Review');

  // 2. 看到第一张卡片
  await expect(page.locator('text=What\'s wrong with this sentence?')).toBeVisible();

  // 3. 点击Show Answer
  await page.click('text=Show Answer');

  // 4. 选择评分（熟练）
  await page.click('button:has-text("熟练")');

  // 5. 应该看到下一张卡片或完成提示
  // ...
});

test('当日重现机制', async ({ page }) => {
  await page.goto('/review');
  await page.click('text=Start Review');

  // 第一张卡片评分0
  await page.click('text=Show Answer');
  await page.click('button:has-text("完全忘了")');

  // 继续复习10-15张卡片...
  for (let i = 0; i < 12; i++) {
    await page.click('text=Show Answer');
    await page.click('button:has-text("熟练")');
  }

  // 应该重新看到第一张卡片
  await expect(page.locator('text=当日重现')).toBeVisible();
});
```

---

## 数据迁移

### 1. 迁移SQL脚本

**文件**: `migrations/v3.0-enhanced-srs.sql`

```sql
-- ================================================
-- Migration: v3.0 Enhanced SRS System
-- Description: 添加新字段支持4级评分和智能负载均衡
-- Date: 2025-12-14
-- ================================================

BEGIN;

-- 1. 添加新字段
ALTER TABLE mistakes
  ADD COLUMN IF NOT EXISTS last_score INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS consecutive_hard_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS health_check_at TIMESTAMP DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS previous_interval INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS reappear_count INTEGER DEFAULT 0;

-- 2. 为现有数据设置默认值
-- 推断last_score：如果status='learned'，设为3；否则设为2
UPDATE mistakes
SET last_score = CASE
  WHEN status = 'learned' THEN 3
  ELSE 2
END
WHERE last_score IS NULL;

-- 推断previous_interval：从review_stage计算
UPDATE mistakes
SET previous_interval = CASE
  WHEN review_stage = 0 THEN 1
  WHEN review_stage = 1 THEN 3
  WHEN review_stage = 2 THEN 7
  WHEN review_stage = 3 THEN 14
  WHEN review_stage = 4 THEN 21
  WHEN review_stage = 5 THEN 35
  WHEN review_stage = 6 THEN 50
  WHEN review_stage = 7 THEN 70
  WHEN review_stage = 8 THEN 100
  WHEN review_stage = 9 THEN 140
  ELSE 140
END
WHERE previous_interval IS NULL;

-- 3. 创建索引
CREATE INDEX IF NOT EXISTS idx_mistakes_health_check
  ON mistakes(health_check_at)
  WHERE health_check_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mistakes_next_review_score
  ON mistakes(next_review_at, last_score);

CREATE INDEX IF NOT EXISTS idx_mistakes_priority
  ON mistakes(last_score, next_review_at, review_stage)
  WHERE status != 'learned';

-- 4. 验证数据完整性
DO $$
DECLARE
  null_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_count
  FROM mistakes
  WHERE last_score IS NULL OR previous_interval IS NULL;

  IF null_count > 0 THEN
    RAISE EXCEPTION 'Migration failed: % rows have NULL values in new columns', null_count;
  END IF;
END $$;

COMMIT;

-- 5. 回滚脚本（如需要）
-- BEGIN;
-- DROP INDEX IF EXISTS idx_mistakes_priority;
-- DROP INDEX IF EXISTS idx_mistakes_next_review_score;
-- DROP INDEX IF EXISTS idx_mistakes_health_check;
-- ALTER TABLE mistakes
--   DROP COLUMN IF EXISTS last_score,
--   DROP COLUMN IF EXISTS consecutive_hard_count,
--   DROP COLUMN IF EXISTS health_check_at,
--   DROP COLUMN IF EXISTS previous_interval,
--   DROP COLUMN IF EXISTS reappear_count;
-- COMMIT;
```

### 2. 运行迁移

```bash
# 方式1：使用Supabase CLI
supabase db push migrations/v3.0-enhanced-srs.sql

# 方式2：使用Node脚本
node scripts/run-migration.js v3.0-enhanced-srs.sql

# 方式3：在Supabase Dashboard SQL编辑器中直接运行
```

### 3. 数据验证脚本

**文件**: `scripts/validate-migration.js`

```javascript
const { getSupabaseClient } = require('../src/lib/database');

async function validateMigration() {
  const supabase = getSupabaseClient();

  console.log('🔍 验证v3.0迁移...\n');

  // 1. 检查新字段是否存在
  const { data: sample } = await supabase
    .from('mistakes')
    .select('*')
    .limit(1)
    .single();

  const requiredFields = [
    'last_score',
    'consecutive_hard_count',
    'health_check_at',
    'previous_interval',
    'reappear_count'
  ];

  const missingFields = requiredFields.filter(
    field => !(field in sample)
  );

  if (missingFields.length > 0) {
    console.error('❌ 缺少字段:', missingFields);
    process.exit(1);
  }

  console.log('✅ 所有新字段已添加');

  // 2. 检查NULL值
  const { data: nullRows } = await supabase
    .from('mistakes')
    .select('id, last_score, previous_interval')
    .or('last_score.is.null,previous_interval.is.null');

  if (nullRows && nullRows.length > 0) {
    console.error(`❌ 发现${nullRows.length}行有NULL值`);
    console.error(nullRows);
    process.exit(1);
  }

  console.log('✅ 无NULL值');

  // 3. 检查索引
  const { data: indexes } = await supabase
    .rpc('get_indexes', { table_name: 'mistakes' });

  const requiredIndexes = [
    'idx_mistakes_health_check',
    'idx_mistakes_next_review_score',
    'idx_mistakes_priority'
  ];

  const indexNames = indexes.map(idx => idx.indexname);
  const missingIndexes = requiredIndexes.filter(
    idx => !indexNames.includes(idx)
  );

  if (missingIndexes.length > 0) {
    console.warn('⚠️  缺少索引:', missingIndexes);
  } else {
    console.log('✅ 所有索引已创建');
  }

  // 4. 统计数据分布
  const { data: scoreDistribution } = await supabase
    .from('mistakes')
    .select('last_score')
    .neq('status', 'learned');

  const distribution = scoreDistribution.reduce((acc, row) => {
    acc[row.last_score] = (acc[row.last_score] || 0) + 1;
    return acc;
  }, {});

  console.log('\n📊 评分分布:');
  console.log(`  评分2: ${distribution[2] || 0}`);
  console.log(`  评分3: ${distribution[3] || 0}`);
  console.log(`  其他: ${distribution[null] || 0 + distribution[0] || 0 + distribution[1] || 0}`);

  console.log('\n✅ 迁移验证完成！');
}

validateMigration().catch(console.error);
```

---

## 附录

### A. 配置文件示例

**用户设置扩展** (`src/lib/settings.ts`):

```typescript
export interface UserSettings {
  daily_target: number;

  // v3.0新增配置
  enable_dynamic_fuzzing: boolean;      // 启用动态负载均衡
  enable_overload_handling: boolean;    // 启用超量滚动
  enable_underload_filling: boolean;    // 启用不足填充
  reappear_count: number;               // 当日重现次数 (2-3)
  reappear_min_gap: number;             // 重现最小间隔卡片数 (10-15)
}
```

### B. 性能优化建议

1. **数据库查询优化**：
   - 使用已创建的索引
   - 避免在循环中查询数据库
   - 使用批量更新（如滚动机制）

2. **前端性能**：
   - 重现队列使用虚拟滚动（如队列很长）
   - 负载预测图表使用Canvas而非SVG（如数据点多）
   - 使用React.memo优化卡片组件

3. **缓存策略**：
   - Dashboard的未来负载可缓存5分钟
   - 队列优先级计算可缓存到用户答题时

### C. 监控指标

部署后需要监控的关键指标：

1. **每日复习量波动**：
   - 目标：标准差 < daily_target * 0.2
   - 监控：7天滚动窗口

2. **当日重现触发率**：
   - 目标：10-20%的卡片需要重现
   - 过高：说明用户遗忘率高
   - 过低：说明卡片太简单

3. **平均间隔增长**：
   - 目标：高级阶段卡片稳定在80-120天
   - 监控：review_stage >= 10的卡片

4. **API响应时间**：
   - 目标：P95 < 500ms
   - 重点：review-queue接口

---

## 结语

这份文档提供了完整的v3.0 Enhanced SRS系统的技术设计。实施时请严格按照路线图执行，每个阶段完成后进行充分测试。

**关键成功因素**：
1. ✅ 数据库迁移无损
2. ✅ 算法逻辑正确
3. ✅ UI/UX流畅
4. ✅ 性能满足要求
5. ✅ 充分的测试覆盖

**预期效果**：
- 📈 用户可以无限复习重要内容
- 📊 每日复习量稳定可控
- 🧠 记忆巩固效果更好
- 😊 用户体验显著提升

祝实施顺利！

---

**文档版本**: v1.0
**最后更新**: 2025-12-14
**作者**: AI Assistant
**审核**: 待用户确认
