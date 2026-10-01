import { createServer } from './app.js';

const server = createServer();
const port = Number(process.env.PORT ?? 3000);

await server.listen({ host: '127.0.0.1', port });
