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
import { CurrentUser } from '../../common/auth.decorators';
import type { AuthUser } from '../../common/jwt';
import { AuditService } from '../audit/audit.service';
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
  constructor(
    private readonly service: StockService,
    private readonly audit: AuditService,
  ) {}

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
  inbound(@Body() dto: InboundDto, @Actor() actor: string, @CurrentUser() user: AuthUser) {
    const result = this.service.inbound(dto, actor);
    this.audit.log(user, {
      action: 'STOCK_INBOUND',
      resource: 'stock',
      resourceId: dto.sku,
      detail: { quantity: dto.quantity, source: dto.source },
    });
    return result;
  }

  @Post('outbound')
  outbound(
    @Body() dto: OutboundDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Actor() actor: string,
    @CurrentUser() user: AuthUser,
  ) {
    const result = this.service.outbound(dto, idempotencyKey, actor);
    this.audit.log(user, {
      action: 'STOCK_OUTBOUND',
      resource: 'stock',
      resourceId: dto.sku,
      detail: { quantity: dto.quantity, recipient: dto.recipient },
    });
    return result;
  }

  @Post('count')
  count(@Body() dto: CountDto, @Actor() actor: string, @CurrentUser() user: AuthUser) {
    const result = this.service.count(dto, actor);
    this.audit.log(user, {
      action: 'STOCK_COUNT',
      resource: 'stock',
      resourceId: dto.sku,
      detail: { location: dto.location, actualQty: dto.actualQty, difference: result.difference },
    });
    return result;
  }

  @Post('adjust')
  adjust(@Body() dto: AdjustDto, @Actor() actor: string, @CurrentUser() user: AuthUser) {
    const result = this.service.adjust(dto, actor);
    this.audit.log(user, {
      action: 'STOCK_ADJUST',
      resource: 'stock',
      resourceId: dto.sku,
      detail: { type: dto.type, quantity: dto.quantity },
    });
    return result;
  }
}
