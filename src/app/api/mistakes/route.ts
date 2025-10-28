import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, Mistake } from '@/lib/database';
import { formatDateForDb, calculateNextReviewDate } from '@/lib/spaced-repetition';

// GET /api/mistakes - Get all mistakes with optional filters
export async function GET(request: NextRequest) {
  try {
    const db = getDatabase();
    const searchParams = request.nextUrl.searchParams;

    const type = searchParams.get('type');
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const todayReview = searchParams.get('todayReview');

    let query = 'SELECT * FROM mistakes WHERE 1=1';
    const params: any[] = [];

    if (type) {
      query += ' AND type = ?';
      params.push(type);
    }

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    if (search) {
      query += ' AND (error_sentence LIKE ? OR correct_sentence LIKE ? OR explanation LIKE ?)';
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    if (todayReview === 'true') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      query += ' AND next_review_at >= ? AND next_review_at < ?';
      params.push(formatDateForDb(today), formatDateForDb(tomorrow));
    }

    query += ' ORDER BY created_at DESC';

    const stmt = db.prepare(query);
    const mistakes = stmt.all(...params) as Mistake[];

    return NextResponse.json(mistakes);
  } catch (error) {
    console.error('Error fetching mistakes:', error);
    return NextResponse.json({ error: 'Failed to fetch mistakes' }, { status: 500 });
  }
}

// POST /api/mistakes - Create a new mistake
export async function POST(request: NextRequest) {
  try {
    const db = getDatabase();
    const body = await request.json();

    const { error_sentence, correct_sentence, explanation, type = 'uncategorized' } = body;

    if (!error_sentence || !correct_sentence) {
      return NextResponse.json({ error: 'Error sentence and correct sentence are required' }, { status: 400 });
    }

    const now = new Date();
    const id = crypto.randomUUID();

    // Calculate initial review date (Day 0 - same day)
    const { nextReviewAt } = calculateNextReviewDate(0, false, now);

    const stmt = db.prepare(`
      INSERT INTO mistakes (id, error_sentence, correct_sentence, explanation, type, next_review_at, review_stage, review_count)
      VALUES (?, ?, ?, ?, ?, ?, 0, 0)
    `);

    stmt.run(id, error_sentence, correct_sentence, explanation || null, type, formatDateForDb(nextReviewAt));

    return NextResponse.json({ id, message: 'Mistake created successfully' }, { status: 201 });
  } catch (error) {
    console.error('Error creating mistake:', error);
    return NextResponse.json({ error: 'Failed to create mistake' }, { status: 500 });
  }
}