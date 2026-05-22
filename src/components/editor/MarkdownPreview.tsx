/**
 * 模块职责：Markdown 预览组件，将 Markdown 文本实时渲染为 HTML，
 *   并自动将本地图片相对路径转换为 Tauri 可访问的资源 URL。
 * 当前输入：content（Markdown 文本）、currentPath（Markdown 文件路径）、可选的 className、onKeyDown。
 * 当前输出：渲染后的 HTML 内容区域，本地图片可正常显示。
 * 安全说明：由于 render_markdown.ts 已设置 html: false，markdown-it
 *   不会渲染源码中的原始 HTML 标签，本阶段的 dangerouslySetInnerHTML
 *   风险可控。
 * 后续扩展点：滚动同步、代码块复制按钮、图片灯箱、链接点击拦截。
 */
import { useMemo } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { renderMarkdownToHtml } from "../../editor/markdown/render_markdown";
import {
  resolveMarkdownAssetPath,
  normalizePathForTauri,
} from "../../services/path_service";

export interface MarkdownPreviewProps {
  content: string;
  /** 当前 Markdown 文件的绝对路径，用于解析本地相对路径图片 */
  currentPath?: string | null;
  className?: string;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}

/**
 * 将 HTML 中的图片 src 属性从相对路径转换为 Tauri asset URL。
 * 远程 URL (http/https) 和 data URI 保持不变。
 */
function resolveImageSrcs(html: string, currentPath: string): string {
  return html.replace(
    /<img\s+([^>]*?)src="([^"]*)"([^>]*)>/g,
    (_match: string, before: string, src: string, after: string) => {
      // 远程/内嵌图片保持不变
      if (/^(https?:|data:)/i.test(src)) {
        return _match;
      }

      // 将相对路径解析为绝对路径，再转为 Tauri asset URL
      try {
        const absolutePath = resolveMarkdownAssetPath(currentPath, src);
        const assetUrl = convertFileSrc(
          normalizePathForTauri(absolutePath),
        );
        return `<img ${before}src="${assetUrl}"${after}>`;
      } catch {
        // 解析失败则保持原样
        return _match;
      }
    },
  );
}

export function MarkdownPreview({
  content,
  currentPath,
  className,
  onKeyDown,
}: MarkdownPreviewProps) {
  const html = useMemo(() => {
    const raw = renderMarkdownToHtml(content);

    // 如果有文件路径，解析本地图片
    if (currentPath) {
      return resolveImageSrcs(raw, currentPath);
    }

    return raw;
  }, [content, currentPath]);

  return (
    <div
      className={`markdown-preview ${className ?? ""}`}
      dangerouslySetInnerHTML={{ __html: html }}
      onKeyDown={onKeyDown}
      tabIndex={0}
    />
  );
}
