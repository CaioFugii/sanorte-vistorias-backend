import { ModuleType, InspectionStatus, ChecklistAnswer } from '../../common/enums';

/** Item de checklist na vistoria — sem checklistItem aninhado. */
export interface InspectionDetailItemDto {
  id: string;
  checklistItemId: string;
  checklistItem: {
    title: string | null;
  };
  answer: ChecklistAnswer | null;
  notes: string | null;
  updatedAt: Date;
  resolutionEvidencePath: string | null;
}

/** Evidência para detalhe / PDF */
export interface InspectionDetailEvidenceDto {
  id: string;
  inspectionItemId: string | null;
  fileName: string;
  mimeType: string;
  /** URL HTTP(S) ou caminho público quando não é data URL */
  url: string | null;
  /** Preenchido quando a mídia está armazenada como data URL */
  dataUrl?: string | null;
  cloudinaryPublicId?: string | null;
  bytes?: number | null;
  size?: number;
  format?: string | null;
  width?: number | null;
  height?: number | null;
  createdAt: Date;
}

export interface InspectionDetailSignatureDto {
  id: string;
  signerName: string;
  signedAt: Date;
  url?: string | null;
  dataUrl?: string | null;
  cloudinaryPublicId?: string | null;
}

/**
 * Resposta enxuta de `GET /inspections/:id` para tela + PDF (sem grafo checklist/item aninhado).
 */
export interface InspectionDetailResponseDto {
  id: string;
  externalId: string | null;
  /** Sempre o UUID interno; usar em PUT/POST que exigem id de servidor */
  serverId: string;
  checklistId: string;
  status: InspectionStatus;
  module: ModuleType;
  hasParalysisPenalty: boolean;
  serviceOrderId: string | null;
  serviceDescription: string | null;
  locationDescription: string | null;
  createdAt: Date;
  finalizedAt: Date | null;
  updatedAt: Date;
  scorePercent: number | null;
  /** Opcional PDF / título — UI costuma usar cache do checklist por checklistId */
  team: { name: string } | null;
  checklist: { name: string } | null;
  serviceOrder: { osNumber: string } | null;
  items: InspectionDetailItemDto[];
  evidences: InspectionDetailEvidenceDto[];
  signatures: InspectionDetailSignatureDto[];
}
