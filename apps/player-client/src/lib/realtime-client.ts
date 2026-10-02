import { io } from 'socket.io-client';

import {
  createProtocolMessage,
  PROTOCOL_VERSION,
  SOCKET_COMMAND_EVENT,
  SOCKET_EVENT,
  type CommandRejectedEvent,
  type PlayerJoinAcceptedEvent,
} from '@pnp-engine/protocol';
import type { PlayerSessionSnapshot } from '@pnp-engine/shared';

export type PlayerConnectionStatus =
  'CONNECTED' | 'CONNECTING' | 'DISCONNECTED' | 'ERROR' | 'RECONNECTING';

export interface PlayerSocketAuthentication {
  readonly role: 'PLAYER';
  readonly joinCode?: string;
  readonly deviceToken?: string;
}

export interface PlayerSocketOptions {
  readonly autoConnect: false;
  readonly reconnection: true;
  readonly auth: (callback: (authentication: PlayerSocketAuthentication) => void) => void;
}

export interface PlayerSocket {
  readonly active: boolean;
  on(event: string, listener: (...arguments_: never[]) => void): unknown;
  off(event: string, listener: (...arguments_: never[]) => void): unknown;
  emit(event: string, ...arguments_: readonly unknown[]): unknown;
  connect(): unknown;
  disconnect(): unknown;
}

export type PlayerSocketFactory = (serverUrl: string, options: PlayerSocketOptions) => PlayerSocket;

export interface PlayerRealtimeClientOptions {
  readonly joinCode: string;
  readonly serverUrl: string;
  readonly getDeviceToken?: () => string | undefined;
  readonly socketFactory?: PlayerSocketFactory;
}

/**
 * Owns one Socket.IO connection. It never stores credentials; authentication
 * is read anew for each connection attempt so a later token store can supply a
 * reconnect token without rebuilding the client.
 */
export class PlayerRealtimeClient {
  private readonly socket: PlayerSocket;
  private readonly statusListeners = new Set<(status: PlayerConnectionStatus) => void>();
  private readonly snapshotListeners = new Set<(snapshot: PlayerSessionSnapshot) => void>();
  private readonly joinAcceptedListeners = new Set<(event: PlayerJoinAcceptedEvent) => void>();
  private readonly commandRejectedListeners = new Set<(event: CommandRejectedEvent) => void>();
  private status: PlayerConnectionStatus = 'DISCONNECTED';

  public constructor(private readonly options: PlayerRealtimeClientOptions) {
    const socketOptions: PlayerSocketOptions = {
      autoConnect: false,
      reconnection: true,
      auth: (callback) => callback(this.getAuthentication()),
    };
    this.socket = (options.socketFactory ?? createSocket)(options.serverUrl, socketOptions);
    this.socket.on('connect', this.handleConnect);
    this.socket.on('connect_error', this.handleConnectError);
    this.socket.on('disconnect', this.handleDisconnect);
    this.socket.on(SOCKET_EVENT, this.handleProtocolEvent);
  }

  public getStatus(): PlayerConnectionStatus {
    return this.status;
  }

  public connect(): void {
    if (this.status === 'CONNECTED' || this.status === 'CONNECTING') {
      return;
    }
    this.setStatus('CONNECTING');
    this.socket.connect();
  }

  public disconnect(): void {
    this.socket.disconnect();
    this.setStatus('DISCONNECTED');
  }

  public onStatus(listener: (status: PlayerConnectionStatus) => void): () => void {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => this.statusListeners.delete(listener);
  }

  public onSnapshot(listener: (snapshot: PlayerSessionSnapshot) => void): () => void {
    this.snapshotListeners.add(listener);
    return () => this.snapshotListeners.delete(listener);
  }

  /** Queues the join command until the authenticated socket connection is ready. */
  public join(displayName: string): string {
    const requestId = crypto.randomUUID();
    this.socket.emit(
      SOCKET_COMMAND_EVENT,
      createProtocolMessage({ type: 'PLAYER_JOIN', requestId, payload: { displayName } }),
    );
    return requestId;
  }

  public onJoinAccepted(listener: (event: PlayerJoinAcceptedEvent) => void): () => void {
    this.joinAcceptedListeners.add(listener);
    return () => this.joinAcceptedListeners.delete(listener);
  }

