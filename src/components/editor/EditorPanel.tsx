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
  setHeadingLevel,
  type EditCommandResult,
} from "../../editor/markdown/edit_commands";
import { MarkdownPreview } from "./MarkdownPreview";
import { saveImageAsset } from "../../services/asset_service";
import { createLogger } from "../../services/logger";
import { FindReplaceBar } from "./FindReplaceBar";
import { TyporaEditorPanel } from "./TyporaEditorPanel";
import {
  findMatches,
  replaceCurrentMatch,
  replaceAllMatches,
  type FindMatch,
} from "../../editor/markdown/find_replace";

const logger = createLogger("EditorPanel");

export type ViewMode = "wysiwyg" | "source" | "split";

/** 允许的图片 MIME 类型 */
const IMAGE_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "image/bmp",
  "image/x-icon",
  "image/vnd.microsoft.icon",
  "image/avif",
]);

/** MIME 类型回退——根据扩展名判断 */
const IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico", "avif"]);

function isImageFile(file: File): boolean {
  if (file.type && IMAGE_MIME_TYPES.has(file.type)) return true;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return IMAGE_EXTS.has(ext);
}

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
  onUpdateSettings: (partial: { editorFontSize?: number; editorFontFamily?: string }) => void;
  onExportHtml: () => void;
  onExportPdf: () => void;
  onPrint: () => void;
}

export interface EditorPanelHandle {
  scrollToLine: (line: number) => void;
  scrollToHeadingText: (text: string) => void;
}

interface PendingSelection {
  start: number;
  end: number;
}

const VIEW_MODE_OPTIONS: { value: ViewMode; label: string }[] = [
  { value: "wysiwyg", label: "写作模式" },
  { value: "source", label: "源码" },
  { value: "split", label: "分屏" },
];

