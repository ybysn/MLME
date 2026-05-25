# 开发总结与反思：写作模式字体/字号修复

> 日期：2026-05-26
> 关联 commit：`0b5e12e fix: apply font family and font size settings to writing mode (wysiwyg)`

---

## 1. 问题

用户在设置面板或工具栏中修改字号大小（`editorFontSize`）和字体（`editorFontFamily`）后，**源码模式（textarea）生效，写作模式（Milkdown Crepe WYSIWYG）不生效**。

## 2. 排查过程

1. 验证设置数据流完整：`localStorage → getSettings() → AppShell state → EditorPanel props → TyporaEditorPanel props → container inline style`，每一步均正确。
2. 发现源码模式生效的原因：`<textarea>` 的 inline `style={{ fontSize, fontFamily }}` 直接覆盖了 `.editor-textarea` 的 CSS。
3. 发现写作模式不生效的原因：Milkdown Crepe 的 `reset.css` 在 `.milkdown` 和 `.ProseMirror` 内部硬编码了 `font-family` 和 `font-size`，特异性（0-3-0）高于容器 inline style 的继承传播。
4. 定位到具体选择器：

```css
/* @milkdown/crepe/lib/theme/common/reset.css */
.milkdown { font-family: var(--crepe-font-default); }        /* 阻断 font-family 继承 */
.milkdown .ProseMirror p { font-size: 16px; }                /* 硬编码段落字号 */
.milkdown .ProseMirror h1-h6 { font-family: var(--crepe-font-title); font-size: XXpx; } /* 硬编码标题 */
```

## 3. 修复方案

**两层修复，最小侵入：**

| 层 | 位置 | 手段 |
|----|------|------|
| React 层 | `TyporaEditorPanel.tsx` | 容器 inline style 注入 CSS 自定义属性 |
| CSS 层 | `app.css` | 高特异性 `.typora-editor .milkdown .ProseMirror` 前缀规则覆盖 |

**为什么不是 JS 直接改 DOM：**
- 违反 AGENTS.md 规则：不允许绕过 ProseMirror transaction 操作编辑器 DOM
- Crepe 编辑器重建会覆盖 DOM 修改

**为什么不是修改 node_modules：**
- 不可持续，升级即失效

**为什么用 CSS 自定义属性：**
- `--crepe-font-default` / `--crepe-font-title` — 直接覆盖 Crepe 自带的字体变量，无需新 CSS 规则即可影响继承这些变量的元素
- `--editor-font-size` / `--editor-font-family` — 作为新规则的数据源，实现正文字体和标题缩放

## 4. 改动量

| 文件 | 增 | 删 | 净增 |
|------|---|---|----|
| `src/components/editor/TyporaEditorPanel.tsx` | 12 行 | 1 行 | +11 |
| `src/styles/app.css` | 57 行 | 0 行 | +57 |

总计 2 个文件，68 行净增。

## 5. 反思

### 做得好的

- **先 Plan 后 Build**。完整分析了 5 个 CSS 文件的字体策略（`reset.css` / `nord.css` / `prosemirror.css` / `crepe/style.css` / `app.css`），确认了 CSS 特异性层级和覆盖链后才动手。
- **CSS 自定义属性方案**。利用 `--crepe-font-default` 等 Crepe 原生变量做桥接，避免了大量 `!important` 和选择器冲突。
- **特异性精确计算**。`4-class` (.typora-editor .milkdown .ProseMirror p) vs `3-class` (.milkdown .ProseMirror p)，确保一次覆盖且未来 Crepe 升级不影响。

### 可改进的

- **未覆盖 `--crepe-font-code`**。代码块字体仍使用 `Inter / JetBrains Mono`，当前选择不覆盖是合理的（等宽字体不应随正文变化），但应显式记录此决策。
- **标题缩放比例是拍脑袋定的**（h1=2.5x, h2=2x...），未对照 Typora 或 VS Code 的真实比例。
- **CSS 变量回退值不完整**。`calc(var(--editor-font-size, 16px) * 2.5)` 的 fallback `16px` 只在变量未定义时生效，变量定义但为无效值时不会回退。

### 工程启示

1. **第三方编辑器库的样式侵入性强**。Milkdown Crepe 不仅仅是功能库，它自带的 `reset.css` 对整个 `.milkdown` 子树做了强力的样式重置。任何自定义主题都需要理解其 CSS 变量体系（`--crepe-font-*` / `--crepe-color-*` / `--crepe-shadow-*`）。
2. **inline style 不能替代 CSS 继承**。即使是 React inline style，在遇到子元素的显式 CSS 规则时也无法穿透，必须在 CSS 层解决。
3. **排查 Bug 先验证数据流**。本次快速定位到"非 React 层问题"节省了大量无效调试时间。

---

## 6. 后续建议

1. 如果未来引入更多主题（frame / nord-dark），需要同步添加对应的 `.typora-editor` 前缀覆盖规则。
2. 考虑在 `TyporaEditorPanel` 中集中管理编辑器 CSS 变量注入逻辑，封装为 `useEditorCssVariables(fontFamily, fontSize)` hook。
3. 标题缩放比例可抽取为常量或设置项，让用户可配置。
