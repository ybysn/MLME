/**
 * 模块职责：中间编辑区面板，使用 textarea 作为临时编辑区并显示底部状态栏。
 * 当前输入：文档内容、文件名、脏状态、编辑状态、标题数、内容变更回调。
 * 当前输出：空白提示或 textarea、底部状态栏（文件名/保存状态/字符/词数/行数/标题数）。
 * 后续扩展点：替换 textarea 为 Milkdown 编辑器，接入编辑器文档模型。
 * 公开 ref：scrollToLine(line) 用于大纲跳转。
 */
import { forwardRef, useRef, useImperativeHandle } from "react";

export interface EditorPanelProps {
  content: string;
  fileName: string;
  isDirty: boolean;
  isEditing: boolean;
  headingCount: number;
  onContentChange: (content: string) => void;
}

export interface EditorPanelHandle {
  scrollToLine: (line: number) => void;
}

export const EditorPanel = forwardRef<EditorPanelHandle, EditorPanelProps>(
  function EditorPanel(
    { content, fileName, isDirty, isEditing, headingCount, onContentChange },
    ref,
  ) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useImperativeHandle(ref, () => ({
      scrollToLine(line: number) {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const lines = textarea.value.split("\n");
        const targetLine = Math.min(line - 1, lines.length);
        let offset = 0;
        for (let i = 0; i < targetLine; i++) {
          offset += lines[i].length + 1;
        }

        textarea.focus();
        textarea.setSelectionRange(offset, offset);
      },
    }));

    const charCount = content.length;
    const lineCount = content ? content.split("\n").length : 0;
    const wordMatches =
      content.match(/[\u4e00-\u9fff\uff00-\uffef]|[a-zA-Z0-9]+/g) ?? [];
    const wordCount = wordMatches.length;

    if (!isEditing) {
      return (
        <div className="panel panel--editor">
          <div className="panel__body panel__body--editor">
            <div className="editor-empty-state">
              <span className="editor-empty-state__icon">&#128196;</span>
              <p className="editor-empty-state__text">未打开文件</p>
              <p className="editor-empty-state__hint">
                Ctrl+O 打开 Markdown 文件，或 Ctrl+N 新建文档
              </p>
            </div>
          </div>
          <footer className="status-bar">
            <span className="status-bar__item">就绪</span>
            <span className="status-bar__item status-bar__spacer" />
            <span className="status-bar__item">字数 {charCount}</span>
            <span className="status-bar__item">行 {lineCount}</span>
          </footer>
        </div>
      );
    }

    return (
      <div className="panel panel--editor">
        <div className="panel__body panel__body--editor-editing">
          <textarea
            ref={textareaRef}
            className="editor-textarea"
            value={content}
            onChange={(e) => onContentChange(e.target.value)}
            placeholder="在此输入 Markdown 内容..."
            spellCheck={false}
          />
        </div>
        <footer className="status-bar">
          <span className="status-bar__item" title={fileName}>
            {fileName}
          </span>
          <span className="status-bar__item">
            {isDirty ? "未保存" : "已保存"}
          </span>
          <span className="status-bar__item status-bar__spacer" />
          <span className="status-bar__item">字数 {charCount}</span>
          <span className="status-bar__item">词数 {wordCount}</span>
          <span className="status-bar__item">行 {lineCount}</span>
          <span className="status-bar__item">标题 {headingCount}</span>
        </footer>
      </div>
    );
  },
);
