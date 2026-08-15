export function parseDatabaseUrl(raw: string): URL {
  return new URL(raw);
}

export function isLocalDatabaseHost(host: string): boolean {
  return [
    'localhost',
    '127.0.0.1',
    '::1',
    'postgres',
    'sanorte-postgres',
  ].includes(host);
}

export function assertDumpSourceIsRemote(databaseUrl: string): void {
  const { hostname } = parseDatabaseUrl(databaseUrl);
  if (isLocalDatabaseHost(hostname)) {
    throw new Error(
      'DATABASE_URL_PRD aponta para um host local. Informe o banco de produção.',
    );
  }
}

export function assertLoadTargetIsLocal(databaseUrl: string): void {
  const { hostname } = parseDatabaseUrl(databaseUrl);
  if (!isLocalDatabaseHost(hostname)) {
    throw new Error(
      `Recusando carregar seed em host inesperado (${hostname}). DATABASE_URL deve apontar para o Postgres local.`,
    );
  }
}
