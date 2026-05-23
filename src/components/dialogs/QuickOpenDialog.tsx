/**
 * 模块职责：快速打开弹窗，搜索最近文件和工作区文件并打开。
 * 输入：recentFiles、workspaceFiles、currentPath、onOpenFile、onClose。
 * 输出：搜索过滤 + 分组显示 + 键盘选择 + 鼠标点击。
 * 风险点：不直接调用 Tauri / file_service，打开文件由父组件处理。
 */
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import type { RecentFileItem } from "../../services/recent_files_service";

interface QuickOpenItem {
  path: string;
  fileName: string;
  source: "recent" | "workspace";
}

export interface QuickOpenDialogProps {
  open: boolean;
  recentFiles: RecentFileItem[];
  workspaceFiles?: { path: string; fileName: string }[];
  currentPath: string | null;
  onOpenFile: (path: string) => void;
  onClose: () => void;
}

export function QuickOpenDialog({
  open,
  recentFiles,
  workspaceFiles,
  currentPath,
  onOpenFile,
  onClose,
}: QuickOpenDialogProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const hasWorkspace = workspaceFiles && workspaceFiles.length > 0;

  // 合并为统一列表，recent 优先去重
  const mergedItems = useMemo(() => {
    const seen = new Set<string>();
    const items: QuickOpenItem[] = [];

    for (const f of recentFiles) {
      if (!seen.has(f.path) && !f.stale) {
        seen.add(f.path);
        items.push({ path: f.path, fileName: f.fileName, source: "recent" });
      }
    }

    if (workspaceFiles) {
      for (const f of workspaceFiles) {
        if (!seen.has(f.path)) {
          seen.add(f.path);
          items.push({ path: f.path, fileName: f.fileName, source: "workspace" });
        }
      }
    }

    return items;
  }, [recentFiles, workspaceFiles]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return mergedItems;
    return mergedItems.filter(
      (f) =>
        f.fileName.toLowerCase().includes(q) ||
        f.path.toLowerCase().includes(q),
    );
  }, [mergedItems, query]);

  // 打开时重置状态
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const safeIndex = Math.max(0, Math.min(activeIndex, filtered.length - 1));

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((prev) =>
          filtered.length === 0 ? 0 : Math.min(prev + 1, filtered.length - 1),
        );
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((prev) => (filtered.length === 0 ? 0 : Math.max(prev - 1, 0)));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const item = filtered[safeIndex];
        if (item) onOpenFile(item.path);
        return;
      }
    },
    [onClose, filtered, safeIndex, onOpenFile],
  );

  useEffect(() => {
    if (!open) return;
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, handleKeyDown]);

  if (!open) return null;

  const hasAnyFiles = mergedItems.length > 0;

  return (
    <div className="quick-open-overlay" onClick={onClose}>
      <div className="quick-open" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="quick-open__input"
          type="text"
          placeholder={hasWorkspace ? "搜索最近文件和工作区..." : "搜索最近文件..."}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIndex(0);
          }}
        />

        {!hasAnyFiles ? (
          <div className="quick-open__empty">暂无可快速打开的文件</div>
        ) : filtered.length === 0 ? (
          <div className="quick-open__empty">没有匹配的文件</div>
        ) : (
          <div className="quick-open__list">
            {filtered.map((f, i) => {
              // 分组标题：source 变化时插入
              const prevSource = i > 0 ? filtered[i - 1].source : null;
              const showHeader = f.source !== prevSource;
              const isCurrent = f.path === currentPath;
              const isActive = i === safeIndex;
              let cls = "quick-open__item";
              if (isActive) cls += " quick-open__item--active";
              if (isCurrent) cls += " quick-open__item--current";

              return (
                <div key={f.source + ":" + f.path}>
                  {showHeader && (
                    <div className="quick-open__group-header">
                      {f.source === "recent" ? "最近文件" : "工作区"}
                    </div>
                  )}
                  <div
                    className={cls}
                    onClick={() => onOpenFile(f.path)}
                    onMouseEnter={() => setActiveIndex(i)}
                  >
                    <span className="quick-open__file-name">
                      {f.fileName}
                      {f.source === "workspace" && (
                        <span className="quick-open__source-badge">工作区</span>
                      )}
                      {isCurrent && (
                        <span className="quick-open__current-tag">当前</span>
                      )}
                    </span>
                    <span className="quick-open__file-path">{f.path}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
