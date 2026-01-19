use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

/// Application settings stored in ~/.devora/settings.json
/// These settings are read before storage initialization
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AppSettings {
    /// Custom data directory path. If None, uses default ~/.devora/
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data_path: Option<String>,

    /// Legacy field for backward compatibility - will be migrated to data_path
    #[serde(skip_serializing_if = "Option::is_none")]
    pub database_path: Option<String>,
}

/// Manages the settings.json file
pub struct SettingsFile {
    path: PathBuf,
    settings: Mutex<AppSettings>,
}

impl SettingsFile {
    /// Create a new SettingsFile manager
    pub fn new(config_dir: PathBuf) -> Self {
        let path = config_dir.join("settings.json");
        let mut settings = Self::load_from_path(&path);

        // Migrate database_path to data_path if needed
        if settings.data_path.is_none() && settings.database_path.is_some() {
            settings.data_path = settings.database_path.clone();
            settings.database_path = None;
            // Save the migrated settings
            let _ = Self::save_to_path(&path, &settings);
        }

        Self {
            path,
            settings: Mutex::new(settings),
        }
    }

    /// Load settings from file path
    fn load_from_path(path: &Path) -> AppSettings {
        if path.exists() {
            fs::read_to_string(path)
                .ok()
                .and_then(|content| serde_json::from_str(&content).ok())
                .unwrap_or_default()
        } else {
            AppSettings::default()
        }
    }

    /// Save settings to a specific path
    fn save_to_path(path: &Path, settings: &AppSettings) -> Result<(), String> {
        let content = serde_json::to_string_pretty(settings)
            .map_err(|e| format!("Failed to serialize settings: {}", e))?;
        fs::write(path, content).map_err(|e| format!("Failed to write settings: {}", e))?;
        Ok(())
    }

    /// Save settings to file
    pub fn save(&self, settings: &AppSettings) -> Result<(), String> {
        Self::save_to_path(&self.path, settings)?;
        *self.settings.lock().unwrap() = settings.clone();
        Ok(())
    }

    /// Get the data path, falling back to default if not set
    pub fn get_data_path(&self, default_dir: &Path) -> PathBuf {
        let settings = self.settings.lock().unwrap();
        settings
            .data_path
            .as_ref()
            .map(PathBuf::from)
            .unwrap_or_else(|| default_dir.to_path_buf())
    }

    /// Set the data path
    pub fn set_data_path(&self, path: Option<String>) -> Result<(), String> {
        let mut settings = self.settings.lock().unwrap().clone();
        settings.data_path = path;
        settings.database_path = None; // Clear legacy field
        drop(self.settings.lock());
        self.save(&settings)
    }

    // Legacy methods for backward compatibility

    /// Get the database path (legacy - use get_data_path instead)
    #[allow(dead_code)]
    pub fn get_database_path(&self, default_dir: &Path) -> PathBuf {
        self.get_data_path(default_dir)
    }

    /// Set the database path (legacy - use set_data_path instead)
    #[allow(dead_code)]
    pub fn set_database_path(&self, path: Option<String>) -> Result<(), String> {
        self.set_data_path(path)
    }
}
