import type Database from 'better-sqlite3';

import type {
  LobbyState,
  PlayerAdmissionState,
  PlayerConnectionState,
  PlayerId,
  SessionId,
} from '@pnp-engine/shared';

export interface StoredSession {
  readonly id: SessionId;
  readonly name: string;
  readonly lobbyState: LobbyState;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface StoredSessionCode {
  readonly code: string;
  readonly sessionId: SessionId;
  readonly active: boolean;
  readonly createdAt: string;
}

export interface StoredPlayer {
  readonly id: PlayerId;
  readonly sessionId: SessionId;
  readonly displayName: string;
  readonly connectionState: PlayerConnectionState;
  readonly admissionState: PlayerAdmissionState;
  readonly characterId?: string;
  readonly roleId?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateSessionInput {
  readonly id: SessionId;
  readonly name: string;
  readonly joinCode: string;
  readonly lobbyState: LobbyState;
  readonly createdAt: string;
}

export interface CreatePlayerInput {
  readonly id: PlayerId;
  readonly sessionId: SessionId;
  readonly displayName: string;
  readonly connectionState: PlayerConnectionState;
  readonly admissionState?: PlayerAdmissionState;
  readonly createdAt: string;
  readonly deviceTokenHash?: string;
}

interface SessionRow {
  readonly id: string;
  readonly name: string;
  readonly lobby_state: string;
  readonly created_at: string;
  readonly updated_at: string;
}

interface SessionCodeRow {
  readonly code: string;
  readonly session_id: string;
  readonly active: number;
  readonly created_at: string;
}

interface PlayerRow {
  readonly id: string;
  readonly session_id: string;
  readonly display_name: string;
  readonly connection_state: string;
  readonly admission_state: string;
  readonly character_id: string | null;
  readonly role_id: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

export class SqliteSessionRepository {
  public constructor(private readonly database: Database.Database) {}

  public createSession(input: CreateSessionInput): StoredSession {
    const create = this.database.transaction(() => {
      this.database
        .prepare(
          `
            INSERT INTO sessions (id, name, lobby_state, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
          `,
        )
        .run(input.id, input.name, input.lobbyState, input.createdAt, input.createdAt);
      this.database
        .prepare(
          `
            INSERT INTO session_codes (code, session_id, active, created_at)
            VALUES (?, ?, 1, ?)
          `,
        )
        .run(input.joinCode, input.id, input.createdAt);
    });

    create();

    return {
      id: input.id,
      name: input.name,
      lobbyState: input.lobbyState,
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
    };
  }

  public findSessionById(sessionId: SessionId): StoredSession | undefined {
    const row = this.database
      .prepare('SELECT id, name, lobby_state, created_at, updated_at FROM sessions WHERE id = ?')
      .get(sessionId) as SessionRow | undefined;

    return row === undefined ? undefined : toStoredSession(row);
  }

  public findSessionByJoinCode(joinCode: string): StoredSession | undefined {
    const row = this.database
      .prepare(
        `
          SELECT sessions.id, sessions.name, sessions.lobby_state, sessions.created_at, sessions.updated_at
          FROM sessions
          INNER JOIN session_codes ON session_codes.session_id = sessions.id
          WHERE session_codes.code = ? AND session_codes.active = 1
        `,
      )
      .get(joinCode) as SessionRow | undefined;

    return row === undefined ? undefined : toStoredSession(row);
  }

  public findActiveSessionCode(sessionId: SessionId): StoredSessionCode | undefined {
    const row = this.database
      .prepare(
        `
          SELECT code, session_id, active, created_at
          FROM session_codes
          WHERE session_id = ? AND active = 1
        `,
      )
      .get(sessionId) as SessionCodeRow | undefined;

    return row === undefined ? undefined : toStoredSessionCode(row);
  }

