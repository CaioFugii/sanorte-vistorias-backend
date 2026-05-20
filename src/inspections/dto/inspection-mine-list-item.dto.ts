import { InspectionListItemDto } from './inspection-list-item.dto';

/**
 * Alias de compatibilidade para a listagem "minhas vistorias".
 * Mantém consumo legado sem duplicar contrato.
 */
export type InspectionMineListItem = InspectionListItemDto;
