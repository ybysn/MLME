/**
 * 模块职责：Markdown 预览组件，将 Markdown 文本实时渲染为 HTML。
 * 当前输入：content（Markdown 文本）、可选的 className、onKeyDown。
 * 当前输出：渲染后的 HTML 内容区域。
 * 安全说明：由于 render_markdown.ts 已设置 html: false，markdown-it
 *   不会渲染源码中的原始 HTML 标签，本阶段的 dangerouslySetInnerHTML
 *   风险可控。后续集成 KaTeX/Mermaid/高亮时需再次评估 XSS 面。
 * 后续扩展点：滚动同步、代码块复制按钮、图片灯箱、链接点击拦截。
 */
import { useMemo } from "react";
import { renderMarkdownToHtml } from "../../editor/markdown/render_markdown";

export interface MarkdownPreviewProps {
  content: string;
  className?: string;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}

export function MarkdownPreview({ content, className, onKeyDown }: MarkdownPreviewProps) {
  const html = useMemo(() => renderMarkdownToHtml(content), [content]);

  return (
    <div
      className={`markdown-preview ${className ?? ""}`}
      dangerouslySetInnerHTML={{ __html: html }}
      onKeyDown={onKeyDown}
      tabIndex={0}
    />
  );
}
