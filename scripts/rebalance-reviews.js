#!/usr/bin/env node

/**
 * 智能重新调度脚本
 *
 * 功能：
 * 1. 分析未来N天的复习负载
 * 2. 识别负载不均的天数（高峰和低谷）
 * 3. 自动重新分配复习日期，让每天的复习数量更稳定
 * 4. 保持在合理的调整范围内，不破坏SRS算法
 *
 * 使用方法：
 *   node scripts/rebalance-reviews.js [options]
 *
 * 选项：
 *   --days=N          分析未来N天（默认14天）
 *   --target=N        目标每日复习数（默认从设置读取）
 *   --max-shift=N     最大调整天数（默认7天）
 *   --dry-run         模拟运行，不实际修改数据库
 */

const { createClient } = require('@supabase/supabase-js');
const { addDays, format, differenceInCalendarDays } = require('date-fns');
require('dotenv').config({ path: '.env.local' });

// 配置
const ANALYZE_DAYS = parseInt(process.argv.find(arg => arg.startsWith('--days='))?.split('=')[1] || '14');
const MAX_SHIFT_DAYS = parseInt(process.argv.find(arg => arg.startsWith('--max-shift='))?.split('=')[1] || '7');
const DRY_RUN = process.argv.includes('--dry-run');
const TARGET_DAILY = parseInt(process.argv.find(arg => arg.startsWith('--target='))?.split('=')[1] || '0');

// 数据库连接
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ 数据库配置错误：缺少环境变量');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * 获取用户设置的每日目标
 */
async function getDailyTarget() {
  if (TARGET_DAILY > 0) return TARGET_DAILY;

  const { data } = await supabase
    .from('user_settings')
    .select('daily_target')
    .single();

  return data?.daily_target || 50;
}

/**
 * 获取未来N天的复习负载
 */
async function getReviewLoad(days) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const load = {};
  const items = {};

  for (let i = 0; i < days; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);

    const dateKey = format(date, 'yyyy-MM-dd');

    const { data, error } = await supabase
      .from('mistakes')
      .select('*')
      .neq('status', 'learned')
      .gte('next_review_at', date.toISOString())
      .lt('next_review_at', nextDate.toISOString());

    if (error) {
      console.error('查询错误:', error);
      continue;
    }

    // 过滤出真正需要复习的
    const needsReview = (data || []).filter(item => {
      if (!item.last_reviewed_at) return true;
      return new Date(item.last_reviewed_at) < new Date(item.next_review_at);
    });

    load[dateKey] = needsReview.length;
    items[dateKey] = needsReview;
  }

  return { load, items };
}

/**
 * 计算标准差
 */
