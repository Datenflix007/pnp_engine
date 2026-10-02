import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  createProtocolMessage,
  SOCKET_COMMAND_EVENT,
  SOCKET_EVENT,
  type PlayerJoinAcceptedEvent,
  type PlayerJoinedEvent,
  type PlayerReconnectedEvent,
} from '@pnp-engine/protocol';
import { io as createSocketClient, type Socket as ClientSocket } from 'socket.io-client';
import { describe, expect, it } from 'vitest';

import { createServer } from '../src/app.js';
import type { ServerConfig } from '../src/config.js';
import { initializeDatabase } from '../src/database.js';
import { SqliteSessionRepository } from '../src/session-repository.js';
import { SessionStateManager } from '../src/session-state-manager.js';

function createTemporaryConfig(): ServerConfig {
  const dataDirectory = mkdtempSync(join(tmpdir(), 'pnp-engine-player-join-'));

  return {
    host: '127.0.0.1',
    port: 0,
    dataDirectory,
    databasePath: join(dataDirectory, 'test.sqlite'),
  };
}

describe('PLAYER_JOIN command', () => {
  it('persists a player and publishes their identity only to themselves and the Game Master', async () => {
    const config = createTemporaryConfig();
    const databaseHandle = initializeDatabase(config);
    const repository = new SqliteSessionRepository(databaseHandle.database);
    repository.createSession({
      id: 'ravenhill',
      name: 'Das Geheimnis von Ravenhill',
      joinCode: 'RAVEN01',
      lobbyState: 'OPEN',
      createdAt: '2026-10-02T13:00:00.000Z',
    });
    const sessionStateManager = new SessionStateManager({
      repository,
      createPlayerId: () => 'player-anna',
      createDeviceToken: () => 'a'.repeat(43),
      now: () => new Date('2026-10-02T13:01:00.000Z'),
    });
    const server = createServer({
      sessionRepository: repository,
      sessionStateManager,
      gameMasterSecret: 'correct horse battery staple',
    });
    await server.listen({ host: '127.0.0.1', port: 0 });
    const address = server.server.address();

    if (address === null || typeof address === 'string') {
      throw new Error('Expected Fastify to listen on a TCP address.');
    }

    const url = `http://127.0.0.1:${address.port}`;
    const player = createClient(url, { role: 'PLAYER', joinCode: 'RAVEN01' });
    const gameMaster = createClient(url, {
      role: 'GAME_MASTER',
      sessionId: 'ravenhill',
      gameMasterSecret: 'correct horse battery staple',
    });
    const presentation = createClient(url, { role: 'PRESENTATION', sessionId: 'ravenhill' });

    try {
      await Promise.all([connect(player), connect(gameMaster), connect(presentation)]);
      const playerEvent = waitForPlayerJoinAccepted(player);
      const gameMasterEvent = waitForPlayerJoined(gameMaster);
      let presentationReceivedPlayerEvent = false;
      presentation.on(SOCKET_EVENT, () => {
        presentationReceivedPlayerEvent = true;
      });

      player.emit(
        SOCKET_COMMAND_EVENT,
        createProtocolMessage({
          type: 'PLAYER_JOIN',
          requestId: 'join-anna',
          payload: { displayName: '  Anna   Beispiel  ' },
        }),
      );

      const [playerJoined, gameMasterJoined] = await Promise.all([playerEvent, gameMasterEvent]);

      expect(playerJoined).toEqual({
        protocolVersion: 1,
        type: 'PLAYER_JOIN_ACCEPTED',
        requestId: 'join-anna',
        payload: {
          player: {
            id: 'player-anna',
            displayName: 'Anna Beispiel',
            connectionState: 'CONNECTED',
          },
          deviceToken: 'a'.repeat(43),
        },
      });
      expect(gameMasterJoined).toEqual({
        protocolVersion: 1,
        type: 'PLAYER_JOINED',
        requestId: 'join-anna',
        payload: { player: playerJoined.payload.player },
      });
      expect(presentationReceivedPlayerEvent).toBe(false);
      expect(repository.listPlayers('ravenhill')).toMatchObject([
        { id: 'player-anna', displayName: 'Anna Beispiel', connectionState: 'CONNECTED' },
      ]);
      expect(server.realtimeGateway.connections.getConnection(getSocketId(player))).toEqual({
        sessionId: 'ravenhill',
        role: 'PLAYER',
        playerId: 'player-anna',
      });

      player.disconnect();
      const reconnectingPlayer = createClient(url, {
        role: 'PLAYER',
        deviceToken: 'a'.repeat(43),
      });
      const reconnectedEvent = waitForPlayerReconnected(reconnectingPlayer);
      try {
        await connect(reconnectingPlayer);
        expect(await reconnectedEvent).toEqual({
          protocolVersion: 1,
          type: 'PLAYER_RECONNECTED',
          payload: {
            player: {
              id: 'player-anna',
              displayName: 'Anna Beispiel',
              connectionState: 'CONNECTED',
            },
          },
        });
        expect(
          server.realtimeGateway.connections.getConnection(getSocketId(reconnectingPlayer)),
        ).toEqual({
          sessionId: 'ravenhill',
          role: 'PLAYER',
          playerId: 'player-anna',
        });
      } finally {
        reconnectingPlayer.disconnect();
      }
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

function waitForPlayerJoinAccepted(socket: ClientSocket): Promise<PlayerJoinAcceptedEvent> {
  return new Promise((resolve) => {
    socket.once(SOCKET_EVENT, (event: PlayerJoinAcceptedEvent) => resolve(event));
  });
}

function waitForPlayerJoined(socket: ClientSocket): Promise<PlayerJoinedEvent> {
  return new Promise((resolve) => {
    socket.once(SOCKET_EVENT, (event: PlayerJoinedEvent) => resolve(event));
  });
}

function waitForPlayerReconnected(socket: ClientSocket): Promise<PlayerReconnectedEvent> {
  return new Promise((resolve) => {
    socket.once(SOCKET_EVENT, (event: PlayerReconnectedEvent) => resolve(event));
  });
}

function getSocketId(socket: ClientSocket): string {
  if (socket.id === undefined) {
    throw new Error('Expected Socket.IO client to be connected.');
  }

  return socket.id;
}
