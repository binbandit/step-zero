import { NextRequest, NextResponse } from "next/server";
import { createThread, addComment, getSession } from "@/lib/store";
import type { DiffSide, CommentAuthor } from "@/types";

/**
 * POST /api/reviews/[id]/threads — Create a new thread with an initial comment
 * Body: { filePath, lineNumber, side?, body, author? }
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: sessionId } = await params;
    const body = await request.json();
    const {
      filePath,
      lineNumber,
      startLine,
      endLine,
      side = "right",
      body: commentBody,
      author = "user",
    } = body as {
      filePath: string;
      lineNumber: number;
      startLine?: number;
      endLine?: number;
      side?: DiffSide;
      body: string;
      author?: CommentAuthor;
    };

    if (!filePath || lineNumber == null || !commentBody) {
      return NextResponse.json(
        { error: "filePath, lineNumber, and body are required" },
        { status: 400 },
      );
    }

    const repoPath = request.nextUrl.searchParams.get("repoPath") || undefined;

    // Create thread (startLine/endLine default to lineNumber for single-line comments)
    const thread = createThread(
      sessionId,
      filePath,
      lineNumber,
      side,
      repoPath,
      startLine,
      endLine,
    );

    // Get current round
    const session = getSession(sessionId, repoPath);
    const currentRound = session?.rounds.length ? session.rounds[session.rounds.length - 1] : null;

    // Add the initial comment
    const comment = addComment(
      thread.id,
      sessionId,
      commentBody,
      author,
      currentRound?.id,
      repoPath,
    );

    thread.comments = [comment];

    return NextResponse.json(thread, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
