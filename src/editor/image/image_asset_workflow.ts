/**
 * 模块职责：统一图片资产导入工作流，不关心具体入口是 button/drop/paste。
 * 输入：File[] + markdownPath。
 * 输出：ImageAssetInsertResult[]（含 relativePath + dataUrl）。
 * 风险点：不直接修改编辑器、不直接修改 AppShell.content、不直接保存 Markdown。
 */
import { saveImageAsset, readImageAssetAsDataUrl, type ImageAssetPayload } from "../../services/asset_service";
import { filterImageFiles } from "./image_validation";

export type ImageInsertSource = "button" | "drop" | "paste";

export interface ImageAssetInsertResult {
  relativePath: string;
  assetPath: string;
  fileName: string;
  dataUrl: string;
}

export interface ImportImageFilesOptions {
  files: File[];
  markdownPath: string | null;
}

export interface ImportImageFilesOutcome {
  results: ImageAssetInsertResult[];
  errors: Array<{ fileName: string; message: string }>;
}

/**
 * 统一图片文件导入流程。
 * 校验格式 → 保存到 .assets → 读取 dataUrl → 返回结果。
 * 调用方负责将结果插入编辑器并更新 content。
 */
export async function importImageFilesForMarkdown(
  options: ImportImageFilesOptions,
): Promise<ImportImageFilesOutcome> {
  const { files, markdownPath } = options;
  const imageFiles = filterImageFiles(files);

  const results: ImageAssetInsertResult[] = [];
  const errors: Array<{ fileName: string; message: string }> = [];

  if (!markdownPath) {
    return {
      results: [],
      errors: [{ fileName: "__no_path__", message: "请先保存 Markdown 文件，再插入图片" }],
    };
  }

  for (const file of imageFiles) {
    try {
      const payload: ImageAssetPayload = await saveImageAsset(markdownPath, file);
      const dataUrl = await readImageAssetAsDataUrl(payload.asset_path);

      results.push({
        relativePath: payload.relative_path,
        assetPath: payload.asset_path,
        fileName: payload.file_name,
        dataUrl,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push({ fileName: file.name, message: msg });
    }
  }

  return { results, errors };
}
