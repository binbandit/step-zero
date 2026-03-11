"use client";

import { useState } from "react";
import {
  CheckIcon,
  Loader2Icon,
  MessageSquareIcon,
  ColumnsIcon,
  AlignJustifyIcon,
  PanelLeftIcon,
  BotIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";

interface ReviewActionsProps {
  sessionId: string;
  openThreadCount: number;
  totalThreadCount: number;
  viewMode: "split" | "unified";
  onViewModeChange: (mode: "split" | "unified") => void;
  onDispatchComplete: () => void;
  isDispatching: boolean;
  onDispatch: () => void;
  sessionStatus: string;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export function ReviewActions({
  sessionId,
  openThreadCount,
  totalThreadCount,
  viewMode,
  onViewModeChange,
  onDispatchComplete,
  isDispatching,
  onDispatch,
  sessionStatus,
  sidebarOpen,
  onToggleSidebar,
}: ReviewActionsProps) {
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [confirmDispatchOpen, setConfirmDispatchOpen] = useState(false);
  const [approving, setApproving] = useState(false);
  const [createPR, setCreatePR] = useState(false);

  async function handleApprove() {
    setApproving(true);
    try {
      const res = await fetch(`/api/reviews/${sessionId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ createPR }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Failed to approve");
        return;
      }

      const data = await res.json();
      toast.success("Review approved!");

      if (data.prUrl) {
        toast.success(`PR created: ${data.prUrl}`, {
          action: {
            label: "Open PR",
            onClick: () => window.open(data.prUrl, "_blank"),
          },
        });
      }

      setApproveDialogOpen(false);
      setCreatePR(false);
      onDispatchComplete();
    } catch {
      toast.error("Failed to approve review");
    } finally {
      setApproving(false);
    }
  }

  function handleDispatchClick() {
    // Show confirmation before dispatching to AI
    setConfirmDispatchOpen(true);
  }

  function handleConfirmDispatch() {
    setConfirmDispatchOpen(false);
    onDispatch();
  }

  return (
    <>
      <div className="border-t border-border/50 bg-background/80 backdrop-blur-xl shrink-0">
        <div className="flex items-center justify-between h-14 px-4 gap-3">
          {/* Left side: sidebar toggle + view mode toggle */}
          <div className="flex items-center gap-2">
            {/* Sidebar toggle */}
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={onToggleSidebar}
                  />
                }
              >
                <PanelLeftIcon
                  className={cn(
                    "size-4 transition-colors",
                    sidebarOpen
                      ? "text-foreground"
                      : "text-muted-foreground"
                  )}
                />
              </TooltipTrigger>
              <TooltipContent>
                {sidebarOpen ? "Hide file tree" : "Show file tree"}
              </TooltipContent>
            </Tooltip>

            <Separator orientation="vertical" className="h-5" />

            {/* View mode segmented control */}
            <div
              className="flex items-center bg-muted/30 rounded-lg p-0.5 gap-0.5"
              role="tablist"
              aria-label="Diff view mode"
            >
              <button
                type="button"
                role="tab"
                aria-selected={viewMode === "split"}
                onClick={() => onViewModeChange("split")}
                className={cn(
                  "flex items-center gap-1.5 h-7 px-2.5 text-xs rounded-md transition-all",
                  viewMode === "split"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <ColumnsIcon className="size-3.5" />
                Split
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={viewMode === "unified"}
                onClick={() => onViewModeChange("unified")}
                className={cn(
                  "flex items-center gap-1.5 h-7 px-2.5 text-xs rounded-md transition-all",
                  viewMode === "unified"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <AlignJustifyIcon className="size-3.5" />
                Unified
              </button>
            </div>

            <Separator orientation="vertical" className="h-5 max-sm:hidden" />

            {/* Thread stats */}
            <div className="items-center gap-2 text-xs hidden sm:flex">
              <MessageSquareIcon className="size-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">
                {openThreadCount > 0 ? (
                  <>
                    <span className="text-primary font-semibold">
                      {openThreadCount}
                    </span>{" "}
                    open
                  </>
                ) : totalThreadCount > 0 ? (
                  <span className="text-emerald-400">All resolved</span>
                ) : (
                  "No comments"
                )}
                {totalThreadCount > 0 && (
                  <span className="text-muted-foreground/50 ml-1">
                    / {totalThreadCount}
                  </span>
                )}
              </span>
            </div>
          </div>

          {/* Right side: action buttons */}
          <div className="flex items-center gap-2">
            {/* Send to AI */}
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDispatchClick}
                    disabled={isDispatching || openThreadCount === 0}
                    className="gap-2 border-primary/30 text-primary hover:bg-primary/10 hover:text-primary"
                  />
                }
              >
                {isDispatching ? (
                  <>
                    <Loader2Icon className="size-3.5 animate-spin" />
                    <span className="max-sm:hidden">AI Working...</span>
                  </>
                ) : (
                  <>
                    <BotIcon className="size-3.5" />
                    <span className="max-sm:hidden">Send to AI</span>
                  </>
                )}
              </TooltipTrigger>
              <TooltipContent>
                {openThreadCount === 0
                  ? "Add comments first, then send to AI"
                  : `Send ${openThreadCount} open thread(s) to AI for resolution`}
              </TooltipContent>
            </Tooltip>

            {/* Approve */}
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    size="sm"
                    onClick={() => setApproveDialogOpen(true)}
                    disabled={
                      isDispatching ||
                      sessionStatus === "approved" ||
                      openThreadCount > 0
                    }
                    className={cn(
                      "gap-2",
                      openThreadCount === 0
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                        : ""
                    )}
                  />
                }
              >
                <CheckIcon className="size-3.5" />
                <span className="max-sm:hidden">Approve</span>
              </TooltipTrigger>
              <TooltipContent>
                {openThreadCount > 0
                  ? `Resolve ${openThreadCount} open thread(s) before approving`
                  : sessionStatus === "approved"
                    ? "Already approved"
                    : "Approve this review"}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>

      {/* Confirm Dispatch Dialog */}
      <Dialog open={confirmDispatchOpen} onOpenChange={setConfirmDispatchOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Comments to AI</DialogTitle>
            <DialogDescription>
              This will dispatch {openThreadCount} open thread(s) to your
              configured AI tool. The AI will read your review comments and
              modify the code to address them.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border border-border/50 bg-muted/30 p-3 text-xs text-muted-foreground">
            The AI will auto-commit changes to the branch. You&apos;ll review
            the updated diff in a new round.
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDispatchOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmDispatch}
              className="gap-2 border-primary/30"
            >
              <BotIcon className="size-3.5" />
              Send to AI
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve Dialog */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Review</DialogTitle>
            <DialogDescription>
              All threads are resolved. Ready to approve this review.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            <label className="flex items-center gap-3 text-sm cursor-pointer rounded-lg border border-border/50 p-3 hover:bg-muted/30 transition-colors">
              <input
                type="checkbox"
                checked={createPR}
                onChange={(e) => setCreatePR(e.target.checked)}
                className="size-4 rounded border-border accent-primary"
              />
              <div>
                <p className="font-medium">Create a GitHub Pull Request</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Uses the <code className="font-mono">gh</code> CLI to create a PR on GitHub
                </p>
              </div>
            </label>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setApproveDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleApprove}
              disabled={approving}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              {approving ? (
                <>
                  <Loader2Icon className="size-3.5 animate-spin" />
                  Approving...
                </>
              ) : (
                <>
                  <CheckIcon className="size-3.5" />
                  Approve{createPR ? " & Create PR" : ""}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
