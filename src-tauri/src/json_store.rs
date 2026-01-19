use crate::models::*;
use chrono::Utc;
use log::info;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::io::Write;
use std::path::PathBuf;
use std::sync::RwLock;
use uuid::Uuid;

/// Metadata stored in metadata.json
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Metadata {
    pub version: u32,
    pub project_ids: Vec<String>,
    #[serde(default)]
    pub global_settings: HashMap<String, String>,
}

/// Full project data stored in projects/{id}.json
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectData {
    pub id: String,
    pub name: String,
    pub description: String,
    pub metadata: ProjectMetadata,
    pub items: Vec<Item>,
    pub todos: Vec<TodoItem>,
    pub file_cards: Vec<FileCard>,
    pub created_at: String,
    pub updated_at: String,
}

impl ProjectData {
    /// Convert to Project (without items for list views)
    pub fn to_project(&self) -> Project {
        Project {
            id: self.id.clone(),
            name: self.name.clone(),
            description: self.description.clone(),
            metadata: self.metadata.clone(),
            created_at: self.created_at.clone(),
            updated_at: self.updated_at.clone(),
            items: None,
        }
    }

    /// Convert to Project with items
    pub fn to_project_with_items(&self) -> Project {
        Project {
            id: self.id.clone(),
            name: self.name.clone(),
            description: self.description.clone(),
            metadata: self.metadata.clone(),
            created_at: self.created_at.clone(),
            updated_at: self.updated_at.clone(),
            items: Some(self.items.clone()),
        }
    }
}

/// JSON-based storage for projects and settings
pub struct JsonStore {
    data_path: PathBuf,
    metadata: RwLock<Metadata>,
    projects_cache: RwLock<HashMap<String, ProjectData>>,
    /// Track when we last loaded the metadata (for external change detection)
    last_metadata_mtime: RwLock<Option<std::time::SystemTime>>,
}

impl JsonStore {
    /// Create a new JsonStore
    pub fn new(data_path: PathBuf) -> Result<Self, String> {
        // Ensure data directory exists
        fs::create_dir_all(&data_path)
            .map_err(|e| format!("Failed to create data directory: {}", e))?;

        // Ensure projects subdirectory exists
        let projects_dir = data_path.join("projects");
        fs::create_dir_all(&projects_dir)
            .map_err(|e| format!("Failed to create projects directory: {}", e))?;

        // Load metadata
        let metadata_path = data_path.join("metadata.json");
        let (metadata, mtime) = if metadata_path.exists() {
            let content = fs::read_to_string(&metadata_path)
                .map_err(|e| format!("Failed to read metadata.json: {}", e))?;
            let mtime = fs::metadata(&metadata_path)
                .ok()
                .and_then(|m| m.modified().ok());
            let metadata: Metadata = serde_json::from_str(&content)
                .map_err(|e| format!("Failed to parse metadata.json: {}", e))?;
            (metadata, mtime)
        } else {
            let metadata = Metadata {
                version: 1,
                project_ids: Vec::new(),
                global_settings: HashMap::new(),
            };
            // Write initial metadata
            Self::write_json_atomic(&metadata_path, &metadata)?;
            let mtime = fs::metadata(&metadata_path)
                .ok()
                .and_then(|m| m.modified().ok());
            (metadata, mtime)
        };

        info!("JsonStore initialized at {:?}", data_path);

        Ok(Self {
            data_path,
            metadata: RwLock::new(metadata),
            projects_cache: RwLock::new(HashMap::new()),
            last_metadata_mtime: RwLock::new(mtime),
        })
    }

    /// Get the data path
    #[allow(dead_code)]
    pub fn data_path(&self) -> &PathBuf {
        &self.data_path
    }

    /// Write JSON to file atomically (write to temp, then rename)
    fn write_json_atomic<T: Serialize>(path: &PathBuf, data: &T) -> Result<(), String> {
        let json = serde_json::to_string_pretty(data)
            .map_err(|e| format!("Failed to serialize JSON: {}", e))?;

        // Ensure parent directory exists
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create parent directory: {}", e))?;
        }

        let temp_path = path.with_extension("json.tmp");

