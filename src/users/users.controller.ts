import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../common/enums';
import { CreateUserDto, FilterUsersDto, UpdateUserDto } from './dto';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('fiscals')
  @Roles(UserRole.ADMIN, UserRole.GESTOR, UserRole.SUPERVISOR)
  findFiscals(@CurrentUser() user: any, @Query() filters: FilterUsersDto) {
    return this.usersService.findFiscals(user, filters.contractId);
  }

  @Get()
  findAll(@Query() filters: FilterUsersDto) {
    return this.usersService.findAll(
      filters.page || 1,
      filters.limit || 10,
      filters.contractId,
    );
  }

  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(id, updateUserDto);
  }

  @Put(':id/contracts')
  updateContracts(
    @Param('id') id: string,
    @Body() body: { contractIds: string[] },
  ) {
    return this.usersService.updateContracts(id, body.contractIds || []);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
