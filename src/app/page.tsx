"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  GitBranchIcon,
  PlusIcon,
  MessageSquareIcon,
  CheckCircle2Icon,
  ClockIcon,
  AlertCircleIcon,
  Trash2Icon,
  FolderGit2Icon,
  ArrowRightIcon,
  LayersIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { timeAgo } from "@/lib/utils";
import type { ReviewSession } from "@/types";

// -- Helpers --

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "approved":
      return (
        <Badge variant="default" className="gap-1.5 bg-emerald-500/15 text-emerald-400 border-emerald-500/25 hover:bg-emerald-500/20">
          <CheckCircle2Icon className="size-3" />
          Approved
        </Badge>
      );
    case "changes_requested":
      return (
        <Badge variant="default" className="gap-1.5 bg-amber-500/15 text-amber-400 border-amber-500/25 hover:bg-amber-500/20">
          <AlertCircleIcon className="size-3" />
          Changes Requested
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary" className="gap-1.5">
          <ClockIcon className="size-3" />
          In Review
        </Badge>
      );
  }
}

// -- Main Page --

export default function DashboardPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<ReviewSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [repoPath, setRepoPath] = useState("");
  const [branch, setBranch] = useState("");
  const [baseBranch, setBaseBranch] = useState("main");
  const [creating, setCreating] = useState(false);

  const fetchSessions = useCallback(async () => {
    setFetchError(null);
    try {
      const res = await fetch("/api/reviews");
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
      } else {
        setFetchError("Failed to load review sessions");
      }
    } catch {
      setFetchError("Could not connect to the server");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  async function handleCreate() {
    if (!repoPath || !branch) {
      toast.error("Repository path and branch are required");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoPath, branch, baseBranch }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Failed to create review");
        return;
      }

      const session = await res.json();
      toast.success("Review session created");
      setNewDialogOpen(false);
      setRepoPath("");
      setBranch("");
      setBaseBranch("main");
      router.push(`/review/${session.id}`);
    } catch {
      toast.error("Failed to create review");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    // Confirm before deleting
    if (!window.confirm("Delete this review session? This cannot be undone.")) {
      return;
    }
    try {
      const res = await fetch(`/api/reviews/${id}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("Failed to delete session");
        return;
      }
      // Optimistic: remove from state immediately
      setSessions((prev) => prev.filter((s) => s.id !== id));
      toast.success("Session deleted");
    } catch {
      toast.error("Failed to delete session");
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Subtle gradient wash at top for atmosphere */}
      <div className="fixed inset-x-0 top-0 h-72 bg-gradient-to-b from-primary/[0.04] to-transparent pointer-events-none" />

      <div className="relative max-w-6xl mx-auto px-6 py-12">
        {/* Header */}
        <header className="mb-12">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center justify-center size-10 rounded-xl bg-primary/10 border border-primary/20">
              <LayersIcon className="size-5 text-primary" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Step Zero</h1>
          </div>
          <p className="text-muted-foreground mt-1 max-w-lg text-[15px] leading-relaxed">
            Pre-PR review layer for AI-generated code. Review diffs, leave
            feedback, and let AI address your comments before the real PR.
          </p>
        </header>

        {/* Actions bar */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
              Review Sessions
            </h2>
            {!loading && (
              <Badge variant="secondary" className="text-[10px] font-mono">
                {sessions.length}
              </Badge>
            )}
          </div>

          <Dialog open={newDialogOpen} onOpenChange={setNewDialogOpen}>
            <DialogTrigger render={<Button size="sm" />}>
              <PlusIcon data-icon="inline-start" />
              New Review
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New Review Session</DialogTitle>
                <DialogDescription>
                  Point to a repository and branch to start reviewing
                  AI-generated changes.
                </DialogDescription>
              </DialogHeader>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleCreate();
                }}
                className="flex flex-col gap-4 py-4"
              >
                <div className="flex flex-col gap-2">
                  <label htmlFor="repo-path" className="text-sm font-medium">
                    Repository Path
                  </label>
                  <input
                    id="repo-path"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono"
                    placeholder="/path/to/your/repo"
                    value={repoPath}
                    onChange={(e) => setRepoPath(e.target.value)}
                    autoFocus
                    required
                  />
                </div>

                <div className="flex gap-3">
                  <div className="flex flex-col gap-2 flex-1">
                    <label htmlFor="branch" className="text-sm font-medium">Branch</label>
                    <input
                      id="branch"
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono"
                      placeholder="feat/my-feature"
                      value={branch}
                      onChange={(e) => setBranch(e.target.value)}
                      required
                    />
                  </div>

                  <div className="flex flex-col gap-2 flex-1">
                    <label htmlFor="base-branch" className="text-sm font-medium">Base Branch</label>
                    <input
                      id="base-branch"
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono"
                      placeholder="main"
                      value={baseBranch}
                      onChange={(e) => setBaseBranch(e.target.value)}
                    />
                  </div>
                </div>
              </form>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setNewDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={creating}>
                  {creating ? "Creating..." : "Start Review"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Separator className="mb-8" />

        {/* Error state */}
        {fetchError && !loading && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <AlertCircleIcon className="size-8 text-destructive/60 mb-4" />
            <p className="text-sm text-muted-foreground mb-4">{fetchError}</p>
            <Button variant="outline" size="sm" onClick={fetchSessions}>
              Retry
            </Button>
          </div>
        )}

        {/* Sessions Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="bg-card/50">
                <CardHeader>
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2 mt-2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3 mt-2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="size-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-6 border border-border/50">
              <FolderGit2Icon className="size-8 text-muted-foreground/40" />
            </div>
            <h3 className="text-lg font-semibold mb-2">
              No review sessions yet
            </h3>
            <p className="text-muted-foreground text-sm max-w-sm mb-6 leading-relaxed">
              Create a review session to start reviewing AI-generated code
              changes before they become a pull request.
            </p>
            <Button onClick={() => setNewDialogOpen(true)}>
              <PlusIcon data-icon="inline-start" />
              Create Your First Review
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sessions.map((session) => {
              const totalComments = session.threads.reduce(
                (sum, t) => sum + t.comments.length,
                0
              );

              return (
                <Card
                  key={session.id}
                  className="bg-card/60 hover:bg-card cursor-pointer transition-all duration-200 hover:border-primary/20 group"
                  onClick={() => router.push(`/review/${session.id}`)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-sm font-semibold truncate font-mono">
                        {session.branch}
                      </CardTitle>
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                              onClick={(e) => handleDelete(session.id, e)}
                            />
                          }
                        >
                          <Trash2Icon className="size-3.5 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>Delete session</TooltipContent>
                      </Tooltip>
                    </div>
                    <CardDescription className="flex items-center gap-1.5 text-xs font-mono">
                      <GitBranchIcon className="size-3 shrink-0" />
                      {session.baseBranch}
                      <ArrowRightIcon className="size-3 shrink-0 text-muted-foreground/50" />
                      {session.branch}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="pb-3">
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {session.stats && (
                        <>
                          <span>{session.stats.filesChanged} files</span>
                          <span className="text-diff-add-fg font-mono">
                            +{session.stats.additions}
                          </span>
                          <span className="text-diff-del-fg font-mono">
                            -{session.stats.deletions}
                          </span>
                          <Separator
                            orientation="vertical"
                            className="h-3"
                          />
                        </>
                      )}
                      <span className="flex items-center gap-1">
                        <MessageSquareIcon className="size-3" />
                        {totalComments}
                      </span>
                      {session.rounds.length > 0 && (
                        <span className="font-mono">
                          R{session.rounds.length}
                        </span>
                      )}
                    </div>
                  </CardContent>

                  <CardFooter className="pt-0 flex items-center justify-between">
                    <StatusBadge status={session.status} />
                    <span className="text-[11px] text-muted-foreground/60">
                      {timeAgo(session.updatedAt)}
                    </span>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
