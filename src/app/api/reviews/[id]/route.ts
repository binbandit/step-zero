import { NextRequest, NextResponse } from "next/server";
import { getSession, deleteSession, updateSessionStatus } from "@/lib/store";
import type { SessionStatus } from "@/types";

/**
 * GET /api/reviews/[id] — Get session details with rounds, threads, comments
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const repoPath = request.nextUrl.searchParams.get("repoPath") || undefined;
    const session = getSession(id, repoPath);

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    return NextResponse.json(session);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/reviews/[id] — Update session status
 * Body: { status }
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status } = body as { status: SessionStatus };

    if (!["in_review", "changes_requested", "approved"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const repoPath = request.nextUrl.searchParams.get("repoPath") || undefined;
    updateSessionStatus(id, status, repoPath);

    const session = getSession(id, repoPath);
    return NextResponse.json(session);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/reviews/[id] — Delete a session
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const repoPath = request.nextUrl.searchParams.get("repoPath") || undefined;
    deleteSession(id, repoPath);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
