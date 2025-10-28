import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import { formatDateForDb, calculateNextReviewDate } from '@/lib/spaced-repetition';

// POST /api/mistakes/batch - Create multiple mistakes from batch input
export async function POST(request: NextRequest) {
  try {
    console.log('[Batch API] Starting batch creation...');
    const db = getDatabase();
    console.log('[Batch API] Database connection established');
    
    const { batchText, type = 'uncategorized' } = await request.json();
    console.log('[Batch API] Received batch text:', batchText?.length || 0, 'characters');

    if (!batchText) {
      return NextResponse.json({ error: 'Batch text is required' }, { status: 400 });
    }

    // Parse batch text - expect format: "error|correct|explanation" per line
    const lines = batchText.split('\n').filter((line: string) => line.trim());
    const mistakes = [];

    for (const line of lines) {
      const parts = line.split('|').map((part: string) => part.trim());

      if (parts.length >= 2) {
        const [error_sentence, correct_sentence, explanation] = parts;

        if (error_sentence && correct_sentence) {
          mistakes.push({
            error_sentence,
            correct_sentence,
            explanation: explanation || null,
            type
          });
        }
      }
    }

    if (mistakes.length === 0) {
      console.log('[Batch API] No valid mistakes found');
      return NextResponse.json({ error: 'No valid mistakes found in batch text' }, { status: 400 });
    }

    console.log('[Batch API] Parsed', mistakes.length, 'mistakes');
    const now = new Date();
    const createdMistakes = [];

    // Insert all mistakes - using same pattern as single insert
    const insertStmt = db.prepare(`
      INSERT INTO mistakes (id, error_sentence, correct_sentence, explanation, type, next_review_at, review_stage, review_count)
      VALUES (?, ?, ?, ?, ?, ?, 0, 0)
    `);

    console.log('[Batch API] Inserting mistakes...');
    for (const mistake of mistakes) {
      const id = crypto.randomUUID();  // Use global crypto like single insert
      const { nextReviewAt } = calculateNextReviewDate(0, false, now);

      insertStmt.run(
        id,
        mistake.error_sentence,
        mistake.correct_sentence,
        mistake.explanation,
        mistake.type,
        formatDateForDb(nextReviewAt)
      );

      createdMistakes.push({ id, ...mistake });
    }
    console.log('[Batch API] All mistakes inserted successfully');

    return NextResponse.json({
      message: `Successfully created ${createdMistakes.length} mistakes`,
      count: createdMistakes.length,
      mistakes: createdMistakes
    }, { status: 201 });
  } catch (error) {
    console.error('[Batch API] Error creating batch mistakes:', error);
    console.error('[Batch API] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return NextResponse.json({ 
      error: 'Failed to create batch mistakes',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}