const FONT_OPTIONS: { label: string; value: string }[] = [
  { label: "系统默认", value: "Consolas, 'Microsoft YaHei', monospace" },
  { label: "Consolas", value: "Consolas, monospace" },
  { label: "Microsoft YaHei", value: "'Microsoft YaHei', sans-serif" },
  { label: "微软雅黑", value: "微软雅黑, 'Microsoft YaHei', sans-serif" },
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
  { label: "H6", level: 6 },
];

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
    },
    ref,
  ) {
    const [viewMode, setViewMode] = useState<ViewMode>(defaultViewMode);
    const [exportMenuOpen, setExportMenuOpen] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const exportMenuRef = useRef<HTMLDivElement>(null);

    // ── 查找替换状态 ────────────────────────────
    const [findQuery, setFindQuery] = useState("");
    const [replaceText, setReplaceText] = useState("");
    const [isFindOpen, setIsFindOpen] = useState(false);
    const [isReplaceMode, setIsReplaceMode] = useState(false);
    const [caseSensitive, setCaseSensitive] = useState(false);
    const [activeMatchIndex, setActiveMatchIndex] = useState(0);
    const matchesRef = useRef<FindMatch[]>([]);
    const [outlineScrollTarget, setOutlineScrollTarget] = useState<string | null>(null);
    const openEditableStartRef = useRef<number | null>(null);

    // 点击外部关闭导出菜单
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
    const fileInputRef = useRef<HTMLInputElement>(null);
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
      if (viewMode === "wysiwyg") return;

      const textarea = textareaRef.current;
      if (!textarea) return;

      const raf = requestAnimationFrame(() => {
        textarea.focus();
        if (openEditableStartRef.current != null) {
          console.log("[PERF] open file to editable", (performance.now() - openEditableStartRef.current).toFixed(1), "ms");
          openEditableStartRef.current = null;
        }
      });
      return () => cancelAnimationFrame(raf);
    }, [fileName, currentPath, isEditing, viewMode]);

    // 记录文件打开性能
    useEffect(() => {
      if (isEditing) {
        openEditableStartRef.current = performance.now();
      }
    }, [isEditing, fileName]);

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
    }));

    // ── 查找替换 ────────────────────────────────

    const updateFindMatches = useCallback(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      matchesRef.current = findMatches(textarea.value, findQuery, { caseSensitive });
      const maxIdx = Math.max(0, matchesRef.current.length - 1);
      setActiveMatchIndex((prev) => Math.min(prev, maxIdx));
    }, [findQuery, caseSensitive]);

    // query 变化时更新匹配列表
    useEffect(() => {
      updateFindMatches();
      setActiveMatchIndex(0);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [findQuery, caseSensitive]);

    const selectMatch = useCallback((index: number) => {
      const textarea = textareaRef.current;
      const matches = matchesRef.current;
      if (!textarea || matches.length === 0) return;
      const idx = Math.max(0, Math.min(index, matches.length - 1));
      const m = matches[idx];

      // 滚动 textarea 到匹配行附近
      const textBefore = textarea.value.slice(0, m.start);
      const lineIndex = textBefore.split("\n").length - 1;
      const computed = window.getComputedStyle(textarea);
      const lineHeight = parseFloat(computed.lineHeight) || parseFloat(computed.fontSize) * 1.6;
      const paddingTop = parseFloat(computed.paddingTop) || 0;
      const targetTop = Math.max(0, lineIndex * lineHeight - textarea.clientHeight * 0.35 + paddingTop);

      textarea.scrollTop = targetTop;
      textarea.focus();
      textarea.setSelectionRange(m.start, m.end);
      setActiveMatchIndex(idx);
    }, []);

    const handleFindNext = useCallback(() => {
      const next = activeMatchIndex + 1 >= matchesRef.current.length ? 0 : activeMatchIndex + 1;
      selectMatch(next);
    }, [activeMatchIndex, selectMatch]);

    const handleFindPrev = useCallback(() => {
      const prev = activeMatchIndex - 1 < 0 ? matchesRef.current.length - 1 : activeMatchIndex - 1;
      selectMatch(prev);
    }, [activeMatchIndex, selectMatch]);

    const handleReplaceCurrent = useCallback(() => {
      const matches = matchesRef.current;
      if (matches.length === 0) return;
      const idx = Math.max(0, Math.min(activeMatchIndex, matches.length - 1));
      const m = matches[idx];
      const result = replaceCurrentMatch(content, m, replaceText);
      onContentChange(result.content);
      setTimeout(() => {
        updateFindMatches();
        const textarea = textareaRef.current;
        if (textarea) {
          textarea.setSelectionRange(result.cursorPos, result.cursorPos);
          textarea.focus();
        }
      }, 0);
    }, [content, activeMatchIndex, replaceText, onContentChange, updateFindMatches]);

    const handleReplaceAll = useCallback(() => {
      if (!findQuery) return;
      const result = replaceAllMatches(content, findQuery, replaceText, { caseSensitive });
      if (result.count > 0) {
        onContentChange(result.content);
        setTimeout(() => {
          matchesRef.current = [];
          setActiveMatchIndex(0);
        }, 0);
      }
    }, [content, findQuery, replaceText, caseSensitive, onContentChange]);

    const openFind = useCallback((replace?: boolean) => {
      setIsFindOpen(true);
      setIsReplaceMode(replace ?? false);
      // 如果 textarea 有选中文本，填充到查找框
      const textarea = textareaRef.current;
      if (textarea) {
        const selected = textarea.value.slice(textarea.selectionStart, textarea.selectionEnd);
        if (selected) {
          setFindQuery(selected);
          return;
        }
      }
    }, []);

    const closeFind = useCallback(() => {
      setIsFindOpen(false);
      setFindQuery("");
      setReplaceText("");
      matchesRef.current = [];
      setActiveMatchIndex(0);
    }, []);

    // 写作模式下全局 Ctrl+\ 切换侧边栏（跳过 IME 组合输入）
    useEffect(() => {
      if (viewMode !== "wysiwyg") return;
      const handler = (e: KeyboardEvent) => {
        if (e.isComposing || e.key === "Process") return;
        if ((e.ctrlKey || e.metaKey) && e.key === "\\") {
          e.preventDefault();
          onToggleSidebar();
        }
      };
      window.addEventListener("keydown", handler);
      return () => window.removeEventListener("keydown", handler);
    }, [viewMode, onToggleSidebar]);

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

    // ── 统一图片插入流程 ──────────────────────

    /**
     * 统一处理图片文件插入：支持工具栏按钮选择 & 拖拽。
     * @param files 用户选择或拖入的 File 列表
     */
    const handleInsertImageFiles = useCallback(
      async (files: File[]) => {
        const imageFiles = files.filter(isImageFile);
        if (imageFiles.length === 0) {
          showStatus("仅支持图片文件 (png, jpg, jpeg, gif, webp, svg)");
          return;
        }

        if (!currentPath) {
          showStatus("请先保存 Markdown 文件，再插入图片");
          return;
        }

        const textarea = textareaRef.current;
        const cursorPos = textarea?.selectionStart ?? content.length;

        let newContent = content;
        // 如果光标不在行首，先插入换行
        if (cursorPos > 0 && content[cursorPos - 1] !== "\n") {
          newContent =
            newContent.slice(0, cursorPos) + "\n" + newContent.slice(cursorPos);
        }

        let offset = cursorPos > 0 && content[cursorPos - 1] !== "\n" ? 1 : 0;
        let errorCount = 0;
        let successCount = 0;

        for (const file of imageFiles) {
          try {
            console.debug("[EditorPanel] insert image asset", {
              currentPath,
              fileName: file.name,
            });
            const payload = await saveImageAsset(currentPath, file);
            const mdImage = `![${payload.file_name}](${payload.relative_path})\n`;
            const insertPos = cursorPos + offset;
            newContent =
              newContent.slice(0, insertPos) +
              mdImage +
              newContent.slice(insertPos);
            offset += mdImage.length;
            successCount++;
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            errorCount++;
            showStatus(`图片保存失败: ${msg}`);
          }
        }

        if (successCount > 0) {
          pendingSelectionRef.current = {
            start: cursorPos + offset,
            end: cursorPos + offset,
          };
          onContentChange(newContent);
          if (successCount === 1) {
            showStatus(`已插入 1 张图片`);
          } else {
            showStatus(`已插入 ${successCount} 张图片`);
          }
        }
      },
      [content, currentPath, onContentChange, showStatus],
    );

    // ── 工具栏图片按钮：触发隐藏 input ──────────

    const handleImageButtonClick = useCallback(() => {
      fileInputRef.current?.click();
    }, []);

    const handleFileInputChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
          handleInsertImageFiles(Array.from(files));
        }
        // 清空 input 使重复选择同一文件也能触发 change
        e.target.value = "";
      },
      [handleInsertImageFiles],
    );

    // ── 图片拖拽 ────────────────────────────────

    const [isDragOver, setIsDragOver] = useState(false);

    const handleDragOver = useCallback((e: React.DragEvent) => {
      if (!e.dataTransfer.types.includes("Files")) return;

      const hasImageFile = Array.from(e.dataTransfer.files).some(isImageFile);
      if (!hasImageFile) return;

      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      setIsDragOver(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
      if (e.currentTarget.contains(e.relatedTarget as Node)) return;
      setIsDragOver(false);
    }, []);

    const handleDrop = useCallback(
      async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);

        const files = e.dataTransfer.files;
        if (files.length === 0) return;

        await handleInsertImageFiles(Array.from(files));
      },
      [handleInsertImageFiles],
    );

    // ── 粘贴图片 ────────────────────────────────

    const handlePaste = useCallback(
      (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
        const items = e.clipboardData.items;
        const imageItems: DataTransferItem[] = [];

        for (let i = 0; i < items.length; i++) {
          if (items[i].type.startsWith("image/")) {
            imageItems.push(items[i]);
          }
        }

        if (imageItems.length === 0) return; // 无图片，走默认文本粘贴

        e.preventDefault();

        if (!currentPath) {
          showStatus("请先保存 Markdown 文件，再粘贴图片");
          return;
        }

        const files = imageItems
          .map((item) => item.getAsFile())
          .filter((f): f is File => f !== null);

        if (files.length > 0) {
          handleInsertImageFiles(files);
        }
      },
      [currentPath, handleInsertImageFiles, showStatus],
    );

    // ── 键盘快捷键 ────────────────────────────

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
          case "f":
            e.preventDefault();
            openFind(false);
            break;
          case "h":
            e.preventDefault();
            openFind(true);
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
      [applyCommand, onSave, onOpen, onNew, onToggleSidebar, openFind],
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

        <div className="editor-toolbar">
          <button className="editor-toolbar__btn" title="切换侧边栏 (Ctrl+\)" onClick={onToggleSidebar}>&#9776;</button>
          <span className="editor-toolbar__sep" />
          {viewMode !== "wysiwyg" && (
            <>
              <select className="editor-toolbar__select editor-toolbar__select--heading" title="标题级别" onChange={(e) => { const level = Number(e.target.value); applyCommand(setHeadingLevel, level); e.target.value = ""; }} defaultValue="">
                <option value="" disabled>标题</option>
                {HEADING_OPTIONS.map((opt) => (<option key={opt.level} value={opt.level}>{opt.label}</option>))}
              </select>
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
              <button className="editor-toolbar__btn" title="插入图片" onClick={handleImageButtonClick}>&#128247;</button>
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
              </div>
            )}
          </div>
          <button
            className="editor-toolbar__btn"
            title="打印"
            onClick={onPrint}
          >
            打印
          </button>
          <button
            className="editor-toolbar__btn"
            title="设置"
            onClick={onOpenSettings}
          >
            &#9881;
          </button>
        </div>

        {/* 状态消息 */}
        {isFindOpen && (
          <FindReplaceBar
            query={findQuery}
            replaceText={replaceText}
            caseSensitive={caseSensitive}
            matchCount={matchesRef.current.length}
            activeIndex={activeMatchIndex}
            isReplaceMode={isReplaceMode}
            onQueryChange={setFindQuery}
            onReplaceTextChange={setReplaceText}
            onNext={handleFindNext}
            onPrev={handleFindPrev}
            onReplaceCurrent={handleReplaceCurrent}
            onReplaceAll={handleReplaceAll}
            onToggleCaseSensitive={() => setCaseSensitive((p) => !p)}
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
              content={content}
              currentPath={currentPath}
              fontFamily={editorFontFamily}
              fontSize={editorFontSize}
              onChange={onContentChange}
              scrollToHeadingText={outlineScrollTarget}
            />
          </div>
        )}

        {/* 分屏模式 */}
        {viewMode === "split" && (
          <div
            className="panel__body panel__body--editor-split"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="editor-split__pane editor-split__pane--edit">
              {textareaElement}
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
          <span className="status-bar__item">字数 {charCount}</span>
          <span className="status-bar__item">词数 {wordCount}</span>
          <span className="status-bar__item">行 {lineCount}</span>
          <span className="status-bar__item">标题 {headingCount}</span>
        </footer>
      </div>
    );
  },
);
