const { port } = require('./config/env');
const app = require('./app');
const prisma = require('./lib/prisma');

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Server listening on port ${port}`);
});

const shutdown = async () => {
  server.close();
  await prisma.$disconnect();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);