import { io as createSocketClient, type Socket as ClientSocket } from 'socket.io-client';
import { describe, expect, it } from 'vitest';

import { createServer } from '../src/app.js';
import type { StoredSession } from '../src/session-repository.js';
import {
  createSocketAuthenticator,
  isWritableRealtimeRole,
  SocketAuthenticationError,
} from '../src/socket-authentication.js';

const ravenhill: StoredSession = {
  id: 'ravenhill',
  name: 'Das Geheimnis von Ravenhill',
  lobbyState: 'OPEN',
  createdAt: '2026-10-02T10:00:00.000Z',
  updatedAt: '2026-10-02T10:00:00.000Z',
};

const sessionRepository = {
  findSessionById: (sessionId: string) => (sessionId === ravenhill.id ? ravenhill : undefined),
  findSessionByJoinCode: (joinCode: string) => (joinCode === 'RAVEN01' ? ravenhill : undefined),
  findPlayerByDeviceTokenHash: () => undefined,
  listPlayers: () => [],
};

describe('socket authentication', () => {
  it('separates player join codes, Game-Master secrets and read-only presentation access', () => {
    const authenticator = createSocketAuthenticator({
      sessionRepository,
      gameMasterSecret: 'correct horse battery staple',
    });

    expect(authenticator.authenticate({ role: 'PLAYER', joinCode: 'RAVEN01' })).toEqual({
      sessionId: 'ravenhill',
      role: 'PLAYER',
    });
    expect(
      authenticator.authenticate({
        role: 'GAME_MASTER',
        sessionId: 'ravenhill',
        gameMasterSecret: 'correct horse battery staple',
      }),
    ).toEqual({ sessionId: 'ravenhill', role: 'GAME_MASTER' });
    expect(authenticator.authenticate({ role: 'PRESENTATION', sessionId: 'ravenhill' })).toEqual({
      sessionId: 'ravenhill',
      role: 'PRESENTATION',
    });
    expect(isWritableRealtimeRole('PRESENTATION')).toBe(false);
    expect(isWritableRealtimeRole('PLAYER')).toBe(true);
    expect(() =>
      authenticator.authenticate({
        role: 'GAME_MASTER',
        sessionId: 'ravenhill',
        gameMasterSecret: 'RAVEN01',
      }),
    ).toThrow(SocketAuthenticationError);
  });

  it('rejects an unauthorised Socket.IO handshake before it joins a session room', async () => {
    const server = createServer({
      sessionRepository,
      gameMasterSecret: 'correct horse battery staple',
    });
    await server.listen({ host: '127.0.0.1', port: 0 });
    const address = server.server.address();

    if (address === null || typeof address === 'string') {
      throw new Error('Expected Fastify to listen on a TCP address.');
    }

    const player = createClient(`http://127.0.0.1:${address.port}`, {
      role: 'PLAYER',
      joinCode: 'RAVEN01',
    });
    const presentation = createClient(`http://127.0.0.1:${address.port}`, {
      role: 'PRESENTATION',
      sessionId: 'ravenhill',
    });
    const rejectedGameMaster = createClient(`http://127.0.0.1:${address.port}`, {
      role: 'GAME_MASTER',
      sessionId: 'ravenhill',
      gameMasterSecret: 'RAVEN01',
    });

    try {
      const playerConnected = waitForSocketEvent(player, 'connect');
      const presentationConnected = waitForSocketEvent(presentation, 'connect');
      const gameMasterRejected = waitForSocketEvent(rejectedGameMaster, 'connect_error');
      player.connect();
      presentation.connect();
      rejectedGameMaster.connect();

      await playerConnected;
      await presentationConnected;
      const authenticationError = await gameMasterRejected;
      const playerId = getConnectedSocketId(player);
      const presentationId = getConnectedSocketId(presentation);

      expect(authenticationError).toMatchObject({ data: { code: 'UNAUTHORIZED' } });
      expect(server.realtimeGateway.connections.getConnection(playerId)).toEqual({
        sessionId: 'ravenhill',
        role: 'PLAYER',
      });
      expect(server.realtimeGateway.connections.canWrite(playerId)).toBe(true);
      expect(server.realtimeGateway.connections.getConnection(presentationId)).toEqual({
        sessionId: 'ravenhill',
        role: 'PRESENTATION',
      });
      expect(server.realtimeGateway.connections.canWrite(presentationId)).toBe(false);
      expect(server.realtimeGateway.connections.getConnectionCount('ravenhill')).toBe(2);
    } finally {
      player.disconnect();
      presentation.disconnect();
      rejectedGameMaster.disconnect();
      await server.close();
    }
  });
});

function waitForSocketEvent(
  socket: ClientSocket,
  event: 'connect' | 'connect_error',
): Promise<Error | undefined> {
  return new Promise((resolve) => {
    socket.once(event, (value?: Error) => {
      resolve(value);
    });
  });
}

function getConnectedSocketId(socket: ClientSocket): string {
  if (socket.id === undefined) {
    throw new Error('Expected Socket.IO client to be connected.');
  }

  return socket.id;
}

function createClient(url: string, authentication: Record<string, string>): ClientSocket {
  return createSocketClient(url, {
    auth: authentication,
    autoConnect: false,
    forceNew: true,
    transports: ['websocket'],
  });
}
