import { InspectionNoticeType } from '../common/enums';
import { InspectionNoticesService } from './inspection-notices.service';

describe('InspectionNoticesService', () => {
  function usersWithGestor(gestor: any) {
    return {
      find: jest.fn().mockResolvedValue([
        { id: 'admin-1', role: 'ADMIN', accessProfile: null },
      ]),
      createQueryBuilder: jest.fn().mockReturnValue({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(gestor ? [gestor] : []),
      }),
    };
  }

  it('não avisa gestor do contrato sem a área Pendências', async () => {
    const service = new InspectionNoticesService(
      {} as any,
      usersWithGestor({
        id: 'gestor-1',
        role: 'GESTOR',
        accessProfile: { areas: [] },
      }) as any,
    );
    const persist = jest
      .spyOn(service as any, 'persistAndPublish')
      .mockResolvedValue(undefined);

    await service.notifyResolutionSubmitted({
      id: 'insp-1',
      contractId: 'contract-1',
    });

    expect(persist).toHaveBeenCalledWith(
      ['admin-1'],
      'insp-1',
      InspectionNoticeType.RESOLUTION_SUBMITTED,
      expect.any(String),
    );
  });

  it('avisa gestor do contrato que vê Pendências', async () => {
    const service = new InspectionNoticesService(
      {} as any,
      usersWithGestor({
        id: 'gestor-1',
        role: 'GESTOR',
        accessProfile: { areas: [{ area: 'qualidade_pendencias' }] },
      }) as any,
    );
    const persist = jest
      .spyOn(service as any, 'persistAndPublish')
      .mockResolvedValue(undefined);

    await service.notifyResolutionSubmitted({
      id: 'insp-1',
      contractId: 'contract-1',
    });

    expect(persist).toHaveBeenCalledWith(
      ['admin-1', 'gestor-1'],
      'insp-1',
      InspectionNoticeType.RESOLUTION_SUBMITTED,
      expect.any(String),
    );
  });

  it('avisa quem enviou a resolução mesmo sem a área Pendências', async () => {
    const service = new InspectionNoticesService({} as any, {} as any);
    const persist = jest
      .spyOn(service as any, 'persistAndPublish')
      .mockResolvedValue(undefined);

    await service.notifyResolutionApproved({
      id: 'insp-1',
      resolutionSubmittedByUserId: 'fiscal-1',
    });

    expect(persist).toHaveBeenCalledWith(
      ['fiscal-1'],
      'insp-1',
      InspectionNoticeType.RESOLUTION_APPROVED,
      expect.any(String),
    );
  });
});
