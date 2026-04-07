import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { City, Contract } from '../entities';
import { PaginatedResponseDto } from '../common/dto/pagination.dto';
import {
  CreateCityDto,
  CreateContractDto,
  UpdateCityDto,
  UpdateContractDto,
} from './dto';

@Injectable()
export class ContractsService {
  constructor(
    @InjectRepository(Contract)
    private readonly contractsRepository: Repository<Contract>,
    @InjectRepository(City)
    private readonly citiesRepository: Repository<City>,
  ) {}

  async findAll(
    page: number = 1,
    limit: number = 10,
  ): Promise<PaginatedResponseDto<Contract>> {
    const skip = (page - 1) * limit;
    const [data, total] = await this.contractsRepository.findAndCount({
      relations: ['cities'],
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
    const contract = await this.contractsRepository.findOne({
      where: { id },
      relations: ['cities'],
    });
    if (!contract) {
      throw new NotFoundException('Contrato não encontrado');
    }
    return contract;
  }

  async create(dto: CreateContractDto): Promise<Contract> {
    const cities = await this.resolveCities(dto.cityIds);
    const contract = this.contractsRepository.create({
      name: dto.name,
      cities,
    });
    return this.contractsRepository.save(contract);
  }

  async update(id: string, dto: UpdateContractDto): Promise<Contract> {
    const contract = await this.findOne(id);
    if (dto.name !== undefined) {
      contract.name = dto.name;
    }
    if (dto.cityIds !== undefined) {
      contract.cities = await this.resolveCities(dto.cityIds);
    }
    return this.contractsRepository.save(contract);
  }

  async setCities(id: string, cityIds: string[]): Promise<Contract> {
    const contract = await this.findOne(id);
    contract.cities = await this.resolveCities(cityIds);
    return this.contractsRepository.save(contract);
  }

  async remove(id: string): Promise<void> {
    await this.contractsRepository.delete(id);
  }

  async findCities(
    page: number = 1,
    limit: number = 50,
  ): Promise<PaginatedResponseDto<City>> {
    const skip = (page - 1) * limit;
    const [data, total] = await this.citiesRepository.findAndCount({
      skip,
      take: limit,
      order: { name: 'ASC' },
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

  async createCity(dto: CreateCityDto): Promise<City> {
    const city = this.citiesRepository.create(dto);
    return this.citiesRepository.save(city);
  }

  async updateCity(id: string, dto: UpdateCityDto): Promise<City> {
    const city = await this.citiesRepository.findOne({ where: { id } });
    if (!city) {
      throw new NotFoundException('Cidade não encontrada');
    }
    Object.assign(city, dto);
    return this.citiesRepository.save(city);
  }

  async removeCity(id: string): Promise<void> {
    await this.citiesRepository.delete(id);
  }

  private async resolveCities(cityIds?: string[]): Promise<City[]> {
    if (!cityIds || cityIds.length === 0) {
      return [];
    }

    const cities = await this.citiesRepository.find({
      where: { id: In(cityIds) },
    });
    if (cities.length !== cityIds.length) {
      throw new BadRequestException('Uma ou mais cidades não foram encontradas');
    }

    return cities;
  }
}
