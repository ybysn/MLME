/**
 * 模块职责：右侧大纲面板，展示当前文档标题结构和文档统计信息。
 * 当前输入：无（纯占位 UI）。
 * 当前输出：大纲标题、标题层级占位、文档统计占位。
 * 后续扩展点：接入编辑器文档模型提取标题、点击跳转、统计数值实时更新。
 */
export function OutlinePanel() {
  return (
    <div className="panel panel--outline">
      <header className="panel__header">
        <h2 className="panel__title">大纲</h2>
      </header>
      <div className="panel__body">
        <div className="outline-placeholder">
          请打开 Markdown 文件以查看大纲
        </div>
      </div>
      <footer className="outline-stats">
        <div className="outline-stats__item">
          <span className="outline-stats__label">字符</span>
          <span className="outline-stats__value">0</span>
        </div>
        <div className="outline-stats__item">
          <span className="outline-stats__label">词数</span>
          <span className="outline-stats__value">0</span>
        </div>
        <div className="outline-stats__item">
          <span className="outline-stats__label">行数</span>
          <span className="outline-stats__value">0</span>
        </div>
      </footer>
    </div>
  );
}
