import { describe, expect, it } from 'vitest';

import { createProtocolMessage, PROTOCOL_VERSION } from '@pnp-engine/protocol';

describe('@pnp-engine/protocol', () => {
  it('creates a versioned message with a request correlation id', () => {
    const message = createProtocolMessage({
      type: 'PLAYER_JOIN',
      requestId: 'request-1',
      payload: { displayName: 'Anna' },
    });

    expect(message).toEqual({
      protocolVersion: PROTOCOL_VERSION,
      type: 'PLAYER_JOIN',
      requestId: 'request-1',
      payload: { displayName: 'Anna' },
    });
  });

  it('does not serialise an absent request id', () => {
    const message = createProtocolMessage({
      type: 'PRESENTATION_CHANGED',
      payload: { mode: 'LOBBY' },
    });

    expect(message).not.toHaveProperty('requestId');
  });
});
