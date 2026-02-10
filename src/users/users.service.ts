import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities';
import { UserRole } from '../common/enums';
import { PaginatedResponseDto } from '../common/dto/pagination.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  async findOne(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
  ): Promise<PaginatedResponseDto<User>> {
    const skip = (page - 1) * limit;

    const [data, total] = await this.usersRepository.findAndCount({
      select: ['id', 'name', 'email', 'role', 'createdAt', 'updatedAt'],
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

  async create(userData: {
    name: string;
    email: string;
    password: string;
    role: UserRole;
  }): Promise<User> {
    const passwordHash = await bcrypt.hash(userData.password, 10);
    const user = this.usersRepository.create({
      name: userData.name,
      email: userData.email,
      role: userData.role,
      passwordHash,
    });
    return this.usersRepository.save(user);
  }

  async update(id: string, userData: Partial<User>): Promise<User> {
    if (userData.passwordHash) {
      // Se vier password, hash
      const password = (userData as any).password;
      if (password) {
        userData.passwordHash = await bcrypt.hash(password, 10);
        delete (userData as any).password;
      }
    }
    await this.usersRepository.update(id, userData);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.usersRepository.delete(id);
  }
}
