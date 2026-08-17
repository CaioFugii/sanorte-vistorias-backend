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

export type ProcessMemorySnapshot = {
  rssMb: number;
  heapUsedMb: number;
  heapTotalMb: number;
  externalMb: number;
};

export function bytesToMb(bytes: number): number {
  return Math.round((bytes / (1024 * 1024)) * 10) / 10;
}

export function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

export function getProcessMemorySnapshot(): ProcessMemorySnapshot {
  const mem = process.memoryUsage();
  return {
    rssMb: bytesToMb(mem.rss),
    heapUsedMb: bytesToMb(mem.heapUsed),
    heapTotalMb: bytesToMb(mem.heapTotal),
    externalMb: bytesToMb(mem.external),
  };
}

export function withMemoryDelta(
  started: ProcessMemorySnapshot,
  ended: ProcessMemorySnapshot = getProcessMemorySnapshot(),
): ProcessMemorySnapshot & { rssDeltaMb: number; heapUsedDeltaMb: number } {
  return {
    ...ended,
    rssDeltaMb: roundToOneDecimal(ended.rssMb - started.rssMb),
    heapUsedDeltaMb: roundToOneDecimal(ended.heapUsedMb - started.heapUsedMb),
  };
}
