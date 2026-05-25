/**
 * 模块职责：封装编辑器查找替换状态和逻辑，支持源码/写作/分屏三种模式。
 * 输入：content、viewMode、textareaRef、typoraEditorRef、onContentChange。
 * 输出：查找替换 state 和 handler，供 EditorPanel 消费。
 */
import { useState, useRef, useEffect, useCallback } from "react";
import type { ViewMode } from "./EditorPanel";
import type { TyporaEditorPanelHandle } from "./TyporaEditorPanel";
import {
  findMatches,
  replaceCurrentMatch,
  replaceAllMatches,
  type FindMatch,
} from "../../editor/markdown/find_replace";

export interface UseFindReplaceInput {
  content: string;
  viewMode: ViewMode;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  typoraEditorRef: React.RefObject<TyporaEditorPanelHandle | null>;
  onContentChange: (content: string) => void;
}

export interface UseFindReplaceReturn {
  findQuery: string;
  replaceText: string;
  isFindOpen: boolean;
  isReplaceMode: boolean;
  caseSensitive: boolean;
  activeMatchIndex: number;
  matchCount: number;
  setFindQuery: (q: string) => void;
  setReplaceText: (t: string) => void;
  openFind: (replace?: boolean) => void;
  closeFind: () => void;
  toggleReplace: () => void;
  toggleCaseSensitive: () => void;
  handleFindNext: () => void;
  handleFindPrev: () => void;
  handleReplaceCurrent: () => void;
  handleReplaceAll: () => void;
}

