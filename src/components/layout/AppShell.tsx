/**
 * 模块职责：主布局壳组件，定义三栏桌面布局结构。
 * 当前输入：无（纯布局容器）。
 * 当前输出：左侧文件树、中间编辑区、右侧大纲区。
 * 后续扩展点：菜单栏、快捷键绑定、全局状态注入。
 */
import { FileTreePanel } from "../file_tree/FileTreePanel";
import { EditorPanel } from "../editor/EditorPanel";
import { OutlinePanel } from "../outline/OutlinePanel";

export function AppShell() {
  return (
    <div className="app-shell">
      <aside className="app-shell__sidebar app-shell__sidebar--left">
        <FileTreePanel />
      </aside>
      <main className="app-shell__main">
        <EditorPanel />
      </main>
      <aside className="app-shell__sidebar app-shell__sidebar--right">
        <OutlinePanel />
      </aside>
    </div>
  );
}
