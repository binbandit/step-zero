"use client";

import { useState, useCallback, useRef, useEffect, Fragment } from "react";
import {
  PlusIcon,
  FilePlusIcon,
  FileMinusIcon,
  FileEditIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  FileWarningIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CommentThread } from "./CommentThread";
import type { DiffFile, DiffHunk, DiffLine, Thread } from "@/types";

// ============================================================
// Types
// ============================================================

type ViewMode = "split" | "unified";

interface LineRange {
  filePath: string;
  startLine: number;
  endLine: number;
  side: "left" | "right";
}

interface DiffViewerProps {
  files: DiffFile[];
  threads: Thread[];
  viewMode: ViewMode;
  onAddComment: (threadId: string, body: string) => void;
  onEditComment: (commentId: string, body: string) => void;
  onDeleteComment: (commentId: string) => void;
  onResolve: (threadId: string, resolved: boolean) => void;
  onCreateThread: (
    filePath: string,
    lineNumber: number,
    body: string,
    side: "left" | "right",
    startLine: number,
    endLine: number
  ) => void;
  fileRefs: React.MutableRefObject<Map<string, HTMLDivElement | null>>;
  viewedFiles?: Set<string>;
  onToggleViewed?: (filePath: string) => void;
}

// ============================================================
// Helpers
// ============================================================

function getStatusIcon(status: DiffFile["status"]) {
  switch (status) {
    case "added":
      return <FilePlusIcon className="size-3.5 text-diff-add-fg" />;
    case "deleted":
      return <FileMinusIcon className="size-3.5 text-diff-del-fg" />;
    default:
      return <FileEditIcon className="size-3.5 text-muted-foreground" />;
  }
}

// ============================================================
// Word-level inline diff
// ============================================================

interface DiffSegment {
  text: string;
  type: "same" | "changed";
}

function tokenize(str: string): string[] {
  return str.match(/\S+|\s+/g) || [];
}

