/**
 * 模块职责：中间编辑区面板，使用 textarea 作为临时编辑区并显示底部状态栏。
 * 当前输入：文档内容、文件名、脏状态、编辑状态、标题数、内容变更回调、文件操作回调。
 * 当前输出：工具栏（含视图模式切换）+ textarea/MarkdownPreview/分屏、底部状态栏。
 * 后续扩展点：替换 textarea 为 Milkdown 编辑器，接入编辑器文档模型。
 * 公开 ref：scrollToLine(line) 用于大纲跳转。
 */
import {
  forwardRef,
  useRef,
  useState,
  useEffect,
  useImperativeHandle,
  useCallback,
} from "react";
import {
  toggleBold,
  toggleItalic,
  toggleInlineCode,
  toggleBlockquote,
  toggleUnorderedList,
  toggleOrderedList,
  insertCodeBlock,
  insertLink,
  insertImage,
  setHeading,
  type EditCommandResult,
} from "../../editor/markdown/edit_commands";
import { MarkdownPreview } from "./MarkdownPreview";

export type ViewMode = "edit" | "preview" | "split";

export interface EditorPanelProps {
  content: string;
  fileName: string;
  isDirty: boolean;
  isEditing: boolean;
  headingCount: number;
  onContentChange: (content: string) => void;
  onSave: () => void;
  onOpen: () => void;
  onNew: () => void;
  onToggleSidebar: () => void;
}

export interface EditorPanelHandle {
  scrollToLine: (line: number) => void;
}

interface PendingSelection {
  start: number;
  end: number;
}

const VIEW_MODE_OPTIONS: { value: ViewMode; label: string }[] = [
  { value: "edit", label: "编辑" },
  { value: "preview", label: "预览" },
  { value: "split", label: "分屏" },
];

