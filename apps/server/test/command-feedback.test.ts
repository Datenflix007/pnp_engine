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
import { afterEach, describe, expect, it } from 'vitest';

import { createServer } from '../src/app.js';
import type { ServerConfig } from '../src/config.js';
import { initializeDatabase } from '../src/database.js';
import { SqliteSessionRepository } from '../src/session-repository.js';
import { SessionStateManager } from '../src/session-state-manager.js';

describe('command feedback', () => {
  const temporaryDirectories: string[] = [];

  afterEach(() => {
    for (const directory of temporaryDirectories.splice(0)) {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('correlates accepted commands and safely rejects invalid, unsupported and read-only commands', async () => {
    const config = createTemporaryConfig(temporaryDirectories);
    const databaseHandle = initializeDatabase(config);
    const repository = new SqliteSessionRepository(databaseHandle.database);
    repository.createSession({
      id: 'ravenhill',
      name: 'Das Geheimnis von Ravenhill',
      joinCode: 'RAVEN01',
      lobbyState: 'OPEN',
      createdAt: '2026-10-02T14:00:00.000Z',
    });
    const server = createServer({
      sessionRepository: repository,
      sessionStateManager: new SessionStateManager({ repository, createPlayerId: () => 'anna' }),
      gameMasterSecret: 'correct horse battery staple',
    });
    await server.listen({ host: '127.0.0.1', port: 0 });
    const address = server.server.address();
    if (address === null || typeof address === 'string') {
      throw new Error('Expected Fastify to listen on a TCP address.');
    }

    const url = `http://127.0.0.1:${address.port}`;
    const player = createClient(url, { role: 'PLAYER', joinCode: 'RAVEN01' });
    const presentation = createClient(url, { role: 'PRESENTATION', sessionId: 'ravenhill' });

    try {
      await Promise.all([connect(player), connect(presentation)]);

      const accepted = waitForEvent<CommandAcceptedEvent>(player, 'COMMAND_ACCEPTED');
      player.emit(
        SOCKET_COMMAND_EVENT,
        createProtocolMessage({
          type: 'PLAYER_JOIN',
          requestId: 'join-anna',
          payload: { displayName: 'Anna' },
        }),
      );
      expect(await accepted).toEqual({
        protocolVersion: 1,
        type: 'COMMAND_ACCEPTED',
        requestId: 'join-anna',
        payload: { commandType: 'PLAYER_JOIN' },
      });

      const duplicateJoin = waitForEvent<CommandRejectedEvent>(player, 'COMMAND_REJECTED');
      player.emit(
        SOCKET_COMMAND_EVENT,
        createProtocolMessage({
          type: 'PLAYER_JOIN',
          requestId: 'again',
          payload: { displayName: 'Anna' },
        }),
      );
      expect(await duplicateJoin).toEqual({
        protocolVersion: 1,
        type: 'COMMAND_REJECTED',
        requestId: 'again',
        payload: { commandType: 'PLAYER_JOIN', code: 'PLAYER_ALREADY_JOINED' },
      });

      const unsupportedCommand = waitForEvent<CommandRejectedEvent>(player, 'COMMAND_REJECTED');
      player.emit(
        SOCKET_COMMAND_EVENT,
        createProtocolMessage({
          type: 'MOVE_TOKEN',
          requestId: 'future-command',
          payload: {},
        }),
      );
      expect(await unsupportedCommand).toMatchObject({
        requestId: 'future-command',
        payload: { commandType: 'MOVE_TOKEN', code: 'COMMAND_NOT_SUPPORTED' },
      });

      const readOnlyCommand = waitForEvent<CommandRejectedEvent>(presentation, 'COMMAND_REJECTED');
      presentation.emit(
        SOCKET_COMMAND_EVENT,
        createProtocolMessage({
          type: 'PLAYER_JOIN',
          requestId: 'read-only',
          payload: { displayName: 'Eva' },
        }),
      );
      expect(await readOnlyCommand).toMatchObject({
        requestId: 'read-only',
        payload: { commandType: 'PLAYER_JOIN', code: 'READ_ONLY_ROLE' },
      });

      const invalidCommand = waitForEvent<CommandRejectedEvent>(player, 'COMMAND_REJECTED');
      player.emit(SOCKET_COMMAND_EVENT, { type: 'PLAYER_JOIN', payload: {} });
      expect(await invalidCommand).toEqual({
        protocolVersion: 1,
        type: 'COMMAND_REJECTED',
        payload: { code: 'INVALID_COMMAND' },
      });
    } finally {
      player.disconnect();
      presentation.disconnect();
      await server.close();
      databaseHandle.database.close();
    }
  });
});

function createTemporaryConfig(temporaryDirectories: string[]): ServerConfig {
  const dataDirectory = mkdtempSync(join(tmpdir(), 'pnp-engine-command-feedback-'));
  temporaryDirectories.push(dataDirectory);
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
