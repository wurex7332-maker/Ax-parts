import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../infra/database.module';
import { classify } from '../../domain/health';
import { sumSigned } from '../../domain/stock-math';

@Injectable()
export class DashboardService {
  constructor(private readonly dbService: DatabaseService) {}

  private get db() {
    return this.dbService.db;
  }

  /** 实时统计：每次读取都由流水和申请状态现算，无缓存。 */
  getDashboard() {
    const materials = this.db
      .prepare('SELECT sku, safety_stock FROM materials')
      .all() as Array<{ sku: string; safety_stock: number }>;
    const rows = this.db
      .prepare('SELECT sku, quantity_signed FROM stock_movements')
      .all() as Array<{ sku: string; quantity_signed: number }>;

    const counts = { normal: 0, low: 0, stockout: 0 };
    materials.forEach((material) => {
      const current = sumSigned(
        rows.filter((row) => row.sku === material.sku),
      );
      const level = classify(current, material.safety_stock);
      if (level === 'NORMAL') counts.normal += 1;
      else if (level === 'LOW') counts.low += 1;
      else counts.stockout += 1;
    });

    const pending = this.db
      .prepare(
        "SELECT COUNT(*) AS n FROM purchase_requests WHERE status IN ('PENDING','APPROVED','PURCHASING')",
      )
      .get() as { n: number };

    const total = materials.length;
    const distribution = (count: number) => ({
      count,
      percentage: total ? Number((count / total).toFixed(4)) : 0,
    });

    return {
      skuTotal: total,
      alertCount: counts.low,
      stockoutCount: counts.stockout,
      pendingPurchaseCount: pending.n,
      healthDistribution: {
        normal: distribution(counts.normal),
        low: distribution(counts.low),
        stockout: distribution(counts.stockout),
      },
    };
  }
}
