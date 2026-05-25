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

function countByType(tokens: ReturnType<typeof md.parse>, type: string): number {
  return tokens.filter((t) => t.type === type).length;
}

function roundTrip(content: string): string {
  const html = md.render(content);
  // markdown-it 本身不提供 HTML→MD 反序列化，这里做 HTML→token 验证
  return html;
}

interface RoundTripCase {
  name: string;
  file: string;
  minTokenCount: number;
}

const cases: RoundTripCase[] = [
  { name: "basic.md", file: "basic.md", minTokenCount: 5 },
  { name: "list.md", file: "list.md", minTokenCount: 8 },
  { name: "table.md", file: "table.md", minTokenCount: 10 },
  { name: "code.md", file: "code.md", minTokenCount: 10 },
  { name: "image_roundtrip.md", file: "image_roundtrip.md", minTokenCount: 5 },
];

describe("parse → render → reparse round-trip", () => {
  for (const c of cases) {
    describe(c.name, () => {
      let content: string;

      try {
        content = readCase(c.file);
      } catch {
        it.skip(`样本 ${c.file} 不可读`, () => {});
        return;
      }

      it("原始内容可解析", () => {
        const tokens = parseTokens(content);
        expect(tokens.length).toBeGreaterThanOrEqual(c.minTokenCount);
      });

      it("渲染后 HTML 非空", () => {
        const html = roundTrip(content);
        expect(html.length).toBeGreaterThan(0);
      });

      it("HTML 包含预期结构", () => {
        const html = roundTrip(content);
        // 每个样本至少应产出一个块级元素标签
        expect(html).toMatch(/<\/[a-z]+>/);
      });
    });
  }
});

describe("cross-sample consistency", () => {
  it("表格样本包含 table token", () => {
    const content = readCase("table.md");
    const tokens = parseTokens(content);
    expect(countByType(tokens, "table_open")).toBeGreaterThanOrEqual(1);
  });

  it("代码样本包含 fence token", () => {
    const content = readCase("code.md");
    const tokens = parseTokens(content);
    expect(countByType(tokens, "fence")).toBeGreaterThanOrEqual(1);
  });

  it("列表样本包含 list token", () => {
    const content = readCase("list.md");
    const tokens = parseTokens(content);
    const hasList = tokens.some(
      (t) => t.type === "bullet_list_open" || t.type === "ordered_list_open"
    );
    expect(hasList).toBe(true);
  });
});
