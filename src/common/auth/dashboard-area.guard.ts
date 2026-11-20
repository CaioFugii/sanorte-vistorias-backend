import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AccessArea } from '../enums';
import { assertCanSeeArea } from './access-area.assert';

export function dashboardAreaForUrl(url: string): AccessArea {
  const path = url.split('?')[0];
  if (path.includes('/safety-work/')) {
    return AccessArea.SEGURANCA_DADOS;
  }
  if (path.endsWith('/overview')) {
    return AccessArea.GESTAO;
  }
  return AccessArea.QUALIDADE_DADOS;
}

@Injectable()
export class DashboardAreaGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const url = request.originalUrl || request.url || '';
    assertCanSeeArea(request.user, dashboardAreaForUrl(url));
    return true;
  }
}
