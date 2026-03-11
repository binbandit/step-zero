import { describe, expect, test } from "vitest";
import { extractCodeContext, parseDiff } from "./diff-parser";

describe("parseDiff", () => {
  test("parses a modified file and computes stats", () => {
    const rawDiff = [
      "diff --git a/src/example.ts b/src/example.ts",
      "index 1234567..89abcde 100644",
      "--- a/src/example.ts",
      "+++ b/src/example.ts",
      "@@ -1,3 +1,3 @@",
      " export function greet(name: string) {",
      "-  return `Hello, ${name}`;",
      "+  return `Hello there, ${name}`;",
      " }",
    ].join("\n");

    const parsed = parseDiff(rawDiff);

    expect(parsed.stats).toEqual({
      filesChanged: 1,
      additions: 1,
      deletions: 1,
    });
    expect(parsed.files).toHaveLength(1);
    expect(parsed.files[0]).toMatchObject({
      oldPath: "src/example.ts",
      newPath: "src/example.ts",
      status: "modified",
      additions: 1,
      deletions: 1,
      isBinary: false,
    });
    expect(parsed.files[0]?.hunks[0]?.lines).toEqual([
      {
        type: "context",
        content: "export function greet(name: string) {",
        oldLineNumber: 1,
        newLineNumber: 1,
      },
      {
        type: "delete",
        content: "  return `Hello, ${name}`;",
        oldLineNumber: 2,
        newLineNumber: null,
      },
      {
        type: "add",
        content: "  return `Hello there, ${name}`;",
        oldLineNumber: null,
        newLineNumber: 2,
      },
      {
        type: "context",
        content: "}",
        oldLineNumber: 3,
        newLineNumber: 3,
      },
    ]);
  });

  test("parses renamed binary files without hunks", () => {
    const rawDiff = [
      "diff --git a/assets/old.png b/assets/new.png",
      "similarity index 100%",
      "rename from assets/old.png",
      "rename to assets/new.png",
      "Binary files a/assets/old.png and b/assets/new.png differ",
    ].join("\n");

    const parsed = parseDiff(rawDiff);

    expect(parsed.stats).toEqual({
      filesChanged: 1,
      additions: 0,
      deletions: 0,
    });
    expect(parsed.files[0]).toMatchObject({
      oldPath: "assets/old.png",
      newPath: "assets/new.png",
      status: "renamed",
      isBinary: true,
      hunks: [],
      additions: 0,
      deletions: 0,
    });
  });

  test("parses added and deleted files with /dev/null markers", () => {
    const rawDiff = [
      "diff --git a/src/new.ts b/src/new.ts",
      "new file mode 100644",
      "index 0000000..1234567",
      "--- /dev/null",
      "+++ b/src/new.ts",
      "@@ -0,0 +1,2 @@",
      "+export const created = true;",
      "+",
      "diff --git a/src/old.ts b/src/old.ts",
      "deleted file mode 100644",
      "index 89abcde..0000000",
      "--- a/src/old.ts",
      "+++ /dev/null",
      "@@ -1,2 +0,0 @@",
      "-export const removed = true;",
      "-",
    ].join("\n");

    const parsed = parseDiff(rawDiff);

    expect(parsed.stats).toEqual({
      filesChanged: 2,
      additions: 2,
      deletions: 2,
    });
    expect(parsed.files).toEqual([
      expect.objectContaining({
        oldPath: "src/new.ts",
        newPath: "src/new.ts",
        status: "added",
        additions: 2,
        deletions: 0,
      }),
      expect.objectContaining({
        oldPath: "src/old.ts",
        newPath: "src/old.ts",
        status: "deleted",
        additions: 0,
        deletions: 2,
      }),
    ]);
  });

  test("ignores no-newline markers while preserving hunk counts", () => {
    const rawDiff = [
      "diff --git a/src/example.ts b/src/example.ts",
      "index 1234567..89abcde 100644",
      "--- a/src/example.ts",
      "+++ b/src/example.ts",
      "@@ -1 +1 @@",
      "-const value = 'before';",
      "\\ No newline at end of file",
      "+const value = 'after';",
      "\\ No newline at end of file",
    ].join("\n");

    const parsed = parseDiff(rawDiff);

    expect(parsed.files[0]?.hunks[0]?.lines).toEqual([
      {
        type: "delete",
        content: "const value = 'before';",
        oldLineNumber: 1,
        newLineNumber: null,
      },
      {
        type: "add",
        content: "const value = 'after';",
        oldLineNumber: null,
        newLineNumber: 1,
      },
    ]);
    expect(parsed.stats).toEqual({
      filesChanged: 1,
      additions: 1,
      deletions: 1,
    });
  });
});

describe("extractCodeContext", () => {
  test("returns numbered context around the requested line", () => {
    const rawDiff = [
      "diff --git a/src/example.ts b/src/example.ts",
      "index 1234567..89abcde 100644",
      "--- a/src/example.ts",
      "+++ b/src/example.ts",
      "@@ -10,3 +10,3 @@",
      " function greet(name: string) {",
      "-  return `Hello, ${name}`;",
      "+  return `Hello there, ${name}`;",
      " }",
    ].join("\n");

    const file = parseDiff(rawDiff).files[0];

    expect(extractCodeContext(file, 11, 1)).toBe(
      [
        "   10 | function greet(name: string) {",
        "-  11 |   return `Hello, ${name}`;",
        "+  11 |   return `Hello there, ${name}`;",
      ].join("\n"),
    );
  });

  test("returns an empty string when the line is not present", () => {
    const rawDiff = [
      "diff --git a/src/example.ts b/src/example.ts",
      "index 1234567..89abcde 100644",
      "--- a/src/example.ts",
      "+++ b/src/example.ts",
      "@@ -1,1 +1,1 @@",
      "-return oldValue;",
      "+return newValue;",
    ].join("\n");

    const file = parseDiff(rawDiff).files[0];

    expect(extractCodeContext(file, 99)).toBe("");
  });
});
