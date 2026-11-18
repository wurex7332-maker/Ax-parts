import { Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationQueryDto } from './dto';

@Controller('api/v1/notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  findAll(@Query() query: NotificationQueryDto) {
    return this.service.findAll(query);
  }

  @Post(':id/read')
  markRead(@Param('id', ParseIntPipe) id: number) {
    return this.service.markRead(id);
  }
}
