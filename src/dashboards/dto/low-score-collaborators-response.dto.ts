export class LowScoreCollaboratorItemDto {
  collaboratorId: string;
  collaboratorName: string;
  inspectionsCount: number;
  badScoresCount: number;
  badScoreRatePercent: number;
  averagePercent: number;
  worstScorePercent: number;
  bestScorePercent: number;
}

export class LowScoreCollaboratorsResponseDto {
  from: string;
  to: string;
  lowScoreThreshold: number;
  collaborators: LowScoreCollaboratorItemDto[];
}
