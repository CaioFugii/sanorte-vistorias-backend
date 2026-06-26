import { Injectable } from '@nestjs/common';
import { UploadApiResponse } from 'cloudinary';
import { CloudinaryService } from '../../cloudinary/cloudinary.service';
import {
  AssetStorage,
  AssetUploadOptions,
  AssetUploadResult,
} from '../asset-storage.interface';

@Injectable()
export class CloudinaryAssetStorageAdapter implements AssetStorage {
  constructor(private readonly cloudinaryService: CloudinaryService) {}

  uploadImageFromPath(
    filePath: string,
    options: AssetUploadOptions = {},
  ): Promise<AssetUploadResult> {
    return this.cloudinaryService
      .uploadImageFromPath(filePath, { folder: options.folder })
      .then((result) => this.mapResult(result));
  }

  uploadImage(
    buffer: Buffer,
    options: AssetUploadOptions = {},
  ): Promise<AssetUploadResult> {
    return this.cloudinaryService
      .uploadImage(buffer, { folder: options.folder })
      .then((result) => this.mapResult(result));
  }

  async deleteAsset(assetId: string): Promise<void> {
    await this.cloudinaryService.deleteAsset(assetId);
  }

  private mapResult(uploaded: UploadApiResponse): AssetUploadResult {
    return {
      publicId: uploaded.public_id,
      url: uploaded.secure_url,
      resourceType: uploaded.resource_type,
      bytes: uploaded.bytes,
      format: uploaded.format,
      width: uploaded.width ?? 0,
      height: uploaded.height ?? 0,
    };
  }
}
