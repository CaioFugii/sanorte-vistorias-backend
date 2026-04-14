import { ModuleType } from '../../common/enums';

export class NonConformityQuestionDto {
  checklistItemId: string;
  checklistItemTitle: string;
  nonConformitiesCount: number;
  answersCount: number;
  nonConformityRatePercent: number;
}

export class NonConformityChecklistDto {
  checklistId: string;
  checklistName: string;
  totalNonConformities: number;
  questions: NonConformityQuestionDto[];
}

export class NonConformitiesByChecklistResponseDto {
  from: string;
  to: string;
  module?: ModuleType;
  teamId?: string;
  limitPerChecklist: number;
  checklists: NonConformityChecklistDto[];
}
