import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = process.env.CONTINUITY_DB_PATH || path.resolve(__dirname, '../../continuity.db');

export function initDatabase(dbPath = DB_PATH): Database.Database {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Load and execute schema
  const schemaPath = path.resolve(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schemaSql);

  // Migrate canvas columns if not existing
  try { db.exec('ALTER TABLE notes ADD COLUMN position_x REAL DEFAULT 100'); } catch (e) {}
  try { db.exec('ALTER TABLE notes ADD COLUMN position_y REAL DEFAULT 100'); } catch (e) {}
  try { db.exec('ALTER TABLE notes ADD COLUMN color TEXT DEFAULT "amber"'); } catch (e) {}

  // Setup FTS triggers to ensure synchronization
  setupFtsTriggers(db);

  return db;
}

function setupFtsTriggers(db: Database.Database) {
  // Memories FTS triggers
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS memories_after_insert AFTER INSERT ON memories BEGIN
      INSERT INTO memories_fts(id, content, memory_type) VALUES (new.id, new.content, new.memory_type);
    END;

    CREATE TRIGGER IF NOT EXISTS memories_after_delete AFTER DELETE ON memories BEGIN
      DELETE FROM memories_fts WHERE id = old.id;
    END;

    CREATE TRIGGER IF NOT EXISTS memories_after_update AFTER UPDATE ON memories BEGIN
      DELETE FROM memories_fts WHERE id = old.id;
      INSERT INTO memories_fts(id, content, memory_type) VALUES (new.id, new.content, new.memory_type);
    END;

    CREATE TRIGGER IF NOT EXISTS notes_after_insert AFTER INSERT ON notes BEGIN
      INSERT INTO notes_fts(id, title, content) VALUES (new.id, new.title, new.content);
    END;

    CREATE TRIGGER IF NOT EXISTS notes_after_delete AFTER DELETE ON notes BEGIN
      DELETE FROM notes_fts WHERE id = old.id;
    END;

    CREATE TRIGGER IF NOT EXISTS notes_after_update AFTER UPDATE ON notes BEGIN
      DELETE FROM notes_fts WHERE id = old.id;
      INSERT INTO notes_fts(id, title, content) VALUES (new.id, new.title, new.content);
    END;
  `);
}

// Singleton database instance
let instance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!instance) {
    instance = initDatabase();
  }
  return instance;
}

export function closeDb(): void {
  if (instance) {
    instance.close();
    instance = null;
  }
}
