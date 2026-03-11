import { Command } from "commander";
import path from "path";
import { listSessions } from "../../lib/store";

export const statusCommand = new Command("status")
  .description("Show active review sessions")
  .option("-r, --repo <path>", "Repository path", process.cwd())
  .action((options) => {
    const repoPath = path.resolve(options.repo);
    const sessions = listSessions(repoPath);

    console.log();
    console.log(
      `\x1b[33m◆\x1b[0m \x1b[1mStep Zero\x1b[0m — Review Sessions`
    );
    console.log();

    if (sessions.length === 0) {
      console.log("  \x1b[90mNo active review sessions.\x1b[0m");
      console.log(
        "  Run \x1b[36mstep-zero review\x1b[0m to start a new review."
      );
      console.log();
      return;
    }

    for (const session of sessions) {
      const statusColors: Record<string, string> = {
        in_review: "\x1b[34m● In Review\x1b[0m",
        changes_requested: "\x1b[33m● Changes Requested\x1b[0m",
        approved: "\x1b[32m● Approved\x1b[0m",
      };

      const openThreads = session.threads.filter(
        (t) => t.status === "open"
      ).length;
      const totalComments = session.threads.reduce(
        (sum, t) => sum + t.comments.length,
        0
      );

      console.log(
        `  \x1b[1m${session.branch}\x1b[0m → \x1b[90m${session.baseBranch}\x1b[0m`
      );
      console.log(
        `  ${statusColors[session.status] || session.status}  |  Round ${session.rounds.length}  |  ${totalComments} comments  |  ${openThreads} open threads`
      );
      console.log(`  \x1b[90mID: ${session.id.slice(0, 8)}\x1b[0m`);
      console.log();
    }
  });
