import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InspectionNotice } from '../entities';
import { InspectionNoticesService } from './inspection-notices.service';

@Controller('inspection-notices')
@UseGuards(JwtAuthGuard)
export class InspectionNoticesController {
  constructor(
    private readonly inspectionNoticesService: InspectionNoticesService,
  ) {}

  @Get()
  listUnread(@CurrentUser() user: { id: string }): Promise<InspectionNotice[]> {
    return this.inspectionNoticesService.listUnread(user.id);
  }

  @Get('stream')
  async stream(
    @CurrentUser() user: { id: string },
    @Res() res: Response,
  ): Promise<void> {
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    res.write(': heartbeat\n\n');

    const request = res.req;
    request.setTimeout(0);
    res.setTimeout(0);

    const subscription = this.inspectionNoticesService
      .watch(user.id)
      .subscribe((notice) => {
        res.write(`event: notice\ndata: ${JSON.stringify(notice)}\n\n`);
      });

    const heartbeat = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 15000);

    await new Promise<void>((resolve) => {
      const close = () => {
        clearInterval(heartbeat);
        subscription.unsubscribe();
        resolve();
      };
      res.on('close', close);
      res.on('error', close);
    });
  }

  @Post(':id/read')
  markRead(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user: { id: string },
  ): Promise<InspectionNotice> {
    return this.inspectionNoticesService.markRead(id, user.id);
  }
}
