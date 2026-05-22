/**
 * 模块职责：通用弹窗组件，支持标题、描述、输入框、确认/取消按钮。
 * 当前输入：open、title、confirmLabel、onConfirm、onCancel 等。
 * 当前输出：遮罩 + 居中弹窗。
 */
import { useEffect, useRef, useCallback, type ReactNode } from "react";

export interface AppDialogProps {
  open: boolean;
  title: string;
  message?: string;
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  closeOnOverlay?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function AppDialog({
  open,
  title,
  message,
  children,
  confirmLabel = "确定",
  cancelLabel = "取消",
  danger = false,
  closeOnOverlay = true,
  onConfirm,
  onCancel,
}: AppDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter") onConfirm();
    },
    [onCancel, onConfirm],
  );

  useEffect(() => {
    if (!open) return;
    window.addEventListener("keydown", handleKeyDown);
    const timer = setTimeout(() => inputRef.current?.focus(), 50);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      clearTimeout(timer);
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div
      className="app-dialog-overlay"
      onClick={() => { if (closeOnOverlay) onCancel(); }}
    >
      <div className="app-dialog" onClick={(e) => e.stopPropagation()}>
        <h3 className="app-dialog__title">{title}</h3>
        {message && <p className="app-dialog__message">{message}</p>}
        {children}
        <div className="app-dialog__actions">
          <button className="app-dialog__btn" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            className={`app-dialog__btn ${danger ? "app-dialog__btn--danger" : "app-dialog__btn--primary"}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
