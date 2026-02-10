import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  uploadMaxSize: parseInt(process.env.UPLOAD_MAX_SIZE || '5242880', 10), // 5MB default
  storagePath: process.env.STORAGE_PATH || './storage',
}));
