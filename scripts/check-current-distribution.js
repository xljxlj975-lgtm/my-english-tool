require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function checkCurrentDistribution() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: cards } = await supabase
    .from('mistakes')
    .select('next_review_at')
    .neq('status', 'learned')
    .neq('next_review_at', '9999-12-31T00:00:00.000Z')
    .order('next_review_at', { ascending: true });

  if (!cards || cards.length === 0) {
    console.log('没有找到卡片');
    return;
  }

  const distribution = {};
  cards.forEach(card => {
    const date = card.next_review_at.split('T')[0];
    distribution[date] = (distribution[date] || 0) + 1;
  });

  console.log('\n📅 当前数据库实际分布（前25天）:');
  Object.entries(distribution).slice(0, 25).forEach(([date, count]) => {
    const bar = '█'.repeat(Math.ceil(count / 5));
    console.log(`  ${date}: ${count.toString().padStart(3)} ${bar}`);
  });

  const counts = Object.values(distribution);
  const max = Math.max(...counts);
  const min = Math.min(...counts);
  const avg = counts.reduce((a, b) => a + b, 0) / counts.length;

  console.log(`\n📊 统计:`);
  console.log(`   最大: ${max}`);
  console.log(`   最小: ${min}`);
  console.log(`   平均: ${avg.toFixed(1)}`);
  console.log(`   总卡片: ${cards.length}`);
}

checkCurrentDistribution().catch(console.error);
