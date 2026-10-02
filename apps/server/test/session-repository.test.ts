import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { ServerConfig } from '../src/config.js';
import { initializeDatabase } from '../src/database.js';
import { SqliteSessionRepository } from '../src/session-repository.js';

function createTemporaryConfig(): ServerConfig {
  const dataDirectory = mkdtempSync(join(tmpdir(), 'pnp-engine-session-repository-'));

  return {
    host: '127.0.0.1',
    port: 0,
    dataDirectory,
    databasePath: join(dataDirectory, 'test.sqlite'),
  };
}

describe('SqliteSessionRepository', () => {
  it('persists sessions, active join codes and session-scoped players', () => {
    const config = createTemporaryConfig();
    const handle = initializeDatabase(config);
    const repository = new SqliteSessionRepository(handle.database);
    const createdAt = '2026-10-01T20:00:00.000Z';

    try {
      const session = repository.createSession({
        id: 'ravenhill',
        name: 'Das Geheimnis von Ravenhill',
        joinCode: '7HTK9Q',
        lobbyState: 'OPEN',
        createdAt,
      });
      repository.createPlayer({
        id: 'player-anna',
        sessionId: session.id,
        displayName: 'Anna',
        connectionState: 'OFFLINE',
        createdAt,
        deviceTokenHash: 'device-token-hash-anna',
      });
      repository.createPlayer({
        id: 'player-ben',
        sessionId: session.id,
        displayName: 'Ben',
        connectionState: 'CONNECTED',
        createdAt: '2026-10-01T20:01:00.000Z',
      });

      const persistedSession = {
        ...session,
        updatedAt: '2026-10-01T20:01:00.000Z',
      };

      expect(repository.findSessionById('ravenhill')).toEqual(persistedSession);
      expect(repository.findSessionByJoinCode('7HTK9Q')).toEqual(persistedSession);
      expect(repository.findActiveSessionCode('ravenhill')).toEqual({
        code: '7HTK9Q',
        sessionId: 'ravenhill',
        active: true,
        createdAt,
      });
      expect(repository.findPlayerByDeviceTokenHash('device-token-hash-anna')).toMatchObject({
        id: 'player-anna',
        sessionId: 'ravenhill',
      });
      expect(repository.listPlayers('ravenhill')).toEqual([
        {
          id: 'player-anna',
          sessionId: 'ravenhill',
          displayName: 'Anna',
          connectionState: 'OFFLINE',
          createdAt,
          updatedAt: createdAt,
        },
        {
          id: 'player-ben',
          sessionId: 'ravenhill',
          displayName: 'Ben',
          connectionState: 'CONNECTED',
          createdAt: '2026-10-01T20:01:00.000Z',
          updatedAt: '2026-10-01T20:01:00.000Z',
        },
      ]);
    } finally {
      handle.database.close();
      rmSync(config.dataDirectory, { recursive: true, force: true });
    }
  });

  it('keeps player names unique within one session without affecting another session', () => {
    const config = createTemporaryConfig();
    const handle = initializeDatabase(config);
    const repository = new SqliteSessionRepository(handle.database);
    const createdAt = '2026-10-01T20:00:00.000Z';

    try {
      repository.createSession({
        id: 'ravenhill',
        name: 'Ravenhill',
        joinCode: 'RAVEN1',
        lobbyState: 'OPEN',
        createdAt,
      });
      repository.createSession({
        id: 'lakeside',
        name: 'Lakeside',
        joinCode: 'LAKE01',
        lobbyState: 'CLOSED',
        createdAt,
      });
      repository.createPlayer({
        id: 'player-anna-ravenhill',
        sessionId: 'ravenhill',
        displayName: 'Anna',
        connectionState: 'OFFLINE',
        createdAt,
      });
      repository.createPlayer({
        id: 'player-anna-lakeside',
        sessionId: 'lakeside',
        displayName: 'Anna',
        connectionState: 'OFFLINE',
        createdAt,
      });

      expect(() =>
        repository.createPlayer({
          id: 'player-anna-duplicate',
          sessionId: 'ravenhill',
          displayName: 'anna',
          connectionState: 'OFFLINE',
          createdAt,
        }),
      ).toThrow();
      expect(repository.listPlayers('lakeside')).toHaveLength(1);
    } finally {
      handle.database.close();
      rmSync(config.dataDirectory, { recursive: true, force: true });
    }
  });

  it('rolls back a session when its join code is already assigned', () => {
    const config = createTemporaryConfig();
    const handle = initializeDatabase(config);
    const repository = new SqliteSessionRepository(handle.database);
    const createdAt = '2026-10-01T20:00:00.000Z';

    try {
      repository.createSession({
        id: 'ravenhill',
        name: 'Ravenhill',
        joinCode: 'RAVEN1',
        lobbyState: 'OPEN',
        createdAt,
      });

      expect(() =>
        repository.createSession({
          id: 'duplicate-code-session',
          name: 'Doppelt',
          joinCode: 'RAVEN1',
          lobbyState: 'CLOSED',
          createdAt,
        }),
      ).toThrow();
      expect(repository.findSessionById('duplicate-code-session')).toBeUndefined();
      expect(repository.findSessionByJoinCode('RAVEN1')?.id).toBe('ravenhill');
    } finally {
      handle.database.close();
      rmSync(config.dataDirectory, { recursive: true, force: true });
    }
  });
});
