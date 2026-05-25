import { describe, it, expect } from "vitest";
import { getMarkdownStats } from "../../src/editor/markdown/word_count";

describe("getMarkdownStats", () => {
  it("空文档", () => {
    const s = getMarkdownStats("");
    expect(s.wordCount).toBe(0);
    expect(s.charCount).toBe(0);
    expect(s.lineCount).toBe(1);
  });

  it("中文文本", () => {
    const s = getMarkdownStats("你好世界");
    expect(s.wordCount).toBe(4);
  });

  it("英文文本", () => {
    const s = getMarkdownStats("hello world test");
    expect(s.wordCount).toBe(3);
  });

  it("中英文混合", () => {
    const s = getMarkdownStats("你好 world 测试");
    expect(s.wordCount).toBe(5); // 你好(2) + world(1) + 测试(2)
  });

  it("Markdown 标题不计入字数", () => {
    const s = getMarkdownStats("# 你好");
    expect(s.wordCount).toBe(2); // 你好 = 2 CJK chars
  });

  it("加粗语法不计入字数", () => {
    const s = getMarkdownStats("**hello**");
    expect(s.wordCount).toBe(1); // hello
  });

  it("列表语法不计入字数", () => {
    const s = getMarkdownStats("- item one\n- item two");
    expect(s.wordCount).toBe(4); // item one item two
  });

  it("图片 alt 文本计入", () => {
    const s = getMarkdownStats("![风景图片](./img.png)");
    expect(s.wordCount).toBe(4); // 风景图片 = 4 CJK chars
  });

  it("多行统计", () => {
    const s = getMarkdownStats("line1\nline2\nline3");
    expect(s.lineCount).toBe(3);
  });

  it("字符数去空白", () => {
    const s = getMarkdownStats("a b  c");
    expect(s.charCount).toBe(3); // a b c → "abc"
  });

  it("代码块计入统计", () => {
    const s = getMarkdownStats("```\nconst x = 1;\n```\nhello");
    expect(s.wordCount).toBeGreaterThan(0);
  });
});
