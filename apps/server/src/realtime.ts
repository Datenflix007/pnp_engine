import type { FastifyInstance } from 'fastify';
import { Server as SocketIoServer, type Socket } from 'socket.io';

import type { SessionId } from '@pnp-engine/shared';
import {
  createProtocolMessage,
  PROTOCOL_VERSION,
  SOCKET_COMMAND_EVENT,
  SOCKET_EVENT,
  type CommandAcceptedEvent,
  type CommandRejectedEvent,
  type CommandRejectionCode,
  type PlayerJoinAcceptedEvent,
  type PlayerJoinCommand,
  type PlayerJoinedEvent,
  type PlayerReconnectedEvent,
  type SessionSnapshotEvent,
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

export type RealtimeAuditEvent =
  | {
      readonly event: 'SOCKET_AUTHENTICATION_REJECTED';
      readonly code: SocketAuthenticationError['code'] | 'INTERNAL_ERROR';
    }
  | {
      readonly event: 'SOCKET_CONNECTED' | 'SOCKET_DISCONNECTED';
      readonly sessionId: SessionId;
      readonly role: AuthenticatedSocketConnection['role'];
    }
  | {
      readonly event: 'PLAYER_JOINED' | 'PLAYER_RECONNECTED';
      readonly sessionId: SessionId;
    }
  | {
      readonly event: 'COMMAND_ACCEPTED' | 'COMMAND_REJECTED';
      readonly sessionId: SessionId;
      readonly role: AuthenticatedSocketConnection['role'];
      readonly commandType?: string;
      readonly code?: CommandRejectionCode;
    };

/** Contains only operational metadata; credentials and player-provided text are excluded by type. */
export interface RealtimeAuditLogger {
  info(event: RealtimeAuditEvent): void;
  warn(event: RealtimeAuditEvent): void;
}

const NOOP_AUDIT_LOGGER: RealtimeAuditLogger = {
  info: () => undefined,
  warn: () => undefined,
};

/** Use this logger in the executable server; tests may inject an in-memory logger instead. */
export const consoleRealtimeAuditLogger: RealtimeAuditLogger = {
  info: (event) => console.info(JSON.stringify({ component: 'realtime', ...event })),
  warn: (event) => console.warn(JSON.stringify({ component: 'realtime', ...event })),
};

export interface AttachRealtimeGatewayOptions {
  readonly authenticator?: SocketAuthenticator;
  readonly sessionStateManager?: SessionStateManager;
  readonly auditLogger?: RealtimeAuditLogger;
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
  const auditLogger = options.auditLogger ?? NOOP_AUDIT_LOGGER;
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
        auditLogger.warn({
          event: 'SOCKET_AUTHENTICATION_REJECTED',
          code: error instanceof SocketAuthenticationError ? error.code : 'INTERNAL_ERROR',
        });
        next(toSocketAuthenticationError(error));
      }
    });
  }

  io.on('connection', (socket) => {
    let connection = authenticatedConnections.get(socket);
    if (connection !== undefined) {
      gateway.assignSocketToSession(socket, connection);
      auditLogger.info({
        event: 'SOCKET_CONNECTED',
        sessionId: connection.sessionId,
        role: connection.role,
      });
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
          auditLogger.info({ event: 'PLAYER_RECONNECTED', sessionId: connection.sessionId });
          emitSessionSnapshot(socket, connection, sessionStateManager);
        }
      } catch (error) {
        if (!(error instanceof SessionStateError)) {
          throw error;
        }
      }
    }

    if (connection !== undefined) {
      let playerConnection = connection;
      socket.on(SOCKET_COMMAND_EVENT, (command: unknown) => {
        const rejectCommand = (
          commandMetadata: CommandMetadata | undefined,
          code: CommandRejectionCode,
        ): void => {
          emitCommandRejected(
            socket,
            commandMetadata?.requestId,
            commandMetadata?.commandType,
            code,
          );
          auditLogger.warn({
            event: 'COMMAND_REJECTED',
            sessionId: playerConnection.sessionId,
            role: playerConnection.role,
            ...(commandMetadata === undefined ? {} : { commandType: commandMetadata.commandType }),
            code,
          });
        };
        const commandMetadata = getCommandMetadata(command);
        if (commandMetadata === undefined) {
          rejectCommand(undefined, 'INVALID_COMMAND');
          return;
        }

        if (!isWritableRealtimeRole(playerConnection.role)) {
          rejectCommand(commandMetadata, 'READ_ONLY_ROLE');
          return;
        }

        if (
          playerConnection.role !== 'PLAYER' ||
          sessionStateManager === undefined ||
          commandMetadata.commandType !== 'PLAYER_JOIN'
        ) {
          rejectCommand(commandMetadata, 'COMMAND_NOT_SUPPORTED');
          return;
        }

        if (playerConnection.playerId !== undefined) {
          rejectCommand(commandMetadata, 'PLAYER_ALREADY_JOINED');
          return;
        }

        if (!isPlayerJoinCommand(command)) {
          rejectCommand(commandMetadata, 'INVALID_COMMAND');
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
          emitCommandAccepted(socket, command.requestId, command.type);
          emitSessionSnapshot(socket, playerConnection, sessionStateManager);
          auditLogger.info({ event: 'PLAYER_JOINED', sessionId: playerConnection.sessionId });
          auditLogger.info({
            event: 'COMMAND_ACCEPTED',
            sessionId: playerConnection.sessionId,
            role: playerConnection.role,
            commandType: command.type,
          });
        } catch (error) {
          rejectCommand(commandMetadata, toCommandRejectionCode(error));
        }
      });
    }

    if (
      connection !== undefined &&
      connection.role !== 'PLAYER' &&
      sessionStateManager !== undefined
    ) {
      emitSessionSnapshot(socket, connection, sessionStateManager);
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
      if (connection !== undefined) {
        auditLogger.info({
          event: 'SOCKET_DISCONNECTED',
          sessionId: connection.sessionId,
          role: connection.role,
        });
      }
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

interface CommandMetadata {
  readonly commandType: string;
  readonly requestId?: string;
}

function getCommandMetadata(command: unknown): CommandMetadata | undefined {
  if (typeof command !== 'object' || command === null || Array.isArray(command)) {
    return undefined;
  }

  const message = command as Record<string, unknown>;
  if (
    message.protocolVersion !== PROTOCOL_VERSION ||
    typeof message.type !== 'string' ||
    !Object.hasOwn(message, 'payload') ||
    (message.requestId !== undefined && typeof message.requestId !== 'string')
  ) {
    return undefined;
  }

  return {
    commandType: message.type,
    ...(typeof message.requestId === 'string' ? { requestId: message.requestId } : {}),
  };
}

function emitCommandAccepted(
  socket: Socket,
  requestId: string | undefined,
  commandType: string,
): void {
  socket.emit(
    SOCKET_EVENT,
    createProtocolMessage({
      type: 'COMMAND_ACCEPTED',
      ...(requestId === undefined ? {} : { requestId }),
      payload: { commandType },
    }) satisfies CommandAcceptedEvent,
  );
}

function emitSessionSnapshot(
  socket: Socket,
  connection: AuthenticatedSocketConnection,
  sessionStateManager: SessionStateManager,
): void {
  const snapshot = sessionStateManager.getSnapshot(connection, connection.playerId);
  if (snapshot === undefined) {
    return;
  }

  socket.emit(
    SOCKET_EVENT,
    createProtocolMessage({
      type: 'SESSION_SNAPSHOT',
      payload: { snapshot },
    }) satisfies SessionSnapshotEvent,
  );
}

function emitCommandRejected(
  socket: Socket,
  requestId: string | undefined,
  commandType: string | undefined,
  code: CommandRejectionCode,
): void {
  socket.emit(
    SOCKET_EVENT,
    createProtocolMessage({
      type: 'COMMAND_REJECTED',
      ...(requestId === undefined ? {} : { requestId }),
      payload: {
        ...(commandType === undefined ? {} : { commandType }),
        code,
      },
    }) satisfies CommandRejectedEvent,
  );
}

function toCommandRejectionCode(error: unknown): CommandRejectionCode {
  if (
    error instanceof SessionStateError &&
    (error.code === 'INVALID_PLAYER_NAME' ||
      error.code === 'PLAYER_ALREADY_JOINED' ||
      error.code === 'PLAYER_NAME_TAKEN')
  ) {
    return error.code;
  }

  return 'INTERNAL_ERROR';
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
