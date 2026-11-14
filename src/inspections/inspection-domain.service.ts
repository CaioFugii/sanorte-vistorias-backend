import { Injectable } from '@nestjs/common';
import {
  ChecklistAnswer,
  InspectionStatus,
  InvestmentWorkEvaluationModule,
  ModuleType,
} from '../common/enums';
import { InspectionItem } from '../entities';

export type EffectivePendingKind = 'CAMPO' | 'POS_OBRA' | 'LEGACY';

export type FinalStatusContext = {
  evaluationModule?: InvestmentWorkEvaluationModule | null;
  generatePending?: boolean | null;
  /** Só vistorias de Segurança finalizadas depois desta regra. */
  safetyPendingRule?: boolean | null;
};

/** Taxa vigente para paralisação nova. Vistorias antigas guardam 25. */
export const NEW_PARALYSIS_PENALTY_PERCENT = 35;

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

    const baseScore = (conformeCount / evaluatedItems.length) * 100;
    return this.roundPercent(baseScore);
  }

  applyParalysisPenalty(
    baseScorePercent: number,
    penaltyPercent: number | null | undefined,
  ): number {
    if (penaltyPercent == null || penaltyPercent <= 0) {
      return this.roundPercent(baseScorePercent);
    }

    return this.roundPercent(baseScorePercent * (1 - penaltyPercent / 100));
  }

  hasNonConformity(items: InspectionItem[]): boolean {
    return items.some((item) => item.answer === ChecklistAnswer.NAO_CONFORME);
  }

  /**
   * Módulo usado para decidir se a finalização gera pendência.
   * Quem pode lançar a resolução usa `inspection.module`, não este resultado.
   */
  effectivePendingKind(
    module: ModuleType,
    evaluationModule?: InvestmentWorkEvaluationModule | null,
  ): EffectivePendingKind {
    if (module === ModuleType.OBRAS_INVESTIMENTO) {
      if (evaluationModule === InvestmentWorkEvaluationModule.CAMPO) {
        return 'CAMPO';
      }
      if (evaluationModule === InvestmentWorkEvaluationModule.POS_OBRA) {
        return 'POS_OBRA';
      }
      return 'LEGACY';
    }
    if (module === ModuleType.CAMPO) return 'CAMPO';
    if (module === ModuleType.POS_OBRA) return 'POS_OBRA';
    return 'LEGACY';
  }

  requiresGeneratePendingChoice(
    module: ModuleType,
    evaluationModule?: InvestmentWorkEvaluationModule | null,
  ): boolean {
    return this.effectivePendingKind(module, evaluationModule) === 'CAMPO';
  }

  resolveFinalStatus(
    items: InspectionItem[],
    module: ModuleType,
    context?: FinalStatusContext,
  ): InspectionStatus {
    if (module === ModuleType.REMOTO) {
      return InspectionStatus.FINALIZADA;
    }

    if (module === ModuleType.SEGURANCA_TRABALHO) {
      if (
        context?.safetyPendingRule === true &&
        this.hasNonConformity(items)
      ) {
        return InspectionStatus.PENDENTE_AJUSTE;
      }
      return InspectionStatus.FINALIZADA;
    }

    if (!this.hasNonConformity(items)) {
      return InspectionStatus.FINALIZADA;
    }

    const kind = this.effectivePendingKind(
      module,
      context?.evaluationModule ?? null,
    );
    if (kind === 'CAMPO' && context?.generatePending === false) {
      return InspectionStatus.FINALIZADA;
    }

    return InspectionStatus.PENDENTE_AJUSTE;
  }

  private roundPercent(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
