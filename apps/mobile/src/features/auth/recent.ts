import { services } from "@/services";

// Recent workspaces for the picker (design AuthWorkspace "Recent workspaces"). Kept
// in the KV port (non-secret) and appended on each successful sign-in.
const KEY = "kaenal.recent.workspaces";
const MAX = 5;

export interface RecentWorkspace {
  slug: string;
  name: string;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export async function getRecentWorkspaces(): Promise<RecentWorkspace[]> {
  const raw = await services.kv.getItem(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as RecentWorkspace[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Move `ws` to the front of the recents list (dedup by slug), capped at MAX. */
export async function rememberWorkspace(ws: RecentWorkspace): Promise<void> {
  const current = await getRecentWorkspaces();
  const next = [ws, ...current.filter((w) => w.slug !== ws.slug)].slice(0, MAX);
  await services.kv.setItem(KEY, JSON.stringify(next));
}
