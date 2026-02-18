import {
  BadRequestException,
  Controller,
  Delete,
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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CloudinaryService } from '../cloudinary/cloudinary.service';

@Controller('uploads')
@UseGuards(JwtAuthGuard)
export class UploadsController {
  constructor(private readonly cloudinaryService: CloudinaryService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: /^image\/.*/ }),
        ],
      }),
    )
    file: Express.Multer.File,
    @Body('folder') folder?: string,
  ) {
    if (!file?.buffer) {
      throw new BadRequestException('File is required');
    }

    const uploaded = await this.cloudinaryService.uploadImage(file.buffer, {
      folder: this.resolveFolder(folder),
    });

    return {
      publicId: uploaded.public_id,
      url: uploaded.secure_url,
      resourceType: uploaded.resource_type,
      bytes: uploaded.bytes,
      format: uploaded.format,
      width: uploaded.width,
      height: uploaded.height,
    };
  }

  @Delete(':publicId(*)')
  async delete(@Param('publicId') publicId: string) {
    const decodedPublicId = decodeURIComponent(publicId);
    await this.cloudinaryService.deleteAsset(decodedPublicId);
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
