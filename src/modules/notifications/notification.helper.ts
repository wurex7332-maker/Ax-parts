import Database from 'better-sqlite3';
import { HealthLevel } from '../../domain/health';

export interface CreateNotificationInput {
  recipient: string;
  type: 'ALERT' | 'STOCKOUT' | 'APPROVED' | 'REJECTED' | 'ARRIVED';
  title: string;
  content: string;
  relatedDocNo?: string;
}

/** 站内消息产生：由服务层在业务事务内调用。 */
export function createNotification(db: Database.Database, input: CreateNotificationInput) {
  const now = new Date().toISOString();
  const result = db
    .prepare(`
      INSERT INTO notifications (recipient, type, title, content, related_doc_no, is_read, created_at)
      VALUES (@recipient, @type, @title, @content, @relatedDocNo, 0, @now)
    `)
    .run({ ...input, relatedDocNo: input.relatedDocNo ?? '', now });
  return db.prepare('SELECT * FROM notifications WHERE id = ?').get(result.lastInsertRowid);
}

/**
 * 健康分桶恶化时写站内消息：按状态跃迁触发，读取预警列表不重复产生消息。
 */
export function notifyHealthChange(
  db: Database.Database,
  sku: string,
  before: HealthLevel,
  after: HealthLevel,
  relatedDocNo = '',
) {
  if (after === 'NORMAL' || after === before) return null;
  const isStockout = after === 'STOCKOUT';
  return createNotification(db, {
    recipient: 'warehouse',
    type: isStockout ? 'STOCKOUT' : 'ALERT',
    title: `${isStockout ? '断料强提醒' : '低库存预警'}：${sku}`,
    content: `${sku} 健康状态由 ${before} 变为 ${after}，请及时补货。`,
    relatedDocNo,
  });
}
