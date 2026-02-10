import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InspectionsService } from './inspections.service';
import { Inspection, InspectionItem, ChecklistItem } from '../entities';
import { InspectionStatus, ChecklistAnswer, UserRole } from '../common/enums';

describe('InspectionsService - Regras de Negócio', () => {
  let service: InspectionsService;
  let inspectionRepository: Repository<Inspection>;

  const mockInspection: Partial<Inspection> = {
    id: 'test-id',
    status: InspectionStatus.RASCUNHO,
    createdByUserId: 'user-id',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InspectionsService,
        {
          provide: getRepositoryToken(Inspection),
          useValue: {
            findOne: jest.fn().mockResolvedValue(mockInspection),
            update: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(InspectionItem),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(ChecklistItem),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: 'DataSource',
          useValue: {},
        },
        {
          provide: 'FilesService',
          useValue: {},
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
          },
        },
        {
          provide: 'EvidenceRepository',
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<InspectionsService>(InspectionsService);
    inspectionRepository = module.get<Repository<Inspection>>(
      getRepositoryToken(Inspection),
    );
  });

  it('FISCAL não deve editar vistoria finalizada', async () => {
    const finalizedInspection = {
      ...mockInspection,
      status: InspectionStatus.FINALIZADA,
    };

    jest.spyOn(inspectionRepository, 'findOne').mockResolvedValue(finalizedInspection as Inspection);

    await expect(
      service.update('test-id', {}, 'user-id', UserRole.FISCAL),
    ).rejects.toThrow(ForbiddenException);
  });

  it('GESTOR deve poder editar vistoria finalizada', async () => {
    const finalizedInspection = {
      ...mockInspection,
      status: InspectionStatus.FINALIZADA,
    };

    jest.spyOn(inspectionRepository, 'findOne').mockResolvedValue(finalizedInspection as Inspection);
    jest.spyOn(inspectionRepository, 'update').mockResolvedValue(undefined);

    await expect(
      service.update('test-id', {}, 'user-id', UserRole.GESTOR),
    ).resolves.not.toThrow();
  });
});
