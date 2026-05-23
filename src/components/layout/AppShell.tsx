/**
 * 模块职责：主布局壳组件，管理文档状态、未保存变更保护、自动保存、设置。
 */
import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { WelcomeScreen } from "./WelcomeScreen";
import { SidebarPanel } from "./SidebarPanel";
import { ConfirmDialog } from "../dialogs/ConfirmDialog";
import { QuickOpenDialog } from "../dialogs/QuickOpenDialog";
import { CommandPaletteDialog, type CommandItem } from "../dialogs/CommandPaletteDialog";
import { useWindowCloseGuard } from "../../app/use_window_close_guard";
import { SettingsPanel } from "../settings/SettingsPanel";
import {
  EditorPanel,
  type EditorPanelHandle,
} from "../editor/EditorPanel";
import {
  readMarkdownFile,
  writeMarkdownFile,
  listMarkdownFilesInFolder,
  createMarkdownFile,
  createFolder,
  renamePath,
  deletePath,
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
  updateRecentFilePath,
  type RecentFileItem,
} from "../../services/recent_files_service";
import {
  loadRecentWorkspaces,
  addRecentWorkspace,
  removeRecentWorkspace,
  type RecentWorkspaceItem,
} from "../../services/recent_workspaces_service";
import {
  getSettings,
  saveSettings,
  type AppSettings,
} from "../../services/settings_service";
import { exportMarkdownToHtml, buildPrintableHtml } from "../../services/export_service";
import { printMarkdownDocument } from "../../services/print_service";
import { writeHtmlFile, exportHtmlToPdf } from "../../services/file_service";
import { createLogger } from "../../services/logger";

const logger = createLogger("AppShell");

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

/** 将工作区文件树扁平化为 { path, fileName }[]，仅保留 Markdown 文件 */
function flattenWorkspaceTree(items: MarkdownTreeItem[]): { path: string; fileName: string }[] {
  const result: { path: string; fileName: string }[] = [];
  for (const item of items) {
    if (!item.is_dir && item.path) {
      result.push({ path: item.path, fileName: item.file_name });
    }
    if (item.children) {
      result.push(...flattenWorkspaceTree(item.children));
    }
  }
  return result;
}

type PendingAction = () => Promise<void> | void;

interface UnsavedConfirmState {
  visible: boolean;
  action: PendingAction | null;
}

