# Reality Report — MarkdownEditor 功能依赖分析

> 生成日期：2026-05-26
> 基于：Principle.md 重构原则 + 全量 src/ 依赖图扫描
> 源码文件：38 `.ts`/`.tsx`

---

## 1. 整体架构评估

| 指标 | 状态 |
|------|:---:|
| 源文件总数 | 38 |
| 循环依赖 | ✅ 零（严格 DAG） |
| 依赖方向 | ✅ UI → Component → Editor Logic → Service → Leaf |
| Rust 层 | 2 command 文件（`file_commands.rs` 404 行, `asset_commands.rs` 245 行） |
| CSS | 单文件 `app.css` ~2300 行 |

---

## 2. 文件规模分析（Principle.md §4 单文件规则）

| 文件 | 行数 | 规则 | 状态 |
|------|:---:|------|:---:|
| `EditorPanel.tsx` | **1060** | >500 → 必须拆分 | 🔴 |
| `AppShell.tsx` | **808** | >500 → 必须拆分 | 🔴 |
| `TyporaEditorPanel.tsx` | **611** | >500 → 必须拆分 | 🔴 |
| `edit_commands.ts` | 344 | >300 → 检查拆分 | 🟡 |
| `export_service.ts` | 301 | >300 → 检查拆分 | 🟡 |
| `app.css` | ~2300 | — 非 TS 文件但严重影响维护 | 🔴 |

---

## 3. 依赖层级图

```
Layer 0: Entry             main.tsx → App.tsx → AppShell.tsx
                               │
Layer 1: Layout/State       AppShell (17 imports, 808行)
                            ├── components: WelcomeScreen, SidebarPanel, EditorPanel,
                            │                ConfirmDialog, QuickOpenDialog,
                            │                CommandPaletteDialog, SettingsPanel
                            └── services: file, recent_files, recent_workspaces,
                                          settings, export, print, logger
                               │
Layer 2: Editor Panel        EditorPanel.tsx (1060行)
                            ├── TyporaEditorPanel.tsx (611行) ← 写作模式
                            ├── MarkdownPreview.tsx (211行)   ← 预览
                            ├── FindReplaceBar.tsx            ← 查找替换
                            ├── edit_commands.ts (344行)      ← 源码模式命令
                            └── image_asset_workflow.ts       ← 图片
                               │
Layer 3: Editor Logic       parse_outline, render_markdown, find_replace,
(Layer 3: 纯函数叶节点)    image_source_extractor, image_validation,
                            writing_find_plugin, edit_commands
                               │
Layer 4: Services           file_service, asset_service, path_service,
(Layer 4: 数据+存储叶节点) export_service, print_service, settings_service,
                            recent_files_service, logger, file_reader
```

---

## 4. 集线器文件（被 3+ 文件引用）

| 文件 | 被引用次数 | 风险 |
|------|:---:|------|
| `path_service.ts` | 4 | 低——纯函数，接口稳定 |
| `asset_service.ts` | 4 | 低——接口稳定 |
| `recent_files_service.ts` | 4 | 低——类型引用多 |
| `logger.ts` | 4 | 低——工具类 |
| `image_source_extractor.ts` | 3 | 低——纯函数 |
| `image_validation.ts` | 3 | 低——纯函数 |

---

## 5. 按职责聚类分析

| 职责域 | 文件数 | 总行数 | 问题 |
|--------|:---:|:---:|------|
| 工具栏 + 编辑器模式 | `EditorPanel.tsx` | 1060 | 模式切换、toolbar menu、heading select、font/size、图片、拖拽、find/replace 全部混在一文件 |
| CSS 样式 | `app.css` | ~2300 | 无模块化，一个文件承载全应用样式 |
| 全局状态编排 | `AppShell.tsx` | 808 | 文档+设置+快捷键+自动保存+workspace+导出+打印+最近文件 |
| 写作模式 | `TyporaEditorPanel.tsx` | 611 | Milkdown Crepe 初始化、图片 DOM patch、拖拽、查找、IME、MutationObserver |
| 纯函数工具集 | `edit_commands.ts` | 344 | 9 种命令混一文件，可拆为 inline/line/block 三组 |
| 图片资产 | 5 个文件 | ~380 | ✅ 结构良好 |
| 服务层 | 10 个文件 | ~900 | ✅ 结构良好 |
| 对话框 | 6 个文件 | ~330 | ✅ 结构良好 |

---

## 6. Principle.md 违例清单

