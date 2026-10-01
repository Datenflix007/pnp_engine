import Fastify from 'fastify';

import type { HelloSession } from '@pnp-engine/shared';

export const HELLO_SESSION: HelloSession = {
  sessionId: 'ravenhill',
  sessionName: 'Das Geheimnis von Ravenhill',
  lobbyState: 'OPEN',
  playerCount: 0,
};

export function createServer() {
  const server = Fastify({ logger: false });

  server.get<{ Reply: HelloSession }>('/api/hello-session', async () => HELLO_SESSION);

  return server;
}
