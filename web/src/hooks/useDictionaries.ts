import { api } from '../api';
import type { DictionaryItem, DictionaryType } from '../domain/types';
import { useQuery } from '../state/useQuery';

/** 从后端数据字典读取类别/单位，替代写死的枚举。 */
export function useDictionaries(type: DictionaryType): DictionaryItem[] {
  const { data } = useQuery(
    `dictionaries:${type}`,
    () => api.dictionaries.list({ type, pageSize: 200 }),
    { tags: ['dictionaries'] },
  );
  return data?.items ?? [];
}
