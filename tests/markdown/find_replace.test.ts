import { describe, it, expect } from "vitest";
import {
  findMatches,
  replaceCurrentMatch,
  replaceAllMatches,
} from "../../src/editor/markdown/find_replace";

describe("findMatches", () => {
  it("普通匹配", () => {
    const result = findMatches("hello world hello", "hello", { caseSensitive: true });
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ start: 0, end: 5, text: "hello" });
    expect(result[1]).toMatchObject({ start: 12, end: 17, text: "hello" });
  });

  it("大小写不敏感匹配", () => {
    const result = findMatches("Hello hello HELLO", "hello", { caseSensitive: false });
    expect(result).toHaveLength(3);
  });

  it("大小写敏感匹配", () => {
    const result = findMatches("Hello hello HELLO", "hello", { caseSensitive: true });
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe("hello");
  });

  it("空查询返回空", () => {
    const result = findMatches("hello world", "", { caseSensitive: true });
    expect(result).toEqual([]);
  });

  it("中文匹配", () => {
    const result = findMatches("你好世界 你好", "你好", { caseSensitive: true });
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ start: 0, end: 2, text: "你好" });
    expect(result[1]).toMatchObject({ start: 5, end: 7, text: "你好" });
  });

  it("多行文本匹配", () => {
    const content = "line1 abc\nline2 abc\nline3 abc";
    const result = findMatches(content, "abc", { caseSensitive: true });
    expect(result).toHaveLength(3);
  });

  it("查询长度大于内容时返回空", () => {
    const result = findMatches("ab", "abcdef", { caseSensitive: true });
    expect(result).toEqual([]);
  });

  it("无匹配时返回空", () => {
    const result = findMatches("hello world", "xyz", { caseSensitive: true });
    expect(result).toEqual([]);
  });
});

describe("replaceCurrentMatch", () => {
  it("替换当前匹配项", () => {
    const match = findMatches("hello world hello", "hello", { caseSensitive: true })[0];
    const result = replaceCurrentMatch("hello world hello", match, "hi");
    expect(result.content).toBe("hi world hello");
    expect(result.cursorPos).toBe(2);
  });

  it("替换中间字符", () => {
    const match = findMatches("hello world hello", "world", { caseSensitive: true })[0];
    const result = replaceCurrentMatch("hello world hello", match, "earth");
    expect(result.content).toBe("hello earth hello");
    expect(result.cursorPos).toBe(11);
  });

  it("中文替换", () => {
    const match = findMatches("你好世界", "世界", { caseSensitive: true })[0];
    const result = replaceCurrentMatch("你好世界", match, "地球");
    expect(result.content).toBe("你好地球");
  });
});

describe("replaceAllMatches", () => {
  it("全部替换", () => {
    const result = replaceAllMatches("a b a b a", "a", "x", { caseSensitive: true });
    expect(result.content).toBe("x b x b x");
    expect(result.count).toBe(3);
  });

  it("没有匹配时不变", () => {
    const result = replaceAllMatches("hello world", "xyz", "abc", { caseSensitive: true });
    expect(result.content).toBe("hello world");
    expect(result.count).toBe(0);
  });

  it("中文替换", () => {
    const result = replaceAllMatches("你好你好", "你好", "再见", { caseSensitive: true });
    expect(result.content).toBe("再见再见");
    expect(result.count).toBe(2);
  });

  it("大小写敏感替换", () => {
    const result = replaceAllMatches("Hello hello", "hello", "hi", { caseSensitive: true });
    expect(result.content).toBe("Hello hi");
    expect(result.count).toBe(1);
  });

  it("大小写不敏感替换", () => {
    const result = replaceAllMatches("Hello hello HELLO", "hello", "hi", { caseSensitive: false });
    expect(result.content).toBe("hi hi hi");
    expect(result.count).toBe(3);
  });
});
