import {
  CanActivate,
  ExecutionContext,
  INestApplication,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as request from 'supertest';
import * as XLSX from 'xlsx';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AccessArea } from '../common/enums';
import {
  InvestmentWork,
  InvestmentWorkImport,
  InvestmentWorkImportLine,
  Sector,
} from '../entities';
import { SpreadsheetStorageService } from '../common/utils/spreadsheet-storage.service';
import { InvestmentWorkImportParserService } from './import/investment-work-import-parser.service';
import { InvestmentWorkImportService } from './import/investment-work-import.service';
import { InvestmentWorkImportsController } from './investment-work-imports.controller';
import { InvestmentWorkSummaryService } from './investment-work-summary.service';
import { InvestmentWorksController } from './investment-works.controller';
import { InvestmentWorksService } from './investment-works.service';

const BOTH = `${AccessArea.QUALIDADE_PAINEL},${AccessArea.ENGENHARIA_OBRAS}`;
const IMPORT_ID = '33333333-3333-4333-8333-333333333333';
const CONTRACT_ID = '11111111-1111-4111-8111-111111111111';

class HeaderUserGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const rawAreas = req.headers['x-areas'];
    const rawContracts = req.headers['x-contracts'];
    req.user = {
      id: 'user-1',
      role: req.headers['x-role'] ?? 'GESTOR',
      areas:
        typeof rawAreas === 'string' ? rawAreas.split(',').filter(Boolean) : [],
      contracts:
        typeof rawContracts === 'string'
          ? rawContracts
              .split(',')
              .filter(Boolean)
              .map((id) => ({ id }))
          : [],
    };
    return true;
  }
}

