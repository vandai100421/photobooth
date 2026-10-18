const logger = require('../utils/logger');
const env = require('../config/env');
const sentry = require('../config/sentry');

// Centralized error handler. Must have 4 args to be recognised by Express.
const errorHandler = (err, req, _res, _next) => {
  const statusCode = err.statusCode && err.statusCode >= 400
    ? err.statusCode
    : 500;

  if (statusCode >= 500) {
    logger.error(err.stack || err.message);
    sentry.captureException(err, {
      method: req.method,
      path: req.originalUrl,
    });
  } else {
    logger.warn(err.message);
  }

  const message = statusCode >= 500 && env.NODE_ENV === 'production'
    ? 'Internal server error'
    : err.message;

  res.status(statusCode).json({ success: false, error: message });
};

module.exports = errorHandler;
