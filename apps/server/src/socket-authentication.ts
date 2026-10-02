import { timingSafeEqual } from 'node:crypto';

import type { ClientRole, PlayerId, SessionId } from '@pnp-engine/shared';

import { hashDeviceToken, isValidDeviceToken } from './device-token.js';
import type { SqliteSessionRepository } from './session-repository.js';

const SESSION_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;
const JOIN_CODE_PATTERN = /^[A-Z0-9]{4,16}$/;

export type RealtimeClientRole = Extract<ClientRole, 'PLAYER' | 'GAME_MASTER' | 'PRESENTATION'>;

export interface AuthenticatedSocketConnection {
  readonly sessionId: SessionId;
  readonly role: RealtimeClientRole;
  readonly playerId?: PlayerId;
}

export type SocketAuthenticationErrorCode = 'INVALID_AUTHENTICATION' | 'UNAUTHORIZED';

export class SocketAuthenticationError extends Error {
  public constructor(readonly code: SocketAuthenticationErrorCode) {
    super('Socket authentication failed.');
  }
}

export interface SocketAuthenticator {
  authenticate(authentication: unknown): AuthenticatedSocketConnection;
}

export interface CreateSocketAuthenticatorOptions {
  readonly sessionRepository: Pick<
    SqliteSessionRepository,
    'findPlayerByDeviceTokenHash' | 'findSessionById' | 'findSessionByJoinCode'
  >;
  /** Undefined intentionally disables Game-Master connections until configured. */
  readonly gameMasterSecret?: string;
}

/**
 * Resolves a Socket.IO handshake to a server-authoritative session and role.
 * Secrets are checked here and never retained in the authenticated connection.
 */
export function createSocketAuthenticator(
  options: CreateSocketAuthenticatorOptions,
): SocketAuthenticator {
  return {
    authenticate(authentication) {
      const request = readAuthenticationRequest(authentication);

      switch (request.role) {
        case 'PLAYER':
          return authenticatePlayer(request, options.sessionRepository);
        case 'GAME_MASTER':
          return authenticateGameMaster(request, options);
        case 'PRESENTATION':
          return authenticatePresentation(request, options.sessionRepository);
      }
    },
  };
}

/** Presentation connections may only subscribe to public server events. */
export function isWritableRealtimeRole(role: RealtimeClientRole): boolean {
  return role === 'PLAYER' || role === 'GAME_MASTER';
}

interface AuthenticationRequest {
  readonly role: RealtimeClientRole;
  readonly sessionId?: string;
  readonly joinCode?: string;
  readonly deviceToken?: string;
  readonly gameMasterSecret?: string;
}

function readAuthenticationRequest(authentication: unknown): AuthenticationRequest {
  if (
    typeof authentication !== 'object' ||
    authentication === null ||
    Array.isArray(authentication)
  ) {
    throw new SocketAuthenticationError('INVALID_AUTHENTICATION');
  }

  const request = authentication as Record<string, unknown>;
  const role = request.role;
  if (role !== 'PLAYER' && role !== 'GAME_MASTER' && role !== 'PRESENTATION') {
    throw new SocketAuthenticationError('INVALID_AUTHENTICATION');
  }

  return {
    role,
    ...(typeof request.sessionId === 'string' ? { sessionId: request.sessionId } : {}),
    ...(typeof request.joinCode === 'string' ? { joinCode: request.joinCode } : {}),
    ...(typeof request.deviceToken === 'string' ? { deviceToken: request.deviceToken } : {}),
    ...(typeof request.gameMasterSecret === 'string'
      ? { gameMasterSecret: request.gameMasterSecret }
      : {}),
  };
}

function authenticatePlayer(
  request: AuthenticationRequest,
  repository: CreateSocketAuthenticatorOptions['sessionRepository'],
): AuthenticatedSocketConnection {
  if (request.deviceToken !== undefined) {
    if (request.joinCode !== undefined || !isValidDeviceToken(request.deviceToken)) {
      throw new SocketAuthenticationError('INVALID_AUTHENTICATION');
    }

    const player = repository.findPlayerByDeviceTokenHash(hashDeviceToken(request.deviceToken));
    if (player === undefined) {
      throw new SocketAuthenticationError('UNAUTHORIZED');
    }

    return { sessionId: player.sessionId, role: 'PLAYER', playerId: player.id };
  }

  if (request.joinCode === undefined || !JOIN_CODE_PATTERN.test(request.joinCode)) {
    throw new SocketAuthenticationError('INVALID_AUTHENTICATION');
  }

  const session = repository.findSessionByJoinCode(request.joinCode);
  if (session === undefined) {
    throw new SocketAuthenticationError('UNAUTHORIZED');
  }

  return { sessionId: session.id, role: 'PLAYER' };
}

function authenticateGameMaster(
  request: AuthenticationRequest,
  options: CreateSocketAuthenticatorOptions,
): AuthenticatedSocketConnection {
  if (
    request.sessionId === undefined ||
    !SESSION_ID_PATTERN.test(request.sessionId) ||
    request.gameMasterSecret === undefined
  ) {
    throw new SocketAuthenticationError('INVALID_AUTHENTICATION');
  }

  if (!isGameMasterSecretValid(request.gameMasterSecret, options.gameMasterSecret)) {
    throw new SocketAuthenticationError('UNAUTHORIZED');
  }

  const session = options.sessionRepository.findSessionById(request.sessionId);
  if (session === undefined) {
    throw new SocketAuthenticationError('UNAUTHORIZED');
  }

  return { sessionId: session.id, role: 'GAME_MASTER' };
}

function authenticatePresentation(
  request: AuthenticationRequest,
  repository: CreateSocketAuthenticatorOptions['sessionRepository'],
): AuthenticatedSocketConnection {
  if (request.sessionId === undefined || !SESSION_ID_PATTERN.test(request.sessionId)) {
    throw new SocketAuthenticationError('INVALID_AUTHENTICATION');
  }

  const session = repository.findSessionById(request.sessionId);
  if (session === undefined) {
    throw new SocketAuthenticationError('UNAUTHORIZED');
  }

  return { sessionId: session.id, role: 'PRESENTATION' };
}

function isGameMasterSecretValid(
  suppliedSecret: string,
  configuredSecret: string | undefined,
): boolean {
  if (configuredSecret === undefined) {
    return false;
  }

  const supplied = Buffer.from(suppliedSecret);
  const configured = Buffer.from(configuredSecret);

  return supplied.length === configured.length && timingSafeEqual(supplied, configured);
}
