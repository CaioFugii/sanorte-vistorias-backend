import {
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
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
  DirectUploadDescriptor,
  DirectUploadOptions,
  StoredObjectStat,
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

  async createDirectUpload(
    options: DirectUploadOptions,
  ): Promise<DirectUploadDescriptor> {
    this.assertConfigured();

    const folder = options.folder || 'quality/evidences';
    const ext = this.extensionForContentType(options.contentType);
    const key = `${folder}/${randomUUID()}.${ext}`;
    const expiresInSeconds = options.expiresInSeconds ?? 60;
    const contentType = options.contentType;

    const uploadUrl = await getSignedUrl(
      this.client!,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: contentType,
      }),
      { expiresIn: expiresInSeconds },
    );

    return {
      mode: 'direct',
      method: 'PUT',
      uploadUrl,
      headers: { 'Content-Type': contentType },
      storageKey: key,
      publicUrl: this.buildPublicUrl(key),
      expiresInSeconds,
    };
  }

  getPublicUrl(storageKey: string): string | null {
    const key = storageKey.trim();
    if (!key) {
      return null;
    }
    return this.buildPublicUrl(key);
  }

  async statObject(storageKey: string): Promise<StoredObjectStat | null> {
    this.assertConfigured();

    const key = storageKey.trim();
    if (!key) {
      return null;
    }

    try {
      const result = await this.client!.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
      return {
        contentLength: result.ContentLength ?? 0,
        contentType: result.ContentType,
      };
    } catch (error) {
      const status = (error as { $metadata?: { httpStatusCode?: number } })
        .$metadata?.httpStatusCode;
      if (status === 404 || status === 403) {
        return null;
      }
      throw error;
    }
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

  /** Backfill/migration: upload preserving an explicit S3 key. */
  async putObjectWithKey(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<{ key: string; url: string; bytes: number }> {
    this.assertConfigured();

    const normalizedKey = key.trim();
    if (!normalizedKey) {
      throw new InternalServerErrorException('S3 object key is required');
    }

    await this.client!.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: normalizedKey,
        Body: body,
        ContentType: contentType,
      }),
    );

    return {
      key: normalizedKey,
      url: this.buildPublicUrl(normalizedKey),
      bytes: body.length,
    };
  }

  buildPublicUrl(key: string): string {
    return `${this.publicBaseUrl}/${key.trim()}`;
  }

  getBucketName(): string {
    return this.bucket;
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  private buildResult(
    key: string,
    bytes: number,
    format: string,
  ): AssetUploadResult {
    return {
      publicId: key,
      url: this.buildPublicUrl(key),
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

  private extensionForContentType(contentType: string): string {
    switch (contentType.toLowerCase()) {
      case 'image/png':
        return 'png';
      case 'image/webp':
        return 'webp';
      case 'image/jpeg':
      case 'image/jpg':
      default:
        return 'jpg';
    }
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
