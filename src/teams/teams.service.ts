import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Team } from '../entities';
import { PaginatedResponseDto } from '../common/dto/pagination.dto';

@Injectable()
export class TeamsService {
  constructor(
    @InjectRepository(Team)
    private teamsRepository: Repository<Team>,
  ) {}

  async findAll(
    page: number = 1,
    limit: number = 10,
  ): Promise<PaginatedResponseDto<Team>> {
    const skip = (page - 1) * limit;

    const [data, total] = await this.teamsRepository.findAndCount({
      where: { active: true },
      relations: ['collaborators'],
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

  async findOne(id: string): Promise<Team> {
    return this.teamsRepository.findOne({
      where: { id },
      relations: ['collaborators'],
    });
  }

  async create(teamData: { name: string; active?: boolean }): Promise<Team> {
    const team = this.teamsRepository.create(teamData);
    return this.teamsRepository.save(team);
  }

  async update(id: string, teamData: Partial<Team>): Promise<Team> {
    await this.teamsRepository.update(id, teamData);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.teamsRepository.delete(id);
  }
}
