import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
/**
 * @deprecated Local disk storage is legacy-only. New uploads must use Cloudinary.
 */
export class FilesService {
  private readonly storagePath: string;
  private readonly evidencesPath: string;
  private readonly signaturesPath: string;

  constructor(private configService: ConfigService) {
    this.storagePath = this.configService.get<string>('app.storagePath') || './storage';
    this.evidencesPath = path.join(this.storagePath, 'evidences');
    this.signaturesPath = path.join(this.storagePath, 'signatures');

    // Criar diretórios se não existirem
    [this.storagePath, this.evidencesPath, this.signaturesPath].forEach((dir) => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  async saveEvidence(
    file: Express.Multer.File,
    inspectionId: string,
    inspectionItemId?: string,
  ): Promise<{ filePath: string; fileName: string; mimeType: string; size: number }> {
    const timestamp = Date.now();
    const extension = path.extname(file.originalname);
    const fileName = `${inspectionId}_${inspectionItemId || 'general'}_${timestamp}${extension}`;
    const filePath = path.join(this.evidencesPath, fileName);

    fs.writeFileSync(filePath, file.buffer);

    return {
      filePath: `evidences/${fileName}`,
      fileName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    };
  }

  async saveSignature(
    imageBuffer: Buffer,
    inspectionId: string,
    mimeType: string = 'image/png',
  ): Promise<string> {
    const timestamp = Date.now();
    const extension = mimeType.includes('png') ? '.png' : '.jpg';
    const fileName = `signature_${inspectionId}_${timestamp}${extension}`;
    const filePath = path.join(this.signaturesPath, fileName);

    fs.writeFileSync(filePath, imageBuffer);

    return `signatures/${fileName}`;
  }

  async getFile(filePath: string): Promise<Buffer> {
    if (/^https?:\/\//i.test(filePath)) {
      const response = await fetch(filePath);
      if (!response.ok) {
        throw new Error('File not found');
      }
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    }

    const fullPath = path.join(this.storagePath, filePath);
    if (!fs.existsSync(fullPath)) {
      throw new Error('File not found');
    }
    return fs.readFileSync(fullPath);
  }

  async deleteFile(filePath: string): Promise<void> {
    const fullPath = path.join(this.storagePath, filePath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  }
}
