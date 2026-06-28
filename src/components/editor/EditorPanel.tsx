/**
 * 模块职责：中间编辑区面板，统一管理三种视图模式（写作/源码/分屏）。
 * 写作和分屏模式使用 TyporaEditorPanel（Milkdown Crepe），源码模式使用 textarea。
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
  type EditCommandResult,
} from "../../editor/markdown/edit_commands";
import { MarkdownPreview } from "./MarkdownPreview";
import { createLogger } from "../../services/logger";
import { FindReplaceBar } from "./FindReplaceBar";
import { TyporaEditorPanel } from "./TyporaEditorPanel";
import { EditorToolbar } from "./EditorToolbar";
import { useFindReplace } from "./useFindReplace";
import { useImageInsert } from "./useImageInsert";
import { getMarkdownStats } from "../../editor/markdown/word_count";
import type { TyporaEditorPanelHandle } from "./TyporaEditorPanel";

const logger = createLogger("EditorPanel");

export type ViewMode = "wysiwyg" | "source" | "split";

export interface EditorPanelProps {
  content: string;
  fileName: string;
  isDirty: boolean;
  isEditing: boolean;
  headingCount: number;
  currentPath: string | null;
  autoSaveEnabled: boolean;
  autoSaveStatus: "idle" | "saving" | "error";
  editorFontSize: number;
  editorFontFamily: string;
  defaultViewMode: "wysiwyg" | "source" | "split";
  onContentChange: (content: string) => void;
  onSave: () => void;
  onOpen: () => void;
  onNew: () => void;
  onToggleSidebar: () => void;
  onToggleAutoSave: () => void;
  onOpenSettings: () => void;
  onUpdateSettings: (partial: { editorFontSize?: number; editorFontFamily?: string; theme?: "light" | "dark" }) => void;
  onExportHtml: () => void;
  onExportPdf: () => void;
  onPrint: () => void;
  isFocusMode?: boolean;
  onToggleFocus?: () => void;
  onToggleFullscreen?: () => void;
  isFullscreen?: boolean;
  currentTheme?: string;
}

export interface EditorPanelHandle {
  scrollToLine: (line: number) => void;
  scrollToHeadingText: (text: string) => void;
  setViewMode: (mode: ViewMode) => void;
}

interface PendingSelection {
  start: number;
  end: number;
}

export const EditorPanel = forwardRef<EditorPanelHandle, EditorPanelProps>(
  function EditorPanel(
    {
      content,
      fileName,
      isDirty,
      isEditing,
      headingCount,
      currentPath,
      autoSaveEnabled,
      autoSaveStatus,
      editorFontSize,
      editorFontFamily,
      onContentChange,
      onSave,
      onOpen,
      onNew,
      onToggleSidebar,
      onToggleAutoSave,
      onOpenSettings,
      defaultViewMode,
      onUpdateSettings,
      onExportHtml,
      onExportPdf,
      onPrint,
      isFocusMode = false,
      onToggleFocus,
      onToggleFullscreen,
      isFullscreen = false,
      currentTheme = "light",
    },
    ref,
  ) {
    const [viewMode, setViewMode] = useState<ViewMode>(defaultViewMode);
    const viewModeRef = useRef(viewMode);
    viewModeRef.current = viewMode;
    const [selectedHeadingLevel, setSelectedHeadingLevel] = useState(0);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const [outlineScrollTarget, setOutlineScrollTarget] = useState<string | null>(null);
    const openEditableStartRef = useRef<number | null>(null);

    const typoraEditorRef = useRef<TyporaEditorPanelHandle>(null);

    // Callback refs for global keyboard handler (WYSIWYG mode)
    const onSaveRef = useRef(onSave);
    onSaveRef.current = onSave;
    const onOpenRef = useRef(onOpen);
    onOpenRef.current = onOpen;
    const onNewRef = useRef(onNew);
    onNewRef.current = onNew;
    const onToggleSidebarRef = useRef(onToggleSidebar);
    onToggleSidebarRef.current = onToggleSidebar;

    // ── 撤销/重做栈（源码模式） ──
    const undoStackRef = useRef<string[]>([]);
    const redoStackRef = useRef<string[]>([]);
    const skipUndoPushRef = useRef(false);
    // 每次 content 变化时推入 undo 栈（排除由 undo/redo 自身触发的变更）
    useEffect(() => {
      if (skipUndoPushRef.current) {
        skipUndoPushRef.current = false;
        return;
      }
      const stack = undoStackRef.current;
      if (stack.length === 0 || stack[stack.length - 1] !== content) {
        stack.push(content);
        if (stack.length > 200) stack.shift();
        redoStackRef.current = [];
      }
    }, [content]);

    // ── 查找替换（通过 hook 封装） ──
    const findReplace = useFindReplace({
      content,
      viewMode,
      textareaRef,
      typoraEditorRef,
      onContentChange,
    });
    const { findQuery, replaceText, isFindOpen, isReplaceMode, caseSensitive, activeMatchIndex, matchCount,
      setFindQuery, setReplaceText, openFind, closeFind, toggleReplace, toggleCaseSensitive,
      handleFindNext, handleFindPrev, handleReplaceCurrent, handleReplaceAll } = findReplace;

    const pendingSelectionRef = useRef<PendingSelection | null>(null);

    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // 诊断：打印接收到的设置 props
    useEffect(() => {
      logger.debug("received props", {
        editorFontSize,
        editorFontFamily,
        autoSaveEnabled,
        autoSaveStatus,
        currentViewMode: viewMode,
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editorFontSize, editorFontFamily, autoSaveEnabled]);

    // 当用户保存设置改变 defaultViewMode 时，立即应用到当前 viewMode
    useEffect(() => {
      logger.debug("defaultViewMode prop changed, syncing viewMode", {
        defaultViewMode,
        currentViewMode: viewMode,
      });
      setViewMode(defaultViewMode);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [defaultViewMode]);

    // 打开新文件时重置 viewMode 为默认模式
    useEffect(() => {
      if (isEditing) {
        const docKey = currentPath || fileName;
        logger.debug("document changed, resetting viewMode", {
          docKey,
          defaultViewMode,
        });
        setViewMode(defaultViewMode);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentPath, fileName, isEditing]);

    /** 显示即时状态消息，3 秒后自动消失 */
    const showStatus = useCallback((message: string) => {
      setStatusMessage(message);
      if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
      statusTimerRef.current = setTimeout(() => setStatusMessage(null), 3000);
    }, []);

    // ── 图片插入（通过 hook 封装） ──
    const imageInsert = useImageInsert({
      content,
      currentPath,
      viewMode,
      textareaRef,
      typoraEditorRef,
      onContentChange,
      showStatus,
      pendingSelectionRef,
    });
    const { isDragOver, fileInputRef,
      handleImageButtonClick, handleFileInputChange,
      handleDragOver, handleDragLeave, handleDrop, handlePaste } = imageInsert;

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

    // 打开文件/新建文档后自动聚焦 textarea（仅源码/分屏模式）
    useEffect(() => {
      if (!isEditing) return;
      if (viewMode === "wysiwyg") {
        openEditableStartRef.current = null;
        return;
      }

      const textarea = textareaRef.current;
      if (!textarea) return;

      const startAt = openEditableStartRef.current;
      const raf = requestAnimationFrame(() => {
        textarea.focus();
        if (startAt != null) {
          console.log("[PERF] open file to editable", (performance.now() - startAt).toFixed(1), "ms");
        }
        openEditableStartRef.current = null;
      });
      return () => cancelAnimationFrame(raf);
    }, [fileName, currentPath, isEditing, viewMode]);

    // 记录文件打开性能（仅在源码/分屏模式需要聚焦时有效）
    useEffect(() => {
      if (isEditing) {
        openEditableStartRef.current = performance.now();
      } else {
        openEditableStartRef.current = null;
      }
    }, [isEditing, fileName, currentPath]);

    // 清理状态定时器
    useEffect(() => {
      return () => {
        if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
      };
    }, []);

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
      scrollToHeadingText(text: string) {
        setOutlineScrollTarget(text);
        // 清除以便后续重复点击同一标题也能触发
        setTimeout(() => setOutlineScrollTarget(null), 200);
      },
      setViewMode(mode: ViewMode) {
        setViewMode(mode);
      },
    }));

    // ── 全局快捷键：Ctrl+F/Ctrl+H/Ctrl+\\（在所有模式下生效） ──
    // 同时处理 WYSIWYG 模式下的 Ctrl+S/O/N（textarea 的 onKeyDown 不触发）
    useEffect(() => {
      const handler = (e: KeyboardEvent) => {
        if (e.isComposing || e.key === "Process") return;
        const ctrl = e.ctrlKey || e.metaKey;
        if (ctrl) {
          const k = e.key.toLowerCase();

          // ── 全局文件操作（WYSIWYG/分屏模式下 textarea 无焦点，需在此处理） ──
          const isMilkdownMode = viewModeRef.current === "wysiwyg" || viewModeRef.current === "split";
          if (isMilkdownMode) {
            if (k === "s") { e.preventDefault(); onSaveRef.current(); return; }
            if (k === "o") { e.preventDefault(); onOpenRef.current(); return; }
            if (k === "n") { e.preventDefault(); onNewRef.current(); return; }
          }

          if (k === "f") {
            e.preventDefault();
            openFind(false);
            return;
          }
          if (k === "h") {
            e.preventDefault();
            openFind(true);
            return;
          }
          if (k === "\\") {
            e.preventDefault();
            onToggleSidebarRef.current();
          }
        }
      };
      window.addEventListener("keydown", handler, { capture: true });
      return () => window.removeEventListener("keydown", handler, { capture: true });
    }, [openFind, onToggleSidebar]);

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

    const handleSourceUndo = useCallback(() => {
      const stack = undoStackRef.current;
      if (stack.length <= 1) return;
      const current = stack.pop()!;
      redoStackRef.current.push(current);
      const prev = stack[stack.length - 1];
      skipUndoPushRef.current = true;
      onContentChange(prev);
    }, [onContentChange]);

    const handleSourceRedo = useCallback(() => {
      const redoStack = redoStackRef.current;
      if (redoStack.length === 0) return;
      const next = redoStack.pop()!;
      undoStackRef.current.push(next);
      skipUndoPushRef.current = true;
      onContentChange(next);
    }, [onContentChange]);

    const handleEditKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        // 跳过 IME 组合输入
        if (e.nativeEvent.isComposing || e.key === "Process") return;

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
          case "z":
            if (e.shiftKey) {
              e.preventDefault();
              handleSourceRedo();
            } else {
              e.preventDefault();
              handleSourceUndo();
            }
            break;
          case "y":
            e.preventDefault();
            handleSourceRedo();
            break;
        }
      },
      [applyCommand, onSave, onOpen, onNew, onToggleSidebar],
    );

    // ── 统计 ────────────────────────────────────

    const stats = getMarkdownStats(content);

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
            <span className="status-bar__item">字符 {stats.charCount}</span>
            <span className="status-bar__item">行 {stats.lineCount}</span>
          </footer>
        </div>
      );
    }

    // 文本编辑区组件
    const textareaElement = (
      <textarea
        ref={textareaRef}
        className={
          (viewMode === "split" ? "editor-textarea editor-textarea--split" : "editor-textarea") +
          (isDragOver ? " editor-textarea--drag-over" : "")
        }
        style={{
          fontSize: `${editorFontSize}px`,
          fontFamily: editorFontFamily,
        }}
        value={content}
        onChange={(e) => onContentChange(e.target.value)}
        onKeyDown={handleEditKeyDown}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onPaste={handlePaste}
        placeholder="在此输入 Markdown 内容..."
        spellCheck={false}
      />
    );

    // ── 编辑态 ──────────────────────────────────

    return (
      <div className="panel panel--editor">
        {/* 隐藏文件选择器，由图片按钮触发 */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml,image/bmp,image/x-icon,image/avif"
          multiple
          style={{ display: "none" }}
          onChange={handleFileInputChange}
        />

        <EditorToolbar
          viewMode={viewMode}
          setViewMode={setViewMode}
          isFocusMode={isFocusMode}
          isFullscreen={isFullscreen}
          editorFontSize={editorFontSize}
          editorFontFamily={editorFontFamily}
          typoraEditorRef={typoraEditorRef}
          onToggleSidebar={onToggleSidebar}
          onToggleFocus={onToggleFocus}
          onToggleFullscreen={onToggleFullscreen}
          onOpenSettings={onOpenSettings}
          onUpdateSettings={onUpdateSettings}
          onExportHtml={onExportHtml}
          onExportPdf={onExportPdf}
          onPrint={onPrint}
          applyCommand={applyCommand}
          onImageButtonClick={handleImageButtonClick}
          currentTheme={currentTheme}
          selectedHeadingLevel={selectedHeadingLevel}
          onHeadingChange={setSelectedHeadingLevel}
        />

        {/* 状态消息 */}
        {isFindOpen && (
          <FindReplaceBar
            query={findQuery}
            replaceText={replaceText}
            caseSensitive={caseSensitive}
            matchCount={matchCount}
            activeIndex={activeMatchIndex}
            isReplaceMode={isReplaceMode}
            onQueryChange={setFindQuery}
            onReplaceTextChange={setReplaceText}
            onNext={handleFindNext}
            onPrev={handleFindPrev}
            onReplaceCurrent={handleReplaceCurrent}
            onReplaceAll={handleReplaceAll}
            onToggleCaseSensitive={toggleCaseSensitive}
            onToggleReplace={toggleReplace}
            onClose={closeFind}
          />
        )}
        {statusMessage && (
          <div className="editor-status-msg">{statusMessage}</div>
        )}

        {/* 编辑模式 */}
        {viewMode === "source" && (
          <div
            className="panel__body panel__body--editor-editing"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {textareaElement}
          </div>
        )}

        {/* 写作模式 */}
        {viewMode === "wysiwyg" && (
          <div className="panel__body panel__body--editor-editing">
            <TyporaEditorPanel
              ref={typoraEditorRef}
              content={content}
              currentPath={currentPath}
              fontFamily={editorFontFamily}
              fontSize={editorFontSize}
              onChange={onContentChange}
              scrollToHeadingText={outlineScrollTarget}
              onStatusMessage={showStatus}
            />
          </div>
        )}

        {/* 分屏模式：左侧 WYSIWYG，右侧预览 */}
        {viewMode === "split" && (
          <div className="panel__body panel__body--editor-split">
            <div className="editor-split__pane editor-split__pane--edit">
              <TyporaEditorPanel
                ref={typoraEditorRef}
                content={content}
                currentPath={currentPath}
                fontFamily={editorFontFamily}
                fontSize={editorFontSize}
                onChange={onContentChange}
                scrollToHeadingText={outlineScrollTarget}
                onStatusMessage={showStatus}
              />
            </div>
            <div className="editor-split__divider" />
            <div className="editor-split__pane editor-split__pane--preview">
              <MarkdownPreview content={content} currentPath={currentPath} findQuery={findQuery} activeMatchIndex={activeMatchIndex} caseSensitive={caseSensitive} enableFindHighlight={isFindOpen} />
            </div>
          </div>
        )}

        <footer className="status-bar">
          <span className="status-bar__item" title={fileName}>{fileName}</span>
          <span className="status-bar__item">
            {autoSaveStatus === "saving"
              ? "自动保存中..."
              : autoSaveStatus === "error"
                ? "自动保存失败"
                : isDirty
                  ? "未保存"
                  : "已保存"}
          </span>
          <span className="status-bar__item status-bar__spacer" />
          <button
            className="editor-toolbar__mode-btn"
            title={autoSaveEnabled ? "自动保存: 开" : "自动保存: 关"}
            onClick={onToggleAutoSave}
          >
            {autoSaveEnabled ? "自动保存: 开" : "自动保存: 关"}
          </button>
          <span className="status-bar__item">字数 {stats.wordCount}</span>
          <span className="status-bar__item">字符 {stats.charCount}</span>
          <span className="status-bar__item">行 {stats.lineCount}</span>
          <span className="status-bar__item">标题 {headingCount}</span>
        </footer>
      </div>
    );
  },
);
