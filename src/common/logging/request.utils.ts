import { randomUUID } from 'crypto';
import { Request } from 'express';

type AuthenticatedRequest = Request & {
  requestId?: string;
  user?: {
    id?: string;
    email?: string;
    role?: string;
  };
};

export function ensureRequestId(request: Request): string {
  const req = request as AuthenticatedRequest;
  if (!req.requestId) {
    req.requestId = randomUUID();
  }
  return req.requestId;
}

export function getRequestContext(request: Request) {
  const req = request as AuthenticatedRequest;

  return {
    requestId: ensureRequestId(request),
    method: req.method,
    path: req.originalUrl ?? req.url,
    userId: req.user?.id ?? null,
    userEmail: req.user?.email ?? null,
    userRole: req.user?.role ?? null,
    ip: req.ip,
    userAgent: req.headers['user-agent'] ?? null,
  };
}
