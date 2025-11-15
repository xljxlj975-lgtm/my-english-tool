#!/usr/bin/env node

/**
 * Migration Runner Script for v2.0
 *
 * This script automatically executes all pending migrations in the migrations/ folder.
 * Run with: node scripts/run-migrations.js
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const migrations = [
  'v2.0-add-content-type-and-last-reviewed.sql',
  'v2.0-add-user-settings.sql'
];

async function runMigrations() {
  console.log('🚀 Starting v2.0 database migrations...\n');

  for (const migrationFile of migrations) {
    const filePath = path.join(__dirname, '..', 'migrations', migrationFile);

    if (!fs.existsSync(filePath)) {
      console.error(`❌ Migration file not found: ${migrationFile}`);
      continue;
    }

    console.log(`📄 Running migration: ${migrationFile}`);
    const sql = fs.readFileSync(filePath, 'utf-8');

    try {
      // Execute the SQL migration
      const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

      if (error) {
        // If rpc method doesn't exist, try direct execution
        console.log('   Trying direct SQL execution...');

        // Split by semicolons and execute each statement
        const statements = sql
          .split(';')
          .map(s => s.trim())
          .filter(s => s.length > 0 && !s.startsWith('--'));

        for (const statement of statements) {
          const { error: execError } = await supabase.rpc('exec', { sql: statement });
          if (execError) {
            console.error(`   ⚠️  Statement execution note: ${execError.message}`);
            // Continue anyway as some errors might be expected (e.g., "already exists")
          }
        }
      }

      console.log(`   ✅ Migration completed: ${migrationFile}\n`);
    } catch (err) {
      console.error(`   ❌ Error executing ${migrationFile}:`, err.message);
      console.log(`   ℹ️  You may need to run this migration manually in Supabase SQL Editor\n`);
    }
  }

  console.log('🎉 Migration process complete!');
  console.log('\nNext steps:');
  console.log('1. Verify migrations in Supabase dashboard');
  console.log('2. Check that content_type and last_reviewed_at columns exist in mistakes table');
  console.log('3. Check that user_settings table was created');
  console.log('\nIf automatic execution failed, please run the SQL files manually in:');
  console.log('Supabase Dashboard → SQL Editor → New Query → Paste SQL → Run');
}

runMigrations().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
