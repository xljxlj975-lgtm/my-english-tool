import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient, Mistake } from '@/lib/database';
import { formatDateForDb, calculateNextReviewDate } from '@/lib/spaced-repetition';

// GET /api/mistakes - Get all mistakes with optional filters
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const searchParams = request.nextUrl.searchParams;

    const type = searchParams.get('type');
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const todayReview = searchParams.get('todayReview');

    let query = supabase.from('mistakes').select('*');

    if (type) {
      query = query.eq('type', type);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (search) {
      const escaped = String(search).replace(/[,]/g, '\\,').replace(/\*/g, '\\*');
      const pattern = `*${escaped}*`;
      query = query.or(
        `error_sentence.ilike.${pattern},correct_sentence.ilike.${pattern},explanation.ilike.${pattern}`
      );
    }

    if (todayReview === 'true') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Include anything due before tomorrow (today's queue + overdue backlog)
      query = query
        .lt('next_review_at', formatDateForDb(tomorrow))
        .order('next_review_at', { ascending: true });
    } else {
      query = query.order('created_at', { ascending: false });
    }
    // When todayReview=true we already ordered by next_review_at

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return NextResponse.json((data as Mistake[]) ?? []);
  } catch (error) {
    console.error('Error fetching mistakes:', error);
    return NextResponse.json({ error: 'Failed to fetch mistakes' }, { status: 500 });
  }
}

// POST /api/mistakes - Create a new mistake
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const body = await request.json();

    const {
      error_sentence,
      correct_sentence,
      explanation,
      type = 'uncategorized',
      content_type = 'mistake', // v2.0: 新增内容类型，默认为mistake
    } = body;

    if (!error_sentence || !correct_sentence) {
      return NextResponse.json({ error: 'Error sentence and correct sentence are required' }, { status: 400 });
    }

    // v2.0: 验证content_type
    if (content_type && !['mistake', 'expression'].includes(content_type)) {
      return NextResponse.json({ error: 'content_type must be "mistake" or "expression"' }, { status: 400 });
    }

    const now = new Date();
    const id = crypto.randomUUID();

    // Calculate initial review date (Day 0 - same day)
    // v2.0: 首次创建时lastReviewedAt为null，使用createdAt作为基准
    const { nextReviewAt } = calculateNextReviewDate(0, false, null, now);

    const { error } = await supabase.from('mistakes').insert({
      id,
      error_sentence,
      correct_sentence,
      explanation: explanation || null,
      type,
      content_type, // v2.0: 保存内容类型
      status: 'unlearned',
      next_review_at: formatDateForDb(nextReviewAt),
      review_stage: 0,
      review_count: 0,
      last_reviewed_at: null, // v2.0: 初始为null表示未复习过
    });

    if (error) {
      throw error;
    }

    console.log('[POST /api/mistakes] Inserted mistake:', id, 'content_type:', content_type);

    return NextResponse.json({ id, message: 'Mistake created successfully' }, { status: 201 });
  } catch (error) {
    console.error('Error creating mistake:', error);
    return NextResponse.json({ error: 'Failed to create mistake' }, { status: 500 });
  }
}
