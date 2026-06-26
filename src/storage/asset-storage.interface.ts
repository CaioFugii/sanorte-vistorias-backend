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
}

export const ASSET_STORAGE = Symbol('ASSET_STORAGE');

export function resolveStorageProvider(): 'cloudinary' | 's3' {
  const provider = (process.env.STORAGE_PROVIDER || 'cloudinary')
    .trim()
    .toLowerCase();
  return provider === 's3' ? 's3' : 'cloudinary';
}
