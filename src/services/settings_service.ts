/**
 * 模块职责：应用设置持久化服务（MVP 阶段使用 localStorage）。
 */
import { createLogger } from "./logger";

const logger = createLogger("SettingsService");
const STORAGE_KEY = "markdown-editor:settings";

export interface AppSettings {
  autoSaveEnabled: boolean;
  autoSaveDelayMs: number;
  theme: "light" | "dark";
  editorFontSize: number;
  editorFontFamily: string;
  defaultViewMode: "edit" | "preview" | "split";
  sidebarVisibleByDefault: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  autoSaveEnabled: false,
  autoSaveDelayMs: 2000,
  theme: "light",
  editorFontSize: 16,
  editorFontFamily: "Consolas, 'Microsoft YaHei', monospace",
  defaultViewMode: "edit",
  sidebarVisibleByDefault: true,
};

function loadRaw(): Partial<AppSettings> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    logger.debug("loadRaw", { raw });
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    logger.debug("loadRaw parsed", parsed);
    return parsed;
  } catch (err) {
    logger.warn("loadRaw parse failed, using defaults", { err });
    return {};
  }
}

export function getSettings(): AppSettings {
  const raw = loadRaw();
  const merged = { ...DEFAULT_SETTINGS, ...raw };
  logger.debug("getSettings", { raw, merged });
  return merged;
}

export function saveSettings(settings: AppSettings): void {
  logger.debug("saveSettings", settings);
  try {
    const json = JSON.stringify(settings);
    localStorage.setItem(STORAGE_KEY, json);
    logger.debug("saveSettings written", { json });
  } catch (err) {
    logger.error("saveSettings failed", { err });
  }
}

export function resetSettings(): AppSettings {
  logger.debug("resetSettings");
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch { /* ignore */ }
  const defaults = { ...DEFAULT_SETTINGS };
  logger.debug("resetSettings defaults", defaults);
  return defaults;
}

export function updateSettings(partial: Partial<AppSettings>): AppSettings {
  const before = getSettings();
  logger.debug("updateSettings before", { partial, before });
  const merged = { ...before, ...partial };
  saveSettings(merged);
  const after = getSettings();
  logger.debug("updateSettings after", after);
  return merged;
}
