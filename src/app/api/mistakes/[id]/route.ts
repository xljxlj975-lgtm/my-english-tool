import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import { formatDateForDb, calculateNextReviewDate } from '@/lib/spaced-repetition';

// PUT /api/mistakes/[id] - Update mistake (for review)
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const db = getDatabase();
    const { id } = params;
    const { isCorrect } = await request.json();

    if (typeof isCorrect !== 'boolean') {
      return NextResponse.json({ error: 'isCorrect field is required and must be a boolean' }, { status: 400 });
    }

    // Get current mistake data
    const getStmt = db.prepare('SELECT * FROM mistakes WHERE id = ?');
    const mistake = getStmt.get(id) as any;

    if (!mistake) {
      return NextResponse.json({ error: 'Mistake not found' }, { status: 404 });
    }

    // Calculate new review date and stage
    const createdAt = new Date(mistake.created_at);
    const { nextReviewAt, newStage } = calculateNextReviewDate(mistake.review_stage, isCorrect, createdAt);

    // Update status based on completion
    const newStatus = newStage === 4 && isCorrect ? 'learned' : 'unlearned';

    const updateStmt = db.prepare(`
      UPDATE mistakes
      SET status = ?, next_review_at = ?, review_stage = ?, review_count = review_count + 1
      WHERE id = ?
    `);

    updateStmt.run(newStatus, formatDateForDb(nextReviewAt), newStage, id);

    return NextResponse.json({
      message: 'Mistake updated successfully',
      newStatus,
      nextReviewAt: formatDateForDb(nextReviewAt),
      newStage
    });
  } catch (error) {
    console.error('Error updating mistake:', error);
    return NextResponse.json({ error: 'Failed to update mistake' }, { status: 500 });
  }
}

// DELETE /api/mistakes/[id] - Delete mistake
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const db = getDatabase();
    const { id } = params;

    const stmt = db.prepare('DELETE FROM mistakes WHERE id = ?');
    const result = stmt.run(id);

    if (result.changes === 0) {
      return NextResponse.json({ error: 'Mistake not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Mistake deleted successfully' });
  } catch (error) {
    console.error('Error deleting mistake:', error);
    return NextResponse.json({ error: 'Failed to delete mistake' }, { status: 500 });
  }
}