        // Write to temp file
        let mut file = fs::File::create(&temp_path)
            .map_err(|e| format!("Failed to create temp file: {}", e))?;
        file.write_all(json.as_bytes())
            .map_err(|e| format!("Failed to write temp file: {}", e))?;
        file.sync_all()
            .map_err(|e| format!("Failed to sync temp file: {}", e))?;
        drop(file);

        // Atomic rename
        fs::rename(&temp_path, path).map_err(|e| format!("Failed to rename temp file: {}", e))?;

        Ok(())
    }

    /// Save metadata
    fn save_metadata(&self) -> Result<(), String> {
        let metadata = self.metadata.read().unwrap();
        let path = self.data_path.join("metadata.json");
        Self::write_json_atomic(&path, &*metadata)
    }

    /// Get project file path
    fn project_path(&self, id: &str) -> PathBuf {
        self.data_path.join("projects").join(format!("{}.json", id))
    }

    /// Load project from file
    fn load_project(&self, id: &str) -> Result<ProjectData, String> {
        // Check cache first
        {
            let cache = self.projects_cache.read().unwrap();
            if let Some(data) = cache.get(id) {
                return Ok(data.clone());
            }
        }

        // Load from file
        let path = self.project_path(id);
        let content = fs::read_to_string(&path)
            .map_err(|e| format!("Failed to read project file: {}", e))?;
        let data: ProjectData = serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse project file: {}", e))?;

        // Store in cache
        self.projects_cache
            .write()
            .unwrap()
            .insert(id.to_string(), data.clone());

        Ok(data)
    }

    /// Save project to file
    fn save_project(&self, project: &ProjectData) -> Result<(), String> {
        let path = self.project_path(&project.id);
        Self::write_json_atomic(&path, project)?;

        // Update cache
        self.projects_cache
            .write()
            .unwrap()
            .insert(project.id.clone(), project.clone());

        Ok(())
    }

    /// Helper to generate new UUID
    fn new_id() -> String {
        Uuid::new_v4().to_string()
    }

    /// Helper to get current timestamp
    fn now() -> String {
        Utc::now().to_rfc3339()
    }

    // ==================== Projects CRUD ====================

    /// Get all projects (without items)
    pub fn get_all_projects(&self) -> Result<Vec<Project>, String> {
        let metadata = self.metadata.read().unwrap();
        let mut projects = Vec::new();

        for id in &metadata.project_ids {
            match self.load_project(id) {
                Ok(data) => projects.push(data.to_project()),
                Err(e) => {
                    // Log error but continue - don't fail entire list for one bad project
                    log::warn!("Failed to load project {}: {}", id, e);
                }
            }
        }

        // Sort by updated_at descending
        projects.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));

        Ok(projects)
    }

    /// Get a single project by ID (with items)
    pub fn get_project_by_id(&self, id: &str) -> Result<Option<Project>, String> {
        let metadata = self.metadata.read().unwrap();
        if !metadata.project_ids.contains(&id.to_string()) {
            return Ok(None);
        }
        drop(metadata);

        match self.load_project(id) {
            Ok(data) => Ok(Some(data.to_project_with_items())),
            Err(_) => Ok(None),
        }
    }

    /// Create a new project
    pub fn create_project(
        &self,
        name: &str,
        description: &str,
        metadata: ProjectMetadata,
    ) -> Result<Project, String> {
        let id = Self::new_id();
        let timestamp = Self::now();

        let project_data = ProjectData {
            id: id.clone(),
            name: name.to_string(),
            description: description.to_string(),
            metadata,
            items: Vec::new(),
            todos: Vec::new(),
            file_cards: Vec::new(),
            created_at: timestamp.clone(),
            updated_at: timestamp,
        };

        // Save project file
        self.save_project(&project_data)?;

        // Update metadata
        {
            let mut meta = self.metadata.write().unwrap();
            meta.project_ids.push(id.clone());
        }
        self.save_metadata()?;

        Ok(project_data.to_project())
    }

    /// Update a project
    pub fn update_project(
        &self,
        id: &str,
        name: Option<&str>,
        description: Option<&str>,
        metadata: Option<ProjectMetadata>,
    ) -> Result<Option<Project>, String> {
        let mut project_data = match self.load_project(id) {
            Ok(data) => data,
            Err(_) => return Ok(None),
        };

        if let Some(n) = name {
            project_data.name = n.to_string();
        }
        if let Some(d) = description {
            project_data.description = d.to_string();
        }
        if let Some(m) = metadata {
            project_data.metadata = m;
        }
        project_data.updated_at = Self::now();

        self.save_project(&project_data)?;

        Ok(Some(project_data.to_project_with_items()))
    }

    /// Delete a project
    pub fn delete_project(&self, id: &str) -> Result<bool, String> {
        // Check if project exists
        {
            let metadata = self.metadata.read().unwrap();
            if !metadata.project_ids.contains(&id.to_string()) {
                return Ok(false);
            }
        }

        // Delete project file
        let path = self.project_path(id);
        if path.exists() {
            fs::remove_file(&path).map_err(|e| format!("Failed to delete project file: {}", e))?;
        }

        // Remove from cache
        self.projects_cache.write().unwrap().remove(id);

        // Update metadata
        {
            let mut meta = self.metadata.write().unwrap();
            meta.project_ids.retain(|pid| pid != id);
        }
        self.save_metadata()?;

        Ok(true)
    }

    // ==================== Items CRUD ====================

    /// Create an item
    pub fn create_item(
        &self,
        project_id: &str,
        item_type: ItemType,
        title: &str,
        content: &str,
        ide_type: Option<&str>,
        remote_ide_type: Option<&str>,
        coding_agent_type: Option<CodingAgentType>,
        coding_agent_args: Option<&str>,
        coding_agent_env: Option<&str>,
        command_mode: Option<CommandMode>,
        command_cwd: Option<&str>,
        command_host: Option<&str>,
    ) -> Result<Item, String> {
        let mut project_data = self.load_project(project_id)?;

        let id = Self::new_id();
        let timestamp = Self::now();

        // Get next order
        let order = project_data
            .items
            .iter()
            .map(|i| i.order)
            .max()
            .unwrap_or(-1)
            + 1;

        let item = Item {
            id,
            project_id: project_id.to_string(),
            item_type,
            title: title.to_string(),
            content: content.to_string(),
            ide_type: ide_type.map(|s| s.to_string()),
            remote_ide_type: remote_ide_type.map(|s| s.to_string()),
            coding_agent_type,
            coding_agent_args: coding_agent_args.map(|s| s.to_string()),
            coding_agent_env: coding_agent_env.map(|s| s.to_string()),
            command_mode,
            command_cwd: command_cwd.map(|s| s.to_string()),
            command_host: command_host.map(|s| s.to_string()),
            order,
            created_at: timestamp.clone(),
            updated_at: timestamp.clone(),
        };

        project_data.items.push(item.clone());
        project_data.updated_at = timestamp;

        self.save_project(&project_data)?;

        Ok(item)
    }

    /// Update an item
    pub fn update_item(
        &self,
        id: &str,
        title: Option<&str>,
        content: Option<&str>,
        ide_type: Option<Option<String>>,
        remote_ide_type: Option<Option<String>>,
        coding_agent_type: Option<Option<CodingAgentType>>,
        coding_agent_args: Option<Option<&str>>,
        coding_agent_env: Option<Option<&str>>,
        command_mode: Option<Option<CommandMode>>,
        command_cwd: Option<Option<&str>>,
        command_host: Option<Option<&str>>,
        order: Option<i32>,
    ) -> Result<Option<Item>, String> {
        // Find which project contains this item
        let metadata = self.metadata.read().unwrap();
        let project_ids = metadata.project_ids.clone();
        drop(metadata);

        for project_id in &project_ids {
            let mut project_data = match self.load_project(project_id) {
                Ok(data) => data,
                Err(_) => continue,
            };

            if let Some(item) = project_data.items.iter_mut().find(|i| i.id == id) {
                if let Some(t) = title {
                    item.title = t.to_string();
                }
                if let Some(c) = content {
                    item.content = c.to_string();
                }
                if let Some(it) = ide_type {
                    item.ide_type = it;
                }
                if let Some(rit) = remote_ide_type {
                    item.remote_ide_type = rit;
                }
                if let Some(cat) = coding_agent_type {
                    item.coding_agent_type = cat;
                }
                if let Some(caa) = coding_agent_args {
                    item.coding_agent_args = caa.map(|s| s.to_string());
                }
                if let Some(cae) = coding_agent_env {
                    item.coding_agent_env = cae.map(|s| s.to_string());
                }
                if let Some(cm) = command_mode {
                    item.command_mode = cm;
                }
                if let Some(cc) = command_cwd {
                    item.command_cwd = cc.map(|s| s.to_string());
                }
                if let Some(ch) = command_host {
                    item.command_host = ch.map(|s| s.to_string());
                }
                if let Some(o) = order {
                    item.order = o;
                }
                item.updated_at = Self::now();
                project_data.updated_at = item.updated_at.clone();

                let updated_item = item.clone();
                self.save_project(&project_data)?;
                return Ok(Some(updated_item));
            }
        }

        Ok(None)
    }

    /// Delete an item
    pub fn delete_item(&self, id: &str) -> Result<bool, String> {
        let metadata = self.metadata.read().unwrap();
        let project_ids = metadata.project_ids.clone();
        drop(metadata);

        for project_id in &project_ids {
            let mut project_data = match self.load_project(project_id) {
                Ok(data) => data,
                Err(_) => continue,
            };

            let original_len = project_data.items.len();
            project_data.items.retain(|i| i.id != id);

            if project_data.items.len() < original_len {
                project_data.updated_at = Self::now();
                self.save_project(&project_data)?;
                return Ok(true);
            }
        }

        Ok(false)
    }

    /// Reorder items within a project
    pub fn reorder_items(&self, project_id: &str, item_ids: Vec<String>) -> Result<(), String> {
        let mut project_data = self.load_project(project_id)?;
        let timestamp = Self::now();

        for (index, id) in item_ids.iter().enumerate() {
            if let Some(item) = project_data.items.iter_mut().find(|i| &i.id == id) {
                item.order = index as i32;
                item.updated_at = timestamp.clone();
            }
        }

        // Sort items by order
        project_data.items.sort_by_key(|i| i.order);
        project_data.updated_at = timestamp;

        self.save_project(&project_data)
    }

    // ==================== File Cards CRUD ====================

    /// Get file cards for a project
    pub fn get_file_cards_by_project(&self, project_id: &str) -> Result<Vec<FileCard>, String> {
        let project_data = self.load_project(project_id)?;
        let mut cards = project_data.file_cards;
        cards.sort_by_key(|c| c.z_index);
        Ok(cards)
    }

    /// Create a file card
    pub fn create_file_card(
        &self,
        project_id: &str,
        filename: &str,
        file_path: &str,
        position_x: f64,
        position_y: f64,
    ) -> Result<FileCard, String> {
        let mut project_data = self.load_project(project_id)?;

        let id = Self::new_id();
        let timestamp = Self::now();

        let z_index = project_data
            .file_cards
            .iter()
            .map(|c| c.z_index)
            .max()
            .unwrap_or(-1)
            + 1;

        let card = FileCard {
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
        };

        project_data.file_cards.push(card.clone());
        self.save_project(&project_data)?;

        Ok(card)
    }

    /// Update a file card
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
    ) -> Result<Option<FileCard>, String> {
        let metadata = self.metadata.read().unwrap();
        let project_ids = metadata.project_ids.clone();
        drop(metadata);

        for project_id in &project_ids {
            let mut project_data = match self.load_project(project_id) {
                Ok(data) => data,
                Err(_) => continue,
            };

            if let Some(card) = project_data.file_cards.iter_mut().find(|c| c.id == id) {
                if let Some(f) = filename {
                    card.filename = f.to_string();
                }
                if let Some(fp) = file_path {
                    card.file_path = fp.to_string();
                }
                if let Some(px) = position_x {
                    card.position_x = px;
                }
                if let Some(py) = position_y {
                    card.position_y = py;
                }
                if let Some(ie) = is_expanded {
                    card.is_expanded = ie;
                }
                if let Some(im) = is_minimized {
                    card.is_minimized = im;
                }
                if let Some(z) = z_index {
                    card.z_index = z;
                }
                card.updated_at = Self::now();

                let updated_card = card.clone();
                self.save_project(&project_data)?;
                return Ok(Some(updated_card));
            }
        }

        Ok(None)
    }

    /// Delete a file card
    pub fn delete_file_card(&self, id: &str) -> Result<bool, String> {
        let metadata = self.metadata.read().unwrap();
        let project_ids = metadata.project_ids.clone();
        drop(metadata);

        for project_id in &project_ids {
            let mut project_data = match self.load_project(project_id) {
                Ok(data) => data,
                Err(_) => continue,
            };

            let original_len = project_data.file_cards.len();
            project_data.file_cards.retain(|c| c.id != id);

            if project_data.file_cards.len() < original_len {
                self.save_project(&project_data)?;
                return Ok(true);
            }
        }

        Ok(false)
    }

    // ==================== Settings CRUD ====================

    /// Get all settings
    pub fn get_all_settings(&self) -> Result<HashMap<String, String>, String> {
        let metadata = self.metadata.read().unwrap();
        Ok(metadata.global_settings.clone())
    }

    /// Get a single setting
    pub fn get_setting(&self, key: &str) -> Result<Option<String>, String> {
        let metadata = self.metadata.read().unwrap();
        Ok(metadata.global_settings.get(key).cloned())
    }

    /// Set a setting
    pub fn set_setting(&self, key: &str, value: &str) -> Result<(), String> {
        {
            let mut metadata = self.metadata.write().unwrap();
            metadata
                .global_settings
                .insert(key.to_string(), value.to_string());
        }
        self.save_metadata()
    }

    /// Delete a setting
    pub fn delete_setting(&self, key: &str) -> Result<(), String> {
        {
            let mut metadata = self.metadata.write().unwrap();
            metadata.global_settings.remove(key);
        }
        self.save_metadata()
    }

    // ==================== Todos CRUD ====================

    /// Get todos for a project
    pub fn get_todos_by_project(&self, project_id: &str) -> Result<Vec<TodoItem>, String> {
        let project_data = self.load_project(project_id)?;
        let mut todos = project_data.todos;
        todos.sort_by_key(|t| t.order);
        Ok(todos)
    }

    /// Create a todo
    pub fn create_todo(
        &self,
        project_id: &str,
        content: &str,
        indent_level: i32,
    ) -> Result<TodoItem, String> {
        let mut project_data = self.load_project(project_id)?;

        let id = Self::new_id();
        let timestamp = Self::now();

        let order = project_data
            .todos
            .iter()
            .map(|t| t.order)
            .max()
            .unwrap_or(-1)
            + 1;

        let todo = TodoItem {
            id,
            project_id: project_id.to_string(),
            content: content.to_string(),
            completed: false,
            order,
            indent_level,
            created_at: timestamp.clone(),
            updated_at: timestamp,
            completed_at: None,
        };

        project_data.todos.push(todo.clone());
        self.save_project(&project_data)?;

        Ok(todo)
    }

    /// Update a todo
    pub fn update_todo(
        &self,
        id: &str,
        content: Option<&str>,
        completed: Option<bool>,
        indent_level: Option<i32>,
        order: Option<i32>,
    ) -> Result<Option<TodoItem>, String> {
        let metadata = self.metadata.read().unwrap();
        let project_ids = metadata.project_ids.clone();
        drop(metadata);

        for project_id in &project_ids {
            let mut project_data = match self.load_project(project_id) {
                Ok(data) => data,
                Err(_) => continue,
            };

            if let Some(todo) = project_data.todos.iter_mut().find(|t| t.id == id) {
                let was_completed = todo.completed;

                if let Some(c) = content {
                    todo.content = c.to_string();
                }
                if let Some(comp) = completed {
                    todo.completed = comp;
                    // Set completed_at if completing for the first time
                    if comp && !was_completed {
                        todo.completed_at = Some(Self::now());
                    } else if !comp {
                        todo.completed_at = None;
                    }
                }
                if let Some(il) = indent_level {
                    todo.indent_level = il;
                }
                if let Some(o) = order {
                    todo.order = o;
                }
                todo.updated_at = Self::now();

                let updated_todo = todo.clone();
                self.save_project(&project_data)?;
                return Ok(Some(updated_todo));
            }
        }

        Ok(None)
    }

    /// Delete a todo
    pub fn delete_todo(&self, id: &str) -> Result<bool, String> {
        let metadata = self.metadata.read().unwrap();
        let project_ids = metadata.project_ids.clone();
        drop(metadata);

        for project_id in &project_ids {
            let mut project_data = match self.load_project(project_id) {
                Ok(data) => data,
                Err(_) => continue,
            };

            let original_len = project_data.todos.len();
            project_data.todos.retain(|t| t.id != id);

            if project_data.todos.len() < original_len {
                self.save_project(&project_data)?;
                return Ok(true);
            }
        }

        Ok(false)
    }

    /// Reorder todos within a project
    pub fn reorder_todos(&self, project_id: &str, todo_ids: Vec<String>) -> Result<(), String> {
        let mut project_data = self.load_project(project_id)?;
        let timestamp = Self::now();

        for (index, id) in todo_ids.iter().enumerate() {
            if let Some(todo) = project_data.todos.iter_mut().find(|t| &t.id == id) {
                todo.order = index as i32;
                todo.updated_at = timestamp.clone();
            }
        }

        // Sort todos by order
        project_data.todos.sort_by_key(|t| t.order);

        self.save_project(&project_data)
    }

    /// Get todo progress for a project
    pub fn get_todo_progress(&self, project_id: &str) -> Result<TodoProgress, String> {
        let project_data = self.load_project(project_id)?;

        let total = project_data.todos.len() as i32;
        let completed = project_data.todos.iter().filter(|t| t.completed).count() as i32;
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

    // ==================== Export/Import ====================

    /// Export all data
    pub fn export_all_data(&self, project_ids: Option<Vec<String>>) -> Result<ExportData, String> {
        let metadata = self.metadata.read().unwrap();
        let ids_to_export = project_ids.unwrap_or_else(|| metadata.project_ids.clone());
        drop(metadata);

        let mut projects = Vec::new();
        let mut items = Vec::new();
        let mut file_cards = Vec::new();

        for id in &ids_to_export {
            if let Ok(project_data) = self.load_project(id) {
                // Convert to ProjectRow format
                let metadata_json =
                    serde_json::to_string(&project_data.metadata).unwrap_or_else(|_| "{}".into());

                projects.push(ProjectRow {
                    id: project_data.id.clone(),
                    name: project_data.name.clone(),
                    description: project_data.description.clone(),
                    metadata: metadata_json,
                    created_at: project_data.created_at.clone(),
                    updated_at: project_data.updated_at.clone(),
                });

                items.extend(project_data.items);

                // Convert FileCard to FileCardRow
                for card in project_data.file_cards {
                    file_cards.push(FileCardRow {
                        id: card.id,
                        project_id: card.project_id,
                        filename: card.filename,
                        file_path: card.file_path,
                        position_x: card.position_x,
                        position_y: card.position_y,
                        is_expanded: if card.is_expanded { 1 } else { 0 },
                        is_minimized: if card.is_minimized { 1 } else { 0 },
                        z_index: card.z_index,
                        created_at: card.created_at,
                        updated_at: card.updated_at,
                    });
                }
            }
        }

        Ok(ExportData {
            version: "1.0".to_string(),
            exported_at: Self::now(),
            projects,
            items,
            file_cards: Some(file_cards),
        })
    }

    /// Import data
    pub fn import_data(&self, data: ImportData, mode: &str) -> Result<ImportResult, String> {
        let mut projects_imported = 0;
        let mut items_imported = 0;
        let mut file_cards_imported = 0;
        let mut skipped = 0;

        if mode == "replace" {
            // Delete all existing projects
            let metadata = self.metadata.read().unwrap();
            let existing_ids = metadata.project_ids.clone();
            drop(metadata);

            for id in existing_ids {
                self.delete_project(&id)?;
            }
        }

        // Import projects
        for project_row in &data.projects {
            // Check if project already exists
            {
                let metadata = self.metadata.read().unwrap();
                if metadata.project_ids.contains(&project_row.id) {
                    skipped += 1;
                    continue;
                }
            }

            let project_metadata: ProjectMetadata =
                serde_json::from_str(&project_row.metadata).unwrap_or_default();

            // Gather items for this project
            let project_items: Vec<Item> = data
                .items
                .iter()
                .filter(|i| i.project_id == project_row.id)
                .cloned()
                .collect();

            items_imported += project_items.len() as i32;

            // Gather file cards for this project
            let project_file_cards: Vec<FileCard> = data
                .file_cards
                .as_ref()
                .map(|cards| {
                    cards
                        .iter()
                        .filter(|c| c.project_id == project_row.id)
                        .map(|c| FileCard {
                            id: c.id.clone(),
                            project_id: c.project_id.clone(),
                            filename: c.filename.clone(),
                            file_path: c.file_path.clone(),
                            position_x: c.position_x,
                            position_y: c.position_y,
                            is_expanded: c.is_expanded == 1,
                            is_minimized: c.is_minimized == 1,
                            z_index: c.z_index,
                            created_at: c.created_at.clone(),
                            updated_at: c.updated_at.clone(),
                        })
                        .collect()
                })
                .unwrap_or_default();

            file_cards_imported += project_file_cards.len() as i32;

            let project_data = ProjectData {
                id: project_row.id.clone(),
                name: project_row.name.clone(),
                description: project_row.description.clone(),
                metadata: project_metadata,
                items: project_items,
                todos: Vec::new(), // Import doesn't include todos currently
                file_cards: project_file_cards,
                created_at: project_row.created_at.clone(),
                updated_at: project_row.updated_at.clone(),
            };

            // Save project file
            self.save_project(&project_data)?;

            // Update metadata
            {
                let mut meta = self.metadata.write().unwrap();
                meta.project_ids.push(project_row.id.clone());
            }

            projects_imported += 1;
        }

        self.save_metadata()?;

        Ok(ImportResult {
            projects_imported,
            items_imported,
            file_cards_imported,
            skipped,
        })
    }

    /// Clear project cache (useful after external changes)
    pub fn clear_cache(&self) {
        self.projects_cache.write().unwrap().clear();
    }

    /// Reload all data from disk (metadata + clear cache)
    pub fn reload(&self) -> Result<(), String> {
        // Clear project cache
        self.clear_cache();
        // Reload metadata
        self.reload_metadata()
    }

    /// Reload metadata from disk
    pub fn reload_metadata(&self) -> Result<(), String> {
        let path = self.data_path.join("metadata.json");
        if path.exists() {
            let content = fs::read_to_string(&path)
                .map_err(|e| format!("Failed to read metadata.json: {}", e))?;
            let metadata: Metadata = serde_json::from_str(&content)
                .map_err(|e| format!("Failed to parse metadata.json: {}", e))?;
            *self.metadata.write().unwrap() = metadata;

            // Update last known mtime
            let mtime = fs::metadata(&path).ok().and_then(|m| m.modified().ok());
            *self.last_metadata_mtime.write().unwrap() = mtime;
        } else {
            // File was deleted - reset to empty state and create empty metadata file
            let empty_metadata = Metadata::default();
            *self.metadata.write().unwrap() = empty_metadata.clone();

            // Create the empty metadata.json file
            Self::write_json_atomic(&path, &empty_metadata)?;

            // Update mtime after creating the file
            let mtime = fs::metadata(&path).ok().and_then(|m| m.modified().ok());
            *self.last_metadata_mtime.write().unwrap() = mtime;
        }
        Ok(())
    }

    /// Check if data has been modified externally (e.g., by OneDrive sync)
    /// Returns true if files have changed since we last loaded them
    pub fn has_external_changes(&self) -> bool {
        let path = self.data_path.join("metadata.json");
        let current_mtime = fs::metadata(&path).ok().and_then(|m| m.modified().ok());
        let last_mtime = *self.last_metadata_mtime.read().unwrap();

        match (current_mtime, last_mtime) {
            // File mtime changed (newer OR older due to sync)
            (Some(current), Some(last)) => current != last,
            // File exists now but didn't before
            (Some(_), None) => true,
            // File was deleted but we had it before
            (None, Some(_)) => true,
            // Both None - no change
            (None, None) => false,
        }
    }
}
