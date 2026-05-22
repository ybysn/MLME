/**
 * 模块职责：左侧文件树面板，展示最近文件和工作区文件列表。
 * 当前输入：无（纯占位 UI）。
 * 当前输出：文件树标题、最近文件占位、工作区占位。
 * 后续扩展点：接入 Tauri 文件系统、最近文件列表渲染、文件夹展开/折叠。
 */
export function FileTreePanel() {
  return (
    <div className="panel panel--file-tree">
      <header className="panel__header">
        <h2 className="panel__title">文件</h2>
      </header>
      <div className="panel__body">
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
