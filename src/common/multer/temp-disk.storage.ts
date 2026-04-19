import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import * as os from 'os';
import * as path from 'path';

/**
 * Grava upload em `os.tmpdir()` (ex.: /tmp no Heroku) para não manter o arquivo inteiro no heap.
 * Prefixo distinto por rota facilita inspeção de arquivos temporários.
 */
export function createTempDiskStorage(prefix: string) {
  return diskStorage({
    destination: os.tmpdir(),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '');
      const safe =
        ext && /^\.[a-z0-9]+$/i.test(ext)
          ? ext.slice(0, 12).toLowerCase()
          : '';
      cb(null, `${prefix}-${randomUUID()}${safe}`);
    },
  });
}
