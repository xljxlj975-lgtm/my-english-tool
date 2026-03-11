
import { createClient } from '@supabase/supabase-js';
import { getFutureReviewLoad } from '../src/lib/spaced-repetition';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
const envPath = path.resolve(process.cwd(), '.env.local');
console.log('Loading env from:', envPath);
dotenv.config({ path: envPath });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('URL present:', !!supabaseUrl);
console.log('Key present:', !!supabaseKey);

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log('Testing getFutureReviewLoad...');
    try {
        const load = await getFutureReviewLoad(supabase, 7);
        console.log('Load Map:', JSON.stringify(load, null, 2));

        // Verify if any count is > 0
        const totalLoad = Object.values(load).reduce((a, b) => a + b, 0);
        console.log('Total Load detected:', totalLoad);
    } catch (error) {
        console.error('Error:', error);
    }
}

main();
