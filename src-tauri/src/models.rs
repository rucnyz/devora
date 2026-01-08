use serde::{Deserialize, Serialize};
use strum::{Display, EnumString};

// Item types
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Display, EnumString)]
#[serde(rename_all = "kebab-case")]
#[strum(serialize_all = "kebab-case")]
pub enum ItemType {
    Note,
    Ide,
    File,
    Url,
    RemoteIde,
    Command,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Display, EnumString)]
#[serde(rename_all = "lowercase")]
#[strum(serialize_all = "lowercase")]
pub enum IdeType {
    // JetBrains IDEs
    Idea,
    Pycharm,
    Webstorm,
    Phpstorm,
    Rubymine,
    Clion,
    Goland,
    Rider,
    Datagrip,
    Rustrover,
    Aqua,
    // Other IDEs
    Cursor,
    Vscode,
    Zed,
    Antigravity,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Display, EnumString)]
#[serde(rename_all = "lowercase")]
#[strum(serialize_all = "lowercase")]
pub enum RemoteIdeType {
    Cursor,
    Vscode,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Display, EnumString)]
#[serde(rename_all = "lowercase")]
#[strum(serialize_all = "lowercase")]
pub enum CommandMode {
    Background,
    Output,
}

// Working directory
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkingDir {
    pub name: String,
    pub path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub host: Option<String>,
}

// Other link
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OtherLink {
    pub label: String,
    pub url: String,
}

// Project metadata
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ProjectMetadata {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub github_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub custom_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub other_links: Option<Vec<OtherLink>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub working_dirs: Option<Vec<WorkingDir>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub section_order: Option<Vec<String>>,
}

// Item
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Item {
    pub id: String,
    pub project_id: String,
    #[serde(rename = "type")]
    pub item_type: ItemType,
    pub title: String,
    pub content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ide_type: Option<String>,  // Changed to String to support custom IDE IDs
    #[serde(skip_serializing_if = "Option::is_none")]
    pub remote_ide_type: Option<String>,  // Changed to String to support custom remote IDE IDs
    #[serde(skip_serializing_if = "Option::is_none")]
    pub command_mode: Option<CommandMode>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub command_cwd: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub command_host: Option<String>,
    pub order: i32,
    pub created_at: String,
    pub updated_at: String,
}

// Project
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub description: String,
    pub metadata: ProjectMetadata,
    pub created_at: String,
    pub updated_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub items: Option<Vec<Item>>,
}

// File card
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileCard {
    pub id: String,
    pub project_id: String,
    pub filename: String,
    pub file_path: String,
    pub position_x: f64,
    pub position_y: f64,
    pub is_expanded: bool,
    pub is_minimized: bool,
    pub z_index: i32,
    pub created_at: String,
    pub updated_at: String,
}

// Export/Import data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportData {
    pub version: String,
    #[serde(rename = "exportedAt")]
    pub exported_at: String,
    pub projects: Vec<ProjectRow>,
    pub items: Vec<Item>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "fileCards")]
    pub file_cards: Option<Vec<FileCardRow>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportData {
    pub projects: Vec<ProjectRow>,
    pub items: Vec<Item>,
    #[serde(rename = "fileCards")]
    pub file_cards: Option<Vec<FileCardRow>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportResult {
    #[serde(rename = "projectsImported")]
    pub projects_imported: i32,
    #[serde(rename = "itemsImported")]
    pub items_imported: i32,
    #[serde(rename = "fileCardsImported")]
    pub file_cards_imported: i32,
    pub skipped: i32,
}

// Raw row types (metadata as JSON string)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectRow {
    pub id: String,
    pub name: String,
    pub description: String,
    pub metadata: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileCardRow {
    pub id: String,
    pub project_id: String,
    pub filename: String,
    pub file_path: String,
    pub position_x: f64,
    pub position_y: f64,
    pub is_expanded: i32,
    pub is_minimized: i32,
    pub z_index: i32,
    pub created_at: String,
    pub updated_at: String,
}

// Command execution result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandResult {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
}

// Directory listing entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DirEntry {
    pub name: String,
    pub is_dir: bool,
}

// Directory listing result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DirListing {
    pub current_path: String,
    pub entries: Vec<DirEntry>,
}

// Read file result for drag-drop
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReadFileResult {
    pub filename: String,
    pub content: String,
    pub file_size: u64,
}

// File info for virtual scrolling
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileInfo {
    pub filename: String,
    pub file_size: u64,
    pub line_count: usize,
}

// File lines result for virtual scrolling
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileLinesResult {
    pub lines: Vec<String>,
    pub start_line: usize,
}
