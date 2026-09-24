const app = require('../src/app');

// Vercel serverless entry point. Vercel wraps this Express app into a
// serverless function; rewrites in vercel.json route every request here.
// NOTE: the node-cron scheduler is NOT started here — serverless functions
// are ephemeral. Cron jobs are triggered by Vercel Cron via the
// /api/v1/cron/daily endpoint instead (see src/modules/cron).

module.exports = app;
