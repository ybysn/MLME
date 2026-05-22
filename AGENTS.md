# AGENTS.md

# MarkdownEditor AI 开发代理规则

本文件用于约束 OpenCode、DeepSeek V4 Pro 以及其他 AI 编程代理在本项目中的开发行为。

任何 AI 代理修改本项目代码前，必须先读取并遵守本文件。

---

## 0. 项目基本信息

| 字段 | 内容 |
|---|---|
| 项目名称 | MarkdownEditor |
| 产品目标 | 本地优先、稳定、类 Typora 的 Markdown 桌面编辑器 |
| 技术栈 | Tauri 2 + React + TypeScript + Milkdown/ProseMirror |
| 存储原则 | Markdown 正文存 `.md` 文件；SQLite 只存元数据 |
| 编辑器原则 | 不自研完整 contenteditable 编辑器内核 |
| 当前阶段 | MVP：本地文件闭环 + Markdown 编辑 + 图片资产 + 大纲 + 导出 |

---

## 1. 最高优先级规则

1. 不允许为了快速实现功能而破坏 Markdown 文件读写闭环。
2. 不允许把 Markdown 正文长期存入 SQLite 作为唯一来源。
3. 不允许绕过 Tauri command 直接在前端访问本地文件系统。
4. 不允许绕过 Milkdown/ProseMirror transaction 直接操作编辑器 DOM。
5. 不允许一次性大规模重构无关模块。
6. 不允许改动与当前任务无关的文件。
7. 不允许删除已有测试，除非明确说明原因并补充替代测试。
8. 不允许静默吞掉文件读写、导出、图片复制错误。
9. 不允许引入云同步、账户系统、协作编辑等超出 MVP 的功能。
10. 不允许在没有测试样本的情况下扩展复杂 Markdown 语法。

---

## 2. AI 工作流程

每次执行开发任务时，必须遵循以下流程：

```text
1. 先阅读相关文档：PRD.md / architecture.md / markdown_spec.md / AGENTS.md
2. 明确本次任务影响的模块和文件
3. 检查现有代码是否已有相似逻辑
4. 优先在原有结构内局部修改
5. 修改后运行类型检查、lint、测试或至少说明未运行原因
6. 输出改动文件列表、改动原因、验证方式
```

---

## 3. 任务拆分原则

AI 代理不得接受“做一个完整 Typora”这种大任务并一次性生成大量代码。

必须拆成小任务：

| 合格任务 | 不合格任务 |
|---|---|
| 集成 Milkdown 基础编辑器 | 做完整 Markdown 编辑器 |
| 增加 Ctrl+S 保存 | 完善所有快捷键 |
| 实现图片拖拽复制到 assets | 做完整素材管理系统 |
| 实现大纲提取函数 | 做完整文档导航系统 |
| 增加 HTML 导出 | 做完整导出系统 |

---

## 4. 技术栈规则

### 4.1 前端

必须使用：

- React。
- TypeScript。
- Vite。
- Milkdown/ProseMirror。
- CSS variables 管理主题。

禁止：

- 用 jQuery。
- 用全局变量维护核心文档状态。
- 组件内直接调用 `window.__TAURI__.invoke`。
- 组件内写大量文件系统业务逻辑。

### 4.2 Tauri/Rust

Rust 层负责：

- 文件读取。
- 文件保存。
- 路径处理。
- 图片复制。
- 设置持久化。
- SQLite 元数据。
- 导出。
- 系统对话框。

Rust 层不得负责：

- React UI 状态。
- 编辑器内部节点操作。
- Markdown 富文本交互细节。

### 4.3 SQLite

SQLite 只能存：

- 最近文件。
- 应用设置。
- 工作区元数据。
- 导出历史。
- AI 操作记录摘要。

SQLite 不得作为 Markdown 正文的唯一存储源。

---

## 5. 推荐目录约束

新增文件优先放入以下目录：

```text
src/app/                  应用状态、快捷键、路由
src/components/           UI 组件
src/editor/               编辑器集成、Markdown 行为、插件
src/services/             前端服务封装
src/types/                TypeScript 类型
src/styles/               样式与主题
src-tauri/src/commands/   Tauri command
src-tauri/src/services/   Rust 业务服务
src-tauri/src/models/     Rust DTO/模型
src-tauri/src/storage/    SQLite/配置存储
tests/                    测试
```

新增文件必须符合职责边界。

---

## 6. 命名规范

