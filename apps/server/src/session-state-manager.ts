import type {
  LobbyState,
  Player,
  PlayerId,
  Session,
  SessionId,
  SessionSnapshot,
} from '@pnp-engine/shared';
import {
  toGameMasterSessionSnapshot,
  toPlayerSessionSnapshot,
  toPresentationSessionSnapshot,
} from '@pnp-engine/shared';

import type { AuthenticatedSocketConnection } from './socket-authentication.js';
import { createDeviceToken, hashDeviceToken } from './device-token.js';
import type { SqliteSessionRepository, StoredPlayer, StoredSession } from './session-repository.js';

export type SessionStateCommand =
  | {
      readonly type: 'SET_LOBBY_STATE';
      readonly lobbyState: LobbyState;
    }
  | {
      readonly type: 'PLAYER_JOIN';
      readonly displayName: string;
    }
  | {
      readonly type: 'SET_PLAYER_CONNECTION_STATE';
      readonly playerId: PlayerId;
      readonly connectionState: Player['connectionState'];
    };

export type SessionStateCommandResult =
  | {
      readonly command: 'SET_LOBBY_STATE';
      readonly session: Session;
    }
  | {
      readonly command: 'PLAYER_JOIN';
      readonly session: Session;
      readonly player: Player;
      readonly deviceToken: string;
    }
  | {
      readonly command: 'SET_PLAYER_CONNECTION_STATE';
      readonly session: Session;
      readonly player: Player;
    };

export interface SessionStateManagerOptions {
  readonly repository: Pick<
    SqliteSessionRepository,
    | 'createPlayer'
    | 'findActiveSessionCode'
    | 'findSessionById'
    | 'listPlayers'
    | 'updatePlayerConnectionState'
    | 'updateLobbyState'
  >;
  readonly now?: () => Date;
  readonly createPlayerId?: () => PlayerId;
  readonly createDeviceToken?: () => string;
}

export class SessionStateError extends Error {
  public constructor(
    readonly code:
      | 'INVALID_PLAYER_NAME'
      | 'PLAYER_ALREADY_JOINED'
      | 'PLAYER_NAME_TAKEN'
      | 'PLAYER_NOT_FOUND'
      | 'SESSION_CODE_NOT_FOUND'
      | 'SESSION_NOT_FOUND',
  ) {
    super('Session state operation failed.');
  }
}

/**
 * Holds only server-authoritative, in-process state. State can change solely
 * through dispatch(), which persists the matching repository operation first.
 */
export class SessionStateManager {
  private readonly sessions = new Map<SessionId, Session>();
  private readonly now: () => Date;
  private readonly createPlayerId: () => PlayerId;
  private readonly createDeviceToken: () => string;

  public constructor(private readonly options: SessionStateManagerOptions) {
    this.now = options.now ?? (() => new Date());
    this.createPlayerId = options.createPlayerId ?? (() => `player-${randomUUID()}`);
    this.createDeviceToken = options.createDeviceToken ?? createDeviceToken;
  }

  public getSnapshot(
    connection: AuthenticatedSocketConnection,
    playerId?: PlayerId,
  ): SessionSnapshot | undefined {
    const session = this.getOrLoadSession(connection.sessionId);
    if (session === undefined) {
      return undefined;
    }

    switch (connection.role) {
      case 'GAME_MASTER':
        return toGameMasterSessionSnapshot(session);
      case 'PRESENTATION':
        return toPresentationSessionSnapshot(session);
      case 'PLAYER':
        return playerId === undefined ? undefined : toPlayerSessionSnapshot(session, playerId);
    }
  }

  public dispatch(sessionId: SessionId, command: SessionStateCommand): SessionStateCommandResult {
    const current = this.getOrLoadSession(sessionId);
    if (current === undefined) {
      throw new SessionStateError('SESSION_NOT_FOUND');
    }

    switch (command.type) {
      case 'SET_LOBBY_STATE':
        return { command: command.type, session: this.setLobbyState(current, command.lobbyState) };
      case 'PLAYER_JOIN':
        return this.joinPlayer(current, command.displayName);
      case 'SET_PLAYER_CONNECTION_STATE':
        return this.setPlayerConnectionState(current, command.playerId, command.connectionState);
    }
  }

