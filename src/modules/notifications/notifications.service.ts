import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../infra/database.module';
import { Errors } from '../../common/errors';
import { paginate, Paged } from '../../common/pagination';
import { NotificationQueryDto } from './dto';

type NotificationRow = {
  id: number;
  recipient: string;
  type: string;
  title: string;
  content: string;
  related_doc_no: string;
  is_read: number;
  created_at: string;
};

function view(row: NotificationRow) {
  return {
    id: row.id,
    recipient: row.recipient,
    type: row.type,
    title: row.title,
    content: row.content,
    relatedDocNo: row.related_doc_no,
    isRead: Boolean(row.is_read),
    createdAt: row.created_at,
  };
}

@Injectable()
export class NotificationsService {
  constructor(private readonly dbService: DatabaseService) {}

  private get db() {
    return this.dbService.db;
  }

  findAll(query: NotificationQueryDto): Paged<ReturnType<typeof view>> {
    const clauses: string[] = [];
    const params: Record<string, unknown> = {};
    if (query.recipient) {
      clauses.push('recipient = @recipient');
      params.recipient = query.recipient;
    }
    if (query.isRead !== undefined) {
      clauses.push('is_read = @isRead');
      params.isRead = ['1', 'true'].includes(query.isRead) ? 1 : 0;
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = this.db
      .prepare(`SELECT * FROM notifications ${where} ORDER BY id DESC`)
      .all(params) as NotificationRow[];
    return paginate(rows.map(view), query.page, query.pageSize);
  }

  markRead(id: number) {
    const row = this.db.prepare('SELECT * FROM notifications WHERE id = ?').get(id) as
      | NotificationRow
      | undefined;
    if (!row) throw Errors.notificationNotFound(id);
    if (!row.is_read) {
      this.db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(id);
    }
    return this.findOne(id);
  }

  private findOne(id: number) {
    const row = this.db.prepare('SELECT * FROM notifications WHERE id = ?').get(id) as NotificationRow;
    return view(row);
  }
}
