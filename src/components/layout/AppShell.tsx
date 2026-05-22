/**
 * 模块职责：主布局壳组件，管理文档状态、未保存变更保护、自动保存。
 */
import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { WelcomeScreen } from "./WelcomeScreen";
import { SidebarPanel } from "./SidebarPanel";
import { ConfirmDialog } from "../dialogs/ConfirmDialog";
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
import {
  getAutoSaveEnabled,
  setAutoSaveEnabled as persistAutoSaveEnabled,
} from "../../services/settings_service";

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

type PendingAction = () => Promise<void> | void;

interface UnsavedConfirmState {
  visible: boolean;
  action: PendingAction | null;
}

export function AppShell() {
  const [doc, setDoc] = useState<DocumentState>(createEmptyDocument);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [recentFiles, setRecentFiles] = useState<RecentFileItem[]>(loadRecentFiles);
  const [currentWorkspacePath, setCurrentWorkspacePath] = useState<string | null>(null);
  const [workspaceTree, setWorkspaceTree] = useState<MarkdownTreeItem[]>([]);
  const [recentWorkspaces, setRecentWorkspaces] = useState<RecentWorkspaceItem[]>(loadRecentWorkspaces);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState<boolean>(getAutoSaveEnabled);
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "error">("idle");
  const editorRef = useRef<EditorPanelHandle>(null);
  const [unsavedConfirm, setUnsavedConfirm] = useState<UnsavedConfirmState>({
    visible: false,
    action: null,
  });
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const actionRef = useRef<PendingAction | null>(null);

  // 始终同步 action 到 ref，避免闭包过期
  actionRef.current = unsavedConfirm.action;

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

  // ── 保存（返回 boolean 供确认流程使用）──────────

  const doSave = useCallback(async (): Promise<boolean> => {
    let targetPath = doc.currentPath;
    const isFirstSave = !targetPath;
    if (isFirstSave) {
      const raw = await save({
        filters: [{ name: "Markdown", extensions: ["md"] }],
        defaultPath: doc.fileName.endsWith(".md") ? doc.fileName : `${doc.fileName}.md`,
      });
      const savePath = extractDialogPath(raw);
      if (!savePath) return false;
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
      if (isFirstSave) {
        setRecentFiles((prev) => addRecentFile(prev, resolvedPath, name));
      }
      setAutoSaveStatus("idle");
      return true;
    } catch (err) {
      alert(`保存失败: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
  }, [doc.currentPath, doc.content, doc.fileName]);

  // 包装为 void 版本供 EditorPanel 使用
  const handleSave = useCallback(() => { void doSave(); }, [doSave]);

  // ── 未保存变更保护 ────────────────────────────

  const confirmBeforeLosingChanges = useCallback(
    (action: PendingAction) => {
      if (!doc.isDirty) {
        void action();
        return;
      }
      setUnsavedConfirm({ visible: true, action });
    },
    [doc.isDirty],
  );

  // 保存并继续
  const handleSaveAndContinue = useCallback(async () => {
    setUnsavedConfirm({ visible: false, action: null });
    const action = actionRef.current;
    const ok = await doSave();
    if (ok && typeof action === "function") {
      void action();
    }
  }, [doSave]);

  // 不保存继续
  const handleDiscardAndContinue = useCallback(() => {
    const action = actionRef.current;
    setUnsavedConfirm({ visible: false, action: null });
    if (typeof action === "function") {
      void action();
    }
  }, []);

  // 取消
  const handleCancelConfirm = useCallback(() => {
    setUnsavedConfirm({ visible: false, action: null });
  }, []);

  // ── 自动保存 ──────────────────────────────────

  const toggleAutoSave = useCallback(() => {
    setAutoSaveEnabled((prev) => {
      const next = !prev;
      persistAutoSaveEnabled(next);
      if (!next) {
        setAutoSaveStatus("idle");
        if (autoSaveTimerRef.current) {
          clearTimeout(autoSaveTimerRef.current);
          autoSaveTimerRef.current = null;
        }
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!autoSaveEnabled || !doc.currentPath || !doc.isDirty) {
      setAutoSaveStatus((prev) => (prev === "saving" ? "idle" : prev));
      return;
    }
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);

    autoSaveTimerRef.current = setTimeout(async () => {
      setAutoSaveStatus("saving");
      try {
        await writeMarkdownFile(doc.currentPath!, doc.content);
        setDoc((prev) => ({ ...prev, isDirty: false }));
        setAutoSaveStatus("idle");
      } catch {
        setAutoSaveStatus("error");
      }
    }, 2000);

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [autoSaveEnabled, doc.currentPath, doc.content, doc.isDirty]);

  useEffect(() => {
    if (!doc.isDirty && autoSaveStatus === "error") {
      setAutoSaveStatus("idle");
    }
  }, [doc.isDirty, autoSaveStatus]);

  // ── 最近文件 ──────────────────────────────────

  const addToRecent = useCallback(
    (filePath: string, name?: string) => {
      const fileName = name ?? extractFileName(filePath);
      setRecentFiles((prev) => addRecentFile(prev, filePath, fileName));
    },
    [],
  );

  const handleOpenRecentFile = useCallback(
    (filePath: string) => {
      confirmBeforeLosingChanges(async () => {
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
      });
    },
    [confirmBeforeLosingChanges, addToRecent],
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
    (filePath: string) => {
      confirmBeforeLosingChanges(async () => {
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
      });
    },
    [confirmBeforeLosingChanges, addToRecent],
  );

  // ── 文件操作 ──────────────────────────────────

  const handleNew = useCallback(() => {
    confirmBeforeLosingChanges(() => {
      setDoc({
        currentPath: null,
        fileName: "未命名文档",
        content: "",
        isDirty: false,
        isEditing: true,
      });
    });
  }, [confirmBeforeLosingChanges]);

  const handleOpen = useCallback(() => {
    confirmBeforeLosingChanges(async () => {
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
    });
  }, [confirmBeforeLosingChanges, addToRecent]);

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
      setAutoSaveStatus("idle");
    } catch (err) {
      alert(`另存为失败: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [doc.content, doc.fileName, addToRecent]);

  // ── 渲染 ──────────────────────────────────────

  return (
    <>
      {unsavedConfirm.visible && (
        <ConfirmDialog
          open={true}
          onClose={handleCancelConfirm}
          onSaveAndContinue={handleSaveAndContinue}
          onDiscardAndContinue={handleDiscardAndContinue}
        />
      )}

      {!hasActiveDocument ? (
        <WelcomeScreen
          onNewDocument={handleNew}
          onOpenFile={handleOpen}
          onOpenWorkspace={handleOpenWorkspace}
          recentFiles={recentFiles}
          onOpenRecentFile={handleOpenRecentFile}
          recentWorkspaces={recentWorkspaces}
          onOpenRecentWorkspace={handleOpenRecentWorkspace}
        />
      ) : (
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
              autoSaveEnabled={autoSaveEnabled}
              autoSaveStatus={autoSaveStatus}
              onContentChange={setContent}
              onSave={handleSave}
              onOpen={handleOpen}
              onNew={handleNew}
              onToggleSidebar={toggleSidebar}
              onToggleAutoSave={toggleAutoSave}
            />
          </main>
        </div>
      )}
    </>
  );
}
