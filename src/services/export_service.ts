/**
 * 模块职责：Markdown 导出为完整 HTML 文件。
 * 输入：Markdown 内容、当前文件路径、文件名。
 * 输出：完整 HTML 文档字符串（含内联 CSS 和 data URL 图片）。
 */
import {
  renderMarkdownToHtml,
  extractMarkdownImageSources,
} from "../editor/markdown/render_markdown";
import {
  resolveMarkdownAssetPath,
  safeDecodeMarkdownImageSrc,
} from "../services/path_service";
import { readImageAssetAsDataUrl } from "../services/asset_service";

export interface ExportHtmlOptions {
  content: string;
  currentPath?: string | null;
  fileName?: string | null;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getExportTitle(fileName?: string | null): string {
  if (fileName) {
    const stem = fileName.replace(/\.[^.]+$/, "");
    if (stem) return escapeHtml(stem);
  }
  return "Untitled Markdown Document";
}

const EXPORT_CSS = `
body {
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
    "Microsoft YaHei", sans-serif;
  max-width: 860px;
  margin: 0 auto;
  padding: 32px 24px;
  font-size: 17px;
  line-height: 1.75;
  color: #1f2937;
  background-color: #ffffff;
}
h1, h2, h3, h4, h5, h6 { margin-top: 1.4em; margin-bottom: 0.5em; font-weight: 600; line-height: 1.35; }
h1 { font-size: 1.7em; border-bottom: 1px solid #e5e7eb; padding-bottom: 0.3em; }
h2 { font-size: 1.4em; border-bottom: 1px solid #e5e7eb; padding-bottom: 0.25em; }
h3 { font-size: 1.2em; }
p { margin-bottom: 0.75em; }
blockquote { margin: 0.5em 0; padding: 0.5em 1em; border-left: 3px solid #4a7cf7; color: #4b5563; background: #f9fafb; border-radius: 0 4px 4px 0; }
ul, ol { margin-bottom: 0.75em; padding-left: 1.5em; }
li { margin-bottom: 0.25em; }
code { padding: 0.15em 0.4em; font-size: 0.9em; font-family: "Cascadia Code", "Fira Code", "JetBrains Mono", "Consolas", monospace; background: #f3f4f6; border-radius: 3px; }
pre { margin: 0.75em 0; padding: 14px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 4px; overflow-x: auto; }
pre code { padding: 0; background: none; font-size: 14px; line-height: 1.5; }
table { width: 100%; margin: 0.75em 0; border-collapse: collapse; font-size: 14px; }
th, td { padding: 6px 12px; border: 1px solid #d1d5db; text-align: left; }
th { background: #f9fafb; font-weight: 600; }
tr:nth-child(even) { background: #f9fafb; }
a { color: #4a7cf7; text-decoration: none; }
a:hover { text-decoration: underline; }
img { display: block; max-width: 100%; height: auto; margin: 16px 0; }
hr { margin: 1em 0; border: none; border-top: 1px solid #e5e7eb; }
strong { font-weight: 600; }
em { font-style: italic; }

/* 代码高亮 */
.hljs-comment, .hljs-quote { color: #8a8fa0; font-style: italic; }
.hljs-keyword, .hljs-selector-tag, .hljs-type { color: #d73a49; }
.hljs-string, .hljs-addition { color: #22863a; }
.hljs-number, .hljs-literal { color: #005cc5; }
.hljs-title, .hljs-section, .hljs-selector-id { color: #6f42c1; }
.hljs-attr, .hljs-attribute, .hljs-variable, .hljs-template-variable { color: #e36209; }
.hljs-name, .hljs-built_in, .hljs-builtin-name { color: #005cc5; }
.hljs-meta, .hljs-meta-keyword { color: #8a8fa0; }
.hljs-symbol, .hljs-bullet, .hljs-link { color: #d73a49; }
.hljs-deletion { color: #d73a49; }
.hljs-emphasis { font-style: italic; }
.hljs-strong { font-weight: 600; }
.hljs-doctag, .hljs-formula { color: #6f42c1; }
.hljs-params { color: #24292e; }
.hljs-property { color: #005cc5; }
.hljs-regexp { color: #22863a; }
.hljs-selector-class, .hljs-selector-pseudo { color: #6f42c1; }
.hljs-tag { color: #22863a; }

/* KaTeX 数学公式 */
.katex { font-size: 1.1em; }
.katex-display { display: block; margin: 1em 0; text-align: center; }
.katex-display > .katex { display: inline-block; white-space: nowrap; max-width: 100%; overflow-x: auto; }
.katex-html { display: none; }
`.trim();

export async function exportMarkdownToHtml(
  options: ExportHtmlOptions,
): Promise<string> {
  const { content, currentPath, fileName } = options;
  const title = getExportTitle(fileName);

  // 构建 imageSrcMap：本地图片 → data URL
  const imageSrcMap: Record<string, string> = {};

  if (currentPath) {
    const sources = extractMarkdownImageSources(content);
    const results = await Promise.all(
      sources.map(async (src) => {
        const decodedSrc = safeDecodeMarkdownImageSrc(src);
        try {
          const absolute = resolveMarkdownAssetPath(currentPath, decodedSrc);
          const dataUrl = await readImageAssetAsDataUrl(absolute);
          return { src, dataUrl } as const;
        } catch {
          return null;
        }
      }),
    );
    for (const r of results) {
      if (r) imageSrcMap[r.src] = r.dataUrl;
    }
  }

  const bodyHtml = renderMarkdownToHtml(content, currentPath ?? null, imageSrcMap);

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>${EXPORT_CSS}</style>
</head>
<body>
  <main class="markdown-body">
${bodyHtml}
  </main>
</body>
</html>`;
}

const PRINT_CSS = `
@page { size: A4; margin: 18mm 16mm; }
body {
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
    "Microsoft YaHei", sans-serif;
  font-size: 14px;
  line-height: 1.75;
  color: #111827;
  background: #ffffff;
}
main.markdown-body { max-width: none; margin: 0; padding: 0; }
h1, h2, h3 { page-break-after: avoid; break-after: avoid; font-weight: 600; }
h1 { font-size: 1.6em; border-bottom: 1px solid #d1d5db; padding-bottom: 0.3em; }
h2 { font-size: 1.35em; border-bottom: 1px solid #e5e7eb; padding-bottom: 0.25em; }
h3 { font-size: 1.15em; }
pre, table, blockquote, img { break-inside: avoid; }
code { font-family: Consolas, "Courier New", monospace; }
pre { padding: 12px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 4px; overflow-x: auto; }
pre code { padding: 0; background: none; }
blockquote { margin: 0.5em 0; padding: 0.5em 1em; border-left: 3px solid #4a7cf7; color: #4b5563; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th, td { padding: 5px 10px; border: 1px solid #d1d5db; text-align: left; }
th { background: #f3f4f6; font-weight: 600; }
img { max-width: 100%; height: auto; display: block; margin: 12px 0; }
a { color: #4a7cf7; }
p { margin-bottom: 0.6em; }
ul, ol { padding-left: 1.5em; }

/* 代码高亮 */
.hljs-comment, .hljs-quote { color: #6a6f7e; font-style: italic; }
.hljs-keyword, .hljs-selector-tag, .hljs-type { color: #b91c1c; }
.hljs-string, .hljs-addition { color: #166534; }
.hljs-number, .hljs-literal { color: #1e40af; }
.hljs-title, .hljs-section, .hljs-selector-id { color: #5b21b6; }
.hljs-attr, .hljs-attribute, .hljs-variable, .hljs-template-variable { color: #9a3412; }
.hljs-name, .hljs-built_in, .hljs-builtin-name { color: #1e40af; }
.hljs-meta, .hljs-meta-keyword { color: #6a6f7e; }
.hljs-symbol, .hljs-bullet, .hljs-link { color: #b91c1c; }
.hljs-deletion { color: #b91c1c; }
.hljs-emphasis { font-style: italic; }
.hljs-strong { font-weight: 600; }
.hljs-doctag, .hljs-formula { color: #5b21b6; }
.hljs-property { color: #1e40af; }
.hljs-regexp { color: #166534; }
.hljs-selector-class, .hljs-selector-pseudo { color: #5b21b6; }
.hljs-tag { color: #166534; }

/* KaTeX 数学公式 */
.katex { font-size: 1.1em; }
.katex-display { display: block; margin: 1em 0; text-align: center; }
.katex-display > .katex { display: inline-block; white-space: nowrap; max-width: 100%; overflow-x: auto; }
.katex-html { display: none; }
`.trim();

export async function buildPrintableHtml(
  options: ExportHtmlOptions,
): Promise<string> {
  const { content, currentPath, fileName } = options;
  const title = getExportTitle(fileName);

  const imageSrcMap: Record<string, string> = {};
  if (currentPath) {
    const sources = extractMarkdownImageSources(content);
    const results = await Promise.all(
      sources.map(async (src) => {
        try {
          const decodedSrc = safeDecodeMarkdownImageSrc(src);
          const absolute = resolveMarkdownAssetPath(currentPath, decodedSrc);
          const dataUrl = await readImageAssetAsDataUrl(absolute);
          return { src, dataUrl } as const;
        } catch {
          return null;
        }
      }),
    );
    for (const r of results) {
      if (r) imageSrcMap[r.src] = r.dataUrl;
    }
  }

  const bodyHtml = renderMarkdownToHtml(content, currentPath ?? null, imageSrcMap);

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
  <style>${PRINT_CSS}</style>
</head>
<body>
  <main class="markdown-body">
${bodyHtml}
  </main>
</body>
</html>`;
}
