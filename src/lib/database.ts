import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface Mistake {
  id: string;
  created_at: string;
  error_sentence: string;
  correct_sentence: string;
  explanation: string | null;
  status: 'unlearned' | 'learned';
  next_review_at: string; // Note: Uses '9999-12-31T00:00:00.000Z' for retired items
  review_stage: number;
  review_count: number;
  content_type?: 'mistake' | 'expression'; // v2.0: 区分错误和表达优化
  last_reviewed_at?: string | null; // v2.0: 记录实际复习时间

  // v3.0: Enhanced SRS fields
  last_score?: number | null;              // 最后评分 (0-3)
  consecutive_hard_count?: number;         // 连续Hard次数
  health_check_at?: string | null;         // 健康检查时间
  previous_interval?: number | null;       // 上一次间隔天数
  reappear_count?: number;                 // 当日重现次数
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