function calculateStdDev(values) {
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * 智能重新分配复习日期
 */
function rebalanceReviews(items, load, targetDaily) {
  const updates = [];
  const newLoad = { ...load };

  // 对每一天进行处理
  const dates = Object.keys(load).sort();

  for (const date of dates) {
    const currentLoad = newLoad[date];

    // 如果这一天的负载超过目标值的120%，需要分散
    if (currentLoad > targetDaily * 1.2) {
      const excess = currentLoad - targetDaily;
      const dateItems = items[date];

      // 按优先级排序（低优先级的更容易被移动）
      const sortedItems = dateItems.sort((a, b) => {
        const priorityA = calculateItemPriority(a);
        const priorityB = calculateItemPriority(b);
        return priorityA - priorityB; // 低优先级在前
      });

      let movedCount = 0;
      const targetMoveCount = Math.min(excess, Math.floor(dateItems.length * 0.3)); // 最多移动30%

      for (let i = 0; i < sortedItems.length && movedCount < targetMoveCount; i++) {
        const item = sortedItems[i];
        const originalDate = new Date(item.next_review_at);

        // 寻找最佳的目标日期
        const bestTargetDate = findBestTargetDate(date, newLoad, targetDaily, MAX_SHIFT_DAYS);

        if (bestTargetDate) {
          // 计算新的复习时间
          const targetDate = new Date(bestTargetDate);
          targetDate.setHours(
            originalDate.getHours(),
            originalDate.getMinutes(),
            originalDate.getSeconds()
          );

          // 记录更新
          updates.push({
            id: item.id,
            oldDate: item.next_review_at,
            newDate: targetDate.toISOString(),
            reason: `负载均衡: ${date} (${currentLoad}) -> ${bestTargetDate}`,
            shiftDays: differenceInCalendarDays(targetDate, originalDate),
          });

          // 更新负载
          newLoad[date]--;
          newLoad[bestTargetDate]++;
          movedCount++;
        }
      }
    }
    // 如果这一天的负载太低（小于目标值的30%），尝试从其他天拉一些过来
    else if (currentLoad < targetDaily * 0.3 && currentLoad < targetDaily - 10) {
      // 寻找可以移动到这一天的项目
      const capacity = targetDaily - currentLoad;
      let pulledCount = 0;

      for (const sourceDate of dates) {
        if (sourceDate === date) continue;
        if (newLoad[sourceDate] <= targetDaily) continue; // 只从负载高的天拉

        const dateDiff = Math.abs(differenceInCalendarDays(new Date(sourceDate), new Date(date)));
        if (dateDiff > MAX_SHIFT_DAYS) continue; // 距离太远不拉

        const sourceItems = items[sourceDate];
        const sortedItems = sourceItems.sort((a, b) => {
          return calculateItemPriority(a) - calculateItemPriority(b);
        });

        for (const item of sortedItems) {
          if (pulledCount >= capacity) break;
          if (newLoad[sourceDate] <= targetDaily) break;

          const originalDate = new Date(item.next_review_at);
          const targetDate = new Date(date);
          targetDate.setHours(
            originalDate.getHours(),
            originalDate.getMinutes(),
            originalDate.getSeconds()
          );

          updates.push({
            id: item.id,
            oldDate: item.next_review_at,
            newDate: targetDate.toISOString(),
            reason: `填补低谷: ${sourceDate} (${newLoad[sourceDate]}) -> ${date}`,
            shiftDays: differenceInCalendarDays(targetDate, originalDate),
          });

          newLoad[sourceDate]--;
          newLoad[date]++;
          pulledCount++;
        }
      }
    }
  }

  return { updates, newLoad };
}

/**
 * 计算项目优先级（优先级越低越容易被移动）
 */
function calculateItemPriority(item) {
  let priority = 50;

  // 低阶段（不熟练）的优先级更高，不容易被移动
  priority += (10 - item.review_stage) * 5;

  // 最近评分差的优先级更高
  if (item.last_score === 0) priority += 30;
  else if (item.last_score === 1) priority += 20;
  else if (item.last_score === 2) priority += 10;

  // 连续Hard次数多的优先级更高
  if (item.consecutive_hard_count) {
    priority += item.consecutive_hard_count * 5;
  }

  return priority;
}

/**
 * 寻找最佳的目标日期
 */
function findBestTargetDate(currentDate, load, targetDaily, maxShift) {
  const candidates = [];
  const current = new Date(currentDate);

  // 收集候选日期
  for (let offset = -maxShift; offset <= maxShift; offset++) {
    if (offset === 0) continue; // 跳过当前日期

    const candidate = new Date(current);
    candidate.setDate(candidate.getDate() + offset);
    const candidateKey = format(candidate, 'yyyy-MM-dd');

    if (load[candidateKey] === undefined) continue; // 超出范围

    // 评分：越接近目标值越好
    const currentLoad = load[candidateKey];
    const score = Math.abs(currentLoad - targetDaily) + Math.abs(offset) * 0.5;

    candidates.push({ date: candidateKey, score, load: currentLoad });
  }

  // 选择得分最低（最接近目标）且未满的日期
  candidates.sort((a, b) => a.score - b.score);

  for (const candidate of candidates) {
    if (candidate.load < targetDaily) {
      return candidate.date;
    }
  }

  // 如果都满了，选择负载最小的
  if (candidates.length > 0) {
    candidates.sort((a, b) => a.load - b.load);
    return candidates[0].date;
  }

  return null;
}

/**
 * 应用更新到数据库
 */
async function applyUpdates(updates) {
  console.log(`\n📝 应用 ${updates.length} 个更新...\n`);

  const batchSize = 50;
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < updates.length; i += batchSize) {
    const batch = updates.slice(i, i + batchSize);

    for (const update of batch) {
      const { error } = await supabase
        .from('mistakes')
        .update({ next_review_at: update.newDate })
        .eq('id', update.id);

      if (error) {
        console.error(`❌ 更新失败 ${update.id}:`, error.message);
        errorCount++;
      } else {
        successCount++;
      }
    }

    const progress = Math.min(100, Math.floor(((i + batch.length) / updates.length) * 100));
    process.stdout.write(`\r进度: ${progress}% (${successCount}/${updates.length})`);
  }

  console.log(`\n\n✅ 成功: ${successCount}, ❌ 失败: ${errorCount}`);
}

/**
 * 主函数
 */
