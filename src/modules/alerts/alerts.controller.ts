import { Controller, Get, Post, Query } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { AlertQueryDto } from './dto';

@Controller('api/v1/alerts')
export class AlertsController {
  constructor(private readonly service: AlertsService) {}

  @Get()
  getAlerts(@Query() query: AlertQueryDto) {
    return this.service.getAlerts(query);
  }

  @Post('generate-suggestions')
  generateSuggestions() {
    return this.service.generateSuggestions();
  }
}
