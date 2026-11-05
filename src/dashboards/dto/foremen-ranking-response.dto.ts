export class ForemanRankingTeamDto {
  id: string;
  name: string;
}

export class ForemanRankingItemDto {
  foremanId: string;
  foremanName: string;
  teams: ForemanRankingTeamDto[];
  averagePercent: number;
  inspectionsCount: number;
  nonConformitiesCount: number;
  pendingAdjustmentsCount: number;
  resolvedCount: number;
}

export class ForemenRankingResponseDto {
  from: string;
  to: string;
  foremen: ForemanRankingItemDto[];
}
