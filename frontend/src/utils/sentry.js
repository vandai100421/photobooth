import * as Sentry from '@sentry/react';

// Chỉ bật Sentry khi có VITE_SENTRY_DSN (production). Bỏ trống → tắt hoàn toàn.
const dsn = import.meta.env.VITE_SENTRY_DSN;

export const initSentry = () => {
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.1,
  });
};

export const captureException = (error, context) => {
  if (!dsn) return;
  Sentry.withScope((scope) => {
    if (context) scope.setContext('extra', context);
    Sentry.captureException(error);
  });
};

export const isSentryEnabled = () => Boolean(dsn);
