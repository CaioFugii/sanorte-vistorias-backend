import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AccessProfile, Contract, User } from '../entities';
import { AccessArea, UserRole } from '../common/enums';
import { PaginatedResponseDto } from '../common/dto/pagination.dto';
import { getAllowedContractIds } from '../common/auth/contract-scope.util';
import * as bcrypt from 'bcryptjs';

export type PublicUser = Omit<User, 'passwordHash'>;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Contract)
    private contractsRepository: Repository<Contract>,
    @InjectRepository(AccessProfile)
    private accessProfilesRepository: Repository<AccessProfile>,
  ) {}

  async findByEmail(
    email: string,
    withContracts: boolean = false,
  ): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { email },
      relations: this.authRelations(withContracts),
    });
  }

  async findOne(
    id: string,
    withContracts: boolean = false,
  ): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { id },
      relations: this.authRelations(withContracts),
    });
  }

  async findOneForAuth(id: string): Promise<
    | (Pick<User, 'id' | 'name' | 'email' | 'role'> & {
        contracts: Pick<Contract, 'id' | 'name'>[];
        accessProfileId: string | null;
        areas: AccessArea[];
      })
    | null
  > {
    const user = await this.usersRepository.findOne({
      where: { id },
      relations: ['accessProfile', 'accessProfile.areas'],
    });

    if (!user) {
      return null;
    }

    const contracts = await this.contractsRepository
      .createQueryBuilder('contract')
      .innerJoin(
        'user_contracts',
        'user_contracts',
        'user_contracts.contract_id = contract.id',
      )
      .where('user_contracts.user_id = :userId', { userId: id })
      .select(['contract.id', 'contract.name'])
      .getMany();

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      contracts,
      accessProfileId: user.accessProfileId ?? null,
      areas: this.areasOf(user),
    };
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
    contractId?: string,
  ): Promise<PaginatedResponseDto<PublicUser>> {
    const skip = (page - 1) * limit;
    const selectedContractId = contractId?.trim();

    const idsQuery = this.usersRepository
      .createQueryBuilder('u')
      .select(['u.id', 'u.createdAt'])
      .orderBy('u.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (selectedContractId) {
      idsQuery.innerJoin(
        'u.contracts',
        'filterContract',
        'filterContract.id = :filterContractId',
        { filterContractId: selectedContractId },
      );
    }

    const [idRows, total] = await idsQuery.getManyAndCount();
    const ids = idRows.map((row) => row.id);
    const data =
      ids.length === 0
        ? []
        : await this.usersRepository.find({
            where: { id: In(ids) },
            relations: ['contracts'],
            order: { createdAt: 'DESC' },
          });

    const totalPages = Math.ceil(total / limit);

    return {
      data: data.map((user) => this.withoutPassword(user)),
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

  async findFiscals(
    user?: { role?: string; contracts?: Array<{ id: string }> },
    contractId?: string,
  ): Promise<{ data: Array<Pick<User, 'id' | 'name'>> }> {
    const allowedContractIds = getAllowedContractIds(user);
    const selectedContractId = contractId?.trim() || undefined;

    if (allowedContractIds !== null && allowedContractIds.length === 0) {
      return { data: [] };
    }
    if (
      selectedContractId &&
      allowedContractIds !== null &&
      !allowedContractIds.includes(selectedContractId)
    ) {
      return { data: [] };
    }

    const query = this.usersRepository
      .createQueryBuilder('u')
      .select(['u.id', 'u.name'])
      .where('u.role = :role', { role: UserRole.FISCAL })
      .orderBy('u.name', 'ASC')
      .distinct(true);

    if (selectedContractId) {
      query.innerJoin(
        'u.contracts',
        'filterContract',
        'filterContract.id = :filterContractId',
        { filterContractId: selectedContractId },
      );
    } else if (allowedContractIds !== null) {
      query.innerJoin(
        'u.contracts',
        'allowedContract',
        'allowedContract.id IN (:...allowedContractIds)',
        { allowedContractIds },
      );
    }

    const rows = await query.getMany();
    return { data: rows.map((row) => ({ id: row.id, name: row.name })) };
  }

  async create(
    userData: {
      name: string;
      email: string;
      password: string;
      role: UserRole;
      contractIds?: string[];
      accessProfileId?: string | null;
    },
    actor?: { role?: string | null },
  ): Promise<PublicUser> {
    if (actor?.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Só o Administrador cria usuários');
    }
    if (!Array.isArray(userData.contractIds)) {
      throw new BadRequestException('contractIds é obrigatório');
    }

    const accessProfileId = await this.resolveAccessAssignment(
      userData.role,
      userData.accessProfileId,
    );
    const passwordHash = await bcrypt.hash(userData.password, 10);
    const contracts = await this.resolveContracts(userData.contractIds);

    const user = this.usersRepository.create({
      name: userData.name,
      email: userData.email,
      role: userData.role,
      passwordHash,
      contracts,
      accessProfileId,
    });
    return this.withoutPassword(await this.usersRepository.save(user));
  }

  async update(
    id: string,
    userData: Partial<User> & {
      contractIds?: string[];
      password?: string;
      accessProfileId?: string | null;
    },
    actor?: { role?: string | null },
  ): Promise<PublicUser | null> {
    if (!Array.isArray(userData.contractIds)) {
      throw new BadRequestException('contractIds é obrigatório');
    }

    if (userData.password) {
      userData.passwordHash = await bcrypt.hash(userData.password, 10);
      delete (userData as any).password;
    }

    const existing = await this.findOne(id, true);
    if (!existing) {
      return null;
    }

    this.assertActorMayTouchUser(actor, existing);
    this.assertActorMayChangeAccess(actor, userData);

    const { contractIds, accessProfileId, ...baseData } = userData;
    const nextRole = userData.role ?? existing.role;
    const nextAccessId = await this.resolveAccessAssignment(
      nextRole,
      accessProfileId === undefined
        ? existing.accessProfileId
        : accessProfileId,
      actor?.role === UserRole.ADMIN,
    );
    const contracts = await this.resolveContracts(contractIds);

    const merged = this.usersRepository.merge(existing, baseData, {
      contracts,
      accessProfileId: nextAccessId,
    });
    merged.accessProfile = nextAccessId
      ? ({ id: nextAccessId } as AccessProfile)
      : null;
    await this.usersRepository.save(merged);

    return this.withoutPassword(await this.findOne(id, true));
  }

  async updateContracts(
    id: string,
    contractIds: string[],
    actor?: { role?: string | null },
  ): Promise<PublicUser | null> {
    const user = await this.findOne(id, true);
    if (!user) {
      return null;
    }

    this.assertActorMayTouchUser(actor, user);
    user.contracts = await this.resolveContracts(contractIds);
    await this.usersRepository.save(user);
    return this.withoutPassword(await this.findOne(id, true));
  }

  async remove(id: string, actor?: { role?: string | null }): Promise<void> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (user) {
      this.assertActorMayTouchUser(actor, user);
    }
    await this.usersRepository.delete(id);
  }

  private withoutPassword(user: User): PublicUser;
  private withoutPassword(user: User | null): PublicUser | null;
  private withoutPassword(user: User | null): PublicUser | null {
    if (!user) {
      return null;
    }
    const rest: Partial<User> = { ...user };
    delete rest.passwordHash;
    return rest as PublicUser;
  }

  private assertActorMayTouchUser(
    actor: { role?: string | null } | undefined,
    target: Pick<User, 'role'>,
  ): void {
    if (actor?.role !== UserRole.ADMIN && target.role === UserRole.ADMIN) {
      throw new ForbiddenException(
        'Só o Administrador altera ou exclui um Administrador',
      );
    }
  }

  private authRelations(withContracts: boolean): string[] {
    const relations = ['accessProfile', 'accessProfile.areas'];
    return withContracts ? ['contracts', ...relations] : relations;
  }

  private areasOf(user: User): AccessArea[] {
    return (user.accessProfile?.areas ?? []).map((row) => row.area);
  }

  private assertActorMayChangeAccess(
    actor: { role?: string | null } | undefined,
    userData: { role?: UserRole; accessProfileId?: string | null },
  ): void {
    if (actor?.role === UserRole.ADMIN) {
      return;
    }
    if (userData.role === UserRole.ADMIN) {
      throw new ForbiddenException(
        'Só o Administrador promove um usuário a Administrador',
      );
    }
    if (userData.accessProfileId !== undefined) {
      throw new ForbiddenException('Só o Administrador escolhe o Acesso');
    }
  }

  private async resolveAccessAssignment(
    role: UserRole,
    accessProfileId: string | null | undefined,
    assigning = true,
  ): Promise<string | null> {
    if (!assigning) {
      return accessProfileId ?? null;
    }
    if (role === UserRole.ADMIN) {
      if (accessProfileId) {
        throw new BadRequestException('Administrador não recebe Acesso');
      }
      return null;
    }
    if (!accessProfileId) {
      throw new BadRequestException('Acesso é obrigatório');
    }
    const profile = await this.accessProfilesRepository.findOne({
      where: { id: accessProfileId },
    });
    if (!profile) {
      throw new BadRequestException('Acesso não encontrado');
    }
    return profile.id;
  }

  private async resolveContracts(contractIds?: string[]): Promise<Contract[]> {
    if (!contractIds || contractIds.length === 0) {
      return [];
    }

    const contracts = await this.contractsRepository.find({
      where: {
        id: In(contractIds),
      },
    });

    if (contracts.length !== contractIds.length) {
      throw new BadRequestException(
        'Um ou mais contratos não foram encontrados',
      );
    }

    return contracts;
  }
}
