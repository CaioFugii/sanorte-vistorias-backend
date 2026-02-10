import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities';
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

  async findAll(): Promise<User[]> {
    return this.usersRepository.find({
      select: ['id', 'name', 'email', 'role', 'createdAt', 'updatedAt'],
    });
  }

  async create(userData: {
    name: string;
    email: string;
    password: string;
    role: string;
  }): Promise<User> {
    const passwordHash = await bcrypt.hash(userData.password, 10);
    const user = this.usersRepository.create({
      ...userData,
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