export function useFindReplace({
  content,
  viewMode,
  textareaRef,
  typoraEditorRef,
  onContentChange,
}: UseFindReplaceInput): UseFindReplaceReturn {
  const [findQuery, setFindQuery] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [isFindOpen, setIsFindOpen] = useState(false);
  const [isReplaceMode, setIsReplaceMode] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);
  const matchesRef = useRef<FindMatch[]>([]);

  const matchCount = matchesRef.current.length;

  // ── 更新匹配列表 ──
  const updateFindMatches = useCallback(() => {
    matchesRef.current = findMatches(content, findQuery, { caseSensitive });
    const maxIdx = Math.max(0, matchesRef.current.length - 1);
    setActiveMatchIndex((prev) => Math.min(prev, maxIdx));

    if (viewMode === "wysiwyg") {
      typoraEditorRef.current?.updateWritingFind(findQuery, caseSensitive, activeMatchIndex);
    }
  }, [findQuery, caseSensitive, content, viewMode, activeMatchIndex, typoraEditorRef]);

  // ── 替换后延迟高亮（写作模式编辑器重建） ──
  const scheduleWritingFindHighlight = useCallback(() => {
    let attempts = 0;
    const maxAttempts = 5;
    const tryHighlight = () => {
      if (!isFindOpen || viewMode !== "wysiwyg" || !findQuery) return;
      typoraEditorRef.current?.updateWritingFind(findQuery, caseSensitive, activeMatchIndex);
      if (attempts < maxAttempts) {
        attempts++;
        requestAnimationFrame(tryHighlight);
      } else {
        typoraEditorRef.current?.scrollToWritingFindMatch(activeMatchIndex);
      }
    };
    requestAnimationFrame(tryHighlight);
  }, [isFindOpen, viewMode, findQuery, caseSensitive, activeMatchIndex, typoraEditorRef]);

  // ── query 变化时更新匹配 ──
  useEffect(() => {
    updateFindMatches();
    setActiveMatchIndex(0);
    if (viewMode === "wysiwyg" && findQuery) {
      typoraEditorRef.current?.updateWritingFind(findQuery, caseSensitive, 0);
    } else if (viewMode === "wysiwyg") {
      typoraEditorRef.current?.updateWritingFind('', false, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [findQuery, caseSensitive]);

  // ── content 变化时更新匹配 ──
  useEffect(() => {
    if (!isFindOpen || !findQuery) return;
    updateFindMatches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

  // ── 选中匹配 ──
  const selectMatch = useCallback((index: number) => {
    const matches = matchesRef.current;
    if (matches.length === 0) return;
    const idx = Math.max(0, Math.min(index, matches.length - 1));

    setActiveMatchIndex(idx);

    if (viewMode === "wysiwyg") {
      typoraEditorRef.current?.scrollToWritingFindMatch(idx);
      return;
    }

    const textarea = textareaRef.current;
    if (!textarea) return;
    const m = matches[idx];

    const textBefore = textarea.value.slice(0, m.start);
    const lineIndex = textBefore.split("\n").length - 1;
    const computed = window.getComputedStyle(textarea);
    const lineHeight = parseFloat(computed.lineHeight) || parseFloat(computed.fontSize) * 1.6;
    const paddingTop = parseFloat(computed.paddingTop) || 0;
    const targetTop = Math.max(0, lineIndex * lineHeight - textarea.clientHeight * 0.35 + paddingTop);

    textarea.scrollTop = targetTop;
    textarea.focus();
    textarea.setSelectionRange(m.start, m.end);
  }, [viewMode, findQuery, caseSensitive, textareaRef, typoraEditorRef]);

  // ── 导航 ──
  const handleFindNext = useCallback(() => {
    const next = activeMatchIndex + 1 >= matchesRef.current.length ? 0 : activeMatchIndex + 1;
    selectMatch(next);
  }, [activeMatchIndex, selectMatch]);

  const handleFindPrev = useCallback(() => {
    const prev = activeMatchIndex - 1 < 0 ? matchesRef.current.length - 1 : activeMatchIndex - 1;
    selectMatch(prev);
  }, [activeMatchIndex, selectMatch]);

  // ── 替换 ──
  const handleReplaceCurrent = useCallback(() => {
    const matches = matchesRef.current;
    if (matches.length === 0) return;
    const idx = Math.max(0, Math.min(activeMatchIndex, matches.length - 1));
    const m = matches[idx];
    const result = replaceCurrentMatch(content, m, replaceText);
    onContentChange(result.content);
    if (viewMode === "wysiwyg") {
      typoraEditorRef.current?.refreshContent(result.content);
      scheduleWritingFindHighlight();
    }
    if (viewMode !== "wysiwyg") {
      setTimeout(() => {
        updateFindMatches();
        const textarea = textareaRef.current;
        if (textarea) {
          textarea.setSelectionRange(result.cursorPos, result.cursorPos);
          textarea.focus();
        }
      }, 0);
    }
  }, [content, activeMatchIndex, replaceText, onContentChange, viewMode, scheduleWritingFindHighlight, updateFindMatches, textareaRef, typoraEditorRef]);

  const handleReplaceAll = useCallback(() => {
    if (!findQuery) return;
    const result = replaceAllMatches(content, findQuery, replaceText, { caseSensitive });
    if (result.count > 0) {
      onContentChange(result.content);
      if (viewMode === "wysiwyg") {
        typoraEditorRef.current?.refreshContent(result.content);
        scheduleWritingFindHighlight();
      }
      setTimeout(() => {
        matchesRef.current = [];
        setActiveMatchIndex(0);
      }, 0);
    }
  }, [content, findQuery, replaceText, caseSensitive, onContentChange, viewMode, scheduleWritingFindHighlight, typoraEditorRef]);

  // ── 打开/关闭查找 ──
  const openFind = useCallback((replace?: boolean) => {
    setIsFindOpen(true);
    setIsReplaceMode(replace ?? false);

    if (viewMode === "wysiwyg") {
      const selected = typoraEditorRef.current?.getSelectedText();
      if (selected) { setFindQuery(selected); return; }
    } else {
      const textarea = textareaRef.current;
      if (textarea) {
        const selected = textarea.value.slice(textarea.selectionStart, textarea.selectionEnd);
        if (selected) { setFindQuery(selected); return; }
      }
    }
  }, [viewMode, textareaRef, typoraEditorRef]);

  const closeFind = useCallback(() => {
    setIsFindOpen(false);
    setFindQuery("");
    setReplaceText("");
    matchesRef.current = [];
    setActiveMatchIndex(0);
    typoraEditorRef.current?.updateWritingFind('', false, 0);
  }, [typoraEditorRef]);

  const toggleReplace = useCallback(() => {
    setIsReplaceMode((prev) => !prev);
  }, []);

  const toggleCaseSensitive = useCallback(() => {
    setCaseSensitive((p) => !p);
  }, []);

  return {
    findQuery,
    replaceText,
    isFindOpen,
    isReplaceMode,
    caseSensitive,
    activeMatchIndex,
    matchCount,
    setFindQuery,
    setReplaceText,
    openFind,
    closeFind,
    toggleReplace,
    toggleCaseSensitive,
    handleFindNext,
    handleFindPrev,
    handleReplaceCurrent,
    handleReplaceAll,
  };
}
