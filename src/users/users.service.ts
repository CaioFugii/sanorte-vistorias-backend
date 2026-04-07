import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Contract, User } from '../entities';
import { UserRole } from '../common/enums';
import { PaginatedResponseDto } from '../common/dto/pagination.dto';
import * as bcrypt from 'bcrypt';

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

  async findOne(id: string, withContracts: boolean = false): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { id },
      relations: withContracts ? ['contracts'] : [],
    });
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
  ): Promise<PaginatedResponseDto<User>> {
    const skip = (page - 1) * limit;

    const [data, total] = await this.usersRepository.findAndCount({
      skip,
      take: limit,
      order: { createdAt: 'DESC' },
      relations: ['contracts'],
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

    const merged = this.usersRepository.merge(existing, baseData, { contracts });
    await this.usersRepository.save(merged);

    return this.findOne(id, true);
  }

  async updateContracts(id: string, contractIds: string[]): Promise<User | null> {
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
      throw new BadRequestException('Um ou mais contratos não foram encontrados');
    }

    return contracts;
  }
}
