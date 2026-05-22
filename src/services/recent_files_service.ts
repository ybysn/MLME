/**
 * 模块职责：最近文件列表持久化服务（MVP 阶段使用 localStorage）。
 * 输入：文件路径、文件名。
 * 输出：有序最近文件列表，最多 10 条，自动去重。
 * 风险点：localStorage 容量 5MB，清除浏览器数据会丢失列表。
 * 后续扩展点：迁入 SQLite、文件存在性校验、跨设备同步。
 */

export interface RecentFileItem {
  path: string;
  fileName: string;
  lastOpenedAt: string;
}

const STORAGE_KEY = "markdown-editor:recent-files";
const MAX_ITEMS = 10;

/** 从 localStorage 加载最近文件列表 */
export function loadRecentFiles(): RecentFileItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentFileItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item) =>
        typeof item.path === "string" &&
        typeof item.fileName === "string" &&
        item.path.length > 0,
    );
  } catch {
    return [];
  }
}

/** 持久化最近文件列表到 localStorage */
function saveRecentFiles(items: RecentFileItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // localStorage 满时不阻塞用户操作
  }
}

/**
 * 将文件路径加入最近文件列表首位。
 * 自动去重：如果 path 已存在，移到首位并更新 lastOpenedAt。
 * 超出 MAX_ITEMS 时移除最旧的条目。
 */
export function addRecentFile(
  existing: RecentFileItem[],
  path: string,
  fileName: string,
): RecentFileItem[] {
  const now = new Date().toISOString();
  const filtered = existing.filter((item) => item.path !== path);
  const updated: RecentFileItem[] = [
    { path, fileName, lastOpenedAt: now },
    ...filtered,
  ];
  if (updated.length > MAX_ITEMS) {
    updated.length = MAX_ITEMS;
  }
  saveRecentFiles(updated);
  return updated;
}

/**
 * 从最近文件列表中移除指定路径。
 */
export function removeRecentFile(
  existing: RecentFileItem[],
  path: string,
): RecentFileItem[] {
  const updated = existing.filter((item) => item.path !== path);
  saveRecentFiles(updated);
  return updated;
}
