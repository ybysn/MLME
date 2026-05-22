/**
 * 模块职责：路径工具函数，处理跨平台路径拼接、解析和规范化。
 * 输入：Markdown 文件路径、相对资源路径。
 * 输出：规范化后的绝对路径或父目录路径。
 * 后续扩展点：macOS/Linux 路径测试、驱动器盘符处理、长路径支持。
 */

/** 从文件路径中提取父目录 */
export function getParentDir(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  const lastSlash = normalized.lastIndexOf("/");
  return lastSlash >= 0 ? normalized.slice(0, lastSlash) : ".";
}

/** 判断路径是否为绝对路径（Windows 盘符或 Unix 根路径） */
export function isAbsolutePath(path: string): boolean {
  return /^[a-zA-Z]:[/\\]/.test(path) || path.startsWith("/");
}

/**
 * 将 Markdown 中的相对图片路径解析为绝对路径。
 * 例如：markdownPath = "C:/Notes/demo.md", assetPath = "demo.assets/a.png"
 * → "C:/Notes/demo.assets/a.png"
 */
export function resolveMarkdownAssetPath(
  markdownPath: string,
  assetPath: string,
): string {
  const normalizedMd = markdownPath.replace(/\\/g, "/");
  const normalizedAsset = assetPath.replace(/\\/g, "/");
  const parentDir = getParentDir(normalizedMd);
  return `${parentDir}/${normalizedAsset}`.replace(/\/+/g, "/");
}

/** 将任意格式的路径规范化为正斜杠格式 */
export function normalizePathForTauri(path: string): string {
  return path.replace(/\\/g, "/");
}
