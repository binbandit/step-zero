/**
 * Get the repo path from URL search params or fallback to a default.
 * In the browser context, we read from localStorage or use a configured default.
 */
export function getRepoPath(): string {
  if (typeof window !== "undefined") {
    return (
      localStorage.getItem("step-zero-repo-path") ||
      localStorage.getItem("itl-repo-path") ||
      ""
    );
  }
  return process.cwd();
}

export function setRepoPath(path: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("step-zero-repo-path", path);
    localStorage.removeItem("itl-repo-path");
  }
}
