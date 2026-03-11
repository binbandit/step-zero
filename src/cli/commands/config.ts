import { Command } from "commander";
import path from "path";
import { getConfig, setConfig } from "../../lib/store";

export const configCommand = new Command("config")
  .description("View or update configuration")
  .option("-r, --repo <path>", "Repository path", process.cwd())
  .option("--tool <tool>", "Set AI tool (claude, codex, custom)")
  .option("--command <command>", "Set custom AI command template")
  .option("--base <branch>", "Set default base branch")
  .action((options) => {
    const repoPath = path.resolve(options.repo);

    console.log();
    console.log(`\x1b[33m◆\x1b[0m \x1b[1mStep Zero\x1b[0m — Configuration`);
    console.log();

    // Set values if provided
    let changed = false;

    if (options.tool) {
      if (!["claude", "codex", "custom"].includes(options.tool)) {
        console.error(`  \x1b[31mError:\x1b[0m Invalid tool. Use: claude, codex, custom`);
        process.exit(1);
      }
      setConfig("ai_tool", options.tool, repoPath);
      console.log(`  \x1b[32m✓\x1b[0m AI tool set to \x1b[36m${options.tool}\x1b[0m`);
      changed = true;
    }

    if (options.command) {
      setConfig("custom_command", options.command, repoPath);
      console.log(`  \x1b[32m✓\x1b[0m Custom command set to \x1b[36m${options.command}\x1b[0m`);
      changed = true;
    }

    if (options.base) {
      setConfig("default_base_branch", options.base, repoPath);
      console.log(`  \x1b[32m✓\x1b[0m Default base branch set to \x1b[36m${options.base}\x1b[0m`);
      changed = true;
    }

    // Show current config
    if (!changed) {
      const tool = getConfig("ai_tool", repoPath) || "claude";
      const customCmd = getConfig("custom_command", repoPath);
      const baseBranch = getConfig("default_base_branch", repoPath) || "main";

      console.log(`  AI Tool:      \x1b[36m${tool}\x1b[0m`);
      if (customCmd) {
        console.log(`  Custom Cmd:   \x1b[36m${customCmd}\x1b[0m`);
      }
      console.log(`  Base Branch:  \x1b[36m${baseBranch}\x1b[0m`);
      console.log(`  Repo:         \x1b[90m${repoPath}\x1b[0m`);
    }

    console.log();
  });
