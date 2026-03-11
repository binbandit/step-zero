import { NextRequest, NextResponse } from "next/server";
import { updateThreadStatus } from "@/lib/store";
import type { ThreadStatus } from "@/types";

/**
 * PATCH /api/reviews/[id]/threads/[threadId] — Update thread status
 * Body: { status: "open" | "resolved" }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; threadId: string }> },
) {
  try {
    const { threadId } = await params;
    const body = await request.json();
    const { status } = body as { status: ThreadStatus };

    if (!["open", "resolved"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const repoPath = request.nextUrl.searchParams.get("repoPath") || undefined;
    updateThreadStatus(threadId, status, repoPath);

    return NextResponse.json({ ok: true, threadId, status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
