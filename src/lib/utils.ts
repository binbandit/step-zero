import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Human-friendly relative time string.
 * @param dateStr - ISO date string
 * @param short - When true, returns compact form ("now", "5m", "2h", "3d").
 *                When false (default), returns verbose form ("just now", "5m ago", "2h ago", "3d ago").
 */
export function timeAgo(dateStr: string, short = false): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  if (Number.isNaN(then)) return short ? "—" : "unknown";
  const diff = Math.floor((now - then) / 1000);

  if (diff < 0) return short ? "now" : "just now";
  if (diff < 60) return short ? "now" : "just now";
  if (diff < 3600) {
    const m = Math.floor(diff / 60);
    return short ? `${m}m` : `${m}m ago`;
  }
  if (diff < 86400) {
    const h = Math.floor(diff / 3600);
    return short ? `${h}h` : `${h}h ago`;
  }
  const d = Math.floor(diff / 86400);
  return short ? `${d}d` : `${d}d ago`;
}
