import Database from 'better-sqlite3';

interface SeedMaterial {
  sku: string;
  name: string;
  category: string;
  unit: string;
  location: string;
  initial: number;
  safety: number;
  priceCents: number;
  supplier: string;
  specModel: string;
  brand: string;
}

const MATERIALS: SeedMaterial[] = [
  { sku: 'PRT-001', name: '激光打印机', category: '打印设备', unit: '台', location: 'A-01', initial: 3, safety: 2, priceCents: 189900, supplier: '办公设备供应商', specModel: 'LJ-100', brand: 'HP' },
  { sku: 'PC-002', name: '办公台式机', category: '计算机设备', unit: '台', location: 'A-02', initial: 1, safety: 2, priceCents: 459900, supplier: '电脑城', specModel: 'T5', brand: 'Lenovo' },
  { sku: 'HDD-003', name: '1TB 机械硬盘', category: '计算机配件', unit: '个', location: 'B-01', initial: 0, safety: 5, priceCents: 29900, supplier: '存储配件商', specModel: 'ST1000', brand: 'Seagate' },
  { sku: 'MON-004', name: '24 寸显示器', category: '计算机设备', unit: '台', location: 'A-03', initial: 8, safety: 3, priceCents: 89900, supplier: '办公设备供应商', specModel: 'E24', brand: 'Dell' },
  { sku: 'TNR-005', name: '硒鼓', category: '耗材', unit: '盒', location: 'C-01', initial: 12, safety: 10, priceCents: 19900, supplier: '耗材专营', specModel: '88A', brand: 'Canon' },
  { sku: 'NET-006', name: '千兆交换机', category: '网络设备', unit: '台', location: 'B-02', initial: 2, safety: 2, priceCents: 129000, supplier: '网络集成商', specModel: 'SG108', brand: 'TP-LINK' },
];

/** 幂等种子：仅在 materials 为空时导入，避免覆盖用户数据。 */
export function seedDatabase(db: Database.Database): boolean {
  const count = (db.prepare('SELECT COUNT(*) AS n FROM materials').get() as { n: number }).n;
  if (count > 0) return false;

  const now = new Date().toISOString();
  const insertMaterial = db.prepare(`
    INSERT INTO materials (sku, name, category, spec_model, brand, unit, location,
      price_cents, safety_stock, supplier, image_url, status, created_at, updated_at)
    VALUES (@sku, @name, @category, @specModel, @brand, @unit, @location,
      @priceCents, @safety, @supplier, '', 'ENABLED', @now, @now)
  `);
  const insertMovement = db.prepare(`
    INSERT INTO stock_movements (movement_no, sku, location, type, quantity_signed,
      source, recipient, purpose, batch, operator, occurred_at, related_doc_no,
      related_movement_no, idempotency_key, created_at)
    VALUES (@movementNo, @sku, @location, 'IN_PURCHASE', @quantity,
      'INITIAL', '', '期初库存', '', 'system', @now, '', '', NULL, @now)
  `);
  const insertRequest = db.prepare(`
    INSERT INTO purchase_requests (request_no, sku, quantity, expected_date, reason,
      status, applicant, source, reject_reason, version, created_at, updated_at)
    VALUES (@requestNo, @sku, 20, '2026-12-31', '断料预警，需采购补货',
      'PURCHASING', 'system', 'ALERT', '', 2, @now, @now)
  `);
  const insertOrder = db.prepare(`
    INSERT INTO purchase_orders (order_no, request_no, sku, quantity, status,
      created_by, created_at, closed_at)
    VALUES ('PO-SEED-0001', @requestNo, @sku, 20, 'OPEN', 'purchaser', @now, '')
  `);
  const insertNotification = db.prepare(`
    INSERT INTO notifications (recipient, type, title, content, related_doc_no, is_read, created_at)
    VALUES (@recipient, @type, @title, @content, @relatedDocNo, 0, @now)
  `);

  db.transaction(() => {
    MATERIALS.forEach((m, index) => {
      insertMaterial.run({ ...m, now });
      // 期初库存以期初入库流水写入；库存为 0 的 SKU 不写 0 数量流水。
      if (m.initial > 0) {
        insertMovement.run({
          movementNo: `MOV-SEED-${String(index + 1).padStart(4, '0')}`,
          sku: m.sku,
          location: m.location,
          quantity: m.initial,
          now,
        });
      }
    });

    // 为 HDD-003 预置采购中申请 + OPEN 订单，支撑到货闭环（不改变库存分桶）。
    insertRequest.run({ requestNo: 'PR-SEED-0001', sku: 'HDD-003', now });
    insertOrder.run({ requestNo: 'PR-SEED-0001', sku: 'HDD-003', now });

    insertNotification.run({
      recipient: 'warehouse',
      type: 'STOCKOUT',
      title: '断料强提醒：HDD-003',
      content: 'HDD-003 当前库存 0，已低于安全库存 5，请及时处理。',
      relatedDocNo: 'PR-SEED-0001',
      now,
    });
    insertNotification.run({
      recipient: 'warehouse',
      type: 'ALERT',
      title: '低库存预警：PC-002',
      content: 'PC-002 当前库存 1，安全库存 2。',
      relatedDocNo: '',
      now,
    });
    insertNotification.run({
      recipient: 'warehouse',
      type: 'ALERT',
      title: '低库存预警：NET-006',
      content: 'NET-006 当前库存 2，安全库存 2。',
      relatedDocNo: '',
      now,
    });
  })();

  return true;
}