  private getOrLoadSession(sessionId: SessionId): Session | undefined {
    const existing = this.sessions.get(sessionId);
    if (existing !== undefined) {
      return existing;
    }

    const storedSession = this.options.repository.findSessionById(sessionId);
    if (storedSession === undefined) {
      return undefined;
    }

    const sessionCode = this.options.repository.findActiveSessionCode(sessionId);
    if (sessionCode === undefined) {
      throw new SessionStateError('SESSION_CODE_NOT_FOUND');
    }

    const session = createSessionState(
      storedSession,
      sessionCode.code,
      this.options.repository.listPlayers(sessionId),
    );
    this.sessions.set(session.id, session);
    return session;
  }

  private setLobbyState(session: Session, lobbyState: LobbyState): Session {
    const updatedAt = this.now().toISOString();
    const storedSession = this.options.repository.updateLobbyState(
      session.id,
      lobbyState,
      updatedAt,
    );
    if (storedSession === undefined) {
      throw new SessionStateError('SESSION_NOT_FOUND');
    }

    const next: Session = {
      ...session,
      lobbyState: storedSession.lobbyState,
      updatedAt: storedSession.updatedAt,
    };
    this.sessions.set(next.id, next);
    return next;
  }

  private joinPlayer(session: Session, displayName: string): SessionStateCommandResult {
    const normalizedName = normalizePlayerName(displayName);
    if (normalizedName === undefined) {
      throw new SessionStateError('INVALID_PLAYER_NAME');
    }
    if (
      session.players.some(
        (player) => player.displayName.toLocaleLowerCase() === normalizedName.toLocaleLowerCase(),
      )
    ) {
      throw new SessionStateError('PLAYER_NAME_TAKEN');
    }

    const createdAt = this.now().toISOString();
    const deviceToken = this.createDeviceToken();
    const storedPlayer = this.options.repository.createPlayer({
      id: this.createPlayerId(),
      sessionId: session.id,
      displayName: normalizedName,
      connectionState: 'CONNECTED',
      createdAt,
      deviceTokenHash: hashDeviceToken(deviceToken),
    });
    const player = toPlayer(storedPlayer);
    const next: Session = {
      ...session,
      players: [...session.players, player],
      updatedAt: createdAt,
    };
    this.sessions.set(next.id, next);

    return { command: 'PLAYER_JOIN', session: next, player, deviceToken };
  }

  private setPlayerConnectionState(
    session: Session,
    playerId: PlayerId,
    connectionState: Player['connectionState'],
  ): SessionStateCommandResult {
    if (!session.players.some((player) => player.id === playerId)) {
      throw new SessionStateError('PLAYER_NOT_FOUND');
    }

    const updatedAt = this.now().toISOString();
    const storedPlayer = this.options.repository.updatePlayerConnectionState(
      session.id,
      playerId,
      connectionState,
      updatedAt,
    );
    if (storedPlayer === undefined) {
      throw new SessionStateError('PLAYER_NOT_FOUND');
    }

    const player = toPlayer(storedPlayer);
    const next: Session = {
      ...session,
      players: session.players.map((current) => (current.id === player.id ? player : current)),
      updatedAt,
    };
    this.sessions.set(next.id, next);
    return { command: 'SET_PLAYER_CONNECTION_STATE', session: next, player };
  }
}

function normalizePlayerName(displayName: string): string | undefined {
  const normalized = displayName.trim().replaceAll(/\s+/g, ' ');

  return normalized.length >= 2 && normalized.length <= 40 && !containsControlCharacter(normalized)
    ? normalized
    : undefined;
}

function containsControlCharacter(value: string): boolean {
  return [...value].some((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint !== undefined && (codePoint <= 31 || codePoint === 127);
  });
}

function createSessionState(
  storedSession: StoredSession,
  joinCode: string,
  storedPlayers: readonly StoredPlayer[],
): Session {
  return {
    id: storedSession.id,
    name: storedSession.name,
    joinCode,
    lobbyState: storedSession.lobbyState,
    players: storedPlayers.map(toPlayer),
    roles: [],
    characters: [],
    maps: [],
    tokens: [],
    scenes: [],
    messages: [],
    presentation: { mode: 'LOBBY' },
    flags: {},
    createdAt: storedSession.createdAt,
    updatedAt: storedSession.updatedAt,
  };
}

function toPlayer(player: StoredPlayer): Player {
  return {
    id: player.id,
    displayName: player.displayName,
    connectionState: player.connectionState,
    ...(player.characterId === undefined ? {} : { characterId: player.characterId }),
    ...(player.roleId === undefined ? {} : { roleId: player.roleId }),
  };
}
import { randomUUID } from 'node:crypto';
