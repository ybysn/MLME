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
  extractMarkdownImageSources,
} from "../../editor/markdown/render_markdown";
import {
  resolveMarkdownAssetPath,
  safeDecodeMarkdownImageSrc,
} from "../../services/path_service";
import {
  saveImageAsset,
  readImageAssetAsDataUrl,
} from "../../services/asset_service";

/** 允许的图片 MIME 类型 */
const IMAGE_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/pjpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "image/bmp",
  "image/x-icon",
  "image/vnd.microsoft.icon",
  "image/avif",
]);

/** 根据扩展名回退判断 */
const IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "jfif", "jpe", "gif", "webp", "svg", "bmp", "ico", "avif"]);

function isImageFile(file: File): boolean {
  if (file.type && IMAGE_MIME_TYPES.has(file.type)) return true;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return IMAGE_EXTS.has(ext);
}

/** 判断 src 是否为 blob URL */
function isBlobUrl(src: string): boolean {
  return /^blob:/i.test(src);
}

/** 判断 src 是否为 localhost/asset 协议路径 */
function isLocalhostAssetUrl(src: string): boolean {
  return /localhost:\d+\//.test(src) || /^asset:\/\//.test(src) || src.includes("asset.localhost");
}

/** 判断 src 是否为 data URL */
function isDataUrl(src: string): boolean {
  return /^data:/i.test(src);
}

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
  insertImageFiles: (files: File[], source?: "button" | "drop" | "paste") => Promise<void>;
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
    /** 拖拽处理锁 */
    const dropProcessingRef = useRef(false);
    /** relativePath → dataUrl 缓存（用于 DOM patch） */
    const relativeDataUrlCacheRef = useRef<Map<string, string>>(new Map());
    /** 已处理的 img 元素集合（避免重复 patch） */
    const patchedImagesRef = useRef<WeakSet<HTMLImageElement>>(new WeakSet());
    const currentPathRef = useRef(currentPath);
    currentPathRef.current = currentPath;

    // ── 拖拽状态 ──────────────────────────────────
    const [isDragOver, setIsDragOver] = useState(false);

    // ── normalizeMarkdownImageSources：清洗 Markdown 中的污染路径 ──
    const normalizeMarkdownImageSources = useCallback((markdown: string): string => {
      const sources = extractMarkdownImageSources(markdown);
      if (sources.length === 0) return markdown;

      let cleaned = markdown;
      for (const src of sources) {
        if (isBlobUrl(src)) {
          console.warn("[CLEAN][writing] removing blob URL from markdown", { src });
          // 移除整段图片语法，保留 alt 文本
          cleaned = cleaned.replace(new RegExp(
            `!\\[([^\\]]*)\\]\\(${src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)`,
            'g',
          ), (_m, alt: string) => alt || "");
          continue;
        }
        if (isDataUrl(src)) {
          console.warn("[CLEAN][writing] data URL found in markdown, cannot recover relative path", {
            srcPrefix: src.slice(0, 60),
          });
          continue;
        }
        if (isLocalhostAssetUrl(src)) {
          // 尝试将 localhost 路径转回相对路径
          try {
            const decoded = decodeURIComponent(src);
            const match = decoded.match(/[^/]+\.assets\/.+/);
            if (match) {
              const relative = match[0];
              // 用正则替换 localhost 编码版为相对路径
              cleaned = cleaned.replace(new RegExp(
                `!\\[([^\\]]*)\\]\\(${src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)`,
                'g',
              ), `![$1](${relative})`);
              console.debug("[CLEAN][writing] replaced localhost URL with relative path", { src, relative });
              continue;
            }
          } catch {
            // decode 失败，跳过
          }
          console.warn("[CLEAN][writing] localhost URL in markdown, cannot convert", { src });
        }
      }
      return cleaned;
    }, []);

    // ── DOM patch：将 img.src 替换为 data URL 以显示 ──
    const patchSingleImage = useCallback(async (img: HTMLImageElement) => {
      if (patchedImagesRef.current.has(img)) return;

      const src = img.getAttribute("src") || img.src || "";
      if (!src) return;

      // 跳过外部 URL
      if (/^https?:\/\//i.test(src) && !isLocalhostAssetUrl(src)) {
        patchedImagesRef.current.add(img);
        return;
      }

      // 已经是 data URL 且可以正常显示，标记已处理
      if (isDataUrl(src)) {
        patchedImagesRef.current.add(img);
        return;
      }

      // 处理 blob URL —— 无法转换为 data URL，报 warn
      if (isBlobUrl(src)) {
        console.warn("[PATCH][writing] blob URL img cannot be recovered", { src: src.slice(0, 80) });
        patchedImagesRef.current.add(img);
        return;
      }

      // 从 localhost/asset URL 提取相对路径
      let relativePath = src;
      if (isLocalhostAssetUrl(src)) {
        try {
          const decoded = decodeURIComponent(src);
          const match = decoded.match(/[^/]+\.assets\/.+/);
          if (match) {
            relativePath = match[0];
          } else {
            console.warn("[PATCH][writing] cannot extract relative path from localhost URL", { src });
            patchedImagesRef.current.add(img);
            return;
          }
        } catch {
          patchedImagesRef.current.add(img);
          return;
        }
      }

      // 跳过绝对 Windows/Unix 路径
      if (/^[a-zA-Z]:[/\\]/.test(relativePath) || relativePath.startsWith("/")) {
        patchedImagesRef.current.add(img);
        return;
      }

      // 获取 data URL
      const cp = currentPathRef.current;
      if (!cp) return;

      let dataUrl = relativeDataUrlCacheRef.current.get(relativePath);
      if (!dataUrl) {
        try {
          const absPath = resolveMarkdownAssetPath(cp, safeDecodeMarkdownImageSrc(relativePath));
          dataUrl = relativeDataUrlCacheRef.current.get(absPath)
            || await readImageAssetAsDataUrl(absPath);
          relativeDataUrlCacheRef.current.set(relativePath, dataUrl);
          relativeDataUrlCacheRef.current.set(absPath, dataUrl);
        } catch (err) {
          console.warn("[PATCH][writing] readImageAssetAsDataUrl failed", {
            relativePath,
            error: String(err),
          });
          patchedImagesRef.current.add(img);
          return;
        }
      }

      img.src = dataUrl;
      patchedImagesRef.current.add(img);
      console.debug("[PATCH][writing] patched img src", {
        from: relativePath.slice(-40),
        toPrefix: dataUrl.slice(0, 50),
      });
    }, []);

    const patchAllImages = useCallback(() => {
      const container = containerRef.current;
      if (!container) return;
      const imgs = container.querySelectorAll("img");
      for (const img of imgs) {
        void patchSingleImage(img as HTMLImageElement);
      }
    }, [patchSingleImage]);

    // ── MutationObserver：监听新增 img 节点 ──
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const observer = new MutationObserver((mutations) => {
        let shouldPatch = false;
        for (const m of mutations) {
          if (m.type === "childList") {
            for (const node of m.addedNodes) {
              if (node instanceof HTMLImageElement) {
                void patchSingleImage(node);
              } else if (node instanceof HTMLElement) {
                const imgs = node.querySelectorAll?.("img");
                if (imgs && imgs.length > 0) {
                  for (const img of imgs) {
                    void patchSingleImage(img as HTMLImageElement);
                  }
                }
              }
            }
          } else if (m.type === "attributes" && m.attributeName === "src") {
            const target = m.target;
            if (target instanceof HTMLImageElement) {
              patchedImagesRef.current.delete(target);
              void patchSingleImage(target);
              shouldPatch = true;
            }
          }
        }
        if (shouldPatch) {
          patchAllImages();
        }
      });

      observer.observe(container, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["src"],
      });

      return () => observer.disconnect();
    }, [patchSingleImage, patchAllImages]);

    // ── 统一的写作模式图片文件插入流程 ──────────
    const insertImageFiles = useCallback(
      async (files: File[], source: "button" | "drop" | "paste" = "button") => {
        const imageFiles = files.filter(isImageFile);
        console.debug(`[IMAGE_INSERT][writing] start`, { source, fileCount: files.length, imageCount: imageFiles.length });

        if (imageFiles.length === 0) {
          if (files.length > 0) {
            onStatusRef.current?.("仅支持图片文件 (png, jpg, jpeg, jfif, jpe, gif, webp, svg, bmp, ico, avif)");
          }
          return;
        }

        if (!currentPath) {
          onStatusRef.current?.("请先保存 Markdown 文件，再插入图片");
          return;
        }

        const view = crepeRef.current?.editor?.ctx?.get(editorViewCtx);
        if (!view) return;

        let successCount = 0;
        let errorCount = 0;

        for (const file of imageFiles) {
          try {
            console.debug("[IMAGE_INSERT][writing] saving asset", { fileName: file.name });
            const payload = await saveImageAsset(currentPath, file);
            // 预加载 dataUrl 到缓存（用于后续 DOM patch）
            const dataUrl = await readImageAssetAsDataUrl(payload.asset_path);
            relativeDataUrlCacheRef.current.set(payload.relative_path, dataUrl);
            relativeDataUrlCacheRef.current.set(payload.asset_path, dataUrl);

            console.debug("[IMAGE_INSERT][writing] saved asset", { relativePath: payload.relative_path });

            // 插入 ProseMirror image 节点，src 使用 relativePath（不是 dataUrl！）
            const { state, dispatch } = view;
            const schema = state.schema;

            if (schema.nodes.image) {
              const imageNode = schema.nodes.image.create({
                src: payload.relative_path,
                alt: payload.file_name,
                title: "",
              });
              const tr = state.tr.insert(state.selection.from, imageNode);
              dispatch(tr);
            } else {
              const tr = state.tr.insertText(
                `![${payload.file_name}](${payload.relative_path})\n`,
                state.selection.from,
                state.selection.to,
              );
              dispatch(tr);
            }

            successCount++;
          } catch (err) {
            errorCount++;
            console.warn("[IMAGE_INSERT][writing] asset save failed for", file.name, err);
          }
        }

        // 插入完成后 patch 所有新增的 img
        requestAnimationFrame(() => patchAllImages());

        console.debug("[IMAGE_INSERT][writing] done", { successCount, errorCount });

        if (errorCount > 0 && successCount > 0) {
          onStatusRef.current?.(`已插入 ${successCount} 张，${errorCount} 张失败`);
        } else if (successCount === 1) {
          onStatusRef.current?.("已插入 1 张图片");
        } else if (successCount > 1) {
          onStatusRef.current?.(`已插入 ${successCount} 张图片`);
        } else {
          onStatusRef.current?.(`图片保存失败 (${errorCount} 张)`);
        }
      },
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [currentPath, patchAllImages],
    );

    useImperativeHandle(ref, () => ({ insertImageFiles }), [insertImageFiles]);

    // ── 原生 capture-phase 拖拽事件 ──
    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;

      const onDragOverCapture = (e: DragEvent) => {
        if (!e.dataTransfer?.types.includes("Files")) return;
        const hasImage = Array.from(e.dataTransfer.files).some(isImageFile);
        if (!hasImage) return;
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer) {
          e.dataTransfer.dropEffect = "copy";
        }
        setIsDragOver(true);
      };

      const onDragLeaveCapture = (e: DragEvent) => {
        setIsDragOver(false);
        void e;
      };

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

        if (dropProcessingRef.current) {
          console.debug("[IMAGE_DROP][writing] ignored duplicate drop");
          return;
        }
        dropProcessingRef.current = true;

        console.debug("[IMAGE_DROP][writing] drop event", {
          fileCount: files.length,
          imageCount: imageFiles.length,
        });

        void insertImageFiles(imageFiles, "drop").finally(() => {
          setTimeout(() => {
            dropProcessingRef.current = false;
          }, 300);
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

    // ── IME 事件 ──────────────────────────────────

    const handleCompositionStart = useCallback((_e: CompositionEvent) => {
      isComposingRef.current = true;
    }, []);

    const handleCompositionEnd = useCallback((_e: CompositionEvent) => {
      isComposingRef.current = false;
    }, []);

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

    // 资源加载错误诊断
    useEffect(() => {
      const handler = (event: Event) => {
        const el = event.target as HTMLElement | null;
        if (el && "src" in el) {
          const imgEl = el as HTMLImageElement;
          const rawSrc = imgEl.getAttribute("src") || imgEl.src || "";
          console.warn("[RESOURCE_DEBUG] load failed", {
            tagName: imgEl.tagName,
            src: rawSrc.slice(0, 120),
            reason: isBlobUrl(rawSrc)
              ? "blob URL"
              : isLocalhostAssetUrl(rawSrc)
                ? "localhost URL"
                : isDataUrl(rawSrc)
                  ? "data URL"
                  : "relative/unknown path",
          });
        }
      };
      window.addEventListener("error", handler, true);
      return () => window.removeEventListener("error", handler, true);
    }, []);

    // 初始化 Crepe（仅 currentPath 变化或组件重挂载时重建）
    useEffect(() => {
      let cancelled = false;
      const container = containerRef.current;
      if (!container) return;

      const docKey = currentPath ?? "__new__";
      if (docKeyRef.current === docKey && crepeRef.current) {
        console.debug("[TyporaEditor] skip recreation, same docKey", docKey);
        return;
      }

      const prev = crepeRef.current;
      if (prev) {
        prev.destroy();
        crepeRef.current = null;
      }
      container.innerHTML = "";
      // 清空 patch 缓存
      patchedImagesRef.current = new WeakSet();

      const createStart = performance.now();

      const initEditor = () => {
        if (cancelled) return;

        // 不再 hydrate：直接喂相对路径 Markdown 给 Crepe
        const crepe = new Crepe({
          root: container,
          defaultValue: content,
        });
        crepeRef.current = crepe;
        docKeyRef.current = docKey;

        crepe.on((api) => {
          api.markdownUpdated((_ctx, markdown) => {
            if (isComposingRef.current) return;

            // 清洗 blob/data/localhost，确保污染路径不传到 AppShell
            const safeMarkdown = normalizeMarkdownImageSources(markdown);
            onChangeRef.current(safeMarkdown);

            // 每次内容变化后重新 patch 图片
            requestAnimationFrame(() => patchAllImages());
          });
        });

        crepe.create().then(() => {
          console.log("[PERF][WritingMode] create editor", (performance.now() - createStart).toFixed(1), "ms");
          if (cancelled) { crepe.destroy(); return; }
          crepe.setReadonly(false);

          // 首次渲染后 patch 所有图片
          requestAnimationFrame(() => patchAllImages());

          requestAnimationFrame(() => {
            const editable = container.querySelector(".ProseMirror, [contenteditable='true']");
            if (editable instanceof HTMLElement) {
              editable.focus();
            }
          });
        });
      };

      initEditor();

      return () => {
        cancelled = true;
        if (crepeRef.current) {
          crepeRef.current.destroy();
          crepeRef.current = null;
          docKeyRef.current = null;
        }
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentPath]);

    // 大纲跳转
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
