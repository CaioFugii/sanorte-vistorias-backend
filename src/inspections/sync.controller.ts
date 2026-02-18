import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { InspectionsService } from './inspections.service';
import { SyncInspectionsRequestDto } from './dto/sync-inspections.dto';

@Controller('sync')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SyncController {
  constructor(private readonly inspectionsService: InspectionsService) {}

  @Post('inspections')
  @Roles(UserRole.FISCAL, UserRole.GESTOR, UserRole.ADMIN)
  syncInspections(
    @Body() body: SyncInspectionsRequestDto,
    @CurrentUser() user: { id: string; role: UserRole },
  ) {
    return this.inspectionsService.syncInspections(body?.inspections || [], user.id, user.role);
  }
}
