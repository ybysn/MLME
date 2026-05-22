/**
 * 模块职责：路径工具函数，处理跨平台路径拼接、解析和规范化。
 * 输入：Markdown 文件路径、相对资源路径。
 * 输出：规范化后的绝对路径或父目录路径。
 * 后续扩展点：macOS/Linux 路径测试、驱动器盘符处理、长路径支持。
 */

/** 从文件路径中提取父目录（不含末尾斜杠） */
export function getParentDir(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  const lastSlash = normalized.lastIndexOf("/");
  return lastSlash >= 0 ? normalized.slice(0, lastSlash) : ".";
}

/** 判断 src 是否为远程 URL */
export function isRemoteUrl(src: string): boolean {
  return /^https?:\/\//i.test(src);
}

/** 判断 src 是否为 data URI */
export function isDataUrl(src: string): boolean {
  return /^data:/i.test(src);
}

/** 判断 src 是否为 Tauri asset 协议 URL */
export function isAssetUrl(src: string): boolean {
  return /^(asset:|https?:\/\/asset\.localhost)/i.test(src);
}

/** 判断 src 是否为 Windows 绝对路径（盘符开头） */
export function isWindowsAbsolutePath(src: string): boolean {
  return /^[a-zA-Z]:[/\\]/.test(src);
}

/** 判断 src 是否为 Unix 绝对路径（/ 开头） */
export function isUnixAbsolutePath(src: string): boolean {
  return src.startsWith("/");
}

/** 判断 src 是否需要转换（非远程、非 data、非 asset） */
export function isLocalPath(src: string): boolean {
  return !isRemoteUrl(src) && !isDataUrl(src) && !isAssetUrl(src);
}

/**
 * 将 Markdown 中的相对图片路径解析为绝对路径。
 * 例如：markdownPath = "C:\Notes\demo.md", assetPath = "demo.assets\a.png"
 * → "C:\Notes\demo.assets\a.png"
 *
 * 相对路径中的 ./ 会被去除，/ 会根据平台转换。
 */
export function resolveMarkdownAssetPath(
  markdownPath: string,
  assetPath: string,
): string {
  const normalizedMd = markdownPath.replace(/\\/g, "/");
  // 去除相对路径开头的 ./
  const cleaned = assetPath.replace(/^\.\/+/, "").replace(/\\/g, "/");
  const parentDir = getParentDir(normalizedMd);
  // 拼接并去除多余的 /
  return `${parentDir}/${cleaned}`.replace(/\/+/g, "/");
}

/** 将路径规范化为 convertFileSrc 友好格式（Windows 保留反斜杠） */
export function normalizePathForTauri(path: string): string {
  // convertFileSrc 内部可能使用 encodeURIComponent 编码路径，
  // Windows 下反斜杠不会被编码为 %2F，保持路径层级结构。
  return path.replace(/\//g, "\\");
}
