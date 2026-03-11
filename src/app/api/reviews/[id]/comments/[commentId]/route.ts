import { NextRequest, NextResponse } from "next/server";
import { getComment, updateComment, deleteComment } from "@/lib/store";

/**
 * PATCH /api/reviews/[id]/comments/[commentId] — Edit a comment body
 * Body: { body: string }
 * Only user-authored comments belonging to this session can be edited.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  try {
    const { id: sessionId, commentId } = await params;
    const json = await request.json();
    const body = typeof json?.body === "string" ? json.body.trim() : "";

    if (!body) {
      return NextResponse.json(
        { error: "body is required and must be a non-empty string" },
        { status: 400 }
      );
    }

    // Validate the comment exists and belongs to this session
    const comment = getComment(commentId);
    if (!comment || comment.sessionId !== sessionId) {
      return NextResponse.json(
        { error: "Comment not found" },
        { status: 404 }
      );
    }

    // Only user-authored comments can be edited
    if (comment.author !== "user") {
      return NextResponse.json(
        { error: "Cannot edit AI-authored comments" },
        { status: 403 }
      );
    }

    const updated = updateComment(commentId, body);
    if (!updated) {
      return NextResponse.json(
        { error: "Failed to update comment" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/reviews/[id]/comments/[commentId] — Delete a comment
 * Only user-authored comments belonging to this session can be deleted.
 * If the last comment in a thread is deleted, the thread is also removed.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  try {
    const { id: sessionId, commentId } = await params;

    // Validate the comment exists and belongs to this session
    const comment = getComment(commentId);
    if (!comment || comment.sessionId !== sessionId) {
      return NextResponse.json(
        { error: "Comment not found" },
        { status: 404 }
      );
    }

    // Only user-authored comments can be deleted
    if (comment.author !== "user") {
      return NextResponse.json(
        { error: "Cannot delete AI-authored comments" },
        { status: 403 }
      );
    }

    const deleted = deleteComment(commentId);
    if (!deleted) {
      return NextResponse.json(
        { error: "Failed to delete comment" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
