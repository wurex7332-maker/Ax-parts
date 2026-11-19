import { Controller, Get, Query } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditQueryDto } from './dto';
import { Roles } from '../../common/auth.decorators';

/** 审计日志仅车间主管可见（未单独设管理员角色，见 PRD 变更说明）。 */
@Controller('api/v1/audit-logs')
@Roles('supervisor')
export class AuditController {
  constructor(private readonly service: AuditService) {}

  @Get()
  list(@Query() query: AuditQueryDto) {
    return this.service.list(query);
  }
}
