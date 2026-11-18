import { ForemanRankingTeamDto } from './foremen-ranking-response.dto';

export class HierarchyRankingItemDto {
  id: string;
  name: string;
  teams: ForemanRankingTeamDto[];
  averagePercent: number;
  inspectionsCount: number;
  nonConformitiesCount: number;
  pendingAdjustmentsCount: number;
  resolvedCount: number;
}

export class FieldSupervisorsRankingResponseDto {
  from: string;
  to: string;
  supervisors: HierarchyRankingItemDto[];
}

export class CoordinatorsRankingResponseDto {
  from: string;
  to: string;
  coordinators: HierarchyRankingItemDto[];
}
