import { describe, expect, it } from 'vitest';

import type { HelloSession } from '@pnp-engine/shared';

import { createServer, HELLO_SESSION } from '../src/app.js';
import { HEALTH_RESPONSE, type ApiErrorResponse, type HealthResponse } from '../src/http.js';

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

  it('reports that the server is healthy', async () => {
    const server = createServer();

    try {
      const response = await server.inject({ method: 'GET', url: '/health' });
      const expectedResponse = HEALTH_RESPONSE satisfies HealthResponse;

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(expectedResponse);
    } finally {
      await server.close();
    }
  });

  it('returns the structured not-found error for an unknown route', async () => {
    const server = createServer();

    try {
      const response = await server.inject({ method: 'GET', url: '/unknown' });
      const expectedResponse = {
        error: {
          code: 'NOT_FOUND',
          message: 'Route not found.',
        },
      } satisfies ApiErrorResponse;

      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual(expectedResponse);
    } finally {
      await server.close();
    }
  });
});
