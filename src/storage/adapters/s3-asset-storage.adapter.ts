import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import {
  AssetStorage,
  AssetUploadOptions,
  AssetUploadResult,
} from '../asset-storage.interface';

@Injectable()
export class S3AssetStorageAdapter implements AssetStorage {
  private readonly logger = new Logger(S3AssetStorageAdapter.name);
  private readonly client: S3Client | null;
  private readonly bucket: string;
  private readonly region: string;
  private readonly publicBaseUrl: string;

  constructor() {
    this.region = process.env.AWS_REGION?.trim() || 'sa-east-1';
    this.bucket = process.env.AWS_S3_BUCKET?.trim() || '';
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();

    this.publicBaseUrl = (
      process.env.AWS_S3_PUBLIC_BASE_URL?.trim() ||
      `https://${this.bucket}.s3.${this.region}.amazonaws.com`
    ).replace(/\/$/, '');

    this.client =
      this.bucket && accessKeyId && secretAccessKey
        ? new S3Client({
            region: this.region,
            credentials: { accessKeyId, secretAccessKey },
          })
        : null;
  }

  async uploadImageFromPath(
    filePath: string,
    options: AssetUploadOptions = {},
  ): Promise<AssetUploadResult> {
    this.assertConfigured();

    const folder = options.folder || 'quality/evidences';
    const ext = this.resolveExtension(filePath);
    const key = `${folder}/${randomUUID()}.${ext}`;
    const fileStat = await stat(filePath);

    await this.client!.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: createReadStream(filePath),
        ContentType: this.contentTypeForExtension(ext),
      }),
    );

    this.logger.log(`Uploaded S3 object key=${key} bytes=${fileStat.size}`);

    return this.buildResult(key, fileStat.size, ext);
  }

  async uploadImage(
    buffer: Buffer,
    options: AssetUploadOptions = {},
  ): Promise<AssetUploadResult> {
    this.assertConfigured();

    const folder = options.folder || 'quality/evidences';
    const ext = 'jpg';
    const key = `${folder}/${randomUUID()}.${ext}`;

    await this.client!.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: this.contentTypeForExtension(ext),
      }),
    );

    this.logger.log(`Uploaded S3 object key=${key} bytes=${buffer.length}`);

    return this.buildResult(key, buffer.length, ext);
  }

  async deleteAsset(assetId: string): Promise<void> {
    this.assertConfigured();

    const key = assetId.trim();
    if (!key) {
      return;
    }

    await this.client!.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );

    this.logger.log(`Deleted S3 object key=${key}`);
  }

  private buildResult(
    key: string,
    bytes: number,
    format: string,
  ): AssetUploadResult {
    return {
      publicId: key,
      url: `${this.publicBaseUrl}/${key}`,
      resourceType: 'image',
      bytes,
      format,
      width: 0,
      height: 0,
    };
  }

  private resolveExtension(filePath: string): string {
    const ext = extname(filePath).replace(/^\./, '').toLowerCase();
    return ext || 'jpg';
  }

  private contentTypeForExtension(ext: string): string {
    switch (ext) {
      case 'png':
        return 'image/png';
      case 'webp':
        return 'image/webp';
      case 'gif':
        return 'image/gif';
      case 'jpeg':
      case 'jpg':
      default:
        return 'image/jpeg';
    }
  }

  private assertConfigured(): void {
    if (!this.client) {
      throw new InternalServerErrorException(
        'S3 storage is not configured (AWS_S3_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)',
      );
    }
  }
}
