/**
 * 模块职责：左侧文件树面板，提供文件操作入口、工作区文件树、右键菜单和最近文件列表。
 * 右键菜单使用 FileOperationDialog 替代 window.prompt/confirm。
 */
import { useState, useCallback, useRef, useEffect } from "react";
import type { RecentFileItem } from "../../services/recent_files_service";
import type { MarkdownTreeItem } from "../../services/file_service";
import { FileOperationDialog, type FileOperationState } from "./FileOperationDialog";

export interface FileTreePanelProps {
  fileName: string;
  isDirty: boolean;
  isEditing: boolean;
  currentPath: string | null;
  recentFiles: RecentFileItem[];
  currentWorkspacePath: string | null;
  workspaceName: string | null;
  workspaceTree: MarkdownTreeItem[];
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onOpenRecentFile: (path: string) => void;
  onOpenWorkspace: () => void;
  onOpenWorkspaceFile: (path: string) => void;
  onCreateFile: (fullPath: string) => void;
  onCreateFolder: (fullPath: string) => void;
  onRenameItem: (oldPath: string, newPath: string) => void;
  onDeleteItem: (path: string, isDir: boolean) => void;
  onRefreshWorkspace: () => void;
}

interface ContextMenuState {
  x: number;
  y: number;
  items: { label: string; onClick: () => void; danger?: boolean }[];
}

