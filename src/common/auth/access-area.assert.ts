import { ForbiddenException } from '@nestjs/common';
import { AccessArea, UserRole } from '../enums';
import {
  AccessSubject,
  canActBeyondRole,
  canSeeArea,
} from './access-area.util';

export function assertCanSeeArea(
  user: AccessSubject | null | undefined,
  area: AccessArea,
): void {
  if (!canSeeArea(user, area)) {
    throw new ForbiddenException('Área não visível');
  }
}

export function assertCanSeeAnyArea(
  user: AccessSubject | null | undefined,
  areas: AccessArea[],
): void {
  if (!areas.some((area) => canSeeArea(user, area))) {
    throw new ForbiddenException('Área não visível');
  }
}

export function assertAreaAction(
  user: AccessSubject | null | undefined,
  area: AccessArea,
  allowedRoles: UserRole[],
): void {
  if (user?.role === UserRole.ADMIN) {
    return;
  }
  if (user?.role && allowedRoles.includes(user.role as UserRole)) {
    return;
  }
  if (canActBeyondRole(user, area)) {
    return;
  }
  throw new ForbiddenException('Ação não permitida');
}
