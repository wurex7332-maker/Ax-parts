import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../infra/database.module';
import { paginate } from '../../common/pagination';
import { AlertsService } from '../alerts/alerts.service';
import { StockService } from '../stock/stock.service';
import { AlertQueryDto } from '../alerts/dto';
import { MovementQueryDto } from '../stock/dto';
import { ConsumptionRankQueryDto } from './dto';
import { PURCHASE_STATUS_LABEL } from '../../domain/purchase-machine';

@Injectable()
export class ReportsService {
  constructor(
    private readonly dbService: DatabaseService,
    private readonly stock: StockService,
    private readonly alertsService: AlertsService,
  ) {}

  private get db() {
    return this.dbService.db;
  }

  movements(query: MovementQueryDto) {
    return this.stock.getMovements(query);
  }

  consumptionRank(query: ConsumptionRankQueryDto) {
    const clauses = ["type = 'OUT_ISSUE'"];
    const params: Record<string, unknown> = {};
    if (query.from) {
      clauses.push('occurred_at >= @from');
      params.from = query.from;
    }
    if (query.to) {
      clauses.push('occurred_at <= @to');
      params.to = query.to;
    }
    const rows = this.db
      .prepare(`
        SELECT mv.sku, m.name, m.unit, SUM(-mv.quantity_signed) AS consumedQty,
               COUNT(*) AS issueCount
        FROM stock_movements mv
        LEFT JOIN materials m ON m.sku = mv.sku
        WHERE ${clauses.join(' AND ')}
        GROUP BY mv.sku
        ORDER BY consumedQty DESC, mv.sku ASC
      `)
      .all(params) as Array<{
      sku: string;
      name: string;
      unit: string;
      consumedQty: number;
      issueCount: number;
    }>;
    return paginate(rows, query.page, query.pageSize);
  }

  alerts(query: AlertQueryDto) {
    return this.alertsService.getAlerts(query);
  }

  purchase() {
    const rows = this.db
      .prepare('SELECT status, COUNT(*) AS n FROM purchase_requests GROUP BY status')
      .all() as Array<{ status: keyof typeof PURCHASE_STATUS_LABEL; n: number }>;
    const statusCounts: Record<string, { count: number; label: string }> = {};
    Object.entries(PURCHASE_STATUS_LABEL).forEach(([status, label]) => {
      statusCounts[status] = { count: 0, label };
    });
    rows.forEach((row) => {
      statusCounts[row.status] = { count: row.n, label: PURCHASE_STATUS_LABEL[row.status] };
    });

    const requested = this.db
      .prepare('SELECT COALESCE(SUM(quantity), 0) AS n FROM purchase_requests')
      .get() as { n: number };
    const ordered = this.db
      .prepare('SELECT COALESCE(SUM(quantity), 0) AS n FROM purchase_orders')
      .get() as { n: number };
    const arrived = this.db
      .prepare(`
        SELECT COALESCE(SUM(quantity), 0) AS n FROM purchase_orders WHERE status = 'CLOSED'
      `)
      .get() as { n: number };
    const openOrders = this.db
      .prepare("SELECT COUNT(*) AS n FROM purchase_orders WHERE status = 'OPEN'")
      .get() as { n: number };

    return {
      statusCounts,
      totalRequestedQty: requested.n,
      totalOrderedQty: ordered.n,
      arrivedQty: arrived.n,
      openOrders: openOrders.n,
    };
  }
}
