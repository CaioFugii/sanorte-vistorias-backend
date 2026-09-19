export class DashboardOverviewMonthDto {
  month: string;
  averagePercent: number;
  inspectionsCount: number;
}

export class DashboardOverviewModuleDto {
  averagePercent: number;
  inspectionsCount: number;
  months: DashboardOverviewMonthDto[];
}

export class DashboardOverviewResponseDto {
  from: string;
  to: string;
  quality: DashboardOverviewModuleDto;
  safetyWork: DashboardOverviewModuleDto;
}