### 6.1 文件命名

| 类型 | 规则 | 示例 |
|---|---|---|
| TypeScript 文件 | 小写下划线或小驼峰，保持项目一致 | `file_service.ts` |
| React 组件 | 大驼峰 | `EditorView.tsx` |
| Rust 文件 | 小写下划线 | `file_service.rs` |
| CSS 文件 | 小写下划线 | `editor_theme.css` |
| 测试文件 | 被测对象 + `.test.ts` | `parse_outline.test.ts` |

### 6.2 函数命名

| 类型 | 规则 | 示例 |
|---|---|---|
| 读取 | `load/read/get` | `loadAppSettings` |
| 保存 | `save/write` | `saveMarkdownFile` |
| 解析 | `parse` | `parseOutline` |
| 转换 | `to/from/serialize` | `serializeMarkdown` |
| 校验 | `validate` | `validateImagePath` |
| 导入 | `import` | `importImageAsset` |

---

## 7. 注释规范

核心文件顶部必须有中文说明：

```ts
/**
 * 模块职责：封装 Markdown 文件的打开、保存、另存为等前端调用。
 * 输入：文件路径、Markdown 文本、保存选项。
 * 输出：标准化后的文件操作结果。
 * 风险点：不得在组件层直接调用 Tauri command；保存失败必须抛出可见错误。
 */
```

核心函数必须说明：

```ts
/**
 * 解析 Markdown 标题并生成右侧大纲。
 * @param markdown 当前文档 Markdown 文本
 * @returns 按标题层级组织的大纲节点
 * 风险点：代码块中的 # 不应被识别为标题。
 */
```

---

## 8. 文件读写规则

### 8.1 读取

读取文件必须：

1. 检查文件是否存在。
2. 检查扩展名是否合理。
3. 使用 UTF-8 读取。
4. 编码错误必须返回 `INVALID_ENCODING`。
5. 读取失败必须返回可展示错误。

### 8.2 保存

保存文件必须：

1. 写入临时文件。
2. 写入成功后替换目标文件。
3. 保存失败不得清除 dirty 状态。
4. 另存为覆盖已有文件前必须确认。
5. 保存成功后更新 recent_files。

### 8.3 自动保存

自动保存规则：

1. 只对已有路径文件生效。
2. 未保存的新文档不得自动创建随机文件。
3. 自动保存必须 debounce。
4. 正在保存时不得并发保存。
5. 保存失败必须保留错误状态。

---

## 9. Markdown 编辑规则

AI 修改编辑器相关代码时必须遵守：

1. 编辑器内容变化必须通过 Milkdown/ProseMirror 状态机制处理。
2. 插入图片、链接、表格等必须通过编辑器 transaction。
3. 不得直接 `document.querySelector(...).innerHTML = ...` 修改正文。
4. 不得维护两份互相独立的 Markdown 正文状态。
5. 序列化 Markdown 后必须能再次加载。
6. 新增复杂语法时必须增加 markdown_cases 测试样本。

---

## 10. 图片资产规则

图片导入必须符合：

```text
当前文件：/notes/demo.md
图片目录：/notes/demo.assets/
插入路径：./demo.assets/image-时间戳-hash.png
```

规则：

1. 图片必须复制到 `.assets` 目录。
2. 插入 Markdown 时使用相对路径。
3. 当前文档未保存时，不允许导入本地图片，必须提示先保存。
4. 文件重名必须自动处理。
5. 支持 png/jpg/jpeg/gif/webp/svg。
6. SVG 需要考虑安全风险，不得执行脚本。

---

## 11. 错误处理规则

### 11.1 前端错误结构

```ts
export interface AppErrorDto {
  code: string;
  message: string;
  detail?: string;
  recoverable: boolean;
}
```

### 11.2 错误展示

| 错误 | 行为 |
|---|---|
| 文件不存在 | 弹出提示，并从最近文件标记失效 |
| 保存失败 | 状态栏显示错误，dirty 状态保留 |
| 图片导入失败 | 显示错误，不插入坏路径 |
| 导出失败 | 显示失败原因和目标路径 |
| 设置读取失败 | 使用默认设置并提示 |

禁止：

- `catch` 后只 `console.error`。
- 失败后仍显示成功。
- 失败后清除用户未保存内容。

---

## 12. UI 规则

