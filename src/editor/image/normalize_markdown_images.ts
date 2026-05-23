/**
 * 模块职责：Markdown 图片路径清洗，确保 blob/data/localhost/绝对路径不写入 content。
 * 输入：markdown 字符串。
 * 输出：清洗后的 markdown 字符串。
 * 调用时机：所有 onChange / markdownUpdated / 保存前必须调用。
 */
import { extractMarkdownImageSources } from "../markdown/render_markdown";

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 清洗 Markdown 中的图片路径。
 * - 正常相对路径 → 保留
 * - http/https 外链 → 保留
 * - data:image/... → 找不到映射则 warn（保留但需调用方处理映射）
 * - blob:http://... → 移除整段图片语法，保留 alt 文本
 * - localhost:1420/asset.localhost → 尝试转为相对路径
 */
export function normalizeMarkdownImageSources(markdown: string): string {
  const sources = extractMarkdownImageSources(markdown);
  if (sources.length === 0) return markdown;

  let cleaned = markdown;

  for (const src of sources) {
    // 跳过正常外链
    if (/^https?:\/\//i.test(src) && !/localhost:\d+/.test(src) && !src.includes("asset.localhost")) {
      continue;
    }

    // blob URL —— 直接移除
    if (/^blob:/i.test(src)) {
      console.warn("[IMAGE_GUARD] blob URL removed from markdown", { src: src.slice(0, 80) });
      cleaned = cleaned.replace(
        new RegExp(`!\\[([^\\]]*)\\]\\(${escapeRegExp(src)}\\)`, "g"),
        (_m, alt: string) => alt || "",
      );
      continue;
    }

    // localhost / asset.localhost —— 尝试转回相对路径
    if (/localhost:\d+\//.test(src) || src.includes("asset.localhost") || /^asset:\/\//.test(src)) {
      try {
        const decoded = decodeURIComponent(src);
        const match = decoded.match(/[^/]+\.assets\/.+/);
        if (match) {
          const relative = match[0];
          cleaned = cleaned.replace(
            new RegExp(`!\\[([^\\]]*)\\]\\(${escapeRegExp(src)}\\)`, "g"),
            `![$1](${relative})`,
          );
          console.debug("[IMAGE_GUARD] localhost URL replaced with relative path", { src, relative });
          continue;
        }
      } catch { /* decode failed */ }
      console.warn("[IMAGE_GUARD] unsafe image source detected (localhost)", { src: src.slice(0, 80) });
      continue;
    }

    // data URL —— 不应出现（调用方应在插入前处理映射）
    if (/^data:/i.test(src)) {
      console.warn("[IMAGE_GUARD] unsafe image source detected (data URL)", { srcPrefix: src.slice(0, 60) });
      continue;
    }

    // 绝对路径
    if (/^[a-zA-Z]:[/\\]/.test(src) || src.startsWith("/")) {
      console.warn("[IMAGE_GUARD] unsafe image source detected (absolute path)", { src });
      continue;
    }
  }

  return cleaned;
}

/**
 * 检测 Markdown 中是否存在不安全图片源。
 * 返回不安全源的数量，0 表示安全。
 */
export function detectUnsafeImageSources(markdown: string): number {
  const sources = extractMarkdownImageSources(markdown);
  let count = 0;
  for (const src of sources) {
    if (
      /^blob:/i.test(src) ||
      /^data:/i.test(src) ||
      /localhost:\d+/.test(src) ||
      src.includes("asset.localhost") ||
      /^[a-zA-Z]:[/\\]/.test(src) ||
      src.startsWith("/")
    ) {
      console.warn("[IMAGE_GUARD] unsafe image source detected", { src: src.slice(0, 80) });
      count++;
    }
  }
  return count;
}