function lcs(a: string[], b: string[]): Array<[number, number]> {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array(n + 1).fill(0)
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  const result: Array<[number, number]> = [];
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      result.push([i - 1, j - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }
  return result.reverse();
}

function computeWordDiff(
  oldContent: string,
  newContent: string
): { oldSegments: DiffSegment[]; newSegments: DiffSegment[] } {
  const oldTokens = tokenize(oldContent);
  const newTokens = tokenize(newContent);
  const matches = lcs(oldTokens, newTokens);

  const oldSegments: DiffSegment[] = [];
  const newSegments: DiffSegment[] = [];
  let oi = 0;
  let ni = 0;

  for (const [matchOi, matchNi] of matches) {
    if (oi < matchOi || ni < matchNi) {
      const oldChanged = oldTokens.slice(oi, matchOi).join("");
      const newChanged = newTokens.slice(ni, matchNi).join("");
      if (oldChanged) oldSegments.push({ text: oldChanged, type: "changed" });
      if (newChanged) newSegments.push({ text: newChanged, type: "changed" });
    }
    oldSegments.push({ text: oldTokens[matchOi], type: "same" });
    newSegments.push({ text: newTokens[matchNi], type: "same" });
    oi = matchOi + 1;
    ni = matchNi + 1;
  }

  if (oi < oldTokens.length) {
    oldSegments.push({ text: oldTokens.slice(oi).join(""), type: "changed" });
  }
  if (ni < newTokens.length) {
    newSegments.push({ text: newTokens.slice(ni).join(""), type: "changed" });
  }

  return { oldSegments, newSegments };
}

function SegmentedContent({
  segments,
  highlightClass,
}: {
  segments: DiffSegment[];
  highlightClass: string;
}) {
  return (
    <>
      {segments.map((seg, i) => (
        <span
          key={`${i}-${seg.type}`}
          className={seg.type === "changed" ? highlightClass : undefined}
        >
          {seg.text}
        </span>
      ))}
    </>
  );
}

const WORD_HIGHLIGHT_DEL = "bg-diff-del-bg/70 rounded-[2px] px-[1px] -mx-[1px]";
const WORD_HIGHLIGHT_ADD = "bg-diff-add-bg/70 rounded-[2px] px-[1px] -mx-[1px]";

// ============================================================
// Line range selection hook (drag-to-select like GitHub)
// ============================================================

function useLineRangeSelection(onSelectionComplete?: (range: LineRange) => void) {
  const [selecting, setSelecting] = useState(false);
  const [selectionRange, setSelectionRange] = useState<LineRange | null>(null);
  const anchorRef = useRef<{ filePath: string; line: number; side: "left" | "right" } | null>(null);
  const selectionRangeRef = useRef<LineRange | null>(null);

  const updateSelectionRange = useCallback((range: LineRange | null) => {
    selectionRangeRef.current = range;
    setSelectionRange(range);
  }, []);

  const handleGutterMouseDown = useCallback(
    (filePath: string, lineNumber: number, side: "left" | "right", e: React.MouseEvent) => {
      e.preventDefault(); // Prevent text selection
      anchorRef.current = { filePath, line: lineNumber, side };
      setSelecting(true);
      updateSelectionRange({
        filePath,
        startLine: lineNumber,
        endLine: lineNumber,
        side,
      });
    },
    [updateSelectionRange]
  );

  const handleGutterMouseEnter = useCallback(
    (filePath: string, lineNumber: number, side: "left" | "right") => {
      if (!selecting || !anchorRef.current) return;
      if (anchorRef.current.filePath !== filePath) return;
      if (anchorRef.current.side !== side) return;

      const anchor = anchorRef.current.line;
      updateSelectionRange({
        filePath,
        startLine: Math.min(anchor, lineNumber),
        endLine: Math.max(anchor, lineNumber),
        side: anchorRef.current.side,
      });
    },
    [selecting, updateSelectionRange]
  );

  const handleMouseUp = useCallback(() => {
    if (!selecting) return;

    setSelecting(false);

    const range = selectionRangeRef.current;
    if (range) {
      onSelectionComplete?.(range);
    }
  }, [onSelectionComplete, selecting]);

  const clearSelection = useCallback(() => {
    setSelecting(false);
    updateSelectionRange(null);
    anchorRef.current = null;
  }, [updateSelectionRange]);

  // Listen for mouseup on document to handle drag ending outside the gutter
  useEffect(() => {
    if (selecting) {
      document.addEventListener("mouseup", handleMouseUp);
      return () => document.removeEventListener("mouseup", handleMouseUp);
    }
  }, [selecting, handleMouseUp]);

  return {
    selecting,
    selectionRange,
    handleGutterMouseDown,
    handleGutterMouseEnter,
    clearSelection,
    setSelectionRange: updateSelectionRange,
  };
}

// ============================================================
// Check if a line number is within a selection range
// ============================================================

function isLineInRange(lineNum: number | null, side: "left" | "right", range: LineRange | null): boolean {
  if (!range || lineNum == null) return false;
  if (range.side !== side) return false;
  return lineNum >= range.startLine && lineNum <= range.endLine;
}

/** Check if a thread covers a given line (endLine match = render after that line) */
function threadCoversLine(
  thread: Thread,
  filePath: string,
  lineNum: number | null,
  side: "left" | "right"
): boolean {
  if (lineNum == null) return false;
  if (thread.filePath !== filePath) return false;
  if (thread.side !== side) return false;
  return thread.endLine === lineNum;
}

// ============================================================
// DiffViewer
// ============================================================

export function DiffViewer({
  files,
  threads,
  viewMode,
  onAddComment,
  onEditComment,
  onDeleteComment,
  onResolve,
  onCreateThread,
  fileRefs,
  viewedFiles,
  onToggleViewed,
}: DiffViewerProps) {
  const [collapsedFiles, setCollapsedFiles] = useState<Set<string>>(new Set());
  // Track whether the comment form is open (separate from selection)
  const [commentingRange, setCommentingRange] = useState<LineRange | null>(null);
  const {
    selecting,
    selectionRange,
    handleGutterMouseDown,
    handleGutterMouseEnter,
    clearSelection,
    setSelectionRange,
  } = useLineRangeSelection(setCommentingRange);

  function toggleFile(filePath: string) {
    setCollapsedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(filePath)) next.delete(filePath);
      else next.add(filePath);
      return next;
    });
  }

  function handleCancelComment() {
    setCommentingRange(null);
    clearSelection();
  }

  function handleSubmitNewComment(body: string) {
    if (!commentingRange) return;
    onCreateThread(
      commentingRange.filePath,
      commentingRange.endLine, // lineNumber = endLine (where thread renders)
      body,
      commentingRange.side,
      commentingRange.startLine,
      commentingRange.endLine
    );
    setCommentingRange(null);
    clearSelection();
  }

  // Single-click on gutter: select one line and immediately open comment form
  function handleGutterClick(filePath: string, lineNumber: number, side: "left" | "right") {
    const range: LineRange = { filePath, startLine: lineNumber, endLine: lineNumber, side };
    setSelectionRange(range);
    setCommentingRange(range);
  }

  // Determine the active selection range (either dragging or committed for commenting)
  const activeRange = commentingRange || (selecting ? selectionRange : null);

  return (
    <div className={cn("flex flex-col", selecting && "select-none")}>
      {files.map((file) => {
        const filePath = file.newPath || file.oldPath;
        const isCollapsed = collapsedFiles.has(filePath);

        return (
          <div
            key={filePath}
            ref={(el) => {
              fileRefs.current.set(filePath, el);
            }}
            className="border-b border-border/30 last:border-b-0"
          >
            {/* File header */}
            <div className="sticky top-0 z-20 flex items-center gap-2 w-full px-4 py-2.5 bg-muted/40 backdrop-blur-sm border-b border-border/30 hover:bg-muted/60 transition-colors">
              <button
                type="button"
                className="flex items-center gap-2 flex-1 min-w-0 text-left"
                onClick={() => toggleFile(filePath)}
              >
                {isCollapsed ? (
                  <ChevronRightIcon className="size-3.5 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronDownIcon className="size-3.5 text-muted-foreground shrink-0" />
                )}
                {getStatusIcon(file.status)}
                <span className="font-mono text-xs font-medium truncate">
                  {filePath}
                </span>

                {file.status === "renamed" && file.oldPath !== file.newPath && (
                  <span className="text-[10px] text-muted-foreground/60 font-mono truncate">
                    (from {file.oldPath})
                  </span>
                )}

                <span className="flex-1" />

                <span className="flex items-center gap-2 text-[11px] shrink-0">
                  {file.additions > 0 && (
                    <span className="text-diff-add-fg font-mono">
                      +{file.additions}
                    </span>
                  )}
                  {file.deletions > 0 && (
                    <span className="text-diff-del-fg font-mono">
                      -{file.deletions}
                    </span>
                  )}
                </span>
              </button>

              {onToggleViewed && (
                <label className="flex items-center gap-1.5 shrink-0 text-[11px] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={viewedFiles?.has(filePath) ?? false}
                    onChange={() => onToggleViewed(filePath)}
                    className="size-3.5 rounded border-border accent-emerald-500"
                  />
                  <span className={cn(
                    "transition-colors",
                    viewedFiles?.has(filePath) ? "text-emerald-400" : "text-muted-foreground/50"
                  )}>
                    Viewed
                  </span>
                </label>
              )}
            </div>

            {/* File content */}
            {!isCollapsed && file.isBinary && (
              <div className="flex items-center gap-3 px-6 py-8 text-center justify-center">
                <FileWarningIcon className="size-5 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground/60">
                  Binary file — cannot display diff
                </p>
              </div>
            )}
            {!isCollapsed && !file.isBinary && (
              <div className="overflow-x-auto">
                {viewMode === "unified" ? (
                  <UnifiedDiffView
                    file={file}
                    filePath={filePath}
                    threads={threads}
                    activeRange={activeRange}
                    selecting={selecting}
                    commentingRange={commentingRange}
                    onGutterMouseDown={handleGutterMouseDown}
                    onGutterMouseEnter={handleGutterMouseEnter}
                    onGutterClick={handleGutterClick}
                    onCancelComment={handleCancelComment}
                    onSubmitNewComment={handleSubmitNewComment}
                    onAddComment={onAddComment}
                    onEditComment={onEditComment}
                    onDeleteComment={onDeleteComment}
                    onResolve={onResolve}
                  />
                ) : (
                  <SplitDiffView
                    file={file}
                    filePath={filePath}
                    threads={threads}
                    activeRange={activeRange}
                    selecting={selecting}
                    commentingRange={commentingRange}
                    onGutterMouseDown={handleGutterMouseDown}
                    onGutterMouseEnter={handleGutterMouseEnter}
                    onGutterClick={handleGutterClick}
                    onCancelComment={handleCancelComment}
                    onSubmitNewComment={handleSubmitNewComment}
                    onAddComment={onAddComment}
                    onEditComment={onEditComment}
                    onDeleteComment={onDeleteComment}
                    onResolve={onResolve}
                  />
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// Gutter Cell — the clickable/draggable line number
// ============================================================

function GutterCell({
  lineNum,
  filePath,
  side,
  isInRange,
  selecting,
  onMouseDown,
  onMouseEnter,
  onClick,
  className,
}: {
  lineNum: number | null;
  filePath: string;
  side: "left" | "right";
  isInRange: boolean;
  selecting: boolean;
  onMouseDown: (filePath: string, lineNum: number, side: "left" | "right", e: React.MouseEvent) => void;
  onMouseEnter: (filePath: string, lineNum: number, side: "left" | "right") => void;
  onClick: (filePath: string, lineNum: number, side: "left" | "right") => void;
  className?: string;
}) {
  if (lineNum == null) {
    return (
      <td className={cn(
        "w-[1px] whitespace-nowrap text-right px-2 text-[11px] select-none align-top leading-[20px] border-r border-border/10",
        className
      )}>
        {""}
      </td>
    );
  }

  return (
    <td
      className={cn(
        "w-[1px] whitespace-nowrap text-right px-2 text-[11px] select-none align-top leading-[20px] border-r border-border/10 relative group/gutter cursor-pointer",
        isInRange ? "bg-primary/20 text-primary" : "text-diff-gutter",
        className
      )}
      onMouseDown={(e) => onMouseDown(filePath, lineNum, side, e)}
      onMouseEnter={() => {
        if (selecting) onMouseEnter(filePath, lineNum, side);
      }}
    >
      {/* Line number — hidden when + button shows */}
      <span className={cn(!selecting && "group-hover/gutter:invisible")}>{lineNum}</span>
      {/* Blue + button — appears on hover */}
      <button
        type="button"
        className={cn(
          "absolute inset-0 flex items-center justify-center transition-opacity",
          selecting
            ? "pointer-events-none opacity-0"
            : "opacity-0 group-hover/gutter:opacity-100"
        )}
        onClick={(e) => {
          e.stopPropagation();
          onClick(filePath, lineNum, side);
        }}
        aria-label={`Add comment on line ${lineNum}`}
      >
        <div className="size-[16px] rounded bg-blue-500 text-white flex items-center justify-center shadow-sm">
          <PlusIcon className="size-3" />
        </div>
      </button>
    </td>
  );
}

// ============================================================
// Unified Diff View
// ============================================================

interface DiffViewProps {
  file: DiffFile;
  filePath: string;
  threads: Thread[];
  activeRange: LineRange | null;
  selecting: boolean;
  commentingRange: LineRange | null;
  onGutterMouseDown: (filePath: string, lineNum: number, side: "left" | "right", e: React.MouseEvent) => void;
  onGutterMouseEnter: (filePath: string, lineNum: number, side: "left" | "right") => void;
  onGutterClick: (filePath: string, lineNum: number, side: "left" | "right") => void;
  onCancelComment: () => void;
  onSubmitNewComment: (body: string) => void;
  onAddComment: (threadId: string, body: string) => void;
  onEditComment: (commentId: string, body: string) => void;
  onDeleteComment: (commentId: string) => void;
  onResolve: (threadId: string, resolved: boolean) => void;
}

function UnifiedDiffView({
  file,
  filePath,
  threads,
  activeRange,
  selecting,
  commentingRange,
  onGutterMouseDown,
  onGutterMouseEnter,
  onGutterClick,
  onCancelComment,
  onSubmitNewComment,
  onAddComment,
  onEditComment,
  onDeleteComment,
  onResolve,
}: DiffViewProps) {
  return (
    <table
      className="w-full text-[13px] font-mono leading-[20px] border-collapse"
      aria-label={`Unified diff for ${filePath}`}
    >
      <tbody>
        {file.hunks.map((hunk) => (
          <Fragment key={hunk.header}>
            <tr className="bg-diff-hunk-bg">
              <td
                colSpan={3}
                className="px-4 py-1.5 text-xs text-muted-foreground/70 font-mono select-none"
              >
                {hunk.header}
              </td>
            </tr>

            {hunk.lines.map((line) => {
              const lineNum = line.newLineNumber ?? line.oldLineNumber ?? 0;
              const side: "left" | "right" = line.type === "delete" ? "left" : "right";
              const lineThreads = threads.filter(
                (t) =>
                  t.filePath === filePath &&
                  t.endLine === lineNum &&
                  (line.type === "context" || t.side === side)
              );
              const isInRange =
                activeRange?.filePath === filePath &&
                lineNum >= activeRange.startLine &&
                lineNum <= activeRange.endLine &&
                (line.type === "context" || activeRange.side === side);
              const isCommentTarget =
                commentingRange?.filePath === filePath &&
                commentingRange?.endLine === lineNum &&
                (line.type === "context" || commentingRange.side === side);

              const lineKey = `${line.type}-${line.oldLineNumber ?? "x"}-${line.newLineNumber ?? "x"}`;
              return (
                <Fragment key={lineKey}>
                  <tr
                    className={cn(
                      "group/line transition-colors duration-75",
                      line.type === "add" && "bg-diff-add-line",
                      line.type === "delete" && "bg-diff-del-line",
                      isInRange && "!bg-primary/10"
                    )}
                    onMouseEnter={() => {
                      if (selecting) onGutterMouseEnter(filePath, lineNum, side);
                    }}
                  >
                    {/* Old line number */}
                    <td className="w-[1px] whitespace-nowrap text-right px-2 text-diff-gutter text-[11px] select-none align-top leading-[20px] border-r border-border/10">
                      {line.oldLineNumber ?? ""}
                    </td>
                    {/* New line number — draggable gutter */}
                    <GutterCell
                      lineNum={line.newLineNumber ?? line.oldLineNumber}
                      filePath={filePath}
                      side={side}
                      isInRange={isInRange}
                      selecting={selecting}
                      onMouseDown={onGutterMouseDown}
                      onMouseEnter={onGutterMouseEnter}
                      onClick={onGutterClick}
                    />
                    {/* Content */}
                    <td className="pl-4 pr-4 whitespace-pre">
                      <span
                        className={cn(
                          line.type === "add" && "text-diff-add-fg",
                          line.type === "delete" && "text-diff-del-fg"
                        )}
                      >
                        {line.type === "add"
                          ? "+"
                          : line.type === "delete"
                            ? "-"
                            : " "}
                        {line.content}
                      </span>
                    </td>
                  </tr>

                  {/* Existing threads */}
                  {lineThreads.map((thread) => (
                    <tr key={thread.id}>
                      <td colSpan={3} className="p-0">
                        <CommentThread
                          thread={thread}
                          onAddComment={onAddComment}
                          onEditComment={onEditComment}
                          onDeleteComment={onDeleteComment}
                          onResolve={onResolve}
                        />
                      </td>
                    </tr>
                  ))}

                  {/* New comment form */}
                  {isCommentTarget && (
                    <tr>
                      <td colSpan={3} className="p-0">
                        <CommentThread
                          thread={{
                            id: "new",
                            sessionId: "",
                            filePath,
                            lineNumber: commentingRange!.endLine,
                            startLine: commentingRange!.startLine,
                            endLine: commentingRange!.endLine,
                            side: commentingRange!.side,
                            status: "open",
                            comments: [],
                            createdAt: new Date().toISOString(),
                          }}
                          isNew
                          onCancelNew={onCancelComment}
                          onSubmitNew={onSubmitNewComment}
                          onAddComment={onAddComment}
                          onResolve={onResolve}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </Fragment>
        ))}
      </tbody>
    </table>
  );
}

// ============================================================
// Split Diff View
// ============================================================

interface SplitLine {
  left: DiffLine | null;
  right: DiffLine | null;
}

function buildSplitLines(hunk: DiffHunk): SplitLine[] {
  const result: SplitLine[] = [];
  const lines = hunk.lines;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.type === "context") {
      result.push({ left: line, right: line });
      i++;
    } else if (line.type === "delete") {
      const deletes: DiffLine[] = [];
      while (i < lines.length && lines[i].type === "delete") {
        deletes.push(lines[i]);
        i++;
      }
      const adds: DiffLine[] = [];
      while (i < lines.length && lines[i].type === "add") {
        adds.push(lines[i]);
        i++;
      }
      const maxLen = Math.max(deletes.length, adds.length);
      for (let j = 0; j < maxLen; j++) {
        result.push({
          left: j < deletes.length ? deletes[j] : null,
          right: j < adds.length ? adds[j] : null,
        });
      }
    } else if (line.type === "add") {
      result.push({ left: null, right: line });
      i++;
    } else {
      i++;
    }
  }

  return result;
}

function SplitDiffView({
  file,
  filePath,
  threads,
  activeRange,
  selecting,
  commentingRange,
  onGutterMouseDown,
  onGutterMouseEnter,
  onGutterClick,
  onCancelComment,
  onSubmitNewComment,
  onAddComment,
  onEditComment,
  onDeleteComment,
  onResolve,
}: DiffViewProps) {
  return (
    <table
      className="w-full text-[13px] font-mono leading-[20px] border-collapse table-fixed"
      aria-label={`Split diff for ${filePath}`}
    >
      <colgroup>
        <col className="w-[50px]" />
        <col />
        <col className="w-[50px]" />
        <col />
      </colgroup>
      <tbody>
        {file.hunks.map((hunk) => {
          const splitLines = buildSplitLines(hunk);

          return (
            <Fragment key={hunk.header}>
              <tr className="bg-diff-hunk-bg">
                <td
                  colSpan={4}
                  className="px-4 py-1.5 text-xs text-muted-foreground/70 font-mono select-none"
                >
                  {hunk.header}
                </td>
              </tr>

              {splitLines.map((pair) => {
                const leftNum = pair.left?.oldLineNumber ?? null;
                const rightNum = pair.right?.newLineNumber ?? null;

                // Threads render after endLine
                const lineThreads = threads.filter(
                  (t) =>
                    threadCoversLine(t, filePath, leftNum, "left") ||
                    threadCoversLine(t, filePath, rightNum, "right")
                );
                const isCommentTarget =
                  (commentingRange?.filePath === filePath &&
                    commentingRange?.side === "left" &&
                    commentingRange?.endLine === leftNum) ||
                  (commentingRange?.filePath === filePath &&
                    commentingRange?.side === "right" &&
                    commentingRange?.endLine === rightNum);
                const pairKey = `${pair.left?.type ?? "e"}-${leftNum ?? "x"}-${rightNum ?? "x"}`;

                // Line range highlighting
                const leftInRange =
                  activeRange?.filePath === filePath &&
                  isLineInRange(leftNum, "left", activeRange);
                const rightInRange =
                  activeRange?.filePath === filePath &&
                  isLineInRange(rightNum, "right", activeRange);

                // Word diff
                const isPairedChange =
                  pair.left?.type === "delete" && pair.right?.type === "add";
                const wordDiff =
                  isPairedChange && pair.left && pair.right
                    ? computeWordDiff(pair.left.content, pair.right.content)
                    : null;

                return (
                  <Fragment key={pairKey}>
                    <tr className="group/line transition-colors duration-75">
                      {/* Left gutter */}
                      <GutterCell
                        lineNum={leftNum}
                        filePath={filePath}
                        side="left"
                        isInRange={leftInRange}
                        selecting={selecting}
                        onMouseDown={onGutterMouseDown}
                        onMouseEnter={onGutterMouseEnter}
                        onClick={onGutterClick}
                        className={cn(
                          pair.left?.type === "delete" && "bg-diff-del-line"
                        )}
                      />
                      {/* Left content */}
                      <td
                        className={cn(
                          "pl-4 pr-2 whitespace-pre overflow-hidden border-r border-border/20",
                          pair.left?.type === "delete" && "bg-diff-del-line",
                          !pair.left && "bg-muted/10",
                          leftInRange && "!bg-primary/10"
                        )}
                        onMouseEnter={() => {
                          if (selecting && leftNum != null) {
                            onGutterMouseEnter(filePath, leftNum, "left");
                          }
                        }}
                      >
                        {pair.left && (
                          <span
                            className={cn(
                              pair.left.type === "delete" && "text-diff-del-fg"
                            )}
                          >
                            {pair.left.type === "delete" ? "-" : " "}
                            {wordDiff ? (
                              <SegmentedContent
                                segments={wordDiff.oldSegments}
                                highlightClass={WORD_HIGHLIGHT_DEL}
                              />
                            ) : (
                              pair.left.content
                            )}
                          </span>
                        )}
                      </td>

                      {/* Right gutter */}
                      <GutterCell
                        lineNum={rightNum}
                        filePath={filePath}
                        side="right"
                        isInRange={rightInRange}
                        selecting={selecting}
                        onMouseDown={onGutterMouseDown}
                        onMouseEnter={onGutterMouseEnter}
                        onClick={onGutterClick}
                        className={cn(
                          pair.right?.type === "add" && "bg-diff-add-line"
                        )}
                      />
                      {/* Right content */}
                      <td
                        className={cn(
                          "pl-4 pr-4 whitespace-pre overflow-hidden",
                          pair.right?.type === "add" && "bg-diff-add-line",
                          !pair.right && "bg-muted/10",
                          rightInRange && "!bg-primary/10"
                        )}
                        onMouseEnter={() => {
                          if (selecting && rightNum != null) {
                            onGutterMouseEnter(filePath, rightNum, "right");
                          }
                        }}
                      >
                        {pair.right && (
                          <span
                            className={cn(
                              pair.right.type === "add" && "text-diff-add-fg"
                            )}
                          >
                            {pair.right.type === "add" ? "+" : " "}
                            {wordDiff ? (
                              <SegmentedContent
                                segments={wordDiff.newSegments}
                                highlightClass={WORD_HIGHLIGHT_ADD}
                              />
                            ) : (
                              pair.right.content
                            )}
                          </span>
                        )}
                      </td>
                    </tr>

                    {/* Existing threads */}
                    {lineThreads.map((thread) => (
                      <tr key={thread.id}>
                        <td colSpan={4} className="p-0">
                          <CommentThread
                            thread={thread}
                            onAddComment={onAddComment}
                            onEditComment={onEditComment}
                            onDeleteComment={onDeleteComment}
                            onResolve={onResolve}
                          />
                        </td>
                      </tr>
                    ))}

                    {/* New comment form */}
                    {isCommentTarget && (
                      <tr>
                        <td colSpan={4} className="p-0">
                          <CommentThread
                            thread={{
                              id: "new",
                              sessionId: "",
                              filePath,
                              lineNumber: commentingRange!.endLine,
                              startLine: commentingRange!.startLine,
                              endLine: commentingRange!.endLine,
                              side: commentingRange!.side,
                              status: "open",
                              comments: [],
                              createdAt: new Date().toISOString(),
                            }}
                            isNew
                            onCancelNew={onCancelComment}
                            onSubmitNew={onSubmitNewComment}
                            onAddComment={onAddComment}
                            onResolve={onResolve}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}
