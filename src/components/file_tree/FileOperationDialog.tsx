/**
 * 模块职责：文件操作弹窗，替代 window.prompt/confirm。
 * 支持：新建文件、新建文件夹、重命名、删除确认。
 */
import { useState, useEffect, useCallback } from "react";
import { AppDialog } from "../common/AppDialog";

export type FileOperationType = "create-file" | "create-folder" | "rename" | "delete";

export interface FileOperationState {
  type: FileOperationType;
  targetPath: string;
  isDir: boolean;
  oldName?: string;
}

export interface FileOperationDialogProps {
  operation: FileOperationState | null;
  onConfirm: (type: FileOperationType, targetPath: string, newName: string) => void;
  onCancel: () => void;
}

const ILLEGAL_CHARS = /[\\/:*?"<>|]/;

function validateName(name: string, type: FileOperationType): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "名称不能为空";
  if (ILLEGAL_CHARS.test(trimmed)) return "名称包含非法字符 \\ / : * ? \" < > |";
  if (type === "create-folder") {
    if (trimmed.endsWith(".assets")) return "不允许创建 .assets 目录";
    if (["node_modules", ".git", "target", "dist", "build", ".next", "out"].includes(trimmed.toLowerCase())) {
      return "不允许使用保留目录名";
    }
  }
  if (type === "create-file" || type === "rename") {
    const ext = trimmed.split(".").pop()?.toLowerCase();
    if (ext && ext !== "md" && ext !== "markdown") {
      return "Markdown 文件必须使用 .md 或 .markdown 扩展名";
    }
  }
  return null;
}

export function FileOperationDialog({
  operation,
  onConfirm,
  onCancel,
}: FileOperationDialogProps) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  // operation 变化时重置
  useEffect(() => {
    if (operation) {
      setValue(operation.oldName ?? "");
      setError(null);
    }
  }, [operation]);

  if (!operation) return null;

  const isDelete = operation.type === "delete";

  const handleConfirm = useCallback(() => {
    if (isDelete) {
      onConfirm("delete", operation.targetPath, "");
      return;
    }

    let finalName = value.trim();
    if (!finalName) { setError("名称不能为空"); return; }

    if (operation.type === "create-file" && !finalName.endsWith(".md") && !finalName.endsWith(".markdown")) {
      finalName = finalName + ".md";
    }

    const err = validateName(finalName, operation.type);
    if (err) { setError(err); return; }

    onConfirm(operation.type, operation.targetPath, finalName);
  }, [value, isDelete, operation, onConfirm]);

  const titleMap: Record<FileOperationType, string> = {
    "create-file": "新建 Markdown 文件",
    "create-folder": "新建文件夹",
    rename: "重命名",
    delete: "确认删除",
  };

  const confirmMap: Record<FileOperationType, string> = {
    "create-file": "创建",
    "create-folder": "创建",
    rename: "重命名",
    delete: "删除",
  };

  return (
    <AppDialog
      open={true}
      title={titleMap[operation.type]}
      message={
        isDelete
          ? `确定删除「${operation.targetPath.split(/[\\/]/).pop()}」吗？此操作不可撤销。`
          : undefined
      }
      confirmLabel={confirmMap[operation.type]}
      danger={isDelete}
      closeOnOverlay={!isDelete}
      onConfirm={handleConfirm}
      onCancel={onCancel}
    >
      {!isDelete && (
        <div className="app-dialog__input-wrap">
          <input
            className={`app-dialog__input ${error ? "app-dialog__input--error" : ""}`}
            type="text"
            value={value}
            placeholder={
              operation.type === "create-file" ? "文件名（自动添加 .md）"
              : operation.type === "create-folder" ? "文件夹名"
              : "新名称"
            }
            onChange={(e) => { setValue(e.target.value); setError(null); }}
          />
          {error && <p className="app-dialog__error">{error}</p>}
        </div>
      )}
    </AppDialog>
  );
}
