/**
 * 模块职责：编辑区顶部工具栏，承载格式按钮、字体/字号、插入/视图/导出菜单。
 * 当前输入：通过 EditorToolbarProps 接收所有状态和回调。
 * 当前输出：纯渲染组件，菜单状态在组件内部管理。
 */
import { useState, useRef, useEffect } from "react";
import type { ViewMode } from "./EditorPanel";
import type { TyporaEditorPanelHandle } from "./TyporaEditorPanel";
import {
  toggleBold,
  toggleItalic,
  toggleInlineCode,
  toggleBlockquote,
  toggleUnorderedList,
  toggleOrderedList,
  insertCodeBlock,
  insertLink,
  setHeadingLevel,
  type EditCommandResult,
} from "../../editor/markdown/edit_commands";

export interface EditorToolbarProps {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  isFocusMode: boolean;
  isFullscreen: boolean;
  editorFontSize: number;
  editorFontFamily: string;
  typoraEditorRef: React.RefObject<TyporaEditorPanelHandle | null>;
  onToggleSidebar: () => void;
  onToggleFocus?: () => void;
  onToggleFullscreen?: () => void;
  onOpenSettings: () => void;
  onUpdateSettings: (partial: { editorFontSize?: number; editorFontFamily?: string; theme?: "light" | "dark" }) => void;
  onExportHtml: () => void;
  onExportPdf: () => void;
  onPrint: () => void;
  applyCommand: (cmd: (content: string, start: number, end: number, ...args: any[]) => EditCommandResult, ...args: any[]) => void;
  onImageButtonClick: () => void;
  currentTheme?: string;
  selectedHeadingLevel?: number;
  onHeadingChange?: (level: number) => void;
}

const FONT_OPTIONS: { label: string; value: string }[] = [
  { label: "系统默认", value: "Consolas, 'Microsoft YaHei', monospace" },
  { label: "Consolas", value: "Consolas, monospace" },
  { label: "微软雅黑 (Microsoft YaHei)", value: "'Microsoft YaHei', '微软雅黑', sans-serif" },
  { label: "宋体", value: "宋体, SimSun, serif" },
  { label: "黑体", value: "黑体, SimHei, sans-serif" },
  { label: "楷体", value: "楷体, KaiTi, serif" },
  { label: "仿宋", value: "仿宋, FangSong, serif" },
  { label: "等线", value: "等线, 'DengXian', sans-serif" },
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Times New Roman", value: "'Times New Roman', serif" },
  { label: "Courier New", value: "'Courier New', monospace" },
  { label: "Monaco", value: "Monaco, monospace" },
  { label: "Menlo", value: "Menlo, monospace" },
  { label: "JetBrains Mono", value: "'JetBrains Mono', monospace" },
];

const FONT_SIZE_OPTIONS = [12, 13, 14, 15, 16, 18, 20, 22, 24, 26, 28, 32, 36];

const HEADING_OPTIONS: { label: string; level: number }[] = [
  { label: "段落", level: 0 },
  { label: "H1", level: 1 },
  { label: "H2", level: 2 },
  { label: "H3", level: 3 },
  { label: "H4", level: 4 },
  { label: "H5", level: 5 },
];

