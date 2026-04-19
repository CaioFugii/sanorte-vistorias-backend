import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { createReadStream } from 'fs';
import { Readable } from 'stream';
import {
  v2 as cloudinary,
  UploadApiOptions,
  UploadApiResponse,
} from 'cloudinary';

@Injectable()
export class CloudinaryService {
  private readonly hasCloudinaryUrl: boolean;

  constructor() {
    const cloudinaryUrl = process.env.CLOUDINARY_URL;
    this.hasCloudinaryUrl = Boolean(cloudinaryUrl);
    if (cloudinaryUrl) {
      cloudinary.config(cloudinaryUrl);
    }
  }

  /** Buffer já em memória (ex.: base64). Usa o mesmo pipeline de streaming que arquivo em disco. */
  uploadImage(
    buffer: Buffer,
    options: UploadApiOptions = {},
  ): Promise<UploadApiResponse> {
    return this.uploadImageStream(Readable.from(buffer), options);
  }

  /**
   * Upload from a temp file path (e.g. Multer diskStorage) without holding the full file in the Node heap.
   */
  uploadImageFromPath(
    filePath: string,
    options: UploadApiOptions = {},
  ): Promise<UploadApiResponse> {
    const stream = createReadStream(filePath);
    return this.uploadImageStream(stream, options);
  }

  uploadImageStream(
    stream: Readable,
    options: UploadApiOptions = {},
  ): Promise<UploadApiResponse> {
    this.assertConfigured();

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { resource_type: 'image', ...options },
        (error, result) => {
          if (error || !result) {
            stream.destroy(error || undefined);
            reject(error || new Error('Cloudinary upload failed'));
            return;
          }
          resolve(result);
        },
      );

      stream.once('error', (err: Error) => {
        uploadStream.destroy(err);
        reject(err);
      });
      uploadStream.once('error', (err: Error) => {
        stream.destroy(err);
        reject(err);
      });
      stream.pipe(uploadStream);
    });
  }

  async deleteAsset(publicId: string): Promise<{ result: string }> {
    this.assertConfigured();
    return cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
  }

  private assertConfigured(): void {
    if (!this.hasCloudinaryUrl) {
      throw new InternalServerErrorException(
        'CLOUDINARY_URL is not configured',
      );
    }
  }
}
