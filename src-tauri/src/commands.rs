#![allow(non_snake_case)]

use crate::db::Database;
use crate::models::*;
use std::collections::HashMap;
use std::fs;
use std::process::Command;
use tauri::State;

// Projects
#[tauri::command]
pub fn get_projects(db: State<Database>) -> Result<Vec<Project>, String> {
    db.get_all_projects().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_project(id: String, db: State<Database>) -> Result<Option<Project>, String> {
    db.get_project_by_id(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_project(
    name: String,
    description: Option<String>,
    metadata: Option<ProjectMetadata>,
    db: State<Database>,
) -> Result<Project, String> {
    db.create_project(
        &name,
        &description.unwrap_or_default(),
        metadata.unwrap_or_default(),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_project(
    id: String,
    name: Option<String>,
    description: Option<String>,
    metadata: Option<ProjectMetadata>,
    db: State<Database>,
) -> Result<Option<Project>, String> {
    db.update_project(&id, name.as_deref(), description.as_deref(), metadata)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_project(id: String, db: State<Database>) -> Result<bool, String> {
    db.delete_project(&id).map_err(|e| e.to_string())
}

// Items
#[tauri::command]
pub fn create_item(
    projectId: String,
    itemType: ItemType,
    title: String,
    content: Option<String>,
    ideType: Option<IdeType>,
    remoteIdeType: Option<RemoteIdeType>,
    commandMode: Option<CommandMode>,
    commandCwd: Option<String>,
    commandHost: Option<String>,
    db: State<Database>,
) -> Result<Item, String> {
    db.create_item(
        &projectId,
        itemType,
        &title,
        &content.unwrap_or_default(),
        ideType,
        remoteIdeType,
        commandMode,
        commandCwd.as_deref(),
        commandHost.as_deref(),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_item(
    id: String,
    title: Option<String>,
    content: Option<String>,
    ideType: Option<Option<IdeType>>,
    remoteIdeType: Option<Option<RemoteIdeType>>,
    commandMode: Option<Option<CommandMode>>,
    commandCwd: Option<Option<String>>,
    commandHost: Option<Option<String>>,
    order: Option<i32>,
    db: State<Database>,
) -> Result<Option<Item>, String> {
    db.update_item(
        &id,
        title.as_deref(),
        content.as_deref(),
        ideType,
        remoteIdeType,
        commandMode,
        commandCwd.as_ref().map(|o| o.as_deref()),
        commandHost.as_ref().map(|o| o.as_deref()),
        order,
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_item(id: String, db: State<Database>) -> Result<bool, String> {
    db.delete_item(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn reorder_items(
    projectId: String,
    itemIds: Vec<String>,
    db: State<Database>,
) -> Result<(), String> {
    db.reorder_items(&projectId, itemIds)
        .map_err(|e| e.to_string())
}

// File Cards
#[tauri::command]
pub fn get_file_cards(projectId: String, db: State<Database>) -> Result<Vec<FileCard>, String> {
    db.get_file_cards_by_project(&projectId)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_file_card(
    projectId: String,
    filename: String,
    filePath: String,
    positionX: Option<f64>,
    positionY: Option<f64>,
    db: State<Database>,
) -> Result<FileCard, String> {
    db.create_file_card(
        &projectId,
        &filename,
        &filePath,
        positionX.unwrap_or(100.0),
        positionY.unwrap_or(100.0),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_file_card(
    id: String,
    filename: Option<String>,
    filePath: Option<String>,
    positionX: Option<f64>,
    positionY: Option<f64>,
    isExpanded: Option<bool>,
    isMinimized: Option<bool>,
    zIndex: Option<i32>,
    db: State<Database>,
) -> Result<Option<FileCard>, String> {
    db.update_file_card(
        &id,
        filename.as_deref(),
        filePath.as_deref(),
        positionX,
        positionY,
        isExpanded,
        isMinimized,
        zIndex,
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_file_card(id: String, db: State<Database>) -> Result<bool, String> {
    db.delete_file_card(&id).map_err(|e| e.to_string())
}

// Settings
#[tauri::command]
pub fn get_all_settings(db: State<Database>) -> Result<HashMap<String, String>, String> {
    db.get_all_settings().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_setting(key: String, db: State<Database>) -> Result<Option<String>, String> {
    db.get_setting(&key).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_setting(key: String, value: String, db: State<Database>) -> Result<(), String> {
    db.set_setting(&key, &value).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_setting(key: String, db: State<Database>) -> Result<(), String> {
    db.delete_setting(&key).map_err(|e| e.to_string())
}

// Export/Import
#[tauri::command]
pub fn export_data(
    projectIds: Option<Vec<String>>,
    db: State<Database>,
) -> Result<ExportData, String> {
    db.export_all_data(projectIds).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn export_data_to_file(
    filePath: String,
    projectIds: Option<Vec<String>>,
    db: State<Database>,
) -> Result<usize, String> {
    let data = db.export_all_data(projectIds).map_err(|e| e.to_string())?;
    let json = serde_json::to_string_pretty(&data)
        .map_err(|e| format!("Failed to serialize data: {}", e))?;
    let count = data.projects.len();
    fs::write(&filePath, &json)
        .map_err(|e| format!("Failed to write file: {}", e))?;
    Ok(count)
}

#[tauri::command]
pub fn import_data(
    data: ImportData,
    mode: Option<String>,
    db: State<Database>,
) -> Result<ImportResult, String> {
    db.import_data(data, &mode.unwrap_or_else(|| "merge".to_string()))
        .map_err(|e| e.to_string())
}

// System operations
#[tauri::command]
pub fn open_ide(ideType: IdeType, path: String) -> Result<(), String> {
    let cmd = match ideType {
        IdeType::Pycharm => "pycharm",
        IdeType::Cursor => "cursor",
        IdeType::Vscode => "code",
        IdeType::Zed => "zed",
        IdeType::Antigravity => "antigravity",
    };

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        const CREATE_NEW_PROCESS_GROUP: u32 = 0x00000200;

        // Use cmd /c to run .cmd files, hide console and detach from parent
        Command::new("cmd")
            .args(["/c", cmd, &path])
            .creation_flags(CREATE_NO_WINDOW | CREATE_NEW_PROCESS_GROUP)
            .spawn()
            .map_err(|e| format!("Failed to open IDE: {}", e))?;
    }

    #[cfg(not(windows))]
    {
        Command::new(cmd)
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open IDE: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
pub fn open_remote_ide(
    remoteIdeType: RemoteIdeType,
    host: String,
    path: String,
) -> Result<(), String> {
    let cmd = match remoteIdeType {
        RemoteIdeType::Cursor => "cursor",
        RemoteIdeType::Vscode => "code",
    };

    let folder_uri = format!("vscode-remote://ssh-remote+{}{}", host, path);

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        const CREATE_NEW_PROCESS_GROUP: u32 = 0x00000200;

        // Use cmd /c to run .cmd files, hide console and detach from parent
        Command::new("cmd")
            .args(["/c", cmd, "--folder-uri", &folder_uri])
            .creation_flags(CREATE_NO_WINDOW | CREATE_NEW_PROCESS_GROUP)
            .spawn()
            .map_err(|e| format!("Failed to open remote IDE: {}", e))?;
    }

    #[cfg(not(windows))]
    {
        Command::new(cmd)
            .args(["--folder-uri", &folder_uri])
            .spawn()
            .map_err(|e| format!("Failed to open remote IDE: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
pub fn get_ssh_hosts() -> Result<Vec<String>, String> {
    let home = dirs::home_dir().ok_or("Could not find home directory")?;
    let ssh_config_path = home.join(".ssh").join("config");

    if !ssh_config_path.exists() {
        return Ok(vec![]);
    }

    let content = fs::read_to_string(&ssh_config_path)
        .map_err(|e| format!("Failed to read SSH config: {}", e))?;

    let mut hosts = vec![];
    for line in content.lines() {
        let line = line.trim();
        if line.to_lowercase().starts_with("host ") {
            let host = line[5..].trim();
            // Skip patterns with wildcards
            if !host.contains('*') && !host.contains('?') {
                hosts.push(host.to_string());
            }
        }
    }

    Ok(hosts)
}

#[tauri::command]
pub async fn list_remote_dir(host: String, path: Option<String>) -> Result<DirListing, String> {
    let target_path = path.unwrap_or_else(|| "~".to_string());
    let cmd = format!("cd {} && pwd && ls -1F", target_path);

    // On Unix, use ControlMaster to reuse authenticated connection
    // On Windows, ControlMaster is not supported (no Unix domain sockets)
    #[cfg(not(windows))]
    let output = {
        let socket_dir = dirs::home_dir()
            .map(|h| h.join(".ssh").join("sockets"))
            .unwrap_or_else(|| std::path::PathBuf::from("."));
        let socket_path = socket_dir.join("devora-%r@%h-%p");
        let socket_path_str = socket_path.to_string_lossy().to_string();

        tokio::process::Command::new("ssh")
            .args([
                "-o", "ControlMaster=auto",
                "-o", &format!("ControlPath={}", socket_path_str),
                "-o", "ControlPersist=600",
                &host,
                &cmd,
            ])
            .output()
            .await
            .map_err(|e| format!("Failed to execute SSH command: {}", e))?
    };

    #[cfg(windows)]
    let output = {
        const CREATE_NO_WINDOW: u32 = 0x08000000;

        tokio::process::Command::new("ssh")
            .args([&host, &cmd])
            .creation_flags(CREATE_NO_WINDOW)
            .output()
            .await
            .map_err(|e| format!("Failed to execute SSH command: {}", e))?
    };

    if !output.status.success() {
        return Err(format!(
            "SSH command failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut lines = stdout.lines();

    let current_path = lines.next().unwrap_or("~").to_string();

    let entries: Vec<DirEntry> = lines
        .filter(|line| !line.is_empty() && !line.starts_with('.'))
        .map(|line| {
            let is_dir = line.ends_with('/');
            let name = if is_dir {
                line.trim_end_matches('/').to_string()
            } else {
                line.trim_end_matches('@').trim_end_matches('*').to_string()
            };
            DirEntry { name, is_dir }
        })
        .collect();

    Ok(DirListing {
        current_path,
        entries,
    })
}

#[tauri::command]
pub async fn run_command(
    command: String,
    mode: CommandMode,
    cwd: Option<String>,
    host: Option<String>,
) -> Result<CommandResult, String> {
    let is_background = matches!(mode, CommandMode::Background);

    if let Some(remote_host) = host {
        // Remote command via SSH (async to avoid blocking UI)
        let ssh_cmd = if let Some(dir) = cwd {
            format!("cd {} && {}", dir, command)
        } else {
            command.clone()
        };

        let full_cmd = if is_background {
            format!("nohup {} > /dev/null 2>&1 &", ssh_cmd)
        } else {
            ssh_cmd
        };

        #[cfg(windows)]
        let output = {
            const CREATE_NO_WINDOW: u32 = 0x08000000;

            tokio::process::Command::new("ssh")
                .args([&remote_host, &full_cmd])
                .creation_flags(CREATE_NO_WINDOW)
                .output()
                .await
                .map_err(|e| format!("Failed to execute SSH command: {}", e))?
        };

        #[cfg(not(windows))]
        let output = tokio::process::Command::new("ssh")
            .args([&remote_host, &full_cmd])
            .output()
            .await
            .map_err(|e| format!("Failed to execute SSH command: {}", e))?;

        Ok(CommandResult {
            stdout: String::from_utf8_lossy(&output.stdout).to_string(),
            stderr: String::from_utf8_lossy(&output.stderr).to_string(),
            exit_code: output.status.code().unwrap_or(-1),
        })
    } else {
        // Local command (keep sync for simplicity, local commands are fast)
        if is_background {
            if cfg!(windows) {
                Command::new("cmd")
                    .args(["/C", "start", "/B", &command])
                    .current_dir(cwd.unwrap_or_else(|| ".".to_string()))
                    .spawn()
                    .map_err(|e| format!("Failed to spawn background command: {}", e))?;
            } else {
                Command::new("sh")
                    .args(["-c", &format!("nohup {} > /dev/null 2>&1 &", command)])
                    .current_dir(cwd.unwrap_or_else(|| ".".to_string()))
                    .spawn()
                    .map_err(|e| format!("Failed to spawn background command: {}", e))?;
            }

            Ok(CommandResult {
                stdout: String::new(),
                stderr: String::new(),
                exit_code: 0,
            })
        } else {
            let output = if cfg!(windows) {
                Command::new("cmd")
                    .args(["/C", &command])
                    .current_dir(cwd.unwrap_or_else(|| ".".to_string()))
                    .output()
                    .map_err(|e| format!("Failed to execute command: {}", e))?
            } else {
                Command::new("sh")
                    .args(["-c", &command])
                    .current_dir(cwd.unwrap_or_else(|| ".".to_string()))
                    .output()
                    .map_err(|e| format!("Failed to execute command: {}", e))?
            };

            Ok(CommandResult {
                stdout: String::from_utf8_lossy(&output.stdout).to_string(),
                stderr: String::from_utf8_lossy(&output.stderr).to_string(),
                exit_code: output.status.code().unwrap_or(-1),
            })
        }
    }
}

// File reading for drag-drop
#[tauri::command]
pub async fn read_file_content(
    path: String,
    max_size: Option<u64>,
    offset: Option<u64>,
    length: Option<u64>,
) -> Result<ReadFileResult, String> {
    use tokio::io::{AsyncReadExt, AsyncSeekExt};

    let metadata = tokio::fs::metadata(&path)
        .await
        .map_err(|e| format!("Failed to read file metadata: {}", e))?;

    let file_size = metadata.len();

    // Absolute max file size for safety (500MB)
    const ABSOLUTE_MAX: u64 = 500 * 1024 * 1024;
    if file_size > ABSOLUTE_MAX {
        return Err(format!(
            "File too large ({} bytes). Max: {} bytes",
            file_size,
            ABSOLUTE_MAX
        ));
    }

    let content = if let (Some(offset_val), Some(length_val)) = (offset, length) {
        // Chunk reading mode for virtual scrolling
        let mut file = tokio::fs::File::open(&path)
            .await
            .map_err(|e| format!("Failed to open file: {}", e))?;

        // Seek to offset
        file.seek(tokio::io::SeekFrom::Start(offset_val))
            .await
            .map_err(|e| format!("Failed to seek file: {}", e))?;

        // Read chunk
        let bytes_to_read = length_val.min(file_size.saturating_sub(offset_val));
        let mut buffer = vec![0; bytes_to_read as usize];
        let bytes_read = file.read(&mut buffer)
            .await
            .map_err(|e| format!("Failed to read file: {}", e))?;

        buffer.truncate(bytes_read);
        String::from_utf8(buffer)
            .map_err(|e| format!("Failed to decode file as UTF-8: {}", e))?
    } else {
        // Legacy mode: read entire file or first max_size bytes
        let max_size = max_size.unwrap_or(10 * 1024 * 1024); // Default 10MB

        if file_size <= max_size {
            // File is small enough, read entire file
            tokio::fs::read_to_string(&path)
                .await
                .map_err(|e| format!("Failed to read file: {}", e))?
        } else {
            // File is larger than max_size, read only first max_size bytes
            let mut file = tokio::fs::File::open(&path)
                .await
                .map_err(|e| format!("Failed to open file: {}", e))?;

            let mut buffer = vec![0; max_size as usize];
            let bytes_read = file.read(&mut buffer)
                .await
                .map_err(|e| format!("Failed to read file: {}", e))?;

            buffer.truncate(bytes_read);
            String::from_utf8(buffer)
                .map_err(|e| format!("Failed to decode file as UTF-8: {}", e))?
        }
    };

    // Extract filename from path
    let filename = std::path::Path::new(&path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();

    Ok(ReadFileResult {
        filename,
        content,
        file_size,
    })
}

// Get file info for virtual scrolling
#[tauri::command]
pub async fn get_file_info(path: String) -> Result<FileInfo, String> {
    let metadata = tokio::fs::metadata(&path)
        .await
        .map_err(|e| format!("Failed to read file metadata: {}", e))?;

    let file_size = metadata.len();

    // Absolute max file size for safety (500MB)
    const ABSOLUTE_MAX: u64 = 500 * 1024 * 1024;
    if file_size > ABSOLUTE_MAX {
        return Err(format!(
            "File too large ({} bytes). Max: {} bytes",
            file_size,
            ABSOLUTE_MAX
        ));
    }

    // Read file and count lines
    let content = tokio::fs::read_to_string(&path)
        .await
        .map_err(|e| format!("Failed to read file: {}", e))?;

    let line_count = content.lines().count();

    // Extract filename from path
    let filename = std::path::Path::new(&path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();

    Ok(FileInfo {
        filename,
        file_size,
        line_count,
    })
}

// Read specific lines from file for virtual scrolling
// Simple implementation: read entire file, then slice
// Trade memory for speed - works well for files up to 500MB
#[tauri::command]
pub async fn read_file_lines(
    path: String,
    start_line: usize,
    count: usize,
) -> Result<FileLinesResult, String> {
    let content = tokio::fs::read_to_string(&path)
        .await
        .map_err(|e| format!("Failed to read file: {}", e))?;

    let all_lines: Vec<&str> = content.lines().collect();

    if start_line >= all_lines.len() {
        return Ok(FileLinesResult {
            lines: vec![],
            start_line,
        });
    }

    let end_line = (start_line + count).min(all_lines.len());
    let result_lines: Vec<String> = all_lines[start_line..end_line]
        .iter()
        .map(|&s| s.to_string())
        .collect();

    Ok(FileLinesResult {
        lines: result_lines,
        start_line,
    })
}

