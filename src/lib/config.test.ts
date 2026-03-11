import { afterEach, describe, expect, test, vi } from "vitest";
import { getRepoPath, setRepoPath } from "./config";

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function createStorage(
  initialEntries: Record<string, string> = {},
): StorageLike & { snapshot(): Record<string, string> } {
  const store = new Map(Object.entries(initialEntries));

  return {
    getItem(key) {
      return store.get(key) ?? null;
    },
    setItem(key, value) {
      store.set(key, value);
    },
    removeItem(key) {
      store.delete(key);
    },
    snapshot() {
      return Object.fromEntries(store.entries());
    },
  };
}

describe("config repo path helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("falls back to the current working directory on the server", () => {
    expect(getRepoPath()).toBe(process.cwd());
  });

  test("prefers the current localStorage key over the legacy one", () => {
    const storage = createStorage({
      "step-zero-repo-path": "/repos/current",
      "itl-repo-path": "/repos/legacy",
    });

    vi.stubGlobal("window", {});
    vi.stubGlobal("localStorage", storage);

    expect(getRepoPath()).toBe("/repos/current");
  });

  test("writes the current key and removes the legacy key", () => {
    const storage = createStorage({
      "itl-repo-path": "/repos/legacy",
    });

    vi.stubGlobal("window", {});
    vi.stubGlobal("localStorage", storage);

    setRepoPath("/repos/next");

    expect(storage.snapshot()).toEqual({
      "step-zero-repo-path": "/repos/next",
    });
  });
});
