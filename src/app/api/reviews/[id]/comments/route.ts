import { NextRequest, NextResponse } from "next/server";
import { getSession, addComment } from "@/lib/store";
import type { CommentAuthor } from "@/types";

/**
 * POST /api/reviews/[id]/comments — Add a comment to an existing thread
 * Body: { threadId, body, author? }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params;
    const body = await request.json();
    const {
      threadId,
      body: commentBody,
      author = "user",
    } = body as {
      threadId: string;
      body: string;
      author?: CommentAuthor;
    };

    if (!threadId || !commentBody) {
      return NextResponse.json(
        { error: "threadId and body are required" },
        { status: 400 }
      );
    }

    const repoPath = request.nextUrl.searchParams.get("repoPath") || undefined;

    // Find current round to associate comment
    const session = getSession(sessionId, repoPath);
    const currentRound =
      session?.rounds.length ? session.rounds[session.rounds.length - 1] : null;

    const comment = addComment(
      threadId,
      sessionId,
      commentBody,
      author,
      currentRound?.id,
      repoPath
    );

    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