function workbook(): Buffer {
  const sheet = XLSX.utils.json_to_sheet([
    {
      'O.S': 17219247782,
      data: '2026-10-20',
      Descrição: 'Binder(B)',
      Endereço: 'Rua A',
      Bairro: 'Centro',
      'Equipe PDA': 'Equipe 1',
    },
  ]);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Obras');
  return XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

describe('InvestmentWorkImportsController', () => {
  let app: INestApplication;
  const findOneWork = jest.fn();
  const findImport = jest.fn();
  const findAndCount = jest.fn().mockResolvedValue([[], 0]);
  const findLines = jest.fn().mockResolvedValue([]);
  const read = jest.fn().mockResolvedValue(Buffer.from('planilha'));

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [InvestmentWorkImportsController, InvestmentWorksController],
      providers: [
        InvestmentWorkImportService,
        InvestmentWorkImportParserService,
        { provide: InvestmentWorksService, useValue: { findOne: findOneWork } },
        { provide: InvestmentWorkSummaryService, useValue: {} },
        {
          provide: getRepositoryToken(InvestmentWork),
          useValue: {
            manager: {
              transaction: jest.fn(async (callback) =>
                callback({
                  query: jest.fn(),
                  find: jest.fn().mockResolvedValue([]),
                  create: jest.fn((_entity, data) => data),
                  save: jest.fn(async (_entity, data) => ({
                    ...data,
                    id: 'import-1',
                  })),
                }),
              ),
            },
          },
        },
        {
          provide: getRepositoryToken(InvestmentWorkImport),
          useValue: { findOne: findImport, findAndCount },
        },
        {
          provide: getRepositoryToken(InvestmentWorkImportLine),
          useValue: { find: findLines },
        },
        {
          provide: getRepositoryToken(Sector),
          useValue: {
            findOne: jest.fn().mockResolvedValue({ id: 'sector-reposicao' }),
          },
        },
        {
          provide: SpreadsheetStorageService,
          useValue: {
            save: jest.fn().mockResolvedValue({
              key: 'investment-works/imports/file.xlsx',
              provider: 'local',
            }),
            remove: jest.fn(),
            read,
            contentTypeForName: jest
              .fn()
              .mockReturnValue(
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              ),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useClass(HeaderUserGuard)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    findOneWork.mockReset();
    findImport.mockReset();
    findLines.mockReset().mockResolvedValue([]);
  });

  function excel(path: string) {
    return request(app.getHttpServer())
      .post(path)
      .set('x-role', 'GESTOR')
      .set('x-areas', BOTH)
      .attach('file', workbook(), {
        filename: 'obras.xlsx',
        contentType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
  }

  it('não trata imports como id da obra', async () => {
    await request(app.getHttpServer())
      .get('/investment-works/imports')
      .set('x-role', 'GESTOR')
      .set('x-areas', BOTH)
      .expect(200);

    expect(findOneWork).not.toHaveBeenCalled();
  });

  it('prévia e gravação exigem a ação de Painel e a área Obras Inv', async () => {
    await excel('/investment-works/imports/preview')
      .set('x-role', 'FISCAL')
      .set('x-areas', AccessArea.ENGENHARIA_OBRAS)
      .expect(403);
    await excel('/investment-works/imports/preview')
      .set('x-areas', AccessArea.QUALIDADE_PAINEL)
      .expect(403);
    await excel('/investment-works/imports/preview').expect(200);

    await excel('/investment-works/imports')
      .field('contractId', CONTRACT_ID)
      .field('descriptions', JSON.stringify(['BINDER(B)']))
      .set('x-areas', AccessArea.QUALIDADE_PAINEL)
      .expect(403);
    await excel('/investment-works/imports')
      .set('x-role', 'SUPERVISOR')
      .set('x-contracts', CONTRACT_ID)
      .field('contractId', CONTRACT_ID)
      .field('descriptions', JSON.stringify(['BINDER(B)']))
      .expect(201);
  });

  it('listar, detalhar e baixar exigem ADMIN ou GESTOR com as duas áreas', async () => {
    await request(app.getHttpServer())
      .get('/investment-works/imports')
      .set('x-role', 'SUPERVISOR')
      .set('x-areas', BOTH)
      .expect(403);
    await request(app.getHttpServer())
      .get('/investment-works/imports')
      .set('x-role', 'GESTOR')
      .set('x-areas', AccessArea.ENGENHARIA_OBRAS)
      .expect(403);
    await request(app.getHttpServer())
      .get(`/investment-works/imports/${IMPORT_ID}/file`)
      .set('x-role', 'FISCAL')
      .set('x-areas', BOTH)
      .expect(403);
  });

  it('detalhe de outro contrato responde 403 e id inexistente responde 404', async () => {
    findImport.mockResolvedValueOnce(null);
    await request(app.getHttpServer())
      .get(`/investment-works/imports/${IMPORT_ID}`)
      .set('x-role', 'GESTOR')
      .set('x-areas', BOTH)
      .expect(404);

    findImport.mockResolvedValueOnce({
      id: IMPORT_ID,
      contractId: CONTRACT_ID,
      userId: 'user-2',
      originalFileName: 'obras.xlsx',
      selectedDescriptions: [],
      createdCount: 0,
      ignoredCount: 0,
      notSelectedCount: 0,
      notRegisteredCount: 0,
    });
    await request(app.getHttpServer())
      .get(`/investment-works/imports/${IMPORT_ID}`)
      .set('x-role', 'GESTOR')
      .set('x-areas', BOTH)
      .set('x-contracts', '22222222-2222-4222-8222-222222222222')
      .expect(403);
  });

  it('devolve a planilha com Content-Disposition attachment', async () => {
    findImport.mockResolvedValue({
      id: IMPORT_ID,
      contractId: CONTRACT_ID,
      userId: 'user-1',
      originalFileName: 'obras.xlsx',
      storageKey: 'investment-works/imports/file.xlsx',
      storageProvider: 'local',
      selectedDescriptions: ['Binder(B)'],
      createdCount: 1,
      ignoredCount: 0,
      notSelectedCount: 0,
      notRegisteredCount: 0,
    });

    await request(app.getHttpServer())
      .get(`/investment-works/imports/${IMPORT_ID}/file`)
      .set('x-role', 'ADMIN')
      .set('x-areas', BOTH)
      .expect(200)
      .expect('Content-Disposition', 'attachment; filename="obras.xlsx"');

    expect(read).toHaveBeenCalled();
  });
});
