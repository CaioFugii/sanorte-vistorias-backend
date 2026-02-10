import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Collaborator } from '../entities';

@Injectable()
export class CollaboratorsService {
  constructor(
    @InjectRepository(Collaborator)
    private collaboratorsRepository: Repository<Collaborator>,
  ) {}

  async findAll(): Promise<Collaborator[]> {
    return this.collaboratorsRepository.find({
      where: { active: true },
    });
  }

  async findOne(id: string): Promise<Collaborator> {
    return this.collaboratorsRepository.findOne({ where: { id } });
  }

  async create(
    collaboratorData: { name: string; active?: boolean },
  ): Promise<Collaborator> {
    const collaborator = this.collaboratorsRepository.create(collaboratorData);
    return this.collaboratorsRepository.save(collaborator);
  }

  async update(
    id: string,
    collaboratorData: Partial<Collaborator>,
  ): Promise<Collaborator> {
    await this.collaboratorsRepository.update(id, collaboratorData);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.collaboratorsRepository.delete(id);
  }
}
