import { getSupabaseClient } from './database';

export interface UserSettings {
  daily_target: number;
}

/**
 * Get user settings from database
 * Returns default values if no settings exist
 */
export async function getSettings(): Promise<UserSettings> {
  try {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .single();

    if (error || !data) {
      // Return defaults if no settings found
      return {
        daily_target: 50,
      };
    }

    return {
      daily_target: data.daily_target,
    };
  } catch (error) {
    console.error('Error fetching settings:', error);
    // Return defaults on error
    return {
      daily_target: 50,
    };
  }
}
