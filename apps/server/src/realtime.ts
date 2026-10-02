import type { FastifyInstance } from 'fastify';
import { Server as SocketIoServer, type Socket } from 'socket.io';

import type { SessionId } from '@pnp-engine/shared';
import {
  createProtocolMessage,
  PROTOCOL_VERSION,
  SOCKET_COMMAND_EVENT,
  SOCKET_EVENT,
  type PlayerJoinAcceptedEvent,
  type PlayerJoinCommand,
  type PlayerJoinedEvent,
  type PlayerReconnectedEvent,
} from '@pnp-engine/protocol';

import {
  isWritableRealtimeRole,
  SocketAuthenticationError,
  type AuthenticatedSocketConnection,
  type SocketAuthenticator,
} from './socket-authentication.js';
import { SessionStateError, type SessionStateManager } from './session-state-manager.js';

/** The room name is internal so clients cannot infer authorization from it. */
export function getSessionRoomName(sessionId: SessionId): string {
  return `session:${sessionId}`;
}

export function getSessionRoleRoomName(
  sessionId: SessionId,
  role: AuthenticatedSocketConnection['role'],
): string {
  return `${getSessionRoomName(sessionId)}:role:${role}`;
}

/**
 * Tracks the authenticated session assignment independently from Socket.IO's
 * room adapter, which keeps later authorization checks explicit and testable.
 */
export class SessionConnectionRegistry {
  private readonly connectionsBySocketId = new Map<string, AuthenticatedSocketConnection>();
  private readonly socketIdsBySession = new Map<SessionId, Set<string>>();

  public assign(socket: Socket, connection: AuthenticatedSocketConnection): void {
    this.remove(socket.id);
    socket.join(getSessionRoomName(connection.sessionId));
    socket.join(getSessionRoleRoomName(connection.sessionId, connection.role));
    this.connectionsBySocketId.set(socket.id, connection);

    const socketIds = this.socketIdsBySession.get(connection.sessionId) ?? new Set<string>();
    socketIds.add(socket.id);
    this.socketIdsBySession.set(connection.sessionId, socketIds);
  }

  public remove(socketId: string): void {
    const connection = this.connectionsBySocketId.get(socketId);
    if (connection === undefined) {
      return;
    }

    this.connectionsBySocketId.delete(socketId);
    const socketIds = this.socketIdsBySession.get(connection.sessionId);
    if (socketIds === undefined) {
      return;
    }

    socketIds.delete(socketId);
    if (socketIds.size === 0) {
      this.socketIdsBySession.delete(connection.sessionId);
    }
  }

  public getSessionId(socketId: string): SessionId | undefined {
    return this.connectionsBySocketId.get(socketId)?.sessionId;
  }

  public getConnection(socketId: string): AuthenticatedSocketConnection | undefined {
    return this.connectionsBySocketId.get(socketId);
  }

  public canWrite(socketId: string): boolean {
    const connection = this.connectionsBySocketId.get(socketId);
    return connection !== undefined && isWritableRealtimeRole(connection.role);
  }

  public getConnectionCount(sessionId: SessionId): number {
    return this.socketIdsBySession.get(sessionId)?.size ?? 0;
  }
}

export interface RealtimeGateway {
  readonly io: SocketIoServer;
  readonly connections: SessionConnectionRegistry;
  assignSocketToSession(socket: Socket, connection: AuthenticatedSocketConnection): void;
}

export interface AttachRealtimeGatewayOptions {
  readonly authenticator?: SocketAuthenticator;
  readonly sessionStateManager?: SessionStateManager;
}

declare module 'fastify' {
  interface FastifyInstance {
    readonly realtimeGateway: RealtimeGateway;
  }
}

