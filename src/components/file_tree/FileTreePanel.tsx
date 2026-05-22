/**
 * 模块职责：左侧文件树面板，提供文件操作入口和最近文件列表。
 * 当前输入：文件操作回调、文档状态、最近文件列表、打开最近文件回调。
 * 当前输出：操作按钮、当前文件信息、最近文件列表。
 * 后续扩展点：工作区文件树、拖拽排序、清空最近文件。
 */
import type { RecentFileItem } from "../../services/recent_files_service";

export interface FileTreePanelProps {
  fileName: string;
  isDirty: boolean;
  isEditing: boolean;
  currentPath: string | null;
  recentFiles: RecentFileItem[];
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onOpenRecentFile: (path: string) => void;
}

export function FileTreePanel({
  fileName,
  isDirty,
  isEditing,
  currentPath,
  recentFiles,
  onNew,
  onOpen,
  onSave,
  onSaveAs,
  onOpenRecentFile,
}: FileTreePanelProps) {
  return (
    <div className="panel panel--file-tree">
      <header className="panel__header">
        <h2 className="panel__title">文件</h2>
      </header>
      <div className="panel__body">
        <div className="file-tree-actions">
          <button className="file-tree-actions__btn" onClick={onNew}>
            新建
          </button>
          <button className="file-tree-actions__btn" onClick={onOpen}>
            打开
          </button>
          {isEditing && (
            <>
              <button className="file-tree-actions__btn" onClick={onSave}>
                保存
              </button>
              <button className="file-tree-actions__btn" onClick={onSaveAs}>
                另存为
              </button>
            </>
          )}
        </div>

        {isEditing && (
          <div className="file-tree-file-info">
            <span className="file-tree-file-info__name">{fileName}</span>
            <span
              className={`file-tree-file-info__status ${isDirty ? "file-tree-file-info__status--dirty" : "file-tree-file-info__status--clean"}`}
            >
              {isDirty ? "未保存" : "已保存"}
            </span>
          </div>
        )}

        <section className="file-tree-section">
          <h3 className="file-tree-section__title">最近文件</h3>
          {recentFiles.length === 0 ? (
            <div className="file-tree-section__placeholder">
              暂无最近打开的文件
            </div>
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

        <section className="file-tree-section">
          <h3 className="file-tree-section__title">工作区</h3>
          <div className="file-tree-section__placeholder">
            未打开工作区
          </div>
        </section>
      </div>
    </div>
  );
}
