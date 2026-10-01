import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { ServerConfig } from '../src/config.js';
import { initializeDatabase } from '../src/database.js';
import { OFFICIAL_DEMO_SESSION, seedOfficialDemoSession } from '../src/demo-session.js';
import { SqliteSessionRepository } from '../src/session-repository.js';

function createTemporaryConfig(): ServerConfig {
  const dataDirectory = mkdtempSync(join(tmpdir(), 'pnp-engine-demo-session-'));

  return {
    host: '127.0.0.1',
    port: 0,
    dataDirectory,
    databasePath: join(dataDirectory, 'test.sqlite'),
  };
}

describe('official demo session', () => {
  it('creates the empty Ravenhill reference session once and preserves user data', () => {
    const config = createTemporaryConfig();
    const handle = initializeDatabase(config);
    const repository = new SqliteSessionRepository(handle.database);

    try {
      repository.createSession({
        id: 'user-session',
        name: 'Meine Sitzung',
        joinCode: 'PRIVATE1',
        lobbyState: 'OPEN',
        createdAt: '2026-10-02T10:00:00.000Z',
      });

      const firstSeed = seedOfficialDemoSession(repository);
      const secondSeed = seedOfficialDemoSession(repository);

      expect(firstSeed).toEqual({
        created: true,
        session: {
          id: OFFICIAL_DEMO_SESSION.id,
          name: OFFICIAL_DEMO_SESSION.name,
          lobbyState: OFFICIAL_DEMO_SESSION.lobbyState,
          createdAt: OFFICIAL_DEMO_SESSION.createdAt,
          updatedAt: OFFICIAL_DEMO_SESSION.createdAt,
        },
      });
      expect(secondSeed).toEqual({ created: false, session: firstSeed.session });
      expect(repository.findActiveSessionCode(OFFICIAL_DEMO_SESSION.id)?.code).toBe('RAVEN01');
      expect(repository.listPlayers(OFFICIAL_DEMO_SESSION.id)).toEqual([]);
      expect(repository.findSessionById('user-session')?.name).toBe('Meine Sitzung');
    } finally {
      handle.database.close();
      rmSync(config.dataDirectory, { recursive: true, force: true });
    }
  });
});
