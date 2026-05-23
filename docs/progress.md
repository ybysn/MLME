# MarkdownEditor 工作进度汇报

> 最后更新：2026-05-23

---

## ✅ 已完成

### 核心 MVP（10/10）

| # | 功能 | 状态 |
|---|------|:---:|
| 1 | 初始化 Tauri + React + TypeScript 项目 | ✅ |
| 2 | 接入 Milkdown 基础编辑器（Crepe WYSIWYG） | ✅ |
| 3 | 打开/保存/另存为（temp-file-then-rename 策略） | ✅ |
| 4 | dirty 状态 + 关闭未保存确认 | ✅ |
| 5 | 最近文件（localStorage 持久化） | ✅ |
| 6 | 图片拖拽/粘贴到 `.assets` 目录 | ✅ |
| 7 | 标题大纲（代码块感知的 ATX 标题提取） | ✅ |
| 8 | 主题切换（明亮/暗黑，CSS data-theme 驱动） | ✅ |
| 9 | HTML/PDF 导出 + 打印 | ✅ |
| 10 | 字数/行数/字符数统计 | ✅ |

### 编辑器增强

| 功能 | 说明 |
|------|------|
| 三种视图模式 | 写作模式（WYSIWYG）、源码模式、分屏模式 |
| 自动保存 | debounce 控制，仅对已有路径文件生效 |
| 专注模式 | Ctrl+Shift+F |
| 全屏模式 | F11 |
| 查找替换 | Ctrl+F / Ctrl+H，支持三种模式 |
| 写作模式查找高亮 | 基于 ProseMirror Decoration 插件，不直接操作 DOM |
| 代码块高亮 | highlight.js 精简为 core + 15 种常用语言 |
| Mermaid 图表 | 动态懒加载，支持 flowchart / sequence / class 等 |
| KaTeX 数学公式 | 行内 `$...$` 和块级 `$$...$$` |
| 表格编辑 | GFM 表格支持 |

### 文件管理

| 功能 | 说明 |
|------|------|
| 欢迎页 | 新建/打开/打开文件夹 + 最近文件 + 最近工作区 |
| 工作区文件树 | 递归扫描 `.md`/`.markdown`，右键新建/删除/重命名 |
| 最近文件管理 | 失效文件标记（stale），清理失效记录 |
| 文件不存在标记 | 打开失败时标记 stale，不被 Ctrl+P 显示 |

### 快捷操作

| 快捷键 | 功能 |
|--------|------|
| Ctrl+P | 快速打开（最近文件 + 工作区文件搜索） |
| Ctrl+Shift+P | 命令面板（新建/打开/保存/导出/模式切换/设置） |
| Ctrl+S | 保存 |
| Ctrl+Shift+S | 另存为 |
| Ctrl+N | 新建 |
| Ctrl+O | 打开 |
| Ctrl+F | 查找 |
| Ctrl+H | 替换 |
| Ctrl+Shift+F | 专注模式 |
| F11 | 全屏 |

### 构建优化

| 优化项 | 效果 |
|------|------|
| manualChunks 分包 | 6 个 vendor chunk（react / prosemirror / milkdown / markdown / mermaid / tauri） |
| Mermaid 动态导入 | 懒加载 2.8MB，首屏不加载 |
| highlight.js 精简 | 384 种语言 → 15 种常用，体积减少 ~1,200 KB |
| extractMarkdownImageSources 拆分 | 解除写作模式对完整渲染栈的隐藏依赖 |
| chunkSizeWarningLimit | 调整为 3000 KB |

### UI/UX

| 功能 | 说明 |
|------|------|
| 欢迎页响应式 | 小窗口支持滚动 + 按钮自动换行 |
| 设置面板 | 字体/字号/主题/自动保存 可配置 |
| 状态栏 | 保存状态 + 字数统计 |
| AppDialog 通用弹窗 | Enter/Esc 键盘支持 |

### 新增文件

| 文件 | 职责 |
|------|------|
| `src/editor/markdown/writing_find_plugin.ts` | ProseMirror Decoration 查找高亮插件 |
| `src/editor/markdown/image_source_extractor.ts` | Markdown 图片路径提取（仅依赖 markdown-it core） |
| `src/components/dialogs/QuickOpenDialog.tsx` | Ctrl+P 快速打开弹窗 |
| `src/components/dialogs/CommandPaletteDialog.tsx` | Ctrl+Shift+P 命令面板 |

---

## ❌ 未完成

### 测试（高优先级）

| 项目 | 说明 |
|------|------|
| Round-trip 测试 | 零自动化测试，测试样本存在于 `tests/markdown_cases/` 但无 runner |
| 单元测试 | `parse_outline` / `image_path` / `find_replace` 等未覆盖 |
| 集成测试 | 打开保存 / 图片拖拽 / 导出 未覆盖 |
| `pnpm test` 脚本 | `package.json` 未配置 |

### 存储与架构

| 项目 | 说明 |
|------|------|
| localStorage → SQLite | 仍用 localStorage 存储设置/最近文件/最近工作区 |
| Rust 分层 | `services/` / `models/` / `errors/` 模块未拆分，业务逻辑在 `commands/` 中 |
| `pnpm lint` / `pnpm typecheck` | `package.json` 未配置独立脚本（`build` 中的 `tsc` 覆盖类型检查） |

### 后置功能

| 功能 | 说明 |
|------|------|
| AI 功能（润色/翻译/总结） | P2 后置，AGENTS.md 明确 MVP 内不做 |
| macOS/Linux 测试 | 当前仅 Windows 验证 |
| PDF 跨平台 | 当前硬编码 Edge/Chrome Windows 路径 |

---

## ⚠️ 工程债

| 项目 | 严重程度 | 说明 |
|------|:---:|------|
| 零自动化测试 | 🔴 | 无任何 `.test.ts` / `#[cfg(test)]`，回归全靠手动 |
| Rust 层未分层 | 🟡 | 404 行 `file_commands.rs` 含全部业务逻辑 |
| localStorage 替代 SQLite | 🟡 | 架构文档已设计 SQLite 但未实施 |
| AppShell.tsx 过大 | 🟢 | ~770 行，应按职责拆分 |
| 无 lint / typecheck 脚本 | 🟢 | `build` 中 `tsc` 覆盖类型检查 |

---

## 📋 下一步建议

1. **优先**：搭建测试基础设施（`pnpm test` + 至少 1 个 round-trip 测试）
2. **其次**：Rust 分层重构（`services/` + `models/` + `errors/`）
3. **后置**：localStorage → SQLite 迁移
4. **低优先级**：AppShell 拆分、PDF 跨平台、macOS 验证
