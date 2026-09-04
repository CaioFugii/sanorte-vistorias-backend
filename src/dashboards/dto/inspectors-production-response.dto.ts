export class InspectorDailyCountDto {
  date: string;
  count: number;
}

export class InspectorProductionItemDto {
  userId: string;
  userName: string;
  inspectionsCount: number;
  daysWithInspections: number;
  dailyAverage: number;
  dailyCounts: InspectorDailyCountDto[];
}

export class InspectorsProductionResponseDto {
  from: string;
  to: string;
  days: string[];
  inspectors: InspectorProductionItemDto[];
}
