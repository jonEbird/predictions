import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';

// Use process.env at runtime instead of $env/static/private which is baked in at build time
const DATABASE_URL = process.env.DATABASE_URL || 'file:./predictions.db';

// Extract file path from DATABASE_URL (format: file:/path/to/db or file:./path/to/db)
const dbPath = DATABASE_URL.replace(/^file:/, '');
console.log(`🗄️  Database URL: ${DATABASE_URL}`);
console.log(`🗄️  Database path: ${dbPath}`);
const sqlite = new Database(dbPath);
console.log(`✅ Database connection established to: ${dbPath}`);
export const db = drizzle(sqlite, { schema });