export function EditorToolbar({
  viewMode,
  setViewMode,
  isFocusMode,
  isFullscreen,
  editorFontSize,
  editorFontFamily,
  typoraEditorRef,
  onToggleSidebar,
  onToggleFocus,
  onToggleFullscreen,
  onOpenSettings,
  onUpdateSettings,
  onExportHtml,
  onExportPdf,
  onPrint,
  applyCommand,
  onImageButtonClick,
  currentTheme = "light",
  selectedHeadingLevel = 0,
  onHeadingChange,
}: EditorToolbarProps) {
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const [insertMenuOpen, setInsertMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const viewMenuRef = useRef<HTMLDivElement>(null);
  const insertMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!exportMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setExportMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [exportMenuOpen]);

  useEffect(() => {
    if (!viewMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (viewMenuRef.current && !viewMenuRef.current.contains(e.target as Node)) {
        setViewMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [viewMenuOpen]);

  useEffect(() => {
    if (!insertMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (insertMenuRef.current && !insertMenuRef.current.contains(e.target as Node)) {
        setInsertMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [insertMenuOpen]);

  return (
    <div className="editor-toolbar">
      <button className="editor-toolbar__btn" title="切换侧边栏 (Ctrl+\)" onClick={onToggleSidebar}>&#9776;</button>
      <span className="editor-toolbar__sep" />
      <select className="editor-toolbar__select editor-toolbar__select--heading" title="标题级别" value={selectedHeadingLevel} onChange={(e) => {
        const level = Number(e.target.value);
        if (viewMode === "wysiwyg") {
          typoraEditorRef.current?.setHeadingLevel(level);
        } else {
          applyCommand(setHeadingLevel, level);
        }
        onHeadingChange?.(level);
      }}>
        {HEADING_OPTIONS.map((opt) => (<option key={opt.level} value={opt.level}>{opt.label}</option>))}
      </select>
      <span className="editor-toolbar__sep" />
      {viewMode !== "wysiwyg" && (
        <>
          <button className="editor-toolbar__btn" title="加粗 (Ctrl+B)" onClick={() => applyCommand(toggleBold)}><strong>B</strong></button>
          <button className="editor-toolbar__btn" title="斜体 (Ctrl+I)" onClick={() => applyCommand(toggleItalic)}><em>I</em></button>
          <button className="editor-toolbar__btn" title="行内代码 (Ctrl+E)" onClick={() => applyCommand(toggleInlineCode)}>{"</>"}</button>
          <span className="editor-toolbar__sep" />
          <button className="editor-toolbar__btn" title="引用" onClick={() => applyCommand(toggleBlockquote)}>&ldquo;</button>
          <button className="editor-toolbar__btn" title="无序列表" onClick={() => applyCommand(toggleUnorderedList)}>&bull;</button>
          <button className="editor-toolbar__btn" title="有序列表" onClick={() => applyCommand(toggleOrderedList)}>1.</button>
          <span className="editor-toolbar__sep" />
          <button className="editor-toolbar__btn" title="代码块" onClick={() => applyCommand(insertCodeBlock)}>{"{ }"}</button>
          <button className="editor-toolbar__btn" title="链接" onClick={() => applyCommand(insertLink)}>&#128279;</button>
        </>
      )}

      <span className="editor-toolbar__spacer" />

      <select
        className="editor-toolbar__select editor-toolbar__select--font"
        title="字体"
        value={editorFontFamily}
        onChange={(e) => onUpdateSettings({ editorFontFamily: e.target.value })}
      >
        {FONT_OPTIONS.map((f) => (
          <option key={f.value} value={f.value}>
            {f.label}
          </option>
        ))}
      </select>

      <select
        className="editor-toolbar__select editor-toolbar__select--size"
        title="字号"
        value={editorFontSize}
        onChange={(e) => onUpdateSettings({ editorFontSize: Number(e.target.value) })}
      >
        {FONT_SIZE_OPTIONS.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

      {/* 插入菜单 */}
      <span className="editor-toolbar__sep" />
      <div className="editor-insert-menu" ref={insertMenuRef}>
        <button
          className="editor-toolbar__btn"
          title="插入"
          onClick={() => setInsertMenuOpen((p) => !p)}
        >
          插入 &#9660;
        </button>
        {insertMenuOpen && (
          <div className="editor-insert-menu__dropdown">
            <button
              className="editor-insert-menu__item"
              onClick={() => { onImageButtonClick(); setInsertMenuOpen(false); }}
            >
              <span>图片</span>
            </button>
          </div>
        )}
      </div>

      {/* 视图菜单 */}
      <span className="editor-toolbar__sep" />
      <div className="editor-view-menu" ref={viewMenuRef}>
        <button
          className="editor-toolbar__btn"
          title="视图"
          onClick={() => setViewMenuOpen((p) => !p)}
        >
          视图 &#9660;
        </button>
        {viewMenuOpen && (
          <div className="editor-view-menu__dropdown">
            <button
              className={`editor-view-menu__item ${viewMode === "wysiwyg" ? "editor-view-menu__item--active" : ""}`}
              onClick={() => { setViewMode("wysiwyg"); setViewMenuOpen(false); }}
            >
              <span>写作模式</span>
              <span className="editor-view-menu__shortcut">Ctrl+Alt+1</span>
            </button>
            <button
              className={`editor-view-menu__item ${viewMode === "split" ? "editor-view-menu__item--active" : ""}`}
              onClick={() => { setViewMode("split"); setViewMenuOpen(false); }}
            >
              <span>分屏</span>
              <span className="editor-view-menu__shortcut">Ctrl+Alt+2</span>
            </button>
            <button
              className={`editor-view-menu__item ${viewMode === "source" ? "editor-view-menu__item--active" : ""}`}
              onClick={() => { setViewMode("source"); setViewMenuOpen(false); }}
            >
              <span>源码视图</span>
              <span className="editor-view-menu__shortcut">Ctrl+Alt+3</span>
            </button>
            <div className="editor-view-menu__sep" />
            {onToggleFocus && (
              <button
                className={`editor-view-menu__item ${isFocusMode ? "editor-view-menu__item--active" : ""}`}
                onClick={() => { onToggleFocus(); setViewMenuOpen(false); }}
              >
                <span>专注模式</span>
                <span className="editor-view-menu__shortcut">Ctrl+Alt+F</span>
              </button>
            )}
            {onToggleFullscreen && (
              <button
                className={`editor-view-menu__item ${isFullscreen ? "editor-view-menu__item--active" : ""}`}
                onClick={() => { onToggleFullscreen(); setViewMenuOpen(false); }}
              >
                <span>全屏</span>
                <span className="editor-view-menu__shortcut">F11</span>
              </button>
            )}
            <div className="editor-view-menu__sep" />
            <button
              className={`editor-view-menu__item ${currentTheme === "light" ? "editor-view-menu__item--active" : ""}`}
              onClick={() => { onUpdateSettings({ theme: "light" }); setViewMenuOpen(false); }}
            >
              <span>浅色模式</span>
            </button>
            <button
              className={`editor-view-menu__item ${currentTheme === "dark" ? "editor-view-menu__item--active" : ""}`}
              onClick={() => { onUpdateSettings({ theme: "dark" }); setViewMenuOpen(false); }}
            >
              <span>深色模式</span>
            </button>
          </div>
        )}
      </div>

      {/* 导出菜单 */}
      <span className="editor-toolbar__sep" />
      <div className="editor-export-menu" ref={exportMenuRef}>
        <button
          className="editor-toolbar__btn"
          title="导出"
          onClick={() => setExportMenuOpen((p) => !p)}
        >
          导出 &#9660;
        </button>
        {exportMenuOpen && (
          <div className="editor-export-menu__dropdown">
            <button
              className="editor-export-menu__item"
              onClick={() => { setExportMenuOpen(false); onExportHtml(); }}
            >
              导出 HTML
            </button>
            <button
              className="editor-export-menu__item"
              onClick={() => { setExportMenuOpen(false); onExportPdf(); }}
            >
              导出 PDF
            </button>
            <button
              className="editor-export-menu__item"
              onClick={() => { setExportMenuOpen(false); onPrint(); }}
            >
              打印
            </button>
          </div>
        )}
      </div>

      <button
        className="editor-toolbar__btn"
        title="设置"
        onClick={onOpenSettings}
      >
        &#9881;
      </button>
    </div>
  );
}
