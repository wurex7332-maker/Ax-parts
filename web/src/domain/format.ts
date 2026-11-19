/** 金额一律以整数分传输；显示时才换算为元（PRD §6.2）。 */

export function centsToYuan(cents: number): string {
  if (!Number.isFinite(cents)) return '—';
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(Math.round(cents));
  const yuan = Math.floor(abs / 100);
  const fen = abs % 100;
  return `${sign}${yuan}.${String(fen).padStart(2, '0')}`;
}

export function centsToYuanLabel(cents: number): string {
  return `¥${centsToYuan(cents)}`;
}

/** 输入框的元字符串 → 整数分；非法返回 null */
export function yuanToCents(input: string): number | null {
  const text = input.trim();
  if (!text) return null;
  if (!/^\d+(\.\d{0,2})?$/.test(text)) return null;
  const [yuan, fen = ''] = text.split('.');
  const cents = Number(yuan) * 100 + Number(fen.padEnd(2, '0'));
  return Number.isFinite(cents) ? cents : null;
}

export function formatDateTime(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function formatDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 期望到货日期默认值：today + 7 天（PRD 假设 A6） */
export function defaultExpectedDate(from = new Date()): string {
  const d = new Date(from.getTime());
  d.setDate(d.getDate() + 7);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function todayIso(from = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${from.getFullYear()}-${p(from.getMonth() + 1)}-${p(from.getDate())}`;
}

export function formatSignedQty(qty: number): string {
  return qty > 0 ? `+${qty}` : String(qty);
}
