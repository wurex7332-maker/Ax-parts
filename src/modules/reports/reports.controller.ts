import { Controller, Get, Query } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { AlertQueryDto } from '../alerts/dto';
import { MovementQueryDto } from '../stock/dto';
import { ConsumptionRankQueryDto } from './dto';

@Controller('api/v1/reports')
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Get('movements')
  movements(@Query() query: MovementQueryDto) {
    return this.service.movements(query);
  }

  @Get('consumption-rank')
  consumptionRank(@Query() query: ConsumptionRankQueryDto) {
    return this.service.consumptionRank(query);
  }

  @Get('alerts')
  alerts(@Query() query: AlertQueryDto) {
    return this.service.alerts(query);
  }

  @Get('purchase')
  purchase() {
    return this.service.purchase();
  }
}
