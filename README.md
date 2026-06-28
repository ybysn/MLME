# MLME - Markdown Local Multi-platform Editor

一个基于 Tauri 2 + React 19 + Milkdown 的本地 Markdown 编辑器，支持所见即所得（WYSIWYG）编辑、分屏预览、源码编辑三种模式。

## 技术栈

- **前端**: React 19 + TypeScript + Vite
- **编辑器**: Milkdown Crepe（WYSIWYG 所见即所得）
- **桌面框架**: Tauri 2 (Rust 后端)
- **渲染**: markdown-it + highlight.js + KaTeX（数学公式）+ Mermaid（图表）

## 前置环境

- **Node.js** >= 18（推荐 22 LTS）
- **pnpm** >= 9
- **Rust** (通过 [rustup](https://rustup.rs) 安装)
- **系统依赖**：
  - **Windows**: 无需额外依赖
  - **macOS**: Xcode Command Line Tools (`xcode-select --install`)
  - **Linux**: `sudo apt install libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf`

## 功能

- 三种编辑视图：写作模式（WYSIWYG）/ 源码模式 / 分屏
- Markdown 语法高亮、数学公式（KaTeX）、Mermaid 图表
- 文件管理：新建/打开/保存，工作区（文件夹级别管理）
- 自动保存（可配置延迟）
- 图片插入（拖拽/粘贴/文件选择，自动管理 assets 目录）
- 查找替换（支持大小写敏感）
- 大纲导航
- 导出 HTML / PDF / 打印
- 专注模式 / 全屏
- 命令面板 (Ctrl+Shift+P) / 快速打开 (Ctrl+P)
- 亮/暗主题切换
- 可配置字体、字号

## 开发

```bash
# 安装依赖（需要 pnpm）
pnpm install

# 启动前端开发服务器
pnpm dev

# 构建前端
pnpm build

# 启动 Tauri 桌面应用
pnpm tauri dev

# 构建 Tauri 安装包
pnpm tauri build
```

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| Ctrl+S | 保存 |
| Ctrl+O | 打开文件 |
| Ctrl+N | 新建文档 |
| Ctrl+F | 查找 |
| Ctrl+H | 替换 |
| Ctrl+P | 快速打开 |
| Ctrl+Shift+P | 命令面板 |
| Ctrl+Alt+1 | 写作模式 |
| Ctrl+Alt+2 | 分屏 |
| Ctrl+Alt+3 | 源码视图 |
| Ctrl+Alt+F | 专注模式 |
| F11 | 全屏 |
| Ctrl+\ | 切换侧边栏 |
