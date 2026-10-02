import Fastify, { type FastifyReply } from 'fastify';

import type { HelloSession } from '@pnp-engine/shared';

import {
  createErrorResponse,
  HEALTH_RESPONSE,
  INVALID_JOIN_CODE_RESPONSE,
  INVALID_SESSION_ID_RESPONSE,
  SESSION_NOT_FOUND_RESPONSE,
  type HealthResponse,
  type SessionMetadataResponse,
} from './http.js';
import type { SqliteSessionRepository, StoredSession } from './session-repository.js';
import { attachRealtimeGateway, type RealtimeAuditLogger } from './realtime.js';
import type { SessionStateManager } from './session-state-manager.js';
import { createSocketAuthenticator } from './socket-authentication.js';

export const HELLO_SESSION: HelloSession = {
  sessionId: 'ravenhill',
  sessionName: 'Das Geheimnis von Ravenhill',
  lobbyState: 'OPEN',
  playerCount: 0,
};

export interface CreateServerOptions {
  readonly sessionRepository?: Pick<
    SqliteSessionRepository,
    'findPlayerByDeviceTokenHash' | 'findSessionById' | 'findSessionByJoinCode' | 'listPlayers'
  >;
  readonly gameMasterSecret?: string;
  readonly sessionStateManager?: SessionStateManager;
  readonly auditLogger?: RealtimeAuditLogger;
}

interface SessionIdParams {
  readonly sessionId: string;
}

interface JoinCodeParams {
  readonly joinCode: string;
}

const SESSION_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;
const JOIN_CODE_PATTERN = /^[A-Z0-9]{4,16}$/;

export function createServer(options: CreateServerOptions = {}) {
  const server = Fastify({ logger: false });
  const authenticator =
    options.sessionRepository === undefined
      ? undefined
      : createSocketAuthenticator({
          sessionRepository: options.sessionRepository,
          ...(options.gameMasterSecret === undefined
            ? {}
            : { gameMasterSecret: options.gameMasterSecret }),
        });
  attachRealtimeGateway(server, {
    ...(authenticator === undefined ? {} : { authenticator }),
    ...(options.sessionStateManager === undefined
      ? {}
      : { sessionStateManager: options.sessionStateManager }),
    ...(options.auditLogger === undefined ? {} : { auditLogger: options.auditLogger }),
  });
  if (options.sessionStateManager !== undefined) {
    server.decorate('sessionStateManager', options.sessionStateManager);
  }

  server.get<{ Reply: HealthResponse }>('/health', async () => HEALTH_RESPONSE);

  server.get<{ Reply: HelloSession }>('/api/hello-session', async () => HELLO_SESSION);

  server.get<{ Params: SessionIdParams }>('/api/sessions/:sessionId', async (request, reply) => {
    if (!SESSION_ID_PATTERN.test(request.params.sessionId)) {
      return reply.status(400).send(INVALID_SESSION_ID_RESPONSE);
    }

    const session = options.sessionRepository?.findSessionById(request.params.sessionId);
    return sendSessionMetadata(session, options.sessionRepository, reply);
  });

  server.get<{ Params: JoinCodeParams }>('/api/lobbies/:joinCode', async (request, reply) => {
    if (!JOIN_CODE_PATTERN.test(request.params.joinCode)) {
      return reply.status(400).send(INVALID_JOIN_CODE_RESPONSE);
    }

    const session = options.sessionRepository?.findSessionByJoinCode(request.params.joinCode);
    return sendSessionMetadata(session, options.sessionRepository, reply);
  });

  server.setNotFoundHandler((_request, reply) => {
    return reply.status(404).send(createErrorResponse(404));
  });

  server.setErrorHandler((error, request, reply) => {
    request.log.error(error);

    const errorStatusCode = getHttpStatusCode(error);
    const statusCode =
      errorStatusCode !== undefined && errorStatusCode >= 400 && errorStatusCode < 500
        ? errorStatusCode
        : 500;

    return reply.status(statusCode).send(createErrorResponse(statusCode));
  });

  return server;
}

function sendSessionMetadata(
  session: StoredSession | undefined,
  repository: CreateServerOptions['sessionRepository'],
  reply: FastifyReply,
) {
  if (session === undefined || repository === undefined) {
    return reply.status(404).send(SESSION_NOT_FOUND_RESPONSE);
  }

  return {
    session: {
      id: session.id,
      name: session.name,
      lobbyState: session.lobbyState,
      playerCount: repository.listPlayers(session.id).length,
    },
  } satisfies SessionMetadataResponse;
}

function getHttpStatusCode(error: unknown): number | undefined {
  if (
    typeof error === 'object' &&
    error !== null &&
    'statusCode' in error &&
    typeof error.statusCode === 'number'
  ) {
    return error.statusCode;
  }

  return undefined;
}
