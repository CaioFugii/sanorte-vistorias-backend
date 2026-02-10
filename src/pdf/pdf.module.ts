import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PdfService } from './pdf.service';
import { PdfController } from './pdf.controller';
import { Inspection } from '../entities';
import { FilesModule } from '../files/files.module';

@Module({
  imports: [TypeOrmModule.forFeature([Inspection]), FilesModule],
  controllers: [PdfController],
  providers: [PdfService],
})
export class PdfModule {}
