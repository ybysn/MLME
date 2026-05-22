/// 模块职责：本地 Markdown 文件读写 command。
/// 输入：文件路径、Markdown 内容。
/// 输出：MarkdownFilePayload 或错误信息。
/// 风险点：文件不存在、编码错误、权限不足必须返回可展示错误；严禁 panic。

use serde::Serialize;
use std::fs;
use std::path::Path;

/// 读取 Markdown 文件后返回的负载结构。
#[derive(Serialize, Clone)]
pub struct MarkdownFilePayload {
    pub path: String,
    pub file_name: String,
    pub content: String,
}

/// 校验文件扩展名，仅允许 .md 和 .markdown。
fn validate_markdown_extension(path: &Path) -> Result<(), String> {
    match path.extension().and_then(|e| e.to_str()) {
        Some("md") | Some("markdown") => Ok(()),
        Some(ext) => Err(format!(
            "不支持的文件扩展名: .{}，仅支持 .md 和 .markdown",
            ext
        )),
        None => Err("文件没有扩展名，仅支持 .md 和 .markdown 文件".to_string()),
    }
}

/// 读取本地 Markdown 文件并返回其路径、文件名和 UTF-8 内容。
/// 只允许读取 .md 或 .markdown 文件，非 UTF-8 编码会返回错误。
#[tauri::command]
pub fn read_markdown_file(path: String) -> Result<MarkdownFilePayload, String> {
    let path_buf = Path::new(&path);

    // 校验扩展名
    validate_markdown_extension(path_buf)?;

    // 检查文件是否存在
    if !path_buf.exists() {
        return Err(format!("文件不存在: {}", path));
    }

    // 读取文件字节
    let bytes = fs::read(path_buf).map_err(|e| format!("读取文件失败: {}", e))?;

    // 校验 UTF-8 编码
    let content = String::from_utf8(bytes).map_err(|e| {
        format!(
            "文件编码不是 UTF-8，无法打开。错误位置: byte {}",
            e.utf8_error().valid_up_to()
        )
    })?;

    let file_name = path_buf
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();

    Ok(MarkdownFilePayload {
        path,
        file_name,
        content,
    })
}

/// 将 Markdown 内容写入指定路径的 .md 文件。
/// 采用先写临时文件再替换的策略，防止写入中断导致原文件损坏。
#[tauri::command]
pub fn write_markdown_file(path: String, content: String) -> Result<(), String> {
    let path_buf = Path::new(&path);

    // 校验扩展名
    validate_markdown_extension(path_buf)?;

    // 确保父目录存在
    if let Some(parent) = path_buf.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| format!("创建目录失败: {}", e))?;
        }
    }

    // 写入临时文件
    let tmp_path = path_buf.with_extension("md.tmp");
    fs::write(&tmp_path, content.as_bytes())
        .map_err(|e| format!("写入临时文件失败: {}", e))?;

    // 替换原文件
    fs::rename(&tmp_path, path_buf).map_err(|e| format!("保存文件失败: {}", e))?;

    Ok(())
}

/// 检查指定路径的文件是否存在（用于调试 convertFileSrc 前的路径）。
#[tauri::command]
pub fn file_exists(path: String) -> Result<bool, String> {
    let path_buf = Path::new(&path);
    Ok(path_buf.exists())
}

/// 工作区文件树节点。
#[derive(Serialize, Clone)]
pub struct MarkdownTreeItem {
    /// 文件或目录的绝对路径
    pub path: String,
    /// 文件或目录名
    pub file_name: String,
    /// 相对于工作区根目录的路径
    pub relative_path: String,
    /// 是否为目录
    pub is_dir: bool,
    /// 子节点（仅目录有值）
    pub children: Option<Vec<MarkdownTreeItem>>,
}

/// 需要忽略的目录名（精确匹配）。
const IGNORED_DIRS: &[&str] = &[
    "node_modules", ".git", "target", "dist", "build", ".next", "out",
];

/// 需要忽略的目录后缀。
fn is_ignored_dir(name: &str) -> bool {
    IGNORED_DIRS.contains(&name) || name.ends_with(".assets")
}

/// 递归扫描目录，收集 Markdown 文件和子目录。
fn scan_dir(dir: &Path, base_dir: &Path, depth: u32) -> Vec<MarkdownTreeItem> {
    let mut items: Vec<MarkdownTreeItem> = Vec::new();

    if depth > 5 {
        return items;
    }

    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return items,
    };

    let mut dirs: Vec<MarkdownTreeItem> = Vec::new();
    let mut files: Vec<MarkdownTreeItem> = Vec::new();

    for entry in entries.flatten() {
        let path = entry.path();
        let name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_string();

        if path.is_dir() {
            if is_ignored_dir(&name) {
                continue;
            }
            let children = scan_dir(&path, base_dir, depth + 1);
            // 空目录不显示
            if children.is_empty() {
                continue;
            }
            let relative_path = path
                .strip_prefix(base_dir)
                .unwrap_or(&path)
                .to_string_lossy()
                .to_string();
            dirs.push(MarkdownTreeItem {
                path: path.to_string_lossy().to_string(),
                file_name: name,
                relative_path,
                is_dir: true,
                children: Some(children),
            });
        } else {
            // 仅收集 .md / .markdown 文件
            let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
            if ext != "md" && ext != "markdown" {
                continue;
            }
            let relative_path = path
                .strip_prefix(base_dir)
                .unwrap_or(&path)
                .to_string_lossy()
                .to_string();
            files.push(MarkdownTreeItem {
                path: path.to_string_lossy().to_string(),
                file_name: name,
                relative_path,
                is_dir: false,
                children: None,
            });
        }
    }

    // 目录在前，文件在后，各自按名称排序
    dirs.sort_by(|a, b| a.file_name.to_lowercase().cmp(&b.file_name.to_lowercase()));
    files.sort_by(|a, b| a.file_name.to_lowercase().cmp(&b.file_name.to_lowercase()));

    items.extend(dirs);
    items.extend(files);
    items
}

/// 扫描文件夹并返回 Markdown 文件树。
/// 仅包含 .md/.markdown 文件和包含它们的目录。
/// 忽略 node_modules、.git、target、dist、build、.next、out、
/// 以及所有 .assets 目录。空目录不显示。最大深度 5 层。
#[tauri::command]
pub fn list_markdown_files_in_folder(
    folder_path: String,
) -> Result<Vec<MarkdownTreeItem>, String> {
    let path_buf = Path::new(&folder_path);

    if !path_buf.exists() {
        return Err(format!("文件夹不存在: {}", folder_path));
    }

    if !path_buf.is_dir() {
        return Err(format!("路径不是文件夹: {}", folder_path));
    }

    Ok(scan_dir(path_buf, path_buf, 0))
}
