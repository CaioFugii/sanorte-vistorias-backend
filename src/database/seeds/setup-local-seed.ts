import { existsSync } from 'fs';
import * as path from 'path';
import { config } from 'dotenv';
import { SNAPSHOT_RELATIVE_PATH } from './prd-seed.config';
import { dumpFromPrd } from './dump-from-prd';
import { loadPrdSnapshot } from './load-prd-seed';

config();

async function setupLocalSeed(): Promise<void> {
  const snapshotPath = path.resolve(process.cwd(), SNAPSHOT_RELATIVE_PATH);
  if (!existsSync(snapshotPath)) {
    console.log('Snapshot de PRD não encontrado. Gerando dump...');
    await dumpFromPrd();
  } else {
    console.log(`Usando snapshot existente em ${SNAPSHOT_RELATIVE_PATH}`);
  }

  await loadPrdSnapshot();
}

setupLocalSeed().catch((error) => {
  console.error('Erro no seed local:', error);
  process.exit(1);
});
