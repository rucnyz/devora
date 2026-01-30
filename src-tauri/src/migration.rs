use crate::json_store::{Metadata, ProjectData, ProjectInfo};
use crate::models::*;
use log::info;
use rusqlite::{params, Connection};
use std::fs;
use std::path::Path;

/// Result of a migration operation
#[derive(Debug)]
pub struct MigrationResult {
    pub projects_migrated: usize,
    pub items_migrated: usize,
    pub todos_migrated: usize,
    pub file_cards_migrated: usize,
    pub settings_migrated: usize,
}

/// Check if migration is needed and perform it if so
/// Returns Ok(Some(result)) if migration was performed, Ok(None) if not needed
pub fn migrate_if_needed(config_dir: &Path, data_dir: &Path) -> Result<Option<MigrationResult>, String> {
    let metadata_path = data_dir.join("metadata.json");

    // If metadata.json already exists with projects, no migration needed
    if metadata_path.exists() {
        // Check if metadata has any projects (not an empty migration)
        if let Ok(content) = fs::read_to_string(&metadata_path) {
            if let Ok(metadata) = serde_json::from_str::<Metadata>(&content) {
                if !metadata.project_ids.is_empty() || !metadata.projects.is_empty() {
                    info!("metadata.json exists with projects, skipping migration");
                    return Ok(None);
                }
            }
        }
    }

    // Check for SQLite database in data_dir first (custom path), then config_dir (default)
    let sqlite_path_data = data_dir.join("projects.db");
    let sqlite_path_config = config_dir.join("projects.db");

    let sqlite_path = if sqlite_path_data.exists() {
        info!("Found SQLite database in data directory: {:?}", sqlite_path_data);
        sqlite_path_data
    } else if sqlite_path_config.exists() {
        info!("Found SQLite database in config directory: {:?}", sqlite_path_config);
        sqlite_path_config
    } else {
        info!("No existing SQLite database found, starting fresh");
        return Ok(None);
    };

    info!("Migrating from SQLite to JSON...");
    let result = migrate_sqlite_to_json(&sqlite_path, data_dir)?;

    // Rename the old database to mark it as migrated
    let migrated_path = sqlite_path.with_extension("db.migrated");
    fs::rename(&sqlite_path, &migrated_path)
        .map_err(|e| format!("Failed to rename old database: {}", e))?;

    info!(
        "Migration complete: {} projects, {} items, {} todos, {} file cards, {} settings",
        result.projects_migrated,
        result.items_migrated,
        result.todos_migrated,
        result.file_cards_migrated,
        result.settings_migrated
    );

    Ok(Some(result))
}

/// Migrate data from SQLite database to JSON files
fn migrate_sqlite_to_json(sqlite_path: &Path, data_dir: &Path) -> Result<MigrationResult, String> {
    // Open SQLite database
    let conn = Connection::open(sqlite_path)
        .map_err(|e| format!("Failed to open SQLite database: {}", e))?;

    // Ensure directories exist
    fs::create_dir_all(data_dir)
        .map_err(|e| format!("Failed to create data directory: {}", e))?;
    fs::create_dir_all(data_dir.join("projects"))
        .map_err(|e| format!("Failed to create projects directory: {}", e))?;

    let mut result = MigrationResult {
        projects_migrated: 0,
        items_migrated: 0,
        todos_migrated: 0,
        file_cards_migrated: 0,
        settings_migrated: 0,
    };

    // Migrate settings first
    let settings = migrate_settings(&conn)?;
    result.settings_migrated = settings.len();

    // Get all projects
    let sqlite_projects = get_sqlite_projects(&conn)?;
    let mut projects = Vec::new();

    for project in sqlite_projects {
        let project_id = project.id.clone();
        let project_name = project.name.clone();
        projects.push(ProjectInfo {
            id: project_id.clone(),
            name: project_name,
        });

        // Get items for this project
        let items = get_sqlite_items(&conn, &project_id)?;
        result.items_migrated += items.len();

        // Get todos for this project and convert to markdown
        let legacy_todos = get_sqlite_todos(&conn, &project_id)?;
        result.todos_migrated += legacy_todos.len();
        let todos_markdown = convert_todos_to_markdown(&legacy_todos);

        // Get file cards for this project
        let file_cards = get_sqlite_file_cards(&conn, &project_id)?;
        result.file_cards_migrated += file_cards.len();

        // Create ProjectData
        let project_data = ProjectData {
            id: project.id,
            name: project.name,
            description: project.description,
            metadata: project.metadata,
            items,
            todos: todos_markdown,
            file_cards,
            created_at: project.created_at,
            updated_at: project.updated_at,
        };

        // Write project file
        let project_path = data_dir.join("projects").join(format!("{}.json", project_id));
        let json = serde_json::to_string_pretty(&project_data)
            .map_err(|e| format!("Failed to serialize project: {}", e))?;
        fs::write(&project_path, json)
            .map_err(|e| format!("Failed to write project file: {}", e))?;

        result.projects_migrated += 1;
    }

    // Write metadata.json
    let metadata = Metadata {
        version: 1,
        project_ids: Vec::new(),
        projects,
        global_settings: settings,
    };

    let metadata_path = data_dir.join("metadata.json");
    let json = serde_json::to_string_pretty(&metadata)
        .map_err(|e| format!("Failed to serialize metadata: {}", e))?;
    fs::write(&metadata_path, json)
        .map_err(|e| format!("Failed to write metadata file: {}", e))?;

    Ok(result)
}

