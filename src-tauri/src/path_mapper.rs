use crate::models::PathMapping;
use std::sync::RwLock;

pub struct PathMapper {
    mappings: RwLock<Vec<PathMapping>>,
}

impl PathMapper {
    pub fn new(mappings: Vec<PathMapping>) -> Self {
        Self {
            mappings: RwLock::new(mappings),
        }
    }

    /// Translate a path using configured mappings.
    /// On Windows: replaces Linux prefixes with Windows equivalents.
    /// On Linux: replaces Windows prefixes with Linux equivalents.
    /// Returns the path unchanged if no mapping matches.
    pub fn translate(&self, path: &str) -> String {
        if path.is_empty() {
            return path.to_string();
        }

        let mappings = self.mappings.read().unwrap();
        if mappings.is_empty() {
            return path.to_string();
        }

        // Sort by longest prefix first for most-specific match
        let mut sorted: Vec<&PathMapping> = mappings.iter().collect();

        #[cfg(windows)]
        {
            // On Windows, sort by Linux prefix length descending (we match Linux paths)
            sorted.sort_by(|a, b| b.linux.len().cmp(&a.linux.len()));

            for mapping in &sorted {
                if path.starts_with(&mapping.linux) {
                    let remainder = &path[mapping.linux.len()..];
                    let translated = format!("{}{}", mapping.windows, remainder);
                    return translated.replace('/', "\\");
                }
            }
        }

        #[cfg(not(windows))]
        {
            // On Linux, sort by Windows prefix length descending (we match Windows paths)
            sorted.sort_by(|a, b| b.windows.len().cmp(&a.windows.len()));

            for mapping in &sorted {
                // Case-insensitive prefix match for Windows paths (drive letters)
                let path_lower = path.to_lowercase();
                let prefix_lower = mapping.windows.to_lowercase();
                if path_lower.starts_with(&prefix_lower) {
                    let remainder = &path[mapping.windows.len()..];
                    let translated = format!("{}{}", mapping.linux, remainder);
                    return translated.replace('\\', "/");
                }
            }
        }

        path.to_string()
    }

    pub fn get_mappings(&self) -> Vec<PathMapping> {
        self.mappings.read().unwrap().clone()
    }

    pub fn set_mappings(&self, mappings: Vec<PathMapping>) {
        *self.mappings.write().unwrap() = mappings;
    }
}
