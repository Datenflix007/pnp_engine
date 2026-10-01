import { mkdirSync } from 'node:fs';

import Database from 'better-sqlite3';

import type { ServerConfig } from './config.js';

export interface Migration {
  readonly id: string;
  readonly apply: (database: Database.Database) => void;
}

export interface MigrationResult {
  readonly applied: readonly string[];
  readonly alreadyApplied: readonly string[];
}

export interface DatabaseHandle {
  readonly database: Database.Database;
  readonly migration: MigrationResult;
}

const migrations: readonly Migration[] = [
  {
    id: '001_bootstrap',
    apply: (database) => {
      database.exec(`
        CREATE TABLE engine_metadata (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT NOT NULL
        );
      `);
    },
  },
  {
    id: '002_sessions_players_and_codes',
    apply: (database) => {
      database.exec(`
        CREATE TABLE sessions (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          lobby_state TEXT NOT NULL CHECK (lobby_state IN ('CLOSED', 'OPEN')),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE session_codes (
          code TEXT PRIMARY KEY NOT NULL,
          session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
          active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
          created_at TEXT NOT NULL
        );

        CREATE UNIQUE INDEX active_session_code_per_session
          ON session_codes(session_id)
          WHERE active = 1;

        CREATE TABLE players (
          id TEXT PRIMARY KEY NOT NULL,
          session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
          display_name TEXT NOT NULL COLLATE NOCASE,
          connection_state TEXT NOT NULL CHECK (connection_state IN ('OFFLINE', 'CONNECTED', 'REMOVED')),
          character_id TEXT,
          role_id TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE (session_id, display_name)
        );

        CREATE INDEX players_by_session_id ON players(session_id);
      `);
    },
  },
];

/** Creates the local data directory, opens SQLite and applies pending migrations. */
export function initializeDatabase(
  config: Pick<ServerConfig, 'dataDirectory' | 'databasePath'>,
): DatabaseHandle {
  mkdirSync(config.dataDirectory, { recursive: true });

  const database = new Database(config.databasePath);

  try {
    database.pragma('journal_mode = WAL');
    database.pragma('foreign_keys = ON');

    return {
      database,
      migration: migrateDatabase(database),
    };
  } catch (error) {
    database.close();
    throw error;
  }
}

/** Applies each migration in its own SQLite transaction. */
export function migrateDatabase(database: Database.Database): MigrationResult {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const isApplied = database.prepare('SELECT 1 FROM schema_migrations WHERE id = ?');
  const insertMigration = database.prepare(
    'INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)',
  );
  const applyMigration = database.transaction((migration: Migration) => {
    migration.apply(database);
    insertMigration.run(migration.id, new Date().toISOString());
  });
  const applied: string[] = [];
  const alreadyApplied: string[] = [];

  for (const migration of migrations) {
    if (isApplied.get(migration.id) !== undefined) {
      alreadyApplied.push(migration.id);
      continue;
    }

    applyMigration(migration);
    applied.push(migration.id);
  }

  return { applied, alreadyApplied };
}
