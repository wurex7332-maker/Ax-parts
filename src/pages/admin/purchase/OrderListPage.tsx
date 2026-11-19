import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../../api';
import { displayMessageOf } from '../../../api/errors';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/Dialog';
import { Badge, EmptyState, ErrorState, Skeleton } from '../../../components/ui/Feedback';
import { TableWrap } from '../../../components/ui/Table';
import { formatDateTime } from '../../../domain/format';
import type { PurchaseOrder } from '../../../domain/types';
import { useDocumentTitle } from '../../../hooks/useA11y';
import { PATHS } from '../../../routes/paths';
import { useMutation } from '../../../state/useMutation';
import { useQuery } from '../../../state/useQuery';
import { announce } from '../../../components/a11y/Announcer';
import { toastSuccess } from '../../../state/toast';

export function OrderListPage() {
  useDocumentTitle('采购订单');
  const [pendingArrive, setPendingArrive] = useState<PurchaseOrder | null>(null);

  const { data, error, isLoading, refetch } = useQuery('orders', () => api.purchase.listOrders(), {
    tags: ['purchase.orders'],
  });

  const arrive = useMutation('purchase.arrive', (id: number) => api.purchase.arrive(id), {
    onSuccess: (result) => {
      toastSuccess(`到货入库完成：${result.order.orderNo}，当前库存 ${result.currentStock}`);
      announce(
        `订单 ${result.order.orderNo} 到货入库完成，当前库存 ${result.currentStock}，申请状态 ${result.request.statusLabel}`,
      );
    },
  });

  const onArrive = async () => {
    if (!pendingArrive) return;
    const outcome = await arrive.run(pendingArrive.id);
    if (outcome.ok) setPendingArrive(null);
  };

  return (
    <>
      <PageHeader
        title="采购订单"
        description="一个申请最多对应一张订单。执行到货会在同一事务内完成入库、关单与申请完成，因此「已到货」不单独驻留。"
        breadcrumb={
          <Link to={PATHS.requests} className="underline decoration-dotted">
            采购申请
          </Link>
        }
      />

      {error ? <ErrorState error={error} onRetry={refetch} /> : null}
      {isLoading && !data ? <Skeleton rows={4} /> : null}

      {data ? (
        data.items.length === 0 ? (
          <EmptyState title="暂无采购订单" description="请在「采购申请」中对已审批的申请生成订单。" />
        ) : (
          <TableWrap caption={`共 ${data.total} 张订单（后端不支持分页，一次性返回）`}>
            <thead>
              <tr>
                <th scope="col">订单号</th>
                <th scope="col">关联申请</th>
                <th scope="col">SKU</th>
                <th scope="col">数量</th>
                <th scope="col">状态</th>
                <th scope="col">创建人</th>
                <th scope="col">创建时间</th>
                <th scope="col">关单时间</th>
                <th scope="col">操作</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((order) => (
                <tr key={order.id}>
                  <th scope="row" className="font-mono text-xs font-normal text-ink-700">
                    {order.orderNo}
                  </th>
                  <td className="font-mono text-xs">{order.requestNo}</td>
                  <td className="font-mono text-xs">{order.sku}</td>
                  <td className="tabular-nums">{order.quantity}</td>
                  <td>
                    <Badge tone={order.status === 'OPEN' ? 'brand' : 'normal'}>
                      {order.status === 'OPEN' ? '未到货' : '已关单'}
                    </Badge>
                  </td>
                  <td className="text-xs">{order.createdBy}</td>
                  <td className="text-xs text-ink-500">{formatDateTime(order.createdAt)}</td>
                  <td className="text-xs text-ink-500">
                    {order.closedAt ? formatDateTime(order.closedAt) : '—'}
                  </td>
                  <td>
                    {order.status === 'OPEN' ? (
                      <Button size="sm" variant="primary" onClick={() => setPendingArrive(order)}>
                        到货入库
                      </Button>
                    ) : (
                      <span className="text-xs text-ink-400">已完成</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )
      ) : null}

      {arrive.error ? (
        <p role="alert" className="mt-2 text-xs text-stockout-fg">
          {displayMessageOf(arrive.error)}
        </p>
      ) : null}

      <ConfirmDialog
        open={pendingArrive !== null}
        title="确认到货入库"
        description={
          pendingArrive
            ? `订单 ${pendingArrive.orderNo}：将入库 ${pendingArrive.quantity}，库存增加，订单关单，申请转「已完成」。`
            : ''
        }
        confirmText="确认到货"
        pending={arrive.pending}
        onConfirm={onArrive}
        onCancel={() => setPendingArrive(null)}
      />
    </>
  );
}
