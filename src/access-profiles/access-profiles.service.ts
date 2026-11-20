import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginatedResponseDto } from '../common/dto/pagination.dto';
import { AccessArea } from '../common/enums';
import { AccessProfile, AccessProfileArea, User } from '../entities';

export type AccessProfileResponse = {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  areas: AccessArea[];
  userCount: number;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class AccessProfilesService {
  constructor(
    @InjectRepository(AccessProfile)
    private readonly profilesRepository: Repository<AccessProfile>,
    @InjectRepository(AccessProfileArea)
    private readonly areasRepository: Repository<AccessProfileArea>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async findAll(
    page: number = 1,
    limit: number = 10,
  ): Promise<PaginatedResponseDto<AccessProfileResponse>> {
    const [rows, total] = await this.profilesRepository.findAndCount({
      relations: ['areas'],
      order: { name: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    const data = await Promise.all(rows.map((row) => this.toResponse(row)));
    const totalPages = Math.ceil(total / limit);
    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  async findOne(id: string): Promise<AccessProfileResponse> {
    const profile = await this.profilesRepository.findOne({
      where: { id },
      relations: ['areas'],
    });
    if (!profile) {
      throw new NotFoundException('Acesso não encontrado');
    }
    return this.toResponse(profile);
  }

  async create(input: {
    name: string;
    description?: string | null;
    areas: AccessArea[];
  }): Promise<AccessProfileResponse> {
    const name = this.normalizeName(input.name);
    const areas = this.normalizeAreas(input.areas);
    await this.assertNameAvailable(name);

    const saved = await this.profilesRepository.save(
      this.profilesRepository.create({
        name,
        description: this.normalizeDescription(input.description),
        isSystem: false,
      }),
    );
    await this.replaceAreas(saved.id, areas);
    return this.findOne(saved.id);
  }

  async update(
    id: string,
    input: {
      name: string;
      description?: string | null;
      areas: AccessArea[];
    },
  ): Promise<AccessProfileResponse> {
    const existing = await this.profilesRepository.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Acesso não encontrado');
    }
    const name = this.normalizeName(input.name);
    const areas = this.normalizeAreas(input.areas);
    await this.assertNameAvailable(name, id);

    existing.name = name;
    existing.description = this.normalizeDescription(input.description);
    await this.profilesRepository.save(existing);
    await this.replaceAreas(id, areas);
    return this.findOne(id);
  }

  async duplicate(id: string, name: string): Promise<AccessProfileResponse> {
    const source = await this.profilesRepository.findOne({
      where: { id },
      relations: ['areas'],
    });
    if (!source) {
      throw new NotFoundException('Acesso não encontrado');
    }
    return this.create({
      name,
      description: source.description,
      areas: (source.areas ?? []).map((row) => row.area),
    });
  }

  async remove(id: string): Promise<void> {
    const existing = await this.profilesRepository.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Acesso não encontrado');
    }
    if (existing.isSystem) {
      throw new ConflictException(
        'Não é possível excluir um Acesso de partida',
      );
    }
    const userCount = await this.usersRepository.count({
      where: { accessProfileId: id },
    });
    if (userCount > 0) {
      throw new ConflictException(
        `Não é possível excluir um Acesso usado por ${userCount} pessoa(s)`,
      );
    }
    await this.profilesRepository.delete(id);
  }

  private async toResponse(
    profile: AccessProfile,
  ): Promise<AccessProfileResponse> {
    const userCount = await this.usersRepository.count({
      where: { accessProfileId: profile.id },
    });
    return {
      id: profile.id,
      name: profile.name,
      description: profile.description ?? null,
      isSystem: profile.isSystem,
      areas: (profile.areas ?? []).map((row) => row.area),
      userCount,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };
  }

  private async replaceAreas(
    accessProfileId: string,
    areas: AccessArea[],
  ): Promise<void> {
    await this.areasRepository.delete({ accessProfileId });
    await this.areasRepository.save(
      areas.map((area) =>
        this.areasRepository.create({ accessProfileId, area }),
      ),
    );
  }

  private async assertNameAvailable(
    name: string,
    currentId?: string,
  ): Promise<void> {
    const taken = await this.profilesRepository.findOne({ where: { name } });
    if (taken && taken.id !== currentId) {
      throw new ConflictException('Já existe um Acesso com esse nome');
    }
  }

  private normalizeName(name?: string): string {
    const normalized = name?.trim();
    if (!normalized) {
      throw new BadRequestException('Nome do Acesso é obrigatório');
    }
    return normalized;
  }

  private normalizeDescription(description?: string | null): string | null {
    const normalized = description?.trim();
    return normalized ? normalized : null;
  }

  private normalizeAreas(areas: AccessArea[]): AccessArea[] {
    if (!Array.isArray(areas) || areas.length === 0) {
      throw new BadRequestException('Informe ao menos uma área');
    }
    const unique = [...new Set(areas)];
    const known = new Set<string>(Object.values(AccessArea));
    if (unique.some((area) => !known.has(area))) {
      throw new BadRequestException('Área inválida');
    }
    return unique;
  }
}
