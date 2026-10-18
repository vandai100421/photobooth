const env = require('./env');

let sentry = null;
let enabled = false;

// Khởi tạo Sentry khi có SENTRY_DSN. Không có DSN → bỏ qua hoàn toàn để
// không tốn tài nguyên và không vỡ khi chạy local/dev.
if (env.SENTRY_DSN) {
  sentry = require('@sentry/node');
  sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    tracesSampleRate: env.NODE_ENV === 'production' ? 0.1 : 0,
  });
  enabled = true;
}

const isEnabled = () => enabled;

const captureException = (err, context) => {
  if (!enabled) return;
  sentry.withScope((scope) => {
    if (context) scope.setContext('extra', context);
    sentry.captureException(err);
  });
};

const captureMessage = (message, level = 'info') => {
  if (!enabled) return;
  sentry.captureMessage(message, level);
};

module.exports = { captureException, captureMessage, isEnabled };
