/**
 * 模块职责：左侧文件树面板，提供文件操作入口、工作区文件树和最近文件列表。
 * 当前输入：文件操作回调、文档状态、工作区树、最近文件列表。
 * 当前输出：操作按钮、当前文件信息、工作区文件树、最近文件列表。
 */
import { useState } from "react";
import type { RecentFileItem } from "../../services/recent_files_service";
import type { MarkdownTreeItem } from "../../services/file_service";

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
}

/** 递归渲染工作区文件树节点 */
function WorkspaceTreeItem({
  item,
  depth,
  currentPath,
  onOpenFile,
}: {
  item: MarkdownTreeItem;
  depth: number;
  currentPath: string | null;
  onOpenFile: (path: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  if (item.is_dir) {
    return (
      <li className="workspace-tree__item">
        <div
          className="workspace-tree__dir"
          style={{ paddingLeft: `${depth * 16}px` }}
          onClick={() => setExpanded((p) => !p)}
        >
          <span className="workspace-tree__arrow">{expanded ? "▾" : "▸"}</span>
          <span className="workspace-tree__name">{item.file_name}</span>
        </div>
        {expanded && item.children && (
          <ul className="workspace-tree__children">
            {item.children.map((child) => (
              <WorkspaceTreeItem
                key={child.path}
                item={child}
                depth={depth + 1}
                currentPath={currentPath}
                onOpenFile={onOpenFile}
              />
            ))}
          </ul>
        )}
      </li>
    );
  }

  return (
    <li
      className={`workspace-tree__item workspace-tree__file ${
        item.path === currentPath ? "workspace-tree__file--active" : ""
      }`}
      style={{ paddingLeft: `${depth * 16 + 8}px` }}
      onClick={() => onOpenFile(item.path)}
      title={item.path}
    >
      <span className="workspace-tree__name">{item.file_name}</span>
    </li>
  );
}

export function FileTreePanel({
  fileName,
  isDirty,
  isEditing,
  currentPath,
  recentFiles,
  currentWorkspacePath,
  workspaceName,
  workspaceTree,
  onNew,
  onOpen,
  onSave,
  onSaveAs,
  onOpenRecentFile,
  onOpenWorkspace,
  onOpenWorkspaceFile,
}: FileTreePanelProps) {
  return (
    <div className="panel panel--file-tree">
      <header className="panel__header">
        <h2 className="panel__title">文件</h2>
      </header>
      <div className="panel__body">
        <div className="file-tree-actions">
          <button className="file-tree-actions__btn" onClick={onNew}>新建</button>
          <button className="file-tree-actions__btn" onClick={onOpen}>打开</button>
          {isEditing && (
            <>
              <button className="file-tree-actions__btn" onClick={onSave}>保存</button>
              <button className="file-tree-actions__btn" onClick={onSaveAs}>另存为</button>
            </>
          )}
        </div>

        {isEditing && (
          <div className="file-tree-file-info">
            <span className="file-tree-file-info__name">{fileName}</span>
            <span className={`file-tree-file-info__status ${isDirty ? "file-tree-file-info__status--dirty" : "file-tree-file-info__status--clean"}`}>
              {isDirty ? "未保存" : "已保存"}
            </span>
          </div>
        )}

        {/* 工作区 */}
        <section className="file-tree-section">
          <h3 className="file-tree-section__title">工作区</h3>
          {currentWorkspacePath ? (
            <>
              <div className="workspace-header">
                <span className="workspace-header__name" title={currentWorkspacePath}>
                  {workspaceName}
                </span>
              </div>
              {workspaceTree.length === 0 ? (
                <div className="file-tree-section__placeholder">
                  该文件夹下暂无 Markdown 文件
                </div>
              ) : (
                <ul className="workspace-tree">
                  {workspaceTree.map((item) => (
                    <WorkspaceTreeItem
                      key={item.path}
                      item={item}
                      depth={0}
                      currentPath={currentPath}
                      onOpenFile={onOpenWorkspaceFile}
                    />
                  ))}
                </ul>
              )}
            </>
          ) : (
            <button className="file-tree-actions__btn workspace-open-btn" onClick={onOpenWorkspace}>
              打开文件夹
            </button>
          )}
        </section>

        {/* 最近文件 */}
        <section className="file-tree-section">
          <h3 className="file-tree-section__title">最近文件</h3>
          {recentFiles.length === 0 ? (
            <div className="file-tree-section__placeholder">暂无最近打开的文件</div>
          ) : (
            <ul className="recent-file-list">
              {recentFiles.map((item) => (
                <li
                  key={item.path}
                  className={`recent-file-list__item ${item.path === currentPath ? "recent-file-list__item--active" : ""}`}
                  onClick={() => onOpenRecentFile(item.path)}
                  title={item.path}
                >
                  <span className="recent-file-list__name">{item.fileName}</span>
                  <span className="recent-file-list__path">{item.path}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
