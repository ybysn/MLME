~~~text
任务：实现 Mermaid 图表渲染。只增强 Markdown 渲染、HTML 导出、PDF 导出和打印层，不修改图片资产链路、写作模式生命周期、窗口关闭守卫。

请严格遵守 AGENTS.md、docs/PRD.md、docs/architecture.md、docs/markdown_spec.md，以及“跨项目开发准则 v1.0”：
- 小步开发；
- 明确影响面；
- 不破坏核心闭环；
- 不重复造轮子；
- 每步可回滚；
- 完成后必须做回归验证。

当前稳定基线：
1. 写作模式 / 源码模式 / 分屏模式正常；
2. 图片资产链路已稳定；
3. Markdown 正文只保存相对路径；
4. 代码块语法高亮已完成；
5. KaTeX 数学公式渲染如已完成则不能回退；
6. 窗口关闭未保存确认已修复；
7. 当前不允许修改图片链路、关闭守卫、写作模式生命周期。

本阶段目标：
支持 Markdown fenced code block 中的 Mermaid 图表：

```mermaid
flowchart TD
  A[开始] --> B{判断}
  B -->|是| C[执行]
  B -->|否| D[结束]
~~~

要求：

1. 分屏预览中渲染 Mermaid 图；
2. HTML 导出中渲染 Mermaid 图；
3. PDF 导出中渲染 Mermaid 图；
4. 打印中渲染 Mermaid 图；
5. 源码模式仍显示原始 Markdown；
6. 保存后的 Markdown 不被改写；
7. 写作模式暂时不强制原生渲染 Mermaid，除非现有渲染链天然支持。

重要限制：

1. 不要修改图片资产链路；
2. 不要修改 TyporaEditorPanel 生命周期；
3. 不要修改窗口关闭守卫；
4. 不要修改文件打开/保存；
5. 不要修改自动保存；
6. 不要修改 src-tauri；
7. 不要引入除 mermaid 外的依赖；
8. 不要做 Mermaid 编辑器；
9. 不要做交互式点击事件；
10. 不要把 Mermaid SVG 写回 Markdown；
11. 不要允许 Mermaid 执行危险 HTML/script。

一、依赖选择

允许新增：

mermaid

安装：

pnpm add mermaid

不要引入其他图表库。

二、渲染策略

官方文档推荐通过 `mermaid.initialize({ startOnLoad: false })` 禁止 Mermaid 自动扫描页面，然后由应用控制渲染。

本项目必须采用主动渲染策略：

1. markdown-it 渲染时，把 ```mermaid 代码块转成占位节点：

或：

1. MarkdownPreview 挂载/内容变化后，主动调用 Mermaid 渲染；
2. 不允许 Mermaid 自动扫描整个页面；
3. 不允许 Mermaid 修改 Markdown content。

三、新增 Mermaid 渲染服务

新增：

src/editor/markdown/mermaid_renderer.ts

职责：

1. 初始化 mermaid；
2. 提供 renderMermaidBlocks(container: HTMLElement, theme: "light" | "dark")；
3. 只渲染 container 内的 Mermaid block；
4. 渲染失败时显示错误提示；
5. 不影响其他 Markdown 内容。

初始化建议：

mermaid.initialize({
startOnLoad: false,
securityLevel: "strict",
theme: theme === "dark" ? "dark" : "default"
});

注意：

1. securityLevel 第一版必须使用 strict；
2. 不启用 click callback；
3. 不使用 loose；
4. 不允许 HTML 标签执行。

四、Markdown 渲染接入

重点修改：

src/editor/markdown/render_markdown.ts

要求：

1. 识别 fenced code block 的 language 为 mermaid；
2. 不走 highlight.js；
3. 输出 Mermaid 专用容器；
4. 其他代码块继续走 highlight.js；
5. 未指定语言代码块不受影响；
6. markdown 原文不变。

五、MarkdownPreview 接入

修改：

src/components/editor/MarkdownPreview.tsx

要求：

1. 预览内容渲染后，在 useEffect 中调用 renderMermaidBlocks；
2. 只在 containerRef.current 存在时执行；
3. content/theme 变化后重新渲染；
4. 使用 generation guard，避免旧异步渲染覆盖新内容；
5. 渲染失败只影响当前图表，不导致整个预览崩溃；
6. 不触碰图片 data URL 解析链路。

