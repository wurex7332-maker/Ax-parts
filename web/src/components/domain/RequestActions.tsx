import { useState, type ReactElement } from 'react';
import { api } from '../../api';
import { displayMessageOf, errorCodeOf } from '../../api/errors';
import { announce } from '../a11y/Announcer';
import { Button } from '../ui/Button';
import { ConfirmDialog, Modal } from '../ui/Dialog';
import { Textarea } from '../ui/Field';
import { Badge } from '../ui/Feedback';
import { canDo, isRejected } from '../../domain/purchase';
import type { PurchaseRequest } from '../../domain/types';
import { useSession } from '../../state/session';
import { useMutation } from '../../state/useMutation';
import { toastSuccess } from '../../state/toast';

export interface RequestActionsProps {
  request: PurchaseRequest;
  layout?: 'desktop' | 'mobile';
}

/**
 * 采购申请动作区：按 status + role 显隐，与后端状态机一致。
 * 到货入库以订单为主体，入口在「采购订单」页，不在此处。
 */
export function RequestActions({ request, layout = 'desktop' }: RequestActionsProps) {
  const role = useSession((state) => state.user?.role ?? null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');

  const approve = useMutation('purchase.approve', () => api.purchase.approve(request.id), {
    onSuccess: (data) => {
      toastSuccess(`${data.requestNo} 已通过审批`);
      announce(`采购申请 ${data.requestNo} 已通过审批`);
    },
  });

  const reject = useMutation('purchase.reject', (text: string) => api.purchase.reject(request.id, { reason: text }), {
    onSuccess: (data) => {
      toastSuccess(`${data.requestNo} 已驳回，退回待审批`);
      announce(`采购申请 ${data.requestNo} 已驳回，原因：${data.rejectReason}，状态退回待审批`);
    },
  });

  const resubmit = useMutation('purchase.resubmit', () => api.purchase.resubmit(request.id), {
    onSuccess: () => toastSuccess('已重新提交，等待审批'),
  });

  const createOrder = useMutation('purchase.createOrder', () => api.purchase.createOrder({ requestId: request.id }), {
    onSuccess: (order) => toastSuccess(`已生成采购订单 ${order.orderNo}`),
  });

  const fullWidth = layout === 'mobile' ? 'w-full' : '';
  const actions: ReactElement[] = [];

  if (canDo(request.status, 'APPROVE') && role === 'supervisor') {
    actions.push(
      <Button key="approve" variant="primary" className={fullWidth} onClick={() => setApproveOpen(true)}>
        通过
      </Button>,
    );
    actions.push(
      <Button key="reject" variant="danger" className={fullWidth} onClick={() => setRejectOpen(true)}>
        驳回
      </Button>,
    );
  }

  if (canDo(request.status, 'RESUBMIT') && role === 'buyer' && isRejected(request)) {
    actions.push(
      <Button key="resubmit" className={fullWidth} disabled={resubmit.pending} onClick={() => resubmit.run()}>
        重新提交
      </Button>,
    );
  }

  if (canDo(request.status, 'CREATE_ORDER') && (role === 'buyer' || role === 'warehouse')) {
    actions.push(
      <Button
        key="order"
        variant="primary"
        className={fullWidth}
        disabled={createOrder.pending}
        onClick={() => createOrder.run()}
      >
        生成采购订单
      </Button>,
    );
  }

  const onReject = async () => {
    if (!reason.trim()) {
      setReasonError('驳回原因必填');
      return;
    }
    const outcome = await reject.run(reason.trim());
    if (outcome.ok) {
      setRejectOpen(false);
      setReason('');
    }
  };

  return (
    <div>
      <div className={`flex flex-wrap gap-2 ${layout === 'mobile' ? 'flex-col' : ''}`}>{actions}</div>

      {actions.length === 0 ? (
        <p className="text-xs text-ink-500">
          {request.status === 'COMPLETED'
            ? '该申请已完成，无可用操作。'
            : request.status === 'PURCHASING'
              ? '该申请处于采购中，到货入库请在「采购订单」页对相应订单执行。'
              : `当前视角无该状态的可执行动作（当前角色：${role}）。`}
        </p>
      ) : null}

      {approve.error ? (
        <p role="alert" className="mt-2 text-xs text-stockout-fg">
          {errorCodeOf(approve.error) === 'ILLEGAL_STATE_TRANSITION'
            ? '状态已变化，请刷新后重试。'
            : displayMessageOf(approve.error)}
        </p>
      ) : null}
      {reject.error ? (
        <p role="alert" className="mt-2 text-xs text-stockout-fg">
          {displayMessageOf(reject.error)}
        </p>
      ) : null}
      {createOrder.error ? (
        <p role="alert" className="mt-2 text-xs text-stockout-fg">
          {errorCodeOf(createOrder.error) === 'DUPLICATE_ORDER'
            ? '该申请已存在采购订单，请到「采购订单」查看。'
            : displayMessageOf(createOrder.error)}
        </p>
      ) : null}

      <ConfirmDialog
        open={approveOpen}
        title="确认通过该申请？"
        description={`${request.requestNo} 通过后进入「已审批」，可生成采购订单。`}
        confirmText="确认通过"
        pending={approve.pending}
        onConfirm={async () => {
          const outcome = await approve.run();
          if (outcome.ok) setApproveOpen(false);
        }}
        onCancel={() => setApproveOpen(false)}
      />

      <Modal
        open={rejectOpen}
        title="驳回采购申请"
        description="驳回原因必填。驳回后状态退回「待审批」，并保留原因供申请人查看。"
        onClose={() => setRejectOpen(false)}
        footer={
          <>
            <Button data-autofocus onClick={() => setRejectOpen(false)}>
              取消
            </Button>
            <Button variant="danger" onClick={onReject} disabled={reject.pending} aria-busy={reject.pending}>
              {reject.pending ? '提交中…' : '确认驳回'}
            </Button>
          </>
        }
      >
        <label htmlFor="reject-reason" className="mb-1 block text-xs font-medium text-ink-700">
          驳回原因 <span className="text-stockout-fg">*</span>
        </label>
        <Textarea
          id="reject-reason"
          value={reason}
          onChange={(event) => {
            setReason(event.target.value);
            setReasonError('');
          }}
          aria-invalid={Boolean(reasonError) || undefined}
          aria-describedby={reasonError ? 'reject-error' : undefined}
          placeholder="例如：预算超限，请下月再提"
        />
        {reasonError ? (
          <p id="reject-error" role="alert" className="mt-1 text-xs text-stockout-fg">
            {reasonError}
          </p>
        ) : null}
        {isRejected(request) ? (
          <p className="mt-2 text-xs text-ink-500">
            上一次驳回原因：<Badge tone="stockout">{request.rejectReason}</Badge>
          </p>
        ) : null}
      </Modal>
    </div>
  );
}
