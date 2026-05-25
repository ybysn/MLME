/**
 * 模块职责：Markdown 文档统计纯函数。
 * 输入：Markdown 原始文本。
 * 输出：MarkdownStats（字数、字符数、行数）。
 */
export interface MarkdownStats {
  wordCount: number;
  charCount: number;
  lineCount: number;
}

const MD_SYNTAX_RE = /[#*_`~>\[\]()!{}\\.+\-|=\^~:]/g;

const CJK_RE = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/g;

const WORD_RE = /[a-zA-Z0-9]+/g;

export function getMarkdownStats(markdown: string): MarkdownStats {
  const lineCount = markdown ? markdown.split(/\r?\n/).length : 1;

  let wordCount = 0;

  const cjk = markdown.match(CJK_RE);
  if (cjk) wordCount += cjk.length;

  let cleaned = markdown;
  // 去除图片语法 ![...](...)
  cleaned = cleaned.replace(/!\[[^\]]*\]\([^)]*\)/g, "");
  // 去除链接语法 [...](...)
  cleaned = cleaned.replace(/\[[^\]]*\]\([^)]*\)/g, "");
  // 去除行内代码 `...`
  cleaned = cleaned.replace(/`[^`]*`/g, "");
  // 去除 Markdown 语法符号
  cleaned = cleaned.replace(MD_SYNTAX_RE, " ");
  // 统计英文单词
  const words = cleaned.match(WORD_RE);
  if (words) wordCount += words.length;

  // 字符数（去空白）
  const charCount = markdown.replace(/\s/g, "").length;

  return { wordCount, charCount, lineCount };
}
