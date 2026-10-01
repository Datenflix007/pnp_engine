import type { FastifyInstance } from 'fastify';
import { Server as SocketIoServer, type Socket } from 'socket.io';

import type { SessionId } from '@pnp-engine/shared';

/** The room name is internal so clients cannot infer authorization from it. */
export function getSessionRoomName(sessionId: SessionId): string {
  return `session:${sessionId}`;
}

/**
 * Tracks the authenticated session assignment independently from Socket.IO's
 * room adapter, which keeps later authorization checks explicit and testable.
 */
export class SessionConnectionRegistry {
  private readonly socketSessionIds = new Map<string, SessionId>();
  private readonly socketIdsBySession = new Map<SessionId, Set<string>>();

  public assign(socket: Socket, sessionId: SessionId): void {
    this.remove(socket.id);
    socket.join(getSessionRoomName(sessionId));
    this.socketSessionIds.set(socket.id, sessionId);

    const socketIds = this.socketIdsBySession.get(sessionId) ?? new Set<string>();
    socketIds.add(socket.id);
    this.socketIdsBySession.set(sessionId, socketIds);
  }

  public remove(socketId: string): void {
    const sessionId = this.socketSessionIds.get(socketId);
    if (sessionId === undefined) {
      return;
    }

    this.socketSessionIds.delete(socketId);
    const socketIds = this.socketIdsBySession.get(sessionId);
    if (socketIds === undefined) {
      return;
    }

    socketIds.delete(socketId);
    if (socketIds.size === 0) {
      this.socketIdsBySession.delete(sessionId);
    }
  }

  public getSessionId(socketId: string): SessionId | undefined {
    return this.socketSessionIds.get(socketId);
  }

  public getConnectionCount(sessionId: SessionId): number {
    return this.socketIdsBySession.get(sessionId)?.size ?? 0;
  }
}

export interface RealtimeGateway {
  readonly io: SocketIoServer;
  readonly connections: SessionConnectionRegistry;
  assignSocketToSession(socket: Socket, sessionId: SessionId): void;
}

declare module 'fastify' {
  interface FastifyInstance {
    readonly realtimeGateway: RealtimeGateway;
  }
}

export function attachRealtimeGateway(server: FastifyInstance): RealtimeGateway {
  const io = new SocketIoServer(server.server, { serveClient: false });
  const connections = new SessionConnectionRegistry();
  const gateway: RealtimeGateway = {
    io,
    connections,
    assignSocketToSession(socket, sessionId) {
      connections.assign(socket, sessionId);
    },
  };

  io.on('connection', (socket) => {
    socket.on('disconnect', () => {
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

function isAlreadyClosedServerError(error: Error): boolean {
  const errorCode = 'code' in error && typeof error.code === 'string' ? error.code : undefined;

  return errorCode === 'ERR_SERVER_NOT_RUNNING' || error.message === 'Server is not running.';
}
