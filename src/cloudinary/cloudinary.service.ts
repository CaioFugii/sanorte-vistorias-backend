import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { v2 as cloudinary, UploadApiOptions, UploadApiResponse } from 'cloudinary';

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

  uploadImage(
    buffer: Buffer,
    options: UploadApiOptions = {},
  ): Promise<UploadApiResponse> {
    this.assertConfigured();

    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { resource_type: 'image', ...options },
        (error, result) => {
          if (error || !result) {
            reject(error || new Error('Cloudinary upload failed'));
            return;
          }
          resolve(result);
        },
      );

      stream.end(buffer);
    });
  }

  async deleteAsset(publicId: string): Promise<{ result: string }> {
    this.assertConfigured();
    return cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
  }

  private assertConfigured(): void {
    if (!this.hasCloudinaryUrl) {
      throw new InternalServerErrorException('CLOUDINARY_URL is not configured');
    }
  }
}
