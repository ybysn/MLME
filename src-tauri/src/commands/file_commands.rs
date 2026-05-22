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
