import {
  Controller,
  Get,
  Param,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('types')
  findTypes() {
    return this.reportsService.findActiveTypes();
  }

  @Get('types/:code/fields')
  findTypeFields(@Param('code') code: string) {
    return this.reportsService.findTypeFields(code);
  }
}
