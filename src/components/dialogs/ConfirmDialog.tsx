/**
 * 模块职责：未保存变更确认弹窗。
 * 当前输入：isOpen（是否显示）、onClose（关闭回调）、onSaveAndContinue、onDiscardAndContinue。
 * 当前输出：三个按钮的确认对话框。
 */
import { useEffect, useCallback } from "react";

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onSaveAndContinue: () => void;
  onDiscardAndContinue: () => void;
}

export function ConfirmDialog({
  open,
  onClose,
  onSaveAndContinue,
  onDiscardAndContinue,
}: ConfirmDialogProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (open) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div className="confirm-overlay" onClick={onClose}>
      <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <p className="confirm-dialog__message">
          当前文档有未保存修改，是否继续？未保存内容将丢失。
        </p>
        <div className="confirm-dialog__actions">
          <button
            className="confirm-dialog__btn confirm-dialog__btn--primary"
            onClick={onSaveAndContinue}
          >
            保存并继续
          </button>
          <button
            className="confirm-dialog__btn"
            onClick={onDiscardAndContinue}
          >
            不保存继续
          </button>
          <button
            className="confirm-dialog__btn"
            onClick={onClose}
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
}