export function AppShell() {
  // ── 设置 ──────────────────────────────────────
  const [settings, setSettings] = useState<AppSettings>(() => {
    const s = getSettings();
    logger.debug("init settings", s);
    return s;
  });
  const [settingsOpen, setSettingsOpen] = useState(false);

  // ── 文档状态 ──────────────────────────────────
  const [doc, setDoc] = useState<DocumentState>(createEmptyDocument);
  const [isSidebarVisible, setIsSidebarVisible] = useState(settings.sidebarVisibleByDefault);
  const [recentFiles, setRecentFiles] = useState<RecentFileItem[]>(loadRecentFiles);
  const [currentWorkspacePath, setCurrentWorkspacePath] = useState<string | null>(null);
  const [workspaceTree, setWorkspaceTree] = useState<MarkdownTreeItem[]>([]);
  const [recentWorkspaces, setRecentWorkspaces] = useState<RecentWorkspaceItem[]>(loadRecentWorkspaces);
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "error">("idle");
  const editorRef = useRef<EditorPanelHandle>(null);
  const [unsavedConfirm, setUnsavedConfirm] = useState<UnsavedConfirmState>({ visible: false, action: null });
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const actionRef = useRef<PendingAction | null>(null);

  // ── 快速打开 ─────────────────────────────
  const [quickOpenOpen, setQuickOpenOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  // ── 工作区文件扁平化（用于快速打开搜索） ──
  const flatWorkspaceFiles = useMemo(
    () => flattenWorkspaceTree(workspaceTree),
    [workspaceTree],
  );

  // ── 专注 / 全屏 ───────────────────────────
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const previousSidebarRef = useRef(isSidebarVisible);

  const toggleFocusMode = useCallback(() => {
    setIsFocusMode((prev) => {
      if (!prev) {
        previousSidebarRef.current = isSidebarVisible;
        setIsSidebarVisible(false);
      } else {
        setIsSidebarVisible(previousSidebarRef.current);
      }
      return !prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSidebarVisible]);

  const toggleFullscreen = useCallback(async () => {
    try {
      const win = getCurrentWindow();
      const fs = await win.isFullscreen();
      await win.setFullscreen(!fs);
      setIsFullscreen(!fs);
    } catch {
      // 非 Tauri 环境
    }
  }, []);

  // ── 快捷键：F11 / Ctrl+Shift+F / Esc / Ctrl+P / Ctrl+Shift+P ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.isComposing || e.key === "Process") return;

      // Ctrl+P / Meta+P：快速打开
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        setQuickOpenOpen(true);
        return;
      }

      // Ctrl+Shift+P / Meta+Shift+P：命令面板
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        setCommandPaletteOpen(true);
        return;
      }

      if (e.key === "F11") {
        e.preventDefault();
        void toggleFullscreen();
        return;
      }

      if (e.ctrlKey && e.shiftKey && e.key === "F") {
        e.preventDefault();
        toggleFocusMode();
        return;
      }

      if (e.key === "Escape") {
        if (isFullscreen) {
          void toggleFullscreen();
          return;
        }
        if (isFocusMode) {
          setIsFocusMode(false);
          setIsSidebarVisible(previousSidebarRef.current);
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isFullscreen, isFocusMode, toggleFullscreen, toggleFocusMode, isSidebarVisible]);

  actionRef.current = unsavedConfirm.action;
  const hasActiveDocument = doc.isEditing;

  // 同步主题到 <html>
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", settings.theme);
    logger.debug("data-theme set", { current: document.documentElement.getAttribute("data-theme") });
  }, [settings.theme]);

  // 诊断：设置变化时输出传递给 EditorPanel 的值
  useEffect(() => {
    logger.debug("settings changed → EditorPanel props", {
      editorFontSize: settings.editorFontSize,
      editorFontFamily: settings.editorFontFamily,
      autoSaveEnabled: settings.autoSaveEnabled,
      autoSaveDelayMs: settings.autoSaveDelayMs,
      defaultViewMode: settings.defaultViewMode,
      sidebarVisibleByDefault: settings.sidebarVisibleByDefault,
    });
  }, [
    settings.editorFontSize,
    settings.editorFontFamily,
    settings.autoSaveEnabled,
    settings.autoSaveDelayMs,
    settings.defaultViewMode,
    settings.sidebarVisibleByDefault,
  ]);

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
    editorRef.current?.scrollToHeadingText(item.text);
  }, []);

  // ── 设置保存 ──────────────────────────────────

  const handleSaveSettings = useCallback((newSettings: AppSettings) => {
    logger.debug("handleSaveSettings", { oldSettings: settings, newSettings });
    saveSettings(newSettings);
    setSettings(newSettings);
    setSettingsOpen(false);
    logger.debug("handleSaveSettings done, new state", newSettings);
  }, [settings]);

  // ── 保存 ──────────────────────────────────────

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

  const handleSave = useCallback(() => { void doSave(); }, [doSave]);

  // ── 未保存保护 ────────────────────────────────

  const confirmBeforeLosingChanges = useCallback(
    (action: PendingAction) => {
      if (!doc.isDirty) { void action(); return; }
      setUnsavedConfirm({ visible: true, action });
    },
    [doc.isDirty],
  );

  const handleSaveAndContinue = useCallback(async () => {
    setUnsavedConfirm({ visible: false, action: null });
    const action = actionRef.current;
    const ok = await doSave();
    if (ok && typeof action === "function") void action();
  }, [doSave]);

  const handleDiscardAndContinue = useCallback(() => {
    const action = actionRef.current;
    setUnsavedConfirm({ visible: false, action: null });
    if (typeof action === "function") void action();
  }, []);

  const handleCancelConfirm = useCallback(() => {
    setUnsavedConfirm({ visible: false, action: null });
  }, []);

  // ── 自动保存 ──────────────────────────────────

  useEffect(() => {
    if (!settings.autoSaveEnabled || !doc.currentPath || !doc.isDirty) {
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
    }, settings.autoSaveDelayMs);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [settings.autoSaveEnabled, settings.autoSaveDelayMs, doc.currentPath, doc.content, doc.isDirty]);

  useEffect(() => {
    if (!doc.isDirty && autoSaveStatus === "error") setAutoSaveStatus("idle");
  }, [doc.isDirty, autoSaveStatus]);

  // ── 最近文件 ──────────────────────────────────

  const addToRecent = useCallback(
    (filePath: string, name?: string) => {
      const fileName = name ?? extractFileName(filePath);
      setRecentFiles((prev) => addRecentFile(prev, filePath, fileName));
    }, [],
  );

  const handleOpenRecentFile = useCallback(
    (filePath: string) => {
      confirmBeforeLosingChanges(async () => {
        try {
          const payload = await readMarkdownFile(filePath);
          setDoc({ currentPath: payload.path, fileName: payload.file_name, content: payload.content, isDirty: false, isEditing: true });
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
      const raw = await open({ directory: true, multiple: false, title: "选择工作区文件夹" });
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
          setDoc({ currentPath: payload.path, fileName: payload.file_name, content: payload.content, isDirty: false, isEditing: true });
          addToRecent(payload.path, payload.file_name);
        } catch (err) {
          alert(`打开文件失败: ${err instanceof Error ? err.message : String(err)}`);
        }
      });
    },
    [confirmBeforeLosingChanges, addToRecent],
  );

  // ── 工作区文件操作 ────────────────────────────

  const refreshWorkspaceTree = useCallback(async () => {
    if (!currentWorkspacePath) return;
    try {
      const tree = await listMarkdownFilesInFolder(currentWorkspacePath);
      setWorkspaceTree(tree);
    } catch (err) {
      alert(`刷新工作区失败: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [currentWorkspacePath]);

  const handleCreateFile = useCallback(async (fullPath: string) => {
    try {
      await createMarkdownFile(fullPath);
      await refreshWorkspaceTree();
      confirmBeforeLosingChanges(async () => {
        try {
          const payload = await readMarkdownFile(fullPath);
          setDoc({ currentPath: payload.path, fileName: payload.file_name, content: payload.content, isDirty: false, isEditing: true });
          addToRecent(payload.path, payload.file_name);
        } catch (err) {
          alert(`打开文件失败: ${err instanceof Error ? err.message : String(err)}`);
        }
      });
    } catch (err) {
      alert(`创建文件失败: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [refreshWorkspaceTree, confirmBeforeLosingChanges, addToRecent]);

  const handleCreateFolder = useCallback(async (fullPath: string) => {
    try {
      await createFolder(fullPath);
      await refreshWorkspaceTree();
    } catch (err) {
      alert(`创建文件夹失败: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [refreshWorkspaceTree]);

  const handleRenameItem = useCallback(async (oldPath: string, newPath: string) => {
    try {
      await renamePath(oldPath, newPath);
      if (doc.currentPath === oldPath) {
        const name = newPath.split(/[\\/]/).pop() ?? "";
        setDoc((prev) => ({ ...prev, currentPath: newPath, fileName: name }));
        setRecentFiles((prev) => updateRecentFilePath(prev, oldPath, newPath, name));
      }
      await refreshWorkspaceTree();
    } catch (err) {
      alert(`重命名失败: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [doc.currentPath, refreshWorkspaceTree]);

  const handleDeleteItem = useCallback(async (path: string, _isDir: boolean) => {
    if (path === doc.currentPath && doc.isDirty) {
      const action = async () => {
        try {
          await deletePath(path);
          setDoc(createEmptyDocument());
          setRecentFiles((prev) => removeRecentFile(prev, path));
          await refreshWorkspaceTree();
        } catch (err) {
          alert(`删除失败: ${err instanceof Error ? err.message : String(err)}`);
        }
      };
      setUnsavedConfirm({ visible: true, action });
      return;
    }

    try {
      await deletePath(path);
      if (path === doc.currentPath) {
        setDoc(createEmptyDocument());
        setRecentFiles((prev) => removeRecentFile(prev, path));
      }
      await refreshWorkspaceTree();
    } catch (err) {
      alert(`删除失败: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [doc.currentPath, doc.isDirty, refreshWorkspaceTree]);

  // ── 文件操作 ──────────────────────────────────

  const handleNew = useCallback(() => {
    confirmBeforeLosingChanges(() => {
      setDoc({ currentPath: null, fileName: "未命名文档", content: "", isDirty: false, isEditing: true });
    });
  }, [confirmBeforeLosingChanges]);

  const handleOpen = useCallback(() => {
    confirmBeforeLosingChanges(async () => {
      try {
        const raw = await open({ filters: [{ name: "Markdown", extensions: ["md", "markdown"] }], multiple: false });
        const filePath = extractDialogPath(raw);
        if (!filePath) return;
        const payload = await readMarkdownFile(filePath);
        setDoc({ currentPath: payload.path, fileName: payload.file_name, content: payload.content, isDirty: false, isEditing: true });
        addToRecent(payload.path, payload.file_name);
      } catch (err) {
        alert(`打开文件失败: ${err instanceof Error ? err.message : String(err)}`);
      }
    });
  }, [confirmBeforeLosingChanges, addToRecent]);

  const handleSaveAs = useCallback(async () => {
    try {
      const raw = await save({ filters: [{ name: "Markdown", extensions: ["md"] }], defaultPath: doc.fileName.endsWith(".md") ? doc.fileName : `${doc.fileName}.md` });
      const savePath = extractDialogPath(raw);
      if (!savePath) return;
      await writeMarkdownFile(savePath, doc.content);
      const name = extractFileName(savePath);
      setDoc({ currentPath: savePath, fileName: name, content: doc.content, isDirty: false, isEditing: true });
      addToRecent(savePath, name);
      setAutoSaveStatus("idle");
    } catch (err) {
      alert(`另存为失败: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [doc.content, doc.fileName, addToRecent]);

  // ── 导出 HTML ─────────────────────────────────
  const handleExportHtml = useCallback(async () => {
    try {
      const raw = await save({
        filters: [{ name: "HTML", extensions: ["html"] }],
        defaultPath: doc.fileName.endsWith(".md")
          ? doc.fileName.replace(/\.md$/, ".html")
          : `${doc.fileName}.html`,
      });
      const savePath = extractDialogPath(raw);
      if (!savePath) return;
      const html = await exportMarkdownToHtml({
        content: doc.content,
        currentPath: doc.currentPath,
        fileName: doc.fileName,
      });
      await writeHtmlFile(savePath, html);
      alert("HTML 导出成功");
    } catch (err) {
      alert(`HTML 导出失败: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [doc.content, doc.currentPath, doc.fileName]);

  // ── 导出 PDF ──────────────────────────────────
  const handleExportPdf = useCallback(async () => {
    try {
      const raw = await save({
        filters: [{ name: "PDF", extensions: ["pdf"] }],
        defaultPath: doc.fileName.endsWith(".md")
          ? doc.fileName.replace(/\.md$/, ".pdf")
          : `${doc.fileName}.pdf`,
      });
      const savePath = extractDialogPath(raw);
      if (!savePath) return;
      const html = await buildPrintableHtml({
        content: doc.content,
        currentPath: doc.currentPath,
        fileName: doc.fileName,
      });
      await exportHtmlToPdf(html, savePath);
      alert("PDF 导出成功");
    } catch (err) {
      alert(`PDF 导出失败: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [doc.content, doc.currentPath, doc.fileName]);

  // ── 打印 ──────────────────────────────────────
  const handlePrint = useCallback(async () => {
    try {
      await printMarkdownDocument({
        content: doc.content,
        currentPath: doc.currentPath,
        fileName: doc.fileName,
      });
    } catch (err) {
      alert(`打印失败: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [doc.content, doc.currentPath, doc.fileName]);

  // ── 命令面板列表 ──────────────────────────────
  const commands: CommandItem[] = useMemo(() => [
    { id: "new", title: "新建文件", keywords: ["new"], shortcut: "Ctrl+N" },
    { id: "open", title: "打开文件", keywords: ["open"], shortcut: "Ctrl+O" },
    { id: "save", title: "保存", keywords: ["save"], shortcut: "Ctrl+S" },
    { id: "saveAs", title: "另存为", keywords: ["save as"], shortcut: "Ctrl+Shift+S" },
    { id: "wysiwyg", title: "写作模式", description: "所见即所得编辑", keywords: ["wysiwyg", "writing"], disabled: !hasActiveDocument },
    { id: "source", title: "源码模式", description: "Markdown 源码编辑", keywords: ["source", "code"], disabled: !hasActiveDocument },
    { id: "split", title: "分屏模式", description: "源码与预览并排", keywords: ["split", "preview"], disabled: !hasActiveDocument },
    { id: "settings", title: "打开设置", keywords: ["settings", "config"] },
    { id: "exportHtml", title: "导出 HTML", description: "导出为 HTML 文件", keywords: ["export", "html"], disabled: !hasActiveDocument },
    { id: "exportPdf", title: "导出 PDF", description: "导出为 PDF 文件", keywords: ["export", "pdf"], disabled: !hasActiveDocument },
  ], [hasActiveDocument]);

  const handleCommandExecute = useCallback((commandId: string) => {
    switch (commandId) {
      case "new": handleNew(); break;
      case "open": handleOpen(); break;
      case "save": handleSave(); break;
      case "saveAs": void handleSaveAs(); break;
      case "wysiwyg": handleSaveSettings({ ...settings, defaultViewMode: "wysiwyg" }); break;
      case "source": handleSaveSettings({ ...settings, defaultViewMode: "source" }); break;
      case "split": handleSaveSettings({ ...settings, defaultViewMode: "split" }); break;
      case "settings": setSettingsOpen(true); break;
      case "exportHtml": void handleExportHtml(); break;
      case "exportPdf": void handleExportPdf(); break;
    }
  }, [handleNew, handleOpen, handleSave, handleSaveAs, handleSaveSettings, settings, handleExportHtml, handleExportPdf]);

  // ── 窗口关闭未保存确认 ──────────────────────
  const { closeGuardDialog } = useWindowCloseGuard({
    isDirty: doc.isDirty,
    doSave,
    autoSaveStatus,
  });

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

      <QuickOpenDialog
        open={quickOpenOpen}
        recentFiles={recentFiles}
        workspaceFiles={flatWorkspaceFiles}
        currentPath={doc.currentPath}
        onOpenFile={(path) => {
          setQuickOpenOpen(false);
          handleOpenRecentFile(path);
        }}
        onClose={() => setQuickOpenOpen(false)}
      />

      <CommandPaletteDialog
        open={commandPaletteOpen}
        commands={commands}
        onClose={() => setCommandPaletteOpen(false)}
        onExecute={handleCommandExecute}
      />

      {closeGuardDialog}

      <SettingsPanel
        open={settingsOpen}
        settings={settings}
        onSave={handleSaveSettings}
        onCancel={() => setSettingsOpen(false)}
      />

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
        <div className={`app-shell ${!isSidebarVisible ? "app-shell--sidebar-hidden" : ""} ${isFocusMode ? "app-shell--focus" : ""}`}>
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
                  onCreateFile: handleCreateFile,
                  onCreateFolder: handleCreateFolder,
                  onRenameItem: handleRenameItem,
                  onDeleteItem: handleDeleteItem,
                  onRefreshWorkspace: () => { void refreshWorkspaceTree(); },
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
              autoSaveEnabled={settings.autoSaveEnabled}
              autoSaveStatus={autoSaveStatus}
              editorFontSize={settings.editorFontSize}
              editorFontFamily={settings.editorFontFamily}
              defaultViewMode={settings.defaultViewMode}
              onContentChange={setContent}
              onSave={handleSave}
              onOpen={handleOpen}
              onNew={handleNew}
              onToggleSidebar={toggleSidebar}
              onToggleAutoSave={() => handleSaveSettings({ ...settings, autoSaveEnabled: !settings.autoSaveEnabled })}
              onOpenSettings={() => setSettingsOpen(true)}
              onUpdateSettings={(partial) => handleSaveSettings({ ...settings, ...partial })}
              isFocusMode={isFocusMode}
              onToggleFocus={toggleFocusMode}
              onToggleFullscreen={toggleFullscreen}
              onExportHtml={handleExportHtml}
              onExportPdf={handleExportPdf}
              onPrint={handlePrint}
            />
          </main>
        </div>
      )}
    </>
  );
}