1. 主界面保持简洁，不堆功能。
2. 高级功能放到设置或折叠面板。
3. 编辑区优先保证阅读和输入体验。
4. 状态栏必须显示保存状态。
5. 危险操作必须确认。
6. 错误提示必须具体，不使用“操作失败”这种空泛文案。

推荐布局：

```text
顶部菜单
左侧文件树 / 最近文件
中间编辑器
右侧大纲 / 属性
底部状态栏
```

---

## 13. AI 功能规则

AI 功能必须后置且隔离。

允许功能：

- 选中文本润色。
- 选中文本翻译。
- 选中文本总结。
- 根据当前标题生成大纲建议。

禁止功能：

- 默认读取整个工作区。
- 未经确认自动改写全文。
- 把 AI 结果直接覆盖用户内容。
- AI 请求失败影响本地编辑和保存。

AI 替换文本必须流程：

```text
用户选择文本
→ 选择 AI 操作
→ 生成结果
→ 结果预览
→ 用户确认
→ 使用 editor transaction 替换
```

---

## 14. 测试要求

### 14.1 必跑检查

每次修改后优先运行：

```bash
pnpm typecheck
pnpm lint
pnpm test
cargo test
```

如果项目暂未配置对应命令，必须说明：

```text
未运行原因：项目当前尚未配置 pnpm test。
```

不得谎称已运行。

### 14.2 Markdown 测试

新增或修改 Markdown 解析/序列化逻辑时，必须补充：

```text
tests/markdown_cases/*.md
```

并覆盖：

- 标题。
- 列表。
- 表格。
- 代码块。
- 图片。
- 数学公式。
- 边界字符。

### 14.3 文件系统测试

修改 Rust 文件服务时，必须测试：

- 文件不存在。
- 权限不足。
- 路径包含中文。
- 路径包含空格。
- 保存覆盖。
- 临时文件写入失败。

---

## 15. Git / 补丁规则

AI 输出改动时必须列出：

```text
改动文件：
- src/services/file_service.ts
- src-tauri/src/commands/file_commands.rs

改动原因：
- 增加保存 Markdown 文件的前端封装和 Tauri command。

验证方式：
- pnpm typecheck
- cargo test
```

除非用户明确要求，否则不要输出全量项目。

---

## 16. 禁止引入的依赖

未经明确确认，不得引入：

| 依赖类型 | 原因 |
|---|---|
| 大型 UI 框架 | 会限制编辑器自定义体验 |
| Electron | 当前架构选择 Tauri，不要混用 |
| 云存储 SDK | 超出本地优先范围 |
| 账户系统 SDK | 第一阶段不做账户 |
| 重型数据库 | SQLite 足够 |
| 自研 Markdown parser | 应使用成熟 parser |

---

## 17. 性能规则

1. 大纲解析必须 debounce。
2. 自动保存必须 debounce。
3. 不得每次输入都全量写文件。
4. 不得在 React render 中做 Markdown 全量解析。
5. 大文件打开需要显示加载状态。
6. 图片复制和导出必须异步执行。

---

## 18. 安全规则

1. 默认不上传用户文档。
2. AI 功能必须明确发送范围。
3. HTML 渲染不得执行危险脚本。
4. SVG 处理需要安全限制。
5. 文件路径必须来自用户选择或应用配置。
6. 不得扫描用户整个磁盘。

---

## 19. 当前 MVP 开发顺序

AI 代理应优先按以下顺序开发：

```text
1. 初始化 Tauri + React + TypeScript 项目
2. 接入 Milkdown 基础编辑器
3. 实现打开/保存/另存为
4. 实现 dirty 状态和关闭确认
5. 实现最近文件
6. 实现图片拖拽到 .assets
7. 实现大纲
8. 实现主题切换
9. 实现 HTML 导出
10. 补充 round-trip 测试
```

不得跳过文件闭环直接做 AI、云同步、插件市场。

---

## 20. 回答用户时的格式要求

当 AI 向用户汇报开发结果时，使用以下格式：

```md
## 结论
一句话说明是否完成。

## 改动文件
| 文件 | 改动 |
|---|---|

## 核心逻辑
说明关键实现。

## 验证方式
列出已运行命令和结果。

## 风险/未完成
明确说明风险，不得隐瞒。
```

---

## 21. 最终原则

本项目第一阶段的核心不是功能数量，而是工程闭环：

```text
打开本地 Markdown
→ 稳定编辑
→ 正确保存
→ 图片路径不乱
→ 再次打开不损坏
```

任何偏离这个闭环的功能，都必须后置。
