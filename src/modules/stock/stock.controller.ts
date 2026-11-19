import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { Actor } from '../../common/actor.decorator';
import { StockService } from './stock.service';
import {
  AdjustDto,
  CountDto,
  InboundDto,
  MovementQueryDto,
  OutboundDto,
  StockQueryDto,
} from './dto';

@Controller('api/v1/stock')
export class StockController {
  constructor(private readonly service: StockService) {}

  @Get()
  getStock(@Query() query: StockQueryDto) {
    return this.service.getStock(query);
  }

  @Get('movements')
  getMovements(@Query() query: MovementQueryDto) {
    return this.service.getMovements(query);
  }

  @Post('movements/:id/reverse')
  reverse(@Param('id', ParseIntPipe) id: number, @Actor() actor: string) {
    return this.service.reverse(id, actor);
  }

  @Post('inbound')
  inbound(@Body() dto: InboundDto, @Actor() actor: string) {
    return this.service.inbound(dto, actor);
  }

  @Post('outbound')
  outbound(
    @Body() dto: OutboundDto,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Actor() actor = 'system',
  ) {
    return this.service.outbound(dto, idempotencyKey, actor);
  }

  @Post('count')
  count(@Body() dto: CountDto, @Actor() actor: string) {
    return this.service.count(dto, actor);
  }

  @Post('adjust')
  adjust(@Body() dto: AdjustDto, @Actor() actor: string) {
    return this.service.adjust(dto, actor);
  }
}
