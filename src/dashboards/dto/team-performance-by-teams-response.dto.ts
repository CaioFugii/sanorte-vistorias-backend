export class TeamPerformanceByTeamsSummaryDto {
  averagePercent: number;
  previousAveragePercent: number;
  inspectionsCount: number;
  pendingAdjustmentsCount: number;
}

export class TeamPerformanceByTeamsCollaboratorDto {
  collaboratorId: string;
  collaboratorName: string;
  qualityPercent: number;
  inspectionsCount: number;
}

export class TeamPerformanceByTeamsItemDto {
  teamId: string;
  teamName: string;
  averagePercent: number;
  inspectionsCount: number;
  pendingAdjustmentsCount: number;
  collaborators: TeamPerformanceByTeamsCollaboratorDto[];
}

export class TeamPerformanceByTeamsResponseDto {
  from: string;
  to: string;
  teamIds: string[];
  summary: TeamPerformanceByTeamsSummaryDto;
  teams: TeamPerformanceByTeamsItemDto[];
}
