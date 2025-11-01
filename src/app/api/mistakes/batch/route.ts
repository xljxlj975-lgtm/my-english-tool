import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/database';
import { formatDateForDb, calculateNextReviewDate } from '@/lib/spaced-repetition';

// POST /api/mistakes/batch - Create multiple mistakes from batch input
export async function POST(request: NextRequest) {
  try {
    console.log('[Batch API] Starting batch creation...');
    const supabase = getSupabaseClient();
    console.log('[Batch API] Supabase client initialized');
    
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
    const { nextReviewAt } = calculateNextReviewDate(0, false, now);
    const nextReviewAtFormatted = formatDateForDb(nextReviewAt);

    const records = mistakes.map(mistake => ({
      id: crypto.randomUUID(),
      error_sentence: mistake.error_sentence,
      correct_sentence: mistake.correct_sentence,
      explanation: mistake.explanation || null,
      type: mistake.type,
      status: 'unlearned',
      next_review_at: nextReviewAtFormatted,
      review_stage: 0,
      review_count: 0,
    }));

    console.log('[Batch API] Inserting mistakes...');

    const { error } = await supabase.from('mistakes').insert(records);

    if (error) {
      throw error;
    }

    console.log('[Batch API] All mistakes inserted successfully:', records.length);

    return NextResponse.json({
      message: `Successfully created ${records.length} mistakes`,
      count: records.length,
      mistakes: records
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