  public updateLobbyState(
    sessionId: SessionId,
    lobbyState: LobbyState,
    updatedAt: string,
  ): StoredSession | undefined {
    const result = this.database
      .prepare('UPDATE sessions SET lobby_state = ?, updated_at = ? WHERE id = ?')
      .run(lobbyState, updatedAt, sessionId);

    return result.changes === 0 ? undefined : this.findSessionById(sessionId);
  }

  public createPlayer(input: CreatePlayerInput): StoredPlayer {
    const create = this.database.transaction(() => {
      this.database
        .prepare(
          `
            INSERT INTO players (
              id, session_id, display_name, connection_state, admission_state, created_at, updated_at, device_token_hash
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `,
        )
        .run(
          input.id,
          input.sessionId,
          input.displayName,
          input.connectionState,
          input.admissionState ?? 'WAITING',
          input.createdAt,
          input.createdAt,
          input.deviceTokenHash ?? null,
        );
      this.database
        .prepare('UPDATE sessions SET updated_at = ? WHERE id = ?')
        .run(input.createdAt, input.sessionId);
    });

    create();

    return {
      id: input.id,
      sessionId: input.sessionId,
      displayName: input.displayName,
      connectionState: input.connectionState,
      admissionState: input.admissionState ?? 'WAITING',
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
    };
  }

  public listPlayers(sessionId: SessionId): readonly StoredPlayer[] {
    const rows = this.database
      .prepare(
        `
          SELECT id, session_id, display_name, connection_state, admission_state, character_id, role_id, created_at, updated_at
          FROM players
          WHERE session_id = ?
          ORDER BY created_at ASC, id ASC
        `,
      )
      .all(sessionId) as readonly PlayerRow[];

    return rows.map(toStoredPlayer);
  }

  public findPlayerByDeviceTokenHash(deviceTokenHash: string): StoredPlayer | undefined {
    const row = this.database
      .prepare(
        `
          SELECT id, session_id, display_name, connection_state, admission_state, character_id, role_id, created_at, updated_at
          FROM players
          WHERE device_token_hash = ?
        `,
      )
      .get(deviceTokenHash) as PlayerRow | undefined;

    return row === undefined ? undefined : toStoredPlayer(row);
  }

  public updatePlayerConnectionState(
    sessionId: SessionId,
    playerId: PlayerId,
    connectionState: PlayerConnectionState,
    updatedAt: string,
  ): StoredPlayer | undefined {
    const update = this.database.transaction(() => {
      const result = this.database
        .prepare(
          `
            UPDATE players
            SET connection_state = ?, updated_at = ?
            WHERE id = ? AND session_id = ?
          `,
        )
        .run(connectionState, updatedAt, playerId, sessionId);
      if (result.changes === 0) {
        return undefined;
      }

      this.database
        .prepare('UPDATE sessions SET updated_at = ? WHERE id = ?')
        .run(updatedAt, sessionId);
      return this.database
        .prepare(
          `
            SELECT id, session_id, display_name, connection_state, admission_state, character_id, role_id, created_at, updated_at
            FROM players
            WHERE id = ? AND session_id = ?
          `,
        )
        .get(playerId, sessionId) as PlayerRow;
    });
    const row = update();

    return row === undefined ? undefined : toStoredPlayer(row);
  }
}

function toStoredSession(row: SessionRow): StoredSession {
  return {
    id: row.id,
    name: row.name,
    lobbyState: row.lobby_state as LobbyState,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toStoredSessionCode(row: SessionCodeRow): StoredSessionCode {
  return {
    code: row.code,
    sessionId: row.session_id,
    active: row.active === 1,
    createdAt: row.created_at,
  };
}

function toStoredPlayer(row: PlayerRow): StoredPlayer {
  return {
    id: row.id,
    sessionId: row.session_id,
    displayName: row.display_name,
    connectionState: row.connection_state as PlayerConnectionState,
    admissionState: row.admission_state as PlayerAdmissionState,
    ...(row.character_id === null ? {} : { characterId: row.character_id }),
    ...(row.role_id === null ? {} : { roleId: row.role_id }),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
