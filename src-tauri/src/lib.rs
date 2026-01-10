mod commands;
mod db;
mod models;
mod settings;

use db::Database;
use settings::SettingsFile;
use std::fs;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // Get config directory (~/.devora/)
            let config_dir = dirs::home_dir()
                .expect("Failed to get home directory")
                .join(".devora");

            // Ensure config directory exists
            fs::create_dir_all(&config_dir).expect("Failed to create config directory");

            // Load settings from JSON file (read before database init)
            let settings_file = SettingsFile::new(config_dir.clone());

            // Get database path from settings, or use default
            let db_dir = settings_file.get_database_path(&config_dir);

            // Initialize database in the configured directory
            let database = Database::new(db_dir)
                .expect("Failed to initialize database");

            app.manage(database);
            app.manage(settings_file);

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
            commands::export_data_to_file,
            commands::import_data,
            // System operations
            commands::open_ide,
            commands::open_custom_ide,
            commands::open_remote_ide,
            commands::open_custom_remote_ide,
            commands::open_coding_agent,
            commands::get_ssh_hosts,
            commands::list_remote_dir,
            commands::run_command,
            commands::read_file_content,
            commands::get_file_info,
            commands::read_file_lines,
            // Database path management
            commands::get_database_path,
            commands::get_default_database_path,
            commands::set_database_path,
            commands::check_database_exists,
            commands::validate_database_path,
            // Todos
            commands::get_todos,
            commands::create_todo,
            commands::update_todo,
            commands::delete_todo,
            commands::reorder_todos,
            commands::get_todo_progress,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
