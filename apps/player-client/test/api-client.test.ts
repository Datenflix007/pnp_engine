import { describe, expect, it } from 'vitest';

import { PlayerApiClient } from '../src/lib/api-client.js';

describe('PlayerApiClient', () => {
  it('reads only public lobby metadata and encodes the session code', async () => {
    let requestedUrl: URL | undefined;
    const client = new PlayerApiClient({
      serverUrl: 'http://server.local:3000',
      fetch: async (input) => {
        requestedUrl = new URL(input.toString());
        return new Response(
          JSON.stringify({
            session: {
              id: 'ravenhill',
              name: 'Das Geheimnis von Ravenhill',
              lobbyState: 'OPEN',
              playerCount: 2,
            },
          }),
        );
      },
    });

    await expect(client.getLobby('RAVEN 01')).resolves.toEqual({
      id: 'ravenhill',
      name: 'Das Geheimnis von Ravenhill',
      lobbyState: 'OPEN',
      playerCount: 2,
    });
    expect(requestedUrl?.pathname).toBe('/api/lobbies/RAVEN%2001');
  });

  it('distinguishes unknown lobbies from malformed server responses', async () => {
    const missingLobby = new PlayerApiClient({
      serverUrl: 'http://server.local:3000',
      fetch: async () => new Response(null, { status: 404 }),
    });
    const malformedLobby = new PlayerApiClient({
      serverUrl: 'http://server.local:3000',
      fetch: async () => new Response(JSON.stringify({ session: { id: 'ravenhill' } })),
    });

    await expect(missingLobby.getLobby('UNKNOWN')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(malformedLobby.getLobby('RAVEN01')).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });
  });
});
