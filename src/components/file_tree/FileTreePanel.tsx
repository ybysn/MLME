/**
 * 模块职责：左侧文件树面板，提供文件操作入口（新建/打开/保存/另存为）。
 * 当前输入：文件操作回调、文档状态（文件名、是否脏、是否编辑中）。
 * 当前输出：操作按钮、最近文件占位、工作区占位。
 * 后续扩展点：最近文件列表、工作区文件树、拖拽排序。
 */

export interface FileTreePanelProps {
  fileName: string;
  isDirty: boolean;
  isEditing: boolean;
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  onSaveAs: () => void;
}

export function FileTreePanel({
  fileName,
  isDirty,
  isEditing,
  onNew,
  onOpen,
  onSave,
  onSaveAs,
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
          <div className="file-tree-section__placeholder">
            暂无最近打开的文件
          </div>
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
