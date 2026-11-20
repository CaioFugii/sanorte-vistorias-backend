import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AccessArea, UserRole } from '../enums';
import { assertAreaAction } from './access-area.assert';

export const AREA_ACTION_KEY = 'areaAction';

export const AreaAction = (area: AccessArea, allowedRoles: UserRole[] = []) =>
  SetMetadata(AREA_ACTION_KEY, { area, allowedRoles });

@Injectable()
export class AreaActionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const meta = this.reflector.getAllAndOverride<{
      area: AccessArea;
      allowedRoles: UserRole[];
    }>(AREA_ACTION_KEY, [context.getHandler(), context.getClass()]);
    if (!meta) {
      return true;
    }
    const { user } = context.switchToHttp().getRequest();
    assertAreaAction(user, meta.area, meta.allowedRoles);
    return true;
  }
}