function WorkspaceTreeItem({
  item, depth, currentPath, onOpenFile, onContextMenu,
}: {
  item: MarkdownTreeItem; depth: number; currentPath: string | null;
  onOpenFile: (path: string) => void;
  onContextMenu: (e: React.MouseEvent, targetPath: string, isDir: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  if (item.is_dir) {
    return (
      <li className="workspace-tree__item">
        <div className="workspace-tree__dir" style={{ paddingLeft: `${depth * 16}px` }}
          onClick={() => setExpanded((p) => !p)}
          onContextMenu={(e) => onContextMenu(e, item.path, true)}>
          <span className="workspace-tree__arrow">{expanded ? "▾" : "▸"}</span>
          <span className="workspace-tree__name">{item.file_name}</span>
        </div>
        {expanded && item.children && (
          <ul className="workspace-tree__children">
            {item.children.map((child) => (
              <WorkspaceTreeItem key={child.path} item={child} depth={depth + 1}
                currentPath={currentPath} onOpenFile={onOpenFile} onContextMenu={onContextMenu} />
            ))}
          </ul>
        )}
      </li>
    );
  }

  return (
    <li className={`workspace-tree__item workspace-tree__file ${item.path === currentPath ? "workspace-tree__file--active" : ""}`}
      style={{ paddingLeft: `${depth * 16 + 8}px` }}
      onClick={() => onOpenFile(item.path)}
      onContextMenu={(e) => onContextMenu(e, item.path, false)}
      title={item.path}>
      <span className="workspace-tree__name">{item.file_name}</span>
    </li>
  );
}

export function FileTreePanel({
  fileName, isDirty, isEditing, currentPath, recentFiles,
  currentWorkspacePath, workspaceName, workspaceTree,
  onNew, onOpen, onSave, onSaveAs, onOpenRecentFile,
  onOpenWorkspace, onOpenWorkspaceFile,
  onCreateFile, onCreateFolder, onRenameItem, onDeleteItem, onRefreshWorkspace,
}: FileTreePanelProps) {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [fileOperation, setFileOperation] = useState<FileOperationState | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const closeMenu = useCallback(() => setContextMenu(null), []);

  useEffect(() => {
    if (!contextMenu) return;
    const handler = () => closeMenu();
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [contextMenu, closeMenu]);

  const openFileDialog = useCallback((type: FileOperationState["type"], targetPath: string, isDir: boolean, oldName?: string) => {
    setContextMenu(null);
    setFileOperation({ type, targetPath, isDir, oldName });
  }, []);

  const handleFileOpConfirm = useCallback((type: FileOperationState["type"], targetPath: string, newName: string) => {
    setFileOperation(null);
    const parentDir = targetPath.replace(/[/\\][^/\\]*$/, "") || targetPath;

    switch (type) {
      case "create-file":
        onCreateFile(`${parentDir}\\${newName}`);
        break;
      case "create-folder":
        onCreateFolder(`${parentDir}\\${newName}`);
        break;
      case "rename":
        onRenameItem(targetPath, `${parentDir}\\${newName}`);
        break;
      case "delete":
        onDeleteItem(targetPath, (fileOperation as FileOperationState).isDir);
        break;
    }
  }, [onCreateFile, onCreateFolder, onRenameItem, onDeleteItem, fileOperation]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, targetPath: string, isDir: boolean) => {
      e.preventDefault(); e.stopPropagation();
      const parentDir = targetPath.replace(/[/\\][^/\\]*$/, "") || targetPath;
      const oldName = targetPath.split(/[\\/]/).pop();

      const items: ContextMenuState["items"] = isDir
        ? [
            { label: "新建 Markdown 文件", onClick: () => openFileDialog("create-file", targetPath, true) },
            { label: "新建文件夹", onClick: () => openFileDialog("create-folder", targetPath, true) },
            { label: "重命名", onClick: () => openFileDialog("rename", targetPath, true, oldName) },
            { label: "删除", onClick: () => openFileDialog("delete", targetPath, true), danger: true },
          ]
        : [
            { label: "重命名", onClick: () => openFileDialog("rename", targetPath, false, oldName) },
            { label: "删除", onClick: () => openFileDialog("delete", targetPath, false), danger: true },
            { label: "新建文件到此处", onClick: () => openFileDialog("create-file", parentDir, false) },
            { label: "新建文件夹到此处", onClick: () => openFileDialog("create-folder", parentDir, false) },
          ];

      setContextMenu({ x: e.clientX, y: e.clientY, items });
    },
    [openFileDialog],
  );

  const handleWorkspaceContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (!currentWorkspacePath) return;
      e.preventDefault();
      setContextMenu({
        x: e.clientX, y: e.clientY,
        items: [
          { label: "新建 Markdown 文件", onClick: () => openFileDialog("create-file", currentWorkspacePath, true) },
          { label: "新建文件夹", onClick: () => openFileDialog("create-folder", currentWorkspacePath, true) },
          { label: "刷新", onClick: () => { closeMenu(); onRefreshWorkspace(); } },
        ],
      });
    },
    [currentWorkspacePath, closeMenu, openFileDialog, onRefreshWorkspace],
  );

  return (
    <div className="panel panel--file-tree">
      <header className="panel__header"><h2 className="panel__title">文件</h2></header>
      <div className="panel__body">
        <div className="file-tree-actions">
          <button className="file-tree-actions__btn" onClick={onNew}>新建</button>
          <button className="file-tree-actions__btn" onClick={onOpen}>打开</button>
          {isEditing && (<>
            <button className="file-tree-actions__btn" onClick={onSave}>保存</button>
            <button className="file-tree-actions__btn" onClick={onSaveAs}>另存为</button>
          </>)}
        </div>

        {isEditing && (
          <div className="file-tree-file-info">
            <span className="file-tree-file-info__name">{fileName}</span>
            <span className={`file-tree-file-info__status ${isDirty ? "file-tree-file-info__status--dirty" : "file-tree-file-info__status--clean"}`}>
              {isDirty ? "未保存" : "已保存"}
            </span>
          </div>
        )}

        <section className="file-tree-section">
          <h3 className="file-tree-section__title">工作区</h3>
          {currentWorkspacePath ? (<>
            <div className="workspace-header"><span className="workspace-header__name" title={currentWorkspacePath}>{workspaceName}</span></div>
            {workspaceTree.length === 0 ? (
              <div className="file-tree-section__placeholder" onContextMenu={handleWorkspaceContextMenu}>该文件夹下暂无 Markdown 文件（右键新建）</div>
            ) : (
              <ul className="workspace-tree" onContextMenu={handleWorkspaceContextMenu}>
                {workspaceTree.map((item) => (
                  <WorkspaceTreeItem key={item.path} item={item} depth={0} currentPath={currentPath}
                    onOpenFile={onOpenWorkspaceFile} onContextMenu={handleContextMenu} />
                ))}
              </ul>
            )}
          </>) : (
            <button className="file-tree-actions__btn workspace-open-btn" onClick={onOpenWorkspace}>打开文件夹</button>
          )}
        </section>

        <section className="file-tree-section">
          <h3 className="file-tree-section__title">最近文件</h3>
          {recentFiles.length === 0 ? (
            <div className="file-tree-section__placeholder">暂无最近打开的文件</div>
          ) : (
            <ul className="recent-file-list">
              {recentFiles.map((item) => (
                <li key={item.path} className={`recent-file-list__item ${item.path === currentPath ? "recent-file-list__item--active" : ""}`}
                  onClick={() => onOpenRecentFile(item.path)} title={item.path}>
                  <span className="recent-file-list__name">{item.fileName}</span>
                  <span className="recent-file-list__path">{item.path}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {contextMenu && (
        <div ref={menuRef} className="context-menu" style={{ left: contextMenu.x, top: contextMenu.y }}>
          {contextMenu.items.map((item, i) => (
            <button key={i} className={`context-menu__item ${item.danger ? "context-menu__item--danger" : ""}`} onClick={item.onClick}>
              {item.label}
            </button>
          ))}
        </div>
      )}

      <FileOperationDialog
        operation={fileOperation}
        onConfirm={handleFileOpConfirm}
        onCancel={() => setFileOperation(null)}
      />
    </div>
  );
}
