/**
 * 模块职责：中间编辑区面板，包含编辑器占位区和底部状态栏。
 * 当前输入：无（纯占位 UI，无实际编辑器内容）。
 * 当前输出：空白状态提示、编辑器占位区、状态栏。
 * 后续扩展点：集成 Milkdown 编辑器、状态栏接入保存状态/字数统计/行列号。
 */
export function EditorPanel() {
  return (
    <div className="panel panel--editor">
      <div className="panel__body panel__body--editor">
        <div className="editor-empty-state">
          <span className="editor-empty-state__icon">📄</span>
          <p className="editor-empty-state__text">未打开文件</p>
          <p className="editor-empty-state__hint">
            Ctrl+O 打开 Markdown 文件，或 Ctrl+N 新建文档
          </p>
        </div>
      </div>
      <footer className="status-bar">
        <span className="status-bar__item">就绪</span>
        <span className="status-bar__item status-bar__spacer" />
        <span className="status-bar__item">字数 0</span>
        <span className="status-bar__item">行 0</span>
      </footer>
    </div>
  );
}
