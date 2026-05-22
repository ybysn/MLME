/// 模块职责：应用入口，注册 Tauri plugin 和自定义 command。
/// 当前注册：opener plugin、dialog plugin、文件读写 command、图片资产 command。
mod commands;

use commands::file_commands;
use commands::asset_commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            file_commands::read_markdown_file,
            file_commands::write_markdown_file,
            asset_commands::save_image_asset,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
