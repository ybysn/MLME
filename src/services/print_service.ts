/**
 * 模块职责：打印/PDF 导出服务，复用 HTML 导出渲染链路。
 * 输入：Markdown 内容、当前文件路径、文件名。
 * 输出：打开系统打印对话框，用户可另存为 PDF。
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

export interface PrintOptions {
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

function getPrintTitle(fileName?: string | null): string {
  if (fileName) {
    const stem = fileName.replace(/\.[^.]+$/, "");
    if (stem) return escapeHtml(stem);
  }
  return "Untitled Markdown Document";
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
code { font-family: Consolas, "Courier New", monospace; font-size: 0.9em; }
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
`.trim();

/** 等待文档内所有图片加载完成或超时 */
function waitForImages(doc: Document, timeoutMs = 3000): Promise<void> {
  const images = Array.from(doc.images);
  if (images.length === 0) return Promise.resolve();

  let pending = images.length;
  return new Promise<void>((resolve) => {
    const timer = setTimeout(() => resolve(), timeoutMs);
    for (const img of images) {
      if (img.complete) {
        pending--;
        if (pending === 0) { clearTimeout(timer); resolve(); }
        continue;
      }
      const done = () => {
        pending--;
        if (pending === 0) { clearTimeout(timer); resolve(); }
      };
      img.addEventListener("load", done, { once: true });
      img.addEventListener("error", done, { once: true });
    }
  });
}

async function buildPrintableHtml(options: PrintOptions): Promise<string> {
  const { content, currentPath, fileName } = options;
  const title = getPrintTitle(fileName);

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

export async function printMarkdownDocument(options: PrintOptions): Promise<void> {
  const html = await buildPrintableHtml(options);

  // 隐藏 iframe 方案
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument!;
  doc.open();
  doc.write(html);
  doc.close();

  await waitForImages(doc);
  iframe.contentWindow!.print();

  // 打印后清理
  setTimeout(() => {
    document.body.removeChild(iframe);
  }, 500);
}
