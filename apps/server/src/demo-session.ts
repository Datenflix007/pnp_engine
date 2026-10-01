import type { SqliteSessionRepository, StoredSession } from './session-repository.js';

export const OFFICIAL_DEMO_SESSION = {
  id: 'official-demo-ravenhill',
  name: 'Das Geheimnis von Ravenhill',
  joinCode: 'RAVEN01',
  lobbyState: 'CLOSED',
  createdAt: '2026-10-01T00:00:00.000Z',
} as const;

export interface DemoSessionSeedResult {
  readonly created: boolean;
  readonly session: StoredSession;
}

/**
 * Creates the built-in reference session exactly once.
 *
 * The demo is intentionally empty: it contains no players, characters,
 * messages or user-generated content and therefore remains safe to ship.
 */
export function seedOfficialDemoSession(
  repository: SqliteSessionRepository,
): DemoSessionSeedResult {
  const existingSession = repository.findSessionById(OFFICIAL_DEMO_SESSION.id);

  if (existingSession !== undefined) {
    return { created: false, session: existingSession };
  }

  return {
    created: true,
    session: repository.createSession(OFFICIAL_DEMO_SESSION),
  };
}