  public onCommandRejected(listener: (event: CommandRejectedEvent) => void): () => void {
    this.commandRejectedListeners.add(listener);
    return () => this.commandRejectedListeners.delete(listener);
  }

  private readonly handleConnect = (): void => {
    this.setStatus('CONNECTED');
  };

  private readonly handleConnectError = (): void => {
    this.setStatus(this.socket.active ? 'RECONNECTING' : 'ERROR');
  };

  private readonly handleDisconnect = (): void => {
    this.setStatus(this.socket.active ? 'RECONNECTING' : 'DISCONNECTED');
  };

  private readonly handleProtocolEvent = (event: unknown): void => {
    const snapshot = getPlayerSnapshot(event);
    if (snapshot !== undefined) {
      for (const listener of this.snapshotListeners) {
        listener(snapshot);
      }
    }

    const joinAccepted = getPlayerJoinAccepted(event);
    if (joinAccepted !== undefined) {
      for (const listener of this.joinAcceptedListeners) {
        listener(joinAccepted);
      }
    }

    const commandRejected = getCommandRejected(event);
    if (commandRejected !== undefined) {
      for (const listener of this.commandRejectedListeners) {
        listener(commandRejected);
      }
    }
  };

  private getAuthentication(): PlayerSocketAuthentication {
    const deviceToken = this.options.getDeviceToken?.();
    return deviceToken === undefined
      ? { role: 'PLAYER', joinCode: this.options.joinCode }
      : { role: 'PLAYER', deviceToken };
  }

  private setStatus(nextStatus: PlayerConnectionStatus): void {
    if (this.status === nextStatus) {
      return;
    }
    this.status = nextStatus;
    for (const listener of this.statusListeners) {
      listener(nextStatus);
    }
  }
}

function createSocket(serverUrl: string, options: PlayerSocketOptions): PlayerSocket {
  return io(serverUrl, options) as unknown as PlayerSocket;
}

function getPlayerSnapshot(event: unknown): PlayerSessionSnapshot | undefined {
  if (
    !isRecord(event) ||
    event.protocolVersion !== PROTOCOL_VERSION ||
    event.type !== 'SESSION_SNAPSHOT' ||
    !isRecord(event.payload)
  ) {
    return undefined;
  }
  const snapshot = event.payload.snapshot;
  return isPlayerSnapshot(snapshot) ? snapshot : undefined;
}

function isPlayerSnapshot(snapshot: unknown): snapshot is PlayerSessionSnapshot {
  if (!isRecord(snapshot) || snapshot.audience !== 'PLAYER' || !isRecord(snapshot.session)) {
    return false;
  }
  return (
    typeof snapshot.session.id === 'string' &&
    typeof snapshot.session.name === 'string' &&
    (snapshot.session.lobbyState === 'CLOSED' || snapshot.session.lobbyState === 'OPEN') &&
    isRecord(snapshot.player) &&
    typeof snapshot.player.id === 'string' &&
    typeof snapshot.player.displayName === 'string' &&
    Array.isArray(snapshot.tokens) &&
    Array.isArray(snapshot.messages) &&
    isRecord(snapshot.presentation)
  );
}

function getPlayerJoinAccepted(event: unknown): PlayerJoinAcceptedEvent | undefined {
  if (
    !isRecord(event) ||
    event.protocolVersion !== PROTOCOL_VERSION ||
    event.type !== 'PLAYER_JOIN_ACCEPTED' ||
    !isRecord(event.payload) ||
    !isRecord(event.payload.player) ||
    typeof event.payload.player.id !== 'string' ||
    typeof event.payload.player.displayName !== 'string' ||
    typeof event.payload.deviceToken !== 'string'
  ) {
    return undefined;
  }
  return event as unknown as PlayerJoinAcceptedEvent;
}

function getCommandRejected(event: unknown): CommandRejectedEvent | undefined {
  if (
    !isRecord(event) ||
    event.protocolVersion !== PROTOCOL_VERSION ||
    event.type !== 'COMMAND_REJECTED' ||
    !isRecord(event.payload) ||
    typeof event.payload.code !== 'string'
  ) {
    return undefined;
  }
  return event as unknown as CommandRejectedEvent;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
