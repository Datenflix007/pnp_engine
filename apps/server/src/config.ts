import { basename, isAbsolute, resolve } from 'node:path';

export const DEFAULT_SERVER_HOST = '0.0.0.0';
export const DEFAULT_SERVER_PORT = 3000;
export const DEFAULT_DATA_DIRECTORY = 'data';
export const DEFAULT_DATABASE_FILE = 'pnp-engine.sqlite';

const PROJECT_ROOT = resolve(import.meta.dirname, '../../..');

export interface ServerConfig {
  readonly host: string;
  readonly port: number;
  readonly dataDirectory: string;
  readonly databasePath: string;
  /** Kept only in process memory and never written to the local database. */
  readonly gameMasterSecret?: string;
}

/**
 * Loads the local server configuration. Relative data paths are resolved from
 * the repository root, not the calling package, so development and production
 * use the same data location.
 */
export function loadServerConfig(
  environment: NodeJS.ProcessEnv = process.env,
  projectRoot: string = PROJECT_ROOT,
): ServerConfig {
  const host = readText(environment, 'PNP_ENGINE_HOST', DEFAULT_SERVER_HOST);
  const port = readPort(environment.PNP_ENGINE_PORT);
  const dataDirectory = resolve(
    projectRoot,
    readText(environment, 'PNP_ENGINE_DATA_DIR', DEFAULT_DATA_DIRECTORY),
  );
  const databaseFile = readDatabaseFile(environment.PNP_ENGINE_DATABASE_FILE);

  return {
    host,
    port,
    dataDirectory,
    databasePath: resolve(dataDirectory, databaseFile),
    ...(environment.PNP_ENGINE_GAME_MASTER_SECRET === undefined
      ? {}
      : { gameMasterSecret: readText(environment, 'PNP_ENGINE_GAME_MASTER_SECRET', '') }),
  };
}

/** A non-networked default for integration tests and local test harnesses. */
export function createTestServerConfig(projectRoot: string = PROJECT_ROOT): ServerConfig {
  const dataDirectory = resolve(projectRoot, '.test-data');

  return {
    host: '127.0.0.1',
    port: 0,
    dataDirectory,
    databasePath: resolve(dataDirectory, DEFAULT_DATABASE_FILE),
  };
}

function readText(environment: NodeJS.ProcessEnv, name: string, defaultValue: string): string {
  const value = environment[name];

  if (value === undefined) {
    return defaultValue;
  }

  const trimmedValue = value.trim();

  if (trimmedValue.length === 0) {
    throw new Error(`${name} must not be empty.`);
  }

  return trimmedValue;
}

function readPort(value: string | undefined): number {
  if (value === undefined) {
    return DEFAULT_SERVER_PORT;
  }

  const port = Number(value);

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PNP_ENGINE_PORT must be an integer between 1 and 65535.');
  }

  return port;
}

function readDatabaseFile(value: string | undefined): string {
  const databaseFile = value === undefined ? DEFAULT_DATABASE_FILE : value.trim();

  if (
    databaseFile.length === 0 ||
    isAbsolute(databaseFile) ||
    basename(databaseFile) !== databaseFile
  ) {
    throw new Error('PNP_ENGINE_DATABASE_FILE must be a local file name.');
  }

  return databaseFile;
}
