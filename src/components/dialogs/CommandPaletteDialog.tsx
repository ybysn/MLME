/**
 * 模块职责：命令面板弹窗，搜索并执行应用命令。
 * 输入：commands、onClose。
 * 输出：搜索过滤 + 键盘选择 + Enter 执行。
 * 风险点：不直接调用 AppShell handler / file_service / Tauri invoke。
 */
import { useState, useRef, useEffect, useCallback, useMemo } from "react";

export interface CommandItem {
  id: string;
  title: string;
  description?: string;
  keywords?: string[];
  shortcut?: string;
  disabled?: boolean;
}

export interface CommandPaletteDialogProps {
  open: boolean;
  commands: CommandItem[];
  onClose: () => void;
  onExecute: (commandId: string) => void;
}

export function CommandPaletteDialog({
  open,
  commands,
  onClose,
  onExecute,
}: CommandPaletteDialogProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        (c.description ?? "").toLowerCase().includes(q) ||
        (c.shortcut ?? "").toLowerCase().includes(q) ||
        (c.keywords ?? []).some((kw) => kw.toLowerCase().includes(q)),
    );
  }, [commands, query]);

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
        if (item && !item.disabled) {
          onClose();
          onExecute(item.id);
        }
        return;
      }
    },
    [onClose, filtered, safeIndex],
  );

  useEffect(() => {
    if (!open) return;
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div className="command-palette-overlay" onClick={onClose}>
      <div className="command-palette" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="command-palette__input"
          type="text"
          placeholder="搜索命令..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIndex(0);
          }}
        />

        {filtered.length === 0 ? (
          <div className="command-palette__empty">没有匹配的命令</div>
        ) : (
          <div className="command-palette__list">
            {filtered.map((c, i) => {
              const isActive = i === safeIndex;
              let cls = "command-palette__item";
              if (isActive) cls += " command-palette__item--active";
              if (c.disabled) cls += " command-palette__item--disabled";

              return (
                <div
                  key={c.id}
                  className={cls}
                  onClick={() => {
                    if (!c.disabled) {
                      onClose();
                      onExecute(c.id);
                    }
                  }}
                  onMouseEnter={() => setActiveIndex(i)}
                >
                  <div className="command-palette__item-body">
                    <span className="command-palette__item-title">{c.title}</span>
                    {c.description && (
                      <span className="command-palette__item-desc">{c.description}</span>
                    )}
                  </div>
                  {c.shortcut && (
                    <span className="command-palette__item-shortcut">{c.shortcut}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
