mod commands;
mod db;
mod models;

use db::Database;
use std::path::PathBuf;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // Initialize database
            // In debug mode: use project root/data for easy access during development
            // In release mode: use executable directory for portable app
            let data_dir = if cfg!(debug_assertions) {
                PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                    .parent()
                    .map(|p| p.to_path_buf())
                    .unwrap_or_else(|| PathBuf::from("."))
                    .join("data")
            } else {
                std::env::current_exe()
                    .ok()
                    .and_then(|exe| exe.parent().map(|p| p.to_path_buf()))
                    .unwrap_or_else(|| {
                        app.path()
                            .app_data_dir()
                            .unwrap_or_else(|_| PathBuf::from("."))
                    })
                    .join("data")
            };

            let database = Database::new(data_dir)
                .expect("Failed to initialize database");

            app.manage(database);

            // Setup logging in debug mode
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            Ok(())
        })
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::default().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            // Projects
            commands::get_projects,
            commands::get_project,
            commands::create_project,
            commands::update_project,
            commands::delete_project,
            // Items
            commands::create_item,
            commands::update_item,
            commands::delete_item,
            commands::reorder_items,
            // File Cards
            commands::get_file_cards,
            commands::create_file_card,
            commands::update_file_card,
            commands::delete_file_card,
            // Settings
            commands::get_all_settings,
            commands::get_setting,
            commands::set_setting,
            commands::delete_setting,
            // Export/Import
            commands::export_data,
            commands::import_data,
            // System operations
            commands::open_ide,
            commands::open_remote_ide,
            commands::get_ssh_hosts,
            commands::list_remote_dir,
            commands::run_command,
            commands::read_file_content,
            commands::get_file_info,
            commands::read_file_lines,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
