import { afterEach, describe, expect, test, vi } from "vitest";
import { timeAgo } from "./utils";

describe("timeAgo", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test("returns fallback strings for invalid dates", () => {
    expect(timeAgo("not-a-date")).toBe("unknown");
    expect(timeAgo("not-a-date", true)).toBe("—");
  });

  test("formats recent timestamps in verbose and short forms", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-11T10:00:00.000Z"));

    expect(timeAgo("2026-03-11T09:59:31.000Z")).toBe("just now");
    expect(timeAgo("2026-03-11T09:55:00.000Z")).toBe("5m ago");
    expect(timeAgo("2026-03-11T08:00:00.000Z")).toBe("2h ago");
    expect(timeAgo("2026-03-08T10:00:00.000Z")).toBe("3d ago");
    expect(timeAgo("2026-03-11T09:55:00.000Z", true)).toBe("5m");
    expect(timeAgo("2026-03-11T10:01:00.000Z", true)).toBe("now");
  });
});
