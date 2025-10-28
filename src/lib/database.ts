import Database from 'better-sqlite3';
import path from 'path';

let db: Database.Database | null = null;

export interface Mistake {
  id: string;
  created_at: string;
  error_sentence: string;
  correct_sentence: string;
  explanation?: string;
  type: 'grammar' | 'vocabulary' | 'collocation' | 'tense' | 'pronunciation' | 'uncategorized';
  status: 'unlearned' | 'learned';
  next_review_at: string;
  review_stage: number;
  review_count: number;
}

export function getDatabase(): Database.Database {
  if (!db) {
    try {
      const dbPath = path.join(process.cwd(), 'data', 'mistakes.db');
      console.log('[Database] Initializing database at:', dbPath);

      // Ensure data directory exists
      const fs = require('fs');
      const dataDir = path.dirname(dbPath);
      if (!fs.existsSync(dataDir)) {
        console.log('[Database] Creating data directory:', dataDir);
        fs.mkdirSync(dataDir, { recursive: true });
      }

      console.log('[Database] Opening database connection...');
      db = new Database(dbPath);
      initializeDatabase();
      console.log('[Database] Database initialized successfully');
    } catch (error) {
      console.error('[Database] Error initializing database:', error);
      throw error;
    }
  }

  return db;
}

function initializeDatabase() {
  if (!db) return;

  // Create mistakes table
  db.exec(`
    CREATE TABLE IF NOT EXISTS mistakes (
      id TEXT PRIMARY KEY,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      error_sentence TEXT NOT NULL,
      correct_sentence TEXT NOT NULL,
      explanation TEXT,
      type TEXT CHECK(type IN ('grammar', 'vocabulary', 'collocation', 'tense', 'pronunciation', 'uncategorized')) DEFAULT 'uncategorized',
      status TEXT CHECK(status IN ('unlearned', 'learned')) DEFAULT 'unlearned',
      next_review_at DATETIME NOT NULL,
      review_stage INTEGER DEFAULT 0,
      review_count INTEGER DEFAULT 0
    );
  `);

  // Create index for next_review_at for efficient querying
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_next_review_at ON mistakes(next_review_at);
  `);
}

export function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}