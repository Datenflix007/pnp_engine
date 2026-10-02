import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { SOCKET_EVENT, type SessionSnapshotEvent } from '@pnp-engine/protocol';
import { io as createSocketClient, type Socket as ClientSocket } from 'socket.io-client';
import { describe, expect, it } from 'vitest';

import { createServer } from '../src/app.js';
import type { ServerConfig } from '../src/config.js';
import { initializeDatabase } from '../src/database.js';
import { hashDeviceToken } from '../src/device-token.js';
import { SqliteSessionRepository } from '../src/session-repository.js';
import { SessionStateManager } from '../src/session-state-manager.js';

describe('SESSION_SNAPSHOT event', () => {
  it('sends each connection its current role-filtered snapshot', async () => {
    const config = createTemporaryConfig();
    const databaseHandle = initializeDatabase(config);
    const repository = new SqliteSessionRepository(databaseHandle.database);
    const deviceToken = 'a'.repeat(43);
    repository.createSession({
      id: 'ravenhill',
      name: 'Das Geheimnis von Ravenhill',
      joinCode: 'RAVEN01',
      lobbyState: 'OPEN',
      createdAt: '2026-10-02T16:00:00.000Z',
    });
    repository.createPlayer({
      id: 'player-anna',
      sessionId: 'ravenhill',
      displayName: 'Anna Privat',
      connectionState: 'OFFLINE',
      createdAt: '2026-10-02T16:01:00.000Z',
      deviceTokenHash: hashDeviceToken(deviceToken),
    });
    const server = createServer({
      sessionRepository: repository,
      sessionStateManager: new SessionStateManager({ repository }),
      gameMasterSecret: 'correct horse battery staple',
    });
    await server.listen({ host: '127.0.0.1', port: 0 });
    const address = server.server.address();
    if (address === null || typeof address === 'string') {
      throw new Error('Expected Fastify to listen on a TCP address.');
    }

    const url = `http://127.0.0.1:${address.port}`;
    const player = createClient(url, { role: 'PLAYER', deviceToken });
    const gameMaster = createClient(url, {
      role: 'GAME_MASTER',
      sessionId: 'ravenhill',
      gameMasterSecret: 'correct horse battery staple',
    });
    const presentation = createClient(url, { role: 'PRESENTATION', sessionId: 'ravenhill' });

    try {
      const playerSnapshot = waitForSnapshot(player);
      const gameMasterSnapshot = waitForSnapshot(gameMaster);
      const presentationSnapshot = waitForSnapshot(presentation);
      await Promise.all([connect(player), connect(gameMaster), connect(presentation)]);

      const [playerEvent, gameMasterEvent, presentationEvent] = await Promise.all([
        playerSnapshot,
        gameMasterSnapshot,
        presentationSnapshot,
      ]);
      expect(playerEvent.payload.snapshot).toMatchObject({
        audience: 'PLAYER',
        session: { id: 'ravenhill' },
        player: { id: 'player-anna', displayName: 'Anna Privat' },
      });
      expect(gameMasterEvent.payload.snapshot).toMatchObject({
        audience: 'GAME_MASTER',
        session: { id: 'ravenhill', joinCode: 'RAVEN01' },
      });
      expect(presentationEvent.payload.snapshot).toMatchObject({
        audience: 'PRESENTATION',
        session: { id: 'ravenhill', playerCount: 1 },
      });
      expect(JSON.stringify(playerEvent)).not.toContain('RAVEN01');
      expect(JSON.stringify(presentationEvent)).not.toContain('Anna Privat');
      expect(JSON.stringify(presentationEvent)).not.toContain('RAVEN01');
    } finally {
      player.disconnect();
      gameMaster.disconnect();
      presentation.disconnect();
      await server.close();
      databaseHandle.database.close();
      rmSync(config.dataDirectory, { recursive: true, force: true });
    }
  });
});

function createTemporaryConfig(): ServerConfig {
  const dataDirectory = mkdtempSync(join(tmpdir(), 'pnp-engine-session-snapshot-'));
  return {
    host: '127.0.0.1',
    port: 0,
    dataDirectory,
    databasePath: join(dataDirectory, 'test.sqlite'),
  };
}

function createClient(url: string, authentication: Record<string, string>): ClientSocket {
  return createSocketClient(url, {
    auth: authentication,
    autoConnect: false,
    forceNew: true,
    reconnection: false,
    transports: ['websocket'],
  });
}

function connect(socket: ClientSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.once('connect', () => resolve());
    socket.once('connect_error', (error: Error) => reject(error));
    socket.connect();
  });
}

function waitForSnapshot(socket: ClientSocket): Promise<SessionSnapshotEvent> {
  return new Promise((resolve) => {
    const listener = (event: SessionSnapshotEvent) => {
      if (event.type === 'SESSION_SNAPSHOT') {
        socket.off(SOCKET_EVENT, listener);
        resolve(event);
      }
    };
    socket.on(SOCKET_EVENT, listener);
  });
}
