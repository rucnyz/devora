use crate::models::*;
use chrono::Utc;
use log::info;
use rusqlite::{params, Connection, Result};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use uuid::Uuid;

pub struct Database {
    pub conn: Mutex<Connection>,
}

impl Database {
    pub fn new(data_dir: PathBuf) -> Result<Self> {
        // Ensure data directory exists
        fs::create_dir_all(&data_dir).expect("Failed to create data directory");

        let db_path = data_dir.join("projects.db");
        info!("Database path: {:?}", db_path);

        let conn = Connection::open(&db_path)?;
        conn.execute_batch("PRAGMA foreign_keys = ON;")?;

        let db = Database {
            conn: Mutex::new(conn),
        };
        db.run_migrations()?;

        Ok(db)
    }

    fn run_migrations(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let current_version: i32 = conn.query_row("PRAGMA user_version", [], |row| row.get(0))?;
        let target_version = 5;

        if current_version >= target_version {
            info!("Database is up to date (version {})", current_version);
            return Ok(());
        }

        info!(
            "Migrating database from version {} to {}",
            current_version, target_version
        );

        // Initial schema (v1)
        if current_version < 1 {
            info!("Creating initial schema");
            conn.execute_batch(
                "
                CREATE TABLE IF NOT EXISTS projects (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    description TEXT DEFAULT '',
                    metadata TEXT DEFAULT '{}',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS items (
                    id TEXT PRIMARY KEY,
                    project_id TEXT NOT NULL,
                    type TEXT NOT NULL,
                    title TEXT NOT NULL,
                    content TEXT DEFAULT '',
                    ide_type TEXT,
                    \"order\" INTEGER DEFAULT 0,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    remote_ide_type TEXT,
                    command_mode TEXT,
                    command_cwd TEXT,
                    command_host TEXT,
                    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS file_cards (
                    id TEXT PRIMARY KEY,
                    project_id TEXT NOT NULL,
                    filename TEXT NOT NULL,
                    file_path TEXT NOT NULL,
                    position_x REAL NOT NULL DEFAULT 100,
                    position_y REAL NOT NULL DEFAULT 100,
                    is_expanded INTEGER NOT NULL DEFAULT 0,
                    z_index INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    is_minimized INTEGER NOT NULL DEFAULT 0,
                    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS settings (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                );

                PRAGMA user_version = 1;
            ",
            )?;
        }

        // v2: Add coding_agent_type column
        if current_version < 2 {
            info!("Adding coding_agent_type column");
            conn.execute_batch(
                "
                ALTER TABLE items ADD COLUMN coding_agent_type TEXT;
                PRAGMA user_version = 2;
            ",
            )?;
        }

        // v3: Add coding_agent_args column
        if current_version < 3 {
            info!("Adding coding_agent_args column");
            conn.execute_batch(
                "
                ALTER TABLE items ADD COLUMN coding_agent_args TEXT;
                PRAGMA user_version = 3;
            ",
            )?;
        }

        // v4: Add coding_agent_env column
        if current_version < 4 {
            info!("Adding coding_agent_env column");
            conn.execute_batch(
                "
                ALTER TABLE items ADD COLUMN coding_agent_env TEXT;
                PRAGMA user_version = 4;
            ",
            )?;
        }

        // v5: Add todos table
        if current_version < 5 {
            info!("Creating todos table");
            conn.execute_batch(
                "
                CREATE TABLE IF NOT EXISTS todos (
                    id TEXT PRIMARY KEY,
                    project_id TEXT NOT NULL,
                    content TEXT NOT NULL,
                    completed INTEGER DEFAULT 0,
                    \"order\" INTEGER DEFAULT 0,
                    indent_level INTEGER DEFAULT 0,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    completed_at TEXT,
                    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
                );

                CREATE INDEX IF NOT EXISTS idx_todos_project ON todos(project_id);

                PRAGMA user_version = 5;
            ",
            )?;
        }

        info!("Database migration complete (version {})", target_version);
        Ok(())
    }

    fn now() -> String {
        Utc::now().to_rfc3339()
    }

    fn new_id() -> String {
        Uuid::new_v4().to_string()
    }

    // Projects CRUD
    pub fn get_all_projects(&self) -> Result<Vec<Project>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT * FROM projects ORDER BY updated_at DESC")?;
        let rows = stmt.query_map([], |row| {
            let metadata_str: String = row.get(3)?;
            let metadata: ProjectMetadata =
                serde_json::from_str(&metadata_str).unwrap_or_default();
            Ok(Project {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                metadata,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
                items: None,
            })
        })?;
        rows.collect()
    }

    pub fn get_project_by_id(&self, id: &str) -> Result<Option<Project>> {
        let conn = self.conn.lock().unwrap();

        let project = conn.query_row(
            "SELECT * FROM projects WHERE id = ?",
            params![id],
            |row| {
                let metadata_str: String = row.get(3)?;
                let metadata: ProjectMetadata =
                    serde_json::from_str(&metadata_str).unwrap_or_default();
                Ok(Project {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    description: row.get(2)?,
                    metadata,
                    created_at: row.get(4)?,
                    updated_at: row.get(5)?,
                    items: None,
                })
            },
        );

        match project {
            Ok(mut p) => {
                // Get items - use explicit column names to ensure correct order
                let mut stmt = conn.prepare(
                    "SELECT id, project_id, type, title, content, ide_type, \"order\", created_at, updated_at, remote_ide_type, command_mode, command_cwd, command_host, coding_agent_type, coding_agent_args, coding_agent_env FROM items WHERE project_id = ? ORDER BY \"order\" ASC"
                )?;
                let items = stmt.query_map(params![id], |row| {
                    let item_type_str: String = row.get(2)?;
                    let ide_type_str: Option<String> = row.get(5)?;
                    let remote_ide_type_str: Option<String> = row.get(9)?;
                    let command_mode_str: Option<String> = row.get(10)?;
                    let coding_agent_type_str: Option<String> = row.get(13)?;

                    Ok(Item {
                        id: row.get(0)?,
                        project_id: row.get(1)?,
                        item_type: item_type_str.parse().unwrap(),
                        title: row.get(3)?,
                        content: row.get(4)?,
                        ide_type: ide_type_str,  // Already a string
                        order: row.get(6)?,
                        created_at: row.get(7)?,
                        updated_at: row.get(8)?,
                        remote_ide_type: remote_ide_type_str,  // Already a string
                        coding_agent_type: coding_agent_type_str.and_then(|s| s.parse().ok()),
                        coding_agent_args: row.get(14)?,
                        coding_agent_env: row.get(15)?,
                        command_mode: command_mode_str.and_then(|s| s.parse().ok()),
                        command_cwd: row.get(11)?,
                        command_host: row.get(12)?,
                    })
                })?;
                p.items = Some(items.filter_map(|r| r.ok()).collect());
                Ok(Some(p))
            }
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }

    pub fn create_project(
        &self,
        name: &str,
        description: &str,
        metadata: ProjectMetadata,
    ) -> Result<Project> {
        let conn = self.conn.lock().unwrap();
        let id = Self::new_id();
        let timestamp = Self::now();
        let metadata_json = serde_json::to_string(&metadata).unwrap_or_else(|_| "{}".to_string());

        conn.execute(
            "INSERT INTO projects (id, name, description, metadata, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
            params![id, name, description, metadata_json, timestamp, timestamp],
        )?;

        Ok(Project {
            id,
            name: name.to_string(),
            description: description.to_string(),
            metadata,
            created_at: timestamp.clone(),
            updated_at: timestamp,
            items: None,
        })
    }

    pub fn update_project(
        &self,
        id: &str,
        name: Option<&str>,
        description: Option<&str>,
        metadata: Option<ProjectMetadata>,
    ) -> Result<Option<Project>> {
        let existing = self.get_project_by_id(id)?;
        if existing.is_none() {
            return Ok(None);
        }
        let existing = existing.unwrap();

        let name = name.unwrap_or(&existing.name);
        let description = description.unwrap_or(&existing.description);
        let metadata = metadata.unwrap_or(existing.metadata);
        let metadata_json = serde_json::to_string(&metadata).unwrap_or_else(|_| "{}".to_string());
        let timestamp = Self::now();

        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE projects SET name = ?, description = ?, metadata = ?, updated_at = ? WHERE id = ?",
            params![name, description, metadata_json, timestamp, id],
        )?;
        drop(conn);

        self.get_project_by_id(id)
    }

    pub fn delete_project(&self, id: &str) -> Result<bool> {
        let conn = self.conn.lock().unwrap();
        let changes = conn.execute("DELETE FROM projects WHERE id = ?", params![id])?;
        Ok(changes > 0)
    }

    // Items CRUD
    pub fn create_item(
        &self,
        project_id: &str,
        item_type: ItemType,
        title: &str,
        content: &str,
        ide_type: Option<&str>,  // Changed to &str to support custom IDE IDs
        remote_ide_type: Option<&str>,  // Changed to &str to support custom remote IDE IDs
        coding_agent_type: Option<CodingAgentType>,
        coding_agent_args: Option<&str>,
        coding_agent_env: Option<&str>,
        command_mode: Option<CommandMode>,
        command_cwd: Option<&str>,
        command_host: Option<&str>,
    ) -> Result<Item> {
        let conn = self.conn.lock().unwrap();
        let id = Self::new_id();
        let timestamp = Self::now();

        // Get next order
        let order: i32 = conn
            .query_row(
                "SELECT COALESCE(MAX(\"order\"), -1) + 1 FROM items WHERE project_id = ?",
                params![project_id],
                |row| row.get(0),
            )
            .unwrap_or(0);

        conn.execute(
            "INSERT INTO items (id, project_id, type, title, content, ide_type, remote_ide_type, coding_agent_type, coding_agent_args, coding_agent_env, command_mode, command_cwd, command_host, \"order\", created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            params![
                id,
                project_id,
                item_type.to_string(),
                title,
                content,
                ide_type,  // Already a string, no conversion needed
                remote_ide_type,  // Already a string, no conversion needed
                coding_agent_type.as_ref().map(|t| t.to_string()),
                coding_agent_args,
                coding_agent_env,
                command_mode.as_ref().map(|t| t.to_string()),
                command_cwd,
                command_host,
                order,
                timestamp,
                timestamp
            ],
        )?;

        // Touch project
        conn.execute(
            "UPDATE projects SET updated_at = ? WHERE id = ?",
            params![timestamp, project_id],
        )?;

        Ok(Item {
            id,
            project_id: project_id.to_string(),
            item_type,
            title: title.to_string(),
            content: content.to_string(),
            ide_type: ide_type.map(|s| s.to_string()),
            remote_ide_type: remote_ide_type.map(|s| s.to_string()),  // Changed to string
            coding_agent_type,
            coding_agent_args: coding_agent_args.map(|s| s.to_string()),
            coding_agent_env: coding_agent_env.map(|s| s.to_string()),
            command_mode,
            command_cwd: command_cwd.map(|s| s.to_string()),
            command_host: command_host.map(|s| s.to_string()),
            order,
            created_at: timestamp.clone(),
            updated_at: timestamp,
        })
    }

    pub fn update_item(
        &self,
        id: &str,
        title: Option<&str>,
        content: Option<&str>,
        ide_type: Option<Option<String>>,  // Changed to String to support custom IDE IDs
        remote_ide_type: Option<Option<String>>,  // Changed to String to support custom remote IDE IDs
        coding_agent_type: Option<Option<CodingAgentType>>,
        coding_agent_args: Option<Option<&str>>,
        coding_agent_env: Option<Option<&str>>,
        command_mode: Option<Option<CommandMode>>,
        command_cwd: Option<Option<&str>>,
        command_host: Option<Option<&str>>,
        order: Option<i32>,
    ) -> Result<Option<Item>> {
        let conn = self.conn.lock().unwrap();

        // Read existing item from database (as strings) - use explicit column names
        let existing: Option<(String, String, String, String, String, Option<String>, i32, String, String, Option<String>, Option<String>, Option<String>, Option<String>, Option<String>, Option<String>, Option<String>)> = conn
            .query_row(
                "SELECT id, project_id, type, title, content, ide_type, \"order\", created_at, updated_at, remote_ide_type, command_mode, command_cwd, command_host, coding_agent_type, coding_agent_args, coding_agent_env FROM items WHERE id = ?",
                params![id],
                |row| {
                    Ok((
                        row.get(0)?,  // id
                        row.get(1)?,  // project_id
                        row.get(2)?,  // item_type
                        row.get(3)?,  // title
                        row.get(4)?,  // content
                        row.get(5)?,  // ide_type
                        row.get(6)?,  // order
                        row.get(7)?,  // created_at
                        row.get(8)?,  // updated_at
                        row.get(9)?,  // remote_ide_type
                        row.get(10)?, // command_mode
                        row.get(11)?, // command_cwd
                        row.get(12)?, // command_host
                        row.get(13)?, // coding_agent_type
                        row.get(14)?, // coding_agent_args
                        row.get(15)?, // coding_agent_env
                    ))
                }
            )
            .ok();

        if existing.is_none() {
            return Ok(None);
        }
        let existing = existing.unwrap();

        // Parse existing enum values from strings
        let existing_item_type: ItemType = existing.2.parse().unwrap();
        let existing_ide_type: Option<String> = existing.5.clone();  // Already a string
        let existing_remote_ide_type: Option<String> = existing.9.clone();  // Already a string
        let existing_coding_agent_type: Option<CodingAgentType> = existing.13.as_ref().and_then(|s| s.parse().ok());
        let existing_coding_agent_args: Option<String> = existing.14.clone();
        let existing_coding_agent_env: Option<String> = existing.15.clone();
        let existing_command_mode: Option<CommandMode> = existing.10.as_ref().and_then(|s| s.parse().ok());

        let title = title.unwrap_or(&existing.3);
        let content = content.unwrap_or(&existing.4);
        let ide_type = ide_type.unwrap_or(existing_ide_type);
        let remote_ide_type = remote_ide_type.unwrap_or(existing_remote_ide_type);
        let coding_agent_type = coding_agent_type.unwrap_or(existing_coding_agent_type);
        // Handle coding_agent_args: Some(Some("")) means clear, Some(Some(value)) means set, None means keep existing
        let coding_agent_args = match coding_agent_args {
            Some(Some("")) => None, // empty string = clear the field
            Some(Some(s)) => Some(s), // non-empty string = set the value
            Some(None) => None, // explicit None = clear the field
            None => existing_coding_agent_args.as_deref(), // not provided = keep existing
        };
        // Handle coding_agent_env: Same logic as coding_agent_args
        let coding_agent_env = match coding_agent_env {
            Some(Some("")) => None,
            Some(Some(s)) => Some(s),
            Some(None) => None,
            None => existing_coding_agent_env.as_deref(),
        };
        let command_mode = command_mode.unwrap_or(existing_command_mode);
        let command_cwd = command_cwd.unwrap_or(existing.11.as_deref());
        let command_host = command_host.unwrap_or(existing.12.as_deref());
        let order = order.unwrap_or(existing.6);
        let timestamp = Self::now();

        conn.execute(
            "UPDATE items SET title = ?, content = ?, ide_type = ?, remote_ide_type = ?, coding_agent_type = ?, coding_agent_args = ?, coding_agent_env = ?, command_mode = ?, command_cwd = ?, command_host = ?, \"order\" = ?, updated_at = ? WHERE id = ?",
            params![
                title,
                content,
                ide_type.as_ref(),  // Already a string
                remote_ide_type.as_ref(),  // Already a string
                coding_agent_type.as_ref().map(|t| t.to_string()),
                coding_agent_args,
                coding_agent_env,
                command_mode.as_ref().map(|t| t.to_string()),
                command_cwd,
                command_host,
                order,
                timestamp,
                id
            ],
        )?;

        // Touch project
        conn.execute(
            "UPDATE projects SET updated_at = ? WHERE id = ?",
            params![timestamp, existing.1],
        )?;

        Ok(Some(Item {
            id: existing.0,
            project_id: existing.1,
            item_type: existing_item_type,
            title: title.to_string(),
            content: content.to_string(),
            ide_type,
            remote_ide_type,
            coding_agent_type,
            coding_agent_args: coding_agent_args.map(|s| s.to_string()),
            coding_agent_env: coding_agent_env.map(|s| s.to_string()),
            command_mode,
            command_cwd: command_cwd.map(|s| s.to_string()),
            command_host: command_host.map(|s| s.to_string()),
            order,
            created_at: existing.7,
            updated_at: timestamp,
        }))
    }

    pub fn delete_item(&self, id: &str) -> Result<bool> {
        let conn = self.conn.lock().unwrap();

        let project_id: Option<String> = conn
            .query_row(
                "SELECT project_id FROM items WHERE id = ?",
                params![id],
                |row| row.get(0),
            )
            .ok();

        let changes = conn.execute("DELETE FROM items WHERE id = ?", params![id])?;

        if changes > 0 {
            if let Some(pid) = project_id {
                conn.execute(
                    "UPDATE projects SET updated_at = ? WHERE id = ?",
                    params![Self::now(), pid],
                )?;
            }
        }

        Ok(changes > 0)
    }

    pub fn reorder_items(&self, project_id: &str, item_ids: Vec<String>) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let timestamp = Self::now();

        for (index, id) in item_ids.iter().enumerate() {
            conn.execute(
                "UPDATE items SET \"order\" = ?, updated_at = ? WHERE id = ? AND project_id = ?",
                params![index as i32, timestamp, id, project_id],
            )?;
        }

        conn.execute(
            "UPDATE projects SET updated_at = ? WHERE id = ?",
            params![timestamp, project_id],
        )?;

        Ok(())
    }

