/**
 * 模块职责：Typora 式所见即所得编辑器，基于 Milkdown Crepe。
 * 图片处理策略：
 *   - Crepe 内部 Markdown 始终保持相对路径（不喂 data URL）
 *   - 渲染后用 DOM patch 将 img.src 替换为 data URL 以显示
 *   - markdownUpdated 时用 normalizeMarkdownImageSources 清洗 blob/data/localhost
 *   - MutationObserver 监听新增 img 节点自动 patch
 *   - 图片插入时 ProseMirror 节点 src 使用 relativePath
 * 查找高亮策略：
 *   - 使用 ProseMirror Decoration 插件 writingFindPlugin，不再直接操作 DOM。
 * 生命周期安全：
 *   - generationRef 单调递增，所有异步任务执行前校验
 *   - img.isConnected 确保不操作已销毁 DOM（触发 ProseMirror 内部 DOM→state 链条）
 */
import {
  useEffect,
  useRef,
  useCallback,
  useState,
  forwardRef,
  useImperativeHandle,
} from "react";
import { Crepe } from "@milkdown/crepe";
import "@milkdown/crepe/theme/common/style.css";
import "@milkdown/crepe/theme/nord.css";
import "katex/dist/katex.min.css";
import { commandsCtx, editorViewCtx } from "@milkdown/kit/core";
import { wrapInHeadingCommand } from "@milkdown/kit/preset/commonmark";
import { undoCommand, redoCommand } from "@milkdown/kit/plugin/history";
import { AllSelection } from "@milkdown/kit/prose/state";
import {
  normalizeMarkdownImageSources,
  detectUnsafeImageSources,
} from "../../editor/image/normalize_markdown_images";
import {
  importImageFilesForMarkdown,
  type ImageInsertSource,
} from "../../editor/image/image_asset_workflow";
import { isImageFile, ALLOWED_IMAGE_FORMATS_STRING } from "../../editor/image/image_validation";
import {
  resolveMarkdownAssetPath,
  safeDecodeMarkdownImageSrc,
} from "../../services/path_service";
import { readImageAssetAsDataUrl } from "../../services/asset_service";
import {
  writingFindFeature,
  updateWritingFind as dispatchWritingFindState,
  getWritingFindState,
} from "../../editor/markdown/writing_find_plugin";

export interface TyporaEditorPanelProps {
  content: string;
  currentPath?: string | null;
  fontFamily: string;
  fontSize: number;
  onChange: (nextContent: string) => void;
  scrollToHeadingText?: string | null;
  onStatusMessage?: (message: string) => void;
}

export interface TyporaEditorPanelHandle {
  insertImageFiles: (files: File[], source?: ImageInsertSource) => Promise<void>;
  /** 更新写作模式查找高亮状态（ProseMirror Decoration 方式） */
  updateWritingFind: (query: string, caseSensitive: boolean, activeIndex: number) => void;
  /** 滚动到第 activeIndex 个查找匹配项（会同时更新 activeIndex） */
  scrollToWritingFindMatch: (activeIndex: number) => void;
  /** 获取当前插件中的匹配数 */
  getWritingFindMatchCount: () => number;
  getSelectedText: () => string;
  refreshContent: (newContent: string) => void;
  /** 设置当前块的标题级别（0=段落, 1-6=H1-H6） */
  setHeadingLevel: (level: number) => void;
  /** 撤销 */
  undo: () => void;
  /** 重做 */
  redo: () => void;
  /** 在光标位置插入文本 */
  insertText: (text: string) => void;
}

