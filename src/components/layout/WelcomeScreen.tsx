/**
 * 模块职责：欢迎页组件，用于未打开任何文档时的启动界面。
 * 当前输入：onNewDocument、onOpenFile 两个回调。
 * 当前输出：产品名、说明文字、新建/打开按钮、最近文件占位。
 * 后续扩展点：最近文件列表展示、工作区入口、模板入口、版本号。
 */
import { useEffect, useCallback } from "react";

export interface WelcomeScreenProps {
  onNewDocument: () => void;
  onOpenFile: () => void;
}

export function WelcomeScreen({ onNewDocument, onOpenFile }: WelcomeScreenProps) {
  // 欢迎页状态下支持快捷键
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
          <button
            className="welcome-screen__btn welcome-screen__btn--primary"
            onClick={onNewDocument}
          >
            新建文档
          </button>
          <button
            className="welcome-screen__btn"
            onClick={onOpenFile}
          >
            打开文件
          </button>
        </div>
        <div className="welcome-screen__recent">
          <h3 className="welcome-screen__recent-title">最近文件</h3>
          <p className="welcome-screen__recent-empty">暂无最近打开的文件</p>
        </div>
      </div>
    </div>
  );
}
