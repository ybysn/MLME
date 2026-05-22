/**
 * 模块职责：应用设置持久化服务（MVP 阶段使用 localStorage）。
 * 当前支持：自动保存开关和延迟时间。
 * 后续扩展点：主题、字体、导出样式等设置。
 */

const STORAGE_KEY = "markdown-editor:settings";

export interface AppSettings {
  autoSaveEnabled: boolean;
  autoSaveDelayMs: number;
}

function loadAll(): Partial<AppSettings> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveAll(settings: Partial<AppSettings>): void {
  try {
    const current = loadAll();
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...current, ...settings }),
    );
  } catch { /* ignore */ }
}

export function getAutoSaveEnabled(): boolean {
  return loadAll().autoSaveEnabled ?? true;
}

export function setAutoSaveEnabled(enabled: boolean): void {
  saveAll({ autoSaveEnabled: enabled });
}

export function getAutoSaveDelayMs(): number {
  return loadAll().autoSaveDelayMs ?? 2000;
}

export function setAutoSaveDelayMs(delayMs: number): void {
  saveAll({ autoSaveDelayMs: delayMs });
}
