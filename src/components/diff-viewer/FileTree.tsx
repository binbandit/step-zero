"use client";

import { useState, useMemo } from "react";
import {
  FilePlusIcon,
  FileMinusIcon,
  FileEditIcon,
  ArrowRightLeftIcon,
  ChevronRightIcon,
  FolderIcon,
  FolderOpenIcon,
  SearchIcon,
  XIcon,
  ChevronsUpDownIcon,
  FileIcon,
  MessageSquareIcon,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { DiffFile } from "@/types";

interface FileTreeProps {
  files: DiffFile[];
  activeFile: string | null;
  onFileSelect: (path: string) => void;
  threads?: Map<string, number>;
  viewedFiles?: Set<string>;
  onToggleViewed?: (filePath: string) => void;
}

// ============================================================
// Helpers
// ============================================================

function getFileIcon(status: DiffFile["status"]) {
  const icons = {
    added: <FilePlusIcon className="size-3.5 text-diff-add-fg shrink-0" />,
    deleted: <FileMinusIcon className="size-3.5 text-diff-del-fg shrink-0" />,
    renamed: <ArrowRightLeftIcon className="size-3.5 text-primary shrink-0" />,
    modified: <FileEditIcon className="size-3.5 text-muted-foreground shrink-0" />,
  };
  return icons[status] || icons.modified;
}

function getFileName(filePath: string): string {
  return filePath.split("/").pop() || filePath;
}

function getDirPath(filePath: string): string {
  const parts = filePath.split("/");
  if (parts.length <= 1) return "";
  return parts.slice(0, -1).join("/");
}

/**
 * Group files by directory, collapsing single-child directory chains.
 * e.g. if all files under "src/components/ui" have no sibling dirs,
 * the group key becomes "src/components/ui" instead of nesting.
 */
function groupByDirectory(files: DiffFile[]): Map<string, DiffFile[]> {
  const groups = new Map<string, DiffFile[]>();
  for (const file of files) {
    const dir = getDirPath(file.newPath || file.oldPath);
    const key = dir || ".";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(file);
  }
  // Sort files alphabetically within each directory
  for (const [, dirFiles] of groups) {
    dirFiles.sort((a, b) => {
      const aName = getFileName(a.newPath || a.oldPath).toLowerCase();
      const bName = getFileName(b.newPath || b.oldPath).toLowerCase();
      return aName.localeCompare(bName);
    });
  }
  return groups;
}

/** Check if a file path matches a filter term (filename-first, then full path). */
function matchesFilter(filePath: string, term: string): boolean {
  const lower = filePath.toLowerCase();
  const fileName = getFileName(filePath).toLowerCase();
  // Prioritize filename match, but also allow path match
  return fileName.includes(term) || lower.includes(term);
}

// ============================================================
// FileTree Component
// ============================================================

export function FileTree({
  files,
  activeFile,
  onFileSelect,
  threads,
  viewedFiles,
  onToggleViewed,
}: FileTreeProps) {
  const [collapsedDirs, setCollapsedDirs] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");

  // Filter files by search term
  const filteredFiles = useMemo(() => {
    if (!filter.trim()) return files;
    const term = filter.toLowerCase().trim();
    return files.filter((f) => matchesFilter(f.newPath || f.oldPath, term));
  }, [files, filter]);

  const grouped = useMemo(() => groupByDirectory(filteredFiles), [filteredFiles]);
  const dirs = useMemo(() => Array.from(grouped.keys()).sort(), [grouped]);

  // Stats
  const viewedCount = viewedFiles?.size ?? 0;
  const totalCount = files.length;
  const progressPct = totalCount > 0 ? Math.round((viewedCount / totalCount) * 100) : 0;

  function toggleDir(dir: string) {
    setCollapsedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(dir)) next.delete(dir);
      else next.add(dir);
      return next;
    });
  }

  function toggleAllDirs() {
    if (collapsedDirs.size > 0) {
      // Some are collapsed — expand all
      setCollapsedDirs(new Set());
    } else {
      // All expanded — collapse all
      setCollapsedDirs(new Set(dirs.filter((d) => d !== ".")));
    }
  }

  // Empty state
  if (files.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center px-4 text-center">
        <FileIcon className="size-8 text-muted-foreground/20 mb-3" />
        <p className="text-xs text-muted-foreground/50 leading-relaxed">
          No changed files in this diff.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header section — fixed, doesn't scroll */}
      <div className="px-3 pt-3 pb-1 shrink-0 space-y-2">
        {/* Title row with expand/collapse control */}
        <div className="flex items-center justify-between">
          <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 px-1">
            Files
            <span className="ml-1.5 text-muted-foreground/30 font-mono normal-case tracking-normal">
              {filteredFiles.length !== files.length
                ? `${filteredFiles.length}/${files.length}`
                : files.length}
            </span>
          </h3>
          <button
            type="button"
            onClick={toggleAllDirs}
            className="size-5 rounded flex items-center justify-center text-muted-foreground/40 hover:text-muted-foreground hover:bg-accent transition-colors"
            title={collapsedDirs.size > 0 ? "Expand all" : "Collapse all"}
          >
            <ChevronsUpDownIcon className="size-3" />
          </button>
        </div>

        {/* Review progress */}
        {onToggleViewed && totalCount > 0 && (
          <div className="px-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-muted-foreground/50">Reviewed</span>
              <span className="text-[10px] font-mono text-muted-foreground/60">
                {viewedCount}/{totalCount}
              </span>
            </div>
            <div className="h-1 rounded-full bg-border/40 overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-300",
                  progressPct === 100
                    ? "bg-emerald-500"
                    : progressPct > 0
                      ? "bg-primary"
                      : "bg-transparent",
                )}
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}

        {/* Filter input */}
        <div className="relative">
          <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-muted-foreground/30 pointer-events-none" />
          <input
            type="text"
            placeholder="Filter files..."
            aria-label="Filter changed files"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full h-7 pl-7 pr-7 text-[11px] font-mono rounded-md border border-border/30 bg-background/50 text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40 transition-colors"
          />
          {filter && (
            <button
              type="button"
              onClick={() => setFilter("")}
              aria-label="Clear filter"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 size-4 flex items-center justify-center rounded-sm text-muted-foreground/40 hover:text-muted-foreground transition-colors"
            >
              <XIcon className="size-3" />
            </button>
          )}
        </div>
      </div>

      {/* Filtered empty state */}
      {filteredFiles.length === 0 && filter.trim() && (
        <div className="flex-1 flex items-center justify-center px-4">
          <p className="text-[11px] text-muted-foreground/40 text-center">
            No files match &ldquo;{filter}&rdquo;
          </p>
        </div>
      )}

      {/* File list — scrollable */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="px-2 pb-3 pt-1">
          {dirs.map((dir) => {
            const dirFiles = grouped.get(dir)!;
            const isCollapsed = collapsedDirs.has(dir);
            const isRootDir = dir === ".";

            // Dir-level stats
            const dirAdditions = dirFiles.reduce((s, f) => s + f.additions, 0);
            const dirDeletions = dirFiles.reduce((s, f) => s + f.deletions, 0);

            return (
              <div key={dir} className={cn(!isRootDir && "mt-1")}>
                {/* Directory header */}
                {!isRootDir && (
                  <button
                    type="button"
                    className="flex items-center gap-1.5 w-full px-2 py-1.5 text-[11px] text-muted-foreground/60 hover:text-muted-foreground hover:bg-accent/30 transition-colors rounded-md group/dir"
                    onClick={() => toggleDir(dir)}
                  >
                    <ChevronRightIcon
                      className={cn(
                        "size-3 shrink-0 transition-transform duration-150 text-muted-foreground/40",
                        !isCollapsed && "rotate-90",
                      )}
                    />
                    {isCollapsed ? (
                      <FolderIcon className="size-3 shrink-0 text-muted-foreground/40" />
                    ) : (
                      <FolderOpenIcon className="size-3 shrink-0 text-primary/50" />
                    )}
                    <span className="font-mono truncate text-left flex-1">{dir}/</span>
                    <span className="flex items-center gap-1.5 text-[9px] shrink-0 opacity-0 group-hover/dir:opacity-100 transition-opacity">
                      {dirAdditions > 0 && (
                        <span className="text-diff-add-fg/60 font-mono">+{dirAdditions}</span>
                      )}
                      {dirDeletions > 0 && (
                        <span className="text-diff-del-fg/60 font-mono">-{dirDeletions}</span>
                      )}
                    </span>
                    <span className="text-[9px] text-muted-foreground/30 font-mono shrink-0 ml-0.5">
                      {dirFiles.length}
                    </span>
                  </button>
                )}

                {/* Files in this directory */}
                {!isCollapsed && (
                  <div className={cn(!isRootDir && "ml-3 border-l border-border/20")}>
                    {dirFiles.map((file) => {
                      const filePath = file.newPath || file.oldPath;
                      const isActive = activeFile === filePath;
                      const threadCount = threads?.get(filePath) || 0;
                      const isViewed = viewedFiles?.has(filePath) ?? false;

                      return (
                        <div
                          key={filePath}
                          className={cn(
                            "flex items-center w-full rounded-md transition-all duration-100 group/file",
                            isActive
                              ? "bg-primary/12 text-foreground"
                              : "text-muted-foreground/80 hover:bg-accent/40 hover:text-foreground",
                          )}
                        >
                          {/* Viewed toggle */}
                          {onToggleViewed && (
                            <button
                              type="button"
                              className="shrink-0 flex items-center justify-center w-6 h-8 ml-0.5"
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleViewed(filePath);
                              }}
                              aria-label={isViewed ? "Mark as unviewed" : "Mark as viewed"}
                            >
                              <div
                                className={cn(
                                  "size-3 rounded-[3px] border transition-colors",
                                  isViewed
                                    ? "bg-emerald-500 border-emerald-500"
                                    : "border-muted-foreground/25 hover:border-muted-foreground/50",
                                )}
                              >
                                {isViewed && (
                                  <svg
                                    viewBox="0 0 12 12"
                                    className="size-3 text-white"
                                    aria-hidden="true"
                                  >
                                    <path
                                      d="M3 6l2 2 4-4"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="1.5"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    />
                                  </svg>
                                )}
                              </div>
                            </button>
                          )}

                          {/* File button */}
                          <button
                            type="button"
                            className="flex items-center gap-2 flex-1 min-w-0 pl-1 pr-2 py-1.5"
                            onClick={() => onFileSelect(filePath)}
                          >
                            {getFileIcon(file.status)}
                            <span
                              className={cn(
                                "text-[12px] font-mono truncate flex-1 text-left",
                                isViewed &&
                                  !isActive &&
                                  "text-muted-foreground/40 line-through decoration-muted-foreground/20",
                              )}
                            >
                              {getFileName(filePath)}
                            </span>

                            {/* Thread count */}
                            {threadCount > 0 && (
                              <span className="flex items-center gap-0.5 shrink-0">
                                <MessageSquareIcon className="size-2.5 text-primary/60" />
                                <span className="text-[9px] font-mono text-primary/70 font-medium">
                                  {threadCount}
                                </span>
                              </span>
                            )}

                            {/* Stats */}
                            <span className="flex items-center gap-1 text-[10px] shrink-0 opacity-60">
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
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
