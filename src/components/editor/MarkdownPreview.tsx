/**
 * 模块职责：Markdown 预览组件，支持查找高亮。
 */
import { useState, useEffect, useRef, useMemo } from "react";
import {
  renderMarkdownToHtml,
  extractMarkdownImageSources,
} from "../../editor/markdown/render_markdown";
import { renderMermaidBlocks } from "../../editor/markdown/mermaid_renderer";
import {
  resolveMarkdownAssetPath,
  safeDecodeMarkdownImageSrc,
  normalizeMarkdownImageSrc,
} from "../../services/path_service";
import { readImageAssetAsDataUrl } from "../../services/asset_service";

export interface MarkdownPreviewProps {
  content: string;
  currentPath?: string | null;
  className?: string;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  /** 查找高亮 */
  findQuery?: string;
  activeMatchIndex?: number;
  caseSensitive?: boolean;
  enableFindHighlight?: boolean;
}

const globalDataUrlCache = new Map<string, string>();

/** 在容器文本节点中高亮查找关键词 */
function highlightFindMatches(
  container: HTMLElement,
  query: string,
  caseSensitive: boolean,
  activeIndex: number,
) {
  // 清除旧高亮
  container.querySelectorAll("mark.preview-find-match").forEach((m) => {
    const parent = m.parentNode;
    if (parent) {
      parent.replaceChild(document.createTextNode(m.textContent ?? ""), m);
      parent.normalize();
    }
  });

  if (!query) return;

  const target = caseSensitive ? query : query.toLowerCase();
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    if (node.parentElement?.closest("script,style,pre,code")) continue;
    textNodes.push(node);
  }

  let globalIdx = 0;
  for (const node of textNodes) {
    const text = node.textContent ?? "";
    const source = caseSensitive ? text : text.toLowerCase();
    if (!source.includes(target)) continue;

    const fragment = document.createDocumentFragment();
    let remaining = text;
    let pos = 0;

    while (pos < source.length) {
      const idx = source.indexOf(target, pos);
      if (idx === -1) {
        fragment.appendChild(document.createTextNode(remaining.slice(idx - remaining.indexOf(remaining))));
        // append rest
        const restStart = pos;
        if (restStart < text.length) {
          fragment.appendChild(document.createTextNode(text.slice(restStart)));
        }
        break;
      }
      // text before match
      if (idx > pos) {
        fragment.appendChild(document.createTextNode(text.slice(pos, idx)));
      }
      // match
      const mark = document.createElement("mark");
      mark.className = "preview-find-match";
      if (globalIdx === activeIndex) {
        mark.classList.add("active");
      }
      mark.textContent = text.slice(idx, idx + target.length);
      fragment.appendChild(mark);
      pos = idx + target.length;
      globalIdx++;
    }
    node.parentNode?.replaceChild(fragment, node);
  }

  // 滚动到 active match
  const active = container.querySelector(".preview-find-match.active") as HTMLElement | null;
  if (active) {
    active.scrollIntoView({ block: "center", behavior: "smooth" });
  }
}

export function MarkdownPreview({
  content,
  currentPath,
  className,
  onKeyDown,
  findQuery,
  activeMatchIndex = 0,
  caseSensitive = false,
  enableFindHighlight = false,
}: MarkdownPreviewProps) {
  const [imageSrcMap, setImageSrcMap] = useState<Record<string, string>>({});
  const versionRef = useRef(0);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!currentPath) { setImageSrcMap({}); return; }
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      let cancelled = false;
      const version = ++versionRef.current;
      const sources = extractMarkdownImageSources(content);
      const nextMap: Record<string, string> = {};
      if (sources.length === 0) { setImageSrcMap({}); return; }
      Promise.all(
        sources.map(async (rawSrc) => {
          if (cancelled || version !== versionRef.current) return null;
          const decodedSrc = safeDecodeMarkdownImageSrc(rawSrc);
          const resolvedPath = resolveMarkdownAssetPath(currentPath, decodedSrc);
          const cached = globalDataUrlCache.get(resolvedPath);
          if (cached) return { rawSrc, decodedSrc, dataUrl: cached };
          try {
            const dataUrl = await readImageAssetAsDataUrl(resolvedPath);
            globalDataUrlCache.set(resolvedPath, dataUrl);
            return { rawSrc, decodedSrc, dataUrl };
          } catch { return null; }
        }),
      ).then((results) => {
        if (cancelled || version !== versionRef.current) return;
        for (const r of results) {
          if (!r?.dataUrl) continue;
          const keys = new Set([r.rawSrc, r.decodedSrc, normalizeMarkdownImageSrc(r.rawSrc), normalizeMarkdownImageSrc(r.decodedSrc)]);
          for (const key of keys) { if (key) nextMap[key] = r.dataUrl; }
        }
        setImageSrcMap(nextMap);
      });
      return () => { cancelled = true; };
    }, 300);
    return () => { if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current); versionRef.current++; };
  }, [content, currentPath]);

  const html = useMemo(
    () => renderMarkdownToHtml(content, currentPath ?? null, imageSrcMap),
    [content, currentPath, imageSrcMap],
  );

  // 查找高亮 effect（debounce 100ms）
  useEffect(() => {
    if (!enableFindHighlight || !findQuery || !containerRef.current) return;
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => {
      if (containerRef.current) {
        highlightFindMatches(containerRef.current, findQuery, caseSensitive, activeMatchIndex);
      }
    }, 100);
    return () => { if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current); };
  }, [html, findQuery, activeMatchIndex, caseSensitive, enableFindHighlight]);

  // 清理高亮定时器
  useEffect(() => {
    return () => {
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    };
  }, []);

  // ── Mermaid 图表渲染 ──
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const theme = (document.documentElement.getAttribute("data-theme") as "light" | "dark") ?? "light";
    let cancelled = false;

    const run = async () => {
      try {
        await renderMermaidBlocks(container, theme);
      } catch {
        // 渲染失败不影响其他内容
      }
      // mermaid.render 是异步的，可能在 React 重新渲染期间完成
      if (cancelled) return;
    };

    void run();
    return () => { cancelled = true; };
  }, [html]);

  return (
    <div
      ref={containerRef}
      className={`markdown-preview ${className ?? ""}`}
      dangerouslySetInnerHTML={{ __html: html }}
      onKeyDown={onKeyDown}
      tabIndex={0}
    />
  );
}
