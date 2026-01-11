/**
 * Application Configuration
 *
 * This file contains site-wide configuration settings.
 * When you're ready to support multiple groups, you can remove DEFAULT_GROUP_SLUG
 * and implement multi-group logic.
 */

/**
 * Default group slug to use for single-group mode
 * Change this to match your primary group's slug in the database
 */
export const DEFAULT_GROUP_SLUG = 'bucknuts';

/**
 * Site name - shown in navigation bar
 * You can also make this dynamic based on the group
 */
export const SITE_NAME = 'Bucknuts Predictions';

/**
 * Enable multi-group mode
 * When true, users can belong to multiple groups and see a groups list
 * When false, redirects to the default group
 */
export const MULTI_GROUP_MODE = false;
