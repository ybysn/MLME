/**
 * 模块职责：将 Markdown 文本渲染为 HTML，基于 markdown-it。
 * 输入：Markdown 原始文本。
 * 输出：HTML 字符串。
 * 为什么禁用 HTML：
 *   html: false 可防止用户 Markdown 中的 <script> 等标签被渲染执行，
 *   降低 XSS 风险。即使后续使用 dangerouslySetInnerHTML，源码中的
 *   原始 HTML 也只会被转义为纯文本。
 * 后续扩展点：
 *   - 添加 markdown-it 插件：KaTeX（markdown-it-texmath）、
 *     Mermaid（markdown-it-mermaid）、代码高亮（highlight.js）。
 *   - 通过 markdown-it 的 renderer.rules 自定义渲染规则。
 */
import MarkdownIt from "markdown-it";

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
});

/**
 * 将 Markdown 文本渲染为 HTML 字符串。
 * 使用模块级单例 md 实例，避免重复初始化。
 */
export function renderMarkdownToHtml(content: string): string {
  return md.render(content);
}
