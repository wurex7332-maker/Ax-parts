import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../../api';
import { displayMessageOf, errorCodeOf } from '../../../api/errors';
import { MaterialCombobox } from '../../../components/domain/MaterialCombobox';
import { QtyStepper } from '../../../components/domain/QtyStepper';
import { HealthBadge } from '../../../components/health/HealthBadge';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Button } from '../../../components/ui/Button';
import { TextInput } from '../../../components/ui/Field';
import { HEALTH_LABEL } from '../../../domain/enums';
import type { Material } from '../../../domain/types';
import { useDocumentTitle } from '../../../hooks/useA11y';
import { PATHS } from '../../../routes/paths';
import { useMutation } from '../../../state/useMutation';
import { useSession } from '../../../state/session';
import { announce } from '../../../components/a11y/Announcer';
import { toastSuccess } from '../../../state/toast';

export function OutboundPage() {
  useDocumentTitle('领用出库');
  const recipientName = useSession((state) => state.recipientName);
  const setRecipientName = useSession((state) => state.setRecipientName);

  const [material, setMaterial] = useState<Material | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [recipient, setRecipient] = useState(recipientName);
  const [formKey, setFormKey] = useState(0);
  const [fieldError, setFieldError] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ currentStock: number; availableStock: number; health: 'NORMAL' | 'LOW' | 'STOCKOUT' } | null>(
    null,
  );

  const outbound = useMutation(
    'stock.outbound',
    () =>
      api.stock.outbound(
        {
          sku: material?.sku as string,
          quantity,
          recipient: recipient.trim(),
        },
        { idempotencyKey: crypto.randomUUID() },
      ),
    {
      onSuccess: (data) => {
        setResult({ currentStock: data.currentStock, availableStock: data.availableStock, health: data.health });
        toastSuccess(`出库成功，当前库存 ${data.currentStock}`);
        announce(`出库成功，当前库存 ${data.currentStock}，状态${HEALTH_LABEL[data.health]}`);
      },
    },
  );

  const onSubmit = async () => {
    const next: Record<string, string> = {};
    if (!material) next.material = '请先选择物料';
    if (!recipient.trim()) next.recipient = '领用人必填';
    if (!Number.isInteger(quantity) || quantity < 1) next.quantity = '数量需为不小于 1 的整数';
    setFieldError(next);
    if (Object.keys(next).length > 0) return;

    setRecipientName(recipient.trim());
    const outcome = await outbound.run();
    if (outcome.ok) {
      setMaterial(null);
      setQuantity(1);
      setFormKey((k) => k + 1);
    }
  };

  const code = errorCodeOf(outbound.error);

  return (
    <>
      <PageHeader
        title="领用出库"
        description="出库共 3 步：选物料 → 填数量（领用人已默认带出）→ 提交。可用量按该物料合计校验。"
        breadcrumb={
          <Link to={PATHS.stock} className="underline decoration-dotted">
            库存台账
          </Link>
        }
      />

      <div className="card max-w-xl space-y-4 p-4">
        <div key={formKey}>
          <MaterialCombobox
            onSelect={(selected) => {
              setMaterial(selected);
              setFieldError((prev) => ({ ...prev, material: '' }));
            }}
          />
          {fieldError.material ? (
            <p role="alert" className="mt-1 text-xs text-stockout-fg">
              {fieldError.material}
            </p>
          ) : null}
        </div>

        <QtyStepper
          value={quantity}
          onChange={setQuantity}
          min={1}
          error={fieldError.quantity}
          hint={material ? `单位：${material.unit}` : undefined}
        />

        <div>
          <label htmlFor="out-recipient" className="mb-1 block text-xs text-ink-500">
            领用人 <span className="text-stockout-fg">*</span>
          </label>
          <TextInput
            id="out-recipient"
            value={recipient}
            onChange={(event) => {
              setRecipient(event.target.value);
              setFieldError((prev) => ({ ...prev, recipient: '' }));
            }}
            invalid={Boolean(fieldError.recipient)}
            aria-describedby={fieldError.recipient ? 'out-recipient-error' : undefined}
          />
          {fieldError.recipient ? (
            <p id="out-recipient-error" role="alert" className="mt-1 text-xs text-stockout-fg">
              {fieldError.recipient}
            </p>
          ) : null}
        </div>

        {code === 'STOCK_INSUFFICIENT' ? (
          <p role="alert" className="rounded-lg bg-stockout-bg px-3 py-2 text-xs text-stockout-fg">
            可用库存不足，请调整数量。当前数量 {quantity} 超出可领用量。
          </p>
        ) : null}
        {outbound.error && code !== 'STOCK_INSUFFICIENT' ? (
          <p role="alert" className="text-xs text-stockout-fg">
            {displayMessageOf(outbound.error)}
          </p>
        ) : null}

        <div className="flex items-center gap-2 border-t border-line pt-3">
          <Button variant="primary" onClick={onSubmit} disabled={outbound.pending} aria-busy={outbound.pending}>
            {outbound.pending ? '提交中…' : '确认出库'}
          </Button>
          <Link
            to={PATHS.stock}
            className="inline-flex h-10 items-center rounded-lg border border-line px-4 text-sm text-ink-700"
          >
            返回台账
          </Link>
        </div>

        {result ? (
          <div role="status" className="rounded-lg border border-normal-bd bg-normal-bg px-3 py-2 text-xs text-normal-fg">
            出库完成，当前库存 {result.currentStock}，可用 {result.availableStock}，状态{' '}
            <HealthBadge health={result.health} />。
          </div>
        ) : null}
      </div>
    </>
  );
}
