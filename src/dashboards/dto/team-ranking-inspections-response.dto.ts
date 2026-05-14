import { ModuleType, InspectionStatus } from '../../common/enums';
import { TeamRankingMetric } from './team-ranking-inspections-query.dto';

export class TeamRankingInspectionItemDto {
  inspectionId: string;
  serviceOrderId: string | null;
  serviceOrderNumber: string | null;
  module: ModuleType;
  status: InspectionStatus;
  scorePercent: number;
  finishedAt: Date | null;
  createdAt: Date;
}

export class TeamRankingInspectionsResponseDto {
  from: string;
  to: string;
  teamId: string;
  teamName: string;
  metric: TeamRankingMetric;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
  inspections: TeamRankingInspectionItemDto[];
}
