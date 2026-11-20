import { Injectable } from '@nestjs/common';
import { SpreadsheetStorageService } from '../common/utils/spreadsheet-storage.service';

const SERVICE_ORDER_IMPORT_PREFIX = 'service-orders/imports';

@Injectable()
export class ServiceOrderSpreadsheetStorage {
  constructor(private readonly storage: SpreadsheetStorageService) {}

  save(
    buffer: Buffer,
    originalName: string,
  ): Promise<{ key: string; provider: string }> {
    return this.storage.save(buffer, originalName, SERVICE_ORDER_IMPORT_PREFIX);
  }

  read(key: string, provider: string): Promise<Buffer> {
    return this.storage.read(key, provider);
  }

  contentTypeForName(fileName: string): string {
    return this.storage.contentTypeForName(fileName);
  }
}
