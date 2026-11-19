import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { DictionariesService } from './dictionaries.service';
import { CreateDictionaryDto, DictionaryQueryDto, UpdateDictionaryDto } from './dto';
import { CurrentUser, Roles } from '../../common/auth.decorators';
import type { AuthUser } from '../../common/jwt';
import { AuditService } from '../audit/audit.service';

@Controller('api/v1/dictionaries')
export class DictionariesController {
  constructor(
    private readonly service: DictionariesService,
    private readonly audit: AuditService,
  ) {}

  /** 所有登录用户可读（前端下拉需要用）。 */
  @Get()
  list(@Query() query: DictionaryQueryDto) {
    return this.service.list(query);
  }

  @Post()
  @Roles('supervisor')
  create(@Body() dto: CreateDictionaryDto, @CurrentUser() actor: AuthUser) {
    const item = this.service.create(dto);
    this.audit.log(actor, {
      action: 'DICTIONARY_CREATE',
      resource: 'dictionary',
      resourceId: item.id,
      detail: { type: item.type, value: item.value },
    });
    return item;
  }

  @Patch(':id')
  @Roles('supervisor')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDictionaryDto,
    @CurrentUser() actor: AuthUser,
  ) {
    const item = this.service.update(id, dto);
    this.audit.log(actor, {
      action: 'DICTIONARY_UPDATE',
      resource: 'dictionary',
      resourceId: item.id,
      detail: { type: item.type, value: item.value, enabled: item.enabled },
    });
    return item;
  }
}
