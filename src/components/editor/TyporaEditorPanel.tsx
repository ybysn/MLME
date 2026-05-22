/**
 * 模块职责：Typora 式所见即所得编辑器，基于 Milkdown Crepe。
 * 图片处理：初始化前将本地图片转为 data URL，输出时将 data URL 映射回相对路径。
 */
import { useEffect, useRef, useCallback } from "react";
import { Crepe } from "@milkdown/crepe";
import "@milkdown/crepe/theme/common/style.css";
import "@milkdown/crepe/theme/nord.css";
import {
  extractMarkdownImageSources,
} from "../../editor/markdown/render_markdown";
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
}

export function TyporaEditorPanel({
  content,
  currentPath,
  fontFamily,
  fontSize,
  onChange,
  scrollToHeadingText,
}: TyporaEditorPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const crepeRef = useRef<Crepe | null>(null);
  const docKeyRef = useRef<string | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const isComposingRef = useRef(false);
  /** data:image/... → 原始相对路径 */
  const dataUrlToRelativeRef = useRef<Map<string, string>>(new Map());
  /** 图片 data URL 缓存 */
  const imageCacheRef = useRef<Map<string, string>>(new Map());

  // 将 markdown 中的 data URL 映回相对路径
  const restoreRelativePaths = useCallback((markdown: string): string => {
    let result = markdown;
    for (const [dataUrl, relative] of dataUrlToRelativeRef.current) {
      result = result.split(dataUrl).join(relative);
    }
    return result;
  }, []);

  /** 将本地图片 src 转为 data URL（异步），返回 hydrated markdown */
  const hydrateImages = useCallback(async (
    md: string,
    _currentPath: string,
  ): Promise<string> => {
    const sources = extractMarkdownImageSources(md);
    if (sources.length === 0) return md;

    let hydrated = md;
    const newMap = new Map<string, string>();
    const hydrateStart = performance.now();

    for (const src of sources) {
      const decodedSrc = safeDecodeMarkdownImageSrc(src);
      try {
        // 缓存 key 基于绝对路径
        const absPath = resolveMarkdownAssetPath(_currentPath, decodedSrc);
        let dataUrl = imageCacheRef.current.get(absPath);
        if (!dataUrl) {
          dataUrl = await readImageAssetAsDataUrl(absPath);
          imageCacheRef.current.set(absPath, dataUrl);
        }
        // 替换 markdown 中的 src
        hydrated = hydrated.split(src).join(dataUrl);
        newMap.set(dataUrl, src);
      } catch (err) {
        console.warn("[TyporaEditor] image hydration failed for", src, err);
      }
    }

    console.log("[PERF][WritingMode] hydrate images", (performance.now() - hydrateStart).toFixed(1), "ms", `${newMap.size} images`);
    dataUrlToRelativeRef.current = newMap;
    return hydrated;
  }, []);

  // IME 事件
  const handleCompositionStart = useCallback((_e: CompositionEvent) => {
    isComposingRef.current = true;
  }, []);

  const handleCompositionEnd = useCallback((_e: CompositionEvent) => {
    isComposingRef.current = false;
  }, []);

  const handleBeforeInput = useCallback((_e: InputEvent) => {
    // keep for potential future use
  }, []);

  // 注册 IME 事件
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("compositionstart", handleCompositionStart);
    el.addEventListener("compositionend", handleCompositionEnd);
    el.addEventListener("beforeinput", handleBeforeInput);
    return () => {
      el.removeEventListener("compositionstart", handleCompositionStart);
      el.removeEventListener("compositionend", handleCompositionEnd);
      el.removeEventListener("beforeinput", handleBeforeInput);
    };
  }, [handleCompositionStart, handleCompositionEnd, handleBeforeInput]);

  // 资源加载错误诊断
  useEffect(() => {
    const handler = (event: Event) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const el = event.target as any;
      if (el && "src" in el) {
        console.warn("[RESOURCE_DEBUG] load failed", {
          tagName: el.tagName,
          src: el.src || el.href,
        });
      }
    };
    window.addEventListener("error", handler, true);
    return () => window.removeEventListener("error", handler, true);
  }, []);

  // 初始化 Crepe（仅 currentPath 变化时重建）
  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;
    if (!container) return;

    const docKey = currentPath ?? "__new__";
    if (docKeyRef.current === docKey && crepeRef.current) return;

    const prev = crepeRef.current;
    if (prev) {
      prev.destroy();
      crepeRef.current = null;
    }
    container.innerHTML = "";

    const createStart = performance.now();

    // 异步 hydrate 图片然后创建编辑器
    const initEditor = async () => {
      if (cancelled) return;

      let displayContent = content;
      if (currentPath) {
        try {
          displayContent = await hydrateImages(content, currentPath);
        } catch (err) {
          console.warn("[TyporaEditor] image hydration failed, using raw markdown", err);
        }
      }

      if (cancelled) return;

      const crepe = new Crepe({
        root: container,
        defaultValue: displayContent,
      });
      crepeRef.current = crepe;
      docKeyRef.current = docKey;

      crepe.on((api) => {
        api.markdownUpdated((_ctx, markdown) => {
          if (!isComposingRef.current) {
            // 将 data URL 映回相对路径再输出
            const restored = restoreRelativePaths(markdown);
            onChangeRef.current(restored);
          }
        });
      });

      crepe.create().then(() => {
        console.log("[PERF][WritingMode] create editor", (performance.now() - createStart).toFixed(1), "ms");
        if (cancelled) { crepe.destroy(); return; }
        crepe.setReadonly(false);

        // 自动聚焦编辑器
        requestAnimationFrame(() => {
          const editable = container.querySelector(".ProseMirror, [contenteditable='true']");
          if (editable instanceof HTMLElement) {
            editable.focus();
          }
        });
      });
    };

    void initEditor();

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
      className="typora-editor"
      style={{ fontFamily, fontSize: `${fontSize}px` }}
    />
  );
}