async function main() {
  console.log('🔄 智能重新调度系统\n');
  console.log('配置:');
  console.log(`  分析天数: ${ANALYZE_DAYS} 天`);
  console.log(`  最大调整: ±${MAX_SHIFT_DAYS} 天`);
  console.log(`  模式: ${DRY_RUN ? '模拟运行' : '实际运行'}`);

  // 获取每日目标
  const dailyTarget = await getDailyTarget();
  console.log(`  每日目标: ${dailyTarget} 个\n`);

  // 获取当前负载
  console.log('📊 分析当前负载...\n');
  const { load, items } = await getReviewLoad(ANALYZE_DAYS);

  // 显示当前分布
  console.log('当前分布:\n');
  const dates = Object.keys(load).sort();
  dates.forEach(date => {
    const count = load[date];
    const bar = '█'.repeat(Math.floor(count / 5));
    const indicator = count > dailyTarget * 1.2 ? ' 🔴' : count < dailyTarget * 0.3 ? ' 🔵' : '';
    console.log(`${date}: ${count.toString().padStart(3)} ${bar}${indicator}`);
  });

  // 计算统计数据
  const counts = Object.values(load);
  const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
  const max = Math.max(...counts);
  const min = Math.min(...counts);
  const stdDev = calculateStdDev(counts);

  console.log('\n统计数据（重新调度前）:');
  console.log(`  平均值: ${avg.toFixed(1)}`);
  console.log(`  最大值: ${max}`);
  console.log(`  最小值: ${min}`);
  console.log(`  标准差: ${stdDev.toFixed(1)}`);
  console.log(`  波动率: ${((stdDev / avg) * 100).toFixed(1)}%`);

  // 执行重新平衡
  console.log('\n🔧 执行重新平衡...\n');
  const { updates, newLoad } = rebalanceReviews(items, load, dailyTarget);

  if (updates.length === 0) {
    console.log('✅ 当前负载已经很均衡，无需调整！');
    return;
  }

  // 显示新分布
  console.log('重新调度后的分布:\n');
  dates.forEach(date => {
    const oldCount = load[date];
    const newCount = newLoad[date];
    const bar = '█'.repeat(Math.floor(newCount / 5));
    const change = newCount - oldCount;
    const changeStr = change > 0 ? `+${change}` : change < 0 ? `${change}` : '';
    console.log(`${date}: ${newCount.toString().padStart(3)} ${bar} ${changeStr}`);
  });

  // 计算新的统计数据
  const newCounts = Object.values(newLoad);
  const newAvg = newCounts.reduce((a, b) => a + b, 0) / newCounts.length;
  const newMax = Math.max(...newCounts);
  const newMin = Math.min(...newCounts);
  const newStdDev = calculateStdDev(newCounts);

  console.log('\n统计数据（重新调度后）:');
  console.log(`  平均值: ${newAvg.toFixed(1)}`);
  console.log(`  最大值: ${newMax}`);
  console.log(`  最小值: ${newMin}`);
  console.log(`  标准差: ${newStdDev.toFixed(1)}`);
  console.log(`  波动率: ${((newStdDev / newAvg) * 100).toFixed(1)}%`);

  console.log('\n改善效果:');
  console.log(`  最大值: ${max} → ${newMax} (${max - newMax > 0 ? '-' : '+'}${Math.abs(max - newMax)})`);
  console.log(`  最小值: ${min} → ${newMin} (${newMin - min > 0 ? '+' : '-'}${Math.abs(newMin - min)})`);
  console.log(`  标准差: ${stdDev.toFixed(1)} → ${newStdDev.toFixed(1)} (${((newStdDev - stdDev) / stdDev * 100).toFixed(1)}%)`);
  console.log(`  波动率: ${((stdDev / avg) * 100).toFixed(1)}% → ${((newStdDev / newAvg) * 100).toFixed(1)}%`);

  console.log(`\n📋 计划调整 ${updates.length} 个项目:`);

  // 显示调整详情（最多显示10个）
  updates.slice(0, 10).forEach((update, i) => {
    console.log(`\n${i + 1}. ${update.oldDate.split('T')[0]} → ${update.newDate.split('T')[0]} (${update.shiftDays > 0 ? '+' : ''}${update.shiftDays}天)`);
    console.log(`   原因: ${update.reason}`);
  });

  if (updates.length > 10) {
    console.log(`\n... 还有 ${updates.length - 10} 个项目`);
  }

  // 应用更新
  if (!DRY_RUN) {
    await applyUpdates(updates);
  } else {
    console.log('\n🔍 模拟运行模式，未实际修改数据库');
    console.log('   移除 --dry-run 参数以实际执行');
  }

  console.log('\n✨ 完成！');
}

main().catch(error => {
  console.error('❌ 错误:', error);
  process.exit(1);
});
