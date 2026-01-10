use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

/// Application settings stored in ~/.devora/settings.json
/// These settings are read before database initialization
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AppSettings {
    /// Custom database directory path. If None, uses default ~/.devora/
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
        let settings = Self::load_from_path(&path);
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

    /// Save settings to file
    pub fn save(&self, settings: &AppSettings) -> Result<(), String> {
        let content = serde_json::to_string_pretty(settings)
            .map_err(|e| format!("Failed to serialize settings: {}", e))?;
        fs::write(&self.path, content).map_err(|e| format!("Failed to write settings: {}", e))?;
        *self.settings.lock().unwrap() = settings.clone();
        Ok(())
    }

    /// Get the database path, falling back to default if not set
    pub fn get_database_path(&self, default_dir: &Path) -> PathBuf {
        let settings = self.settings.lock().unwrap();
        settings
            .database_path
            .as_ref()
            .map(PathBuf::from)
            .unwrap_or_else(|| default_dir.to_path_buf())
    }

    /// Set the database path
    pub fn set_database_path(&self, path: Option<String>) -> Result<(), String> {
        let mut settings = self.settings.lock().unwrap().clone();
        settings.database_path = path;
        drop(self.settings.lock());
        self.save(&settings)
    }
}
