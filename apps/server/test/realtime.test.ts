import { once } from 'node:events';

import { io as createSocketClient } from 'socket.io-client';
import { describe, expect, it } from 'vitest';

import { createServer } from '../src/app.js';
import { getSessionRoomName } from '../src/realtime.js';

describe('Socket.IO gateway', () => {
  it('attaches to Fastify and keeps session room assignment server-side', async () => {
    const server = createServer();
    await server.listen({ host: '127.0.0.1', port: 0 });
    const address = server.server.address();

    if (address === null || typeof address === 'string') {
      throw new Error('Expected Fastify to listen on a TCP address.');
    }

    const connection = once(server.realtimeGateway.io, 'connection');
    const client = createSocketClient(`http://127.0.0.1:${address.port}`, {
      forceNew: true,
      transports: ['websocket'],
    });

    try {
      const [socket] = await connection;

      expect(server.realtimeGateway.connections.getConnectionCount('ravenhill')).toBe(0);

      server.realtimeGateway.assignSocketToSession(socket, 'ravenhill');

      expect(socket.rooms).toContain(getSessionRoomName('ravenhill'));
      expect(server.realtimeGateway.connections.getSessionId(socket.id)).toBe('ravenhill');
      expect(server.realtimeGateway.connections.getConnectionCount('ravenhill')).toBe(1);

      const disconnect = once(socket, 'disconnect');
      client.disconnect();
      await disconnect;

      expect(server.realtimeGateway.connections.getConnectionCount('ravenhill')).toBe(0);
    } finally {
      client.disconnect();
      await server.close();
    }
  });
});
