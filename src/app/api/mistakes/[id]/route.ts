import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/database';
import { formatDateForDb, calculateNextReviewDate } from '@/lib/spaced-repetition';

type RouteContext = {
  params: Promise<{ id: string }>;
};

// PUT /api/mistakes/[id] - Update mistake (for review)
export async function PUT(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    const supabase = getSupabaseClient();
    const { id } = await params;
    const { isCorrect } = await request.json();

    if (typeof isCorrect !== 'boolean') {
      return NextResponse.json({ error: 'isCorrect field is required and must be a boolean' }, { status: 400 });
    }

    // Get current mistake data
    const { data: mistake, error: fetchError } = await supabase
      .from('mistakes')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      throw fetchError;
    }

    if (!mistake) {
      return NextResponse.json({ error: 'Mistake not found' }, { status: 404 });
    }

    // Calculate new review date and stage
    const createdAt = new Date(mistake.created_at);
    const { nextReviewAt, newStage } = calculateNextReviewDate(mistake.review_stage, isCorrect, createdAt);

    // Update status based on completion
    const newStatus = newStage === 4 && isCorrect ? 'learned' : 'unlearned';

    const { error: updateError } = await supabase
      .from('mistakes')
      .update({
        status: newStatus,
        next_review_at: formatDateForDb(nextReviewAt),
        review_stage: newStage,
        review_count: (mistake.review_count ?? 0) + 1,
      })
      .eq('id', id);

    if (updateError) {
      throw updateError;
    }

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
  { params }: RouteContext
) {
  try {
    const supabase = getSupabaseClient();
    const { id } = await params;

    const { data, error } = await supabase
      .from('mistakes')
      .delete()
      .eq('id', id)
      .select('id')
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return NextResponse.json({ error: 'Mistake not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Mistake deleted successfully' });
  } catch (error) {
    console.error('Error deleting mistake:', error);
    return NextResponse.json({ error: 'Failed to delete mistake' }, { status: 500 });
  }
}
