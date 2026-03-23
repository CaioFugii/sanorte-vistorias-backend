import { ChecklistAnswer, InspectionScope, ModuleType } from '../../common/enums';

export type SyncInspectionItemDto = {
  checklistItemId: string;
  answer?: ChecklistAnswer;
  notes?: string;
};

export type SyncEvidenceDto = {
  /** Id do item no app (pode não existir no servidor). Preferir checklistItemId no sync. */
  inspectionItemId?: string;
  /** Id do item do checklist; usado para resolver o inspection_item no servidor. */
  checklistItemId?: string;
  cloudinaryPublicId?: string;
  url?: string;
  bytes?: number;
  format?: string;
  width?: number;
  height?: number;
  // Legacy references (kept for compatibility)
  filePath?: string;
  fileName?: string;
  mimeType?: string;
  size?: number;
  // Legacy payload that is no longer accepted
  dataUrl?: string;
};

export type SyncSignatureDto = {
  signerName: string;
  signerRoleLabel?: string;
  cloudinaryPublicId?: string;
  url?: string;
  // Legacy references (kept for compatibility)
  imagePath?: string;
  // Legacy payload that is no longer accepted
  imageBase64?: string;
  dataUrl?: string;
  signedAt?: string;
};

export type SyncParalyzeDto = {
  reason: string;
};

export type SyncInspectionDto = {
  externalId: string;
  module: ModuleType;
  inspectionScope?: InspectionScope;
  checklistId: string;
  teamId: string;
  serviceOrderId?: string;
  serviceDescription: string;
  locationDescription?: string;
  collaboratorIds?: string[];
  createdOffline?: boolean;
  syncedAt?: string;
  finalize?: boolean;
  paralyze?: SyncParalyzeDto;
  items?: SyncInspectionItemDto[];
  evidences?: SyncEvidenceDto[];
  signature?: SyncSignatureDto;
};

export type SyncInspectionsRequestDto = {
  inspections: SyncInspectionDto[];
};
