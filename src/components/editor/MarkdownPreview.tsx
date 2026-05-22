/**
 * 模块职责：Markdown 预览组件，异步加载本地图片为 data URL 后渲染。
 * 当前输入：content、currentPath、可选的 className、onKeyDown。
 * 当前输出：渲染后的 HTML，本地图片使用 data URL。
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

export function MarkdownPreview({
  content,
  currentPath,
  className,
  onKeyDown,
}: MarkdownPreviewProps) {
  const [imageSrcMap, setImageSrcMap] = useState<Record<string, string>>({});
  const cacheRef = useRef<Map<string, string>>(new Map());
  const versionRef = useRef(0);

  useEffect(() => {
    console.debug("[IMAGE_DEBUG] MarkdownPreview props", {
      currentPath: currentPath ?? null,
      contentLength: content.length,
    });

    if (!currentPath) {
      setImageSrcMap({});
      return;
    }

    const sources = extractMarkdownImageSources(content);
    console.debug("[IMAGE_DEBUG] extracted sources", sources);

    if (sources.length === 0) {
      setImageSrcMap({});
      return;
    }

    let cancelled = false;
    const version = ++versionRef.current;
    const nextMap: Record<string, string> = {};

    Promise.all(
      sources.map(async (rawSrc) => {
        const decodedSrc = safeDecodeMarkdownImageSrc(rawSrc);
        const resolvedPath = resolveMarkdownAssetPath(currentPath, decodedSrc);

        const cached = cacheRef.current.get(resolvedPath);
        if (cached) {
          console.debug("[IMAGE_DEBUG] cache hit", { rawSrc, decodedSrc, resolvedPath });
          return { rawSrc, decodedSrc, dataUrl: cached };
        }

        try {
          const dataUrl = await readImageAssetAsDataUrl(resolvedPath);
          cacheRef.current.set(resolvedPath, dataUrl);
          console.debug("[IMAGE_DEBUG] data url loaded", {
            rawSrc,
            decodedSrc,
            resolvedPath,
            dataUrlPrefix: dataUrl.slice(0, 50),
            dataUrlLength: dataUrl.length,
          });
          return { rawSrc, decodedSrc, dataUrl };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error("[IMAGE_DEBUG] data URL load failed:", {
            rawSrc,
            decodedSrc,
            resolvedPath,
            error: msg,
          });
          return { rawSrc, decodedSrc, dataUrl: null };
        }
      }),
    ).then((results) => {
      if (cancelled || version !== versionRef.current) return;

      for (const { rawSrc, decodedSrc, dataUrl } of results) {
        if (!dataUrl) continue;

        // 写入多个 key：兼容 markdown-it render 阶段可能的 encoded/decoded 形式
        const keys = new Set([
          rawSrc,
          decodedSrc,
          normalizeMarkdownImageSrc(rawSrc),
          normalizeMarkdownImageSrc(decodedSrc),
        ]);
        for (const key of keys) {
          if (key) nextMap[key] = dataUrl;
        }
      }

      console.debug("[IMAGE_DEBUG] imageSrcMap built", {
        keyCount: Object.keys(nextMap).length,
        keys: Object.keys(nextMap),
      });

      setImageSrcMap(nextMap);
    });

    return () => {
      cancelled = true;
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
