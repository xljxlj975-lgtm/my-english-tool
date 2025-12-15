require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function checkLearnedCards() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  const supabase = createClient(supabaseUrl, supabaseKey);

  // 查询learned卡片
  const { data: learnedCards } = await supabase
    .from('mistakes')
    .select('id, status, next_review_at')
    .eq('status', 'learned')
    .neq('next_review_at', '9999-12-31T00:00:00.000Z')
    .order('next_review_at', { ascending: true });

  console.log(`\n📊 Learned卡片统计: ${learnedCards ? learnedCards.length : 0} 张`);

  if (learnedCards && learnedCards.length > 0) {
    // 按日期分组
    const distribution = {};
    learnedCards.forEach(card => {
      const date = card.next_review_at.split('T')[0];
      distribution[date] = (distribution[date] || 0) + 1;
    });

    console.log('\n📅 Learned卡片的next_review_at分布（前15天）:');
    const entries = Object.entries(distribution).slice(0, 15);
    entries.forEach(([date, count]) => {
      const bar = '█'.repeat(Math.ceil(count / 5));
      console.log(`  ${date}: ${count.toString().padStart(3)} ${bar}`);
    });

    // 统计总计
    const total = Object.values(distribution).reduce((a, b) => a + b, 0);
    console.log(`\n📌 总计: ${total} 张learned卡片有未来复习日期`);
  }
}

checkLearnedCards().catch(console.error);
