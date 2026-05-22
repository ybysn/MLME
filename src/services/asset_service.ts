/**
 * 模块职责：封装图片资产保存操作，提供类型安全的 Tauri command 调用。
 * 输入：Markdown 文件路径、File 对象。
 * 输出：ImageAssetPayload（含相对路径、文件名等）。
 * 风险点：组件层不应直接使用此服务，应由编辑器层或 hook 层调用。
 */
import { invoke } from "@tauri-apps/api/core";
import { readFileAsBytes } from "./file_reader";

export interface ImageAssetPayload {
  asset_path: string;
  relative_path: string;
  file_name: string;
}

/**
 * 将图片文件保存到 Markdown 文件同名的 .assets 目录。
 * @param markdownPath 当前 Markdown 文件的绝对路径
 * @param file 浏览器 File 对象（来自拖拽或粘贴）
 * @returns 包含相对路径的资产信息
 */
export async function saveImageAsset(
  markdownPath: string,
  file: File,
): Promise<ImageAssetPayload> {
  const bytes = await readFileAsBytes(file);
  return invoke<ImageAssetPayload>("save_image_asset", {
    markdownPath,
    originalFileName: file.name,
    bytes,
  });
}
