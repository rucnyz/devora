/**
 * Devora Color System
 *
 * A minimalist, unified color palette for the Neo-Terminal aesthetic.
 * All colors are defined here for easy customization.
 *
 * The system uses 4 semantic accent colors:
 * - Primary (green): IDE, primary actions, success states
 * - Secondary (cyan): Links, external references
 * - Tertiary (amber): Notes, warnings, attention
 * - Remote (magenta): Remote IDE, SSH connections
 *
 * Each color has:
 * - base: The main color value
 * - dim: A darker variant for hover states
 * - rgb: RGB values for rgba() usage
 */

// ===========================================
// SEMANTIC COLOR DEFINITIONS
// ===========================================

export const semanticColors = {
  // Primary - Used for IDE shortcuts, primary actions, success states
  primary: {
    dark: {
      base: '#00ff88', // Bright terminal green
      dim: '#00cc6a', // Darker green for hover
      rgb: '0, 255, 136', // For rgba() backgrounds
    },
    light: {
      base: '#059669', // Emerald green
      dim: '#047857', // Darker emerald
      rgb: '5, 150, 105',
    },
  },

  // Secondary - Used for links, external references
  secondary: {
    dark: {
      base: '#00d4ff', // Cyan
      dim: '#00a8cc',
      rgb: '0, 212, 255',
    },
    light: {
      base: '#0891b2', // Teal
      dim: '#0e7490',
      rgb: '8, 145, 178',
    },
  },

  // Tertiary - Used for notes, warnings, commands
  tertiary: {
    dark: {
      base: '#ffaa00', // Amber/Orange
      dim: '#e69500',
      rgb: '255, 170, 0',
    },
    light: {
      base: '#d97706', // Amber
      dim: '#b45309',
      rgb: '217, 119, 6',
    },
  },

  // Remote - Used for remote IDE, SSH connections
  remote: {
    dark: {
      base: '#e879f9', // Fuchsia/Magenta
      dim: '#d946ef',
      rgb: '232, 121, 249',
    },
    light: {
      base: '#c026d3', // Fuchsia
      dim: '#a21caf',
      rgb: '192, 38, 211',
    },
  },

  // Danger - Used for delete actions, errors
  danger: {
    dark: {
      base: '#ff4757',
      dim: '#e63946',
      rgb: '255, 71, 87',
    },
    light: {
      base: '#dc2626',
      dim: '#b91c1c',
      rgb: '220, 38, 38',
    },
  },
} as const

// ===========================================
// SECTION COLOR MAPPING
// Maps app sections to semantic colors
// ===========================================

export type SectionType =
  | 'ide'
  | 'remote-ide'
  | 'links'
  | 'notes'
  | 'files'
  | 'commands'
  | 'working-dirs-local'
  | 'working-dirs-remote'

export const sectionColors: Record<SectionType, keyof typeof semanticColors> = {
  ide: 'primary',
  'remote-ide': 'remote',
  links: 'secondary',
  notes: 'tertiary',
  files: 'primary', // Uses primary but with lower opacity
  commands: 'tertiary',
  'working-dirs-local': 'primary',
  'working-dirs-remote': 'remote',
}

// ===========================================
// CSS VARIABLE HELPERS
// Generate CSS variable references
// ===========================================

/**
 * Get the CSS variable for a semantic color
 * Usage: getCssVar('primary') => 'var(--color-primary)'
 */
export function getCssVar(color: keyof typeof semanticColors): string {
  const mapping: Record<string, string> = {
    primary: 'var(--accent-primary)',
    secondary: 'var(--accent-secondary)',
    tertiary: 'var(--accent-warning)',
    remote: 'var(--accent-remote)',
    danger: 'var(--accent-danger)',
  }
  return mapping[color] || 'var(--text-secondary)'
}

/**
 * Get section color as CSS variable
 */
export function getSectionColor(section: SectionType): string {
  return getCssVar(sectionColors[section])
}

// ===========================================
// NAVIGATION COLORS
// Colors for the side navigation dots
// ===========================================

export const navColors = {
  ide: 'var(--accent-primary)',
  'remote-ide': 'var(--accent-remote)',
  links: 'var(--accent-secondary)',
  notes: 'var(--accent-warning)',
  files: 'var(--text-secondary)',
  commands: 'var(--accent-warning)',
} as const

// ===========================================
// TAG CLASS MAPPING
// For tag components styling
// ===========================================

export const tagClasses = {
  // IDE types - all use primary color now (simpler)
  ide: 'tag-ide',

  // Remote IDE types - all use remote color
  'remote-ide': 'tag-remote-ide',

  // Other types
  url: 'tag-url',
  file: 'tag-file',
  command: 'tag-command',
  app: 'tag-app',
} as const