六、导出 HTML / PDF / 打印

检查：

src/services/export_service.ts
src/services/print_service.ts
或当前导出相关文件。

目标：

1. HTML 导出中 Mermaid 图应渲染成 SVG；
2. PDF 导出中 Mermaid 图应正常显示；
3. 打印中 Mermaid 图应正常显示。

推荐方案：

1. 导出时先用 renderMarkdownToHtml 生成 HTML；
2. 如果导出环境中可以执行前端渲染，则先将 Mermaid block 转成 SVG；
3. 或在导出 HTML 中内联 Mermaid 渲染后的 SVG；
4. 不要让导出 HTML 依赖外部 CDN；
5. 不要把 Mermaid 源码直接显示为代码块，除非渲染失败。

如果本阶段导出端渲染复杂：

- 先保证预览中 Mermaid 正常；
- HTML/PDF 导出输出 Mermaid 源码块并标注“下一阶段支持导出渲染”不算最终完成。
  但优先尝试支持导出。

七、样式

修改：

src/styles/app.css

增加：

1. .mermaid-block：
   - margin；
   - padding；
   - border；
   - border-radius；
   - background；
   - overflow-x auto；
2. .mermaid-error：
   - 红色/警告样式；
   - 显示错误原因；
   - 不显示大段堆栈；
3. 深色主题适配。

八、测试样本

新增：

tests/markdown_cases/mermaid.md

内容覆盖：

1. flowchart；
2. sequenceDiagram；
3. classDiagram；
4. 中文节点；
5. Mermaid 语法错误；
6. 普通代码块 ```mermaidx 不应渲染；
7. 代码块里的 script 字符串不执行。

示例：

```mermaid
flowchart TD
  A[开始] --> B{是否完成}
  B -->|是| C[提交]
  B -->|否| D[继续]
sequenceDiagram
  participant 用户
  participant 编辑器
  用户->>编辑器: 输入 Markdown
  编辑器-->>用户: 渲染图表
```

九、安全要求

1. securityLevel 使用 strict；
2. 不允许 Mermaid loose 模式；
3. 不开放 click；
4. 不执行 HTML；
5. 渲染失败不得抛出未捕获异常；
6. 不影响 Markdown 保存；
7. 不影响图片路径。

十、验收要求

完成后确保：

1. pnpm install 成功；

2. pnpm build 通过；

3. pnpm tauri dev 运行；

4. 分屏预览 flowchart 正常；

5. 分屏预览 sequenceDiagram 正常；

6. 中文节点正常；

7. Mermaid 语法错误时显示错误，不崩溃；

8. 普通代码块仍高亮；

9. ```mermaidx
   
   ```

10. 代码块高亮不回退；

11. KaTeX 不回退；

12. 图片插入/显示/保存重开不回退；

13. 窗口关闭守卫不回退；

14. 保存后的 Markdown 不被改写；

15. 控制台无新的红色核心错误；

16. git diff 不出现 src-tauri 无关改动。

完成后输出：

## 结论

是否完成 Mermaid 渲染。

## 改动文件

列出文件和改动。

## 影响面

说明没有触碰图片链路、窗口关闭守卫、写作模式生命周期。

## 核心逻辑

说明 Markdown 如何识别 Mermaid，预览如何渲染，失败如何兜底。

## 验证方式

列出已运行命令和手动测试项。

## 风险/未完成

说明 HTML/PDF 导出是否完全支持 Mermaid SVG，如未完全支持要明确。

```
---

# 4. 验证命令

```powershell
cd C:\Dev\markdown-editor

pnpm install
pnpm build
pnpm tauri dev
```

重点测：

| 场景              | 期望           |
| ----------------- | -------------- |
| `flowchart TD`    | 正常渲染       |
| `sequenceDiagram` | 正常渲染       |
| 中文节点          | 正常显示       |
| 错误 Mermaid      | 显示错误，不崩 |
| 普通代码块        | 继续高亮       |
| KaTeX             | 不回退         |
| 图片              | 不回退         |
| 保存后 Markdown   | 不被改写       |
| 关闭窗口          | 守卫不回退     |

------

# 5. 通过后提交

```powershell
git status
git diff --stat

git add .
git commit -m "feat: add mermaid diagram rendering"
git status
```

这一步完成后，Markdown 渲染能力就基本覆盖：**代码高亮 + 数学公式 + Mermaid 图表**。