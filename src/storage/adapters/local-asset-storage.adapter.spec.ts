import { existsSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import * as path from 'path';
import { tmpdir } from 'os';
import {
  LocalAssetStorageAdapter,
  resolveSafeLocalPath,
} from './local-asset-storage.adapter';

describe('LocalAssetStorageAdapter', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('resolveSafeLocalPath should reject path traversal', () => {
    expect(() => resolveSafeLocalPath('/tmp/storage', '../secret.txt')).toThrow();
  });

  it('uploadImage should write a file and return a local /files URL', async () => {
    const storagePath = path.join(
      tmpdir(),
      `sanorte-local-storage-${Date.now()}`,
    );
    process.env.STORAGE_PATH = storagePath;
    process.env.PUBLIC_API_URL = 'http://localhost:3000';

    const adapter = new LocalAssetStorageAdapter();
    const result = await adapter.uploadImage(Buffer.from('fake-image'), {
      folder: 'quality/evidences',
    });

    expect(result.url).toMatch(
      /^http:\/\/localhost:3000\/files\/quality\/evidences\/.+\.jpg$/,
    );
    expect(existsSync(path.join(storagePath, result.publicId))).toBe(true);

    await adapter.deleteAsset(result.publicId);
    expect(existsSync(path.join(storagePath, result.publicId))).toBe(false);
  });

  it('uploadImageFromPath should copy the source file', async () => {
    const storagePath = path.join(
      tmpdir(),
      `sanorte-local-storage-${Date.now()}`,
    );
    const source = path.join(storagePath, 'source.png');
    await mkdir(storagePath, { recursive: true });
    await writeFile(source, Buffer.from('png'));
    process.env.STORAGE_PATH = storagePath;
    process.env.PUBLIC_API_URL = 'http://localhost:3000';

    const adapter = new LocalAssetStorageAdapter();
    const result = await adapter.uploadImageFromPath(source, {
      folder: 'quality/signatures',
    });

    expect(result.format).toBe('png');
    expect(existsSync(path.join(storagePath, result.publicId))).toBe(true);
  });

  it('createDirectUpload should fall back to proxy mode', async () => {
    const adapter = new LocalAssetStorageAdapter();
    await expect(adapter.createDirectUpload({ contentType: 'image/jpeg' })).resolves.toEqual({
      mode: 'proxy',
    });
  });
});
