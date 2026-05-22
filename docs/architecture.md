# architecture.md

# MarkdownEditor 技术架构设计

## 0. 架构结论

MarkdownEditor 推荐采用：

```text
Tauri 2 + React + TypeScript + Milkdown/ProseMirror + SQLite + 本地文件系统
```

架构原则：

1. 前端负责 UI、编辑器状态、交互体验。
2. Rust/Tauri 层负责文件系统、路径处理、系统对话框、导出能力和本地安全边界。
3. Markdown 内容以 `.md` 文件为唯一真实来源，不把正文长期存入 SQLite。
4. SQLite 只保存应用状态、最近文件、设置、缓存、导出记录等元数据。
5. 编辑器内核不自研，优先使用 Milkdown/ProseMirror。
6. AI 功能独立成模块，不得侵入核心保存链路。

---

## 1. 总体架构

```text
┌───────────────────────────────────────────────┐
│                    UI Layer                    │
│ React / TypeScript / CSS                       │
│ 页面、菜单、文件树、大纲、设置、状态栏          │
└──────────────────────┬────────────────────────┘
                       │
┌──────────────────────▼────────────────────────┐
│                 Editor Layer                   │
│ Milkdown / ProseMirror                         │
│ Markdown 编辑、文档模型、插件、序列化            │
└──────────────────────┬────────────────────────┘
                       │
┌──────────────────────▼────────────────────────┐
│               Frontend Service Layer           │
│ file_service / settings_service / export_service│
│ 对 Tauri command 进行类型安全封装               │
└──────────────────────┬────────────────────────┘
                       │ invoke
┌──────────────────────▼────────────────────────┐
│                 Tauri Command Layer            │
│ Rust commands                                  │
│ open/save/dialog/path/export/settings           │
└──────────────────────┬────────────────────────┘
                       │
┌──────────────────────▼────────────────────────┐
│                  Local System Layer            │
│ File System / SQLite / OS Dialog / Cache        │
└───────────────────────────────────────────────┘
```

---

## 2. 模块边界

### 2.1 前端模块

| 模块 | 职责 | 不允许做的事 |
|---|---|---|
| `src/app` | 应用初始化、路由、全局状态 | 不直接读写本地文件 |
| `src/components` | UI 组件 | 不写业务逻辑和文件系统逻辑 |
| `src/editor` | 编辑器集成、插件、Markdown 行为 | 不调用 Tauri 原始 command |
| `src/services` | 前端服务封装 | 不直接操作 DOM |
| `src/styles` | 全局样式、主题变量 | 不写业务状态 |
| `src/types` | 类型定义 | 不写执行逻辑 |

### 2.2 Rust/Tauri 模块

| 模块 | 职责 | 不允许做的事 |
|---|---|---|
| `commands` | 暴露给前端的 Tauri command | 不直接写复杂业务，调用 service |
| `services` | 文件、路径、设置、导出服务 | 不包含 UI 逻辑 |
| `models` | Rust 结构体和 DTO | 不写副作用逻辑 |
| `storage` | SQLite 和配置文件访问 | 不处理编辑器文档模型 |

---

## 3. 推荐目录结构

