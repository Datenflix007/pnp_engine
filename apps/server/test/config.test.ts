import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createTestServerConfig, DEFAULT_DATABASE_FILE, loadServerConfig } from '../src/config.js';

const projectRoot = resolve(process.cwd(), 'config-test-root');

describe('server configuration', () => {
  it('uses LAN-friendly defaults and a repository-local data path', () => {
    expect(loadServerConfig({}, projectRoot)).toEqual({
      host: '0.0.0.0',
      port: 3000,
      dataDirectory: resolve(projectRoot, 'data'),
      databasePath: resolve(projectRoot, 'data', DEFAULT_DATABASE_FILE),
    });
  });

  it('accepts explicit host, port, data directory and database file', () => {
    expect(
      loadServerConfig(
        {
          PNP_ENGINE_HOST: '127.0.0.1',
          PNP_ENGINE_PORT: '3100',
          PNP_ENGINE_DATA_DIR: 'runtime-data',
          PNP_ENGINE_DATABASE_FILE: 'ravenhill.sqlite',
        },
        projectRoot,
      ),
    ).toEqual({
      host: '127.0.0.1',
      port: 3100,
      dataDirectory: resolve(projectRoot, 'runtime-data'),
      databasePath: resolve(projectRoot, 'runtime-data', 'ravenhill.sqlite'),
    });
  });

  it('rejects invalid ports and unsafe database paths', () => {
    expect(() => loadServerConfig({ PNP_ENGINE_PORT: '0' }, projectRoot)).toThrow(
      'PNP_ENGINE_PORT',
    );
    expect(() =>
      loadServerConfig({ PNP_ENGINE_DATABASE_FILE: '../session.sqlite' }, projectRoot),
    ).toThrow('PNP_ENGINE_DATABASE_FILE');
  });

  it('provides a loopback-only configuration with an ephemeral test port', () => {
    expect(createTestServerConfig(projectRoot)).toEqual({
      host: '127.0.0.1',
      port: 0,
      dataDirectory: resolve(projectRoot, '.test-data'),
      databasePath: resolve(projectRoot, '.test-data', DEFAULT_DATABASE_FILE),
    });
  });
});
