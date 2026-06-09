import * as Sentry from '@sentry/node';

let initialized = false;

function parseSampleRate(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    return undefined;
  }
  return parsed;
}

export function isSentryEnabled(): boolean {
  return Boolean(process.env.SENTRY_DSN?.trim());
}

export function initSentry(): boolean {
  if (initialized || !isSentryEnabled()) {
    return false;
  }

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,
    release:
      process.env.SENTRY_RELEASE ||
      process.env.HEROKU_SLUG_COMMIT ||
      process.env.SOURCE_VERSION,
    tracesSampleRate: parseSampleRate(process.env.SENTRY_TRACES_SAMPLE_RATE),
  });

  initialized = true;
  return true;
}