```text
markdown-editor/
  AGENTS.md
  package.json
  pnpm-lock.yaml
  tsconfig.json
  vite.config.ts
  docs/
    PRD.md
    architecture.md
    markdown_spec.md
  src/
    main.tsx
    App.tsx
    app/
      app_state.ts
      app_events.ts
      shortcuts.ts
      routes.tsx
    components/
      layout/
        AppShell.tsx
        Sidebar.tsx
        StatusBar.tsx
        TopMenu.tsx
      welcome/
        WelcomePage.tsx
        RecentFiles.tsx
      editor/
        EditorView.tsx
        EditorToolbar.tsx
      file_tree/
        FileTree.tsx
      outline/
        OutlinePanel.tsx
      settings/
        SettingsPage.tsx
      dialogs/
        ConfirmDialog.tsx
        ExportDialog.tsx
    editor/
      milkdown/
        create_editor.ts
        milkdown_config.ts
        milkdown_plugins.ts
        milkdown_theme.ts
      markdown/
        parse_outline.ts
        normalize_markdown.ts
        serialize_markdown.ts
        image_path.ts
        markdown_roundtrip.ts
      extensions/
        math_extension.ts
        mermaid_extension.ts
        table_extension.ts
    services/
      file_service.ts
      settings_service.ts
      recent_file_service.ts
      export_service.ts
      image_asset_service.ts
    types/
      document.ts
      file.ts
      settings.ts
      export.ts
    styles/
      globals.css
      variables.css
      editor.css
      themes.css
  src-tauri/
    Cargo.toml
    tauri.conf.json
    src/
      main.rs
      commands/
        mod.rs
        file_commands.rs
        settings_commands.rs
        export_commands.rs
        dialog_commands.rs
      services/
        mod.rs
        file_service.rs
        path_service.rs
        settings_service.rs
        export_service.rs
        asset_service.rs
      storage/
        mod.rs
        sqlite.rs
        app_config.rs
      models/
        mod.rs
        file_models.rs
        settings_models.rs
        export_models.rs
      errors/
        mod.rs
        app_error.rs
  tests/
    markdown_cases/
      basic.md
      list.md
      table.md
      code.md
      math.md
      image.md
      mixed.md
      edge_cases.md
    e2e/
      open_save.spec.ts
      image_drag.spec.ts
      export_html.spec.ts
```

---

## 4. 数据模型

### 4.1 当前文档状态

TypeScript：

```ts
export type DocumentStatus = 'empty' | 'clean' | 'dirty' | 'saving' | 'error';

export interface CurrentDocument {
  id: string;
  path: string | null;
  fileName: string;
  markdown: string;
  status: DocumentStatus;
  lastSavedAt: string | null;
  lastModifiedAt: string | null;
  encoding: 'utf-8';
}
```

### 4.2 最近文件

```ts
export interface RecentFile {
  path: string;
  fileName: string;
  lastOpenedAt: string;
  exists: boolean;
}
```

### 4.3 应用设置

```ts
export interface AppSettings {
  theme: 'system' | 'light' | 'dark';
  editorFontFamily: string;
  editorFontSize: number;
  autoSaveEnabled: boolean;
  autoSaveDelayMs: number;
  imageAssetMode: 'filename_assets';
  mathEnabled: boolean;
  mermaidEnabled: boolean;
  defaultExportFormat: 'html' | 'pdf';
}
```

---

## 5. SQLite 元数据设计

SQLite 不保存 Markdown 正文，只保存应用元数据。

### 5.1 `recent_files`

| 字段 | 类型 | 说明 |
|---|---|---|
| id | INTEGER PK | 主键 |
| path | TEXT UNIQUE | 文件绝对路径 |
| file_name | TEXT | 文件名 |
| last_opened_at | TEXT | 最近打开时间 |
| exists_cache | INTEGER | 最近一次检查是否存在 |

### 5.2 `app_settings`

| 字段 | 类型 | 说明 |
|---|---|---|
| key | TEXT PK | 设置键 |
| value_json | TEXT | JSON 值 |
| updated_at | TEXT | 更新时间 |

### 5.3 `export_history`

| 字段 | 类型 | 说明 |
|---|---|---|
| id | INTEGER PK | 主键 |
| source_path | TEXT | 源 Markdown 路径 |
| target_path | TEXT | 导出路径 |
| export_format | TEXT | html/pdf |
| created_at | TEXT | 导出时间 |

### 5.4 `ai_actions`

| 字段 | 类型 | 说明 |
|---|---|---|
| id | INTEGER PK | 主键 |
| document_path | TEXT | 文档路径 |
| action_type | TEXT | polish/summary/translate/rewrite |
| input_hash | TEXT | 输入摘要 hash |
| created_at | TEXT | 操作时间 |

---

## 6. Tauri Command 设计

### 6.1 文件相关

