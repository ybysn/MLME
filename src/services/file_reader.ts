/**
 * 模块职责：读取 File 对象内容为 Vec<u8>，用于传递给 Tauri command。
 * 仅供 asset_service 内部使用。
 */

export async function readFileAsBytes(file: File): Promise<number[]> {
  const buffer = await file.arrayBuffer();
  return Array.from(new Uint8Array(buffer));
}
