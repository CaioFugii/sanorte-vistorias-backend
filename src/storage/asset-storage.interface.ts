export interface AssetUploadOptions {
  folder?: string;
}

export interface AssetUploadResult {
  publicId: string;
  url: string;
  resourceType: string;
  bytes: number;
  format: string;
  width: number;
  height: number;
}

export type DirectUploadDescriptor =
  | { mode: 'proxy' }
  | {
      mode: 'direct';
      method: 'PUT';
      uploadUrl: string;
      headers: Record<string, string>;
      storageKey: string;
      publicUrl: string;
      expiresInSeconds: number;
    };

export type DirectUploadOptions = {
  folder?: string;
  contentType: string;
  expiresInSeconds?: number;
};

export type StoredObjectStat = {
  contentLength: number;
  contentType?: string;
};

export interface AssetStorage {
  uploadImageFromPath(
    filePath: string,
    options?: AssetUploadOptions,
  ): Promise<AssetUploadResult>;

  uploadImage(
    buffer: Buffer,
    options?: AssetUploadOptions,
  ): Promise<AssetUploadResult>;

  deleteAsset(assetId: string): Promise<void>;

  createDirectUpload(
    options: DirectUploadOptions,
  ): Promise<DirectUploadDescriptor>;

  getPublicUrl(storageKey: string): string | null;

  statObject(storageKey: string): Promise<StoredObjectStat | null>;
}

export const ASSET_STORAGE = Symbol('ASSET_STORAGE');

export function resolveStorageProvider(): 'cloudinary' | 's3' | 'local' {
  const provider = (process.env.STORAGE_PROVIDER || 'cloudinary')
    .trim()
    .toLowerCase();
  if (provider === 's3') {
    return 's3';
  }
  if (provider === 'local') {
    return 'local';
  }
  return 'cloudinary';
}