```rust
#[tauri::command]
async fn open_markdown_file(path: String) -> Result<OpenFileResponse, AppError>;

#[tauri::command]
async fn save_markdown_file(path: String, content: String) -> Result<SaveFileResponse, AppError>;

#[tauri::command]
async fn save_markdown_file_as(content: String) -> Result<SaveFileResponse, AppError>;

#[tauri::command]
async fn show_open_file_dialog() -> Result<Option<String>, AppError>;

#[tauri::command]
async fn show_save_file_dialog(default_name: Option<String>) -> Result<Option<String>, AppError>;
```

### 6.2 图片资产相关

```rust
#[tauri::command]
async fn import_image_asset(document_path: String, source_image_path: String) -> Result<ImageAssetResponse, AppError>;

#[tauri::command]
async fn import_clipboard_image(document_path: String, image_bytes: Vec<u8>, extension: String) -> Result<ImageAssetResponse, AppError>;
```

### 6.3 设置相关

```rust
#[tauri::command]
async fn load_app_settings() -> Result<AppSettings, AppError>;

#[tauri::command]
async fn save_app_settings(settings: AppSettings) -> Result<(), AppError>;
```

### 6.4 导出相关

```rust
#[tauri::command]
async fn export_html(request: ExportHtmlRequest) -> Result<ExportResponse, AppError>;

#[tauri::command]
async fn export_pdf(request: ExportPdfRequest) -> Result<ExportResponse, AppError>;
```

---

## 7. 文件保存策略

### 7.1 普通保存

保存流程：

```text
前端 Ctrl+S
→ 获取当前编辑器 Markdown
→ 调用 save_markdown_file
→ Rust 写入临时文件 .tmp
→ fsync 或确保写入完成
→ 替换原文件
→ 返回保存成功
→ 前端清除 dirty 状态
```

### 7.2 未保存文件

如果当前文档没有路径：

```text
Ctrl+S
→ show_save_file_dialog
→ 用户选择路径
→ save_markdown_file
→ 更新 currentDocument.path
→ 加入 recent_files
```

### 7.3 自动保存

自动保存只对已有路径文件生效。

规则：

| 条件 | 行为 |
|---|---|
| 当前文档无路径 | 不自动保存 |
| 当前文档 dirty | debounce 后保存 |
| 正在保存 | 跳过本次自动保存 |
| 保存失败 | 保留 dirty 状态并显示错误 |

---

## 8. 图片资产策略

### 8.1 默认目录规则

若当前文件为：

```text
/notes/project.md
```

图片目录为：

```text
/notes/project.assets/
```

插入 Markdown：

```md
![image-20260522-153000](./project.assets/image-20260522-153000.png)
```

### 8.2 命名规则

```text
image-{yyyyMMdd-HHmmss}-{short_hash}.{ext}
```

示例：

```text
image-20260522-153000-a91c2f.png
```

### 8.3 冲突处理

如果目标文件已存在：

```text
image-20260522-153000-a91c2f.png
image-20260522-153000-a91c2f-1.png
image-20260522-153000-a91c2f-2.png
```

---

## 9. 编辑器内核设计

### 9.1 内核选择

第一版使用 Milkdown/ProseMirror。

原因：

| 原因 | 说明 |
|---|---|
| 支持 Markdown 双向转换 | 适合类 Typora 编辑体验 |
| 插件生态成熟 | 表格、代码块、数学公式可扩展 |
| 避免自研光标系统 | 降低工程风险 |
| 可维护性更高 | 长期可以基于 ProseMirror 插件扩展 |

### 9.2 编辑器插件分层

```text
基础插件：paragraph / heading / list / blockquote / link / image
增强插件：table / code block / task list
渲染插件：math / mermaid / syntax highlight
业务插件：image drop / outline sync / autosave trigger
```

### 9.3 不允许的实现

1. 不允许直接操作编辑器内部 DOM 来修改内容。
2. 不允许通过字符串替换长期维护 Markdown 状态。
3. 不允许绕过编辑器 transaction 系统插入节点。
4. 不允许把源码编辑器和 WYSIWYG 编辑器并行维护两份正文状态。

