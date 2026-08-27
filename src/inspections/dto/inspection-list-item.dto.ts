import {
  InspectionStatus,
  InvestmentWorkEvaluationModule,
  ModuleType,
} from '../../common/enums';

export interface InspectionListItemDto {
  externalId: string;
  module: ModuleType;
  evaluationModule: InvestmentWorkEvaluationModule | null;
  serviceDescription: string | null;
  locationDescription: string | null;
  status: InspectionStatus;
  scorePercent: number | null;
  hasParalysisPenalty: boolean;
  finalizedAt: Date | null;
  createdAt: Date;
  team: { name: string } | null;
  serviceOrder: {
    osNumber: string;
    fimExecucao: Date | null;
    resultado: string | null;
  } | null;
  investmentWork: {
    id: string;
    name: string | null;
    workName: string | null;
  } | null;
  pendingItemsCount?: number;
  pendingItemsPreview?: string[];
  createdBy?: { name: string } | null;
}
