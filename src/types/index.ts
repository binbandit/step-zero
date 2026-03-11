// ============================================================
// Step Zero: Core Types
// ============================================================

export type SessionStatus = "in_review" | "changes_requested" | "approved";
export type CommentAuthor = "user" | "ai";
export type ThreadStatus = "open" | "resolved";
export type DiffSide = "left" | "right";

// --- Database Row Types ---

export interface ReviewSessionRow {
  id: string;
  repo_path: string;
  branch: string;
  base_branch: string;
  status: SessionStatus;
  ai_tool: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReviewRoundRow {
  id: string;
  session_id: string;
  round_number: number;
  commit_sha_start: string;
  commit_sha_end: string;
  created_at: string;
}

export interface ThreadRow {
  id: string;
  session_id: string;
  file_path: string;
  line_number: number;
  start_line: number;
  end_line: number;
  side: DiffSide;
  status: ThreadStatus;
  created_at: string;
}

export interface CommentRow {
  id: string;
  thread_id: string;
  session_id: string;
  round_id: string | null;
  body: string;
  author: CommentAuthor;
  created_at: string;
}

// --- API / Frontend Types ---

export interface ReviewSession {
  id: string;
  repoPath: string;
  branch: string;
  baseBranch: string;
  status: SessionStatus;
  aiTool: string | null;
  createdAt: string;
  updatedAt: string;
  rounds: ReviewRound[];
  threads: Thread[];
  stats?: DiffStats;
}

export interface ReviewRound {
  id: string;
  sessionId: string;
  roundNumber: number;
  commitShaStart: string;
  commitShaEnd: string;
  createdAt: string;
}

export interface Thread {
  id: string;
  sessionId: string;
  filePath: string;
  lineNumber: number;
  startLine: number;
  endLine: number;
  side: DiffSide;
  status: ThreadStatus;
  comments: Comment[];
  createdAt: string;
}

export interface Comment {
  id: string;
  threadId: string;
  sessionId: string;
  roundId: string | null;
  body: string;
  author: CommentAuthor;
  createdAt: string;
}

// --- Diff Types ---

export interface DiffFile {
  oldPath: string;
  newPath: string;
  status: "added" | "deleted" | "modified" | "renamed";
  hunks: DiffHunk[];
  additions: number;
  deletions: number;
  isBinary?: boolean;
}

export interface DiffHunk {
  header: string;
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: DiffLine[];
}

export interface DiffLine {
  type: "add" | "delete" | "context";
  content: string;
  oldLineNumber: number | null;
  newLineNumber: number | null;
}

export interface DiffStats {
  filesChanged: number;
  additions: number;
  deletions: number;
}

export interface ParsedDiff {
  files: DiffFile[];
  stats: DiffStats;
}

// --- Config Types ---

export interface StepZeroConfig {
  aiTool: "claude" | "codex" | "custom";
  customCommand?: string;
  defaultBaseBranch: string;
  autoOpen: boolean;
}

export const DEFAULT_CONFIG: StepZeroConfig = {
  aiTool: "claude",
  defaultBaseBranch: "main",
  autoOpen: true,
};

// --- AI Dispatcher Types ---

export interface DispatchResult {
  success: boolean;
  output: string;
  newCommitSha?: string;
}

export interface ReviewFeedback {
  threads: {
    filePath: string;
    lineNumber: number;
    startLine: number;
    endLine: number;
    comments: { body: string; author: CommentAuthor }[];
    codeContext: string;
  }[];
}
