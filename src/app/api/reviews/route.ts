import { NextRequest, NextResponse } from "next/server";
import { createSession, listSessions, createRound } from "@/lib/store";
import { getHeadSha, getDiffStats } from "@/lib/git";

/**
 * GET /api/reviews — List all review sessions
 */
export async function GET(request: NextRequest) {
  try {
    const repoPath = request.nextUrl.searchParams.get("repoPath") || process.cwd();
    const sessions = listSessions(repoPath);

    // Enrich with diff stats for each session
    const enriched = await Promise.all(
      sessions.map(async (session) => {
        try {
          const stats = await getDiffStats(session.repoPath, session.baseBranch, session.branch);
          return { ...session, stats };
        } catch {
          return { ...session, stats: { filesChanged: 0, additions: 0, deletions: 0 } };
        }
      })
    );

    return NextResponse.json(enriched);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/reviews — Create a new review session
 * Body: { repoPath, branch, baseBranch?, aiTool? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { repoPath, branch, baseBranch = "main", aiTool } = body;

    if (!repoPath || !branch) {
      return NextResponse.json(
        { error: "repoPath and branch are required" },
        { status: 400 }
      );
    }

    const session = createSession(repoPath, branch, baseBranch, aiTool);

    // Create initial review round
    try {
      const headSha = await getHeadSha(repoPath);
      createRound(session.id, headSha, headSha, repoPath);
    } catch {
      // Non-fatal — round can be created later
    }

    return NextResponse.json(session, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