| 原则 | 违例位置 | 说明 |
|------|----------|------|
| §4 单文件 >500 行必须拆 | `EditorPanel.tsx` (1060) | 三模式+工具栏+插入菜单+视图菜单+导出菜单+find/replace+图片+拖拽 |
| §4 单文件 >500 行必须拆 | `AppShell.tsx` (808) | 文档状态+设置+快捷键+自动保存+workspace+文件操作+导出+打印+最近文件 |
| §4 单文件 >500 行必须拆 | `TyporaEditorPanel.tsx` (611) | Crepe 生命周期+图片patch+拖拽+查找+IME+MutationObserver |
| §9.2 一个页面不能同时承担多职责 | `EditorPanel.tsx` | toolbar 渲染、viewMode 状态、heading 状态、insert/view/export 菜单状态、find/replace、图片插入、drag/drop |
| §9.2 一个页面不能同时承担多职责 | `AppShell.tsx` | 文档状态、设置状态、自动保存、workspace、文件操作、导出/打印、快捷键、确认对话框 |

---

## 7. 叶节点文件（零 src/ 依赖，纯函数/纯外部依赖）

| 文件 | 类型 |
|------|------|
| `app/document_state.ts` | 纯 TypeScript 类型/工具 |
| `editor/markdown/edit_commands.ts` | 纯函数 |
| `editor/markdown/find_replace.ts` | 纯函数 |
| `editor/markdown/parse_outline.ts` | 纯函数 |
| `editor/markdown/image_source_extractor.ts` | 纯函数 + markdown-it |
| `editor/image/image_validation.ts` | 纯函数 |
| `services/path_service.ts` | 纯函数 |
| `services/file_service.ts` | Tauri 封装 |
| `services/recent_files_service.ts` | localStorage 封装 |
| `services/recent_workspaces_service.ts` | localStorage 封装 |
| `services/settings_service.ts` | localStorage 封装 + logger |
| `services/file_reader.ts` | Browser File API |
| `services/logger.ts` | console + localStorage |
| `components/common/AppDialog.tsx` | React |
| `components/dialogs/CommandPaletteDialog.tsx` | React |
| `components/dialogs/ConfirmDialog.tsx` | React |
| `components/editor/FindReplaceBar.tsx` | React |
| `editor/markdown/mermaid_renderer.ts` | mermaid |

---

## 8. 重构优先级建议

| 优先级 | 目标 | 拆分方向 | 预计影响文件 |
|:---:|------|----------|:---:|
| **P0** | `EditorPanel.tsx` | 拆出 `EditorToolbar.tsx`（toolbar 渲染+菜单状态）、`useViewMode.ts`（viewMode 状态+dispatch） | 2 新增, 1 修改 |
| **P0** | `AppShell.tsx` | 拆出 `useAutoSave.ts`、`useKeyboardShortcuts.ts`、`useSettings.ts` | 3 新增, 1 修改 |
| **P1** | `TyporaEditorPanel.tsx` | 拆出 `useCrepeEditor.ts`（生命周期）、`useImagePatch.ts`（DOM patch+observer） | 2 新增, 1 修改 |
| **P1** | `app.css` | 拆为 `variables.css` + `toolbar.css` + `editor.css` + `preview.css` + `components.css` | 4 新增, 0 逻辑修改 |
| **P2** | `edit_commands.ts` | 拆为 `inline_commands.ts` + `line_commands.ts` + `block_commands.ts` | 3 新增, 1 修改 |
| **P2** | `file_commands.rs` (Rust) | 拆 `services/file_service.rs` + `commands/file_commands.rs` | 2 新增, 1 修改 |

---

## 9. 安全操作矩阵

| 操作 | 风险 | 说明 |
|------|:---:|------|
| 拆分 `app.css` 为多个 CSS 文件 | 🟢 | 纯 CSS 拆分，不改选择器，不改构建 |
| 从 `edit_commands.ts` 拆出纯函数 | 🟢 | 纯函数模块，只改 import 路径 |
| 从 `AppShell.tsx` 拆出 custom hooks | 🟡 | 需重构 state 传递，hooks 模式成熟 |
| 从 `EditorPanel.tsx` 拆工具栏组件 | 🟡 | 需传递 props/callbacks，JSX 拆分简单 |
| 从 `TyporaEditorPanel.tsx` 拆 lifecycle hooks | 🟡 | Crepe 生命周期耦合紧，需谨慎 |

---

## 10. 依赖深度

最深依赖链（6 层）：

```
main.tsx → App.tsx → AppShell.tsx → EditorPanel.tsx → TyporaEditorPanel.tsx
  → normalize_markdown_images.ts → image_source_extractor.ts

main.tsx → App.tsx → AppShell.tsx → EditorPanel.tsx → MarkdownPreview.tsx
  → render_markdown.ts → path_service.ts

main.tsx → App.tsx → AppShell.tsx → SidebarPanel.tsx → FileTreePanel.tsx
  → FileOperationDialog.tsx → AppDialog.tsx
```
