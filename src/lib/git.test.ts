import { beforeEach, describe, expect, test, vi } from "vitest";

const { gitFactoryMock } = vi.hoisted(() => ({
  gitFactoryMock: vi.fn(),
}));

vi.mock("simple-git", () => ({
  default: gitFactoryMock,
}));

import {
  getCommitLog,
  getCurrentBranch,
  getDiff,
  getDiffBetweenCommits,
  getDiffStats,
  getFileAtRef,
  getHeadSha,
  getMergeBase,
  getRepoInfo,
  isGitRepo,
} from "./git";

function createGitMock() {
  return {
    diff: vi.fn(),
    diffSummary: vi.fn(),
    revparse: vi.fn(),
    raw: vi.fn(),
    log: vi.fn(),
    show: vi.fn(),
    branch: vi.fn(),
    status: vi.fn(),
  };
}

describe("git helpers", () => {
  const repoPath = "/repo";
  let gitMock: ReturnType<typeof createGitMock>;

  beforeEach(() => {
    gitMock = createGitMock();
    gitFactoryMock.mockReset();
    gitFactoryMock.mockReturnValue(gitMock);
  });

  test("passes the correct revision range to diff helpers", async () => {
    gitMock.diff.mockResolvedValue("diff output");

    await expect(getDiff(repoPath, "main", "feature")).resolves.toBe("diff output");
    await expect(getDiff(repoPath, "main")).resolves.toBe("diff output");
    await expect(getDiffBetweenCommits(repoPath, "sha1", "sha2")).resolves.toBe("diff output");

    expect(gitFactoryMock).toHaveBeenNthCalledWith(1, repoPath);
    expect(gitMock.diff).toHaveBeenNthCalledWith(1, ["main...feature"]);
    expect(gitMock.diff).toHaveBeenNthCalledWith(2, ["main"]);
    expect(gitMock.diff).toHaveBeenNthCalledWith(3, ["sha1", "sha2"]);
  });

  test("trims branch and sha results from revparse/raw", async () => {
    gitMock.revparse
      .mockResolvedValueOnce("feature/test\n")
      .mockResolvedValueOnce("abc123\n")
      .mockResolvedValueOnce("true\n");
    gitMock.raw.mockResolvedValue("base123\n");

    await expect(getCurrentBranch(repoPath)).resolves.toBe("feature/test");
    await expect(getHeadSha(repoPath)).resolves.toBe("abc123");
    await expect(getMergeBase(repoPath, "main", "feature")).resolves.toBe("base123");
    await expect(isGitRepo(repoPath)).resolves.toBe(true);

    expect(gitMock.revparse).toHaveBeenNthCalledWith(1, ["--abbrev-ref", "HEAD"]);
    expect(gitMock.revparse).toHaveBeenNthCalledWith(2, ["HEAD"]);
    expect(gitMock.raw).toHaveBeenCalledWith(["merge-base", "main", "feature"]);
    expect(gitMock.revparse).toHaveBeenNthCalledWith(3, ["--is-inside-work-tree"]);
  });

  test("maps commit log entries and falls back to an empty list on failure", async () => {
    gitMock.log
      .mockResolvedValueOnce({
        all: [
          {
            hash: "abc123",
            message: "Fix issue",
            author_name: "Dev One",
            date: "2026-03-11T00:00:00.000Z",
          },
        ],
      })
      .mockRejectedValueOnce(new Error("log failed"));

    await expect(getCommitLog(repoPath, "main", "feature")).resolves.toEqual([
      {
        sha: "abc123",
        message: "Fix issue",
        author: "Dev One",
        date: "2026-03-11T00:00:00.000Z",
      },
    ]);
    await expect(getCommitLog(repoPath, "main")).resolves.toEqual([]);

    expect(gitMock.log).toHaveBeenNthCalledWith(1, { from: "main", to: "feature" });
    expect(gitMock.log).toHaveBeenNthCalledWith(2, { from: "main", to: "HEAD" });
  });

  test("returns null when a file cannot be loaded at a ref", async () => {
    gitMock.show.mockRejectedValue(new Error("missing"));

    await expect(getFileAtRef(repoPath, "src/file.ts", "HEAD")).resolves.toBeNull();

    expect(gitMock.show).toHaveBeenCalledWith(["HEAD:src/file.ts"]);
  });

  test("assembles repo info and filters remote branches", async () => {
    gitMock.branch.mockResolvedValue({
      current: "feature/test",
      all: ["feature/test", "main", "remotes/origin/main"],
    });
    gitMock.status.mockResolvedValue({
      isClean: () => false,
    });
    gitMock.revparse.mockResolvedValue("abc123\n");

    await expect(getRepoInfo(repoPath)).resolves.toEqual({
      currentBranch: "feature/test",
      branches: ["feature/test", "main"],
      isClean: false,
      headSha: "abc123",
    });
  });

  test("maps diff summary counts", async () => {
    gitMock.diffSummary.mockResolvedValue({
      changed: 4,
      insertions: 12,
      deletions: 3,
    });

    await expect(getDiffStats(repoPath, "main", "feature")).resolves.toEqual({
      filesChanged: 4,
      additions: 12,
      deletions: 3,
    });
    await expect(getDiffStats(repoPath, "main")).resolves.toEqual({
      filesChanged: 4,
      additions: 12,
      deletions: 3,
    });

    expect(gitMock.diffSummary).toHaveBeenNthCalledWith(1, ["main...feature"]);
    expect(gitMock.diffSummary).toHaveBeenNthCalledWith(2, ["main"]);
  });

  test("returns false when revparse rejects for repo detection", async () => {
    gitMock.revparse.mockRejectedValue(new Error("not a repo"));

    await expect(isGitRepo(repoPath)).resolves.toBe(false);
  });
});
