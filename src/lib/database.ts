import Database from 'better-sqlite3';
import fs from 'fs';
import os from 'os';
import path from 'path';

let db: Database.Database | null = null;
let dbPath: string | null = null;
const DATABASE_FILENAME = 'mistakes.db';
const TMP_SUBDIR = 'my-english-tool';

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
      if (!dbPath) {
        dbPath = resolveDatabasePath();
      }

      console.log('[Database] Initializing database at:', dbPath);

      ensureDirectoryExists(path.dirname(dbPath));

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

function resolveDatabasePath(): string {
  const configuredPath = process.env.DATABASE_PATH;
  if (configuredPath) {
    if (directoryIsWritable(path.dirname(configuredPath))) {
      console.log('[Database] Using DATABASE_PATH environment override:', configuredPath);
      return configuredPath;
    }

    console.warn('[Database] DATABASE_PATH is not writable, falling back to default locations.');
  }

  const defaultDir = path.join(process.cwd(), 'data');
  const defaultPath = path.join(defaultDir, DATABASE_FILENAME);

  if (directoryIsWritable(defaultDir)) {
    return defaultPath;
  }

  const tmpRoot = process.env.TMPDIR || os.tmpdir();
  const tmpDir = path.join(tmpRoot, TMP_SUBDIR);

  ensureDirectoryExists(tmpDir);

  const tmpPath = path.join(tmpDir, DATABASE_FILENAME);

  if (!fs.existsSync(tmpPath) && fs.existsSync(defaultPath)) {
    try {
      fs.copyFileSync(defaultPath, tmpPath);
      console.log('[Database] Copied packaged database to temporary path:', tmpPath);
    } catch (error) {
      console.warn('[Database] Failed to copy packaged database to temporary path:', error);
    }
  }

  console.warn('[Database] Using temporary writable directory for SQLite database:', tmpPath);
  return tmpPath;
}

function ensureDirectoryExists(dir: string) {
  try {
    if (!fs.existsSync(dir)) {
      console.log('[Database] Creating data directory:', dir);
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch (error) {
    console.warn('[Database] Unable to create directory:', dir, error);
  }
}

function directoryIsWritable(dir: string): boolean {
  try {
    ensureDirectoryExists(dir);
    fs.accessSync(dir, fs.constants.W_OK);
    return true;
  } catch (error) {
    return false;
  }
}
