/**
 * 模块职责：主布局壳组件，管理文档状态并向下分发文件操作与编辑器内容。
 * 当前输入：无（顶层组件）。
 * 当前输出：欢迎页 / 编辑器工作区，支持工作区文件树。
 */
import { useState, useCallback, useMemo, useRef } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { WelcomeScreen } from "./WelcomeScreen";
import { SidebarPanel } from "./SidebarPanel";
import {
  EditorPanel,
  type EditorPanelHandle,
} from "../editor/EditorPanel";
import {
  readMarkdownFile,
  writeMarkdownFile,
  listMarkdownFilesInFolder,
  type MarkdownTreeItem,
} from "../../services/file_service";
import {
  type DocumentState,
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
import {
  loadRecentWorkspaces,
  addRecentWorkspace,
  removeRecentWorkspace,
  type RecentWorkspaceItem,
} from "../../services/recent_workspaces_service";

function extractDialogPath(result: string | { path: string } | null): string | null {
  if (!result) return null;
  if (typeof result === "string") return result;
  if (typeof result === "object" && "path" in result) return result.path;
  return null;
}

function extractFileName(fullPath: string): string {
  return fullPath.split(/[\\/]/).pop() ?? "unknown.md";
}

function extractWorkspaceName(fullPath: string): string {
  const trimmed = fullPath.replace(/[\\/]$/, "");
  return trimmed.split(/[\\/]/).pop() ?? fullPath;
}

export function AppShell() {
  const [doc, setDoc] = useState<DocumentState>(createEmptyDocument);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [recentFiles, setRecentFiles] = useState<RecentFileItem[]>(loadRecentFiles);
  const [currentWorkspacePath, setCurrentWorkspacePath] = useState<string | null>(null);
  const [workspaceTree, setWorkspaceTree] = useState<MarkdownTreeItem[]>([]);
  const [recentWorkspaces, setRecentWorkspaces] = useState<RecentWorkspaceItem[]>(loadRecentWorkspaces);
  const editorRef = useRef<EditorPanelHandle>(null);

  const hasActiveDocument = doc.isEditing;

  const toggleSidebar = useCallback(() => {
    setIsSidebarVisible((prev) => !prev);
  }, []);

  const outlineResult = useMemo(() => {
    const items = parseMarkdownOutline(doc.content);
    const stats = getDocumentStats(doc.content, items.length);
    return { items, stats };
  }, [doc.content]);

  const setContent = useCallback((content: string) => {
    setDoc((prev) => ({ ...prev, content, isDirty: true }));
  }, []);

  const handleSelectOutlineItem = useCallback((item: MarkdownOutlineItem) => {
    editorRef.current?.scrollToLine(item.line);
  }, []);

  // ── 最近文件 ──────────────────────────────────

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
        alert(`打开文件失败: ${err instanceof Error ? err.message : String(err)}`);
        setRecentFiles((prev) => removeRecentFile(prev, filePath));
      }
    },
    [addToRecent],
  );

  // ── 工作区 ────────────────────────────────────

  const addWsToRecent = useCallback((path: string) => {
    setRecentWorkspaces((prev) => addRecentWorkspace(prev, path));
  }, []);

  const handleOpenWorkspace = useCallback(async () => {
    try {
      const raw = await open({
        directory: true,
        multiple: false,
        title: "选择工作区文件夹",
      });
      const folderPath = extractDialogPath(raw);
      if (!folderPath) return;

      const tree = await listMarkdownFilesInFolder(folderPath);
      setCurrentWorkspacePath(folderPath);
      setWorkspaceTree(tree);
      addWsToRecent(folderPath);
    } catch (err) {
      alert(`打开文件夹失败: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [addWsToRecent]);

  const handleOpenRecentWorkspace = useCallback(async (folderPath: string) => {
    try {
      const tree = await listMarkdownFilesInFolder(folderPath);
      setCurrentWorkspacePath(folderPath);
      setWorkspaceTree(tree);
      addWsToRecent(folderPath);
    } catch (err) {
      alert(`打开文件夹失败: ${err instanceof Error ? err.message : String(err)}`);
      setRecentWorkspaces((prev) => removeRecentWorkspace(prev, folderPath));
    }
  }, [addWsToRecent]);

  const handleOpenWorkspaceFile = useCallback(
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
        alert(`打开文件失败: ${err instanceof Error ? err.message : String(err)}`);
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
      const raw = await open({
        filters: [{ name: "Markdown", extensions: ["md", "markdown"] }],
        multiple: false,
      });
      const filePath = extractDialogPath(raw);
      if (!filePath) return;

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
      alert(`打开文件失败: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [addToRecent]);

  const handleSave = useCallback(async () => {
    let targetPath = doc.currentPath;
    const isFirstSave = !targetPath;
    if (isFirstSave) {
      const raw = await save({
        filters: [{ name: "Markdown", extensions: ["md"] }],
        defaultPath: doc.fileName.endsWith(".md") ? doc.fileName : `${doc.fileName}.md`,
      });
      const savePath = extractDialogPath(raw);
      if (!savePath) return;
      targetPath = savePath;
    }
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
      alert(`保存文件失败: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [doc.currentPath, doc.content, doc.fileName, addToRecent]);

  const handleSaveAs = useCallback(async () => {
    try {
      const raw = await save({
        filters: [{ name: "Markdown", extensions: ["md"] }],
        defaultPath: doc.fileName.endsWith(".md") ? doc.fileName : `${doc.fileName}.md`,
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
      alert(`另存为失败: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [doc.content, doc.fileName, addToRecent]);

  // ── 欢迎页 ────────────────────────────────────

  if (!hasActiveDocument) {
    return (
      <WelcomeScreen
        onNewDocument={handleNew}
        onOpenFile={handleOpen}
        onOpenWorkspace={handleOpenWorkspace}
        recentFiles={recentFiles}
        onOpenRecentFile={handleOpenRecentFile}
        recentWorkspaces={recentWorkspaces}
        onOpenRecentWorkspace={handleOpenRecentWorkspace}
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
              currentWorkspacePath,
              workspaceName: currentWorkspacePath ? extractWorkspaceName(currentWorkspacePath) : null,
              workspaceTree,
              onNew: handleNew,
              onOpen: handleOpen,
              onSave: handleSave,
              onSaveAs: handleSaveAs,
              onOpenRecentFile: handleOpenRecentFile,
              onOpenWorkspace: handleOpenWorkspace,
              onOpenWorkspaceFile: handleOpenWorkspaceFile,
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
