/**
 * 模块职责：欢迎页组件，用于未打开任何文档时的启动界面。
 * 当前输入：onNewDocument、onOpenFile、onOpenWorkspace、recentFiles、recentWorkspaces。
 * 当前输出：产品名、按钮、最近文件、最近工作区。
 */
import { useEffect, useCallback } from "react";
import type { RecentFileItem } from "../../services/recent_files_service";
import type { RecentWorkspaceItem } from "../../services/recent_workspaces_service";

export interface WelcomeScreenProps {
  onNewDocument: () => void;
  onOpenFile: () => void;
  onOpenWorkspace: () => void;
  recentFiles: RecentFileItem[];
  onOpenRecentFile: (path: string) => void;
  recentWorkspaces: RecentWorkspaceItem[];
  onOpenRecentWorkspace: (path: string) => void;
  onClearStaleRecentFiles?: () => void;
}

export function WelcomeScreen({
  onNewDocument,
  onOpenFile,
  onOpenWorkspace,
  recentFiles,
  onOpenRecentFile,
  recentWorkspaces,
  onOpenRecentWorkspace,
  onClearStaleRecentFiles,
}: WelcomeScreenProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (!ctrl) return;
      switch (e.key.toLowerCase()) {
        case "n":
          e.preventDefault();
          onNewDocument();
          break;
        case "o":
          e.preventDefault();
          onOpenFile();
          break;
      }
    },
    [onNewDocument, onOpenFile],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="welcome-screen">
      <div className="welcome-screen__content">
        <h1 className="welcome-screen__title">Shadow Markdown Editor</h1>
        <p className="welcome-screen__subtitle">本地优先的 Markdown 编辑器</p>
        <div className="welcome-screen__actions">
          <button className="welcome-screen__btn welcome-screen__btn--primary" onClick={onNewDocument}>
            新建文档
          </button>
          <button className="welcome-screen__btn" onClick={onOpenFile}>
            打开文件
          </button>
          <button className="welcome-screen__btn" onClick={onOpenWorkspace}>
            打开文件夹
          </button>
        </div>

        {recentWorkspaces.length > 0 && (
          <div className="welcome-screen__recent">
            <h3 className="welcome-screen__recent-title">最近工作区</h3>
            <ul className="welcome-recent-list">
              {recentWorkspaces.map((item) => (
                <li
                  key={item.path}
                  className="welcome-recent-list__item"
                  onClick={() => onOpenRecentWorkspace(item.path)}
                  title={item.path}
                >
                  <span className="welcome-recent-list__name">{item.name}</span>
                  <span className="welcome-recent-list__path">{item.path}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="welcome-screen__recent">
          <h3 className="welcome-screen__recent-title">最近文件</h3>
          {recentFiles.length === 0 ? (
            <p className="welcome-screen__recent-empty">暂无最近打开的文件</p>
          ) : (
            <ul className="welcome-recent-list">
              {recentFiles.map((item) => (
                <li
                  key={item.path}
                  className={`welcome-recent-list__item${item.stale ? " welcome-recent-list__item--stale" : ""}`}
                  onClick={() => { if (!item.stale) onOpenRecentFile(item.path); }}
                  title={item.stale ? `${item.path}（文件不存在）` : item.path}
                >
                  <span className="welcome-recent-list__name">
                    {item.fileName}
                    {item.stale && <span className="welcome-recent-list__stale-badge">文件不存在</span>}
                  </span>
                  <span className="welcome-recent-list__path">{item.path}</span>
                </li>
              ))}
            </ul>
          )}
          {recentFiles.some((f) => f.stale) && onClearStaleRecentFiles && (
            <button
              className="welcome-recent-list__clear-stale"
              onClick={onClearStaleRecentFiles}
            >
              清理失效记录
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