export const EditorPanel = forwardRef<EditorPanelHandle, EditorPanelProps>(
  function EditorPanel(
    {
      content,
      fileName,
      isDirty,
      isEditing,
      headingCount,
      onContentChange,
      onSave,
      onOpen,
      onNew,
      onToggleSidebar,
    },
    ref,
  ) {
    const [viewMode, setViewMode] = useState<ViewMode>("edit");
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const pendingSelectionRef = useRef<PendingSelection | null>(null);

    // 内容变化后恢复光标位置
    useEffect(() => {
      const pending = pendingSelectionRef.current;
      if (!pending) return;

      const textarea = textareaRef.current;
      if (!textarea) return;

      const clampedStart = Math.min(pending.start, content.length);
      const clampedEnd = Math.min(pending.end, content.length);
      textarea.setSelectionRange(clampedStart, clampedEnd);
      textarea.focus();
      pendingSelectionRef.current = null;
    }, [content]);

    useImperativeHandle(ref, () => ({
      scrollToLine(line: number) {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const lines = textarea.value.split("\n");
        const targetLine = Math.min(line - 1, lines.length);
        let offset = 0;
        for (let i = 0; i < targetLine; i++) {
          offset += lines[i].length + 1;
        }

        textarea.focus();
        textarea.setSelectionRange(offset, offset);
      },
    }));

    // ── 编辑命令执行 ──────────────────────────

    const applyCommand = useCallback(
      (cmd: (content: string, start: number, end: number, ...args: any[]) => EditCommandResult, ...args: any[]) => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const result = cmd(textarea.value, textarea.selectionStart, textarea.selectionEnd, ...args);
        pendingSelectionRef.current = { start: result.selectionStart, end: result.selectionEnd };
        onContentChange(result.content);
      },
      [onContentChange],
    );

    // ── 键盘快捷键 ────────────────────────────

    const handleEditKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        const ctrl = e.ctrlKey || e.metaKey;
        if (!ctrl) return;

        switch (e.key.toLowerCase()) {
          case "b":
            e.preventDefault();
            applyCommand(toggleBold);
            break;
          case "i":
            e.preventDefault();
            applyCommand(toggleItalic);
            break;
          case "e":
            e.preventDefault();
            applyCommand(toggleInlineCode);
            break;
          case "s":
            e.preventDefault();
            onSave();
            break;
          case "o":
            e.preventDefault();
            onOpen();
            break;
          case "n":
            e.preventDefault();
            onNew();
            break;
          case "\\":
            e.preventDefault();
            onToggleSidebar();
            break;
        }
      },
      [applyCommand, onSave, onOpen, onNew, onToggleSidebar],
    );
    const handlePreviewKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        const ctrl = e.ctrlKey || e.metaKey;
        if (!ctrl) return;

        switch (e.key.toLowerCase()) {
          case "s":
            e.preventDefault();
            onSave();
            break;
          case "o":
            e.preventDefault();
            onOpen();
            break;
          case "n":
            e.preventDefault();
            onNew();
            break;
          case "\\":
            e.preventDefault();
            onToggleSidebar();
            break;
        }
      },
      [onSave, onOpen, onNew, onToggleSidebar],
    );

    // ── 统计 ────────────────────────────────────

    const charCount = content.length;
    const lineCount = content ? content.split("\n").length : 0;
    const wordMatches =
      content.match(/[\u4e00-\u9fff\uff00-\uffef]|[a-zA-Z0-9]+/g) ?? [];
    const wordCount = wordMatches.length;

    // ── 未编辑态 ────────────────────────────────

    if (!isEditing) {
      return (
        <div className="panel panel--editor">
          <div className="panel__body panel__body--editor">
            <div className="editor-empty-state">
              <span className="editor-empty-state__icon">&#128196;</span>
              <p className="editor-empty-state__text">未打开文件</p>
              <p className="editor-empty-state__hint">
                Ctrl+O 打开 Markdown 文件，或 Ctrl+N 新建文档
              </p>
            </div>
          </div>
          <footer className="status-bar">
            <span className="status-bar__item">就绪</span>
            <span className="status-bar__item status-bar__spacer" />
            <span className="status-bar__item">字数 {charCount}</span>
            <span className="status-bar__item">行 {lineCount}</span>
          </footer>
        </div>
      );
    }

    // 文本编辑区组件
    const textareaElement = (
      <textarea
        ref={textareaRef}
        className={viewMode === "split" ? "editor-textarea editor-textarea--split" : "editor-textarea"}
        value={content}
        onChange={(e) => onContentChange(e.target.value)}
        onKeyDown={handleEditKeyDown}
        placeholder="在此输入 Markdown 内容..."
        spellCheck={false}
      />
    );

    // ── 编辑态 ──────────────────────────────────

    return (
      <div className="panel panel--editor">
        <div className="editor-toolbar">
          <button
            className="editor-toolbar__btn"
            title="切换侧边栏 (Ctrl+\)"
            onClick={onToggleSidebar}
          >
            &#9776;
          </button>
          <span className="editor-toolbar__sep" />
          {/* 编辑命令按钮 */}
          <button className="editor-toolbar__btn" title="一级标题 (H1)" onClick={() => applyCommand(setHeading, 1)}>H1</button>
          <button className="editor-toolbar__btn" title="二级标题 (H2)" onClick={() => applyCommand(setHeading, 2)}>H2</button>
          <span className="editor-toolbar__sep" />
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
          <button className="editor-toolbar__btn" title="图片" onClick={() => applyCommand(insertImage)}>&#128247;</button>

          <span className="editor-toolbar__spacer" />

          {/* 视图模式切换 */}
          <span className="editor-toolbar__sep" />
          <div className="editor-toolbar__modes">
            {VIEW_MODE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={`editor-toolbar__mode-btn ${viewMode === opt.value ? "editor-toolbar__mode-btn--active" : ""}`}
                onClick={() => setViewMode(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* 编辑模式 */}
        {viewMode === "edit" && (
          <div className="panel__body panel__body--editor-editing">
            {textareaElement}
          </div>
        )}

        {/* 预览模式 */}
        {viewMode === "preview" && (
          <div className="panel__body panel__body--editor-editing">
            <MarkdownPreview content={content} onKeyDown={handlePreviewKeyDown} />
          </div>
        )}

        {/* 分屏模式 */}
        {viewMode === "split" && (
          <div className="panel__body panel__body--editor-split">
            <div className="editor-split__pane editor-split__pane--edit">
              {textareaElement}
            </div>
            <div className="editor-split__divider" />
            <div className="editor-split__pane editor-split__pane--preview">
              <MarkdownPreview content={content} />
            </div>
          </div>
        )}

        <footer className="status-bar">
          <span className="status-bar__item" title={fileName}>{fileName}</span>
          <span className="status-bar__item">{isDirty ? "未保存" : "已保存"}</span>
          <span className="status-bar__item status-bar__spacer" />
          <span className="status-bar__item">字数 {charCount}</span>
          <span className="status-bar__item">词数 {wordCount}</span>
          <span className="status-bar__item">行 {lineCount}</span>
          <span className="status-bar__item">标题 {headingCount}</span>
        </footer>
      </div>
    );
  },
);
