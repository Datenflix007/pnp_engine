import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { ServerConfig } from '../src/config.js';
import { initializeDatabase, migrateDatabase } from '../src/database.js';

function createTemporaryConfig(): ServerConfig {
  const dataDirectory = mkdtempSync(join(tmpdir(), 'pnp-engine-'));

  return {
    host: '127.0.0.1',
    port: 0,
    dataDirectory,
    databasePath: join(dataDirectory, 'test.sqlite'),
  };
}

describe('SQLite database', () => {
  it('creates the database in the configured data directory and applies migrations once', () => {
    const config = createTemporaryConfig();
    const handle = initializeDatabase(config);

    try {
      expect(existsSync(config.databasePath)).toBe(true);
      expect(handle.migration).toEqual({
        applied: ['001_bootstrap', '002_sessions_players_and_codes', '003_player_device_tokens'],
        alreadyApplied: [],
      });
      expect(
        handle.database
          .prepare(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'engine_metadata'",
          )
          .get(),
      ).toEqual({ name: 'engine_metadata' });
      expect(
        handle.database
          .prepare("SELECT name FROM pragma_table_info('players') WHERE name = 'device_token_hash'")
          .get(),
      ).toEqual({ name: 'device_token_hash' });
      expect(migrateDatabase(handle.database)).toEqual({
        applied: [],
        alreadyApplied: [
          '001_bootstrap',
          '002_sessions_players_and_codes',
          '003_player_device_tokens',
        ],
      });
    } finally {
      handle.database.close();
      rmSync(config.dataDirectory, { recursive: true, force: true });
    }
  });

  it('enforces the foreign-key constraints supplied by the session migration', () => {
    const config = createTemporaryConfig();
    const handle = initializeDatabase(config);

    try {
      expect(handle.database.pragma('foreign_keys', { simple: true })).toBe(1);
      expect(() =>
        handle.database
          .prepare(
            `
              INSERT INTO players (
                id, session_id, display_name, connection_state, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?)
            `,
          )
          .run(
            'orphan-player',
            'missing-session',
            'Anna',
            'OFFLINE',
            '2026-10-02T09:00:00.000Z',
            '2026-10-02T09:00:00.000Z',
          ),
      ).toThrow(/FOREIGN KEY constraint failed/);
    } finally {
      handle.database.close();
      rmSync(config.dataDirectory, { recursive: true, force: true });
    }
  });
});
