import { createProtocolMessage, SOCKET_EVENT } from '@pnp-engine/protocol';
import type { PlayerSessionSnapshot } from '@pnp-engine/shared';
import { describe, expect, it } from 'vitest';

import {
  PlayerRealtimeClient,
  type PlayerSocket,
  type PlayerSocketAuthentication,
  type PlayerSocketOptions,
} from '../src/lib/realtime-client.js';

describe('PlayerRealtimeClient', () => {
  it('tracks connection and reconnect states while obtaining authentication per attempt', () => {
    const socket = new FakePlayerSocket();
    const credentials: { deviceToken?: string } = {};
    const client = new PlayerRealtimeClient({
      serverUrl: 'http://server.local:3000',
      joinCode: 'RAVEN01',
      getDeviceToken: () => credentials.deviceToken,
      socketFactory: (_serverUrl, options) => {
        socket.options = options;
        return socket;
      },
    });
    const statuses: string[] = [];
    client.onStatus((status) => statuses.push(status));

    expect(socket.getAuthentication()).toEqual({ role: 'PLAYER', joinCode: 'RAVEN01' });
    credentials.deviceToken = 'device-token';
    expect(socket.getAuthentication()).toEqual({ role: 'PLAYER', deviceToken: 'device-token' });

    client.connect();
    socket.receive('connect');
    socket.active = true;
    socket.receive('disconnect');
    socket.receive('connect_error');
    socket.active = false;
    socket.receive('disconnect');

    expect(socket.connectCount).toBe(1);
    expect(statuses).toEqual([
      'DISCONNECTED',
      'CONNECTING',
      'CONNECTED',
      'RECONNECTING',
      'DISCONNECTED',
    ]);
  });

  it('accepts only a role-filtered player snapshot', () => {
    const socket = new FakePlayerSocket();
    const client = new PlayerRealtimeClient({
      serverUrl: 'http://server.local:3000',
      joinCode: 'RAVEN01',
      socketFactory: (_serverUrl, options) => {
        socket.options = options;
        return socket;
      },
    });
    const snapshots: PlayerSessionSnapshot[] = [];
    client.onSnapshot((snapshot) => snapshots.push(snapshot));

    socket.receive(
      SOCKET_EVENT,
      createProtocolMessage({ type: 'SESSION_SNAPSHOT', payload: { snapshot: playerSnapshot } }),
    );
    socket.receive(
      SOCKET_EVENT,
      createProtocolMessage({
        type: 'SESSION_SNAPSHOT',
        payload: { snapshot: { ...playerSnapshot, audience: 'PRESENTATION' } },
      }),
    );

    expect(snapshots).toEqual([playerSnapshot]);
  });

  it('queues a join command and exposes accepted and rejected server responses', () => {
    const socket = new FakePlayerSocket();
    const client = new PlayerRealtimeClient({
      serverUrl: 'http://server.local:3000',
      joinCode: 'RAVEN01',
      socketFactory: (_serverUrl, options) => {
        socket.options = options;
        return socket;
      },
    });
    const acceptedNames: string[] = [];
    const rejectionCodes: string[] = [];
    client.onJoinAccepted((event) => acceptedNames.push(event.payload.player.displayName));
    client.onCommandRejected((event) => rejectionCodes.push(event.payload.code));

    const requestId = client.join('Anna');
    expect(socket.emitted).toContainEqual([
      'COMMAND',
      expect.objectContaining({ type: 'PLAYER_JOIN', requestId, payload: { displayName: 'Anna' } }),
    ]);

    socket.receive(
      SOCKET_EVENT,
      createProtocolMessage({
        type: 'PLAYER_JOIN_ACCEPTED',
        requestId,
        payload: {
          player: { id: 'player-anna', displayName: 'Anna', connectionState: 'CONNECTED' },
          deviceToken: 'a'.repeat(43),
        },
      }),
    );
    socket.receive(
      SOCKET_EVENT,
      createProtocolMessage({
        type: 'COMMAND_REJECTED',
        payload: { commandType: 'PLAYER_JOIN', code: 'PLAYER_NAME_TAKEN' },
      }),
    );

    expect(acceptedNames).toEqual(['Anna']);
    expect(rejectionCodes).toEqual(['PLAYER_NAME_TAKEN']);
  });
});

class FakePlayerSocket implements PlayerSocket {
  public active = false;
  public connectCount = 0;
  public options: PlayerSocketOptions | undefined;
  public readonly emitted: Array<readonly [string, ...unknown[]]> = [];
  private readonly listeners = new Map<string, Set<(...arguments_: never[]) => void>>();

  public on(event: string, listener: (...arguments_: never[]) => void): void {
    const listeners = this.listeners.get(event) ?? new Set<(...arguments_: never[]) => void>();
    listeners.add(listener);
    this.listeners.set(event, listeners);
  }

  public off(event: string, listener: (...arguments_: never[]) => void): void {
    this.listeners.get(event)?.delete(listener);
  }

  public connect(): void {
    this.connectCount += 1;
  }

  public disconnect(): void {
    this.active = false;
  }

  public emit(event: string, ...arguments_: readonly unknown[]): void {
    this.emitted.push([event, ...arguments_]);
  }

  public receive(event: string, value?: unknown): void {
    for (const listener of this.listeners.get(event) ?? []) {
      listener(value as never);
    }
  }

  public getAuthentication(): PlayerSocketAuthentication {
    if (this.options === undefined) {
      throw new Error('Expected socket options.');
    }
    let authentication: PlayerSocketAuthentication | undefined;
    this.options.auth((value) => {
      authentication = value;
    });
    if (authentication === undefined) {
      throw new Error('Expected socket authentication.');
    }
    return authentication;
  }
}

const playerSnapshot: PlayerSessionSnapshot = {
  audience: 'PLAYER',
  session: { id: 'ravenhill', name: 'Das Geheimnis von Ravenhill', lobbyState: 'OPEN' },
  player: {
    id: 'player-anna',
    displayName: 'Anna',
    connectionState: 'CONNECTED',
    admissionState: 'WAITING',
  },
  tokens: [],
  messages: [],
  presentation: { mode: 'LOBBY' },
};
