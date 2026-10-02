import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  createProtocolMessage,
  SOCKET_COMMAND_EVENT,
  SOCKET_EVENT,
  type CommandAcceptedEvent,
  type CommandRejectedEvent,
} from '@pnp-engine/protocol';
import { io as createSocketClient, type Socket as ClientSocket } from 'socket.io-client';
import { describe, expect, it } from 'vitest';

import { createServer } from '../src/app.js';
import type { ServerConfig } from '../src/config.js';
import { initializeDatabase } from '../src/database.js';
import type { RealtimeAuditEvent, RealtimeAuditLogger } from '../src/realtime.js';
import { SqliteSessionRepository } from '../src/session-repository.js';
import { SessionStateManager } from '../src/session-state-manager.js';

describe('realtime audit log', () => {
  it('records operational events without client credentials or player-provided text', async () => {
    const config = createTemporaryConfig();
    const databaseHandle = initializeDatabase(config);
    const repository = new SqliteSessionRepository(databaseHandle.database);
    repository.createSession({
      id: 'ravenhill',
      name: 'Das Geheimnis von Ravenhill',
      joinCode: 'RAVEN01',
      lobbyState: 'OPEN',
      createdAt: '2026-10-02T15:00:00.000Z',
    });
    const records: Array<{ readonly level: 'info' | 'warn'; readonly event: RealtimeAuditEvent }> =
      [];
    const auditLogger: RealtimeAuditLogger = {
      info: (event) => records.push({ level: 'info', event }),
      warn: (event) => records.push({ level: 'warn', event }),
    };
    const deviceToken = 't'.repeat(43);
    const server = createServer({
      sessionRepository: repository,
      sessionStateManager: new SessionStateManager({
        repository,
        createPlayerId: () => 'player-anna',
        createDeviceToken: () => deviceToken,
      }),
      gameMasterSecret: 'correct horse battery staple',
      auditLogger,
    });
    await server.listen({ host: '127.0.0.1', port: 0 });
    const address = server.server.address();
    if (address === null || typeof address === 'string') {
      throw new Error('Expected Fastify to listen on a TCP address.');
    }

    const url = `http://127.0.0.1:${address.port}`;
    const player = createClient(url, { role: 'PLAYER', joinCode: 'RAVEN01' });
    const rejectedGameMaster = createClient(url, {
      role: 'GAME_MASTER',
      sessionId: 'ravenhill',
      gameMasterSecret: 'not the configured secret',
    });

    try {
      await connect(player);
      const accepted = waitForEvent<CommandAcceptedEvent>(player, 'COMMAND_ACCEPTED');
      player.emit(
        SOCKET_COMMAND_EVENT,
        createProtocolMessage({
          type: 'PLAYER_JOIN',
          requestId: 'private-request-id',
          payload: { displayName: 'Anna Privat' },
        }),
      );
      await accepted;

      const rejected = waitForEvent<CommandRejectedEvent>(player, 'COMMAND_REJECTED');
      player.emit(SOCKET_COMMAND_EVENT, createProtocolMessage({ type: 'MOVE_TOKEN', payload: {} }));
      await rejected;

      const serverSocket = server.realtimeGateway.io.sockets.sockets.get(socketId(player));
      if (serverSocket === undefined) {
        throw new Error('Expected the player socket to be registered on the server.');
      }
      const disconnected = once(serverSocket, 'disconnect');
      player.disconnect();
      await disconnected;

      const gameMasterRejected = waitForConnectionError(rejectedGameMaster);
      rejectedGameMaster.connect();
      await gameMasterRejected;

      expect(records).toEqual(
        expect.arrayContaining([
          {
            level: 'info',
            event: { event: 'SOCKET_CONNECTED', sessionId: 'ravenhill', role: 'PLAYER' },
          },
          { level: 'info', event: { event: 'PLAYER_JOINED', sessionId: 'ravenhill' } },
          {
            level: 'info',
            event: {
              event: 'COMMAND_ACCEPTED',
              sessionId: 'ravenhill',
              role: 'PLAYER',
              commandType: 'PLAYER_JOIN',
            },
          },
          {
            level: 'warn',
            event: {
              event: 'COMMAND_REJECTED',
              sessionId: 'ravenhill',
              role: 'PLAYER',
              commandType: 'MOVE_TOKEN',
              code: 'COMMAND_NOT_SUPPORTED',
            },
          },
          {
            level: 'info',
            event: { event: 'SOCKET_DISCONNECTED', sessionId: 'ravenhill', role: 'PLAYER' },
          },
          {
            level: 'warn',
            event: { event: 'SOCKET_AUTHENTICATION_REJECTED', code: 'UNAUTHORIZED' },
          },
        ]),
      );
      const serializedLog = JSON.stringify(records);
      expect(serializedLog).not.toContain('RAVEN01');
      expect(serializedLog).not.toContain(deviceToken);
      expect(serializedLog).not.toContain('correct horse battery staple');
      expect(serializedLog).not.toContain('not the configured secret');
      expect(serializedLog).not.toContain('Anna Privat');
      expect(serializedLog).not.toContain('private-request-id');
    } finally {
      player.disconnect();
      rejectedGameMaster.disconnect();
      await server.close();
      databaseHandle.database.close();
      rmSync(config.dataDirectory, { recursive: true, force: true });
    }
  });
});

function createTemporaryConfig(): ServerConfig {
  const dataDirectory = mkdtempSync(join(tmpdir(), 'pnp-engine-audit-log-'));
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

function waitForConnectionError(socket: ClientSocket): Promise<void> {
  return new Promise((resolve) => {
    socket.once('connect_error', () => resolve());
  });
}

function waitForEvent<TEvent extends { readonly type: string }>(
  socket: ClientSocket,
  type: TEvent['type'],
): Promise<TEvent> {
  return new Promise((resolve) => {
    const listener = (event: TEvent) => {
      if (event.type === type) {
        socket.off(SOCKET_EVENT, listener);
        resolve(event);
      }
    };
    socket.on(SOCKET_EVENT, listener);
  });
}

function socketId(socket: ClientSocket): string {
  if (socket.id === undefined) {
    throw new Error('Expected Socket.IO client to be connected.');
  }
  return socket.id;
}