/// Internal struct to hold project data from SQLite
struct SqliteProject {
    id: String,
    name: String,
    description: String,
    metadata: ProjectMetadata,
    created_at: String,
    updated_at: String,
}

/// Get all projects from SQLite
fn get_sqlite_projects(conn: &Connection) -> Result<Vec<SqliteProject>, String> {
    let mut stmt = conn
        .prepare("SELECT id, name, description, metadata, created_at, updated_at FROM projects ORDER BY updated_at DESC")
        .map_err(|e| format!("Failed to prepare projects query: {}", e))?;

    let rows = stmt
        .query_map([], |row| {
            let metadata_str: String = row.get(3)?;
            let metadata: ProjectMetadata =
                serde_json::from_str(&metadata_str).unwrap_or_default();
            Ok(SqliteProject {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                metadata,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            })
        })
        .map_err(|e| format!("Failed to query projects: {}", e))?;

    let mut projects = Vec::new();
    for row in rows {
        match row {
            Ok(project) => projects.push(project),
            Err(e) => log::warn!("Failed to read project row: {}", e),
        }
    }

    Ok(projects)
}

/// Get items for a project from SQLite
fn get_sqlite_items(conn: &Connection, project_id: &str) -> Result<Vec<Item>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, project_id, type, title, content, ide_type, \"order\", created_at, updated_at, remote_ide_type, command_mode, command_cwd, command_host, coding_agent_type, coding_agent_args, coding_agent_env FROM items WHERE project_id = ? ORDER BY \"order\" ASC"
        )
        .map_err(|e| format!("Failed to prepare items query: {}", e))?;

    let rows = stmt
        .query_map(params![project_id], |row| {
            let item_type_str: String = row.get(2)?;
            let ide_type_str: Option<String> = row.get(5)?;
            let remote_ide_type_str: Option<String> = row.get(9)?;
            let command_mode_str: Option<String> = row.get(10)?;
            let coding_agent_type_str: Option<String> = row.get(13)?;

            Ok(Item {
                id: row.get(0)?,
                project_id: row.get(1)?,
                item_type: item_type_str.parse().unwrap_or(ItemType::Note),
                title: row.get(3)?,
                content: row.get(4)?,
                ide_type: ide_type_str,
                order: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
                remote_ide_type: remote_ide_type_str,
                coding_agent_type: coding_agent_type_str.and_then(|s| s.parse().ok()),
                coding_agent_args: row.get(14)?,
                coding_agent_env: row.get(15)?,
                command_mode: command_mode_str.and_then(|s| s.parse().ok()),
                command_cwd: row.get(11)?,
                command_host: row.get(12)?,
            })
        })
        .map_err(|e| format!("Failed to query items: {}", e))?;

    let mut items = Vec::new();
    for row in rows {
        match row {
            Ok(item) => items.push(item),
            Err(e) => log::warn!("Failed to read item row: {}", e),
        }
    }

    Ok(items)
}

