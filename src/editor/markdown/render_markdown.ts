/**
 * 模块职责：将 Markdown 文本渲染为 HTML，基于 markdown-it + highlight.js + KaTeX。
 * 输入：Markdown 原始文本、可选 currentPath、可选 imageSrcMap。
 * 输出：HTML 字符串。
 * 图片路径转换：优先使用 imageSrcMap 中的 data URL，回退 convertFileSrc。
 * 代码高亮：有语言标记时使用 highlight.js，无语言时不自动检测。
 * 数学公式：$...$ 行内 / $$...$$ 块级，由 markdown-it-katex 处理。
 */
import MarkdownIt from "markdown-it";
import { convertFileSrc } from "@tauri-apps/api/core";
import hljs from "highlight.js";
import mk from "markdown-it-katex";
import "katex/dist/katex.min.css";
import {
  safeDecodeMarkdownImageSrc,
  normalizeMarkdownImageSrc,
} from "../../services/path_service";

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
});

// ── KaTeX 数学公式 ──
md.use(mk, { throwOnError: false, errorColor: "#d73a49" });

const defaultImageRenderer = md.renderer.rules.image!.bind(md.renderer);

// ── 代码块语法高亮 ──────────────────────────

md.renderer.rules.fence = function (tokens, idx, _options, _env, _self) {
  const token = tokens[idx];
  const code = token.content;
  const lang = token.info.trim();

  // 无语言标记 → 仅 escape，不高亮
  if (!lang) {
    return `<pre><code>${md.utils.escapeHtml(code)}</code></pre>\n`;
  }

  // Mermaid 图表 → 输出占位容器，由 mermaid_renderer 后续渲染为 SVG
  if (lang.toLowerCase() === "mermaid") {
    const escapedCode = md.utils.escapeHtml(code);
    return `<div class="mermaid-block" data-mermaid-source="${md.utils.escapeHtml(code)}"><pre><code>${escapedCode}</code></pre></div>\n`;
  }

  // 有语言标记 → 尝试 highlight.js
  const langLower = lang.toLowerCase();
  try {
    if (hljs.getLanguage(langLower)) {
      const highlighted = hljs.highlight(code, { language: langLower, ignoreIllegals: true }).value;
      return `<pre><code class="hljs language-${md.utils.escapeHtml(langLower)}">${highlighted}</code></pre>\n`;
    }
  } catch {
    // highlight 失败 → fallback
  }

  // 不支持的语言 → escape + 标记语言 class
  return `<pre><code class="language-${md.utils.escapeHtml(langLower)}">${md.utils.escapeHtml(code)}</code></pre>\n`;
};

function resolveAssetPath(markdownPath: string, imageSrc: string): string {
  const decoded = safeDecodeMarkdownImageSrc(imageSrc);
  const parentDir = markdownPath.replace(/[/\\][^/\\]*$/, "");
  const cleaned = decoded
    .replace(/^\.\/+/, "")
    .replace(/\//g, "\\");
  return `${parentDir}\\${cleaned}`.replace(/\\+/g, "\\");
}

/**
 * 从 imageSrcMap 中查找匹配的 data URL。
 * 按多个可能的 key 形式依次尝试，兼容 encoded/decoded 差异。
 */
function lookupImageSrcMap(
  imageSrcMap: Record<string, string>,
  originalSrc: string,
): string | undefined {
  const decoded = safeDecodeMarkdownImageSrc(originalSrc);
  const keys = [
    originalSrc,
    decoded,
    normalizeMarkdownImageSrc(originalSrc),
    normalizeMarkdownImageSrc(decoded),
  ];
  for (const key of keys) {
    if (imageSrcMap[key]) return imageSrcMap[key];
  }
  return undefined;
}

md.renderer.rules.image = function (tokens, idx, options, env, self) {
  const token = tokens[idx];
  const originalSrc = token.attrGet("src") ?? "";
  const currentPath = env.currentPath as string | undefined;
  const imageSrcMap = env.imageSrcMap as Record<string, string> | undefined;

  // 远程 / data URI / 已转换 URL 保持不变
  if (
    /^(https?:|data:|asset:|ipc:|blob:)/i.test(originalSrc) ||
    originalSrc.includes("asset.localhost")
  ) {
    return defaultImageRenderer(tokens, idx, options, env, self);
  }

  // 优先查 imageSrcMap（兼容 encoded/decoded key）
  if (imageSrcMap) {
    const mappedSrc = lookupImageSrcMap(imageSrcMap, originalSrc);
    if (mappedSrc) {
      token.attrSet("src", mappedSrc);
      console.debug("[IMAGE_DEBUG] image src replaced by data url", {
        originalSrc,
        decodedSrc: safeDecodeMarkdownImageSrc(originalSrc),
        dataUrlPrefix: mappedSrc.slice(0, 50),
      });
      return defaultImageRenderer(tokens, idx, options, env, self);
    }

    console.debug("[IMAGE_DEBUG] image src map miss", {
      originalSrc,
      decodedSrc: safeDecodeMarkdownImageSrc(originalSrc),
      normalizedOriginal: normalizeMarkdownImageSrc(originalSrc),
      normalizedDecoded: normalizeMarkdownImageSrc(safeDecodeMarkdownImageSrc(originalSrc)),
      keys: Object.keys(imageSrcMap),
    });
  }

  // 回退 convertFileSrc
  if (currentPath) {
    try {
      const absolute = resolveAssetPath(currentPath, originalSrc);
      const assetUrl = convertFileSrc(absolute);
      if (assetUrl) {
        token.attrSet("src", assetUrl);
        console.debug("[IMAGE_DEBUG] convertFileSrc fallback", {
          originalSrc,
          absolute,
        });
      }
    } catch (err) {
      console.warn("[IMAGE_DEBUG] convertFileSrc failed:", { originalSrc, err });
    }
  }

  return defaultImageRenderer(tokens, idx, options, env, self);
};

export function extractMarkdownImageSources(content: string): string[] {
  const tokens = md.parse(content, {});
  const sources: string[] = [];
  for (const token of tokens) {
    if (token.type === "inline") {
      for (const child of token.children ?? []) {
        if (child.type === "image") {
          const src = child.attrGet("src");
          if (
            src &&
            !/^(https?:|data:|asset:|ipc:|blob:)/i.test(src) &&
            !src.includes("asset.localhost")
          ) {
            sources.push(src);
          }
        }
      }
    }
  }
  return [...new Set(sources)];
}

export function renderMarkdownToHtml(
  content: string,
  currentPath?: string | null,
  imageSrcMap?: Record<string, string>,
): string {
  const env: Record<string, unknown> = {};
  if (currentPath) env.currentPath = currentPath;
  if (imageSrcMap) {
    env.imageSrcMap = imageSrcMap;
    console.debug("[IMAGE_DEBUG] render with imageSrcMap", {
      currentPath: currentPath ?? null,
      keyCount: Object.keys(imageSrcMap).length,
      keys: Object.keys(imageSrcMap),
    });
  }
  return md.render(content, env);
}
