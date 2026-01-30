mod commands;
mod db;
mod json_store;
mod migration;
mod models;
mod settings;

use json_store::JsonStore;
use settings::SettingsFile;
use std::fs;
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

/// Parse --project <name> from command line arguments
fn parse_project_arg() -> Option<String> {
    let args: Vec<String> = std::env::args().collect();
    let mut iter = args.iter().peekable();
    while let Some(arg) = iter.next() {
        if arg == "--project" {
            return iter.next().cloned();
        }
    }
    None
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Parse --project argument before building the app
    let project_name_arg = parse_project_arg();

    tauri::Builder::default()
        .setup(move |app| {
            // Get config directory (~/.devora/)
            let config_dir = dirs::home_dir()
                .expect("Failed to get home directory")
                .join(".devora");

            // Ensure config directory exists
            fs::create_dir_all(&config_dir).expect("Failed to create config directory");

            // Load settings from JSON file (read before storage init)
            let settings_file = SettingsFile::new(config_dir.clone());

            // Get data path from settings, or use default
            let data_dir = settings_file.get_data_path(&config_dir);

            // Run migration from SQLite to JSON if needed
            // Migration checks if metadata.json exists and if projects.db exists
            if let Err(e) = migration::migrate_if_needed(&config_dir, &data_dir) {
                log::error!("Migration failed: {}", e);
                // Continue anyway - either fresh start or migration error
            }

            // Initialize JSON store in the configured directory
            let store = JsonStore::new(data_dir).expect("Failed to initialize JSON store");

            // Handle --project argument: find project by name and open it
            if let Some(ref project_name) = project_name_arg {
                if let Ok(projects) = store.get_all_projects() {
                    if let Some(project) = projects.iter().find(|p| p.name == *project_name) {
                        // Close default main window
                        if let Some(main_window) = app.get_webview_window("main") {
                            let _ = main_window.close();
                        }

                        // Create project window with proper title
                        let window_label = format!("project-{}", project.id);
                        let url = WebviewUrl::App(format!("/project/{}", project.id).into());
                        let title = format!("Devora - {}", project.name);

                        let _ = WebviewWindowBuilder::new(app, &window_label, url)
                            .title(&title)
                            .inner_size(1200.0, 800.0)
                            .min_inner_size(800.0, 600.0)
                            .build();
                    }
                }
            }

            app.manage(store);
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
            // Store reload & external change detection
            commands::reload_store,
            commands::check_external_changes,
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
            // Data path management
            commands::get_data_path,
            commands::get_default_data_path,
            commands::set_data_path,
            commands::check_data_exists,
            commands::validate_data_path,
            // Todos (Markdown)
            commands::get_project_todos,
            commands::set_project_todos,
            // Window management
            commands::open_project_window,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
