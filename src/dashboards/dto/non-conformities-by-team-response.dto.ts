import { ModuleType } from '../../common/enums';
import { NonConformityChecklistDto } from './non-conformities-by-checklist-response.dto';

export class NonConformitiesByTeamResponseDto {
  from: string;
  to: string;
  module?: ModuleType;
  teamId: string;
  limit: number;
  checklists: NonConformityChecklistDto[];
}
