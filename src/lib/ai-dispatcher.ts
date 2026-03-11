import { spawn } from "child_process";
import type { DispatchResult, ReviewFeedback } from "@/types";

// ============================================================
// AI Adapter Interface
// ============================================================

interface AIAdapter {
  name: string;
  buildCommand(prompt: string, repoPath: string): { cmd: string; args: string[] };
}

// ============================================================
// Built-in Adapters
// ============================================================

const claudeAdapter: AIAdapter = {
  name: "claude",
  buildCommand(prompt: string) {
    return {
      cmd: "claude",
      args: ["-p", prompt, "--allowedTools", "Edit,Write,Bash,Read,Glob,Grep"],
    };
  },
};

const codexAdapter: AIAdapter = {
  name: "codex",
  buildCommand(prompt: string) {
    return {
      cmd: "codex",
      args: ["--approval-mode", "full-auto", "-q", prompt],
    };
  },
};

function createCustomAdapter(commandTemplate: string): AIAdapter {
  return {
    name: "custom",
    buildCommand(prompt: string, repoPath: string) {
      const expanded = commandTemplate
        .replace(/\{\{prompt\}\}/g, prompt)
        .replace(/\{\{repo\}\}/g, repoPath);

      const parts = expanded.split(/\s+/);
      return {
        cmd: parts[0],
        args: parts.slice(1),
      };
    },
  };
}

function getAdapter(tool: string, customCommand?: string): AIAdapter {
  switch (tool) {
    case "claude":
      return claudeAdapter;
    case "codex":
      return codexAdapter;
    case "custom":
      if (!customCommand) throw new Error("Custom command template is required for custom AI tool");
      return createCustomAdapter(customCommand);
    default:
      return claudeAdapter;
  }
}

// ============================================================
// Prompt Construction
// ============================================================

export function buildReviewPrompt(feedback: ReviewFeedback): string {
  const sections = feedback.threads.map((thread, i) => {
    const comments = thread.comments
      .filter((c) => c.author === "user")
      .map((c) => `  - "${c.body}"`)
      .join("\n");

    return `## Review Comment ${i + 1}: ${thread.filePath}:${thread.lineNumber}

### Code Context:
\`\`\`
${thread.codeContext}
\`\`\`

### Review Feedback:
${comments}`;
  });

  return `You are addressing code review feedback. An engineer has reviewed the code changes and left the following comments. Please address each comment by making the appropriate code modifications.

Important guidelines:
- Only modify what is necessary to address each review comment
- Do not make unrelated changes
- If a comment asks for a refactor, implement the refactor
- If a comment points out a bug, fix the bug
- If a comment asks a question, add a code comment explaining, and make any suggested changes
- After making all changes, briefly describe what you changed

${sections.join("\n\n---\n\n")}

Please address all the review comments above by editing the relevant files.`;
}

// ============================================================
// Dispatch Execution
// ============================================================

export async function dispatchToAI(
  feedback: ReviewFeedback,
  repoPath: string,
  tool: string = "claude",
  customCommand?: string,
): Promise<DispatchResult> {
  const adapter = getAdapter(tool, customCommand);
  const prompt = buildReviewPrompt(feedback);
  const { cmd, args } = adapter.buildCommand(prompt, repoPath);

  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";

    const proc = spawn(cmd, args, {
      cwd: repoPath,
      env: { ...process.env },
      stdio: ["pipe", "pipe", "pipe"],
    });

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      resolve({
        success: code === 0,
        output: stdout || stderr || `Process exited with code ${code}`,
      });
    });

    proc.on("error", (err) => {
      resolve({
        success: false,
        output: `Failed to start AI tool "${cmd}": ${err.message}. Make sure ${cmd} is installed and available in your PATH.`,
      });
    });
  });
}
