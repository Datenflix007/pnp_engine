import type { LobbyState, SessionId } from './domain.js';

/**
 * The smallest shared HTTP contract used to verify the first server-to-client
 * path before persistence and authentication are introduced.
 */
export interface HelloSession {
  readonly sessionId: SessionId;
  readonly sessionName: string;
  readonly lobbyState: LobbyState;
  readonly playerCount: number;
}
