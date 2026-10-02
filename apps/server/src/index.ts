import { createServer } from './app.js';
import { loadServerConfig } from './config.js';
import { initializeDatabase } from './database.js';
import { seedOfficialDemoSession } from './demo-session.js';
import { detectLocalIpv4 } from './network.js';
import { SqliteSessionRepository } from './session-repository.js';
import { SessionStateManager } from './session-state-manager.js';

const config = loadServerConfig();
const network = detectLocalIpv4();
const databaseHandle = initializeDatabase(config);
const repository = new SqliteSessionRepository(databaseHandle.database);
seedOfficialDemoSession(repository);
const sessionStateManager = new SessionStateManager({ repository });
const server = createServer({
  sessionRepository: repository,
  sessionStateManager,
  ...(config.gameMasterSecret === undefined ? {} : { gameMasterSecret: config.gameMasterSecret }),
});

server.addHook('onClose', () => {
  databaseHandle.database.close();
});

try {
  await server.listen({ host: config.host, port: config.port });
} catch (error) {
  await server.close();
  throw error;
}

const localUrl =
  network.selected === undefined ? undefined : `http://${network.selected.address}:${config.port}`;

console.info(`PNP ENGINE server started at ${localUrl ?? `http://localhost:${config.port}`}`);
