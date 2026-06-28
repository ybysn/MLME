# Laurel 工作日志 — 2025-06-29

## 概述

将搁置的 MLME 项目（Tauri 2 + React 19 + Milkdown Markdown 编辑器）从原型状态打磨至可发布的开源项目，并重命名为 Laurel。

**历时：** 1 天  
**提交：** 20+ commits  
**分支：** master → https://github.com/ybysn/Laurel

---

## 第一阶段：Milkdown 集成与 UI 重构

| 改动 | 说明 |
|------|------|
| Milkdown Crepe 完整集成 | 三种视图模式（写作/分屏/源码），Ctrl+S/O/N 全局快捷键 |
| 分屏模式 | 左侧改用 Milkdown，右侧预览，不再用 textarea |
| UI 设计系统 | Notion 暖色调 + Vercel 阴影 + Linear 深色亮度堆叠，纯 CSS 变量 |
| 深色模式 | Milkdown Crepe 深色主题覆盖、select 下拉 color-scheme |
| 标题预处理 | `#标题` 无空格自动补空格，兼容 CommonMark 之外写法 |
| Gemini 反馈优化 | 去重复标题、对比度、占位符、工具栏 emoji 图标 |

## 第二阶段：ChatGPT 四轮审查修复

| 轮次 | 修复项 |
|------|--------|
| R1 | pnpm 统一、PDF 跨平台、asset scope 收窄、注释清理 |
| R2 | LICENSE (MIT)、Cargo.toml 元信息、README 前置环境、bundle target `all` |
| R3 | CI workflow + pnpm build、Release 构建前检查、Rust 路径安全校验 |
| R4 | CI 文件重命名 test→ci、Release 三平台 cargo check、工作区路径沙箱 |

## 第三阶段：发布 CI 调试

| 问题 | 修复 |
|------|------|
| CI pnpm 报 `packages field missing` | 删除无效的 `pnpm-workspace.yaml` |
| CI pnpm 版本不兼容 | `version: 9` → 锁死 `9.15.4` |
| TypeScript 编译错误 | `useFindReplace.ts` 重复 else if、`FileTreePanel.tsx` 未使用 isDirty |
| Release 权限不足 | 添加 `permissions: contents: write` |
| Release 名称残留 | `MLME v__VERSION__` → `Laurel v__VERSION__` |

## 第四阶段：品牌升级

| 改动 | 说明 |
|------|------|
| 项目改名 | MLME → Laurel（月桂，写作的古典象征） |
| README 重写 | 英文版 + 中文版，Why/Highlights/Status/Roadmap/Keywords |
| GitHub 元信息 | description、topics（markdown-editor tauri rust react wysiwyg） |
| package.json | name: laurel |
| Cargo.toml | name/repository/description 全更新 |
| tauri.conf.json | productName/identifier/window title |

## 第五阶段：仓库清理

| 操作 | 文件 |
|------|------|
| 删除 | `pnpm-workspace.yaml`（非 monorepo 无意义） |
| 删除 | `package-lock.json`（npm 残留，项目用 pnpm） |
| 清理 | `.gitignore` 乱码文件名规则 |

## 最终状态

| 维度 | 评分 |
|------|------|
| 发布完整度 | 9/10 |
| 安全边界 | 8/10 |
| 测试覆盖 | 10 文件 126 测试全通过 |
| CI/CD | push/PR 自动检查，tag 触发三平台构建 |
| 许可证 | MIT |
| 语言 | README.md (EN) + README_zh.md (中文) |

## Tags

`v0.1.0` — 首个发布版（需重建 tag 触发干净的 release）

## 待办

- [ ] 重新打 tag 触发 release（上次被旧手工文件污染）
- [ ] GitHub repo description 改成中英双语
- [ ] 图标替换为 Laurel 品牌图标
