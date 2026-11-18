import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../infra/database.module';
import { paginate, Paged } from '../../common/pagination';
import { classify, HEALTH_LABEL, HealthLevel } from '../../domain/health';
import { isSuggestionCandidate, suggestedQuantity } from '../../domain/suggestion';
import { sumSigned } from '../../domain/stock-math';
import { AlertQueryDto } from './dto';

type AlertMaterialRow = {
  sku: string;
  name: string;
  category: string;
  unit: string;
  location: string;
  safety_stock: number;
  status: string;
};

export interface AlertView {
  sku: string;
  name: string;
  category: string;
  unit: string;
  location: string;
  currentStock: number;
  lockedStock: number;
  availableStock: number;
  safetyStock: number;
  level: HealthLevel;
  levelLabel: string;
  suggestedQty: number;
}

@Injectable()
export class AlertsService {
  constructor(private readonly dbService: DatabaseService) {}

  private get db() {
    return this.dbService.db;
  }

  /** 实时计算全部启用 SKU 的预警/断料，不缓存、不因读取产生消息。 */
  compute(): AlertView[] {
    const materials = this.db
      .prepare("SELECT sku, name, category, unit, location, safety_stock, status FROM materials WHERE status = 'ENABLED'")
      .all() as AlertMaterialRow[];
    return materials
      .map((material) => {
        const rows = this.db
          .prepare('SELECT quantity_signed FROM stock_movements WHERE sku = ?')
          .all(material.sku) as Array<{ quantity_signed: number }>;
        const current = sumSigned(rows);
        const lock = this.db
          .prepare('SELECT COALESCE(SUM(quantity), 0) AS n FROM stock_locks WHERE sku = ?')
          .get(material.sku) as { n: number };
        const level = classify(current, material.safety_stock);
        return {
          sku: material.sku,
          name: material.name,
          category: material.category,
          unit: material.unit,
          location: material.location,
          currentStock: current,
          lockedStock: lock.n,
          availableStock: current - lock.n,
          safetyStock: material.safety_stock,
          level,
          levelLabel: HEALTH_LABEL[level],
          suggestedQty: suggestedQuantity(current, material.safety_stock),
        };
      })
      .sort((a, b) => {
        const priority = { STOCKOUT: 0, LOW: 1, NORMAL: 2 };
        return priority[a.level] - priority[b.level] || a.sku.localeCompare(b.sku);
      });
  }

  getAlerts(query: AlertQueryDto): Paged<AlertView> {
    const items = this.compute().filter(
      (item) =>
        (item.level === 'LOW' || item.level === 'STOCKOUT') &&
        (!query.sku || item.sku === query.sku) &&
        (!query.level || item.level === query.level),
    );
    return paginate(items, query.page, query.pageSize);
  }

  /** 一键生成采购建议草稿：不落库、不改库存，提交前可修改数量。 */
  generateSuggestions() {
    const items = this.compute()
      .filter((item) => isSuggestionCandidate(item.level, true))
      .map((item) => ({
        sku: item.sku,
        name: item.name,
        currentStock: item.currentStock,
        safetyStock: item.safetyStock,
        level: item.level,
        suggestedQty: suggestedQuantity(item.currentStock, item.safetyStock),
      }));
    return { items, total: items.length };
  }
}
