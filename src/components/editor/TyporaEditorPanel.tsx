/**
 * 模块职责：Typora 式所见即所得编辑器，基于 Milkdown Crepe。
 * 图片处理策略：
 *   - Crepe 内部 Markdown 始终保持相对路径（不喂 data URL）
 *   - 渲染后用 DOM patch 将 img.src 替换为 data URL 以显示
 *   - markdownUpdated 时用 normalizeMarkdownImageSources 清洗 blob/data/localhost
 *   - MutationObserver 监听新增 img 节点自动 patch
 *   - 图片插入时 ProseMirror 节点 src 使用 relativePath
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
import { editorViewCtx } from "@milkdown/kit/core";
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
    /** relativePath → dataUrl 缓存（用于 DOM patch） */
    const relativeDataUrlCacheRef = useRef<Map<string, string>>(new Map());
    /** 已处理的 img 元素集合（避免重复 patch） */
    const patchedImagesRef = useRef<WeakSet<HTMLImageElement>>(new WeakSet());
    const currentPathRef = useRef(currentPath);
    currentPathRef.current = currentPath;

    const [isDragOver, setIsDragOver] = useState(false);

    // ── DOM patch：将 img.src 替换为 data URL ──
    const patchSingleImage = useCallback(async (img: HTMLImageElement) => {
      if (patchedImagesRef.current.has(img)) return;

      const src = img.getAttribute("src") || img.src || "";
      if (!src) { patchedImagesRef.current.add(img); return; }

      // 跳过外部 URL
      if (/^https?:\/\//i.test(src) && !/localhost:\d+/.test(src) && !src.includes("asset.localhost")) {
        patchedImagesRef.current.add(img);
        return;
      }
      // 跳过已有效的 data URL
      if (/^data:/i.test(src)) { patchedImagesRef.current.add(img); return; }
      // 跳过无效路径
      if (/^blob:/i.test(src)) {
        console.warn("[PATCH][writing] blob URL img ignored", { src: src.slice(0, 80) });
        patchedImagesRef.current.add(img);
        return;
      }

      let relativePath = src;

      // localhost/asset URL → 提取相对路径
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

      img.src = dataUrl;
      patchedImagesRef.current.add(img);
    }, []);

    const patchAllImages = useCallback(() => {
      const container = containerRef.current;
      if (!container) return;
      const imgs = container.querySelectorAll("img");
      for (const img of imgs) void patchSingleImage(img as HTMLImageElement);
    }, [patchSingleImage]);

    // ── MutationObserver ──
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
          if (m.type === "childList") {
            for (const node of m.addedNodes) {
              if (node instanceof HTMLImageElement) { void patchSingleImage(node); }
              else if (node instanceof HTMLElement) {
                node.querySelectorAll?.("img").forEach((img) => void patchSingleImage(img as HTMLImageElement));
              }
            }
          } else if (m.type === "attributes" && m.attributeName === "src") {
            if (m.target instanceof HTMLImageElement) {
              patchedImagesRef.current.delete(m.target);
              void patchSingleImage(m.target);
            }
          }
        }
      });

      observer.observe(container, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["src"],
      });
      return () => observer.disconnect();
    }, [patchSingleImage]);

    // ── 统一图片插入入口 ──
    const insertImageFiles = useCallback(
      async (files: File[], source: ImageInsertSource = "button") => {
        console.debug(`[IMAGE_INSERT][writing] start`, { source, fileCount: files.length });

        if (!currentPath) {
          onStatusRef.current?.("请先保存 Markdown 文件，再插入图片");
          return;
        }

        const view = crepeRef.current?.editor?.ctx?.get(editorViewCtx);
        if (!view) return;

        // 统一导入工作流
        const { results, errors } = await importImageFilesForMarkdown({
          files,
          markdownPath: currentPath,
        });

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

        // 逐张插入到 ProseMirror
        for (const r of results) {
          // 缓存 dataUrl 供 DOM patch 使用
          relativeDataUrlCacheRef.current.set(r.relativePath, r.dataUrl);
          relativeDataUrlCacheRef.current.set(r.assetPath, r.dataUrl);

          const { state, dispatch } = view;
          const schema = state.schema;

          if (schema.nodes.image) {
            const imageNode = schema.nodes.image.create({
              src: r.relativePath,
              alt: r.fileName,
              title: "",
            });
            dispatch(state.tr.insert(state.selection.from, imageNode));
          } else {
            dispatch(state.tr.insertText(
              `![${r.fileName}](${r.relativePath})\n`,
              state.selection.from, state.selection.to,
            ));
          }
        }

        requestAnimationFrame(() => patchAllImages());

        console.debug("[IMAGE_INSERT][writing] done", { success: results.length, errors: errors.length });

        if (errors.length > 0 && results.length > 0) {
          onStatusRef.current?.(`已插入 ${results.length} 张，${errors.length} 张失败`);
        } else if (results.length === 1) {
          onStatusRef.current?.("已插入 1 张图片");
        } else if (results.length > 1) {
          onStatusRef.current?.(`已插入 ${results.length} 张图片`);
        }
      },
      [currentPath, patchAllImages],
    );

    useImperativeHandle(ref, () => ({ insertImageFiles }), [insertImageFiles]);

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

      return () => {
        el.removeEventListener("dragover", onDragOverCapture, { capture: true });
        el.removeEventListener("dragleave", onDragLeaveCapture, { capture: true });
        el.removeEventListener("drop", onDropCapture, { capture: true });
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

      const initEditor = () => {
        if (cancelled) return;

        const crepe = new Crepe({
          root: container,
          defaultValue: content,
        });
        crepeRef.current = crepe;
        docKeyRef.current = docKey;

        crepe.on((api) => {
          api.markdownUpdated((_ctx, markdown) => {
            if (isComposingRef.current) return;
            const safe = normalizeMarkdownImageSources(markdown);
            onChangeRef.current(safe);
            requestAnimationFrame(() => patchAllImages());
          });
        });

        crepe.create().then(() => {
          console.log("[PERF][WritingMode] create editor", (performance.now() - createStart).toFixed(1), "ms");
          if (cancelled) { crepe.destroy(); return; }
          crepe.setReadonly(false);

          requestAnimationFrame(() => patchAllImages());
          requestAnimationFrame(() => {
            const editable = container.querySelector(".ProseMirror, [contenteditable='true']");
            if (editable instanceof HTMLElement) editable.focus();
          });
        });
      };

      initEditor();

      return () => {
        cancelled = true;
        if (crepeRef.current) { crepeRef.current.destroy(); crepeRef.current = null; docKeyRef.current = null; }
      };
    }, [currentPath]);

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

    return (
      <div
        ref={containerRef}
        className={`typora-editor${isDragOver ? " typora-editor--drag-over" : ""}`}
        style={{ fontFamily, fontSize: `${fontSize}px` }}
      />
    );
  },
);
