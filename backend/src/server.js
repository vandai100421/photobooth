const app = require('./app');
const env = require('./config/env');
const logger = require('./utils/logger');
const { initScheduler, stopScheduler } = require('./scheduler/cron');

const server = app.listen(env.PORT, () => {
  logger.info(`Server running on port ${env.PORT} (${env.NODE_ENV})`);
});

// Start the cron scheduler once the HTTP server is listening.
initScheduler().catch((err) => {
  logger.error(`Failed to initialize cron scheduler: ${err.message}`);
});

// Graceful shutdown: stop cron tasks then close the HTTP server.
const shutdown = (signal) => {
  logger.info(`${signal} received, shutting down...`);
  stopScheduler();
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = server;
