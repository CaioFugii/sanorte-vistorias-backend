import * as XLSX from 'xlsx';
import { SpreadsheetStorageService } from '../../common/utils/spreadsheet-storage.service';
import {
  InvestmentWorkImportLineStatus,
  InvestmentWorkOrigin,
  InvestmentWorkStatus,
} from '../../common/enums';
import {
  InvestmentWork,
  InvestmentWorkDescription,
  InvestmentWorkImport,
  InvestmentWorkImportLine,
} from '../../entities';
import { Repository } from 'typeorm';
import {
  InvestmentWorkImportParserService,
  ParsedInvestmentWorkRow,
} from './investment-work-import-parser.service';
import {
  INVESTMENT_WORK_IMPORT_MAX_BYTES,
  InvestmentWorkImportService,
} from './investment-work-import.service';

function workbook(rows: Record<string, unknown>[]): Buffer {
  const sheet = XLSX.utils.json_to_sheet(rows);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Obras');
  return XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

function line(
  description: string,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    'O.S': 17219247782,
    data: '2026-10-20',
    Descrição: description,
    Endereço: 'Rua A',
    Bairro: 'Centro',
    'Equipe PDA': 'Equipe 1',
    ...extra,
  };
}

describe('InvestmentWorkImportService preview', () => {
  const works = {
    save: jest.fn(),
    insert: jest.fn(),
    manager: { transaction: jest.fn() },
  };
  const imports = { save: jest.fn(), insert: jest.fn() };
  const storage = { save: jest.fn() };
  const service = new InvestmentWorkImportService(
    new InvestmentWorkImportParserService(),
    works as unknown as Repository<InvestmentWork>,
    imports as unknown as Repository<InvestmentWorkImport>,
    {} as never,
    storage as unknown as SpreadsheetStorageService,
    {} as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function expectNothingSaved() {
    expect(works.save).not.toHaveBeenCalled();
    expect(works.insert).not.toHaveBeenCalled();
    expect(works.manager.transaction).not.toHaveBeenCalled();
    expect(imports.save).not.toHaveBeenCalled();
    expect(imports.insert).not.toHaveBeenCalled();
    expect(storage.save).not.toHaveBeenCalled();
  }

  it('não grava obra, lançamento nem arquivo', () => {
    const buffer = workbook([line('Binder(B)')]);
    const preview = service.preview({
      buffer,
      originalname: 'obras.xlsx',
      size: buffer.length,
    });

    expect(preview).toEqual({
      fileName: 'obras.xlsx',
      totalLines: 1,
      descriptions: [{ key: 'BINDER(B)', label: 'Binder(B)', count: 1 }],
    });
    expectNothingSaved();
  });

  it('recusa coluna ausente nomeando as colunas e não grava', () => {
    const buffer = workbook([{ 'O.S': 1, Cidade: 'SP' }]);
    expect(() =>
      service.preview({
        buffer,
        originalname: 'obras.xlsx',
        size: buffer.length,
      }),
    ).toThrow(
      'Colunas ausentes: data, Descrição, Endereço, Bairro, Equipe PDA',
    );
    expectNothingSaved();
  });

  it('lista as Descrições na primeira aparição, inclusive linha que ficaria não registrada', () => {
    const buffer = workbook([
      line('Binder(B)'),
      line('Capa', { data: '10/20/26' }),
      line('binder(b)', { 'O.S': '' }),
      line('Asfalto'),
      line(''),
    ]);

    const preview = service.preview({
      buffer,
      originalname: 'obras.xlsx',
      size: buffer.length,
    });

    expect(preview.totalLines).toBe(5);
    expect(preview.descriptions).toEqual([
      { key: 'BINDER(B)', label: 'Binder(B)', count: 2 },
      { key: 'CAPA', label: 'Capa', count: 1 },
      { key: 'ASFALTO', label: 'Asfalto', count: 1 },
    ]);
    expectNothingSaved();
  });

  it('recusa arquivo acima de 5 MB', () => {
    expect(() =>
      service.preview({
        buffer: Buffer.from(''),
        originalname: 'grande.xlsx',
        size: INVESTMENT_WORK_IMPORT_MAX_BYTES + 1,
      }),
    ).toThrow('Arquivo acima de 5 MB');
    expectNothingSaved();
  });
});

describe('InvestmentWorkImportService classificação', () => {
  const service = new InvestmentWorkImportService(
    new InvestmentWorkImportParserService(),
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  const contractId = '11111111-1111-4111-8111-111111111111';
  const otherContractId = '22222222-2222-4222-8222-222222222222';

  function row(
    overrides: Partial<ParsedInvestmentWorkRow> = {},
  ): ParsedInvestmentWorkRow {
    return {
      lineNumber: 2,
      osNumber: '17219247782',
      osError: null,
      executionDate: '2026-10-20',
      dateError: null,
      description: 'Binder(B)',
      descriptionKey: 'BINDER(B)',
      address: 'Rua A',
      district: 'Centro',
      pdaTeam: 'Equipe 1',
      rawRow: {},
      ...overrides,
    };
  }

  it('deixa Descrição desmarcada fora e não cria cadastro só com desmarcadas', () => {
    const onlyUnchecked = service.classify({
      contractId,
      selectedKeys: [],
      existingKeys: [],
      rows: [row()],
    });
    expect(onlyUnchecked.lines[0].status).toBe('NOT_SELECTED');
    expect(onlyUnchecked.works).toEqual([]);

    const mixed = service.classify({
      contractId,
      selectedKeys: ['BINDER(B)'],
      existingKeys: [],
      rows: [
        row(),
        row({
          lineNumber: 3,
          description: 'Capa',
          descriptionKey: 'CAPA',
        }),
      ],
    });
    expect(mixed.lines.map((line) => line.status)).toEqual([
      'REGISTERED',
      'NOT_SELECTED',
    ]);
    expect(mixed.works).toHaveLength(1);
    expect(mixed.works[0].descriptions).toEqual([
      { key: 'BINDER(B)', label: 'Binder(B)' },
    ]);
  });

  it('não registra linha sem O.S, sem data, com data inválida ou sem Descrição', () => {
    const result = service.classify({
      contractId,
      selectedKeys: ['BINDER(B)'],
      existingKeys: [],
      rows: [
        row({ lineNumber: 2, osNumber: null, osError: 'O.S ausente' }),
        row({ lineNumber: 3, executionDate: null, dateError: 'data ausente' }),
        row({ lineNumber: 4, executionDate: null, dateError: 'data inválida' }),
        row({ lineNumber: 5, description: '', descriptionKey: '' }),
      ],
    });

    expect(result.lines.map((line) => line.reason)).toEqual([
      'Linha 2: O.S ausente',
      'Linha 3: data ausente',
      'Linha 4: data inválida',
      'Linha 5: Descrição ausente',
    ]);
    expect(result.works).toEqual([]);
  });

  it('não registra o grupo inteiro quando Endereço, Bairro ou Equipe PDA divergem', () => {
    const address = service.classify({
      contractId,
      selectedKeys: ['BINDER(B)', 'CAPA'],
      existingKeys: [],
      rows: [
        row({ lineNumber: 2, address: 'Rua A' }),
        row({
          lineNumber: 3,
          address: 'Rua B',
          description: 'Capa',
          descriptionKey: 'CAPA',
        }),
      ],
    });
    expect(address.works).toEqual([]);
    expect(address.lines[0].reason).toBe(
      'Linha 2: O.S 17219247782 de 2026-10-20 com Endereço diferentes entre as linhas',
    );
    expect(address.lines[1].status).toBe('NOT_REGISTERED');

    const others = service.classify({
      contractId,
      selectedKeys: ['BINDER(B)', 'CAPA'],
      existingKeys: [],
      rows: [
        row({ lineNumber: 4, district: 'Centro', pdaTeam: 'Equipe 1' }),
        row({
          lineNumber: 5,
          district: 'Outro',
          pdaTeam: 'Equipe 2',
          description: 'Capa',
          descriptionKey: 'CAPA',
        }),
      ],
    });
    expect(others.lines[0].reason).toContain('Bairro e Equipe PDA');
  });

  it('não trata caixa, espaço ou acento como divergência e aceita campo vazio igual', () => {
    const equivalent = service.classify({
      contractId,
      selectedKeys: ['BINDER(B)', 'CAPA'],
      existingKeys: [],
      rows: [
        row({
          lineNumber: 2,
          address: 'Rua  Á',
          district: 'São Paulo',
          pdaTeam: 'Equipe',
        }),
        row({
          lineNumber: 3,
          address: 'rua a',
          district: 'sao  paulo',
          pdaTeam: 'equipe',
          description: 'Capa',
          descriptionKey: 'CAPA',
        }),
      ],
    });
    expect(equivalent.works).toHaveLength(1);
    expect(equivalent.lines.every((line) => line.status === 'REGISTERED')).toBe(
      true,
    );

    const emptyAgainstFilled = service.classify({
      contractId,
      selectedKeys: ['BINDER(B)', 'CAPA'],
      existingKeys: [],
      rows: [
        row({ lineNumber: 2, address: '' }),
        row({
          lineNumber: 3,
          address: 'Rua A',
          description: 'Capa',
          descriptionKey: 'CAPA',
        }),
      ],
    });
    expect(emptyAgainstFilled.works).toEqual([]);
    expect(emptyAgainstFilled.lines[0].reason).toContain('Endereço');

    const empty = service.classify({
      contractId,
      selectedKeys: ['BINDER(B)'],
      existingKeys: [],
      rows: [row({ lineNumber: 2, address: '', district: '', pdaTeam: '' })],
    });
    expect(empty.works).toEqual([
      {
        osNumber: '17219247782',
        executionDate: '2026-10-20',
        address: '',
        district: '',
        pdaTeam: '',
        descriptions: [{ key: 'BINDER(B)', label: 'Binder(B)' }],
      },
    ]);
  });

  it('ignora chave de cadastro ativo, de cadastro excluído e repetida no arquivo', () => {
    const result = service.classify({
      contractId,
      selectedKeys: ['BINDER(B)', 'CAPA'],
      existingKeys: [
        {
          contractId,
          osNumber: '100',
          executionDate: '2026-10-20',
          descriptionKey: 'BINDER(B)',
        },
        {
          contractId,
          osNumber: '200',
          executionDate: '2026-10-20',
          descriptionKey: 'CAPA',
        },
      ],
      rows: [
        row({ lineNumber: 2, osNumber: '100' }),
        row({
          lineNumber: 3,
          osNumber: '200',
          description: 'Capa',
          descriptionKey: 'CAPA',
        }),
        row({ lineNumber: 4, osNumber: '300' }),
        row({ lineNumber: 5, osNumber: '300' }),
      ],
    });

    expect(result.lines.map((line) => line.status)).toEqual([
      'IGNORED',
      'IGNORED',
      'REGISTERED',
      'IGNORED',
    ]);
    expect(result.works.map((work) => work.osNumber)).toEqual(['300']);
  });

  it('cria outro cadastro para outra data, Descrição nova ou outro contrato', () => {
    const result = service.classify({
      contractId,
      selectedKeys: ['BINDER(B)', 'CAPA'],
      existingKeys: [
        {
          contractId,
          osNumber: '100',
          executionDate: '2026-10-20',
          descriptionKey: 'BINDER(B)',
        },
        {
          contractId: otherContractId,
          osNumber: '400',
          executionDate: '2026-10-20',
          descriptionKey: 'BINDER(B)',
        },
      ],
      rows: [
        row({ lineNumber: 2, osNumber: '100', executionDate: '2026-10-21' }),
        row({ lineNumber: 3, osNumber: '100' }),
        row({
          lineNumber: 4,
          osNumber: '100',
          description: 'Capa',
          descriptionKey: 'CAPA',
        }),
        row({ lineNumber: 5, osNumber: '400' }),
      ],
    });

    expect(result.lines.map((line) => line.status)).toEqual([
      'REGISTERED',
      'IGNORED',
      'REGISTERED',
      'REGISTERED',
    ]);
    expect(result.works).toEqual([
      {
        osNumber: '100',
        executionDate: '2026-10-21',
        address: 'Rua A',
        district: 'Centro',
        pdaTeam: 'Equipe 1',
        descriptions: [{ key: 'BINDER(B)', label: 'Binder(B)' }],
      },
      {
        osNumber: '100',
        executionDate: '2026-10-20',
        address: 'Rua A',
        district: 'Centro',
        pdaTeam: 'Equipe 1',
        descriptions: [{ key: 'CAPA', label: 'Capa' }],
      },
      {
        osNumber: '400',
        executionDate: '2026-10-20',
        address: 'Rua A',
        district: 'Centro',
        pdaTeam: 'Equipe 1',
        descriptions: [{ key: 'BINDER(B)', label: 'Binder(B)' }],
      },
    ]);
  });
});

describe('InvestmentWorkImportService gravação', () => {
  const parser = new InvestmentWorkImportParserService();
  const contractId = '11111111-1111-4111-8111-111111111111';
  const userId = 'user-1';

  function sheet(rows: Record<string, unknown>[]): Buffer {
    return workbook(rows);
  }

  function validLine(os: number, description: string): Record<string, unknown> {
    return {
      'O.S': os,
      data: '2026-10-20',
      Descrição: description,
      Endereço: 'Rua A',
      Bairro: 'Centro',
      'Equipe PDA': 'Equipe 1',
    };
  }

  function setup(options?: {
    sector?: { id: string } | null;
    transaction?: jest.Mock;
    existing?: Array<Record<string, string>>;
  }) {
    const saved: Array<{ entity: unknown; data: Record<string, unknown> }> = [];
    let sequence = 0;
    const manager = {
      query: jest.fn().mockResolvedValue([]),
      find: jest.fn().mockResolvedValue(options?.existing ?? []),
      create: jest.fn(
        (_entity: unknown, data: Record<string, unknown>) => data,
      ),
      save: jest.fn(async (entity: unknown, data: Record<string, unknown>) => {
        const row = { ...data, id: `saved-${++sequence}` };
        saved.push({ entity, data: row });
        return row;
      }),
    };
    const transaction =
      options?.transaction ?? jest.fn(async (callback) => callback(manager));
    const storage = {
      save: jest.fn().mockResolvedValue({
        key: 'investment-works/imports/file.xlsx',
        provider: 'local',
      }),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    const sectors = {
      findOne: jest
        .fn()
        .mockResolvedValue(
          options && 'sector' in options
            ? options.sector
            : { id: 'sector-reposicao' },
        ),
    };
    const service = new InvestmentWorkImportService(
      parser,
      { manager: { transaction } } as never,
      {} as never,
      sectors as never,
      storage as never,
      {} as never,
    );
    return { service, storage, manager, saved, transaction };
  }

  function fileOf(buffer: Buffer) {
    return {
      buffer,
      originalname: 'obras.xlsx',
      size: buffer.length,
    };
  }

  it('recusa descriptions vazio ou chave desconhecida sem gravar', async () => {
    const { service, storage } = setup();
    const buffer = sheet([validLine(1, 'Binder(B)')]);
    await expect(
      service.importFile(
        { id: userId, role: 'ADMIN' },
        fileOf(buffer),
        contractId,
        [],
      ),
    ).rejects.toThrow('Selecione ao menos uma Descrição');
    await expect(
      service.importFile(
        { id: userId, role: 'ADMIN' },
        fileOf(buffer),
        contractId,
        ['OUTRA'],
      ),
    ).rejects.toThrow('Descrição desconhecida: OUTRA');
    expect(storage.save).not.toHaveBeenCalled();
  });

  it('recusa GESTOR e SUPERVISOR fora do contrato', async () => {
    const { service, storage } = setup();
    const buffer = sheet([validLine(1, 'Binder(B)')]);
    for (const role of ['GESTOR', 'SUPERVISOR']) {
      await expect(
        service.importFile(
          { id: userId, role, contracts: [{ id: 'outro' }] },
          fileOf(buffer),
          contractId,
          ['BINDER(B)'],
        ),
      ).rejects.toThrow(
        'Você não tem acesso ao contrato selecionado para importação.',
      );
    }
    expect(storage.save).not.toHaveBeenCalled();
  });

  it('recusa quando o setor REPOSICAO não existe', async () => {
    const { service, storage } = setup({ sector: null });
    const buffer = sheet([validLine(1, 'Binder(B)')]);
    await expect(
      service.importFile(
        { id: userId, role: 'ADMIN' },
        fileOf(buffer),
        contractId,
        ['BINDER(B)'],
      ),
    ).rejects.toThrow('Setor REPOSICAO não encontrado');
    expect(storage.save).not.toHaveBeenCalled();
  });

  it('cria 23 cadastros e guarda só a linha não registrada', async () => {
    const rows = [
      ...Array.from({ length: 7 }, (_, index) =>
        validLine(1000 + index, 'Binder(B)'),
      ),
      ...Array.from({ length: 16 }, (_, index) =>
        validLine(2000 + index, 'Capa'),
      ),
      {
        'O.S': '',
        data: '2026-10-20',
        Descrição: 'Capa',
        Endereço: '',
        Bairro: '',
        'Equipe PDA': '',
      },
    ];
    const { service, manager, saved } = setup();
    const buffer = sheet(rows);

    const result = await service.importFile(
      { id: userId, role: 'ADMIN' },
      fileOf(buffer),
      contractId,
      ['BINDER(B)', 'CAPA'],
    );

    const works = saved.filter((item) => item.entity === InvestmentWork);
    const descriptions = saved.filter(
      (item) => item.entity === InvestmentWorkDescription,
    );
    const imports = saved.filter(
      (item) => item.entity === InvestmentWorkImport,
    );
    const lines = saved.filter(
      (item) => item.entity === InvestmentWorkImportLine,
    );
    expect(works).toHaveLength(23);
    expect(descriptions).toHaveLength(23);
    expect(lines).toHaveLength(1);
    expect(
      works.every((item) => item.data.origin === InvestmentWorkOrigin.IMPORT),
    ).toBe(true);
    expect(
      works.every((item) => item.data.sectorId === 'sector-reposicao'),
    ).toBe(true);
    expect(works.every((item) => item.data.active === true)).toBe(true);
    expect(
      works.every(
        (item) => item.data.status === InvestmentWorkStatus.EM_ANDAMENTO,
      ),
    ).toBe(true);
    expect(works.map((item) => item.data.workName)).toEqual([
      ...Array.from({ length: 7 }, (_, index) => String(1000 + index)),
      ...Array.from({ length: 16 }, (_, index) => String(2000 + index)),
    ]);
    expect(
      works.every((item) => item.data.startDate === item.data.expectedEndDate),
    ).toBe(true);
    expect(imports[0].data).toMatchObject({
      userId,
      contractId,
      originalFileName: 'obras.xlsx',
      storageKey: 'investment-works/imports/file.xlsx',
      selectedDescriptions: ['Binder(B)', 'Capa'],
      createdCount: 23,
      ignoredCount: 0,
      notSelectedCount: 0,
      notRegisteredCount: 1,
    });
    expect(lines[0].data).toMatchObject({
      status: InvestmentWorkImportLineStatus.NOT_REGISTERED,
      lineNumber: 25,
      reason: 'Linha 25: O.S ausente',
    });
    expect(result).toMatchObject({
      created: 23,
      ignored: 0,
      notSelected: 0,
      notRegistered: 1,
      errors: ['Linha 25: O.S ausente'],
    });
    expect(manager.query).toHaveBeenCalledWith(
      'SELECT pg_advisory_xact_lock(hashtext($1)::bigint)',
      [contractId],
    );
  });

  it('apaga o arquivo quando a transação falha', async () => {
    const transaction = jest.fn().mockRejectedValue(new Error('falha'));
    const { service, storage } = setup({ transaction });
    const buffer = sheet([validLine(1, 'Binder(B)')]);

    await expect(
      service.importFile(
        { id: userId, role: 'ADMIN' },
        fileOf(buffer),
        contractId,
        ['BINDER(B)'],
      ),
    ).rejects.toThrow('falha');

    expect(storage.remove).toHaveBeenCalledWith(
      'investment-works/imports/file.xlsx',
      'local',
    );
  });
});
