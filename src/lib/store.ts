import { v4 as uuidv4 } from "uuid";
import { getDb } from "./db";
import type {
  ReviewSession,
  ReviewRound,
  Thread,
  Comment,
  SessionStatus,
  CommentAuthor,
  DiffSide,
  ReviewSessionRow,
  ReviewRoundRow,
  ThreadRow,
  CommentRow,
} from "@/types";

// ============================================================
// Helpers: Row → Domain Object mappers
// ============================================================

function mapSession(row: ReviewSessionRow): ReviewSession {
  return {
    id: row.id,
    repoPath: row.repo_path,
    branch: row.branch,
    baseBranch: row.base_branch,
    status: row.status,
    aiTool: row.ai_tool,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    rounds: [],
    threads: [],
  };
}

function mapRound(row: ReviewRoundRow): ReviewRound {
  return {
    id: row.id,
    sessionId: row.session_id,
    roundNumber: row.round_number,
    commitShaStart: row.commit_sha_start,
    commitShaEnd: row.commit_sha_end,
    createdAt: row.created_at,
  };
}

function mapThread(row: ThreadRow): Thread {
  return {
    id: row.id,
    sessionId: row.session_id,
    filePath: row.file_path,
    lineNumber: row.line_number,
    startLine: row.start_line || row.line_number,
    endLine: row.end_line || row.line_number,
    side: row.side as DiffSide,
    status: row.status as "open" | "resolved",
    comments: [],
    createdAt: row.created_at,
  };
}

function mapComment(row: CommentRow): Comment {
  return {
    id: row.id,
    threadId: row.thread_id,
    sessionId: row.session_id,
    roundId: row.round_id,
    body: row.body,
    author: row.author as CommentAuthor,
    createdAt: row.created_at,
  };
}

// ============================================================
// Review Sessions
// ============================================================

export function createSession(
  repoPath: string,
  branch: string,
  baseBranch: string = "main",
  aiTool?: string
): ReviewSession {
  const db = getDb(repoPath);
  const id = uuidv4();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO review_sessions (id, repo_path, branch, base_branch, status, ai_tool, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'in_review', ?, ?, ?)`
  ).run(id, repoPath, branch, baseBranch, aiTool ?? null, now, now);

  return {
    id,
    repoPath,
    branch,
    baseBranch,
    status: "in_review",
    aiTool: aiTool ?? null,
    createdAt: now,
    updatedAt: now,
    rounds: [],
    threads: [],
  };
}

export function getSession(id: string, repoPath?: string): ReviewSession | null {
  const db = getDb(repoPath);

  const row = db.prepare("SELECT * FROM review_sessions WHERE id = ?").get(id) as
    | ReviewSessionRow
    | null;

  if (!row) return null;

  const session = mapSession(row) as ReviewSession;

  // Load rounds
  const roundRows = db
    .prepare("SELECT * FROM review_rounds WHERE session_id = ? ORDER BY round_number ASC")
    .all(id) as ReviewRoundRow[];
  session.rounds = roundRows.map(mapRound);

  // Load threads with comments
  const threadRows = db
    .prepare("SELECT * FROM threads WHERE session_id = ? ORDER BY created_at ASC")
    .all(id) as ThreadRow[];

  session.threads = threadRows.map((tr) => {
    const thread = mapThread(tr);
    const commentRows = db
      .prepare("SELECT * FROM comments WHERE thread_id = ? ORDER BY created_at ASC")
      .all(tr.id) as CommentRow[];
    thread.comments = commentRows.map(mapComment);
    return thread;
  });

  return session;
}

export function listSessions(repoPath?: string): ReviewSession[] {
  const db = getDb(repoPath);

  const rows = db
    .prepare("SELECT * FROM review_sessions ORDER BY updated_at DESC")
    .all() as ReviewSessionRow[];

  return rows.map((row) => {
    const session = mapSession(row) as ReviewSession;

    // Attach round count and thread summary (lightweight)
    const roundRows = db
      .prepare("SELECT * FROM review_rounds WHERE session_id = ? ORDER BY round_number ASC")
      .all(row.id) as ReviewRoundRow[];
    session.rounds = roundRows.map(mapRound);

    const threadRows = db
      .prepare("SELECT * FROM threads WHERE session_id = ? ORDER BY created_at ASC")
      .all(row.id) as ThreadRow[];
    session.threads = threadRows.map((tr) => {
      const thread = mapThread(tr);
      const commentRows = db
        .prepare("SELECT * FROM comments WHERE thread_id = ? ORDER BY created_at ASC")
        .all(tr.id) as CommentRow[];
      thread.comments = commentRows.map(mapComment);
      return thread;
    });

    return session;
  });
}

export function updateSessionStatus(
  id: string,
  status: SessionStatus,
  repoPath?: string
): void {
  const db = getDb(repoPath);
  db.prepare(
    "UPDATE review_sessions SET status = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(status, id);
}

export function deleteSession(id: string, repoPath?: string): void {
  const db = getDb(repoPath);
  db.prepare("DELETE FROM review_sessions WHERE id = ?").run(id);
}

// ============================================================
// Review Rounds
// ============================================================

export function createRound(
  sessionId: string,
  commitShaStart: string,
  commitShaEnd: string,
  repoPath?: string
): ReviewRound {
  const db = getDb(repoPath);
  const id = uuidv4();

  // Get next round number
  const last = db
    .prepare(
      "SELECT MAX(round_number) as max_round FROM review_rounds WHERE session_id = ?"
    )
    .get(sessionId) as { max_round: number | null } | null;

  const roundNumber = (last?.max_round ?? 0) + 1;

  db.prepare(
    `INSERT INTO review_rounds (id, session_id, round_number, commit_sha_start, commit_sha_end)
     VALUES (?, ?, ?, ?, ?)`
  ).run(id, sessionId, roundNumber, commitShaStart, commitShaEnd);

  // Touch session updated_at
  db.prepare(
    "UPDATE review_sessions SET updated_at = datetime('now') WHERE id = ?"
  ).run(sessionId);

  return {
    id,
    sessionId,
    roundNumber,
    commitShaStart,
    commitShaEnd,
    createdAt: new Date().toISOString(),
  };
}

// ============================================================
// Threads
// ============================================================

export function createThread(
  sessionId: string,
  filePath: string,
  lineNumber: number,
  side: DiffSide = "right",
  repoPath?: string,
  startLine?: number,
  endLine?: number
): Thread {
  const db = getDb(repoPath);
  const id = uuidv4();
  const start = startLine ?? lineNumber;
  const end = endLine ?? lineNumber;

  db.prepare(
    `INSERT INTO threads (id, session_id, file_path, line_number, start_line, end_line, side)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, sessionId, filePath, lineNumber, start, end, side);

  // Touch session
  db.prepare(
    "UPDATE review_sessions SET updated_at = datetime('now') WHERE id = ?"
  ).run(sessionId);

  return {
    id,
    sessionId,
    filePath,
    lineNumber,
    startLine: start,
    endLine: end,
    side,
    status: "open",
    comments: [],
    createdAt: new Date().toISOString(),
  };
}

