import { createServer } from 'http';
import { app } from './app.js';
import { loadConfig } from './config/index.js';

const config = loadConfig();

const port = Number(config.connector.port);
const server = createServer(app);

server.listen(port, () => {
  console.log(`🚀 Connector listening on port ${port}`);
});