export const TyporaEditorPanel = forwardRef<TyporaEditorPanelHandle, TyporaEditorPanelProps>(
  function TyporaEditorPanel({
    content,
    currentPath,
    fontFamily,
    fontSize,
    onChange,
    scrollToHeadingText,
    onStatusMessage,
  }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const crepeRef = useRef<Crepe | null>(null);
    const docKeyRef = useRef<string | null>(null);
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;
    const isComposingRef = useRef(false);
    const onStatusRef = useRef(onStatusMessage);
    onStatusRef.current = onStatusMessage;
    const dropProcessingRef = useRef(false);

    // ── 生命周期 guard ──
    const isMountedRef = useRef(false);
    const generationRef = useRef(0);
    const rafIdsRef = useRef<Set<number>>(new Set());

    /** relativePath → dataUrl 缓存（用于 DOM patch） */
    const relativeDataUrlCacheRef = useRef<Map<string, string>>(new Map());
    /** 已处理的 img 元素集合（避免重复 patch） */
    const patchedImagesRef = useRef<WeakSet<HTMLImageElement>>(new WeakSet());
    const currentPathRef = useRef(currentPath);
    currentPathRef.current = currentPath;

    /** 查找高亮恢复：编辑器重建后重新 dispatch find meta */
    const findRestoreRef = useRef<{ query: string; caseSensitive: boolean; activeIndex: number } | null>(null);

    const [isDragOver, setIsDragOver] = useState(false);
    /** 替换操作后触发编辑器重建的版本号 */
    const [refreshVersion, setRefreshVersion] = useState(0);

    /** 检查当前生命周期是否有效（mounted + generation 匹配） */
    const isLive = useCallback((gen: number) => isMountedRef.current && generationRef.current === gen, []);

    // ── 安全 RAF ──
    const safeRaf = useCallback((fn: () => void) => {
      const gen = generationRef.current;
      const id = requestAnimationFrame(() => {
        rafIdsRef.current.delete(id);
        if (isLive(gen)) fn();
      });
      rafIdsRef.current.add(id);
      return id;
    }, [isLive]);

    // ── 组件挂载/卸载 ──
    useEffect(() => {
      generationRef.current++;
      isMountedRef.current = true;
      console.debug("[WRITING_LIFECYCLE] mount generation", generationRef.current);
      return () => {
        isMountedRef.current = false;
        generationRef.current++;
        console.debug("[WRITING_LIFECYCLE] cleanup generation", generationRef.current);
        rafIdsRef.current.forEach((id) => cancelAnimationFrame(id));
        rafIdsRef.current.clear();
      };
    }, []);

    // ── DOM patch：将 img.src 替换为 data URL ──
    const patchSingleImage = useCallback(async (img: HTMLImageElement, gen: number) => {
      // 已处理过，跳过
      if (patchedImagesRef.current.has(img)) return;

      const src = img.getAttribute("src") || img.src || "";
      if (!src) { patchedImagesRef.current.add(img); return; }

      // 跳过外部 URL（非本地）
      if (/^https?:\/\//i.test(src) && !/localhost:\d+/.test(src) && !src.includes("asset.localhost")) {
        patchedImagesRef.current.add(img);
        return;
      }
      if (/^data:/i.test(src)) { patchedImagesRef.current.add(img); return; }
      if (/^blob:/i.test(src)) {
        patchedImagesRef.current.add(img);
        return;
      }

      let relativePath = src;
      if (/localhost:\d+\//.test(src) || src.includes("asset.localhost")) {
        try {
          const decoded = decodeURIComponent(src);
          const match = decoded.match(/[^/]+\.assets\/.+/);
          if (match) { relativePath = match[0]; }
          else { patchedImagesRef.current.add(img); return; }
        } catch { patchedImagesRef.current.add(img); return; }
      }

      if (/^[a-zA-Z]:[/\\]/.test(relativePath) || relativePath.startsWith("/")) {
        patchedImagesRef.current.add(img);
        return;
      }

      const cp = currentPathRef.current;
      if (!cp || !relativePath) { patchedImagesRef.current.add(img); return; }

      // 异步读取 dataUrl
      let dataUrl = relativeDataUrlCacheRef.current.get(relativePath);
      if (!dataUrl) {
        try {
          const absPath = resolveMarkdownAssetPath(cp, safeDecodeMarkdownImageSrc(relativePath));
          dataUrl = relativeDataUrlCacheRef.current.get(absPath)
            || await readImageAssetAsDataUrl(absPath);
          relativeDataUrlCacheRef.current.set(relativePath, dataUrl);
          relativeDataUrlCacheRef.current.set(absPath, dataUrl);
        } catch {
          patchedImagesRef.current.add(img);
          return;
        }
      }

      // ★ 关键 guard：检查生命周期和 DOM 连接状态
      // img.isConnected 为 false 表示元素已不在 DOM 中（editor 已销毁）
      // 此时设置 img.src 会触发 ProseMirror 内部 DOM→state 链条 → editorView not found
      if (!isLive(gen)) {
        console.debug("[WRITING_PATCH] skip stale generation", { gen, current: generationRef.current });
        return;
      }
      if (!img.isConnected || !crepeRef.current) {
        console.debug("[WRITING_PATCH] img disconnected or editor gone, skip");
        return;
      }

      img.src = dataUrl;
      patchedImagesRef.current.add(img);
    }, [isLive]);

    const patchAllImages = useCallback(() => {
      const container = containerRef.current;
      if (!container) return;
      const gen = generationRef.current;
      const imgs = container.querySelectorAll("img");
      for (const img of imgs) void patchSingleImage(img as HTMLImageElement, gen);
    }, [patchSingleImage]);

    // ── 统一图片插入入口 ──
    const insertImageFiles = useCallback(
      async (files: File[], source: ImageInsertSource = "button") => {
        const gen = generationRef.current;
        if (!isLive(gen) || !crepeRef.current) {
          console.warn("[WRITING_ACTION] skip insertImageFiles, editor not ready", { gen, source });
          return;
        }

        const view = crepeRef.current.editor.ctx.get(editorViewCtx);
        if (!view) return;

        console.debug(`[IMAGE_INSERT][writing] start`, { source, fileCount: files.length });

        if (!currentPath) {
          onStatusRef.current?.("请先保存 Markdown 文件，再插入图片");
          return;
        }

        const { results, errors } = await importImageFilesForMarkdown({ files, markdownPath: currentPath });

        // 异步回来后再次检查生命周期
        if (!isLive(gen)) return;

        if (results.length === 0 && errors.length > 0) {
          if (errors[0].message.includes("请先保存")) {
            onStatusRef.current?.(errors[0].message);
          } else {
            onStatusRef.current?.(`图片保存失败 (${errors.length} 张)`);
          }
          return;
        }

        if (files.length > results.length && errors.length === 0 && results.length === 0) {
          onStatusRef.current?.(`仅支持图片文件 (${ALLOWED_IMAGE_FORMATS_STRING})`);
          return;
        }

        for (const r of results) {
          if (!isLive(gen)) return;
          relativeDataUrlCacheRef.current.set(r.relativePath, r.dataUrl);
          relativeDataUrlCacheRef.current.set(r.assetPath, r.dataUrl);

          const { state, dispatch } = view;
          if (state.schema.nodes.image) {
            const imageNode = state.schema.nodes.image.create({ src: r.relativePath, alt: r.fileName, title: "" });
            dispatch(state.tr.insert(state.selection.from, imageNode));
          } else {
            dispatch(state.tr.insertText(`![${r.fileName}](${r.relativePath})\n`, state.selection.from, state.selection.to));
          }
        }

        safeRaf(() => patchAllImages());

        console.debug("[IMAGE_INSERT][writing] done", { success: results.length, errors: errors.length });

        if (errors.length > 0 && results.length > 0) {
          onStatusRef.current?.(`已插入 ${results.length} 张，${errors.length} 张失败`);
        } else if (results.length === 1) {
          onStatusRef.current?.("已插入 1 张图片");
        } else if (results.length > 1) {
          onStatusRef.current?.(`已插入 ${results.length} 张图片`);
        }
      },
      [currentPath, isLive, safeRaf, patchAllImages],
    );

    // ── 查找高亮（ProseMirror Decoration 层） ──
    const updateWritingFind = useCallback((query: string, caseSensitive: boolean, activeIndex: number): void => {
      if (query) {
        findRestoreRef.current = { query, caseSensitive, activeIndex };
      } else {
        findRestoreRef.current = null;
      }
      if (!crepeRef.current) return;
      const view = crepeRef.current.editor.ctx.get(editorViewCtx);
      if (!view) return;
      dispatchWritingFindState(view, query, caseSensitive, activeIndex);
    }, []);

    const scrollToWritingFindMatch = useCallback((activeIndex: number): void => {
      if (!crepeRef.current) return;
      const view = crepeRef.current.editor.ctx.get(editorViewCtx);
      if (!view) return;

      const findState = getWritingFindState(view);
      if (!findState || findState.ranges.length === 0) return;

      const idx = Math.max(0, Math.min(activeIndex, findState.ranges.length - 1));

      // 先更新 activeIndex，然后等一帧滚动
      dispatchWritingFindState(view, findState.query, findState.caseSensitive, idx);

      requestAnimationFrame(() => {
        const updated = getWritingFindState(view);
        if (!updated || updated.ranges.length === 0) return;
        const range = updated.ranges[Math.min(idx, updated.ranges.length - 1)];
        const domPos = view.domAtPos(range.from);
        if (domPos.node) {
          const el = domPos.node.nodeType === Node.TEXT_NODE
            ? domPos.node.parentElement
            : domPos.node as HTMLElement;
          if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });
        }
      });
    }, []);

    const getWritingFindMatchCount = useCallback((): number => {
      if (!crepeRef.current) return 0;
      const view = crepeRef.current.editor.ctx.get(editorViewCtx);
      if (!view) return 0;
      return getWritingFindState(view)?.ranges.length ?? 0;
    }, []);

    const getSelectedText = useCallback((): string => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !containerRef.current) return "";
      if (!containerRef.current.contains(sel.anchorNode)) return "";
      return sel.toString();
    }, []);

    const refreshContent = useCallback((_newContent: string) => {
      if (crepeRef.current) {
        crepeRef.current.destroy();
        crepeRef.current = null;
      }
      docKeyRef.current = null;
      if (containerRef.current) containerRef.current.innerHTML = "";
      patchedImagesRef.current = new WeakSet();
      setRefreshVersion((v) => v + 1);
    }, []);

    /** 设置当前块标题级别（0=段落, 1-6=H1-H6） */
    const setHeadingLevel = useCallback((level: number) => {
      const clampedLevel = Math.max(0, Math.min(6, Math.round(level)));
      const crepe = crepeRef.current;
      if (!crepe) {
        console.warn("[TyporaEditor] setHeadingLevel called before editor ready");
        return;
      }
      try {
        crepe.editor.action((ctx) => {
          const commands = ctx.get(commandsCtx);
          commands.call(wrapInHeadingCommand.key, clampedLevel);
        });
      } catch (err) {
        console.warn("[TyporaEditor] setHeadingLevel failed", err);
      }
    }, []);

    /** 撤销 */
    const undo = useCallback(() => {
      const crepe = crepeRef.current;
      if (!crepe) return;
      try {
        crepe.editor.action((ctx) => {
          const commands = ctx.get(commandsCtx);
          commands.call(undoCommand.key);
        });
      } catch (err) {
        console.warn("[TyporaEditor] undo failed", err);
      }
    }, []);

    /** 重做 */
    const redo = useCallback(() => {
      const crepe = crepeRef.current;
      if (!crepe) return;
      try {
        crepe.editor.action((ctx) => {
          const commands = ctx.get(commandsCtx);
          commands.call(redoCommand.key);
        });
      } catch (err) {
        console.warn("[TyporaEditor] redo failed", err);
      }
    }, []);

    /** 在光标位置插入文本 */
    const insertText = useCallback((text: string) => {
      const crepe = crepeRef.current;
      if (!crepe) return;
      try {
        const view = crepe.editor.ctx.get(editorViewCtx);
        if (!view) return;
        const { state, dispatch } = view;
        const tr = state.tr.insertText(text, state.selection.from, state.selection.to);
        dispatch(tr);
      } catch (err) {
        console.warn("[TyporaEditor] insertText failed", err);
      }
    }, []);

    // ── MutationObserver（图片自动 patch） ──
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const observer = new MutationObserver((_mutations) => {
        const gen = generationRef.current;
        if (!isLive(gen)) return;

        const c = containerRef.current;
        if (c) {
          const imgs = c.querySelectorAll("img");
          for (const img of imgs) {
            if (!patchedImagesRef.current.has(img as HTMLImageElement)) {
              void patchSingleImage(img as HTMLImageElement, gen);
            }
          }
        }
      });

      observer.observe(container, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ["src"],
      });

      return () => {
        console.debug("[WRITING_OBSERVER] disconnected generation", generationRef.current);
        observer.disconnect();
      };
    }, [isLive, patchSingleImage]);

    useImperativeHandle(ref, () => ({
      insertImageFiles,
      updateWritingFind,
      scrollToWritingFindMatch,
      getWritingFindMatchCount,
      getSelectedText,
      refreshContent,
      setHeadingLevel,
      undo,
      redo,
      insertText,
    }), [insertImageFiles, updateWritingFind, scrollToWritingFindMatch, getWritingFindMatchCount, getSelectedText, refreshContent, setHeadingLevel, undo, redo, insertText]);

    // ── 原生 capture-phase 拖拽 ──
    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;

      const onDragOverCapture = (e: DragEvent) => {
        if (!e.dataTransfer?.types.includes("Files")) return;
        if (!Array.from(e.dataTransfer.files).some(isImageFile)) return;
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
        setIsDragOver(true);
      };

      const onDragLeaveCapture = () => setIsDragOver(false);

      const onDropCapture = (e: DragEvent) => {
        if (!e.dataTransfer?.types.includes("Files")) return;
        const files = e.dataTransfer?.files;
        if (!files || files.length === 0) return;
        const imageFiles = Array.from(files).filter(isImageFile);
        if (imageFiles.length === 0) return;

        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        setIsDragOver(false);

        if (dropProcessingRef.current) return;
        dropProcessingRef.current = true;

        void insertImageFiles(imageFiles, "drop").finally(() => {
          setTimeout(() => { dropProcessingRef.current = false; }, 300);
        });
      };

      el.addEventListener("dragover", onDragOverCapture, { capture: true });
      el.addEventListener("dragleave", onDragLeaveCapture, { capture: true });
      el.addEventListener("drop", onDropCapture, { capture: true });

      // Ctrl+A 全选限定在编辑器内
      const onKeyDownCapture = (e: KeyboardEvent) => {
        if (e.isComposing || e.key === "Process") return;
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
          if (!(e.target instanceof HTMLElement)) return;
          if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
          e.preventDefault();
          e.stopPropagation();
          try {
            const crepe = crepeRef.current;
            if (!crepe) return;
            const view = crepe.editor.ctx.get(editorViewCtx);
            if (!view) return;
            view.dispatch(view.state.tr.setSelection(new AllSelection(view.state.doc)));
          } catch {
            // ignore
          }
        }
      };
      el.addEventListener("keydown", onKeyDownCapture, { capture: true });

      return () => {
        el.removeEventListener("dragover", onDragOverCapture, { capture: true });
        el.removeEventListener("dragleave", onDragLeaveCapture, { capture: true });
        el.removeEventListener("drop", onDropCapture, { capture: true });
        el.removeEventListener("keydown", onKeyDownCapture, { capture: true });
      };
    }, [insertImageFiles]);

    // ── IME ──
    const handleCompositionStart = useCallback(() => { isComposingRef.current = true; }, []);
    const handleCompositionEnd = useCallback(() => { isComposingRef.current = false; }, []);

    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;
      el.addEventListener("compositionstart", handleCompositionStart);
      el.addEventListener("compositionend", handleCompositionEnd);
      return () => {
        el.removeEventListener("compositionstart", handleCompositionStart);
        el.removeEventListener("compositionend", handleCompositionEnd);
      };
    }, [handleCompositionStart, handleCompositionEnd]);

    // ── Copy 按钮点击反馈 ──
    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;

      const timerMap = new WeakMap<HTMLButtonElement, ReturnType<typeof setTimeout>>();

      const onCopyClick = (e: Event) => {
        const target = e.target as HTMLElement;
        const button = target.closest('.tools-button-group button') as HTMLButtonElement | null;
        if (!button) return;

        // 保存原始完整 HTML（含 SVG 图标）
        if (!button.dataset.originalHtml) {
          button.dataset.originalHtml = button.innerHTML;
        }

        // 清除旧 timer
        const oldTimer = timerMap.get(button);
        if (oldTimer) clearTimeout(oldTimer);

        // 清除残留状态
        button.classList.remove('copied', 'failed');

        // 延迟执行（让 Crepe clipboard 操作先完成）
        setTimeout(() => {
          if (!button.isConnected) return;

          // 找到按钮内最后一个文本节点，替换为"已复制"
          const childNodes = button.childNodes;
          for (let i = childNodes.length - 1; i >= 0; i--) {
            if (childNodes[i].nodeType === Node.TEXT_NODE) {
              childNodes[i].textContent = '已复制';
              break;
            }
          }
          button.classList.add('copied');

          const timer = setTimeout(() => {
            if (button.isConnected) {
              button.innerHTML = button.dataset.originalHtml!;
              button.classList.remove('copied', 'failed');
            }
            timerMap.delete(button);
          }, 1200);

          timerMap.set(button, timer);
        }, 50);
      };

      el.addEventListener('click', onCopyClick);

      return () => {
        el.removeEventListener('click', onCopyClick);
      };
    }, []);

    // ── RESOURCE_DEBUG ──
    useEffect(() => {
      const handler = (event: Event) => {
        const el = event.target as HTMLElement | null;
        if (el && "src" in el) {
          const imgEl = el as HTMLImageElement;
          const src = imgEl.getAttribute("src") || imgEl.src || "";
          console.warn("[RESOURCE_DEBUG] load failed", {
            tagName: imgEl.tagName,
            src: src.slice(0, 120),
            reason: /^blob:/i.test(src) ? "blob" : /^data:/i.test(src) ? "data" : /localhost/.test(src) ? "localhost" : "path",
          });
        }
      };
      window.addEventListener("error", handler, true);
      return () => window.removeEventListener("error", handler, true);
    }, []);

    // ── 初始化 Crepe ──
    useEffect(() => {
      let cancelled = false;
      const container = containerRef.current;
      if (!container) return;

      const docKey = currentPath ?? "__new__";
      if (docKeyRef.current === docKey && crepeRef.current) return;

      generationRef.current++;
      const createGen = generationRef.current;
      console.debug("[WRITING_LIFECYCLE] create start generation", createGen);

      const prev = crepeRef.current;
      if (prev) { prev.destroy(); crepeRef.current = null; }
      container.innerHTML = "";
      patchedImagesRef.current = new WeakSet();

      if (currentPath) {
        const unsafeCount = detectUnsafeImageSources(content);
        if (unsafeCount > 0) {
          console.warn("[IMAGE_GUARD] detected", unsafeCount, "unsafe image sources in content loaded into writing mode");
        }
      }

      const createStart = performance.now();

      const crepe = new Crepe({ root: container, defaultValue: content });
      crepeRef.current = crepe;
      docKeyRef.current = docKey;

      crepe.addFeature(writingFindFeature);

      crepe.on((api) => {
        api.markdownUpdated((_ctx, markdown) => {
          if (cancelled || !isMountedRef.current || generationRef.current !== createGen) return;
          if (isComposingRef.current) return;
          const safe = normalizeMarkdownImageSources(markdown);
          onChangeRef.current(safe);
          safeRaf(() => patchAllImages());
        });
      });

      crepe.create().then(() => {
        if (cancelled || !isMountedRef.current || generationRef.current !== createGen) {
          crepe.destroy();
          return;
        }

        console.debug("[WRITING_LIFECYCLE] create done generation", createGen);
        console.log("[PERF][WritingMode] create editor", (performance.now() - createStart).toFixed(1), "ms");
        crepe.setReadonly(false);

        // 编辑器重建后恢复查找高亮状态（替换操作会触发 refreshContent → 重建）
        if (findRestoreRef.current) {
          const view = crepe.editor.ctx.get(editorViewCtx);
          dispatchWritingFindState(
            view,
            findRestoreRef.current.query,
            findRestoreRef.current.caseSensitive,
            findRestoreRef.current.activeIndex,
          );
        }

        safeRaf(() => patchAllImages());
        safeRaf(() => {
          if (isMountedRef.current && generationRef.current === createGen) {
            const editable = container.querySelector(".ProseMirror, [contenteditable='true']");
            if (editable instanceof HTMLElement) editable.focus();
          }
        });
      }).catch((err: unknown) => {
        console.warn("[TyporaEditor] create failed", err);
      });

      return () => {
        cancelled = true;
        if (crepeRef.current) {
          crepeRef.current.destroy();
          crepeRef.current = null;
          docKeyRef.current = null;
        }
        console.debug("[WRITING_LIFECYCLE] cleanup generation", createGen);
      };
    }, [currentPath, refreshVersion, safeRaf, patchAllImages]);

    // ── block-edit 菜单 tab 内容隔离 ──
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      let menuObserver: MutationObserver | null = null;

      const updateActiveGroup = () => {
        const tabs = container.querySelectorAll('.milkdown-slash-menu .tab-group li');
        const groups = container.querySelectorAll('.milkdown-slash-menu .menu-group');
        if (tabs.length === 0 || groups.length === 0) return;
        const selectedIdx = Array.from(tabs).findIndex((li) => li.classList.contains('selected'));
        groups.forEach((g, i) => {
          g.classList.toggle('milkdown-tab-active', i === selectedIdx);
        });
      };

      const localObserver = new MutationObserver(() => {
        const menu = container.querySelector('.milkdown-slash-menu');
        if (menu && !menuObserver) {
          updateActiveGroup();
          menuObserver = new MutationObserver(() => updateActiveGroup());
          menuObserver.observe(menu, { subtree: true, attributes: true, attributeFilter: ['class'] });
        } else if (!menu && menuObserver) {
          menuObserver.disconnect();
          menuObserver = null;
        }
      });

      localObserver.observe(container, { childList: true, subtree: true });

      return () => {
        localObserver.disconnect();
        if (menuObserver) menuObserver.disconnect();
      };
    }, []);

    // ── 大纲跳转 ──
    useEffect(() => {
      if (!scrollToHeadingText || !containerRef.current) return;
      const container = containerRef.current;
      const timer = setTimeout(() => {
        const headings = container.querySelectorAll("h1, h2, h3, h4, h5, h6");
        for (const h of headings) {
          if (h.textContent?.trim() === scrollToHeadingText) {
            h.scrollIntoView({ block: "center", behavior: "smooth" });
            break;
          }
        }
      }, 100);
      return () => clearTimeout(timer);
    }, [scrollToHeadingText]);

    const editorFontSizePx = `${fontSize}px`;

    const editorStyle: React.CSSProperties = {
      fontFamily,
      fontSize: editorFontSizePx,
      '--editor-font-family': fontFamily,
      '--editor-font-size': editorFontSizePx,
      '--crepe-font-default': fontFamily,
      '--crepe-font-title': fontFamily,
    } as React.CSSProperties;

    return (
      <div
        ref={containerRef}
        className={`typora-editor${isDragOver ? " typora-editor--drag-over" : ""}`}
        style={editorStyle}
      />
    );
  },
);
