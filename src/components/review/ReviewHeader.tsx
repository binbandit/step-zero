"use client";

import Link from "next/link";
import {
  GitBranchIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  LayersIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ReviewSession, DiffStats } from "@/types";

interface ReviewHeaderProps {
  session: ReviewSession;
  stats: DiffStats | null;
}

export function ReviewHeader({ session, stats }: ReviewHeaderProps) {
  return (
    <header className="shrink-0 bg-background/80 backdrop-blur-xl border-b border-border/50">
      <div className="flex items-center h-14 px-4 gap-3 min-w-0">
        {/* Back — use Link directly as anchor, not wrapping a button */}
        <Link
          href="/"
          className="flex items-center justify-center size-8 rounded-md hover:bg-accent transition-colors shrink-0"
          aria-label="Back to dashboard"
        >
          <ArrowLeftIcon className="size-4" />
        </Link>

        <Separator orientation="vertical" className="h-5" />

        <Tooltip>
          <TooltipTrigger
            render={
              <Link
                href="/"
                className="flex items-center gap-2 shrink-0"
              />
            }
          >
            <LayersIcon className="size-4 text-primary" />
            <span className="text-sm font-semibold tracking-tight">SZ</span>
          </TooltipTrigger>
          <TooltipContent>Step Zero</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-5" />

        {/* Branch info — truncate long names */}
        <div className="flex items-center gap-2 text-sm min-w-0">
          <GitBranchIcon className="size-3.5 text-muted-foreground shrink-0" />
          <Tooltip>
            <TooltipTrigger
              render={
                <span className="font-mono text-muted-foreground text-xs truncate max-w-[120px]" />
              }
            >
              {session.baseBranch}
            </TooltipTrigger>
            <TooltipContent>{session.baseBranch}</TooltipContent>
          </Tooltip>
          <ArrowRightIcon className="size-3 text-muted-foreground/50 shrink-0" />
          <Tooltip>
            <TooltipTrigger
              render={
                <span className="font-mono font-medium text-xs truncate max-w-[200px]" />
              }
            >
              {session.branch}
            </TooltipTrigger>
            <TooltipContent>{session.branch}</TooltipContent>
          </Tooltip>
        </div>

        {/* Stats — hide on small screens */}
        {stats && (
          <>
            <Separator orientation="vertical" className="h-5 max-md:hidden" />
            <div className="items-center gap-3 text-xs hidden md:flex">
              <span className="text-muted-foreground">
                {stats.filesChanged}{" "}
                {stats.filesChanged === 1 ? "file" : "files"}
              </span>
              <span className="text-diff-add-fg font-mono font-medium">
                +{stats.additions}
              </span>
              <span className="text-diff-del-fg font-mono font-medium">
                -{stats.deletions}
              </span>
            </div>
          </>
        )}

        {/* Round indicator */}
        {session.rounds.length > 0 && (
          <>
            <Separator orientation="vertical" className="h-5 max-sm:hidden" />
            <Badge
              variant="secondary"
              className="text-[10px] font-mono max-sm:hidden"
            >
              Round {session.rounds.length}
            </Badge>
          </>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Status */}
        <StatusIndicator status={session.status} />
      </div>
    </header>
  );
}

function StatusIndicator({ status }: { status: string }) {
  switch (status) {
    case "approved":
      return (
        <div className="flex items-center gap-2 text-xs">
          <div className="size-2 rounded-full bg-emerald-400" />
          <span className="text-emerald-400 font-medium">Approved</span>
        </div>
      );
    case "changes_requested":
      return (
        <div className="flex items-center gap-2 text-xs">
          <div className="size-2 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-amber-400 font-medium">
            Changes Requested
          </span>
        </div>
      );
    default:
      return (
        <div className="flex items-center gap-2 text-xs">
          <div className="size-2 rounded-full bg-blue-400" />
          <span className="text-muted-foreground font-medium">In Review</span>
        </div>
      );
  }
}
