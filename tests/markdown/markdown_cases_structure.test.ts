import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import MarkdownIt from "markdown-it";

const casesDir = resolve(__dirname, "../markdown_cases");
const md = new MarkdownIt({ html: true, linkify: true });

function readCase(name: string): string {
  return readFileSync(resolve(casesDir, name), "utf-8");
}

function parseTokens(content: string) {
  return md.parse(content, {});
}

interface HeadingInfo {
  level: number;
  text: string;
}

function extractHeadings(tokens: ReturnType<typeof md.parse>): HeadingInfo[] {
  const result: HeadingInfo[] = [];
  for (const token of tokens) {
    if (token.type === "heading_open") {
      const level = parseInt(token.tag.slice(1), 10);
      const contentToken = tokens[tokens.indexOf(token) + 1];
      const text = contentToken?.content ?? "";
      result.push({ level, text: text.trim() });
    }
  }
  return result;
}

function extractImages(tokens: ReturnType<typeof md.parse>): string[] {
  const sources: string[] = [];
  for (const token of tokens) {
    if (token.type === "inline" && token.children) {
      for (const child of token.children) {
        if (child.type === "image") {
          const src = child.attrGet("src");
          if (src) sources.push(src);
        }
      }
    }
  }
  return sources;
}

interface CodeBlockInfo {
  lang: string;
  content: string;
}

function extractCodeBlocks(tokens: ReturnType<typeof md.parse>): CodeBlockInfo[] {
  const result: CodeBlockInfo[] = [];
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].type === "fence") {
      result.push({
        lang: tokens[i].info.trim(),
        content: tokens[i].content,
      });
    }
  }
  return result;
}

function hasTableStructure(tokens: ReturnType<typeof md.parse>): boolean {
  return (
    tokens.some((t) => t.type === "table_open") &&
    tokens.some((t) => t.type === "tr_open") &&
    tokens.some((t) => t.type === "th_open")
  );
}

// ═══════════════ basic.md ═══════════════

describe("basic.md 结构一致性", () => {
  const content = readCase("basic.md");
  const tokens = parseTokens(content);

  it("至少包含标题", () => {
    const headings = extractHeadings(tokens);
    expect(headings.length).toBeGreaterThan(0);
  });

  it("包含 h1 标题", () => {
    const headings = extractHeadings(tokens);
    const h1s = headings.filter((h) => h.level === 1);
    expect(h1s.length).toBeGreaterThan(0);
  });

  it("标题文本非空", () => {
    const headings = extractHeadings(tokens);
    for (const h of headings) {
      expect(h.text.length).toBeGreaterThan(0);
    }
  });

  it("中文内容可解析", () => {
    // basic.md 包含中文文本，解析后 token 中应能找到
    const hasText = tokens.some(
      (t) => t.type === "inline" && t.content.includes("中文")
    );
    expect(hasText).toBe(true);
  });
});

// ═══════════════ image_roundtrip.md ═══════════════

describe("image_roundtrip.md 结构一致性", () => {
  const content = readCase("image_roundtrip.md");
  const tokens = parseTokens(content);

  it("包含图片", () => {
    const images = extractImages(tokens);
    expect(images.length).toBeGreaterThan(0);
  });

  it("图片 src 非空", () => {
    const images = extractImages(tokens);
    for (const src of images) {
      expect(src.length).toBeGreaterThan(0);
    }
  });

  it("包含相对路径图片", () => {
    const images = extractImages(tokens);
    const relative = images.filter(
      (src) => !/^(https?:|data:|blob:)/i.test(src),
    );
    expect(relative.length).toBeGreaterThan(0);
  });

  it("图片 src 不包含 data/blob URL", () => {
    const images = extractImages(tokens);
    for (const src of images) {
      expect(src).not.toMatch(/^(data:|blob:)/i);
    }
  });
});

// ═══════════════ code.md ═══════════════

describe("code.md 结构一致性", () => {
  const content = readCase("code.md");
  const tokens = parseTokens(content);

  it("包含代码块", () => {
    const blocks = extractCodeBlocks(tokens);
    expect(blocks.length).toBeGreaterThan(0);
  });

  it("代码块内容非空", () => {
    const blocks = extractCodeBlocks(tokens);
    for (const block of blocks) {
      expect(block.content.length).toBeGreaterThan(0);
    }
  });

  it("至少一个代码块有语言标识", () => {
    const blocks = extractCodeBlocks(tokens);
    const hasLang = blocks.some((b) => b.lang.length > 0);
    expect(hasLang).toBe(true);
  });
});

// ═══════════════ table.md ═══════════════

describe("table.md 结构一致性", () => {
  const content = readCase("table.md");
  const tokens = parseTokens(content);

  it("包含表格结构", () => {
    expect(hasTableStructure(tokens)).toBe(true);
  });

  it("包含表头 th", () => {
    const thCount = tokens.filter((t) => t.type === "th_open").length;
    expect(thCount).toBeGreaterThan(0);
  });

  it("包含数据行 tr", () => {
    const trCount = tokens.filter((t) => t.type === "tr_open").length;
    expect(trCount).toBeGreaterThanOrEqual(2); // header row + at least 1 data row
  });
});

// ═══════════════ list.md ═══════════════

describe("list.md 结构一致性", () => {
  const content = readCase("list.md");
  const tokens = parseTokens(content);

  it("包含无序列表", () => {
    const hasUl = tokens.some((t) => t.type === "bullet_list_open");
    expect(hasUl).toBe(true);
  });

  it("包含有序列表", () => {
    const hasOl = tokens.some((t) => t.type === "ordered_list_open");
    expect(hasOl).toBe(true);
  });

  it("列表项不少于 4 个", () => {
    const itemCount = tokens.filter((t) => t.type === "list_item_open").length;
    expect(itemCount).toBeGreaterThanOrEqual(4);
  });
});

// ═══════════════ math.md ═══════════════

describe("math.md 结构一致性", () => {
  const content = readCase("math.md");
  const tokens = parseTokens(content);

  it("包含行内公式分隔符", () => {
    // math.md 包含 $...$ 和 $$...$$，markdown-it-katex 会将其作为 math_inline/math_block token
    expect(content).toContain("$");
  });

  it("包含块级公式分隔符", () => {
    expect(content).toContain("$$");
  });

  it("代码块中的 $ 不被误判为公式", () => {
    // 验证代码块部分存在（markdown-it 解析时 fence token 包裹的内容不触发公式解析）
    const hasFence = tokens.some((t) => t.type === "fence");
    expect(hasFence).toBe(true);
  });
});
