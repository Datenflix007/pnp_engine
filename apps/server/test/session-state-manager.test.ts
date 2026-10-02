import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { ServerConfig } from '../src/config.js';
import { initializeDatabase } from '../src/database.js';
import { SqliteSessionRepository } from '../src/session-repository.js';
import { SessionStateError, SessionStateManager } from '../src/session-state-manager.js';

function createTemporaryConfig(): ServerConfig {
  const dataDirectory = mkdtempSync(join(tmpdir(), 'pnp-engine-session-state-'));

  return {
    host: '127.0.0.1',
    port: 0,
    dataDirectory,
    databasePath: join(dataDirectory, 'test.sqlite'),
  };
}

describe('SessionStateManager', () => {
  it('loads an authoritative state and builds role-specific snapshots', () => {
    const config = createTemporaryConfig();
    const databaseHandle = initializeDatabase(config);
    const repository = new SqliteSessionRepository(databaseHandle.database);
    const manager = new SessionStateManager({ repository });

    try {
      repository.createSession({
        id: 'ravenhill',
        name: 'Das Geheimnis von Ravenhill',
        joinCode: 'RAVEN01',
        lobbyState: 'OPEN',
        createdAt: '2026-10-02T11:00:00.000Z',
      });
      repository.createPlayer({
        id: 'anna',
        sessionId: 'ravenhill',
        displayName: 'Anna',
        connectionState: 'CONNECTED',
        createdAt: '2026-10-02T11:01:00.000Z',
      });

      const gameMasterSnapshot = manager.getSnapshot({
        sessionId: 'ravenhill',
        role: 'GAME_MASTER',
      });
      const playerSnapshot = manager.getSnapshot(
        { sessionId: 'ravenhill', role: 'PLAYER' },
        'anna',
      );
      const presentationSnapshot = manager.getSnapshot({
        sessionId: 'ravenhill',
        role: 'PRESENTATION',
      });

      expect(gameMasterSnapshot).toMatchObject({
        audience: 'GAME_MASTER',
        session: { id: 'ravenhill', joinCode: 'RAVEN01' },
      });
      expect(playerSnapshot).toMatchObject({
        audience: 'PLAYER',
        player: { id: 'anna', displayName: 'Anna' },
      });
      expect(presentationSnapshot).toMatchObject({
        audience: 'PRESENTATION',
        session: { id: 'ravenhill', playerCount: 1 },
      });
      expect(JSON.stringify(presentationSnapshot)).not.toContain('Anna');
      expect(manager.getSnapshot({ sessionId: 'ravenhill', role: 'PLAYER' })).toBeUndefined();
    } finally {
      databaseHandle.database.close();
      rmSync(config.dataDirectory, { recursive: true, force: true });
    }
  });

  it('changes the cached and persisted state only through a typed command', () => {
    const config = createTemporaryConfig();
    const databaseHandle = initializeDatabase(config);
    const repository = new SqliteSessionRepository(databaseHandle.database);
    const manager = new SessionStateManager({
      repository,
      now: () => new Date('2026-10-02T12:00:00.000Z'),
    });

    try {
      repository.createSession({
        id: 'ravenhill',
        name: 'Das Geheimnis von Ravenhill',
        joinCode: 'RAVEN01',
        lobbyState: 'CLOSED',
        createdAt: '2026-10-02T11:00:00.000Z',
      });

      const changed = manager.dispatch('ravenhill', {
        type: 'SET_LOBBY_STATE',
        lobbyState: 'OPEN',
      });

      expect(changed).toMatchObject({
        command: 'SET_LOBBY_STATE',
        session: { lobbyState: 'OPEN', updatedAt: '2026-10-02T12:00:00.000Z' },
      });
      expect(repository.findSessionById('ravenhill')).toMatchObject({
        lobbyState: 'OPEN',
        updatedAt: '2026-10-02T12:00:00.000Z',
      });
      expect(() =>
        manager.dispatch('missing-session', { type: 'SET_LOBBY_STATE', lobbyState: 'OPEN' }),
      ).toThrow(SessionStateError);
    } finally {
      databaseHandle.database.close();
      rmSync(config.dataDirectory, { recursive: true, force: true });
    }
  });

  it('creates a normalized player with a server-generated ID and rejects invalid names', () => {
    const config = createTemporaryConfig();
    const databaseHandle = initializeDatabase(config);
    const repository = new SqliteSessionRepository(databaseHandle.database);
    const manager = new SessionStateManager({
      repository,
      createPlayerId: () => 'player-anna',
      createDeviceToken: () => 'a'.repeat(43),
      now: () => new Date('2026-10-02T12:00:00.000Z'),
    });

    try {
      repository.createSession({
        id: 'ravenhill',
        name: 'Das Geheimnis von Ravenhill',
        joinCode: 'RAVEN01',
        lobbyState: 'OPEN',
        createdAt: '2026-10-02T11:00:00.000Z',
      });

      const joined = manager.dispatch('ravenhill', {
        type: 'PLAYER_JOIN',
        displayName: '  Anna   Beispiel  ',
      });

      expect(joined).toEqual({
        command: 'PLAYER_JOIN',
        session: expect.objectContaining({ updatedAt: '2026-10-02T12:00:00.000Z' }),
        player: {
          id: 'player-anna',
          displayName: 'Anna Beispiel',
          connectionState: 'CONNECTED',
        },
        deviceToken: 'a'.repeat(43),
      });
      expect(repository.listPlayers('ravenhill')).toMatchObject([
        { id: 'player-anna', displayName: 'Anna Beispiel', connectionState: 'CONNECTED' },
      ]);
      expect(() =>
        manager.dispatch('ravenhill', { type: 'PLAYER_JOIN', displayName: ' ' }),
      ).toThrow(new SessionStateError('INVALID_PLAYER_NAME'));
      expect(() =>
        manager.dispatch('ravenhill', { type: 'PLAYER_JOIN', displayName: 'anna beispiel' }),
      ).toThrow(new SessionStateError('PLAYER_NAME_TAKEN'));
    } finally {
      databaseHandle.database.close();
      rmSync(config.dataDirectory, { recursive: true, force: true });
    }
  });
});
