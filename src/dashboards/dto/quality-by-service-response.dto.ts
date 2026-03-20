export class QualityByServiceSeriesDto {
  month: string;
  qualityPercent: number;
  inspectionsCount: number;
}

export class QualityByServiceGrowthDto {
  fromMonth: string;
  toMonth: string;
  growthPercent: number;
  deltaPoints: number;
}

export class QualityByServiceItemDto {
  serviceKey: string;
  serviceLabel: string;
  series: QualityByServiceSeriesDto[];
  growth: QualityByServiceGrowthDto;
}

export class QualityByServiceResponseDto {
  period: string[];
  services: QualityByServiceItemDto[];
}