export function attachRealtimeGateway(
  server: FastifyInstance,
  options: AttachRealtimeGatewayOptions = {},
): RealtimeGateway {
  const io = new SocketIoServer(server.server, { serveClient: false });
  const connections = new SessionConnectionRegistry();
  const authenticatedConnections = new WeakMap<Socket, AuthenticatedSocketConnection>();
  const authenticator = options.authenticator;
  const sessionStateManager = options.sessionStateManager;
  const gateway: RealtimeGateway = {
    io,
    connections,
    assignSocketToSession(socket, connection) {
      connections.assign(socket, connection);
    },
  };

  if (authenticator !== undefined) {
    io.use((socket, next) => {
      try {
        const connection = authenticator.authenticate(socket.handshake.auth);
        authenticatedConnections.set(socket, connection);
        next();
      } catch (error) {
        next(toSocketAuthenticationError(error));
      }
    });
  }

  io.on('connection', (socket) => {
    let connection = authenticatedConnections.get(socket);
    if (connection !== undefined) {
      gateway.assignSocketToSession(socket, connection);
    }

    if (
      connection?.role === 'PLAYER' &&
      connection.playerId !== undefined &&
      sessionStateManager !== undefined
    ) {
      try {
        const result = sessionStateManager.dispatch(connection.sessionId, {
          type: 'SET_PLAYER_CONNECTION_STATE',
          playerId: connection.playerId,
          connectionState: 'CONNECTED',
        });
        if (result.command === 'SET_PLAYER_CONNECTION_STATE') {
          socket.emit(
            SOCKET_EVENT,
            createProtocolMessage({
              type: 'PLAYER_RECONNECTED',
              payload: { player: result.player },
            }) satisfies PlayerReconnectedEvent,
          );
        }
      } catch (error) {
        if (!(error instanceof SessionStateError)) {
          throw error;
        }
      }
    }

    if (connection?.role === 'PLAYER' && sessionStateManager !== undefined) {
      let playerConnection = connection;
      socket.on(SOCKET_COMMAND_EVENT, (command: unknown) => {
        if (!isPlayerJoinCommand(command) || playerConnection.playerId !== undefined) {
          return;
        }

        try {
          const result = sessionStateManager.dispatch(playerConnection.sessionId, {
            type: 'PLAYER_JOIN',
            displayName: command.payload.displayName,
          });
          if (result.command !== 'PLAYER_JOIN') {
            return;
          }

          playerConnection = { ...playerConnection, playerId: result.player.id };
          connection = playerConnection;
          gateway.assignSocketToSession(socket, playerConnection);
          const playerJoined = createProtocolMessage({
            type: 'PLAYER_JOINED',
            ...(command.requestId === undefined ? {} : { requestId: command.requestId }),
            payload: { player: result.player },
          }) satisfies PlayerJoinedEvent;
          socket.emit(
            SOCKET_EVENT,
            createProtocolMessage({
              type: 'PLAYER_JOIN_ACCEPTED',
              ...(command.requestId === undefined ? {} : { requestId: command.requestId }),
              payload: { player: result.player, deviceToken: result.deviceToken },
            }) satisfies PlayerJoinAcceptedEvent,
          );
          io.to(getSessionRoleRoomName(playerConnection.sessionId, 'GAME_MASTER')).emit(
            SOCKET_EVENT,
            playerJoined,
          );
        } catch (error) {
          if (!(error instanceof SessionStateError)) {
            throw error;
          }
        }
      });
    }

    socket.on('disconnect', () => {
      if (
        connection?.role === 'PLAYER' &&
        connection.playerId !== undefined &&
        sessionStateManager !== undefined
      ) {
        try {
          sessionStateManager.dispatch(connection.sessionId, {
            type: 'SET_PLAYER_CONNECTION_STATE',
            playerId: connection.playerId,
            connectionState: 'OFFLINE',
          });
        } catch (error) {
          if (!(error instanceof SessionStateError)) {
            throw error;
          }
        }
      }
      connections.remove(socket.id);
    });
  });

  server.decorate('realtimeGateway', gateway);
  server.addHook('onClose', async () => {
    await new Promise<void>((resolve, reject) => {
      io.close((error) => {
        if (error === undefined || isAlreadyClosedServerError(error)) {
          resolve();
          return;
        }

        reject(error);
      });
    });
  });

  return gateway;
}

function isPlayerJoinCommand(command: unknown): command is PlayerJoinCommand {
  if (typeof command !== 'object' || command === null || Array.isArray(command)) {
    return false;
  }

  const message = command as Record<string, unknown>;
  return (
    message.protocolVersion === PROTOCOL_VERSION &&
    message.type === 'PLAYER_JOIN' &&
    typeof message.payload === 'object' &&
    message.payload !== null &&
    !Array.isArray(message.payload) &&
    typeof (message.payload as Record<string, unknown>).displayName === 'string'
  );
}

function toSocketAuthenticationError(error: unknown): Error {
  if (error instanceof SocketAuthenticationError) {
    const socketError = new Error(error.message) as Error & {
      data?: { readonly code: string };
    };
    socketError.data = { code: error.code };
    return socketError;
  }

  return new Error('Socket authentication failed.');
}

function isAlreadyClosedServerError(error: Error): boolean {
  const errorCode = 'code' in error && typeof error.code === 'string' ? error.code : undefined;

  return errorCode === 'ERR_SERVER_NOT_RUNNING' || error.message === 'Server is not running.';
}
