/**
 * 模块职责：封装编辑器图片插入、拖拽、粘贴逻辑，支持源码/写作/分屏三种模式。
 * 输入：content、currentPath、viewMode、textareaRef、typoraEditorRef、onContentChange、showStatus、pendingSelectionRef。
 * 输出：图片插入 state 和 handler，供 EditorPanel 消费。
 */
import { useState, useRef, useCallback } from "react";
import type { ViewMode } from "./EditorPanel";
import type { TyporaEditorPanelHandle } from "./TyporaEditorPanel";
import {
  importImageFilesForMarkdown,
} from "../../editor/image/image_asset_workflow";
import { isImageFile, ALLOWED_IMAGE_FORMATS_STRING } from "../../editor/image/image_validation";

export interface UseImageInsertInput {
  content: string;
  currentPath: string | null;
  viewMode: ViewMode;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  typoraEditorRef: React.RefObject<TyporaEditorPanelHandle | null>;
  onContentChange: (content: string) => void;
  showStatus: (message: string) => void;
  pendingSelectionRef: React.MutableRefObject<{ start: number; end: number } | null>;
}

export interface UseImageInsertReturn {
  isDragOver: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleImageButtonClick: () => void;
  handleFileInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleDragOver: (e: React.DragEvent) => void;
  handleDragLeave: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent) => Promise<void>;
  handlePaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
}

export function useImageInsert({
  content,
  currentPath,
  viewMode,
  textareaRef,
  typoraEditorRef,
  onContentChange,
  showStatus,
  pendingSelectionRef,
}: UseImageInsertInput): UseImageInsertReturn {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── 源码/分屏模式下图片文件插入 ──
  const handleInsertImageFiles = useCallback(
    async (files: File[]) => {
      if (!currentPath) {
        showStatus("请先保存 Markdown 文件，再插入图片");
        return;
      }

      const { results, errors } = await importImageFilesForMarkdown({
        files,
        markdownPath: currentPath,
      });

      if (results.length === 0) {
        if (errors.length > 0) {
          showStatus(errors[0].message);
        } else {
          showStatus(`仅支持图片文件 (${ALLOWED_IMAGE_FORMATS_STRING})`);
        }
        return;
      }

      const textarea = textareaRef.current;
      const cursorPos = textarea?.selectionStart ?? content.length;

      let newContent = content;
      if (cursorPos > 0 && content[cursorPos - 1] !== "\n") {
        newContent = newContent.slice(0, cursorPos) + "\n" + newContent.slice(cursorPos);
      }
      let offset = cursorPos > 0 && content[cursorPos - 1] !== "\n" ? 1 : 0;

      for (const r of results) {
        const mdImage = `![${r.fileName}](${r.relativePath})\n`;
        const insertPos = cursorPos + offset;
        newContent = newContent.slice(0, insertPos) + mdImage + newContent.slice(insertPos);
        offset += mdImage.length;
      }

      pendingSelectionRef.current = { start: cursorPos + offset, end: cursorPos + offset };
      onContentChange(newContent);

      if (errors.length > 0) {
        showStatus(`已插入 ${results.length} 张，${errors.length} 张失败`);
      } else if (results.length === 1) {
        showStatus("已插入 1 张图片");
      } else {
        showStatus(`已插入 ${results.length} 张图片`);
      }
    },
    [content, currentPath, onContentChange, showStatus, textareaRef, pendingSelectionRef],
  );

  // ── 工具栏图片按钮 ──
  const handleImageButtonClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        if (viewMode === "wysiwyg") {
          void typoraEditorRef.current?.insertImageFiles(Array.from(files), "button");
        } else {
          handleInsertImageFiles(Array.from(files));
        }
      }
      e.target.value = "";
    },
    [viewMode, handleInsertImageFiles, typoraEditorRef],
  );

  // ── 图片拖拽 ──
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

  // ── 粘贴图片 ──
  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const items = e.clipboardData.items;
      const imageItems: DataTransferItem[] = [];

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith("image/")) {
          imageItems.push(items[i]);
        }
      }

      if (imageItems.length === 0) return;

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

  return {
    isDragOver,
    fileInputRef,
    handleImageButtonClick,
    handleFileInputChange,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handlePaste,
  };
}
