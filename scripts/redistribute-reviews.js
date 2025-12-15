require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

/**
 * 重新分散现有卡片的复习日期
 *
 * 这个脚本会：
 * 1. 获取所有未退休的卡片
 * 2. 为每张卡片应用新的fuzzing算法
 * 3. 重新分散next_review_at，避免负载集中
 */

async function redistributeReviews() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('🚀 开始重新分散复习日期...\n');

  // 1. 获取所有未退休的卡片
  const { data: cards, error } = await supabase
    .from('mistakes')
    .select('*')
    .neq('status', 'learned')
    .neq('next_review_at', '9999-12-31T00:00:00.000Z')
    .order('next_review_at', { ascending: true });

  if (error) {
    console.error('❌ 查询失败:', error);
    process.exit(1);
  }

  if (!cards || cards.length === 0) {
    console.log('⚠️  没有需要重新分散的卡片');
    return;
  }

  console.log(`📊 找到 ${cards.length} 张卡片需要重新分散`);

  // 2. 按日期分组，查看当前分布
  const distributionBefore = {};
  cards.forEach(card => {
    const date = card.next_review_at.split('T')[0];
    distributionBefore[date] = (distributionBefore[date] || 0) + 1;
  });

  console.log('\n📅 当前分布（前20天）:');
  Object.entries(distributionBefore)
    .slice(0, 20)
    .forEach(([date, count]) => {
      const bar = '█'.repeat(Math.floor(count / 5));
      console.log(`  ${date}: ${count.toString().padStart(3)} ${bar}`);
    });

  // 3. 应用fuzzing重新分散
  console.log('\n🔄 应用fuzzing算法重新分散...');

  const updates = [];
  const now = new Date();

  for (const card of cards) {
    const originalDate = new Date(card.next_review_at);
    const daysFromNow = Math.max(0, Math.floor((originalDate - now) / (1000 * 60 * 60 * 24)));

    // 计算fuzzing范围
    const fuzzyRange = Math.max(
      3,
      Math.min(Math.floor(daysFromNow * 0.2), 14)
    );

    // 使用确定性fuzzing（基于卡片ID）
    const fuzzedDays = applyStaticFuzz(card.id, daysFromNow, fuzzyRange);

    // 计算新日期
    const newDate = new Date(now);
    newDate.setDate(newDate.getDate() + fuzzedDays);
    newDate.setHours(0, 0, 0, 0);

    updates.push({
      id: card.id,
      next_review_at: newDate.toISOString(),
    });
  }

  // 4. 批量更新数据库
  console.log(`\n💾 更新 ${updates.length} 张卡片...`);

  let successCount = 0;
  let errorCount = 0;

  // 分批更新（每次50张）
  for (let i = 0; i < updates.length; i += 50) {
    const batch = updates.slice(i, i + 50);

    for (const update of batch) {
      const { error: updateError } = await supabase
        .from('mistakes')
        .update({ next_review_at: update.next_review_at })
        .eq('id', update.id);

      if (updateError) {
        errorCount++;
        console.error(`  ❌ 更新失败 (${update.id}):`, updateError.message);
      } else {
        successCount++;
      }
    }

    // 显示进度
    const progress = Math.floor(((i + batch.length) / updates.length) * 100);
    process.stdout.write(`\r  进度: ${progress}% (${i + batch.length}/${updates.length})`);
  }

  console.log(`\n\n✅ 更新完成！`);
  console.log(`  成功: ${successCount}`);
  console.log(`  失败: ${errorCount}`);

  // 5. 查看新的分布
  const { data: updatedCards } = await supabase
    .from('mistakes')
    .select('next_review_at')
    .neq('status', 'learned')
    .neq('next_review_at', '9999-12-31T00:00:00.000Z')
    .order('next_review_at', { ascending: true });

  const distributionAfter = {};
  updatedCards.forEach(card => {
    const date = card.next_review_at.split('T')[0];
    distributionAfter[date] = (distributionAfter[date] || 0) + 1;
  });

  console.log('\n📅 新的分布（前20天）:');
  Object.entries(distributionAfter)
    .slice(0, 20)
    .forEach(([date, count]) => {
      const bar = '█'.repeat(Math.floor(count / 5));
      console.log(`  ${date}: ${count.toString().padStart(3)} ${bar}`);
    });

  // 6. 统计波动改善
  const countsBefore = Object.values(distributionBefore);
  const countsAfter = Object.values(distributionAfter);

  const maxBefore = Math.max(...countsBefore);
  const minBefore = Math.min(...countsBefore.filter(c => c > 0));
  const avgBefore = countsBefore.reduce((a, b) => a + b, 0) / countsBefore.length;

  const maxAfter = Math.max(...countsAfter);
  const minAfter = Math.min(...countsAfter.filter(c => c > 0));
  const avgAfter = countsAfter.reduce((a, b) => a + b, 0) / countsAfter.length;

  console.log('\n📊 波动改善:');
  console.log(`  重分散前: 最大=${maxBefore}, 最小=${minBefore}, 平均=${avgBefore.toFixed(1)}`);
  console.log(`  重分散后: 最大=${maxAfter}, 最小=${minAfter}, 平均=${avgAfter.toFixed(1)}`);
  console.log(`  改善率: ${(((maxBefore - maxAfter) / maxBefore) * 100).toFixed(1)}%`);

  console.log('\n🎉 完成！刷新日历页面查看效果。');
}

/**
 * 静态Fuzzing函数（与spaced-repetition.ts中的相同）
 */
function applyStaticFuzz(cardId, interval, fuzzyRange) {
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
  const variants = [];

  for (let i = -fuzzyRange; i <= fuzzyRange; i++) {
    variants.push(i);
  }

  const delta = variants[absHash % variants.length];
  return Math.max(0, interval + delta);
}

// 运行脚本
redistributeReviews().catch(error => {
  console.error('❌ 脚本执行失败:', error);
  process.exit(1);
});
