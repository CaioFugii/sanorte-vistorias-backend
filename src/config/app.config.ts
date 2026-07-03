import { registerAs } from '@nestjs/config';

function resolveJwtSecret(): string {
  const jwtSecret = process.env.JWT_SECRET?.trim();
  const isProduction = process.env.NODE_ENV === 'production';

  if (jwtSecret) {
    return jwtSecret;
  }

  if (isProduction) {
    throw new Error('JWT_SECRET must be defined in production environment.');
  }

  return 'your-secret-key-change-in-production';
}

function resolveCorsOrigins(): string[] {
  const rawOrigins = process.env.CORS_ORIGINS?.trim();

  if (!rawOrigins) {
    return ['http://localhost:5173'];
  }

  return rawOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export default registerAs('app', () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  jwtSecret: resolveJwtSecret(),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  corsOrigins: resolveCorsOrigins(),
  authLoginThrottleLimit: parseInt(
    process.env.AUTH_LOGIN_THROTTLE_LIMIT || '5',
    10,
  ),
  authLoginThrottleTtlMs: parseInt(
    process.env.AUTH_LOGIN_THROTTLE_TTL_MS || '60000',
    10,
  ),
  uploadMaxSize: parseInt(process.env.UPLOAD_MAX_SIZE || '5242880', 10), // 5MB default
  storagePath: process.env.STORAGE_PATH || './storage',
}));
