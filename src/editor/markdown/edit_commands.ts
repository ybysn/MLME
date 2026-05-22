/**
 * 模块职责：为 textarea 编辑器提供 Markdown 基础编辑命令（纯函数）。
 * 输入：当前内容、光标起止位置。
 * 输出：新内容、新光标起止位置。
 * 后续扩展点：撤销栈集成、更多语法（删除线、任务列表、表格）。
 * 风险点：命令不直接操作 DOM/React 状态，光标位置计算需充分测试。
 */

export interface EditCommandResult {
  content: string;
  selectionStart: number;
  selectionEnd: number;
}

/** 返回指定字符索引所在行的起止位置（content 中的绝对索引） */
function getLineBounds(content: string, pos: number): { lineStart: number; lineEnd: number } {
  let lineStart = pos;
  while (lineStart > 0 && content[lineStart - 1] !== "\n") {
    lineStart--;
  }
  let lineEnd = pos;
  while (lineEnd < content.length && content[lineEnd] !== "\n") {
    lineEnd++;
  }
  return { lineStart, lineEnd };
}

/** 展开选区到覆盖完整行范围 */
function getFullLineRange(content: string, start: number, end: number): { lineStart: number; lineEnd: number } {
  const s = getLineBounds(content, start);
  const e = getLineBounds(content, Math.max(start, end));
  return { lineStart: s.lineStart, lineEnd: e.lineEnd };
}

// ═══════════════════════════════════════════════════
//  行内包裹命令（加粗、斜体、行内代码）
// ═══════════════════════════════════════════════════

function toggleWrapper(
  content: string,
  start: number,
  end: number,
  wrapper: string,
  placeholder: string,
): EditCommandResult {
  const wLen = wrapper.length;

  if (start === end) {
    // 无选区：插入占位文本
    const before = content.slice(0, start);
    const after = content.slice(start);
    const newContent = before + wrapper + placeholder + wrapper + after;
    return {
      content: newContent,
      selectionStart: start + wLen,
      selectionEnd: start + wLen + placeholder.length,
    };
  }

  // 检测选区两侧是否已被包裹
  const before = content.slice(Math.max(0, start - wLen), start);
  const after = content.slice(end, end + wLen);

  if (before === wrapper && after === wrapper) {
    // 取消包裹
    const inner = content.slice(start, end);
    const newContent =
      content.slice(0, start - wLen) + inner + content.slice(end + wLen);
    return {
      content: newContent,
      selectionStart: start - wLen,
      selectionEnd: end - wLen,
    };
  }

  // 包裹选区
  const selected = content.slice(start, end);
  const wrapped = wrapper + selected + wrapper;
  const newContent = content.slice(0, start) + wrapped + content.slice(end);
  return {
    content: newContent,
    selectionStart: start,
    selectionEnd: start + wrapped.length,
  };
}

export function toggleBold(content: string, start: number, end: number): EditCommandResult {
  return toggleWrapper(content, start, end, "**", "strong text");
}

export function toggleItalic(content: string, start: number, end: number): EditCommandResult {
  return toggleWrapper(content, start, end, "*", "emphasized text");
}

export function toggleInlineCode(content: string, start: number, end: number): EditCommandResult {
  return toggleWrapper(content, start, end, "`", "code");
}

// ═══════════════════════════════════════════════════
//  行级前缀命令（标题、引用、列表）
// ═══════════════════════════════════════════════════

interface LineToggleConfig {
  prefix: string;
  /** 匹配已有的前缀正则（用于检测是否已应用） */
  match: RegExp;
}

const HEADING_CONFIG: LineToggleConfig = {
  prefix: "## ",
  match: /^ {0,3}#{1,6} /,
};

const BLOCKQUOTE_CONFIG: LineToggleConfig = {
  prefix: "> ",
  match: /^ {0,3}> ?/,
};

const UNORDERED_LIST_CONFIG: LineToggleConfig = {
  prefix: "- ",
  match: /^ {0,3}[-*+] /,
};

const ORDERED_LIST_CONFIG: LineToggleConfig = {
  prefix: "1. ",
  match: /^ {0,3}\d+\. /,
};

function toggleLinePrefix(
  content: string,
  start: number,
  end: number,
  config: LineToggleConfig,
): EditCommandResult {
  const { lineStart, lineEnd } = getFullLineRange(content, start, end);
  const beforeText = content.slice(0, lineStart);
  const linesBlock = content.slice(lineStart, lineEnd);
  const afterText = content.slice(lineEnd);

  const lines = linesBlock.split("\n");

  // 决定操作：如果所有非空行都已带前缀 → 移除；否则 → 添加
  const allHasPrefix = lines.every(
    (line) => line.trim() === "" || config.match.test(line),
  );

  let offset = 0;
  const processed = lines.map((line) => {
    if (line.trim() === "") return line;

    if (allHasPrefix) {
      // 移除前缀
      const stripped = line.replace(config.match, "");
      offset -= line.length - stripped.length;
      return stripped;
    }

    // 添加前缀：去掉已有前缀再添加（避免重复），保留缩进
    const stripped = line.replace(config.match, "");
    const newLine = config.prefix + stripped;
    offset += newLine.length - line.length;
    return newLine;
  });

  const newLinesBlock = processed.join("\n");
  const newContent = beforeText + newLinesBlock + afterText;

  return {
    content: newContent,
    selectionStart: Math.max(0, start + offset),
    selectionEnd: Math.max(0, end + offset),
  };
}

export function toggleHeading(content: string, start: number, end: number): EditCommandResult {
  return toggleLinePrefix(content, start, end, HEADING_CONFIG);
}

