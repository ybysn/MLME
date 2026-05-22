/**
 * 模块职责：主布局壳组件，管理文档状态并向下分发文件操作与编辑器内容。
 * 当前输入：无（顶层组件）。
 * 当前输出：三栏布局，文件树/编辑器/大纲，以及文件操作能力。
 * 后续扩展点：快捷键绑定、自动保存、关闭未保存确认。
 */
import { useState, useCallback } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { FileTreePanel } from "../file_tree/FileTreePanel";
import { EditorPanel } from "../editor/EditorPanel";
import { OutlinePanel } from "../outline/OutlinePanel";
import { readMarkdownFile, writeMarkdownFile } from "../../services/file_service";
import {
  type DocumentState,
  createEmptyDocument,
} from "../../app/document_state";

export function AppShell() {
  const [doc, setDoc] = useState<DocumentState>(createEmptyDocument);

  const setContent = useCallback((content: string) => {
    setDoc((prev) => ({ ...prev, content, isDirty: true }));
  }, []);

  const handleNew = useCallback(() => {
    setDoc({
      currentPath: null,
      fileName: "未命名文档",
      content: "",
      isDirty: false,
      isEditing: true,
    });
  }, []);

  const handleOpen = useCallback(async () => {
    try {
      const selected = await open({
        filters: [{ name: "Markdown", extensions: ["md", "markdown"] }],
        multiple: false,
      });
      if (!selected) return;

      const filePath = selected as string;
      const payload = await readMarkdownFile(filePath);
      setDoc({
        currentPath: payload.path,
        fileName: payload.file_name,
        content: payload.content,
        isDirty: false,
        isEditing: true,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      alert(`打开文件失败: ${message}`);
    }
  }, []);

  const handleSave = useCallback(async () => {
    let targetPath = doc.currentPath;
    if (!targetPath) {
      const savePath = await save({
        filters: [{ name: "Markdown", extensions: ["md"] }],
        defaultPath: doc.fileName.endsWith(".md")
          ? doc.fileName
          : `${doc.fileName}.md`,
      });
      if (!savePath) return;
      targetPath = savePath;
    }

    try {
      await writeMarkdownFile(targetPath, doc.content);
      const name = targetPath.split(/[\\/]/).pop() ?? "unknown.md";
      setDoc({
        currentPath: targetPath,
        fileName: name,
        content: doc.content,
        isDirty: false,
        isEditing: true,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      alert(`保存文件失败: ${message}`);
    }
  }, [doc.currentPath, doc.content, doc.fileName]);

  const handleSaveAs = useCallback(async () => {
    try {
      const savePath = await save({
        filters: [{ name: "Markdown", extensions: ["md"] }],
        defaultPath: doc.fileName.endsWith(".md")
          ? doc.fileName
          : `${doc.fileName}.md`,
      });
      if (!savePath) return;

      await writeMarkdownFile(savePath, doc.content);
      const name = savePath.split(/[\\/]/).pop() ?? "unknown.md";
      setDoc({
        currentPath: savePath,
        fileName: name,
        content: doc.content,
        isDirty: false,
        isEditing: true,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      alert(`另存为失败: ${message}`);
    }
  }, [doc.content, doc.fileName]);

  return (
    <div className="app-shell">
      <aside className="app-shell__sidebar app-shell__sidebar--left">
        <FileTreePanel
          fileName={doc.fileName}
          isDirty={doc.isDirty}
          isEditing={doc.isEditing}
          onNew={handleNew}
          onOpen={handleOpen}
          onSave={handleSave}
          onSaveAs={handleSaveAs}
        />
      </aside>
      <main className="app-shell__main">
        <EditorPanel
          content={doc.content}
          fileName={doc.fileName}
          isDirty={doc.isDirty}
          isEditing={doc.isEditing}
          onContentChange={setContent}
        />
      </main>
      <aside className="app-shell__sidebar app-shell__sidebar--right">
        <OutlinePanel />
      </aside>
    </div>
  );
}
