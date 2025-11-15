import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/database';

// GET /api/settings - Get current settings
export async function GET() {
  try {
    const supabase = getSupabaseClient();

    // Fetch the settings (we use a single global settings row)
    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    // If no settings exist, return defaults
    if (!data) {
      return NextResponse.json({
        daily_target: 50,
      });
    }

    return NextResponse.json({
      daily_target: data.daily_target,
      updated_at: data.updated_at,
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

// PUT /api/settings - Update settings
export async function PUT(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const body = await request.json();

    const { daily_target } = body;

    // Validate daily_target
    if (![30, 50, 70, 100].includes(daily_target)) {
      return NextResponse.json(
        { error: 'daily_target must be one of: 30, 50, 70, 100' },
        { status: 400 }
      );
    }

    // Try to update existing settings
    const { data: existing } = await supabase
      .from('user_settings')
      .select('id')
      .single();

    if (existing) {
      // Update existing settings
      const { error: updateError } = await supabase
        .from('user_settings')
        .update({
          daily_target,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);

      if (updateError) {
        throw updateError;
      }
    } else {
      // Insert new settings if none exist
      const { error: insertError } = await supabase
        .from('user_settings')
        .insert({
          daily_target,
        });

      if (insertError) {
        throw insertError;
      }
    }

    return NextResponse.json({
      message: 'Settings updated successfully',
      daily_target,
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
