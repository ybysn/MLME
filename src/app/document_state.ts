/// 模块职责：文档状态类型定义，描述当前编辑文档的核心状态。
/// 当前：仅类型定义，在 AppShell 中使用 React useState 管理。
/// 后续扩展点：可能提取为自定义 hook 或 context，加入保存状态、错误状态等。

export interface DocumentState {
  /** 当前文件的绝对路径，新文档为 null */
  currentPath: string | null;
  /** 文件名（含扩展名），新文档显示"未命名文档" */
  fileName: string;
  /** 编辑器中当前 Markdown 文本内容 */
  content: string;
  /** 自上次保存以来是否有未保存的修改 */
  isDirty: boolean;
  /** 是否已进入编辑状态（已打开文件或已新建文档） */
  isEditing: boolean;
}

export function createEmptyDocument(): DocumentState {
  return {
    currentPath: null,
    fileName: "未命名文档",
    content: "",
    isDirty: false,
    isEditing: false,
  };
}