    // File Cards CRUD
    pub fn get_file_cards_by_project(&self, project_id: &str) -> Result<Vec<FileCard>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt =
            conn.prepare("SELECT * FROM file_cards WHERE project_id = ? ORDER BY z_index ASC")?;
        let rows = stmt.query_map(params![project_id], |row| {
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
        })?;
        rows.collect()
    }

    pub fn create_file_card(
        &self,
        project_id: &str,
        filename: &str,
        file_path: &str,
        position_x: f64,
        position_y: f64,
    ) -> Result<FileCard> {
        let conn = self.conn.lock().unwrap();
        let id = Self::new_id();
        let timestamp = Self::now();

        let z_index: i32 = conn
            .query_row(
                "SELECT COALESCE(MAX(z_index), -1) + 1 FROM file_cards WHERE project_id = ?",
                params![project_id],
                |row| row.get(0),
            )
            .unwrap_or(0);

        conn.execute(
            "INSERT INTO file_cards (id, project_id, filename, file_path, position_x, position_y, is_expanded, is_minimized, z_index, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?)",
            params![id, project_id, filename, file_path, position_x, position_y, z_index, timestamp, timestamp],
        )?;

        Ok(FileCard {
            id,
            project_id: project_id.to_string(),
            filename: filename.to_string(),
            file_path: file_path.to_string(),
            position_x,
            position_y,
            is_expanded: false,
            is_minimized: false,
            z_index,
            created_at: timestamp.clone(),
            updated_at: timestamp,
        })
    }

    pub fn update_file_card(
        &self,
        id: &str,
        filename: Option<&str>,
        file_path: Option<&str>,
        position_x: Option<f64>,
        position_y: Option<f64>,
        is_expanded: Option<bool>,
        is_minimized: Option<bool>,
        z_index: Option<i32>,
    ) -> Result<Option<FileCard>> {
        let conn = self.conn.lock().unwrap();

        let existing: Option<FileCard> = conn
            .query_row("SELECT * FROM file_cards WHERE id = ?", params![id], |row| {
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
            .ok();

        if existing.is_none() {
            return Ok(None);
        }
        let existing = existing.unwrap();

        let filename = filename.unwrap_or(&existing.filename);
        let file_path = file_path.unwrap_or(&existing.file_path);
        let position_x = position_x.unwrap_or(existing.position_x);
        let position_y = position_y.unwrap_or(existing.position_y);
        let is_expanded = is_expanded.unwrap_or(existing.is_expanded);
        let is_minimized = is_minimized.unwrap_or(existing.is_minimized);
        let z_index = z_index.unwrap_or(existing.z_index);
        let timestamp = Self::now();

        conn.execute(
            "UPDATE file_cards SET filename = ?, file_path = ?, position_x = ?, position_y = ?, is_expanded = ?, is_minimized = ?, z_index = ?, updated_at = ? WHERE id = ?",
            params![filename, file_path, position_x, position_y, if is_expanded { 1 } else { 0 }, if is_minimized { 1 } else { 0 }, z_index, timestamp, id],
        )?;

        Ok(Some(FileCard {
            id: existing.id,
            project_id: existing.project_id,
            filename: filename.to_string(),
            file_path: file_path.to_string(),
            position_x,
            position_y,
            is_expanded,
            is_minimized,
            z_index,
            created_at: existing.created_at,
            updated_at: timestamp,
        }))
    }

    pub fn delete_file_card(&self, id: &str) -> Result<bool> {
        let conn = self.conn.lock().unwrap();
        let changes = conn.execute("DELETE FROM file_cards WHERE id = ?", params![id])?;
        Ok(changes > 0)
    }

    // Settings CRUD
    pub fn get_all_settings(&self) -> Result<std::collections::HashMap<String, String>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT key, value FROM settings")?;
        let rows = stmt.query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)))?;

        let mut map = std::collections::HashMap::new();
        for row in rows {
            if let Ok((key, value)) = row {
                map.insert(key, value);
            }
        }
        Ok(map)
    }

    pub fn get_setting(&self, key: &str) -> Result<Option<String>> {
        let conn = self.conn.lock().unwrap();
        let result = conn.query_row(
            "SELECT value FROM settings WHERE key = ?",
            params![key],
            |row| row.get(0),
        );
        match result {
            Ok(v) => Ok(Some(v)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }

    pub fn set_setting(&self, key: &str, value: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
            params![key, value],
        )?;
        Ok(())
    }

    pub fn delete_setting(&self, key: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM settings WHERE key = ?", params![key])?;
        Ok(())
    }

    // Export/Import
    pub fn export_all_data(&self, project_ids: Option<Vec<String>>) -> Result<ExportData> {
        let conn = self.conn.lock().unwrap();

        let (projects, items, file_cards) = if let Some(ids) = &project_ids {
            if ids.is_empty() {
                (vec![], vec![], vec![])
            } else {
                let placeholders: String = ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");

                let mut stmt = conn.prepare(&format!(
                    "SELECT * FROM projects WHERE id IN ({}) ORDER BY updated_at DESC",
                    placeholders
                ))?;
                let projects: Vec<ProjectRow> = stmt
                    .query_map(rusqlite::params_from_iter(ids.iter()), |row| {
                        Ok(ProjectRow {
                            id: row.get(0)?,
                            name: row.get(1)?,
                            description: row.get(2)?,
                            metadata: row.get(3)?,
                            created_at: row.get(4)?,
                            updated_at: row.get(5)?,
                        })
                    })?
                    .filter_map(|r| r.ok())
                    .collect();

                let mut stmt = conn.prepare(&format!(
                    "SELECT id, project_id, type, title, content, ide_type, \"order\", created_at, updated_at, remote_ide_type, command_mode, command_cwd, command_host, coding_agent_type, coding_agent_args, coding_agent_env FROM items WHERE project_id IN ({}) ORDER BY project_id, \"order\" ASC",
                    placeholders
                ))?;
                let items: Vec<Item> = stmt
                    .query_map(rusqlite::params_from_iter(ids.iter()), |row| {
                        let item_type_str: String = row.get(2)?;
                        let ide_type_str: Option<String> = row.get(5)?;
                        let remote_ide_type_str: Option<String> = row.get(9)?;
                        let command_mode_str: Option<String> = row.get(10)?;
                        let coding_agent_type_str: Option<String> = row.get(13)?;

                        Ok(Item {
                            id: row.get(0)?,
                            project_id: row.get(1)?,
                            item_type: item_type_str.parse().unwrap(),
                            title: row.get(3)?,
                            content: row.get(4)?,
                            ide_type: ide_type_str,  // Already a string
                            order: row.get(6)?,
                            created_at: row.get(7)?,
                            updated_at: row.get(8)?,
                            remote_ide_type: remote_ide_type_str,  // Already a string
                            coding_agent_type: coding_agent_type_str.and_then(|s| s.parse().ok()),
                            coding_agent_args: row.get(14)?,
                            coding_agent_env: row.get(15)?,
                            command_mode: command_mode_str.and_then(|s| s.parse().ok()),
                            command_cwd: row.get(11)?,
                            command_host: row.get(12)?,
                        })
                    })?
                    .filter_map(|r| r.ok())
                    .collect();

                let mut stmt = conn.prepare(&format!(
                    "SELECT * FROM file_cards WHERE project_id IN ({}) ORDER BY project_id, z_index ASC",
                    placeholders
                ))?;
                let file_cards: Vec<FileCardRow> = stmt
                    .query_map(rusqlite::params_from_iter(ids.iter()), |row| {
                        Ok(FileCardRow {
                            id: row.get(0)?,
                            project_id: row.get(1)?,
                            filename: row.get(2)?,
                            file_path: row.get(3)?,
                            position_x: row.get(4)?,
                            position_y: row.get(5)?,
                            is_expanded: row.get(6)?,
                            z_index: row.get(7)?,
                            created_at: row.get(8)?,
                            updated_at: row.get(9)?,
                            is_minimized: row.get(10).unwrap_or(0),
                        })
                    })?
                    .filter_map(|r| r.ok())
                    .collect();

                (projects, items, file_cards)
            }
        } else {
            let mut stmt = conn.prepare("SELECT * FROM projects ORDER BY updated_at DESC")?;
            let projects: Vec<ProjectRow> = stmt
                .query_map([], |row| {
                    Ok(ProjectRow {
                        id: row.get(0)?,
                        name: row.get(1)?,
                        description: row.get(2)?,
                        metadata: row.get(3)?,
                        created_at: row.get(4)?,
                        updated_at: row.get(5)?,
                    })
                })?
                .filter_map(|r| r.ok())
                .collect();

            let mut stmt = conn.prepare(
                "SELECT id, project_id, type, title, content, ide_type, \"order\", created_at, updated_at, remote_ide_type, command_mode, command_cwd, command_host, coding_agent_type, coding_agent_args, coding_agent_env FROM items ORDER BY project_id, \"order\" ASC"
            )?;
            let items: Vec<Item> = stmt
                .query_map([], |row| {
                    let item_type_str: String = row.get(2)?;
                    let ide_type_str: Option<String> = row.get(5)?;
                    let remote_ide_type_str: Option<String> = row.get(9)?;
                    let command_mode_str: Option<String> = row.get(10)?;
                    let coding_agent_type_str: Option<String> = row.get(13)?;

                    Ok(Item {
                        id: row.get(0)?,
                        project_id: row.get(1)?,
                        item_type: item_type_str.parse().unwrap(),
                        title: row.get(3)?,
                        content: row.get(4)?,
                        ide_type: ide_type_str,  // Already a string
                        order: row.get(6)?,
                        created_at: row.get(7)?,
                        updated_at: row.get(8)?,
                        remote_ide_type: remote_ide_type_str,  // Already a string
                        coding_agent_type: coding_agent_type_str.and_then(|s| s.parse().ok()),
                        coding_agent_args: row.get(14)?,
                        coding_agent_env: row.get(15)?,
                        command_mode: command_mode_str.and_then(|s| s.parse().ok()),
                        command_cwd: row.get(11)?,
                        command_host: row.get(12)?,
                    })
                })?
                .filter_map(|r| r.ok())
                .collect();

            let mut stmt =
                conn.prepare("SELECT * FROM file_cards ORDER BY project_id, z_index ASC")?;
            let file_cards: Vec<FileCardRow> = stmt
                .query_map([], |row| {
                    Ok(FileCardRow {
                        id: row.get(0)?,
                        project_id: row.get(1)?,
                        filename: row.get(2)?,
                        file_path: row.get(3)?,
                        position_x: row.get(4)?,
                        position_y: row.get(5)?,
                        is_expanded: row.get(6)?,
                        z_index: row.get(7)?,
                        created_at: row.get(8)?,
                        updated_at: row.get(9)?,
                        is_minimized: row.get(10).unwrap_or(0),
                    })
                })?
                .filter_map(|r| r.ok())
                .collect();

            (projects, items, file_cards)
        };

        Ok(ExportData {
            version: "1.0".to_string(),
            exported_at: Self::now(),
            projects,
            items,
            file_cards: Some(file_cards),
        })
    }

    pub fn import_data(&self, data: ImportData, mode: &str) -> Result<ImportResult> {
        let conn = self.conn.lock().unwrap();
        let mut projects_imported = 0;
        let mut items_imported = 0;
        let mut file_cards_imported = 0;
        let mut skipped = 0;

        if mode == "replace" {
            conn.execute_batch(
                "DELETE FROM file_cards; DELETE FROM items; DELETE FROM projects;",
            )?;
        }

        // Import projects
        for project in &data.projects {
            let existing: Option<String> = conn
                .query_row(
                    "SELECT id FROM projects WHERE id = ?",
                    params![&project.id],
                    |row| row.get(0),
                )
                .ok();

            if existing.is_some() {
                skipped += 1;
                continue;
            }

            conn.execute(
                "INSERT INTO projects (id, name, description, metadata, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
                params![project.id, project.name, project.description, project.metadata, project.created_at, project.updated_at],
            )?;
            projects_imported += 1;
        }

        // Import items
        for item in &data.items {
            let existing: Option<String> = conn
                .query_row(
                    "SELECT id FROM items WHERE id = ?",
                    params![&item.id],
                    |row| row.get(0),
                )
                .ok();

            if existing.is_some() {
                skipped += 1;
                continue;
            }

            let project_exists: Option<String> = conn
                .query_row(
                    "SELECT id FROM projects WHERE id = ?",
                    params![&item.project_id],
                    |row| row.get(0),
                )
                .ok();

            if project_exists.is_none() {
                skipped += 1;
                continue;
            }

            conn.execute(
                "INSERT INTO items (id, project_id, type, title, content, ide_type, remote_ide_type, coding_agent_type, coding_agent_args, coding_agent_env, command_mode, command_cwd, command_host, \"order\", created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                params![
                    item.id,
                    item.project_id,
                    item.item_type.to_string(),
                    item.title,
                    item.content,
                    item.ide_type.as_ref(),  // Already a string
                    item.remote_ide_type.as_ref(),  // Already a string
                    item.coding_agent_type.as_ref().map(|t| t.to_string()),
                    item.coding_agent_args,
                    item.coding_agent_env,
                    item.command_mode.as_ref().map(|t| t.to_string()),
                    item.command_cwd,
                    item.command_host,
                    item.order,
                    item.created_at,
                    item.updated_at
                ],
            )?;
            items_imported += 1;
        }

        // Import file cards
        if let Some(cards) = &data.file_cards {
            for card in cards {
                let existing: Option<String> = conn
                    .query_row(
                        "SELECT id FROM file_cards WHERE id = ?",
                        params![&card.id],
                        |row| row.get(0),
                    )
                    .ok();

                if existing.is_some() {
                    skipped += 1;
                    continue;
                }

                let project_exists: Option<String> = conn
                    .query_row(
                        "SELECT id FROM projects WHERE id = ?",
                        params![&card.project_id],
                        |row| row.get(0),
                    )
                    .ok();

                if project_exists.is_none() {
                    skipped += 1;
                    continue;
                }

                conn.execute(
                    "INSERT INTO file_cards (id, project_id, filename, file_path, position_x, position_y, is_expanded, z_index, created_at, updated_at, is_minimized) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    params![card.id, card.project_id, card.filename, card.file_path, card.position_x, card.position_y, card.is_expanded, card.z_index, card.created_at, card.updated_at, card.is_minimized],
                )?;
                file_cards_imported += 1;
            }
        }

        Ok(ImportResult {
            projects_imported,
            items_imported,
            file_cards_imported,
            skipped,
        })
    }

    // Todos CRUD
    pub fn get_todos_by_project(&self, project_id: &str) -> Result<Vec<TodoItem>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, project_id, content, completed, \"order\", indent_level, created_at, updated_at, completed_at FROM todos WHERE project_id = ? ORDER BY \"order\" ASC"
        )?;
        let rows = stmt.query_map(params![project_id], |row| {
            Ok(TodoItem {
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
        })?;
        rows.collect()
    }

    pub fn create_todo(
        &self,
        project_id: &str,
        content: &str,
        indent_level: i32,
    ) -> Result<TodoItem> {
        let conn = self.conn.lock().unwrap();
        let id = Self::new_id();
        let timestamp = Self::now();

        // Get next order
        let order: i32 = conn
            .query_row(
                "SELECT COALESCE(MAX(\"order\"), -1) + 1 FROM todos WHERE project_id = ?",
                params![project_id],
                |row| row.get(0),
            )
            .unwrap_or(0);

        conn.execute(
            "INSERT INTO todos (id, project_id, content, completed, \"order\", indent_level, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?, ?, ?)",
            params![id, project_id, content, order, indent_level, timestamp, timestamp],
        )?;

        Ok(TodoItem {
            id,
            project_id: project_id.to_string(),
            content: content.to_string(),
            completed: false,
            order,
            indent_level,
            created_at: timestamp.clone(),
            updated_at: timestamp,
            completed_at: None,
        })
    }

    pub fn update_todo(
        &self,
        id: &str,
        content: Option<&str>,
        completed: Option<bool>,
        indent_level: Option<i32>,
        order: Option<i32>,
    ) -> Result<Option<TodoItem>> {
        let conn = self.conn.lock().unwrap();

        // Read existing todo
        let existing: Option<(String, String, String, i32, i32, i32, String, String, Option<String>)> = conn
            .query_row(
                "SELECT id, project_id, content, completed, \"order\", indent_level, created_at, updated_at, completed_at FROM todos WHERE id = ?",
                params![id],
                |row| {
                    Ok((
                        row.get(0)?,
                        row.get(1)?,
                        row.get(2)?,
                        row.get(3)?,
                        row.get(4)?,
                        row.get(5)?,
                        row.get(6)?,
                        row.get(7)?,
                        row.get(8)?,
                    ))
                }
            )
            .ok();

        if existing.is_none() {
            return Ok(None);
        }
        let existing = existing.unwrap();

        let content = content.unwrap_or(&existing.2);
        let new_completed = completed.unwrap_or(existing.3 == 1);
        let indent_level = indent_level.unwrap_or(existing.5);
        let order = order.unwrap_or(existing.4);
        let timestamp = Self::now();

        // Set completed_at if completing for the first time
        let completed_at = if new_completed && existing.3 == 0 {
            Some(timestamp.clone())
        } else if !new_completed {
            None
        } else {
            existing.8.clone()
        };

        conn.execute(
            "UPDATE todos SET content = ?, completed = ?, \"order\" = ?, indent_level = ?, updated_at = ?, completed_at = ? WHERE id = ?",
            params![
                content,
                if new_completed { 1 } else { 0 },
                order,
                indent_level,
                timestamp,
                completed_at,
                id
            ],
        )?;

        Ok(Some(TodoItem {
            id: existing.0,
            project_id: existing.1,
            content: content.to_string(),
            completed: new_completed,
            order,
            indent_level,
            created_at: existing.6,
            updated_at: timestamp,
            completed_at,
        }))
    }

    pub fn delete_todo(&self, id: &str) -> Result<bool> {
        let conn = self.conn.lock().unwrap();
        let changes = conn.execute("DELETE FROM todos WHERE id = ?", params![id])?;
        Ok(changes > 0)
    }

    pub fn reorder_todos(&self, project_id: &str, todo_ids: Vec<String>) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let timestamp = Self::now();

        for (index, id) in todo_ids.iter().enumerate() {
            conn.execute(
                "UPDATE todos SET \"order\" = ?, updated_at = ? WHERE id = ? AND project_id = ?",
                params![index as i32, timestamp, id, project_id],
            )?;
        }

        Ok(())
    }

    pub fn get_todo_progress(&self, project_id: &str) -> Result<TodoProgress> {
        let conn = self.conn.lock().unwrap();
        let (total, completed): (i32, i32) = conn.query_row(
            "SELECT COUNT(*), COALESCE(SUM(completed), 0) FROM todos WHERE project_id = ?",
            params![project_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )?;

        let percentage = if total > 0 {
            (completed as f32 / total as f32) * 100.0
        } else {
            0.0
        };

        Ok(TodoProgress {
            total,
            completed,
            percentage,
        })
    }
}
