"use client";

import { useEffect, useState, useCallback, useRef, use } from "react";
import { useRouter } from "next/navigation";
import { AlertCircleIcon, FileIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ReviewHeader } from "@/components/review/ReviewHeader";
import { ReviewActions } from "@/components/review/ReviewActions";
import { FileTree } from "@/components/diff-viewer/FileTree";
import { DiffViewer } from "@/components/diff-viewer/DiffViewer";
import type {
  ReviewSession,
  ParsedDiff,
  DiffStats,
} from "@/types";

export default function ReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const fileRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());

  // State
  const [session, setSession] = useState<ReviewSession | null>(null);
  const [diff, setDiff] = useState<ParsedDiff | null>(null);
  const [stats, setStats] = useState<DiffStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"split" | "unified">("split");
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [isDispatching, setIsDispatching] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [viewedFiles, setViewedFiles] = useState<Set<string>>(new Set());
  const activeFileRef = useRef<string | null>(null);

  // Keep ref in sync
  activeFileRef.current = activeFile;

  // Fetch session and diff data — no dependency on activeFile to avoid re-fetch loops
  const fetchData = useCallback(async () => {
    try {
      const [sessionRes, diffRes] = await Promise.all([
        fetch(`/api/reviews/${id}`),
        fetch(`/api/reviews/${id}/diff`),
      ]);

      if (!sessionRes.ok) {
        setError("Session not found");
        return;
      }

      const sessionData = await sessionRes.json();
      setSession(sessionData);

      if (diffRes.ok) {
        const diffData = await diffRes.json();
        setDiff(diffData);
        setStats(diffData.stats);

        // Auto-select first file only if none is currently selected
        if (!activeFileRef.current && diffData.files.length > 0) {
          setActiveFile(diffData.files[0].newPath || diffData.files[0].oldPath);
        }
      } else {
        toast.error("Failed to load diff data");
      }
    } catch {
      setError("Failed to load review data");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Dynamic page title — show branch name when session is loaded
  useEffect(() => {
    if (session) {
      document.title = `${session.branch} — Step Zero Review`;
    }
    return () => {
      document.title = "Step Zero — AI Code Review";
    };
  }, [session]);

  // File selection — scroll to file in diff view with offset for sticky header
  const handleFileSelect = useCallback((path: string) => {
    setActiveFile(path);
    const el = fileRefs.current.get(path);
    if (el) {
      // Account for sticky header (56px) — use scrollIntoView then adjust
      const container = el.closest("[data-diff-scroll]");
      if (container) {
        const elRect = el.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const offset = elRect.top - containerRect.top + container.scrollTop - 4;
        container.scrollTo({ top: offset, behavior: "smooth" });
      } else {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }, []);

  // Global keyboard shortcuts — j/k file nav, s/u view toggle
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ignore when focus is in a text input, textarea, or contenteditable
      const tag = (e.target as HTMLElement)?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        (e.target as HTMLElement)?.isContentEditable
      ) {
        return;
      }
      // Ignore when any modifier is held (avoid conflicting with browser/OS shortcuts)
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const files = diff?.files ?? [];
      const filePaths = files.map((f) => f.newPath || f.oldPath);

      switch (e.key) {
        case "j": {
          // Next file
          if (filePaths.length === 0) return;
          const currentIdx = activeFileRef.current
            ? filePaths.indexOf(activeFileRef.current)
            : -1;
          const nextIdx = Math.min(currentIdx + 1, filePaths.length - 1);
          handleFileSelect(filePaths[nextIdx]);
          e.preventDefault();
          break;
        }
        case "k": {
          // Previous file
          if (filePaths.length === 0) return;
          const currentIdx = activeFileRef.current
            ? filePaths.indexOf(activeFileRef.current)
            : 0;
          const prevIdx = Math.max(currentIdx - 1, 0);
          handleFileSelect(filePaths[prevIdx]);
          e.preventDefault();
          break;
        }
        case "s": {
          setViewMode("split");
          e.preventDefault();
          break;
        }
        case "u": {
          setViewMode("unified");
          e.preventDefault();
          break;
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [diff, handleFileSelect]);

  // Create a new thread with comment
  async function handleCreateThread(
    filePath: string,
    lineNumber: number,
    body: string,
    side: "left" | "right",
    startLine?: number,
    endLine?: number
  ) {
    try {
      const res = await fetch(`/api/reviews/${id}/threads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filePath, lineNumber, side, body, startLine, endLine }),
      });

      if (!res.ok) {
        toast.error("Failed to create comment");
        return;
      }

      toast.success("Comment added");
      fetchData();
    } catch {
      toast.error("Failed to create comment");
    }
  }

  // Add a reply to an existing thread
  async function handleAddComment(threadId: string, body: string) {
    try {
      const res = await fetch(`/api/reviews/${id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId, body }),
      });

      if (!res.ok) {
        toast.error("Failed to add reply");
        return;
      }

      fetchData();
    } catch {
      toast.error("Failed to add reply");
    }
  }

  // Edit a comment
  async function handleEditComment(commentId: string, body: string) {
    try {
      const res = await fetch(`/api/reviews/${id}/comments/${commentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });

      if (!res.ok) {
        toast.error("Failed to edit comment");
        return;
      }

      fetchData();
    } catch {
      toast.error("Failed to edit comment");
    }
  }

  // Delete a comment
  async function handleDeleteComment(commentId: string) {
    try {
      const res = await fetch(`/api/reviews/${id}/comments/${commentId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        toast.error("Failed to delete comment");
        return;
      }

      toast.success("Comment deleted");
      fetchData();
    } catch {
      toast.error("Failed to delete comment");
    }
  }

  // Resolve / unresolve a thread
  async function handleResolve(threadId: string, resolved: boolean) {
    try {
      const res = await fetch(`/api/reviews/${id}/threads/${threadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: resolved ? "resolved" : "open" }),
      });

      if (!res.ok) {
        toast.error("Failed to update thread");
        return;
      }

      fetchData();
    } catch {
      toast.error("Failed to update thread");
    }
  }

  // Dispatch to AI
  // Toggle file as viewed/unviewed
  function handleToggleViewed(filePath: string) {
    setViewedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(filePath)) {
        next.delete(filePath);
      } else {
        next.add(filePath);
      }
      return next;
    });
  }

  async function handleDispatch() {
    setIsDispatching(true);
    toast.info("Dispatching review comments to AI...", {
      duration: 10000,
      id: "dispatch",
    });

    try {
      const res = await fetch(`/api/reviews/${id}/dispatch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const data = await res.json();

      if (data.success) {
        toast.success("AI has addressed the review comments", {
          id: "dispatch",
        });
        if (data.newRound) {
          toast.info("New review round created — diff updated");
        }
      } else {
        toast.error("AI dispatch failed: " + (data.output || "Unknown error"), {
          id: "dispatch",
        });
      }

      fetchData();
    } catch {
      toast.error("Failed to dispatch to AI", { id: "dispatch" });
    } finally {
      setIsDispatching(false);
    }
  }

  // Build thread count map for file tree
  const threadCountMap = new Map<string, number>();
  if (session) {
    for (const thread of session.threads) {
      if (thread.status === "open") {
        const count = threadCountMap.get(thread.filePath) || 0;
        threadCountMap.set(thread.filePath, count + 1);
      }
    }
  }

  const openThreadCount =
    session?.threads.filter((t) => t.status === "open").length ?? 0;
  const totalThreadCount = session?.threads.length ?? 0;

  // Loading state — skeleton layout matching the real page structure
  if (loading) {
    return (
      <div className="h-screen bg-background flex flex-col overflow-hidden">
        {/* Skeleton header */}
        <div className="h-14 border-b border-border/50 flex items-center px-4 gap-4">
          <Skeleton className="size-8 rounded-md" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-40" />
          <div className="flex-1" />
          <Skeleton className="h-4 w-20" />
        </div>
        {/* Skeleton body */}
        <div className="flex flex-1 min-h-0">
          <div className="w-64 border-r border-border/30 p-3 flex flex-col gap-2">
            <Skeleton className="h-3 w-20 mb-2" />
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={`file-skel-${i}`} className="h-6 w-full" />
            ))}
          </div>
          <div className="flex-1 p-4 flex flex-col gap-3">
            <Skeleton className="h-8 w-full" />
            {Array.from({ length: 15 }).map((_, i) => (
              <Skeleton key={`line-skel-${i}`} className="h-5 w-full" />
            ))}
          </div>
        </div>
        {/* Skeleton footer */}
        <div className="h-14 border-t border-border/50 flex items-center px-4 gap-4">
          <Skeleton className="h-7 w-32" />
          <div className="flex-1" />
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-8 w-24" />
        </div>
      </div>
    );
  }

  // Error state
  if (error || !session) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center">
          <AlertCircleIcon className="size-8 text-destructive" />
          <p className="text-sm text-muted-foreground">
            {error || "Session not found"}
          </p>
          <Button variant="outline" onClick={() => router.push("/")}>
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <ReviewHeader session={session} stats={stats} />

      {/* Main content: file tree + diff viewer */}
      <div className="flex flex-1 min-h-0">
        {/* File tree sidebar — collapsible, responsive */}
        <aside
          className={cn(
            "border-r border-border/30 bg-card/30 shrink-0 flex flex-col transition-all duration-200 overflow-hidden",
            sidebarOpen ? "w-64 max-md:absolute max-md:inset-y-14 max-md:left-0 max-md:z-30 max-md:bg-background max-md:shadow-xl" : "w-0"
          )}
        >
          {sidebarOpen && (
            <FileTree
              files={diff?.files ?? []}
              activeFile={activeFile}
              onFileSelect={(path) => {
                handleFileSelect(path);
                // On mobile, close sidebar after file select
                if (window.innerWidth < 768) setSidebarOpen(false);
              }}
              threads={threadCountMap}
              viewedFiles={viewedFiles}
              onToggleViewed={handleToggleViewed}
            />
          )}
        </aside>

        {/* Diff viewer */}
        <main className="flex-1 overflow-auto min-w-0" data-diff-scroll>
          {diff && diff.files.length > 0 ? (
            <DiffViewer
              files={diff.files}
              threads={session.threads}
              viewMode={viewMode}
              onAddComment={handleAddComment}
              onEditComment={handleEditComment}
              onDeleteComment={handleDeleteComment}
              onResolve={handleResolve}
              onCreateThread={handleCreateThread}
              fileRefs={fileRefs}
              viewedFiles={viewedFiles}
              onToggleViewed={handleToggleViewed}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <FileIcon className="size-10 text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground text-sm font-medium mb-1">
                No changes found
              </p>
              <p className="text-muted-foreground/60 text-xs max-w-xs">
                The branch <span className="font-mono">{session.branch}</span> has no
                diff against <span className="font-mono">{session.baseBranch}</span>.
                Make sure the branches have diverged.
              </p>
            </div>
          )}
        </main>
      </div>

      {/* Bottom action bar */}
      <ReviewActions
        sessionId={id}
        openThreadCount={openThreadCount}
        totalThreadCount={totalThreadCount}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onDispatchComplete={fetchData}
        isDispatching={isDispatching}
        onDispatch={handleDispatch}
        sessionStatus={session.status}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
      />
    </div>
  );
}
