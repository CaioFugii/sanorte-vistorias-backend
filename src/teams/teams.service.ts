import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Team } from '../entities';

@Injectable()
export class TeamsService {
  constructor(
    @InjectRepository(Team)
    private teamsRepository: Repository<Team>,
  ) {}

  async findAll(): Promise<Team[]> {
    return this.teamsRepository.find({
      where: { active: true },
      relations: ['collaborators'],
    });
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