---

## 10. 大纲设计

大纲来源：当前 Markdown 或编辑器文档模型中的 heading 节点。

字段：

```ts
export interface OutlineItem {
  id: string;
  level: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
  position: number;
  children: OutlineItem[];
}
```

刷新策略：

| 场景 | 策略 |
|---|---|
| 用户输入 | debounce 300ms |
| 打开文件 | 立即生成 |
| 保存文件 | 不强制刷新，除非内容变化 |

---

## 11. 导出设计

### 11.1 HTML 导出

流程：

```text
编辑器 Markdown
→ Markdown parser
→ HTML renderer
→ 注入主题 CSS
→ 处理图片路径
→ 写出 html
```

### 11.2 PDF 导出

第一阶段可选方案：

| 方案 | 优点 | 缺点 |
|---|---|---|
| WebView 打印 PDF | 与前端样式一致 | 平台差异 |
| headless Chromium | 效果较好 | 打包体积和依赖复杂 |
| Pandoc | 专业 | 需要外部依赖 |

第一版建议：先做 HTML 导出，再做 PDF。

---

## 12. AI 功能架构

AI 功能后置，但预留接口。

```text
Editor Selection
→ AI Panel
→ ai_service.ts
→ provider adapter
→ result preview
→ user confirm
→ editor transaction replace/insert
```

AI 规则：

1. AI 不能自动改写全文，必须用户确认。
2. AI 默认只处理用户选中的文本。
3. AI 请求前必须显示将发送的内容范围。
4. AI 功能失败不能影响本地保存。
5. AI 操作要记录 action，不记录完整敏感正文。

---

## 13. 错误处理

统一错误结构：

```ts
export interface AppErrorDto {
  code: string;
  message: string;
  detail?: string;
  recoverable: boolean;
}
```

错误码：

| code | 场景 |
|---|---|
| FILE_NOT_FOUND | 文件不存在 |
| FILE_READ_FAILED | 文件读取失败 |
| FILE_WRITE_FAILED | 文件写入失败 |
| INVALID_ENCODING | 编码不支持 |
| PERMISSION_DENIED | 权限不足 |
| IMAGE_IMPORT_FAILED | 图片导入失败 |
| EXPORT_FAILED | 导出失败 |
| SETTINGS_LOAD_FAILED | 设置读取失败 |

---

## 14. 测试策略

### 14.1 单元测试

| 测试对象 | 内容 |
|---|---|
| `parse_outline` | 标题提取正确 |
| `image_path` | 相对路径生成正确 |
| `normalize_markdown` | Markdown 清洗不破坏结构 |
| Rust `path_service` | 跨平台路径正确 |

### 14.2 集成测试

| 场景 | 验收 |
|---|---|
| 打开保存 | 内容不丢失 |
| 图片拖拽 | 图片复制并插入相对路径 |
| HTML 导出 | 图片和样式正常 |
| 设置持久化 | 重启后设置仍存在 |

### 14.3 Round-trip 测试

测试样本：

```text
basic.md
list.md
table.md
code.md
math.md
image.md
mixed.md
edge_cases.md
```

流程：

```text
load markdown
→ editor doc
→ serialize markdown
→ reload
→ compare AST
```

---

## 15. 工程约束

1. 所有文件系统操作必须经过 Tauri command。
2. 前端 service 层必须封装 command，不允许组件直接 `invoke`。
3. 编辑器核心操作必须通过 Milkdown/ProseMirror transaction。
4. Markdown 正文只以 `.md` 为真实来源。
5. SQLite 不存正文，只存元数据。
6. AI 功能不得阻塞编辑器主链路。
7. 每个核心模块必须有中文注释说明职责、输入、输出、风险点。
8. 修改必须尽量局部化，避免无关重构。

---

## 16. 架构结论

第一阶段架构应围绕一个核心闭环展开：

```text
本地文件 → 编辑器文档模型 → Markdown 序列化 → 本地文件
```

只要这个闭环不稳定，其他功能都不应优先开发。
