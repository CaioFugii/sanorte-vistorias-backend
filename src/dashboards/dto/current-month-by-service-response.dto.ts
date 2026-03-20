export class CurrentMonthSummaryDto {
  averagePercent: number;
  inspectionsCount: number;
  pendingAdjustmentsCount: number;
}

export class CurrentMonthServiceItemDto {
  serviceKey: string;
  serviceLabel: string;
  ownerLabel: string | null;
  qualityPercent: number;
  inspectionsCount: number;
}

export class CurrentMonthByServiceResponseDto {
  month: string;
  summary: CurrentMonthSummaryDto;
  services: CurrentMonthServiceItemDto[];
}
