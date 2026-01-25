import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';
import { DATABASE_URL } from '$env/static/private';

// Extract file path from DATABASE_URL (format: file:/path/to/db or file:./path/to/db)
const dbPath = DATABASE_URL.replace(/^file:/, '');
const sqlite = new Database(dbPath);
export const db = drizzle(sqlite, { schema });
