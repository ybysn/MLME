/**
 * 模块职责：最近工作区列表持久化服务（MVP 阶段使用 localStorage）。
 * 输入：工作区路径。
 * 输出：有序最近工作区列表，最多 5 个，自动去重。
 * 后续扩展点：迁入 SQLite。
 */

export interface RecentWorkspaceItem {
  path: string;
  name: string;
  lastOpenedAt: string;
}

const STORAGE_KEY = "markdown-editor:recent-workspaces";
const MAX_ITEMS = 5;

function extractName(fullPath: string): string {
  const trimmed = fullPath.replace(/[\\/]$/, "");
  return trimmed.split(/[\\/]/).pop() ?? fullPath;
}

export function loadRecentWorkspaces(): RecentWorkspaceItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item: unknown) =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as RecentWorkspaceItem).path === "string",
    );
  } catch {
    return [];
  }
}

function saveRecentWorkspaces(items: RecentWorkspaceItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch { /* ignore */ }
}

export function addRecentWorkspace(
  existing: RecentWorkspaceItem[],
  path: string,
): RecentWorkspaceItem[] {
  const now = new Date().toISOString();
  const name = extractName(path);
  const filtered = existing.filter((item) => item.path !== path);
  const updated: RecentWorkspaceItem[] = [
    { path, name, lastOpenedAt: now },
    ...filtered,
  ];
  if (updated.length > MAX_ITEMS) {
    updated.length = MAX_ITEMS;
  }
  saveRecentWorkspaces(updated);
  return updated;
}

export function removeRecentWorkspace(
  existing: RecentWorkspaceItem[],
  path: string,
): RecentWorkspaceItem[] {
  const updated = existing.filter((item) => item.path !== path);
  saveRecentWorkspaces(updated);
  return updated;
}
