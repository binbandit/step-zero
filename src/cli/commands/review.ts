import { Command } from "commander";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import { createSession, createRound, listSessions } from "../../lib/store";
import { getCurrentBranch, getHeadSha, isGitRepo } from "../../lib/git";

/**
 * Resolve the Step Zero project root directory.
 * Supports: global install (STEP_ZERO_ROOT env), direct execution (walk up from __dirname).
 */
function getStepZeroRoot(): string {
  // Set by bin/step-zero when invoked globally.
  if (process.env.STEP_ZERO_ROOT || process.env.ITL_ROOT) {
    return process.env.STEP_ZERO_ROOT || process.env.ITL_ROOT || "";
  }

  // Fallback: walk up from this file to find package.json with the current or legacy package name.
  let dir = __dirname;
  for (let i = 0; i < 10; i++) {
    const pkgPath = path.join(dir, "package.json");
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
        if (pkg.name === "step-zero" || pkg.name === "in-the-loop") return dir;
      } catch {}
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  // Last resort
  return path.resolve(__dirname, "..", "..", "..");
}

export const reviewCommand = new Command("review")
  .description("Start or open a review session")
  .argument("[branch]", "Branch to review (defaults to current branch)")
  .option("-b, --base <branch>", "Base branch to diff against", "main")
  .option("-r, --repo <path>", "Repository path", process.cwd())
  .option("-p, --port <port>", "Port for the web UI", "3000")
  .option("--no-open", "Don't auto-open the browser")
  .action(async (branchArg, options) => {
    const repoPath = path.resolve(options.repo);

    // Verify it's a git repo
    const isRepo = await isGitRepo(repoPath);
    if (!isRepo) {
      console.error(`\x1b[31mError:\x1b[0m ${repoPath} is not a git repository`);
      process.exit(1);
    }

    // Get branch
    const branch = branchArg || (await getCurrentBranch(repoPath));
    const baseBranch = options.base;

    console.log();
    console.log(`\x1b[33m◆\x1b[0m \x1b[1mStep Zero\x1b[0m — Starting review`);
    console.log();
    console.log(`  Branch:  \x1b[36m${branch}\x1b[0m`);
    console.log(`  Base:    \x1b[90m${baseBranch}\x1b[0m`);
    console.log(`  Repo:    \x1b[90m${repoPath}\x1b[0m`);
    console.log();

    // Check for existing session on this branch
    const existing = listSessions(repoPath).find(
      (s) => s.branch === branch && s.baseBranch === baseBranch && s.status !== "approved",
    );

    let sessionId: string;

    if (existing) {
      sessionId = existing.id;
      console.log(
        `  \x1b[90mResuming existing session\x1b[0m \x1b[33m${sessionId.slice(0, 8)}\x1b[0m`,
      );
    } else {
      // Create new session
      const session = createSession(repoPath, branch, baseBranch);
      sessionId = session.id;

      // Create initial round
      try {
        const headSha = await getHeadSha(repoPath);
        createRound(sessionId, headSha, headSha, repoPath);
      } catch {
        // Non-fatal
      }

      console.log(`  \x1b[32m✓\x1b[0m Created session \x1b[33m${sessionId.slice(0, 8)}\x1b[0m`);
    }

    console.log();
    console.log(`  Starting web UI on port ${options.port}...`);
    console.log();

    // Start Next.js dev server via bun (bun:sqlite requires bun runtime)
    // We run the next entry point directly with bun to avoid --bun/NODE_OPTIONS conflicts
    const stepZeroRoot = getStepZeroRoot();
    const nextEntry = path.join(stepZeroRoot, "node_modules", "next", "dist", "bin", "next");

    // Reuse the current Bun binary so the web UI runs on the same runtime version.
    const serverProcess = spawn(process.execPath, [nextEntry, "dev", "-p", options.port], {
      cwd: stepZeroRoot,
      stdio: "inherit",
      env: {
        ...process.env,
        ITL_REPO_PATH: repoPath,
        ITL_SESSION_ID: sessionId,
        STEP_ZERO_REPO_PATH: repoPath,
        STEP_ZERO_SESSION_ID: sessionId,
      },
    });

    // Auto-open browser
    if (options.open !== false) {
      setTimeout(() => {
        const url = `http://localhost:${options.port}/review/${sessionId}`;
        const openCmd =
          process.platform === "darwin"
            ? "open"
            : process.platform === "win32"
              ? "start"
              : "xdg-open";
        spawn(openCmd, [url], { stdio: "ignore" });
        console.log(`  \x1b[36m→\x1b[0m ${url}`);
      }, 3000);
    }

    // Handle shutdown
    process.on("SIGINT", () => {
      serverProcess.kill("SIGINT");
      process.exit(0);
    });

    process.on("SIGTERM", () => {
      serverProcess.kill("SIGTERM");
      process.exit(0);
    });
  });
