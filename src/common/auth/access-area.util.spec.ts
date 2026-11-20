import { ForbiddenException } from '@nestjs/common';
import { AccessArea, ACCESS_AREAS_IN_ORDER, UserRole } from '../enums';
import { assertCanSeeAllAreas } from './access-area.assert';
import {
  AREAS_OPERATED_BY_ROLE,
  canActBeyondRole,
  canSeeArea,
} from './access-area.util';

const PAINEL_E_OBRAS = [
  AccessArea.QUALIDADE_PAINEL,
  AccessArea.ENGENHARIA_OBRAS,
];

describe('access-area.util', () => {
  const gestorAreas = AREAS_OPERATED_BY_ROLE[UserRole.GESTOR];
  const fiscalAreas = AREAS_OPERATED_BY_ROLE[UserRole.FISCAL];

  it('administrador vê todas as áreas mesmo sem Acesso, exceto as de Campo', () => {
    const fieldAreas = [AccessArea.CAMPO_MINHAS, AccessArea.CAMPO_NOVA];
    for (const area of Object.values(AccessArea)) {
      expect(canSeeArea({ role: UserRole.ADMIN, areas: [] }, area)).toBe(
        !fieldAreas.includes(area),
      );
    }
  });

  it('administrador não vê Campo nem quando o pedido traz essas áreas', () => {
    const admin = {
      role: UserRole.ADMIN,
      areas: [AccessArea.CAMPO_MINHAS, AccessArea.CAMPO_NOVA],
    };

    expect(canSeeArea(admin, AccessArea.CAMPO_MINHAS)).toBe(false);
    expect(canSeeArea(admin, AccessArea.CAMPO_NOVA)).toBe(false);
  });

  it('gestor com Painel no Acesso de partida não ganha exclusão em massa', () => {
    const gestor = { role: UserRole.GESTOR, areas: gestorAreas };

    expect(canSeeArea(gestor, AccessArea.QUALIDADE_PAINEL)).toBe(true);
    expect(canActBeyondRole(gestor, AccessArea.QUALIDADE_PAINEL)).toBe(false);
  });

  it('fiscal com Painel no Acesso ganha a ação dessa área', () => {
    const fiscal = {
      role: UserRole.FISCAL,
      areas: [AccessArea.QUALIDADE_PAINEL],
    };

    expect(canSeeArea(fiscal, AccessArea.QUALIDADE_PAINEL)).toBe(true);
    expect(canActBeyondRole(fiscal, AccessArea.QUALIDADE_PAINEL)).toBe(true);
  });

  it('Obras Inv fica logo após o Painel e mantém o valor engenharia_obras', () => {
    const painel = ACCESS_AREAS_IN_ORDER.indexOf(AccessArea.QUALIDADE_PAINEL);
    const obras = ACCESS_AREAS_IN_ORDER.indexOf(AccessArea.ENGENHARIA_OBRAS);

    expect(AccessArea.ENGENHARIA_OBRAS).toBe('engenharia_obras');
    expect(obras).toBe(painel + 1);
  });

  it('os papéis de partida continuam com as mesmas áreas', () => {
    expect(AREAS_OPERATED_BY_ROLE[UserRole.GESTOR]).toEqual([
      AccessArea.GESTAO,
      AccessArea.QUALIDADE_DADOS,
      AccessArea.QUALIDADE_PAINEL,
      AccessArea.QUALIDADE_PENDENCIAS,
      AccessArea.SEGURANCA_DADOS,
      AccessArea.ENGENHARIA_OBRAS,
      AccessArea.ENGENHARIA_RELATORIOS,
    ]);
    expect(AREAS_OPERATED_BY_ROLE[UserRole.SUPERVISOR]).not.toContain(
      AccessArea.ENGENHARIA_OBRAS,
    );
    expect(AREAS_OPERATED_BY_ROLE[UserRole.FISCAL]).not.toContain(
      AccessArea.ENGENHARIA_OBRAS,
    );
  });

  it('exige Painel e Obras Inv juntos', () => {
    const soPainel = {
      role: UserRole.GESTOR,
      areas: [AccessArea.QUALIDADE_PAINEL],
    };
    const soObras = {
      role: UserRole.GESTOR,
      areas: [AccessArea.ENGENHARIA_OBRAS],
    };
    const asDuas = {
      role: UserRole.GESTOR,
      areas: PAINEL_E_OBRAS,
    };

    expect(() => assertCanSeeAllAreas(soPainel, PAINEL_E_OBRAS)).toThrow(
      ForbiddenException,
    );
    expect(() => assertCanSeeAllAreas(soObras, PAINEL_E_OBRAS)).toThrow(
      ForbiddenException,
    );
    expect(() => assertCanSeeAllAreas(asDuas, PAINEL_E_OBRAS)).not.toThrow();
  });

  it('área fora do Acesso não é vista', () => {
    const fiscal = { role: UserRole.FISCAL, areas: fiscalAreas };

    expect(canSeeArea(fiscal, AccessArea.GESTAO)).toBe(false);
    expect(canActBeyondRole(fiscal, AccessArea.GESTAO)).toBe(false);
  });
});
