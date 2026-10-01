import { describe, expect, it } from 'vitest';

import type { HelloSession } from '@pnp-engine/shared';

import { createServer, HELLO_SESSION } from '../src/app.js';

describe('hello session endpoint', () => {
  it('returns the shared HTTP contract', async () => {
    const server = createServer();

    try {
      const response = await server.inject({
        method: 'GET',
        url: '/api/hello-session',
      });
      const expectedResponse = HELLO_SESSION satisfies HelloSession;

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(expectedResponse);
    } finally {
      await server.close();
    }
  });
});
