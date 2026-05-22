/**
 * 模块职责：左侧侧边栏面板，通过 Tab 切换"文件"和"大纲"内容。
 * 当前输入：文件操作相关 props、大纲相关 props。
 * 当前输出：Tab 栏 + 文件操作区 / 大纲列表。
 * 后续扩展点：更多 tab（搜索、替换等）、tab 拖拽排序。
 */
import { useState } from "react";
import { FileTreePanel, type FileTreePanelProps } from "../file_tree/FileTreePanel";
import { OutlinePanel, type OutlinePanelProps } from "../outline/OutlinePanel";

export type SidebarTab = "files" | "outline";

export interface SidebarPanelProps {
  fileTreeProps: FileTreePanelProps;
  outlineProps: OutlinePanelProps;
}

const TABS: { key: SidebarTab; label: string }[] = [
  { key: "files", label: "文件" },
  { key: "outline", label: "大纲" },
];

export function SidebarPanel({ fileTreeProps, outlineProps }: SidebarPanelProps) {
  const [activeTab, setActiveTab] = useState<SidebarTab>("files");

  return (
    <div className="sidebar-panel">
      <nav className="sidebar-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={`sidebar-tabs__btn ${activeTab === tab.key ? "sidebar-tabs__btn--active" : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </nav>
      <div className="sidebar-panel__content">
        {activeTab === "files" && <FileTreePanel {...fileTreeProps} />}
        {activeTab === "outline" && <OutlinePanel {...outlineProps} />}
      </div>
    </div>
  );
}
