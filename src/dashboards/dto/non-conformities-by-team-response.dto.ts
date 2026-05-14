import { ModuleType } from '../../common/enums';

export class TeamTopNonConformityDto {
  checklistItemId: string;
  checklistItemTitle: string;
  nonConformitiesCount: number;
  answersCount: number;
  nonConformityRatePercent: number;
  checklistsCount: number;
}

export class NonConformitiesByTeamResponseDto {
  from: string;
  to: string;
  module?: ModuleType;
  teamId: string;
  limit: number;
  nonConformities: TeamTopNonConformityDto[];
}