export function updateThreadStatus(
  threadId: string,
  status: "open" | "resolved",
  repoPath?: string
): void {
  const db = getDb(repoPath);
  db.prepare("UPDATE threads SET status = ? WHERE id = ?").run(status, threadId);
}

// ============================================================
// Comments
// ============================================================

export function addComment(
  threadId: string,
  sessionId: string,
  body: string,
  author: CommentAuthor = "user",
  roundId?: string,
  repoPath?: string
): Comment {
  const db = getDb(repoPath);
  const id = uuidv4();

  db.prepare(
    `INSERT INTO comments (id, thread_id, session_id, round_id, body, author)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, threadId, sessionId, roundId ?? null, body, author);

  // Touch session
  db.prepare(
    "UPDATE review_sessions SET updated_at = datetime('now') WHERE id = ?"
  ).run(sessionId);

  return {
    id,
    threadId,
    sessionId,
    roundId: roundId ?? null,
    body,
    author,
    createdAt: new Date().toISOString(),
  };
}

export function getComment(commentId: string, repoPath?: string): Comment | null {
  const db = getDb(repoPath);
  const row = db.prepare("SELECT * FROM comments WHERE id = ?").get(commentId) as CommentRow | null;
  return row ? mapComment(row) : null;
}

export function updateComment(
  commentId: string,
  body: string,
  repoPath?: string
): boolean {
  const db = getDb(repoPath);
  const result = db.prepare("UPDATE comments SET body = ? WHERE id = ?").run(body, commentId);
  return result.changes > 0;
}

export function deleteComment(
  commentId: string,
  repoPath?: string
): boolean {
  const db = getDb(repoPath);

  // Get thread_id before deleting so we can check for orphans
  const comment = db.prepare("SELECT thread_id FROM comments WHERE id = ?").get(commentId) as { thread_id: string } | null;
  if (!comment) return false;

  const result = db.prepare("DELETE FROM comments WHERE id = ?").run(commentId);

  // Clean up orphaned thread if no comments remain
  if (result.changes > 0) {
    const remaining = db.prepare("SELECT COUNT(*) as count FROM comments WHERE thread_id = ?").get(comment.thread_id) as { count: number };
    if (remaining.count === 0) {
      db.prepare("DELETE FROM threads WHERE id = ?").run(comment.thread_id);
    }
  }

  return result.changes > 0;
}

// ============================================================
// Config
// ============================================================

export function getConfig(key: string, repoPath?: string): string | null {
  const db = getDb(repoPath);
  const row = db.prepare("SELECT value FROM config WHERE key = ?").get(key) as
    | { value: string }
    | null;
  return row?.value ?? null;
}

export function setConfig(key: string, value: string, repoPath?: string): void {
  const db = getDb(repoPath);
  db.prepare(
    "INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)"
  ).run(key, value);
}
