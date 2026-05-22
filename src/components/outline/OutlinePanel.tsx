/**
 * 模块职责：大纲面板，展示文档标题层级结构，支持点击跳转。
 * 当前输入：outlineItems（标题列表）、isEditing（是否编辑中）、onSelectOutlineItem（点击回调）。
 * 当前输出：缩进标题列表、行号。
 * 后续扩展点：标题折叠/展开、高亮当前滚动位置。
 */
import { type MarkdownOutlineItem } from "../../editor/markdown/parse_outline";

export interface OutlinePanelProps {
  outlineItems: MarkdownOutlineItem[];
  isEditing: boolean;
  onSelectOutlineItem: (item: MarkdownOutlineItem) => void;
}

export function OutlinePanel({
  outlineItems,
  isEditing,
  onSelectOutlineItem,
}: OutlinePanelProps) {
  const headingCount = outlineItems.length;

  return (
    <div className="panel panel--outline">
      <header className="panel__header">
        <h2 className="panel__title">大纲</h2>
      </header>
      <div className="panel__body">
        {!isEditing || headingCount === 0 ? (
          <div className="outline-placeholder">
            {!isEditing ? "请打开 Markdown 文件以查看大纲" : "暂无标题"}
          </div>
        ) : (
          <ul className="outline-list">
            {outlineItems.map((item) => (
              <li
                key={item.id}
                className="outline-list__item"
                style={{ paddingLeft: `${(item.level - 1) * 12}px` }}
                onClick={() => onSelectOutlineItem(item)}
              >
                <span className={`outline-list__marker outline-list__marker--h${item.level}`}>
                  {"#".repeat(item.level)}
                </span>
                <span className="outline-list__text">{item.text}</span>
                <span className="outline-list__line">{item.line}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
