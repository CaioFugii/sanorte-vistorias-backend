import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Contract } from '../entities';
import { PaginatedResponseDto } from '../common/dto/pagination.dto';
import { CreateContractDto, UpdateContractDto } from './dto';

@Injectable()
export class ContractsService {
  constructor(
    @InjectRepository(Contract)
    private readonly contractsRepository: Repository<Contract>,
  ) {}

  async findAll(
    page: number = 1,
    limit: number = 10,
  ): Promise<PaginatedResponseDto<Contract>> {
    const skip = (page - 1) * limit;
    const [data, total] = await this.contractsRepository.findAndCount({
      skip,
      take: limit,
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

  async findOne(id: string): Promise<Contract> {
    const contract = await this.contractsRepository.findOne({ where: { id } });
    if (!contract) {
      throw new NotFoundException('Contrato não encontrado');
    }
    return contract;
  }

  async create(dto: CreateContractDto): Promise<Contract> {
    const contract = this.contractsRepository.create({
      name: dto.name,
    });
    return this.contractsRepository.save(contract);
  }

  async update(id: string, dto: UpdateContractDto): Promise<Contract> {
    const contract = await this.findOne(id);
    if (dto.name !== undefined) {
      contract.name = dto.name;
    }
    return this.contractsRepository.save(contract);
  }

  async remove(id: string): Promise<void> {
    await this.contractsRepository.delete(id);
  }
}
