import { AccessArea, UserRole } from '../enums';
import {
  AREAS_OPERATED_BY_ROLE,
  canActBeyondRole,
  canSeeArea,
} from './access-area.util';

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

  it('área fora do Acesso não é vista', () => {
    const fiscal = { role: UserRole.FISCAL, areas: fiscalAreas };

    expect(canSeeArea(fiscal, AccessArea.GESTAO)).toBe(false);
    expect(canActBeyondRole(fiscal, AccessArea.GESTAO)).toBe(false);
  });
});
