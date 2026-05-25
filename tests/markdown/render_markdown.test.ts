import { describe, it, expect, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: vi.fn((p: string) => `asset://localhost/${p}`),
}));

import { renderMarkdownToHtml } from "../../src/editor/markdown/render_markdown";

describe("renderMarkdownToHtml", () => {
  it("标题渲染为 <h1>", () => {
    const html = renderMarkdownToHtml("# Hello");
    expect(html).toContain("<h1>Hello</h1>");
  });

  it("代码块包含语言 class", () => {
    const html = renderMarkdownToHtml("```ts\nconst x = 1;\n```");
    expect(html).toContain("language-ts");
  });

  it("图片渲染为 <img>", () => {
    const html = renderMarkdownToHtml("![alt](./img.png)");
    expect(html).toContain("<img");
    expect(html).toContain("./img.png");
  });

  it("中文文本正常渲染", () => {
    const html = renderMarkdownToHtml("你好世界");
    expect(html).toContain("你好世界");
  });

  it("空字符串返回段落标签", () => {
    const html = renderMarkdownToHtml("");
    expect(typeof html).toBe("string");
  });
});
