import {
  InspectionStatus,
  InvestmentWorkEvaluationModule,
  ModuleType,
} from '../../common/enums';

export class SafetyWorkChecklistInspectionItemDto {
  inspectionId: string;
  externalId: string | null;
  teamId: string | null;
  teamName: string | null;
  serviceOrderId: string | null;
  serviceOrderNumber: string | null;
  serviceOrderAddress: string | null;
  module: ModuleType;
  evaluationModule: InvestmentWorkEvaluationModule | null;
  status: InspectionStatus;
  scorePercent: number;
  finishedAt: Date | null;
  createdAt: Date;
}

export class SafetyWorkChecklistInspectionsResponseDto {
  from: string;
  to: string;
  checklistId: string;
  checklistName: string;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
  inspections: SafetyWorkChecklistInspectionItemDto[];
}
