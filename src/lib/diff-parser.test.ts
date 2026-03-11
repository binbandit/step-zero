import { describe, expect, test } from "bun:test";
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
});
