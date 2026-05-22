/**
 * 模块职责：Markdown 预览组件，异步加载本地图片为 data URL 后渲染。
 * 当前输入：content、currentPath、可选的 className、onKeyDown。
 * 当前输出：渲染后的 HTML，本地图片使用 data URL。
 * 性能优化：debounce 渲染、全局 data URL 缓存、异步任务取消。
 */
import { useState, useEffect, useRef, useMemo } from "react";
import {
  renderMarkdownToHtml,
  extractMarkdownImageSources,
} from "../../editor/markdown/render_markdown";
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
}

/** 模块级 data URL 缓存，避免重复读取同一文件 */
const globalDataUrlCache = new Map<string, string>();

export function MarkdownPreview({
  content,
  currentPath,
  className,
  onKeyDown,
}: MarkdownPreviewProps) {
  const [imageSrcMap, setImageSrcMap] = useState<Record<string, string>>({});
  const versionRef = useRef(0);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // content / currentPath 变化时 debounce 后加载图片
  useEffect(() => {
    if (!currentPath) {
      setImageSrcMap({});
      return;
    }

    // debounce 300ms
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    debounceTimerRef.current = setTimeout(() => {
      let cancelled = false;
      const version = ++versionRef.current;
      const sources = extractMarkdownImageSources(content);
      const nextMap: Record<string, string> = {};

      if (sources.length === 0) {
        setImageSrcMap({});
        return;
      }

      console.time("[PERF] preview image data url loading");

      Promise.all(
        sources.map(async (rawSrc) => {
          if (cancelled || version !== versionRef.current) return null;

          const decodedSrc = safeDecodeMarkdownImageSrc(rawSrc);
          const resolvedPath = resolveMarkdownAssetPath(currentPath, decodedSrc);

          // 优先查全局缓存
          const cached = globalDataUrlCache.get(resolvedPath);
          if (cached) {
            return { rawSrc, decodedSrc, dataUrl: cached };
          }

          try {
            const dataUrl = await readImageAssetAsDataUrl(resolvedPath);
            globalDataUrlCache.set(resolvedPath, dataUrl);
            return { rawSrc, decodedSrc, dataUrl };
          } catch {
            return null;
          }
        }),
      ).then((results) => {
        if (cancelled || version !== versionRef.current) return;

        for (const r of results) {
          if (!r?.dataUrl) continue;
          const keys = new Set([
            r.rawSrc,
            r.decodedSrc,
            normalizeMarkdownImageSrc(r.rawSrc),
            normalizeMarkdownImageSrc(r.decodedSrc),
          ]);
          for (const key of keys) {
            if (key) nextMap[key] = r.dataUrl;
          }
        }

        console.timeEnd("[PERF] preview image data url loading");
        setImageSrcMap(nextMap);
      });

      return () => {
        cancelled = true;
      };
    }, 300);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      versionRef.current++; // 加速旧任务被取消
    };
  }, [content, currentPath]);

  const html = useMemo(
    () => renderMarkdownToHtml(content, currentPath ?? null, imageSrcMap),
    [content, currentPath, imageSrcMap],
  );

  return (
    <div
      className={`markdown-preview ${className ?? ""}`}
      dangerouslySetInnerHTML={{ __html: html }}
      onKeyDown={onKeyDown}
      tabIndex={0}
    />
  );
}
