/**
 * 模块职责：Markdown 预览组件，将 Markdown 文本实时渲染为 HTML。
 * 当前输入：content、currentPath、可选的 className、onKeyDown。
 * 当前输出：渲染后的 HTML 内容区域。
 */
import { useMemo } from "react";
import { renderMarkdownToHtml } from "../../editor/markdown/render_markdown";

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
  const html = useMemo(
    () => renderMarkdownToHtml(content, currentPath ?? null),
    [content, currentPath],
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
