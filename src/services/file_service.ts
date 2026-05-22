/**
 * 模块职责：封装 Markdown 文件读写操作，提供类型安全的 Tauri command 调用。
 * 输入：文件路径、Markdown 文本。
 * 输出：标准化文件操作结果。
 * 风险点：组件层不应直接使用此服务，应由 app 层或 hook 层调用。
 */
import { invoke } from "@tauri-apps/api/core";

export interface MarkdownFilePayload {
  path: string;
  file_name: string;
  content: string;
}

export async function readMarkdownFile(path: string): Promise<MarkdownFilePayload> {
  return invoke<MarkdownFilePayload>("read_markdown_file", { path });
}

export async function writeMarkdownFile(path: string, content: string): Promise<void> {
  return invoke<void>("write_markdown_file", { path, content });
}

/** 工作区文件树节点 */
export interface MarkdownTreeItem {
  path: string;
  file_name: string;
  relative_path: string;
  is_dir: boolean;
  children: MarkdownTreeItem[] | null;
}

/**
 * 扫描文件夹，返回仅含 .md/.markdown 的文件树。
 */
export async function listMarkdownFilesInFolder(
  folderPath: string,
): Promise<MarkdownTreeItem[]> {
  return invoke<MarkdownTreeItem[]>("list_markdown_files_in_folder", {
    folderPath,
  });
}

/** 将 HTML 内容写入 .html 文件 */
export async function writeHtmlFile(path: string, content: string): Promise<void> {
  return invoke<void>("write_html_file", { path, content });
}

/** 将 HTML 内容直接导出为 PDF（调用 Edge/Chrome headless） */
export async function exportHtmlToPdf(html: string, outputPath: string): Promise<void> {
  return invoke<void>("export_html_to_pdf", { html, outputPath });
}

/** 创建空 Markdown 文件 */
export async function createMarkdownFile(path: string): Promise<void> {
  return invoke<void>("create_markdown_file", { path });
}

/** 创建文件夹 */
export async function createFolder(path: string): Promise<void> {
  return invoke<void>("create_folder", { path });
}

/** 重命名文件或目录 */
export async function renamePath(oldPath: string, newPath: string): Promise<void> {
  return invoke<void>("rename_path", { oldPath, newPath });
}

/** 删除文件或目录 */
export async function deletePath(path: string): Promise<void> {
  return invoke<void>("delete_path", { path });
}
