import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../../api';
import { displayMessageOf } from '../../../api/errors';
import { MaterialCombobox } from '../../../components/domain/MaterialCombobox';
import { QtyStepper } from '../../../components/domain/QtyStepper';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/Dialog';
import { TextInput } from '../../../components/ui/Field';
import { ADJUST_TYPES } from '../../../domain/enums';
import type { Material } from '../../../domain/types';
import { useDocumentTitle } from '../../../hooks/useA11y';
import { PATHS } from '../../../routes/paths';
import { useMutation } from '../../../state/useMutation';
import { announce } from '../../../components/a11y/Announcer';
import { toastSuccess } from '../../../state/toast';

export function AdjustPage() {
  useDocumentTitle('库存调整');
  const [type, setType] = useState<'LOSS' | 'TRANSFER'>('LOSS');
  const [material, setMaterial] = useState<Material | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [location, setLocation] = useState('');
  const [sourceLocation, setSourceLocation] = useState('');
  const [targetLocation, setTargetLocation] = useState('');
  const [purpose, setPurpose] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);

  const adjust = useMutation(
    'stock.adjust',
    () =>
      api.stock.adjust(
        type === 'LOSS'
          ? { sku: material?.sku as string, type, quantity, location: location.trim(), purpose: purpose.trim() }
          : {
              sku: material?.sku as string,
              type,
              quantity,
              sourceLocation: sourceLocation.trim(),
              targetLocation: targetLocation.trim(),
              purpose: purpose.trim(),
            },
      ),
    {
      onSuccess: (data) => {
        toastSuccess(`${type === 'LOSS' ? '报损' : '调拨'}成功，当前库存 ${data.currentStock}`);
        announce(`${type === 'LOSS' ? '报损' : '调拨'}成功，当前库存 ${data.currentStock}`);
        setMaterial(null);
        setQuantity(1);
        setPurpose('');
        setFormKey((k) => k + 1);
      },
    },
  );

  const validate = () => {
    const next: Record<string, string> = {};
    if (!material) next.material = '请先选择物料';
    if (!Number.isInteger(quantity) || quantity < 1) next.quantity = '数量需为不小于 1 的整数';
    if (type === 'LOSS' && !location.trim()) next.location = '报损必须指定库位（否则后端会写入空库位）';
    if (type === 'TRANSFER') {
      if (!sourceLocation.trim()) next.sourceLocation = '调拨需指定源库位';
      if (!targetLocation.trim()) next.targetLocation = '调拨需指定目标库位';
      if (sourceLocation.trim() && sourceLocation.trim() === targetLocation.trim()) {
        next.targetLocation = '源库位与目标库位不能相同';
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = () => {
    if (!validate()) return;
    setConfirmOpen(true);
  };

  return (
    <>
      <PageHeader
        title="库存调整"
        description="报损扣减指定库位库存；调拨在两个库位间原子搬移并生成一出一入两条流水。"
        breadcrumb={
          <Link to={PATHS.stock} className="underline decoration-dotted">
            库存台账
          </Link>
        }
      />

      <div className="card max-w-xl space-y-4 p-4">
        <div>
          <span className="mb-1 block text-xs text-ink-500">调整类型</span>
          <div className="flex gap-2">
            {ADJUST_TYPES.map((item) => (
              <button
                key={item.value}
                type="button"
                aria-pressed={type === item.value}
                onClick={() => {
                  setType(item.value);
                  setErrors({});
                }}
                className={`tap-target rounded-lg border px-3 text-xs ${
                  type === item.value
                    ? 'border-brand-500 bg-brand-50 font-medium text-brand-700'
                    : 'border-line bg-white text-ink-700'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div key={formKey}>
          <MaterialCombobox
            onSelect={(selected) => {
              setMaterial(selected);
              setLocation(selected.location);
              setSourceLocation(selected.location);
              setErrors((prev) => ({ ...prev, material: '' }));
            }}
          />
          {errors.material ? (
            <p role="alert" className="mt-1 text-xs text-stockout-fg">
              {errors.material}
            </p>
          ) : null}
        </div>

        <QtyStepper value={quantity} onChange={setQuantity} min={1} error={errors.quantity} />

        {type === 'LOSS' ? (
          <div>
            <label htmlFor="loss-location" className="mb-1 block text-xs text-ink-500">
              库位 <span className="text-stockout-fg">*</span>
            </label>
            <TextInput
              id="loss-location"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              invalid={Boolean(errors.location)}
              aria-describedby={errors.location ? 'loss-location-error' : undefined}
            />
            {errors.location ? (
              <p id="loss-location-error" role="alert" className="mt-1 text-xs text-stockout-fg">
                {errors.location}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="tr-source" className="mb-1 block text-xs text-ink-500">
                源库位 <span className="text-stockout-fg">*</span>
              </label>
              <TextInput
                id="tr-source"
                value={sourceLocation}
                onChange={(event) => setSourceLocation(event.target.value)}
                invalid={Boolean(errors.sourceLocation)}
              />
              {errors.sourceLocation ? (
                <p role="alert" className="mt-1 text-xs text-stockout-fg">
                  {errors.sourceLocation}
                </p>
              ) : null}
            </div>
            <div>
              <label htmlFor="tr-target" className="mb-1 block text-xs text-ink-500">
                目标库位 <span className="text-stockout-fg">*</span>
              </label>
              <TextInput
                id="tr-target"
                value={targetLocation}
                onChange={(event) => setTargetLocation(event.target.value)}
                invalid={Boolean(errors.targetLocation)}
              />
              {errors.targetLocation ? (
                <p role="alert" className="mt-1 text-xs text-stockout-fg">
                  {errors.targetLocation}
                </p>
              ) : null}
            </div>
          </div>
        )}

        <div>
          <label htmlFor="adjust-purpose" className="mb-1 block text-xs text-ink-500">
            原因 / 说明
          </label>
          <TextInput
            id="adjust-purpose"
            value={purpose}
            onChange={(event) => setPurpose(event.target.value)}
            placeholder={type === 'LOSS' ? '例如：运输破损' : '例如：库位调整'}
          />
        </div>

        {adjust.error ? (
          <p role="alert" className="text-xs text-stockout-fg">
            {displayMessageOf(adjust.error)}
          </p>
        ) : null}

        <div className="flex items-center gap-2 border-t border-line pt-3">
          <Button variant="primary" onClick={onSubmit} disabled={adjust.pending}>
            提交调整
          </Button>
          <Link
            to={PATHS.stock}
            className="inline-flex h-10 items-center rounded-lg border border-line px-4 text-sm text-ink-700"
          >
            返回台账
          </Link>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title={type === 'LOSS' ? '确认报损' : '确认调拨'}
        description={
          type === 'LOSS'
            ? `将从库位 ${location} 扣减 ${material?.name ?? ''} ${quantity}${material?.unit ?? ''}，该操作会写入流水。`
            : `将把 ${material?.name ?? ''} ${quantity}${material?.unit ?? ''} 从 ${sourceLocation} 调拨到 ${targetLocation}。`
        }
        confirmText={type === 'LOSS' ? '确认报损' : '确认调拨'}
        danger={type === 'LOSS'}
        pending={adjust.pending}
        onConfirm={async () => {
          const outcome = await adjust.run();
          if (outcome.ok) setConfirmOpen(false);
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
