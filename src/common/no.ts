import { randomBytes } from 'node:crypto';

/** 生成可读单据号；测试项目不要求严格递增。 */
export function generateNo(prefix: string): string {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${randomBytes(2)
    .toString('hex')
    .toUpperCase()}`;
}
