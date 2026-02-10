import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InspectionsService } from './inspections.service';
import { Inspection, InspectionItem, ChecklistItem } from '../entities';
import { InspectionStatus, ChecklistAnswer } from '../common/enums';

describe('InspectionsService', () => {
  let service: InspectionsService;
  let inspectionRepository: Repository<Inspection>;
  let inspectionItemRepository: Repository<InspectionItem>;
  let checklistItemRepository: Repository<ChecklistItem>;

  const mockInspectionRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockInspectionItemRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };

  const mockChecklistItemRepository = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InspectionsService,
        {
          provide: getRepositoryToken(Inspection),
          useValue: mockInspectionRepository,
        },
        {
          provide: getRepositoryToken(InspectionItem),
          useValue: mockInspectionItemRepository,
        },
        {
          provide: getRepositoryToken(ChecklistItem),
          useValue: mockChecklistItemRepository,
        },
        {
          provide: 'DataSource',
          useValue: {
            getRepository: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: 'FilesService',
          useValue: {
            saveEvidence: jest.fn(),
            saveSignature: jest.fn(),
            getFile: jest.fn(),
          },
        },
        {
          provide: 'PendingAdjustmentRepository',
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: 'SignatureRepository',
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: 'EvidenceRepository',
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<InspectionsService>(InspectionsService);
    inspectionRepository = module.get<Repository<Inspection>>(
      getRepositoryToken(Inspection),
    );
    inspectionItemRepository = module.get<Repository<InspectionItem>>(
      getRepositoryToken(InspectionItem),
    );
    checklistItemRepository = module.get<Repository<ChecklistItem>>(
      getRepositoryToken(ChecklistItem),
    );
  });

  it('deve calcular percentual corretamente', async () => {
    const inspectionId = 'test-id';
    const mockItems = [
      { answer: ChecklistAnswer.CONFORME },
      { answer: ChecklistAnswer.CONFORME },
      { answer: ChecklistAnswer.NAO_CONFORME },
      { answer: ChecklistAnswer.NAO_APLICAVEL },
    ];

    mockInspectionItemRepository.find.mockResolvedValue(mockItems);

    const percent = await service.calculateScorePercent(inspectionId);

    expect(percent).toBe(66.67); // 2 conforme / 3 avaliados = 66.67%
  });

  it('deve retornar 100 quando não há itens avaliados', async () => {
    const inspectionId = 'test-id';
    const mockItems = [
      { answer: ChecklistAnswer.NAO_APLICAVEL },
      { answer: ChecklistAnswer.NAO_APLICAVEL },
    ];

    mockInspectionItemRepository.find.mockResolvedValue(mockItems);

    const percent = await service.calculateScorePercent(inspectionId);

    expect(percent).toBe(100);
  });
});