/// Get todos for a project from SQLite
fn get_sqlite_todos(conn: &Connection, project_id: &str) -> Result<Vec<LegacyTodoItem>, String> {
    // First check if todos table exists (might be an older database)
    let table_exists: bool = conn
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='todos'",
            [],
            |row| row.get::<_, i32>(0),
        )
        .map(|count| count > 0)
        .unwrap_or(false);

    if !table_exists {
        return Ok(Vec::new());
    }

    let mut stmt = conn
        .prepare(
            "SELECT id, project_id, content, completed, \"order\", indent_level, created_at, updated_at, completed_at FROM todos WHERE project_id = ? ORDER BY \"order\" ASC"
        )
        .map_err(|e| format!("Failed to prepare todos query: {}", e))?;

    let rows = stmt
        .query_map(params![project_id], |row| {
            Ok(LegacyTodoItem {
                id: row.get(0)?,
                project_id: row.get(1)?,
                content: row.get(2)?,
                completed: row.get::<_, i32>(3)? == 1,
                order: row.get(4)?,
                indent_level: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
                completed_at: row.get(8)?,
            })
        })
        .map_err(|e| format!("Failed to query todos: {}", e))?;

    let mut todos = Vec::new();
    for row in rows {
        match row {
            Ok(todo) => todos.push(todo),
            Err(e) => log::warn!("Failed to read todo row: {}", e),
        }
    }

    Ok(todos)
}

/// Get file cards for a project from SQLite
fn get_sqlite_file_cards(conn: &Connection, project_id: &str) -> Result<Vec<FileCard>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, project_id, filename, file_path, position_x, position_y, is_expanded, z_index, created_at, updated_at, is_minimized FROM file_cards WHERE project_id = ? ORDER BY z_index ASC"
        )
        .map_err(|e| format!("Failed to prepare file_cards query: {}", e))?;

    let rows = stmt
        .query_map(params![project_id], |row| {
            Ok(FileCard {
                id: row.get(0)?,
                project_id: row.get(1)?,
                filename: row.get(2)?,
                file_path: row.get(3)?,
                position_x: row.get(4)?,
                position_y: row.get(5)?,
                is_expanded: row.get::<_, i32>(6)? == 1,
                z_index: row.get(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
                is_minimized: row.get::<_, i32>(10).unwrap_or(0) == 1,
            })
        })
        .map_err(|e| format!("Failed to query file_cards: {}", e))?;

    let mut cards = Vec::new();
    for row in rows {
        match row {
            Ok(card) => cards.push(card),
            Err(e) => log::warn!("Failed to read file_card row: {}", e),
        }
    }

    Ok(cards)
}

/// Migrate settings from SQLite
fn migrate_settings(conn: &Connection) -> Result<std::collections::HashMap<String, String>, String> {
    // First check if settings table exists
    let table_exists: bool = conn
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='settings'",
            [],
            |row| row.get::<_, i32>(0),
        )
        .map(|count| count > 0)
        .unwrap_or(false);

    if !table_exists {
        return Ok(std::collections::HashMap::new());
    }

    let mut stmt = conn
        .prepare("SELECT key, value FROM settings")
        .map_err(|e| format!("Failed to prepare settings query: {}", e))?;

    let rows = stmt
        .query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)))
        .map_err(|e| format!("Failed to query settings: {}", e))?;

    let mut settings = std::collections::HashMap::new();
    for row in rows {
        if let Ok((key, value)) = row {
            settings.insert(key, value);
        }
    }

    Ok(settings)
}

/// Convert legacy Vec<LegacyTodoItem> to markdown string
fn convert_todos_to_markdown(todos: &[LegacyTodoItem]) -> String {
    if todos.is_empty() {
        return String::new();
    }

    let mut sorted_todos = todos.to_vec();
    sorted_todos.sort_by_key(|t| t.order);

    sorted_todos
        .iter()
        .map(|todo| {
            let indent = "  ".repeat(todo.indent_level as usize);
            let checkbox = if todo.completed { "[x]" } else { "[ ]" };
            format!("{}- {} {}", indent, checkbox, todo.content)
        })
        .collect::<Vec<_>>()
        .join("\n")
}
