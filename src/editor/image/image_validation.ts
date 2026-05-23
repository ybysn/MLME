/**
 * 模块职责：统一的图片格式校验，供 button/drop/paste 三种入口共用。
 * 输入：File 对象。
 * 输出：boolean + 可选错误信息。
 */
const IMAGE_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/pjpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "image/bmp",
  "image/x-icon",
  "image/vnd.microsoft.icon",
  "image/avif",
]);

const IMAGE_EXTS = new Set([
  "png", "jpg", "jpeg", "jfif", "jpe",
  "gif", "webp", "svg",
  "bmp", "ico", "avif",
]);

export const ALLOWED_IMAGE_FORMATS_STRING =
  "png, jpg, jpeg, jfif, jpe, gif, webp, svg, bmp, ico, avif";

export function isImageFile(file: File): boolean {
  if (file.type && IMAGE_MIME_TYPES.has(file.type)) return true;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return IMAGE_EXTS.has(ext);
}

export function filterImageFiles(files: File[]): File[] {
  return files.filter(isImageFile);
}
