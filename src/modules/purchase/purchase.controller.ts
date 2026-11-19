import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { Actor } from '../../common/actor.decorator';
import { CurrentUser } from '../../common/auth.decorators';
import type { AuthUser } from '../../common/jwt';
import { AuditService } from '../audit/audit.service';
import { PurchaseService } from './purchase.service';
import { CreateOrderDto, CreateRequestDto, RejectDto, RequestQueryDto } from './dto';

@Controller('api/v1/purchase')
export class PurchaseController {
  constructor(
    private readonly service: PurchaseService,
    private readonly audit: AuditService,
  ) {}

  @Post('requests')
  createRequest(@Body() dto: CreateRequestDto, @CurrentUser() user: AuthUser) {
    const request = this.service.createRequest(dto);
    this.audit.log(user, {
      action: 'PURCHASE_CREATE',
      resource: 'purchase_request',
      resourceId: request.requestNo,
      detail: { sku: request.sku, quantity: request.quantity, source: request.source },
    });
    return request;
  }

  @Get('requests')
  listRequests(@Query() query: RequestQueryDto) {
    return this.service.listRequests(query);
  }

  @Post('requests/:id/approve')
  approve(@Param('id', ParseIntPipe) id: number, @Actor() actor: string, @CurrentUser() user: AuthUser) {
    const request = this.service.approve(id, actor);
    this.audit.log(user, {
      action: 'PURCHASE_APPROVE',
      resource: 'purchase_request',
      resourceId: request.requestNo,
    });
    return request;
  }

  @Post('requests/:id/reject')
  reject(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RejectDto,
    @Actor() actor: string,
    @CurrentUser() user: AuthUser,
  ) {
    const request = this.service.reject(id, dto.reason, actor);
    this.audit.log(user, {
      action: 'PURCHASE_REJECT',
      resource: 'purchase_request',
      resourceId: request.requestNo,
      detail: { reason: dto.reason },
    });
    return request;
  }

  @Post('requests/:id/resubmit')
  resubmit(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    const request = this.service.resubmit(id);
    this.audit.log(user, {
      action: 'PURCHASE_RESUBMIT',
      resource: 'purchase_request',
      resourceId: request.requestNo,
    });
    return request;
  }

  @Post('requests/:id/close')
  close(@Param('id', ParseIntPipe) id: number) {
    return this.service.close(id);
  }

  @Post('orders')
  createOrder(@Body() dto: CreateOrderDto, @Actor() actor: string, @CurrentUser() user: AuthUser) {
    const order = this.service.createOrder(dto, actor);
    this.audit.log(user, {
      action: 'PURCHASE_ORDER_CREATE',
      resource: 'purchase_order',
      resourceId: order.orderNo,
      detail: { requestNo: order.requestNo, quantity: order.quantity },
    });
    return order;
  }

  @Get('orders')
  listOrders() {
    return this.service.listOrders();
  }

  @Post('orders/:id/arrive')
  arrive(@Param('id', ParseIntPipe) id: number, @Actor() actor: string, @CurrentUser() user: AuthUser) {
    const result = this.service.arrive(id, actor);
    this.audit.log(user, {
      action: 'PURCHASE_ARRIVE',
      resource: 'purchase_order',
      resourceId: result.order.orderNo,
      detail: { currentStock: result.currentStock },
    });
    return result;
  }
}
