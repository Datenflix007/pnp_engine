import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createServer } from '../src/app.js';
import type { ServerConfig } from '../src/config.js';
import { initializeDatabase } from '../src/database.js';
import {
  INVALID_JOIN_CODE_RESPONSE,
  INVALID_SESSION_ID_RESPONSE,
  SESSION_NOT_FOUND_RESPONSE,
  type SessionMetadataResponse,
} from '../src/http.js';
import { SqliteSessionRepository } from '../src/session-repository.js';

function createTemporaryConfig(): ServerConfig {
  const dataDirectory = mkdtempSync(join(tmpdir(), 'pnp-engine-session-api-'));

  return {
    host: '127.0.0.1',
    port: 0,
    dataDirectory,
    databasePath: join(dataDirectory, 'test.sqlite'),
  };
}

describe('session HTTP API', () => {
  it('resolves public session metadata by session ID and active join code', async () => {
    const config = createTemporaryConfig();
    const databaseHandle = initializeDatabase(config);
    const repository = new SqliteSessionRepository(databaseHandle.database);
    const server = createServer({ sessionRepository: repository });

    try {
      repository.createSession({
        id: 'ravenhill',
        name: 'Das Geheimnis von Ravenhill',
        joinCode: 'RAVEN01',
        lobbyState: 'OPEN',
        createdAt: '2026-10-02T08:00:00.000Z',
      });
      repository.createPlayer({
        id: 'anna',
        sessionId: 'ravenhill',
        displayName: 'Anna',
        connectionState: 'CONNECTED',
        createdAt: '2026-10-02T08:01:00.000Z',
      });

      const expectedResponse = {
        session: {
          id: 'ravenhill',
          name: 'Das Geheimnis von Ravenhill',
          lobbyState: 'OPEN',
          playerCount: 1,
        },
      } satisfies SessionMetadataResponse;

      const byId = await server.inject({ method: 'GET', url: '/api/sessions/ravenhill' });
      const byJoinCode = await server.inject({ method: 'GET', url: '/api/lobbies/RAVEN01' });

      expect(byId.statusCode).toBe(200);
      expect(byId.json()).toEqual(expectedResponse);
      expect(byJoinCode.statusCode).toBe(200);
      expect(byJoinCode.json()).toEqual(expectedResponse);
      expect(byJoinCode.json()).not.toHaveProperty('session.joinCode');
    } finally {
      await server.close();
      databaseHandle.database.close();
      rmSync(config.dataDirectory, { recursive: true, force: true });
    }
  });

  it('uses consistent client errors for malformed and unknown route values', async () => {
    const config = createTemporaryConfig();
    const databaseHandle = initializeDatabase(config);
    const repository = new SqliteSessionRepository(databaseHandle.database);
    const server = createServer({ sessionRepository: repository });

    try {
      const invalidSessionId = await server.inject({
        method: 'GET',
        url: '/api/sessions/not_valid',
      });
      const invalidJoinCode = await server.inject({
        method: 'GET',
        url: '/api/lobbies/abc',
      });
      const unknownSession = await server.inject({
        method: 'GET',
        url: '/api/sessions/missing-session',
      });
      const unknownJoinCode = await server.inject({
        method: 'GET',
        url: '/api/lobbies/MISSING1',
      });

      expect(invalidSessionId.statusCode).toBe(400);
      expect(invalidSessionId.json()).toEqual(INVALID_SESSION_ID_RESPONSE);
      expect(invalidJoinCode.statusCode).toBe(400);
      expect(invalidJoinCode.json()).toEqual(INVALID_JOIN_CODE_RESPONSE);
      expect(unknownSession.statusCode).toBe(404);
      expect(unknownSession.json()).toEqual(SESSION_NOT_FOUND_RESPONSE);
      expect(unknownJoinCode.statusCode).toBe(404);
      expect(unknownJoinCode.json()).toEqual(SESSION_NOT_FOUND_RESPONSE);
    } finally {
      await server.close();
      databaseHandle.database.close();
      rmSync(config.dataDirectory, { recursive: true, force: true });
    }
  });
});
