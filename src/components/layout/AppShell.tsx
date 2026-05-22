/**
 * 模块职责：主布局壳组件，管理文档状态并向下分发文件操作与编辑器内容。
 * 当前输入：无（顶层组件）。
 * 当前输出：
 *   - 无活动文档时：欢迎页（WelcomeScreen）
 *   - 有活动文档时：两栏布局（左侧 SidebarPanel + 中间 EditorPanel）
 * 后续扩展点：关闭未保存确认、自动保存。
 */
import { useState, useCallback, useMemo, useRef } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { WelcomeScreen } from "./WelcomeScreen";
import { SidebarPanel } from "./SidebarPanel";
import {
  EditorPanel,
  type EditorPanelHandle,
} from "../editor/EditorPanel";
import { readMarkdownFile, writeMarkdownFile } from "../../services/file_service";
import {
  type DocumentState,
  type DocumentStats,
  createEmptyDocument,
  getDocumentStats,
} from "../../app/document_state";
import {
  parseMarkdownOutline,
  type MarkdownOutlineItem,
} from "../../editor/markdown/parse_outline";
import {
  loadRecentFiles,
  addRecentFile,
  removeRecentFile,
  type RecentFileItem,
} from "../../services/recent_files_service";

/** 从对话框返回值中提取路径字符串 */
function extractDialogPath(result: string | { path: string } | null): string | null {
  if (!result) return null;
  if (typeof result === "string") return result;
  if (typeof result === "object" && "path" in result) return result.path;
  return null;
}

function extractFileName(fullPath: string): string {
  return fullPath.split(/[\\/]/).pop() ?? "unknown.md";
}

export function AppShell() {
  const [doc, setDoc] = useState<DocumentState>(createEmptyDocument);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [recentFiles, setRecentFiles] = useState<RecentFileItem[]>(loadRecentFiles);
  const editorRef = useRef<EditorPanelHandle>(null);

  const hasActiveDocument = doc.isEditing;

  const toggleSidebar = useCallback(() => {
    setIsSidebarVisible((prev) => !prev);
  }, []);

  const outlineResult = useMemo(() => {
    const items = parseMarkdownOutline(doc.content);
    const stats = getDocumentStats(doc.content, items.length);
    return { items, stats } as { items: MarkdownOutlineItem[]; stats: DocumentStats };
  }, [doc.content]);

  const setContent = useCallback((content: string) => {
    setDoc((prev) => ({ ...prev, content, isDirty: true }));
  }, []);

  const handleSelectOutlineItem = useCallback((item: MarkdownOutlineItem) => {
    editorRef.current?.scrollToLine(item.line);
  }, []);

  // ── 最近文件操作 ──────────────────────────────

  const addToRecent = useCallback(
    (filePath: string, name?: string) => {
      const fileName = name ?? extractFileName(filePath);
      setRecentFiles((prev) => addRecentFile(prev, filePath, fileName));
    },
    [],
  );

  const handleOpenRecentFile = useCallback(
    async (filePath: string) => {
      try {
        const payload = await readMarkdownFile(filePath);
        setDoc({
          currentPath: payload.path,
          fileName: payload.file_name,
          content: payload.content,
          isDirty: false,
          isEditing: true,
        });
        addToRecent(payload.path, payload.file_name);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        alert(`打开文件失败: ${message}`);
        setRecentFiles((prev) => removeRecentFile(prev, filePath));
      }
    },
    [addToRecent],
  );

  // ── 文件操作 ──────────────────────────────────

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
      addToRecent(payload.path, payload.file_name);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      alert(`打开文件失败: ${message}`);
    }
  }, [addToRecent]);

  const handleSave = useCallback(async () => {
    let targetPath = doc.currentPath;
    const isFirstSave = !targetPath;
    if (isFirstSave) {
      const raw = await save({
        filters: [{ name: "Markdown", extensions: ["md"] }],
        defaultPath: doc.fileName.endsWith(".md")
          ? doc.fileName
          : `${doc.fileName}.md`,
      });
      const savePath = extractDialogPath(raw);
      if (!savePath) return;
      targetPath = savePath;
    }
    // targetPath is guaranteed to be a string at this point
    const resolvedPath: string = targetPath!;

    try {
      await writeMarkdownFile(resolvedPath, doc.content);
      const name = extractFileName(resolvedPath);
      setDoc({
        currentPath: resolvedPath,
        fileName: name,
        content: doc.content,
        isDirty: false,
        isEditing: true,
      });
      if (isFirstSave) addToRecent(resolvedPath, name);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      alert(`保存文件失败: ${message}`);
    }
  }, [doc.currentPath, doc.content, doc.fileName, addToRecent]);

  const handleSaveAs = useCallback(async () => {
    try {
      const raw = await save({
        filters: [{ name: "Markdown", extensions: ["md"] }],
        defaultPath: doc.fileName.endsWith(".md")
          ? doc.fileName
          : `${doc.fileName}.md`,
      });
      const savePath = extractDialogPath(raw);
      if (!savePath) return;

      await writeMarkdownFile(savePath, doc.content);
      const name = extractFileName(savePath);
      setDoc({
        currentPath: savePath,
        fileName: name,
        content: doc.content,
        isDirty: false,
        isEditing: true,
      });
      addToRecent(savePath, name);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      alert(`另存为失败: ${message}`);
    }
  }, [doc.content, doc.fileName, addToRecent]);

  // ── 欢迎页 ────────────────────────────────────

  if (!hasActiveDocument) {
    return (
      <WelcomeScreen
        onNewDocument={handleNew}
        onOpenFile={handleOpen}
        recentFiles={recentFiles}
        onOpenRecentFile={handleOpenRecentFile}
      />
    );
  }

  // ── 编辑器工作区 ──────────────────────────────

  return (
    <div className={`app-shell ${!isSidebarVisible ? "app-shell--sidebar-hidden" : ""}`}>
      {isSidebarVisible && (
        <aside className="app-shell__sidebar">
          <SidebarPanel
            fileTreeProps={{
              fileName: doc.fileName,
              isDirty: doc.isDirty,
              isEditing: doc.isEditing,
              currentPath: doc.currentPath,
              recentFiles,
              onNew: handleNew,
              onOpen: handleOpen,
              onSave: handleSave,
              onSaveAs: handleSaveAs,
              onOpenRecentFile: handleOpenRecentFile,
            }}
            outlineProps={{
              outlineItems: outlineResult.items,
              isEditing: doc.isEditing,
              onSelectOutlineItem: handleSelectOutlineItem,
            }}
          />
        </aside>
      )}
      <main className="app-shell__main">
        <EditorPanel
          ref={editorRef}
          content={doc.content}
          fileName={doc.fileName}
          isDirty={doc.isDirty}
          isEditing={doc.isEditing}
          headingCount={outlineResult.stats.headingCount}
          currentPath={doc.currentPath}
          onContentChange={setContent}
          onSave={handleSave}
          onOpen={handleOpen}
          onNew={handleNew}
          onToggleSidebar={toggleSidebar}
        />
      </main>
    </div>
  );
}
