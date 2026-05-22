/**
 * 模块职责：将 Markdown 文本渲染为 HTML，基于 markdown-it。
 * 输入：Markdown 原始文本、可选当前文件路径（用于解析本地图片）。
 * 输出：HTML 字符串，本地图片 src 已转为 Tauri asset URL。
 * 图片路径转换在 markdown-it 渲染阶段完成，不在 HTML 后处理。
 */
import MarkdownIt from "markdown-it";
import { convertFileSrc } from "@tauri-apps/api/core";
import { invoke } from "@tauri-apps/api/core";

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
});

/* 保存默认 image renderer 引用，避免自定义规则中递归 */
const defaultImageRenderer = md.renderer.rules.image!.bind(md.renderer);

/**
 * 基于 Markdown 文件路径解析相对图片路径为绝对路径。
 * 使用反斜杠作为分隔符（Windows 下 convertFileSrc 不会将 \ 编码为 %2F）。
 */
function resolveAssetPath(markdownPath: string, imageSrc: string): string {
  // 获取 Markdown 文件所在目录（兼容正斜杠和反斜杠）
  const parentDir = markdownPath.replace(/[/\\][^/\\]*$/, "");
  // 清理相对路径前缀，统一使用反斜杠
  const cleaned = imageSrc
    .replace(/^\.\/+/, "")
    .replace(/\//g, "\\");
  return `${parentDir}\\${cleaned}`.replace(/\\+/g, "\\");
}

/**
 * 自定义图片渲染规则。
 * 若 env.currentPath 存在，则将 Markdown 中的相对图片路径
 * 解析为绝对路径并通过 Tauri convertFileSrc 转换为 asset URL。
 */
md.renderer.rules.image = function (tokens, idx, options, env, self) {
  const token = tokens[idx];
  const originalSrc = token.attrGet("src") ?? "";
  const currentPath = env.currentPath as string | undefined;

  if (
    currentPath &&
    originalSrc &&
    !/^(https?:|data:|asset:|ipc:|blob:)/i.test(originalSrc) &&
    !originalSrc.includes("asset.localhost")
  ) {
    try {
      const isAbs =
        /^[a-zA-Z]:[/\\]/.test(originalSrc) || originalSrc.startsWith("/");
      const absolute = isAbs
        ? originalSrc
        : resolveAssetPath(currentPath, originalSrc);

      // 调试：验证 resolvedPath 是否真实存在
      invoke<boolean>("file_exists", { path: absolute }).then((exists) => {
        console.debug("[render_markdown] file_exists check", {
          resolvedPath: absolute,
          exists,
        });
      });

      const assetUrl = convertFileSrc(absolute);

      if (assetUrl) {
        token.attrSet("src", assetUrl);
      }
    } catch (err) {
      console.warn("[render_markdown] convertFileSrc failed:", {
        originalSrc,
        currentPath,
        err,
      });
    }
  }

  return defaultImageRenderer(tokens, idx, options, env, self);
};

/**
 * 将 Markdown 文本渲染为 HTML 字符串。
 * @param content Markdown 原始文本
 * @param currentPath 可选：当前 Markdown 文件路径，用于解析本地图片
 */
export function renderMarkdownToHtml(
  content: string,
  currentPath?: string | null,
): string {
  const env: Record<string, unknown> = {};
  if (currentPath) {
    env.currentPath = currentPath;
  }
  return md.render(content, env);
}
