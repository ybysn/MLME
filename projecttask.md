# Markdown Editor 开发工作总结

## 项目概况

**项目名称**: Shadow Markdown Editor
**技术栈**: Tauri 2 + React + TypeScript + Milkdown Crepe + markdown-it
**当前版本**: V0.x MVP

---

## 已完成功能总览

### 一、编辑器核心

| 功能 | 状态 | 说明 |
|------|------|------|
| 写作模式 (WYSIWYG) | ✓ | 基于 Milkdown Crepe，默认打开模式 |
| 源码模式 | ✓ | 原生 textarea，Markdown 工具栏 |
| 分屏模式 | ✓ | 左侧源码 + 右侧预览 |
| 模式切换 | ✓ | 工具栏视图下拉（写作/源码/分屏） |
| 默认打开模式设置 | ✓ | 持久化到 localStorage |

### 二、文件管理

| 功能 | 状态 | 说明 |
|------|------|------|
| 打开/新建/保存/另存为 | ✓ | 临时文件+替换策略 |
| 最近文件 | ✓ | localStorage 持久化，最多 10 条 |
| 工作区文件树 | ✓ | Rust 递归扫描，过滤 .assets/node_modules 等 |
| 最近工作区 | ✓ | localStorage 持久化，最多 5 个 |
| 右键菜单 | ✓ | 自定义弹窗，非 window.prompt |
| 新建文件/文件夹 | ✓ | Rust create_markdown_file / create_folder |
| 重命名 | ✓ | Rust rename_path，同步 currentPath 和最近文件 |
| 删除 | ✓ | Rust delete_path，删除当前文件走未保存保护 |
| 刷新工作区 | ✓ | 右键菜单 + 操作后自动刷新 |

### 三、图片资产管理

| 功能 | 状态 | 说明 |
|------|------|------|
| 图片拖拽插入 | ✓ | 复制到 .assets 目录，相对路径 |
| 图片粘贴 (Ctrl+V) | ✓ | 剪贴板图片走统一 saveImageAsset |
| 图片按钮选择 | ✓ | 隐藏 input[type=file]，MIME+扩展名双重校验 |
| 中文路径图片预览 | ✓ | data URL 方案（readImageAssetAsDataUrl Rust command） |
| 写作模式图片显示 | ✓ | hydrateImages 预处理：相对路径→data URL；输出时 data URL→相对路径 |
| 支持格式 | ✓ | png/jpg/jpeg/gif/webp/svg/bmp/ico/avif (9 种) |

### 四、查找替换

| 功能 | 状态 | 说明 |
|------|------|------|
| Ctrl+F 查找 | ✓ | 查找栏 + 匹配计数 |
| Ctrl+H 替换 | ✓ | 替换当前 + 全部替换 |
| 大小写开关 | ✓ | 默认不区分 |
| textarea 滚动 | ✓ | 计算行高自动滚动到匹配位置 |
| 预览高亮 | ✓ | TreeWalker + mark 元素 |
| 分屏同步 | ✓ | 源码和预览共享 activeMatchIndex |

### 五、导出与打印

| 功能 | 状态 | 说明 |
|------|------|------|
| 导出 HTML | ✓ | 完整 HTML 文档 + 内联 CSS + data URL 图片 |
| 导出 PDF | ✓ | Rust 调用 Edge/Chrome headless --print-to-pdf |
| 打印 | ✓ | 隐藏 iframe + window.print() |
| 入口组织 | ✓ | 导出 ▼ 下拉（HTML/PDF）+ 独立打印按钮 |

### 六、大纲

| 功能 | 状态 | 说明 |
|------|------|------|
| 标题解析 | ✓ | ATX 标题（#），忽略代码块 |
| 文本清洗 | ✓ | 去除 **bold** / `code` / [link] / ![img] 等语法 |
| 层级展示 | ✓ | H1-H6 不同字号/字重/缩进/颜色 |
| 点击跳转 | ✓ | 源码跳行号，写作模式 DOM 标题查找 |
| 实时更新 | ✓ | useMemo 依赖 content |

### 七、设置面板

| 设置项 | 默认值 |
|--------|--------|
| 自动保存 | 关 |
| 自动保存延迟 | 2000ms |
| 主题 | 浅色 |
| 编辑器字号 | 16 |
| 编辑器字体 | Consolas, Microsoft YaHei, monospace |
| 默认打开模式 | 写作模式 |
| 启动显示侧边栏 | 是 |

### 八、写作模式 (Milkdown Crepe)

