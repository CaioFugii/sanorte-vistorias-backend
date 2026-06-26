import {
  BadRequestException,
  Controller,
  Delete,
  Inject,
  Param,
  Post,
  Body,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as fs from 'fs/promises';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { createTempDiskStorage } from '../common/multer/temp-disk.storage';
import {
  ASSET_STORAGE,
  AssetStorage,
} from '../storage/asset-storage.interface';

@Controller('uploads')
@UseGuards(JwtAuthGuard)
export class UploadsController {
  constructor(
    @Inject(ASSET_STORAGE) private readonly assetStorage: AssetStorage,
  ) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: createTempDiskStorage('sanorte-upload'),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async upload(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }),
          // diskStorage leaves `buffer` empty; validate declared MIME without reading the whole file into RAM
          new FileTypeValidator({
            fileType: /^image\/.*/,
            skipMagicNumbersValidation: true,
          }),
        ],
      }),
    )
    file: Express.Multer.File,
    @Body('folder') folder?: string,
  ) {
    if (!file?.path) {
      throw new BadRequestException('File is required');
    }

    try {
      const uploaded = await this.assetStorage.uploadImageFromPath(file.path, {
        folder: this.resolveFolder(folder),
      });

      return {
        publicId: uploaded.publicId,
        url: uploaded.url,
        resourceType: uploaded.resourceType,
        bytes: uploaded.bytes,
        format: uploaded.format,
        width: uploaded.width,
        height: uploaded.height,
      };
    } finally {
      await fs.unlink(file.path).catch(() => undefined);
    }
  }

  @Delete(':publicId(*)')
  async delete(@Param('publicId') publicId: string) {
    const decodedPublicId = decodeURIComponent(publicId);
    await this.assetStorage.deleteAsset(decodedPublicId);
    return { ok: true };
  }

  private resolveFolder(folder?: string): string {
    if (!folder) {
      return 'quality/evidences';
    }

    const normalized = folder.trim();
    if (normalized === 'evidences' || normalized === 'quality/evidences') {
      return 'quality/evidences';
    }
    if (normalized === 'signatures' || normalized === 'quality/signatures') {
      return 'quality/signatures';
    }

    return normalized;
  }
}
