import { describe, it, expect } from "vitest";
import {
  toggleBold,
  toggleItalic,
  toggleInlineCode,
  setHeadingLevel,
  toggleUnorderedList,
  insertCodeBlock,
  insertLink,
} from "../../src/editor/markdown/edit_commands";

describe("toggleBold", () => {
  it("无选区时插入占位文本", () => {
    const result = toggleBold("hello world", 6, 6);
    expect(result.content).toBe("hello **strong text**world");
    expect(result.selectionStart).toBe(8);
    expect(result.selectionEnd).toBe(19);
  });

  it("包裹选区", () => {
    const result = toggleBold("hello world", 0, 5);
    expect(result.content).toBe("**hello** world");
  });

  it("取消包裹", () => {
    // toggleWrapper 检测选区前后是否有 **，需选区在包裹内容内
    const result = toggleBold("**hello** world", 2, 7);
    expect(result.content).toBe("hello world");
  });

  it("中文文本", () => {
    const result = toggleBold("你好世界", 2, 4);
    expect(result.content).toBe("你好**世界**");
  });
});

describe("toggleItalic", () => {
  it("无选区时插入占位文本", () => {
    const result = toggleItalic("text", 4, 4);
    expect(result.content).toBe("text*emphasized text*");
  });

  it("包裹选区", () => {
    const result = toggleItalic("hello world", 0, 5);
    expect(result.content).toBe("*hello* world");
  });

  it("取消包裹", () => {
    const result = toggleItalic("*hello* world", 1, 6);
    expect(result.content).toBe("hello world");
  });
});

describe("toggleInlineCode", () => {
  it("无选区时插入占位文本", () => {
    const result = toggleInlineCode("text", 4, 4);
    expect(result.content).toBe("text`code`");
  });

  it("包裹选区", () => {
    const result = toggleInlineCode("var x = 1", 4, 5);
    expect(result.content).toBe("var `x` = 1");
  });
});

describe("setHeadingLevel", () => {
  it("设置为 H1", () => {
    const result = setHeadingLevel("hello", 0, 0, 1);
    expect(result.content).toBe("# hello");
  });

  it("设置为 H2", () => {
    const result = setHeadingLevel("hello", 0, 0, 2);
    expect(result.content).toBe("## hello");
  });

  it("level=0 还原为段落", () => {
    const result = setHeadingLevel("# hello", 0, 0, 0);
    expect(result.content).toBe("hello");
  });

  it("切换标题级别", () => {
    const result = setHeadingLevel("# hello", 0, 0, 2);
    expect(result.content).toBe("## hello");
  });

  it("中文标题", () => {
    const result = setHeadingLevel("你好世界", 0, 0, 3);
    expect(result.content).toBe("### 你好世界");
  });
});

describe("toggleUnorderedList", () => {
  it("单行加列表符", () => {
    const result = toggleUnorderedList("item", 0, 0);
    expect(result.content).toBe("- item");
  });

  it("多行加列表符", () => {
    // 选区跨越多行时才会应用到所有行
    const result = toggleUnorderedList("item1\nitem2", 0, 11);
    expect(result.content).toBe("- item1\n- item2");
  });

  it("已有列表符移除", () => {
    const result = toggleUnorderedList("- item", 0, 0);
    expect(result.content).toBe("item");
  });
});

describe("insertCodeBlock", () => {
  it("无选区时插入模板", () => {
    const result = insertCodeBlock("", 0, 0);
    expect(result.content).toContain("```");
    expect(result.content).toContain("code here");
  });

  it("有选区时包裹", () => {
    const result = insertCodeBlock("console.log(1)", 0, 15);
    expect(result.content).toContain("```\nconsole.log(1)\n```");
  });
});

describe("insertLink", () => {
  it("无选区时插入模板", () => {
    const result = insertLink("text", 4, 4);
    expect(result.content).toBe("text[link text](url)");
  });

  it("有选区时包裹", () => {
    const result = insertLink("Go to OpenAI", 6, 12);
    expect(result.content).toBe("Go to [OpenAI](url)");
  });
});
