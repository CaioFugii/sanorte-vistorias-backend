import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Observable, Subject } from 'rxjs';
import { filter } from 'rxjs/operators';
import { InspectionNoticeType, UserRole } from '../common/enums';
import { AccessArea } from '../common/enums';
import { canSeeArea } from '../common/auth/access-area.util';
import { InspectionNotice, User } from '../entities';

export type ResolutionNoticeInspection = {
  id: string;
  contractId?: string | null;
  resolutionSubmittedByUserId?: string | null;
};

const SUBMITTED_MESSAGE = 'Resolução de pendência enviada para aprovação.';
const APPROVED_MESSAGE = 'Resolução de pendência aprovada.';

@Injectable()
export class InspectionNoticesService {
  private readonly events = new Subject<InspectionNotice>();

  constructor(
    @InjectRepository(InspectionNotice)
    private readonly noticesRepository: Repository<InspectionNotice>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  watch(userId: string): Observable<InspectionNotice> {
    return this.events
      .asObservable()
      .pipe(filter((notice) => notice.recipientUserId === userId));
  }

  listUnread(userId: string): Promise<InspectionNotice[]> {
    return this.noticesRepository.find({
      where: { recipientUserId: userId, readAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
  }

  async markRead(id: string, userId: string): Promise<InspectionNotice> {
    const notice = await this.noticesRepository.findOne({
      where: { id, recipientUserId: userId },
    });
    if (!notice) {
      throw new NotFoundException('Aviso não encontrado');
    }
    if (!notice.readAt) {
      notice.readAt = new Date();
      await this.noticesRepository.save(notice);
    }
    return notice;
  }

  async notifyResolutionSubmitted(
    inspection: ResolutionNoticeInspection,
  ): Promise<void> {
    const recipientIds = await this.findSubmittedRecipientIds(
      inspection.contractId ?? null,
    );
    await this.persistAndPublish(
      recipientIds,
      inspection.id,
      InspectionNoticeType.RESOLUTION_SUBMITTED,
      SUBMITTED_MESSAGE,
    );
  }

  async notifyResolutionApproved(
    inspection: ResolutionNoticeInspection,
  ): Promise<void> {
    if (!inspection.resolutionSubmittedByUserId) return;
    await this.persistAndPublish(
      [inspection.resolutionSubmittedByUserId],
      inspection.id,
      InspectionNoticeType.RESOLUTION_APPROVED,
      APPROVED_MESSAGE,
    );
  }

  async notifyResolutionRejected(
    inspection: ResolutionNoticeInspection,
    reason: string,
  ): Promise<void> {
    if (!inspection.resolutionSubmittedByUserId) return;
    const trimmed = reason.trim();
    const message = trimmed
      ? `Resolução de pendência reprovada. Motivo: ${trimmed}`
      : 'Resolução de pendência reprovada.';
    await this.persistAndPublish(
      [inspection.resolutionSubmittedByUserId],
      inspection.id,
      InspectionNoticeType.RESOLUTION_REJECTED,
      message,
    );
  }

  private async findSubmittedRecipientIds(
    contractId: string | null,
  ): Promise<string[]> {
    const admins = await this.usersRepository.find({
      where: { role: UserRole.ADMIN },
      relations: ['accessProfile', 'accessProfile.areas'],
    });
    const ids = new Set(
      admins
        .filter((user) => this.canReceivePendingNotice(user))
        .map((user) => user.id),
    );
    if (!contractId) {
      return [...ids];
    }

    const gestores = await this.usersRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.accessProfile', 'accessProfile')
      .leftJoinAndSelect('accessProfile.areas', 'area')
      .innerJoin('user.contracts', 'contract')
      .where('user.role = :role', { role: UserRole.GESTOR })
      .andWhere('contract.id = :contractId', { contractId })
      .getMany();

    for (const gestor of gestores) {
      if (this.canReceivePendingNotice(gestor)) {
        ids.add(gestor.id);
      }
    }
    return [...ids];
  }

  private canReceivePendingNotice(user: User): boolean {
    return canSeeArea(
      {
        role: user.role,
        areas: (user.accessProfile?.areas ?? []).map((row) => row.area),
      },
      AccessArea.QUALIDADE_PENDENCIAS,
    );
  }

  private async persistAndPublish(
    recipientIds: string[],
    inspectionId: string,
    type: InspectionNoticeType,
    message: string,
  ): Promise<void> {
    const uniqueIds = [...new Set(recipientIds.filter(Boolean))];
    if (uniqueIds.length === 0) return;

    const notices = uniqueIds.map((recipientUserId) =>
      this.noticesRepository.create({
        recipientUserId,
        inspectionId,
        type,
        message,
        readAt: null,
      }),
    );
    const saved = await this.noticesRepository.save(notices);
    const published = Array.isArray(saved) ? saved : [saved];
    for (const notice of published) {
      this.events.next(notice);
    }
  }
}
