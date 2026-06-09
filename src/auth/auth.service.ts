import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.usersService.findByEmail(email, true);
    if (user && (await bcrypt.compare(password, user.passwordHash))) {
      const result = { ...user };
      delete result.passwordHash;
      return result;
    }
    return null;
  }

  async login(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto.email, loginDto.password);
    if (!user) {
      this.logger.warn('Login failed due invalid credentials', {
        email: loginDto.email,
      });
      throw new UnauthorizedException('Credenciais inválidas');
    }
    const payload = { email: user.email, sub: user.id, role: user.role };
    this.logger.log('User authenticated', {
      userId: user.id,
      email: user.email,
      role: user.role,
    });
    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        contracts: (user.contracts || []).map((contract) => ({
          id: contract.id,
          name: contract.name,
        })),
      },
    };
  }
}
