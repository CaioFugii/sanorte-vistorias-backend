import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Contract, User } from '../entities';
import { UserRole } from '../common/enums';
import { PaginatedResponseDto } from '../common/dto/pagination.dto';
import { getAllowedContractIds } from '../common/auth/contract-scope.util';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Contract)
    private contractsRepository: Repository<Contract>,
  ) {}

  async findByEmail(
    email: string,
    withContracts: boolean = false,
  ): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { email },
      relations: withContracts ? ['contracts'] : [],
    });
  }

  async findOne(
    id: string,
    withContracts: boolean = false,
  ): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { id },
      relations: withContracts ? ['contracts'] : [],
    });
  }

  async findOneForAuth(id: string): Promise<
    | (Pick<User, 'id' | 'name' | 'email' | 'role'> & {
        contracts: Pick<Contract, 'id' | 'name'>[];
      })
    | null
  > {
    const user = await this.usersRepository.findOne({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
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
    };
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
    contractId?: string,
  ): Promise<PaginatedResponseDto<User>> {
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

  async create(userData: {
    name: string;
    email: string;
    password: string;
    role: UserRole;
    contractIds?: string[];
  }): Promise<User> {
    if (!Array.isArray(userData.contractIds)) {
      throw new BadRequestException('contractIds é obrigatório');
    }

    const passwordHash = await bcrypt.hash(userData.password, 10);
    const contracts = await this.resolveContracts(userData.contractIds);

    const user = this.usersRepository.create({
      name: userData.name,
      email: userData.email,
      role: userData.role,
      passwordHash,
      contracts,
    });
    return this.usersRepository.save(user);
  }

  async update(
    id: string,
    userData: Partial<User> & { contractIds?: string[]; password?: string },
  ): Promise<User> {
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

    const { contractIds, ...baseData } = userData;
    const contracts = await this.resolveContracts(contractIds);

    const merged = this.usersRepository.merge(existing, baseData, {
      contracts,
    });
    await this.usersRepository.save(merged);

    return this.findOne(id, true);
  }

  async updateContracts(
    id: string,
    contractIds: string[],
  ): Promise<User | null> {
    const user = await this.findOne(id, true);
    if (!user) {
      return null;
    }

    user.contracts = await this.resolveContracts(contractIds);
    await this.usersRepository.save(user);
    return this.findOne(id, true);
  }

  async remove(id: string): Promise<void> {
    await this.usersRepository.delete(id);
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
