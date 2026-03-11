import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/store";
import { getDiff, getDiffBetweenCommits } from "@/lib/git";
import { parseDiff } from "@/lib/diff-parser";

/**
 * GET /api/reviews/[id]/diff — Get parsed diff for the review session
 * Query params:
 *   - round: specific round number to show inter-round diff
 *   - mode: "full" (vs base) or "round" (vs previous round)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const repoPath = request.nextUrl.searchParams.get("repoPath") || undefined;
    const mode = request.nextUrl.searchParams.get("mode") || "full";

    const session = getSession(id, repoPath);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    let rawDiff: string;

    if (mode === "round" && session.rounds.length >= 2) {
      // Inter-round diff: show what changed between last two rounds
      const prevRound = session.rounds[session.rounds.length - 2];
      const currRound = session.rounds[session.rounds.length - 1];
      rawDiff = await getDiffBetweenCommits(
        session.repoPath,
        prevRound.commitShaEnd,
        currRound.commitShaEnd
      );
    } else {
      // Full diff against base branch
      rawDiff = await getDiff(session.repoPath, session.baseBranch, session.branch);
    }

    const parsed = parseDiff(rawDiff);

    return NextResponse.json({
      ...parsed,
      branch: session.branch,
      baseBranch: session.baseBranch,
      mode,
      roundCount: session.rounds.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
