import { ForbiddenException } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { ServiceOrderImportLineStatus, UserRole } from '../common/enums';
import { ServiceOrderImportParserService } from './import/service-order-import-parser.service';
import { ServiceOrdersService } from './service-orders.service';

const sectors = [
  { id: 'sector-agua', name: 'AGUA' },
  { id: 'sector-reposicao', name: 'REPOSICAO' },
];

function fileFrom(rows: Array<Record<string, string>>) {
  const sheet = XLSX.utils.json_to_sheet(rows);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'OS');
  const buffer = XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  return {
    buffer,
    originalname: 'ordens.xlsx',
  } as Express.Multer.File;
}

function validRow(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    'Número OS': '1001',
    Família: 'REDE DE ÁGUA',
    'Status da OS': 'FECHADA',
    Endereço: 'Rua A',
    Número: '10',
    Bairro: 'Centro',
    Resultado: 'CONCLUIDO',
    ...overrides,
  };
}

describe('ServiceOrdersService import history', () => {
  let service: ServiceOrdersService;
  let execute: jest.Mock;
  let serviceOrderRepository: {
    find: jest.Mock;
    findOne: jest.Mock;
    delete: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let importRepository: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
    findAndCount: jest.Mock;
  };
  let importLineRepository: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
  };
  let inspectionRepository: { count: jest.Mock };

  beforeEach(() => {
    execute = jest.fn().mockResolvedValue(undefined);
    const query = {
      insert: jest.fn().mockReturnThis(),
      into: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      orUpdate: jest.fn().mockReturnThis(),
      execute,
    };
    let awaitingCreatedId = false;
    serviceOrderRepository = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(async () => {
        if (!awaitingCreatedId) {
          awaitingCreatedId = true;
          return null;
        }
        awaitingCreatedId = false;
        return { id: 'os-created' };
      }),
      delete: jest.fn().mockResolvedValue(undefined),
      createQueryBuilder: jest.fn().mockReturnValue(query),
    };
    importRepository = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ ...value, id: 'import-1' })),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      findAndCount: jest.fn(),
    };
    importLineRepository = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => value),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
    };
    inspectionRepository = {
      count: jest.fn().mockResolvedValue(0),
    };

    service = new ServiceOrdersService(
      serviceOrderRepository as any,
      { find: jest.fn().mockResolvedValue(sectors) } as any,
      { findOne: jest.fn().mockResolvedValue({ id: 'contract-1' }) } as any,
      inspectionRepository as any,
      importRepository as any,
      importLineRepository as any,
      new ServiceOrderImportParserService(),
      {
        save: jest.fn().mockResolvedValue({ key: 'service-orders/imports/file.xlsx', provider: 'local' }),
        read: jest.fn(),
        contentTypeForName: jest.fn().mockReturnValue('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
      } as any,
      {} as any,
      {} as any,
    );
  });

  function savedLines(): Array<Record<string, any>> {
    const call = importLineRepository.save.mock.calls[0]?.[0];
    return Array.isArray(call) ? call : [];
  }

  it('família VISTORIA só aumenta ignoradas', async () => {
    const result = await service.importFromExcel(
      { id: 'user-1', role: UserRole.ADMIN },
      fileFrom([validRow({ Família: 'VISTORIA' })]),
      'contract-1',
    );

    expect(result.skipped).toBe(1);
    expect(result.notRegistered).toBe(0);
    expect(result.errors).toEqual([]);
    expect(importLineRepository.save).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });

  it('número vazio fica gravado como não registrado', async () => {
    const result = await service.importFromExcel(
      { id: 'user-1', role: UserRole.ADMIN },
      fileFrom([validRow({ 'Número OS': '' })]),
      'contract-1',
    );

    expect(result.notRegistered).toBe(1);
    expect(result.errors[0]).toContain('Número da OS vazio');
    const [line] = savedLines();
    expect(line.status).toBe(ServiceOrderImportLineStatus.NOT_REGISTERED);
    expect(line.reason).toContain('Número da OS vazio');
    expect(line.rawRow['Número OS']).toBe('');
  });

  it('a segunda ocorrência da mesma chave não registra e a primeira entra', async () => {
    const result = await service.importFromExcel(
      { id: 'user-1', role: UserRole.ADMIN },
      fileFrom([validRow(), validRow()]),
      'contract-1',
    );

    expect(result.inserted).toBe(1);
    expect(result.notRegistered).toBe(1);
    expect(result.skipped).toBe(0);
    const lines = savedLines();
    expect(lines.map((line) => line.status)).toEqual([
      ServiceOrderImportLineStatus.ENTERED,
      ServiceOrderImportLineStatus.NOT_REGISTERED,
    ]);
    expect(lines[1].reason).toContain('OS repetida neste arquivo');
    expect(lines[0].createdNew).toBe(true);
    expect(lines[0].serviceOrderId).toBe('os-created');
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('OS já existente conta como inserida e como linha que entrou', async () => {
    serviceOrderRepository.findOne.mockResolvedValueOnce({ id: 'os-existing' });
    const result = await service.importFromExcel(
      { id: 'user-1', role: UserRole.ADMIN },
      fileFrom([validRow()]),
      'contract-1',
    );

    expect(result.inserted).toBe(1);
    expect(result.notRegistered).toBe(0);
    expect(savedLines()[0].status).toBe(ServiceOrderImportLineStatus.ENTERED);
    expect(savedLines()[0].createdNew).toBe(false);
    expect(savedLines()[0].serviceOrderId).toBe('os-existing');
    expect(serviceOrderRepository.createQueryBuilder().orUpdate).toHaveBeenCalled();
  });

  it('OS cancelada que não está no banco não vira linha', async () => {
    const result = await service.importFromExcel(
      { id: 'user-1', role: UserRole.ADMIN },
      fileFrom([validRow({ 'Status da OS': 'CANCELADA' })]),
      'contract-1',
    );

    expect(result.deleted).toBe(0);
    expect(result.notRegistered).toBe(0);
    expect(importLineRepository.save).not.toHaveBeenCalled();
  });

  it('reprocessar sem corrigir o texto inválido continua não registrada', async () => {
    importRepository.findOne.mockResolvedValue({
      id: 'import-1',
      contractId: 'contract-1',
      insertedCount: 0,
    });
    importLineRepository.findOne.mockResolvedValue({
      id: 'line-1',
      importId: 'import-1',
      lineNumber: 2,
      status: ServiceOrderImportLineStatus.NOT_REGISTERED,
      reason: 'Linha 2: Família vazia ou inválida',
    });
    importLineRepository.save.mockImplementation(async (line) => line);

    const updated = await service.reprocessLine(
      { id: 'user-1', role: UserRole.ADMIN },
      'import-1',
      'line-1',
      validRow({ Família: 'FAMILIA QUE NAO EXISTE' }),
    );

    expect(updated.status).toBe(ServiceOrderImportLineStatus.NOT_REGISTERED);
    expect(updated.reason).toContain('Família vazia ou inválida');
    expect(importRepository.save).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });

  it('corrigir a família insere e não reescreve o total original', async () => {
    importRepository.findOne.mockResolvedValue({
      id: 'import-1',
      contractId: 'contract-1',
      insertedCount: 3,
      user: { id: 'user-1', name: 'Admin' },
      contract: { id: 'contract-1', name: 'Contrato' },
    });
    importLineRepository.findOne.mockResolvedValue({
      id: 'line-1',
      importId: 'import-1',
      lineNumber: 4,
      status: ServiceOrderImportLineStatus.NOT_REGISTERED,
    });
    importLineRepository.save.mockImplementation(async (line) => line);

    const updated = await service.reprocessLine(
      { id: 'user-1', role: UserRole.ADMIN },
      'import-1',
      'line-1',
      validRow(),
    );

    expect(updated.status).toBe(ServiceOrderImportLineStatus.ENTERED);
    expect(updated.resolvedAt).toBeInstanceOf(Date);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(importRepository.save).not.toHaveBeenCalled();
  });

  it('supervisor não vê o histórico e gestor de outro contrato recebe 403', async () => {
    await expect(
      service.listImports({ role: UserRole.SUPERVISOR, contracts: [] }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    importRepository.findOne.mockResolvedValue({
      id: 'import-1',
      contractId: 'contract-1',
    });
    await expect(
      service.getImport(
        { role: UserRole.GESTOR, contracts: [{ id: 'other-contract' }] },
        'import-1',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  function importRecord(id: string, createdAt: string) {
    return {
      id,
      contractId: 'contract-1',
      createdAt: new Date(createdAt),
      user: { id: 'user-1', name: 'Admin' },
      contract: { id: 'contract-1', name: 'Contrato' },
    };
  }

  it('gestor não exclui as ordens inseridas pelo arquivo', async () => {
    await expect(
      service.deleteInsertedRecords(
        { role: UserRole.GESTOR, contracts: [{ id: 'contract-1' }] },
        'import-1',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(importRepository.findOne).not.toHaveBeenCalled();
  });

  it('exclui a ordem criada pelo arquivo e mantém a que só foi atualizada', async () => {
    const removeMany = jest.spyOn(service, 'removeMany').mockResolvedValue(undefined);
    importRepository.findOne.mockResolvedValue(importRecord('import-1', '2026-11-18T12:00:00Z'));
    importLineRepository.find.mockResolvedValue([
      {
        id: 'line-created',
        status: ServiceOrderImportLineStatus.ENTERED,
        osNumber: '1001',
        sectorName: 'AGUA',
        resultado: 'CONCLUIDO',
        createdNew: true,
        serviceOrderId: 'os-created',
        removedAt: null,
      },
      {
        id: 'line-updated',
        status: ServiceOrderImportLineStatus.ENTERED,
        osNumber: '1002',
        sectorName: 'AGUA',
        resultado: 'CONCLUIDO',
        createdNew: false,
        serviceOrderId: 'os-existing',
        removedAt: null,
      },
    ]);
    serviceOrderRepository.find.mockResolvedValue([{ id: 'os-created' }]);
    inspectionRepository.count.mockResolvedValue(2);

    const preview = await service.previewInsertedDeletion(
      { role: UserRole.ADMIN },
      'import-1',
    );
    await service.deleteInsertedRecords({ role: UserRole.ADMIN }, 'import-1');

    expect(preview).toEqual({ serviceOrderCount: 1, inspectionCount: 2 });
    expect(removeMany).toHaveBeenCalledWith(['os-created']);
    expect(importLineRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: expect.anything() }),
      expect.objectContaining({ removedAt: expect.any(Date) }),
    );
    const criteria = importLineRepository.update.mock.calls[0][0].id;
    expect(criteria.value ?? criteria._value).toEqual(['line-created']);
  });

  it('lançamento antigo apaga a ordem que ele inseriu e o posterior não', async () => {
    const removeMany = jest.spyOn(service, 'removeMany').mockResolvedValue(undefined);
    const older = importRecord('import-old', '2026-11-16T12:00:00Z');
    const newer = importRecord('import-new', '2026-11-17T12:00:00Z');
    importRepository.find.mockResolvedValue([older, newer]);
    serviceOrderRepository.find.mockResolvedValue([
      {
        id: 'os-1',
        osNumber: '1001',
        sectorId: 'sector-agua',
        serviceIdentifier: '',
      },
    ]);

    importRepository.findOne.mockResolvedValue(older);
    importLineRepository.find.mockResolvedValueOnce([
      {
        id: 'line-old',
        status: ServiceOrderImportLineStatus.ENTERED,
        osNumber: '1001',
        sectorName: 'AGUA',
        resultado: 'CONCLUIDO',
        createdNew: null,
        serviceOrderId: null,
        removedAt: null,
      },
    ]);
    await service.deleteInsertedRecords({ role: UserRole.ADMIN }, 'import-old');

    expect(removeMany).toHaveBeenCalledWith(['os-1']);
    expect(importLineRepository.save).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'line-old', createdNew: true, serviceOrderId: 'os-1' }),
    ]);

    removeMany.mockClear();
    importRepository.findOne.mockResolvedValue(newer);
    importLineRepository.find
      .mockResolvedValueOnce([
        {
          id: 'line-new',
          status: ServiceOrderImportLineStatus.ENTERED,
          osNumber: '1001',
          sectorName: 'AGUA',
          resultado: 'OUTRO',
          createdNew: null,
          serviceOrderId: null,
          removedAt: null,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'line-old',
          status: ServiceOrderImportLineStatus.ENTERED,
          osNumber: '1001',
          sectorName: 'AGUA',
          resultado: 'CONCLUIDO',
          createdNew: true,
          removedAt: null,
        },
      ]);
    await service.deleteInsertedRecords({ role: UserRole.ADMIN }, 'import-new');

    expect(removeMany).not.toHaveBeenCalled();
    expect(importLineRepository.save).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'line-new', createdNew: false }),
    ]);
  });

  it('reposição com outro resultado continua sendo ordem inserida por este arquivo', async () => {
    const removeMany = jest.spyOn(service, 'removeMany').mockResolvedValue(undefined);
    const older = importRecord('import-old', '2026-11-16T12:00:00Z');
    const newer = importRecord('import-new', '2026-11-17T12:00:00Z');
    importRepository.find.mockResolvedValue([older, newer]);
    importRepository.findOne.mockResolvedValue(newer);
    serviceOrderRepository.find.mockResolvedValue([
      {
        id: 'os-b',
        osNumber: '1001',
        sectorId: 'sector-reposicao',
        serviceIdentifier: 'B',
      },
    ]);
    importLineRepository.find
      .mockResolvedValueOnce([
        {
          id: 'line-new',
          status: ServiceOrderImportLineStatus.ENTERED,
          osNumber: '1001',
          sectorName: 'REPOSICAO',
          resultado: 'B',
          createdNew: null,
          serviceOrderId: null,
          removedAt: null,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'line-old',
          status: ServiceOrderImportLineStatus.ENTERED,
          osNumber: '1001',
          sectorName: 'REPOSICAO',
          resultado: 'A',
          createdNew: null,
          removedAt: null,
        },
      ]);

    await service.deleteInsertedRecords({ role: UserRole.ADMIN }, 'import-new');

    expect(removeMany).toHaveBeenCalledWith(['os-b']);
  });

  it('não apaga de novo uma ordem já removida por este lançamento', async () => {
    const removeMany = jest.spyOn(service, 'removeMany').mockResolvedValue(undefined);
    importRepository.findOne.mockResolvedValue(importRecord('import-1', '2026-11-18T12:00:00Z'));
    importLineRepository.find.mockResolvedValue([
      {
        id: 'line-created',
        status: ServiceOrderImportLineStatus.ENTERED,
        osNumber: '1001',
        sectorName: 'AGUA',
        createdNew: true,
        serviceOrderId: 'os-old',
        removedAt: new Date('2026-11-18T13:00:00Z'),
      },
    ]);

    const preview = await service.previewInsertedDeletion(
      { role: UserRole.ADMIN },
      'import-1',
    );
    await service.deleteInsertedRecords({ role: UserRole.ADMIN }, 'import-1');

    expect(preview).toEqual({ serviceOrderCount: 0, inspectionCount: 0 });
    expect(removeMany).not.toHaveBeenCalled();
    expect(importLineRepository.update).not.toHaveBeenCalled();
  });
});