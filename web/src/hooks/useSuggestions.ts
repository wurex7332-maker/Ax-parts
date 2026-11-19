import { api } from '../api';
import { useQuery } from '../state/useQuery';

/**
 * 库位候选：合并物料档案与库存台账里出现过的库位。
 * 取前 200 条（后端分页上限），练习项目规模足够；数据量大时应改由后端提供去重接口。
 */
export function useLocationOptions(): string[] {
  const { data } = useQuery(
    'suggest:locations',
    async () => {
      const [materials, stock] = await Promise.all([
        api.materials.list({ pageSize: 200 }),
        api.stock.list({ pageSize: 200 }),
      ]);
      const set = new Set<string>();
      for (const item of materials.items) {
        const value = item.location?.trim();
        if (value) set.add(value);
      }
      for (const row of stock.items) {
        const value = row.location?.trim();
        if (value) set.add(value);
      }
      return Array.from(set).sort((a, b) => a.localeCompare(b));
    },
    { tags: ['materials', 'stock'] },
  );
  return data ?? [];
}

/** 供应商候选：取自物料档案里已填过的供应商。 */
export function useSupplierOptions(): string[] {
  const { data } = useQuery(
    'suggest:suppliers',
    async () => {
      const page = await api.materials.list({ pageSize: 200 });
      const set = new Set<string>();
      for (const item of page.items) {
        const value = item.supplier?.trim();
        if (value) set.add(value);
      }
      return Array.from(set).sort((a, b) => a.localeCompare(b));
    },
    { tags: ['materials'] },
  );
  return data ?? [];
}

/** 品牌候选：同理，取自已有档案。 */
export function useBrandOptions(): string[] {
  const { data } = useQuery(
    'suggest:brands',
    async () => {
      const page = await api.materials.list({ pageSize: 200 });
      const set = new Set<string>();
      for (const item of page.items) {
        const value = item.brand?.trim();
        if (value) set.add(value);
      }
      return Array.from(set).sort((a, b) => a.localeCompare(b));
    },
    { tags: ['materials'] },
  );
  return data ?? [];
}
