import { NextRequest, NextResponse } from "next/server";
import { getSession, createRound, updateSessionStatus } from "@/lib/store";
import { getHeadSha } from "@/lib/git";
import { parseDiff } from "@/lib/diff-parser";
import { getDiff } from "@/lib/git";
import { extractCodeContext } from "@/lib/diff-parser";
import { dispatchToAI } from "@/lib/ai-dispatcher";
import type { ReviewFeedback } from "@/types";

/**
 * POST /api/reviews/[id]/dispatch — Dispatch unresolved review comments to AI
 * Body: { tool?: string, customCommand?: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params;
    const body = await request.json();
    const { tool, customCommand } = body as {
      tool?: string;
      customCommand?: string;
    };

    const repoPath = request.nextUrl.searchParams.get("repoPath") || undefined;
    const session = getSession(sessionId, repoPath);

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Get open threads with their comments
    const openThreads = session.threads.filter((t) => t.status === "open");

    if (openThreads.length === 0) {
      return NextResponse.json(
        { error: "No open threads to dispatch" },
        { status: 400 }
      );
    }

    // Get the current diff for code context
    let rawDiff: string;
    try {
      rawDiff = await getDiff(session.repoPath, session.baseBranch, session.branch);
    } catch {
      rawDiff = "";
    }

    const parsed = parseDiff(rawDiff);

    // Build feedback with code context
    const feedback: ReviewFeedback = {
      threads: openThreads.map((thread) => {
        const file = parsed.files.find(
          (f) => f.newPath === thread.filePath || f.oldPath === thread.filePath
        );
        const rangeLabel =
          thread.startLine !== thread.endLine
            ? `Lines: ${thread.startLine}-${thread.endLine}`
            : `Line: ${thread.lineNumber}`;
        const codeContext = file
          ? extractCodeContext(file, thread.lineNumber)
          : `[File: ${thread.filePath}, ${rangeLabel}]`;

        return {
          filePath: thread.filePath,
          lineNumber: thread.lineNumber,
          startLine: thread.startLine,
          endLine: thread.endLine,
          comments: thread.comments.map((c) => ({
            body: c.body,
            author: c.author,
          })),
          codeContext,
        };
      }),
    };

    // Record pre-dispatch SHA
    const preSha = await getHeadSha(session.repoPath);

    // Update status
    updateSessionStatus(sessionId, "changes_requested", repoPath);

    // Dispatch to AI tool
    const aiTool = tool || session.aiTool || "claude";
    const result = await dispatchToAI(
      feedback,
      session.repoPath,
      aiTool,
      customCommand
    );

    // Record post-dispatch SHA
    let postSha: string;
    try {
      postSha = await getHeadSha(session.repoPath);
    } catch {
      postSha = preSha;
    }

    // Create a new review round if there were changes
    if (postSha !== preSha) {
      createRound(sessionId, preSha, postSha, repoPath);
    }

    // Return to in_review status
    updateSessionStatus(sessionId, "in_review", repoPath);

    return NextResponse.json({
      success: result.success,
      output: result.output,
      newRound: postSha !== preSha,
      preSha,
      postSha,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
