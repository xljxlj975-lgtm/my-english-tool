import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface Mistake {
  id: string;
  created_at: string;
  error_sentence: string;
  correct_sentence: string;
  explanation: string | null;
  type: 'grammar' | 'vocabulary' | 'collocation' | 'tense' | 'pronunciation' | 'uncategorized';
  status: 'unlearned' | 'learned';
  next_review_at: string;
  review_stage: number;
  review_count: number;
}

let cachedClient: SupabaseClient | null = null;

function createSupabaseClient(): SupabaseClient {
  const supabaseUrl =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    throw new Error('Missing Supabase URL. Please set SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL.');
  }

  if (!supabaseServiceKey) {
    throw new Error('Missing Supabase key. Please set SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, or NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
    },
  });
}

export function getSupabaseClient(): SupabaseClient {
  if (!cachedClient) {
    cachedClient = createSupabaseClient();
  }
  return cachedClient;
}

// Temporary compatibility alias for existing imports
export const getDatabase = getSupabaseClient;
