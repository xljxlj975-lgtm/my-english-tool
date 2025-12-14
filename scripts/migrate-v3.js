require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials');
    console.error('Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('🚀 Starting v3.0 Enhanced SRS Migration...\n');

  // Read migration file
  const migrationPath = path.join(__dirname, '../migrations/v3.0-enhanced-srs.sql');
  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

  // Remove comments and split by semicolon
  const statements = migrationSQL
    .split('\n')
    .filter(line => !line.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .filter(stmt => stmt.trim().length > 0);

  console.log(`📝 Found ${statements.length} SQL statements\n`);

  try {
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i].trim();
      if (!stmt) continue;

      console.log(`⏳ Executing statement ${i + 1}/${statements.length}...`);

      // Note: Supabase client doesn't support raw SQL execution directly
      // We need to use the SQL editor or a different approach
      console.log('⚠️  Note: This script requires manual execution of SQL in Supabase Dashboard');
      console.log('   or using Supabase CLI: supabase db push\n');
      break;
    }

    console.log('✅ Migration script prepared successfully!\n');
    console.log('📋 Next steps:');
    console.log('   1. Open Supabase Dashboard → SQL Editor');
    console.log('   2. Copy the contents of migrations/v3.0-enhanced-srs.sql');
    console.log('   3. Execute the SQL');
    console.log('   4. Run validation: node scripts/validate-migration.js\n');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
