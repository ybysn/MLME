/// 模块职责：图片资产写入 command，负责将图片复制到 Markdown 文件同名 .assets 目录。
/// 输入：Markdown 文件路径、原始文件名、图片字节。
/// 输出：ImageAssetPayload（资源绝对路径、相对路径、文件名）。
/// 为什么图片要复制到 .assets：
///   Typora 等编辑器的标准行为是维护同名 .assets 目录来管理图片，
///   保证 Markdown 文件与其图片资产始终在同一父目录下，便于迁移和版本管理。
/// 为什么 Markdown 中使用相对路径而不是绝对路径：
///   相对路径保证 .md 文件和 .assets 目录整体移动到任意位置后，
///   图片引用仍然有效，不会因盘符或用户名变化而断裂。

use serde::Serialize;
use std::fs;
use std::io::{Read, Write};
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};
use base64::Engine;

/// 图片资产保存后返回的负载结构。
#[derive(Serialize, Clone)]
pub struct ImageAssetPayload {
    /// 图片资产的绝对路径
    pub asset_path: String,
    /// 相对于 Markdown 文件的路径，用于插入 Markdown 图片语法
    pub relative_path: String,
    /// 生成的安全文件名
    pub file_name: String,
}

/// 支持的图片扩展名列表。
/// 不支持 tif/tiff：WebView 预览兼容性不稳定。
const IMAGE_EXTENSIONS: &[&str] = &[
    "png", "jpg", "jpeg", "gif", "webp", "svg",
    "bmp", "ico", "avif",
];

/// 校验 Markdown 文件扩展名。
fn validate_md_extension(path: &Path) -> Result<(), String> {
    match path.extension().and_then(|e| e.to_str()) {
        Some("md") | Some("markdown") => Ok(()),
        Some(ext) => Err(format!("Markdown 文件扩展名不支持: .{}", ext)),
        None => Err("Markdown 文件没有扩展名".to_string()),
    }
}

/// 校验图片扩展名并返回规范化扩展名。
fn validate_image_extension(file_name: &str) -> Result<&str, String> {
    let path = Path::new(file_name);
    match path.extension().and_then(|e| e.to_str()) {
        Some(ext) if IMAGE_EXTENSIONS.contains(&ext.to_lowercase().as_str()) => {
            Ok(ext)
        }
        Some(ext) => Err(format!(
            "不支持的图片格式: .{}，仅支持 {}",
            ext,
            IMAGE_EXTENSIONS.join(", ")
        )),
        None => Err("图片文件没有扩展名".to_string()),
    }
}

/// 生成安全文件名：image-{timestamp_hex}-{random}.ext
fn generate_safe_filename(extension: &str) -> String {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();

    let ts_hex = format!("{:016x}", now.as_secs());
    let random_part = format!("{:04x}", now.subsec_nanos() % 65536);

    format!("image-{}-{}.{}", ts_hex, random_part, extension)
}

/// 确保文件名不冲突，若已存在则追加序号。
fn resolve_unique_path(dir: &Path, base_name: &str) -> std::path::PathBuf {
    let mut candidate = dir.join(base_name);
    if !candidate.exists() {
        return candidate;
    }

    let stem = Path::new(base_name)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("image");
    let ext = Path::new(base_name)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("png");

    let mut counter = 1u32;
    loop {
        let name = format!("{}-{}.{}", stem, counter, ext);
        candidate = dir.join(&name);
        if !candidate.exists() {
            break;
        }
        counter = counter.wrapping_add(1);
    }
    candidate
}

