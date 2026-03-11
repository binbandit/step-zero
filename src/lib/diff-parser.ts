import type { DiffFile, DiffHunk, DiffLine, ParsedDiff, DiffStats } from "@/types";

/**
 * Parse a raw unified diff string into structured data.
 * Handles the standard `git diff` output format.
 */
export function parseDiff(rawDiff: string): ParsedDiff {
  const files: DiffFile[] = [];
  const lines = rawDiff.split("\n");
  let i = 0;

  while (i < lines.length) {
    // Look for "diff --git a/... b/..."
    if (lines[i].startsWith("diff --git")) {
      const file = parseFile(lines, i);
      files.push(file.diffFile);
      i = file.nextIndex;
    } else {
      i++;
    }
  }

  const stats: DiffStats = {
    filesChanged: files.length,
    additions: files.reduce((sum, f) => sum + f.additions, 0),
    deletions: files.reduce((sum, f) => sum + f.deletions, 0),
  };

  return { files, stats };
}

function parseFile(
  lines: string[],
  startIndex: number
): { diffFile: DiffFile; nextIndex: number } {
  let i = startIndex;

  // Parse "diff --git a/path b/path"
  const diffLine = lines[i];
  const pathMatch = diffLine.match(/^diff --git a\/(.+) b\/(.+)$/);
  const oldPath = pathMatch ? pathMatch[1] : "";
  const newPath = pathMatch ? pathMatch[2] : "";
  i++;

  // Determine file status and skip metadata lines
  let status: DiffFile["status"] = "modified";
  let actualOldPath = oldPath;
  let actualNewPath = newPath;
  let isBinary = false;

  while (i < lines.length && !lines[i].startsWith("diff --git") && !lines[i].startsWith("@@")) {
    const line = lines[i];

    if (line.startsWith("new file")) {
      status = "added";
    } else if (line.startsWith("deleted file")) {
      status = "deleted";
    } else if (line.startsWith("similarity index")) {
      status = "renamed";
    } else if (line.startsWith("rename from ")) {
      status = "renamed";
      actualOldPath = line.slice("rename from ".length);
    } else if (line.startsWith("rename to ")) {
      status = "renamed";
      actualNewPath = line.slice("rename to ".length);
    } else if (line.startsWith("--- a/")) {
      actualOldPath = line.slice("--- a/".length);
    } else if (line.startsWith("+++ b/")) {
      actualNewPath = line.slice("+++ b/".length);
    } else if (line === "--- /dev/null") {
      status = "added";
    } else if (line === "+++ /dev/null") {
      status = "deleted";
    } else if (line.startsWith("Binary files") || line.startsWith("GIT binary patch")) {
      isBinary = true;
    }

    i++;
  }

  // Parse hunks
  const hunks: DiffHunk[] = [];
  let additions = 0;
  let deletions = 0;

  while (i < lines.length && !lines[i].startsWith("diff --git")) {
    if (lines[i].startsWith("@@")) {
      const hunk = parseHunk(lines, i);
      hunks.push(hunk.hunk);
      additions += hunk.additions;
      deletions += hunk.deletions;
      i = hunk.nextIndex;
    } else {
      i++;
    }
  }

  return {
    diffFile: {
      oldPath: actualOldPath,
      newPath: actualNewPath,
      status,
      hunks,
      additions,
      deletions,
      isBinary,
    },
    nextIndex: i,
  };
}

function parseHunk(
  lines: string[],
  startIndex: number
): { hunk: DiffHunk; additions: number; deletions: number; nextIndex: number } {
  const headerLine = lines[startIndex];

  // Parse @@ -oldStart,oldCount +newStart,newCount @@ optional context
  const hunkMatch = headerLine.match(
    /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/
  );

  const oldStart = hunkMatch ? parseInt(hunkMatch[1], 10) : 0;
  const oldCount = hunkMatch ? parseInt(hunkMatch[2] ?? "1", 10) : 0;
  const newStart = hunkMatch ? parseInt(hunkMatch[3], 10) : 0;
  const newCount = hunkMatch ? parseInt(hunkMatch[4] ?? "1", 10) : 0;
  const headerContext = hunkMatch ? hunkMatch[5]?.trim() || "" : "";

  const hunkLines: DiffLine[] = [];
  let oldLine = oldStart;
  let newLine = newStart;
  let additions = 0;
  let deletions = 0;
  let i = startIndex + 1;

  while (i < lines.length && !lines[i].startsWith("@@") && !lines[i].startsWith("diff --git")) {
    const line = lines[i];

    if (line.startsWith("+")) {
      hunkLines.push({
        type: "add",
        content: line.slice(1),
        oldLineNumber: null,
        newLineNumber: newLine,
      });
      newLine++;
      additions++;
    } else if (line.startsWith("-")) {
      hunkLines.push({
        type: "delete",
        content: line.slice(1),
        oldLineNumber: oldLine,
        newLineNumber: null,
      });
      oldLine++;
      deletions++;
    } else if (line.startsWith(" ") || line === "") {
      // Context line (or empty line treated as context at end of diff)
      hunkLines.push({
        type: "context",
        content: line.startsWith(" ") ? line.slice(1) : line,
        oldLineNumber: oldLine,
        newLineNumber: newLine,
      });
      oldLine++;
      newLine++;
    } else if (line.startsWith("\\ No newline at end of file")) {
      // Skip this marker
      i++;
      continue;
    } else {
      // Unknown line — might be start of new section, break
      break;
    }

    i++;
  }

  const header = headerContext
    ? `@@ -${oldStart},${oldCount} +${newStart},${newCount} @@ ${headerContext}`
    : `@@ -${oldStart},${oldCount} +${newStart},${newCount} @@`;

  return {
    hunk: {
      header,
      oldStart,
      oldCount,
      newStart,
      newCount,
      lines: hunkLines,
    },
    additions,
    deletions,
    nextIndex: i,
  };
}

/**
 * Extract code context around a specific line in a diff file.
 * Used for building AI prompts with surrounding code.
 */
export function extractCodeContext(
  file: DiffFile,
  lineNumber: number,
  contextLines: number = 5
): string {
  const allLines: { num: number; content: string; type: string }[] = [];

  for (const hunk of file.hunks) {
    for (const line of hunk.lines) {
      const num = line.newLineNumber ?? line.oldLineNumber;
      if (num !== null) {
        allLines.push({
          num,
          content: line.content,
          type: line.type === "add" ? "+" : line.type === "delete" ? "-" : " ",
        });
      }
    }
  }

  const targetIndex = allLines.findIndex((l) => l.num === lineNumber);
  if (targetIndex === -1) return "";

  const start = Math.max(0, targetIndex - contextLines);
  const end = Math.min(allLines.length, targetIndex + contextLines + 1);

  return allLines
    .slice(start, end)
    .map((l) => `${l.type}${l.num.toString().padStart(4)} | ${l.content}`)
    .join("\n");
}
