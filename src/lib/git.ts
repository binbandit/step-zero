import gitFactory, { type SimpleGit } from "simple-git";

function getGit(repoPath: string): SimpleGit {
  return gitFactory(repoPath);
}

/**
 * Get the raw unified diff between base and head.
 * If head is omitted, uses the current working tree.
 */
export async function getDiff(repoPath: string, base: string, head?: string): Promise<string> {
  const git = getGit(repoPath);
  if (head) {
    return git.diff([`${base}...${head}`]);
  }
  // Diff from base to current working state (staged + unstaged)
  return git.diff([base]);
}

/**
 * Get diff between two specific commits (for inter-round diffs).
 */
export async function getDiffBetweenCommits(
  repoPath: string,
  sha1: string,
  sha2: string,
): Promise<string> {
  const git = getGit(repoPath);
  return git.diff([sha1, sha2]);
}

/**
 * Get current branch name.
 */
export async function getCurrentBranch(repoPath: string): Promise<string> {
  const git = getGit(repoPath);
  const result = await git.revparse(["--abbrev-ref", "HEAD"]);
  return result.trim();
}

/**
 * Get current HEAD commit SHA.
 */
export async function getHeadSha(repoPath: string): Promise<string> {
  const git = getGit(repoPath);
  const result = await git.revparse(["HEAD"]);
  return result.trim();
}

/**
 * Get the merge base commit between two branches.
 */
export async function getMergeBase(
  repoPath: string,
  branch1: string,
  branch2: string,
): Promise<string> {
  const git = getGit(repoPath);
  const result = await git.raw(["merge-base", branch1, branch2]);
  return result.trim();
}

/**
 * Get commit log between base and head.
 */
export async function getCommitLog(
  repoPath: string,
  base: string,
  head?: string,
): Promise<{ sha: string; message: string; author: string; date: string }[]> {
  const git = getGit(repoPath);

  try {
    const log = await git.log({ from: base, to: head || "HEAD" });
    return log.all.map((entry) => ({
      sha: entry.hash,
      message: entry.message,
      author: entry.author_name,
      date: entry.date,
    }));
  } catch {
    return [];
  }
}

/**
 * Get file content at a specific ref.
 */
export async function getFileAtRef(
  repoPath: string,
  filePath: string,
  ref: string,
): Promise<string | null> {
  const git = getGit(repoPath);
  try {
    return await git.show([`${ref}:${filePath}`]);
  } catch {
    return null;
  }
}

/**
 * Get repo information: branches, status, etc.
 */
export async function getRepoInfo(repoPath: string): Promise<{
  currentBranch: string;
  branches: string[];
  isClean: boolean;
  headSha: string;
}> {
  const git = getGit(repoPath);

  const [branchSummary, status, headSha] = await Promise.all([
    git.branch(),
    git.status(),
    getHeadSha(repoPath),
  ]);

  return {
    currentBranch: branchSummary.current,
    branches: branchSummary.all.filter((b) => !b.startsWith("remotes/")),
    isClean: status.isClean(),
    headSha,
  };
}

/**
 * Check if a path is inside a git repository.
 */
export async function isGitRepo(repoPath: string): Promise<boolean> {
  const git = getGit(repoPath);
  try {
    await git.revparse(["--is-inside-work-tree"]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get diff stats (files changed, insertions, deletions) between base and head.
 */
export async function getDiffStats(
  repoPath: string,
  base: string,
  head?: string,
): Promise<{ filesChanged: number; additions: number; deletions: number }> {
  const git = getGit(repoPath);
  const result = await git.diffSummary([head ? `${base}...${head}` : base]);

  return {
    filesChanged: result.changed,
    additions: result.insertions,
    deletions: result.deletions,
  };
}