| 功能 | 状态 | 说明 |
|------|------|------|
| Crepe 初始化 | ✓ | 仅 currentPath 变化时重建 |
| 中文 IME 输入 | ✓ | compositionstart/end 保护 + isComposing 跳过快捷键 |
| 图片 hydration | ✓ | 初始化前异步转 data URL，输出时映射回相对路径 |
| 自动聚焦 | ✓ | crepe.create() 后 requestAnimationFrame 聚焦 |
| 性能 | ✓ | 普通文档 < 1s 可编辑 |
| 数据安全 | ✓ | 保存时 Markdown 保持相对路径，不写入 data URL |

### 九、Tauri Commands (Rust)

**文件操作**:
- `read_markdown_file` / `write_markdown_file`
- `file_exists` / `list_markdown_files_in_folder`
- `write_html_file` / `export_html_to_pdf`
- `create_markdown_file` / `create_folder`
- `rename_path` / `delete_path`

**图片资产**:
- `save_image_asset` (复制到 .assets)
- `read_image_asset_as_data_url` (base64 data URL)

### 十、前端服务层

| 文件 | 职责 |
|------|------|
| `file_service.ts` | 文件读写/创建/重命名/删除/工作区扫描 |
| `asset_service.ts` | 图片保存和数据 URL 读取 |
| `export_service.ts` | HTML/PDF 导出 |
| `print_service.ts` | 打印（iframe + window.print） |
| `recent_files_service.ts` | 最近文件 localStorage CRUD |
| `recent_workspaces_service.ts` | 最近工作区 localStorage CRUD |
| `settings_service.ts` | 7 项设置持久化 |
| `logger.ts` | 分层日志系统 |
| `path_service.ts` | 跨平台路径工具 |

### 十一、UI 组件

| 组件 | 路径 |
|------|------|
| AppShell | `components/layout/AppShell.tsx` |
| SidebarPanel | `components/layout/SidebarPanel.tsx` |
| WelcomeScreen | `components/layout/WelcomeScreen.tsx` |
| EditorPanel | `components/editor/EditorPanel.tsx` |
| TyporaEditorPanel | `components/editor/TyporaEditorPanel.tsx` |
| MarkdownPreview | `components/editor/MarkdownPreview.tsx` |
| FindReplaceBar | `components/editor/FindReplaceBar.tsx` |
| FileTreePanel | `components/file_tree/FileTreePanel.tsx` |
| FileOperationDialog | `components/file_tree/FileOperationDialog.tsx` |
| OutlinePanel | `components/outline/OutlinePanel.tsx` |
| SettingsPanel | `components/settings/SettingsPanel.tsx` |
| ConfirmDialog | `components/dialogs/ConfirmDialog.tsx` |
| AppDialog | `components/common/AppDialog.tsx` |

### 十二、编辑器命令 (edit_commands.ts)

- toggleBold / toggleItalic / toggleInlineCode
- setHeadingLevel (0=段落, 1-6=H1-H6)
- toggleBlockquote / toggleUnorderedList / toggleOrderedList
- insertCodeBlock / insertLink / insertImage

### 十三、快捷键

| 快捷键 | 功能 |
|--------|------|
| Ctrl+B | 加粗 |
| Ctrl+I | 斜体 |
| Ctrl+E | 行内代码 |
| Ctrl+F | 查找 |
| Ctrl+H | 替换 |
| Ctrl+S | 保存 |
| Ctrl+O | 打开 |
| Ctrl+N | 新建 |
| Ctrl+\ | 切换侧边栏 |

---

## 下一步待完成

| 优先级 | 功能 |
|--------|------|
| 高 | 写作模式拖拽图片直接插入 |
| 高 | 写作模式粘贴图片直接插入 |
| 中 | 代码块语法高亮 (highlight.js) |
| 中 | KaTeX 数学公式渲染 |
| 中 | Mermaid 图表渲染 |
| 低 | 窗口关闭未保存确认 |
| 低 | 全屏模式 |
| 低 | 写作模式查找替换完善 |

---

## 测试样本目录

`tests/markdown_cases/` 包含:
- basic.md / list.md / table.md / code.md
- outline.md / preview.md / find_replace.md
- image_drop.md / export_html.md / print_pdf.md

---

## 技术债务 / 已知问题

1. Milkdown Crepe 产生的 blob URL 资源 404（第三方内部行为，不阻塞编辑）
2. 大文档（>1MB）写作模式初始化可能偏慢
3. 所有设置/最近文件使用 localStorage（未迁入 SQLite）
4. macOS/Linux 未测试（当前仅 Windows）
