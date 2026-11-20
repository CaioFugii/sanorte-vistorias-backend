import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AccessArea, UserRole } from '../common/enums';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthService áreas visíveis', () => {
  const jwtService = { sign: jest.fn().mockReturnValue('token') };

  beforeEach(() => {
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function serviceFor(user: any) {
    const usersService = {
      findByEmail: jest.fn().mockResolvedValue(user),
    };
    return new AuthService(usersService as any, jwtService as any);
  }

  it('devolve as 7 áreas do Administrador, sem Campo, e não as coloca no token', async () => {
    const service = serviceFor({
      id: 'admin-1',
      name: 'Admin',
      email: 'admin@sanorte.com',
      role: UserRole.ADMIN,
      passwordHash: 'hash',
      contracts: [],
      accessProfile: null,
    });

    const result = await service.login({
      email: 'admin@sanorte.com',
      password: 'senha123',
    });

    expect(jwtService.sign).toHaveBeenCalledWith({
      email: 'admin@sanorte.com',
      sub: 'admin-1',
      role: UserRole.ADMIN,
    });
    expect(result.user.areas).toHaveLength(7);
    expect(result.user.areas).toContain(AccessArea.GESTAO);
    expect(result.user.areas).not.toContain(AccessArea.CAMPO_MINHAS);
    expect(result.user.areas).not.toContain(AccessArea.CAMPO_NOVA);
    expect(result.user.areas).not.toContain('admin_checklists');
  });

  it('ignora área de Administração que ficou gravada num Acesso', async () => {
    const service = serviceFor({
      id: 'fiscal-1',
      name: 'Ana',
      email: 'fiscal@sanorte.com',
      role: UserRole.FISCAL,
      passwordHash: 'hash',
      contracts: [],
      accessProfile: {
        areas: [{ area: AccessArea.CAMPO_MINHAS }, { area: 'admin_equipes' }],
      },
    });

    const result = await service.login({
      email: 'fiscal@sanorte.com',
      password: 'senha123',
    });

    expect(result.user.areas).toEqual([AccessArea.CAMPO_MINHAS]);
  });

  it('devolve as três áreas do Fiscal de partida', async () => {
    const service = serviceFor({
      id: 'fiscal-1',
      name: 'Ana',
      email: 'fiscal@sanorte.com',
      role: UserRole.FISCAL,
      passwordHash: 'hash',
      contracts: [],
      accessProfile: {
        areas: [
          { area: AccessArea.CAMPO_MINHAS },
          { area: AccessArea.CAMPO_NOVA },
          { area: AccessArea.ENGENHARIA_RELATORIOS },
        ],
      },
    });

    const result = await service.login({
      email: 'fiscal@sanorte.com',
      password: 'senha123',
    });

    expect(result.user.areas).toEqual([
      AccessArea.CAMPO_MINHAS,
      AccessArea.CAMPO_NOVA,
      AccessArea.ENGENHARIA_RELATORIOS,
    ]);
  });

  it('rejeita senha inválida', async () => {
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);
    const service = serviceFor({
      id: 'admin-1',
      email: 'admin@sanorte.com',
      role: UserRole.ADMIN,
      passwordHash: 'hash',
    });

    await expect(
      service.login({ email: 'admin@sanorte.com', password: 'errada' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('AuthController /auth/me', () => {
  it('devolve as áreas do usuário autenticado', async () => {
    const controller = new AuthController({} as AuthService);
    const me = await controller.getProfile({
      id: 'fiscal-1',
      name: 'Ana',
      email: 'fiscal@sanorte.com',
      role: UserRole.FISCAL,
      contracts: [],
      areas: [
        AccessArea.CAMPO_MINHAS,
        AccessArea.CAMPO_NOVA,
        AccessArea.ENGENHARIA_RELATORIOS,
      ],
    });

    expect(me.areas).toEqual([
      AccessArea.CAMPO_MINHAS,
      AccessArea.CAMPO_NOVA,
      AccessArea.ENGENHARIA_RELATORIOS,
    ]);
  });
});
