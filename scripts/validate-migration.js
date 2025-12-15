require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function validateMigration() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('🔍 验证v3.0迁移...\n');

  // 1. 检查新字段是否存在
  console.log('1️⃣ 检查新字段...');
  const { data: sample, error: sampleError } = await supabase
    .from('mistakes')
    .select('*')
    .limit(1)
    .single();

  if (sampleError && sampleError.code !== 'PGRST116') {
    console.error('❌ 查询失败:', sampleError);
    process.exit(1);
  }

  if (!sample) {
    console.log('⚠️  数据库中没有数据，跳过字段检查');
  } else {
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
      console.error('   请先运行迁移SQL');
      process.exit(1);
    }

    console.log('✅ 所有新字段已添加');
  }

  // 2. 检查NULL值
  console.log('\n2️⃣ 检查NULL值...');
  const { data: nullRows, count } = await supabase
    .from('mistakes')
    .select('id, last_score, previous_interval', { count: 'exact' })
    .or('last_score.is.null,previous_interval.is.null');

  if (nullRows && nullRows.length > 0) {
    console.error(`❌ 发现${nullRows.length}行有NULL值`);
    console.error('   示例:', nullRows.slice(0, 3));
    process.exit(1);
  }

  console.log('✅ 无NULL值');

  // 3. 统计数据分布
  console.log('\n3️⃣ 统计数据分布...');
  const { data: allCards } = await supabase
    .from('mistakes')
    .select('last_score, review_stage, status');

  if (allCards && allCards.length > 0) {
    const scoreDistribution = allCards.reduce((acc, row) => {
      const score = row.last_score ?? 'null';
      acc[score] = (acc[score] || 0) + 1;
      return acc;
    }, {});

    const stageDistribution = allCards.reduce((acc, row) => {
      const stage = row.review_stage;
      if (stage <= 5) acc['0-5'] = (acc['0-5'] || 0) + 1;
      else if (stage <= 10) acc['6-10'] = (acc['6-10'] || 0) + 1;
      else acc['11+'] = (acc['11+'] || 0) + 1;
      return acc;
    }, {});

    console.log('📊 评分分布:');
    console.log(`   评分0: ${scoreDistribution[0] || 0}`);
    console.log(`   评分1: ${scoreDistribution[1] || 0}`);
    console.log(`   评分2: ${scoreDistribution[2] || 0}`);
    console.log(`   评分3: ${scoreDistribution[3] || 0}`);
    console.log(`   NULL: ${scoreDistribution['null'] || 0}`);

    console.log('\n📈 阶段分布:');
    console.log(`   初级 (0-5): ${stageDistribution['0-5'] || 0}`);
    console.log(`   中级 (6-10): ${stageDistribution['6-10'] || 0}`);
    console.log(`   高级 (11+): ${stageDistribution['11+'] || 0}`);

    const statusDistribution = allCards.reduce((acc, row) => {
      acc[row.status] = (acc[row.status] || 0) + 1;
      return acc;
    }, {});

    console.log('\n📌 状态分布:');
    console.log(`   unlearned: ${statusDistribution['unlearned'] || 0}`);
    console.log(`   learned: ${statusDistribution['learned'] || 0}`);

    console.log(`\n📊 总计: ${allCards.length} 张卡片`);
  } else {
    console.log('⚠️  数据库中没有卡片数据');
  }

  console.log('\n✅ 迁移验证完成！');
  console.log('\n📋 下一步:');
  console.log('   继续执行Phase 1的其他步骤（更新TypeScript接口等）');
}

validateMigration().catch(error => {
  console.error('❌ 验证失败:', error);
  process.exit(1);
});