/** 将当前行设置为指定级别标题；若已是该级别则还原为正文 */
export function setHeading(content: string, start: number, _end: number, level: number): EditCommandResult {
  const { lineStart, lineEnd } = getLineBounds(content, start);
  const line = content.slice(lineStart, lineEnd);
  const prefix = "#".repeat(level) + " ";

  // 检测当前行是否为同级别标题
  const sameLevel = new RegExp(`^ {0,3}${"#".repeat(level)} `).test(line);

  let newLine: string;
  if (sameLevel) {
    // 还原为正文
    newLine = line.replace(/^ {0,3}#{1,6} /, "");
  } else {
    // 去掉旧标题前缀，添加新级别
    newLine = line.replace(/^ {0,3}#{1,6} /, "");
    newLine = prefix + newLine;
  }

  const newContent = content.slice(0, lineStart) + newLine + content.slice(lineEnd);
  const offset = newLine.length - line.length;

  return {
    content: newContent,
    selectionStart: Math.max(0, start + offset),
    selectionEnd: Math.max(0, start + offset),
  };
}

/**
 * 设置标题级别（0=段落, 1-6=H1-H6）。
 * 由工具栏标题下拉调用，替代旧 H1/H2 按钮。
 */
export function setHeadingLevel(
  content: string,
  start: number,
  _end: number,
  level: number,
): EditCommandResult {
  if (level === 0) {
    // 段落：移除当前行所有标题标记
    const { lineStart, lineEnd } = getLineBounds(content, start);
    const line = content.slice(lineStart, lineEnd);
    const newLine = line.replace(/^ {0,3}#{1,6} /, "");
    const newContent = content.slice(0, lineStart) + newLine + content.slice(lineEnd);
    const offset = newLine.length - line.length;
    return {
      content: newContent,
      selectionStart: Math.max(0, start + offset),
      selectionEnd: Math.max(0, start + offset),
    };
  }
  return setHeading(content, start, _end, level);
}

export function toggleBlockquote(content: string, start: number, end: number): EditCommandResult {
  return toggleLinePrefix(content, start, end, BLOCKQUOTE_CONFIG);
}

export function toggleUnorderedList(content: string, start: number, end: number): EditCommandResult {
  return toggleLinePrefix(content, start, end, UNORDERED_LIST_CONFIG);
}

export function toggleOrderedList(content: string, start: number, end: number): EditCommandResult {
  return toggleLinePrefix(content, start, end, ORDERED_LIST_CONFIG);
}

// ═══════════════════════════════════════════════════
//  代码块
// ═══════════════════════════════════════════════════

export function insertCodeBlock(content: string, start: number, end: number): EditCommandResult {
  const fence = "```";
  const placeholder = "code here";

  if (start === end) {
    // 插入空白代码块模板
    const before = content.slice(0, start);
    const after = content.slice(start);
    // 在行首插入时前面不加多余换行
    const atLineStart = start === 0 || content[start - 1] === "\n";
    const prefix = atLineStart ? "" : "\n";
    const suffix = after.startsWith("\n") || after === "" ? "" : "\n";
    const block = `${prefix}${fence}\n${placeholder}\n${fence}${suffix}`;
    const newContent = before + block + after;
    const sel = start + prefix.length + fence.length + 1; // 跳到 placeholder 开头
    return {
      content: newContent,
      selectionStart: sel,
      selectionEnd: sel + placeholder.length,
    };
  }

  // 包裹选中内容
  const before = content.slice(0, start);
  const selected = content.slice(start, end);
  const after = content.slice(end);

  const atLineStart = start === 0 || content[start - 1] === "\n";
  const prefix = atLineStart ? "" : "\n";
  const suffix = after.startsWith("\n") || after === "" ? "" : "\n";

  const block = `${prefix}${fence}\n${selected}\n${fence}${suffix}`;
  const newContent = before + block + after;

  return {
    content: newContent,
    selectionStart: start,
    selectionEnd: start + block.length,
  };
}

// ═══════════════════════════════════════════════════
//  链接与图片
// ═══════════════════════════════════════════════════

export function insertLink(content: string, start: number, end: number): EditCommandResult {
  if (start === end) {
    const placeholder = "[link text](url)";
    const newContent = content.slice(0, start) + placeholder + content.slice(start);
    // 选中 "link text"
    return {
      content: newContent,
      selectionStart: start + 1,
      selectionEnd: start + 10, // "link text".length = 9 + 1
    };
  }

  const selected = content.slice(start, end);
  const template = `[${selected}](url)`;
  const newContent = content.slice(0, start) + template + content.slice(end);
  // 选中 "url"
  const urlStart = start + selected.length + 3; // [text]( + url
  return {
    content: newContent,
    selectionStart: urlStart,
    selectionEnd: urlStart + 3,
  };
}

/**
 * 插入图片占位语法（纯文本兜底方案，仅用于缺少资产系统的降级场景）。
 * 实际图片插入应走 asset_service → saveImageAsset 流程，
 * 确保图片被复制到 .assets 目录并以相对路径引用。
 */
export function insertImage(content: string, start: number, end: number): EditCommandResult {
  if (start === end) {
    const placeholder = "![alt text](url)";
    const newContent = content.slice(0, start) + placeholder + content.slice(start);
    return {
      content: newContent,
      selectionStart: start + 2,
      selectionEnd: start + 10, // "alt text"
    };
  }

  const selected = content.slice(start, end);
  const template = `![${selected}](url)`;
  const newContent = content.slice(0, start) + template + content.slice(end);
  const urlStart = start + selected.length + 4;
  return {
    content: newContent,
    selectionStart: urlStart,
    selectionEnd: urlStart + 3,
  };
}
