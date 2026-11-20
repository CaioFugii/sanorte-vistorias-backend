import { BadRequestException, ConflictException } from '@nestjs/common';
import { AccessArea } from '../common/enums';
import { AccessProfilesService } from './access-profiles.service';

function serviceWith(profiles: any, areas: any = {}, users: any = {}) {
  return new AccessProfilesService(profiles, areas, users);
}

describe('AccessProfilesService', () => {
  const createdAt = new Date('2026-01-01T00:00:00.000Z');
  const updatedAt = new Date('2026-01-02T00:00:00.000Z');

  it('cria um Acesso e o detalhe informa quantas pessoas usam', async () => {
    const profiles = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'p1',
          name: 'Plantão',
          description: null,
          isSystem: false,
          areas: [{ area: AccessArea.GESTAO }],
          createdAt,
          updatedAt,
        }),
      create: jest.fn((data) => data),
      save: jest.fn(async (data) => ({ ...data, id: 'p1' })),
    };
    const areas = {
      delete: jest.fn(),
      create: jest.fn((data) => data),
      save: jest.fn(),
    };
    const users = { count: jest.fn().mockResolvedValue(2) };
    const service = serviceWith(profiles, areas, users);

    const result = await service.create({
      name: ' Plantão ',
      areas: [AccessArea.GESTAO],
    });

    expect(profiles.save).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Plantão', isSystem: false }),
    );
    expect(result.userCount).toBe(2);
    expect(result.areas).toEqual([AccessArea.GESTAO]);
  });

  it('recusa Acesso sem área', async () => {
    const profiles = { save: jest.fn(), findOne: jest.fn() };
    const service = serviceWith(profiles);

    await expect(
      service.create({ name: 'Vazio', areas: [] }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(profiles.save).not.toHaveBeenCalled();
  });

  it('recusa área de Administração', async () => {
    const profiles = { save: jest.fn(), findOne: jest.fn() };
    const service = serviceWith(profiles);

    await expect(
      service.create({
        name: 'Equipes',
        areas: [AccessArea.CAMPO_MINHAS, 'admin_equipes' as AccessArea],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(profiles.save).not.toHaveBeenCalled();
  });

  it('recusa nome repetido', async () => {
    const profiles = {
      findOne: jest.fn().mockResolvedValue({ id: 'other', name: 'Plantão' }),
      save: jest.fn(),
    };
    const service = serviceWith(profiles);

    await expect(
      service.create({ name: 'Plantão', areas: [AccessArea.GESTAO] }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(profiles.save).not.toHaveBeenCalled();
  });

  it('duplica copiando as áreas', async () => {
    const profiles = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce({
          id: 'origem',
          name: 'Gestor',
          description: 'base',
          isSystem: true,
          areas: [
            { area: AccessArea.GESTAO },
            { area: AccessArea.QUALIDADE_DADOS },
          ],
        })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'copia',
          name: 'Gestor cópia',
          description: 'base',
          isSystem: false,
          areas: [
            { area: AccessArea.GESTAO },
            { area: AccessArea.QUALIDADE_DADOS },
          ],
          createdAt,
          updatedAt,
        }),
      create: jest.fn((data) => data),
      save: jest.fn(async (data) => ({ ...data, id: 'copia' })),
    };
    const areas = {
      delete: jest.fn(),
      create: jest.fn((data) => data),
      save: jest.fn(),
    };
    const users = { count: jest.fn().mockResolvedValue(0) };
    const service = serviceWith(profiles, areas, users);

    const result = await service.duplicate('origem', 'Gestor cópia');

    expect(areas.save).toHaveBeenCalledWith([
      { accessProfileId: 'copia', area: AccessArea.GESTAO },
      { accessProfileId: 'copia', area: AccessArea.QUALIDADE_DADOS },
    ]);
    expect(result.isSystem).toBe(false);
    expect(result.areas).toEqual([
      AccessArea.GESTAO,
      AccessArea.QUALIDADE_DADOS,
    ]);
  });

  it('recusa exclusão dos três de partida', async () => {
    const profiles = {
      findOne: jest.fn().mockResolvedValue({ id: 'g', isSystem: true }),
      delete: jest.fn(),
    };
    const service = serviceWith(profiles);

    await expect(service.remove('g')).rejects.toBeInstanceOf(ConflictException);
    expect(profiles.delete).not.toHaveBeenCalled();
  });

  it('recusa exclusão enquanto houver usuário e informa a quantidade', async () => {
    const profiles = {
      findOne: jest.fn().mockResolvedValue({ id: 'p', isSystem: false }),
      delete: jest.fn(),
    };
    const users = { count: jest.fn().mockResolvedValue(4) };
    const service = serviceWith(profiles, {}, users);

    await expect(service.remove('p')).rejects.toThrow(
      'Não é possível excluir um Acesso usado por 4 pessoa(s)',
    );
    expect(profiles.delete).not.toHaveBeenCalled();
  });
});