/// 保存图片资产到 Markdown 文件同名的 .assets 目录。
/// 返回包含绝对路径、相对路径、文件名的 ImageAssetPayload。
#[tauri::command]
pub fn save_image_asset(
    markdown_path: String,
    original_file_name: String,
    bytes: Vec<u8>,
) -> Result<ImageAssetPayload, String> {
    let md_path = Path::new(&markdown_path);

    // 校验 Markdown 文件扩展名
    validate_md_extension(md_path)?;

    // 校验图片扩展名
    let ext = validate_image_extension(&original_file_name)?;

    // 获取 Markdown 文件名（不含扩展名）用于生成 assets 目录名
    let md_stem = md_path
        .file_stem()
        .and_then(|s| s.to_str())
        .ok_or_else(|| "无法解析 Markdown 文件名".to_string())?;

    let md_parent = md_path
        .parent()
        .unwrap_or_else(|| Path::new("."));

    let assets_dir_name = format!("{}.assets", md_stem);
    let assets_dir = md_parent.join(&assets_dir_name);

    // 创建 .assets 目录
    fs::create_dir_all(&assets_dir)
        .map_err(|e| format!("创建 .assets 目录失败: {}", e))?;

    // 生成安全文件名并解决冲突
    let safe_name = generate_safe_filename(ext);
    let dest_path = resolve_unique_path(&assets_dir, &safe_name);
    let file_name = dest_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or(&safe_name)
        .to_string();

    // 写入图片文件
    {
        let mut file = fs::File::create(&dest_path)
            .map_err(|e| format!("创建图片文件失败: {}", e))?;
        file.write_all(&bytes)
            .map_err(|e| format!("写入图片数据失败: {}", e))?;
    }

    // 构建相对路径：[md_stem].assets/file_name
    let relative_path = format!("{}/{}", assets_dir_name, file_name);

    let asset_path = dest_path
        .to_str()
        .ok_or_else(|| "图片路径包含无效字符".to_string())?
        .to_string();

    // 调试输出：验证保存路径与预期是否一致
    println!(
        "[asset_commands] save_image_asset {{ \
         markdown_path: \"{}\", \
         md_parent: \"{}\", \
         asset_dir: \"{}\", \
         saved_path: \"{}\", \
         relative_path: \"{}\" \
         }}",
        markdown_path,
        md_parent.display(),
        assets_dir.display(),
        asset_path,
        relative_path,
    );

    Ok(ImageAssetPayload {
        asset_path,
        relative_path,
        file_name,
    })
}

/// 根据文件扩展名获取 MIME 类型。
fn extension_to_mime(ext: &str) -> &str {
    match ext.to_lowercase().as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        "bmp" => "image/bmp",
        "ico" => "image/x-icon",
        "avif" => "image/avif",
        _ => "application/octet-stream",
    }
}

/// 读取本地图片文件并返回 data URL（绕过 assetProtocol 中文路径问题）。
/// 适用于在 WebView 预览中直接渲染本地图片，不依赖 asset.localhost。
#[tauri::command]
pub fn read_image_asset_as_data_url(path: String) -> Result<String, String> {
    let path_buf = Path::new(&path);

    println!("[asset_commands] read_image_asset_as_data_url path={}", path);
    println!("[asset_commands] exists={}", path_buf.exists());

    // 校验文件存在
    if !path_buf.exists() {
        return Err(format!("图片文件不存在: {}", path));
    }

    // 校验扩展名
    let ext = match path_buf.extension().and_then(|e| e.to_str()) {
        Some(e) => {
            let lower = e.to_lowercase();
            println!("[asset_commands] ext={}", lower);
            if IMAGE_EXTENSIONS.contains(&lower.as_str()) {
                lower
            } else {
                return Err(format!("不支持的图片格式: .{}", e));
            }
        }
        None => return Err("文件没有扩展名".to_string()),
    };

    // 读取文件内容
    let mut file = fs::File::open(path_buf)
        .map_err(|e| format!("打开图片文件失败: {}", e))?;
    let mut bytes = Vec::new();
    file.read_to_end(&mut bytes)
        .map_err(|e| format!("读取图片数据失败: {}", e))?;

    println!("[asset_commands] bytes_len={}", bytes.len());

    // Base64 编码
    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    let mime = extension_to_mime(&ext);

    let data_url = format!("data:{};base64,{}", mime, b64);

    println!("[asset_commands] mime={}", mime);
    println!("[asset_commands] data_url_len={}", data_url.len());

    Ok(data_url)
}
