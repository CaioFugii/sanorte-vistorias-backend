export class QualityNonConformityQuestionDto {
  checklistItemId: string;
  checklistItemTitle: string;
  nonConformitiesCount: number;
  answersCount: number;
  nonConformityRatePercent: number;
}

export class QualityNonConformityChecklistDto {
  checklistId: string;
  checklistName: string;
  totalNonConformities: number;
  questions: QualityNonConformityQuestionDto[];
}

export class QualityNonConformitySectorDto {
  sectorName: string;
  checklists: QualityNonConformityChecklistDto[];
}

export class QualityNonConformityModuleDto {
  module: 'REMOTO' | 'POS_OBRA' | 'CAMPO' | 'OBRA_SEM_TIPO';
  sectors: QualityNonConformitySectorDto[];
}

export class QualityNonConformitiesListResponseDto {
  from: string;
  to: string;
  teamId?: string;
  limitPerChecklist: number;
  modules: QualityNonConformityModuleDto[];
}
