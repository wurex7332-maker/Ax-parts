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
import { PurchaseService } from './purchase.service';
import {
  CreateOrderDto,
  CreateRequestDto,
  RejectDto,
  RequestQueryDto,
} from './dto';

@Controller('api/v1/purchase')
export class PurchaseController {
  constructor(private readonly service: PurchaseService) {}

  @Post('requests')
  createRequest(@Body() dto: CreateRequestDto) {
    return this.service.createRequest(dto);
  }

  @Get('requests')
  listRequests(@Query() query: RequestQueryDto) {
    return this.service.listRequests(query);
  }

  @Post('requests/:id/approve')
  approve(@Param('id', ParseIntPipe) id: number, @Actor() actor: string) {
    return this.service.approve(id, actor);
  }

  @Post('requests/:id/reject')
  reject(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RejectDto,
    @Actor() actor: string,
  ) {
    return this.service.reject(id, dto.reason, actor);
  }

  @Post('requests/:id/resubmit')
  resubmit(@Param('id', ParseIntPipe) id: number) {
    return this.service.resubmit(id);
  }

  @Post('requests/:id/close')
  close(@Param('id', ParseIntPipe) id: number) {
    return this.service.close(id);
  }

  @Post('orders')
  createOrder(@Body() dto: CreateOrderDto, @Actor() actor: string) {
    return this.service.createOrder(dto, actor);
  }

  @Get('orders')
  listOrders() {
    return this.service.listOrders();
  }

  @Post('orders/:id/arrive')
  arrive(@Param('id', ParseIntPipe) id: number, @Actor() actor: string) {
    return this.service.arrive(id, actor);
  }
}
