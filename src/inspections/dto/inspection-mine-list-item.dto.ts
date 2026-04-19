import { ModuleType, InspectionStatus } from '../../common/enums';

/**
 * Campos expostos em `GET /inspections/mine` (lista do fiscal).
 * Mantém só o necessário para tabela, filtros e navegação no app.
 */
export interface InspectionMineListItem {
  id: string;
  externalId: string | null;
  module: ModuleType;
  serviceDescription: string | null;
  locationDescription: string | null;
  status: InspectionStatus;
  hasParalysisPenalty: boolean;
  scorePercent: number | null;
  finalizedAt: Date | null;
  createdAt: Date;
  /** Apenas `osNumber` quando há OS vinculada */
  serviceOrder: { osNumber: string } | null;
}
