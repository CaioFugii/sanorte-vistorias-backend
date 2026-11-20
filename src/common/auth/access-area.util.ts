import { AccessArea, ACCESS_AREAS_IN_ORDER, UserRole } from '../enums';

export type AccessSubject = {
  role?: UserRole | string | null;
  areas?: ReadonlyArray<AccessArea | string> | null;
};

const FIELD_EXECUTION_AREAS: readonly AccessArea[] = [
  AccessArea.CAMPO_MINHAS,
  AccessArea.CAMPO_NOVA,
];

export const AREAS_OPERATED_BY_ROLE: Record<UserRole, readonly AccessArea[]> = {
  [UserRole.ADMIN]: ACCESS_AREAS_IN_ORDER.filter(
    (area) => !FIELD_EXECUTION_AREAS.includes(area),
  ),
  [UserRole.GESTOR]: [
    AccessArea.GESTAO,
    AccessArea.QUALIDADE_DADOS,
    AccessArea.QUALIDADE_PAINEL,
    AccessArea.QUALIDADE_PENDENCIAS,
    AccessArea.SEGURANCA_DADOS,
    AccessArea.ENGENHARIA_OBRAS,
    AccessArea.ENGENHARIA_RELATORIOS,
  ],
  [UserRole.SUPERVISOR]: [
    AccessArea.GESTAO,
    AccessArea.QUALIDADE_DADOS,
    AccessArea.QUALIDADE_PENDENCIAS,
    AccessArea.SEGURANCA_DADOS,
    AccessArea.ENGENHARIA_RELATORIOS,
  ],
  [UserRole.FISCAL]: [
    AccessArea.CAMPO_MINHAS,
    AccessArea.CAMPO_NOVA,
    AccessArea.ENGENHARIA_RELATORIOS,
  ],
};

export function roleOperatesArea(
  role: UserRole | string | null | undefined,
  area: AccessArea,
): boolean {
  if (!role) {
    return false;
  }
  return (AREAS_OPERATED_BY_ROLE[role as UserRole] ?? []).includes(area);
}

export function canSeeArea(
  user: AccessSubject | null | undefined,
  area: AccessArea,
): boolean {
  if (!user?.role) {
    return false;
  }
  if (user.role === UserRole.ADMIN) {
    return roleOperatesArea(UserRole.ADMIN, area);
  }
  return (user.areas ?? []).includes(area);
}

export function canActBeyondRole(
  user: AccessSubject | null | undefined,
  area: AccessArea,
): boolean {
  if (!user?.role || user.role === UserRole.ADMIN) {
    return false;
  }
  if (roleOperatesArea(user.role, area)) {
    return false;
  }
  return (user.areas ?? []).includes(area);
}

export function visibleAreas(
  user: AccessSubject | null | undefined,
): AccessArea[] {
  if (!user?.role) {
    return [];
  }
  if (user.role === UserRole.ADMIN) {
    return [...AREAS_OPERATED_BY_ROLE[UserRole.ADMIN]];
  }
  const known = new Set<string>(ACCESS_AREAS_IN_ORDER);
  return (user.areas ?? []).filter((area): area is AccessArea =>
    known.has(area),
  );
}
