import { Injectable } from '@nestjs/common';
import { ChecklistAnswer, InspectionStatus } from '../common/enums';
import { InspectionItem } from '../entities';

@Injectable()
export class InspectionDomainService {
  calculateScorePercent(items: InspectionItem[]): number {
    const evaluatedItems = items.filter(
      (item) => item.answer && item.answer !== ChecklistAnswer.NAO_APLICAVEL,
    );

    if (evaluatedItems.length === 0) {
      return 100;
    }

    const conformeCount = evaluatedItems.filter(
      (item) => item.answer === ChecklistAnswer.CONFORME,
    ).length;

    return (conformeCount / evaluatedItems.length) * 100;
  }

  hasNonConformity(items: InspectionItem[]): boolean {
    return items.some((item) => item.answer === ChecklistAnswer.NAO_CONFORME);
  }

  resolveFinalStatus(items: InspectionItem[]): InspectionStatus {
    return this.hasNonConformity(items)
      ? InspectionStatus.PENDENTE_AJUSTE
      : InspectionStatus.FINALIZADA;
  }
}
