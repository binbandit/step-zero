import { Database } from "bun:sqlite";
import path from "path";
import fs from "fs";

let _db: Database | null = null;

/**
 * Get or create the SQLite database connection.
 * Database is stored at <repo>/.step-zero/reviews.db
 *
 * Resolution order for the repo path:
 *   1. Explicit `repoPath` argument
 *   2. STEP_ZERO_REPO_PATH env var (set by CLI when launching the web server)
 *   3. Legacy ITL_REPO_PATH env var
 *   3. process.cwd() fallback
 */
export function getDb(repoPath?: string): Database {
  if (_db) return _db;

  const basePath =
    process.env.STEP_ZERO_REPO_PATH ||
    process.env.ITL_REPO_PATH ||
    repoPath ||
    process.cwd();
  const dataDir = resolveDataDir(basePath);

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, "reviews.db");
  _db = new Database(dbPath);

  // Enable WAL mode for better concurrent read performance
  _db.exec("PRAGMA journal_mode = WAL");
  _db.exec("PRAGMA foreign_keys = ON");

  // Run migrations
  migrate(_db);

  return _db;
}

function resolveDataDir(basePath: string): string {
  const currentDir = path.join(basePath, ".step-zero");
  const legacyDir = path.join(basePath, ".itl");

  if (fs.existsSync(currentDir) || !fs.existsSync(legacyDir)) {
    return currentDir;
  }

  return legacyDir;
}

/**
 * Close the database connection (for cleanup).
 */
export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}

/**
 * Reset the singleton — useful when switching repo paths.
 */
export function resetDb(): void {
  closeDb();
}

function migrate(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS review_sessions (
      id TEXT PRIMARY KEY,
      repo_path TEXT NOT NULL,
      branch TEXT NOT NULL,
      base_branch TEXT NOT NULL DEFAULT 'main',
      status TEXT NOT NULL DEFAULT 'in_review'
        CHECK (status IN ('in_review', 'changes_requested', 'approved')),
      ai_tool TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS review_rounds (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES review_sessions(id) ON DELETE CASCADE,
      round_number INTEGER NOT NULL,
      commit_sha_start TEXT NOT NULL,
      commit_sha_end TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(session_id, round_number)
    );

    CREATE TABLE IF NOT EXISTS threads (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES review_sessions(id) ON DELETE CASCADE,
      file_path TEXT NOT NULL,
      line_number INTEGER NOT NULL,
      side TEXT NOT NULL DEFAULT 'right' CHECK (side IN ('left', 'right')),
      status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
      session_id TEXT NOT NULL REFERENCES review_sessions(id) ON DELETE CASCADE,
      round_id TEXT REFERENCES review_rounds(id) ON DELETE SET NULL,
      body TEXT NOT NULL,
      author TEXT NOT NULL DEFAULT 'user' CHECK (author IN ('user', 'ai')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_rounds_session ON review_rounds(session_id);
    CREATE INDEX IF NOT EXISTS idx_threads_session ON threads(session_id);
    CREATE INDEX IF NOT EXISTS idx_comments_thread ON comments(thread_id);
    CREATE INDEX IF NOT EXISTS idx_comments_session ON comments(session_id);
  `);

  // Migration: add start_line / end_line to threads (defaults to line_number for existing rows)
  const cols = db.prepare("PRAGMA table_info(threads)").all() as { name: string }[];
  const colNames = cols.map((c) => c.name);
  if (!colNames.includes("start_line")) {
    db.exec("ALTER TABLE threads ADD COLUMN start_line INTEGER NOT NULL DEFAULT 0");
    db.exec("ALTER TABLE threads ADD COLUMN end_line INTEGER NOT NULL DEFAULT 0");
    // Backfill existing rows: start_line = end_line = line_number
    db.exec("UPDATE threads SET start_line = line_number, end_line = line_number WHERE start_line = 0");
  }
}
