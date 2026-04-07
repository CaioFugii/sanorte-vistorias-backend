import { SelectQueryBuilder } from 'typeorm';
import { UserRole } from '../enums';

type UserWithScope = {
  role?: UserRole | string;
  contracts?: Array<{ id: string }>;
};

export function getAllowedContractIds(user?: UserWithScope): string[] | null {
  if (!user) {
    return null;
  }

  if (user.role === UserRole.ADMIN) {
    return null;
  }

  return (user.contracts ?? []).map((contract) => contract.id);
}

export function applyContractScopeFilter<T>(
  qb: SelectQueryBuilder<T>,
  allowedContractIds: string[] | null,
  columnName: string,
): void {
  if (allowedContractIds === null) {
    return;
  }

  if (allowedContractIds.length === 0) {
    qb.andWhere('1 = 0');
    return;
  }

  qb.andWhere(`${columnName} IN (:...allowedContractIds)`, {
    allowedContractIds,
  });
}
