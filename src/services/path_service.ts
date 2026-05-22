/**
 * 模块职责：路径工具函数，处理跨平台路径拼接、解析和规范化。
 * 输入：Markdown 文件路径、相对资源路径。
 * 输出：规范化后的绝对路径或父目录路径。
 */
export function getParentDir(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  const lastSlash = normalized.lastIndexOf("/");
  return lastSlash >= 0 ? normalized.slice(0, lastSlash) : ".";
}

export function isRemoteUrl(src: string): boolean {
  return /^https?:\/\//i.test(src);
}

export function isDataUrl(src: string): boolean {
  return /^data:/i.test(src);
}

export function isAssetUrl(src: string): boolean {
  return /^(asset:|https?:\/\/asset\.localhost)/i.test(src);
}

export function isWindowsAbsolutePath(src: string): boolean {
  return /^[a-zA-Z]:[/\\]/.test(src);
}

export function isUnixAbsolutePath(src: string): boolean {
  return src.startsWith("/");
}

export function isLocalPath(src: string): boolean {
  return !isRemoteUrl(src) && !isDataUrl(src) && !isAssetUrl(src);
}

/**
 * 将 markdown-it 可能编码的图片路径还原为可读文本。
 * markdown-it 会把中文等非 ASCII 字符 encodeURIComponent，
 * 导致路径字符串被编码（如 %E6%9C%AA...）。此函数还原为原始文本。
 * 远程 URL / data URI / asset URL 不处理。
 */
export function safeDecodeMarkdownImageSrc(src: string): string {
  if (/^(https?:|data:|asset:|ipc:|blob:)/i.test(src)) return src;
  if (src.includes("asset.localhost")) return src;

  // 尝试 decodeURIComponent（markdown-it 默认编码方式）
  try {
    const decoded = decodeURIComponent(src);
    // 如果 decode 后与原值不同，说明确实被编码过
    if (decoded !== src) return decoded;
  } catch {
    // decodeURIComponent 失败，可能只做了部分编码
  }

  // 回退尝试 decodeURI
  try {
    const decoded = decodeURI(src);
    if (decoded !== src) return decoded;
  } catch {
    // 两种解码都失败，保持原值
  }

  return src;
}

/**
 * 规范化图片 src 用于 imageSrcMap key 对齐。
 * - trim
 * - 反斜杠转正斜杠
 * - 去除开头的 ./
 * - decodeURIComponent
 */
export function normalizeMarkdownImageSrc(src: string): string {
  let s = src.trim().replace(/\\/g, "/");
  s = s.replace(/^\.\/+/, "");
  try {
    s = decodeURIComponent(s);
  } catch { /* not encoded, ok */ }
  return s;
}

export function resolveMarkdownAssetPath(
  markdownPath: string,
  assetPath: string,
): string {
  // 先 decode 图片路径（markdown-it 可能已编码中文）
  const decodedPath = safeDecodeMarkdownImageSrc(assetPath);

  const normalizedMd = markdownPath.replace(/\\/g, "/");
  const cleaned = decodedPath
    .replace(/^\.\/+/, "")
    .replace(/\\/g, "/");
  const parentDir = getParentDir(normalizedMd);
  const resolvedPath = `${parentDir}/${cleaned}`.replace(/\/+/g, "/");

  console.debug("[IMAGE_DEBUG] resolveMarkdownAssetPath", {
    markdownPath,
    imageSrc: assetPath,
    decodedSrc: decodedPath,
    parentDir,
    resolvedPath,
  });

  return resolvedPath;
}

export function normalizePathForTauri(path: string): string {
  return path.replace(/\//g, "\\");
}
