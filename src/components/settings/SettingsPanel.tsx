/**
 * 模块职责：设置面板弹窗，统一管理编辑器偏好设置。
 * 当前输入：settings（当前设置）、onSave（保存回调）、onCancel（取消回调）。
 * 当前输出：表单输入区 + 保存/重置/取消按钮。
 */
import { useState, useEffect } from "react";
import type { AppSettings } from "../../services/settings_service";
import { DEFAULT_SETTINGS } from "../../services/settings_service";
import { createLogger } from "../../services/logger";

const logger = createLogger("SettingsPanel");

export interface SettingsPanelProps {
  open: boolean;
  settings: AppSettings;
  onSave: (settings: AppSettings) => void;
  onCancel: () => void;
}

export function SettingsPanel({ open, settings, onSave, onCancel }: SettingsPanelProps) {
  const [form, setForm] = useState<AppSettings>(settings);

  // open 时同步最新 props.settings 到 form
  useEffect(() => {
    if (open) {
      logger.debug("syncing form from props.settings", { propsSettings: settings, currentForm: form });
      setForm(settings);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  logger.debug("render", { open, propsSettings: settings, formState: form });

  if (!open) return null;

  function set<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    setForm((prev) => {
      const oldValue = prev[key];
      logger.debug("field changed", { field: key, oldValue, newValue: value });
      return { ...prev, [key]: value };
    });
  }

  return (
    <div className="settings-overlay" onClick={onCancel}>
      <div className="settings-dialog" onClick={(e) => e.stopPropagation()}>
        <h2 className="settings-dialog__title">设置</h2>

        <div className="settings-dialog__body">
          <label className="settings-field">
            <span className="settings-field__label">自动保存</span>
            <input
              type="checkbox"
              checked={form.autoSaveEnabled}
              onChange={(e) => set("autoSaveEnabled", e.target.checked)}
            />
          </label>

          {form.autoSaveEnabled && (
            <label className="settings-field">
              <span className="settings-field__label">自动保存延迟 (ms)</span>
              <input
                type="number" className="settings-field__input"
                min={500} max={30000} step={500}
                value={form.autoSaveDelayMs}
                onChange={(e) => set("autoSaveDelayMs", Number(e.target.value) || 2000)}
              />
            </label>
          )}

          <label className="settings-field">
            <span className="settings-field__label">主题</span>
            <select className="settings-field__input" value={form.theme}
              onChange={(e) => set("theme", e.target.value as "light" | "dark")}>
              <option value="light">浅色</option>
              <option value="dark">深色</option>
            </select>
          </label>

          <label className="settings-field">
            <span className="settings-field__label">编辑器字号</span>
            <input type="number" className="settings-field__input" min={10} max={32}
              value={form.editorFontSize}
              onChange={(e) => set("editorFontSize", Number(e.target.value) || 16)} />
          </label>

          <label className="settings-field">
            <span className="settings-field__label">编辑器字体</span>
            <input type="text" className="settings-field__input"
              value={form.editorFontFamily}
              onChange={(e) => set("editorFontFamily", e.target.value)} />
          </label>

          <label className="settings-field">
            <span className="settings-field__label">默认打开模式</span>
            <select className="settings-field__input" value={form.defaultViewMode}
              onChange={(e) => set("defaultViewMode", e.target.value as "edit" | "preview" | "split")}>
              <option value="edit">编辑</option>
              <option value="preview">预览</option>
              <option value="split">分屏</option>
            </select>
          </label>

          <label className="settings-field">
            <span className="settings-field__label">启动时默认显示侧边栏</span>
            <input type="checkbox" checked={form.sidebarVisibleByDefault}
              onChange={(e) => set("sidebarVisibleByDefault", e.target.checked)} />
          </label>
        </div>

        <div className="settings-dialog__actions">
          <button className="settings-dialog__btn settings-dialog__btn--secondary"
            onClick={() => {
              logger.debug("reset clicked");
              onSave({ ...DEFAULT_SETTINGS });
            }}>
            重置默认
          </button>
          <span className="settings-dialog__spacer" />
          <button className="settings-dialog__btn" onClick={() => {
            logger.debug("cancel");
            onCancel();
          }}>
            取消
          </button>
          <button className="settings-dialog__btn settings-dialog__btn--primary"
            onClick={() => {
              logger.debug("save clicked", { form });
              onSave(form);
            }}>
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
