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
    delete: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let importRepository: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    findAndCount: jest.Mock;
  };
  let importLineRepository: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
  };

  beforeEach(() => {
    execute = jest.fn().mockResolvedValue(undefined);
    const query = {
      insert: jest.fn().mockReturnThis(),
      into: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      orUpdate: jest.fn().mockReturnThis(),
      execute,
    };
    serviceOrderRepository = {
      find: jest.fn().mockResolvedValue([]),
      delete: jest.fn().mockResolvedValue(undefined),
      createQueryBuilder: jest.fn().mockReturnValue(query),
    };
    importRepository = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ ...value, id: 'import-1' })),
      findOne: jest.fn(),
      findAndCount: jest.fn(),
    };
    importLineRepository = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => value),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
    };

    service = new ServiceOrdersService(
      serviceOrderRepository as any,
      { find: jest.fn().mockResolvedValue(sectors) } as any,
      { findOne: jest.fn().mockResolvedValue({ id: 'contract-1' }) } as any,
      {} as any,
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
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('OS já existente conta como inserida e como linha que entrou', async () => {
    const result = await service.importFromExcel(
      { id: 'user-1', role: UserRole.ADMIN },
      fileFrom([validRow()]),
      'contract-1',
    );

    expect(result.inserted).toBe(1);
    expect(result.notRegistered).toBe(0);
    expect(savedLines()[0].status).toBe(ServiceOrderImportLineStatus.ENTERED);
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
});