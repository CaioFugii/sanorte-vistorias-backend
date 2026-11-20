import { StorageProvider } from '../enums';
import { S3AssetStorageAdapter } from '../../storage/adapters/s3-asset-storage.adapter';
import { ServiceOrderSpreadsheetStorage } from '../../service-orders/service-order-spreadsheet.storage';
import { SpreadsheetStorageService } from './spreadsheet-storage.service';

describe('SpreadsheetStorageService', () => {
  const originalProvider = process.env.STORAGE_PROVIDER;

  afterEach(() => {
    if (originalProvider === undefined) {
      delete process.env.STORAGE_PROVIDER;
    } else {
      process.env.STORAGE_PROVIDER = originalProvider;
    }
  });

  function storage() {
    const putObjectWithKey = jest.fn().mockResolvedValue({});
    const s3 = { putObjectWithKey } as unknown as S3AssetStorageAdapter;
    return { service: new SpreadsheetStorageService(s3), putObjectWithKey };
  }

  it('grava a chave com o prefixo pedido quando o provider é s3', async () => {
    process.env.STORAGE_PROVIDER = 's3';
    const { service, putObjectWithKey } = storage();
    const buffer = Buffer.from('xlsx');

    const saved = await service.save(
      buffer,
      'Modelo.xlsx',
      'investment-works/imports',
    );

    expect(saved.provider).toBe(StorageProvider.S3);
    expect(saved.key).toMatch(/^investment-works\/imports\/[0-9a-f-]+\.xlsx$/);
    expect(putObjectWithKey).toHaveBeenCalledWith(
      saved.key,
      buffer,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
  });

  it('o Global continua gravando em service-orders/imports', async () => {
    process.env.STORAGE_PROVIDER = 's3';
    const { service, putObjectWithKey } = storage();
    const orders = new ServiceOrderSpreadsheetStorage(service);

    const saved = await orders.save(Buffer.from('xls'), 'arquivo.XLS');

    expect(saved.key).toMatch(/^service-orders\/imports\/[0-9a-f-]+\.xls$/);
    expect(putObjectWithKey).toHaveBeenCalledWith(
      saved.key,
      expect.any(Buffer),
      'application/vnd.ms-excel',
    );
  });

  it('apaga o objeto no S3 pela chave gravada', async () => {
    const deleteAsset = jest.fn().mockResolvedValue(undefined);
    const service = new SpreadsheetStorageService({
      deleteAsset,
    } as unknown as S3AssetStorageAdapter);

    await service.remove(
      'investment-works/imports/file.xlsx',
      StorageProvider.S3,
    );

    expect(deleteAsset).toHaveBeenCalledWith(
      'investment-works/imports/file.xlsx',
    );
  });
});
