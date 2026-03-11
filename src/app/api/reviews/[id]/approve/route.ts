import { NextRequest, NextResponse } from "next/server";
import { getSession, updateSessionStatus } from "@/lib/store";
import { spawn } from "child_process";

/**
 * POST /api/reviews/[id]/approve — Approve the review and optionally create a PR
 * Body: { createPR?: boolean, prTitle?: string, prBody?: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params;
    const body = await request.json();
    const { createPR = false, prTitle, prBody } = body as {
      createPR?: boolean;
      prTitle?: string;
      prBody?: string;
    };

    const repoPath = request.nextUrl.searchParams.get("repoPath") || undefined;
    const session = getSession(sessionId, repoPath);

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Check for unresolved threads
    const openThreads = session.threads.filter((t) => t.status === "open");
    if (openThreads.length > 0) {
      return NextResponse.json(
        {
          error: `Cannot approve with ${openThreads.length} unresolved thread(s)`,
          openThreads: openThreads.length,
        },
        { status: 400 }
      );
    }

    // Mark as approved
    updateSessionStatus(sessionId, "approved", repoPath);

    let prUrl: string | null = null;

    // Create GitHub PR if requested
    if (createPR) {
      const title = prTitle || `${session.branch}`;
      const prBodyText =
        prBody ||
        `## Changes\n\nBranch: \`${session.branch}\` → \`${session.baseBranch}\`\n\nReviewed via In-The-Loop (${session.rounds.length} round(s), ${session.threads.length} thread(s))`;

      prUrl = await createGitHubPR(
        session.repoPath,
        session.branch,
        session.baseBranch,
        title,
        prBodyText
      );
    }

    return NextResponse.json({
      ok: true,
      status: "approved",
      prUrl,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function createGitHubPR(
  repoPath: string,
  branch: string,
  baseBranch: string,
  title: string,
  body: string
): Promise<string | null> {
  return new Promise((resolve) => {
    const proc = spawn(
      "gh",
      [
        "pr",
        "create",
        "--title",
        title,
        "--body",
        body,
        "--base",
        baseBranch,
        "--head",
        branch,
      ],
      { cwd: repoPath }
    );

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      if (code === 0 && stdout.trim()) {
        resolve(stdout.trim());
      } else {
        console.error("Failed to create PR:", stderr);
        resolve(null);
      }
    });

    proc.on("error", () => {
      resolve(null);
    });
  });
}
