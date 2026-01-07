/**
 * Application configuration
 */

import { join } from 'path'

/** Application root directory */
export const APP_DIR = process.cwd()

/** Directory for user data (database, etc.) */
export const DATA_DIR = join(APP_DIR, 'data')

/** Directory for frontend static files */
export const DIST_DIR = join(APP_DIR, 'dist')

/** Current application version */
export const APP_VERSION = process.env.npm_package_version || 'dev'
