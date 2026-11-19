import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../../api';
import { displayMessageOf, errorCodeOf } from '../../../api/errors';
import { MaterialCombobox } from '../../../components/domain/MaterialCombobox';
import { QtyStepper } from '../../../components/domain/QtyStepper';
import { HealthBadge } from '../../../components/health/HealthBadge';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Feedback';
import { TextInput } from '../../../components/ui/Field';
import { SuggestInput } from '../../../components/ui/SuggestInput';
import { useLocationOptions } from '../../../hooks/useSuggestions';
import { HEALTH_LABEL, INBOUND_SOURCES } from '../../../domain/enums';
import type { Material } from '../../../domain/types';
import { useDocumentTitle } from '../../../hooks/useA11y';
import { PATHS } from '../../../routes/paths';
import { useMutation } from '../../../state/useMutation';
import { announce } from '../../../components/a11y/Announcer';
import { toastSuccess } from '../../../state/toast';

export function InboundPage() {
  useDocumentTitle('入库');
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const initialType = params.get('type') === 'RETURN' ? 'RETURN' : 'PURCHASE';

  const [source, setSource] = useState<'PURCHASE' | 'RETURN'>(initialType);
  const [material, setMaterial] = useState<Material | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [location, setLocation] = useState('');
  const [relatedDocNo, setRelatedDocNo] = useState('');
  const [formKey, setFormKey] = useState(0);
  const locationOptions = useLocationOptions();
  const [fieldError, setFieldError] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ currentStock: number; health: 'NORMAL' | 'LOW' | 'STOCKOUT' } | null>(null);

  const inbound = useMutation(
    'stock.inbound',
    () =>
      api.stock.inbound({
        sku: material?.sku as string,
        quantity,
        source,
        location: location.trim() || undefined,
        relatedDocNo: relatedDocNo.trim() || undefined,
      }),
    {
      onSuccess: (data) => {
        setResult({ currentStock: data.currentStock, health: data.health });
        toastSuccess(`入库成功，当前库存 ${data.currentStock}，状态${HEALTH_LABEL[data.health]}`);
        announce(`入库成功，当前库存 ${data.currentStock}，状态${HEALTH_LABEL[data.health]}`);
      },
    },
  );

  const onSubmit = async () => {
    const next: Record<string, string> = {};
    if (!material) next.material = '请先选择物料';
    if (!Number.isInteger(quantity) || quantity < 1) next.quantity = '数量需为不小于 1 的整数';
    setFieldError(next);
    if (Object.keys(next).length > 0) return;

    const outcome = await inbound.run();
    if (outcome.ok) {
      setMaterial(null);
      setQuantity(1);
      setRelatedDocNo('');
      setFormKey((k) => k + 1);
    }
  };

  const docError = errorCodeOf(inbound.error);

  return (
    <>
      <PageHeader
        title={source === 'PURCHASE' ? '采购入库' : '退料入库'}
        description="入库共 3 步：选物料 → 填数量 → 提交。类型由入口带入，切换不增加操作步数。"
        breadcrumb={
          <Link to={PATHS.stock} className="underline decoration-dotted">
            库存台账
          </Link>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-xs text-ink-500">入库类型</span>
        {INBOUND_SOURCES.map((item) => (
          <button
            key={item.value}
            type="button"
            aria-pressed={source === item.value}
            onClick={() => {
              setSource(item.value);
              navigate(PATHS.stockInbound(item.value), { replace: true });
            }}
            className={`tap-target rounded-lg border px-3 text-xs ${
              source === item.value
                ? 'border-brand-500 bg-brand-50 font-medium text-brand-700'
                : 'border-line bg-white text-ink-700'
            }`}
          >
            {item.label}
          </button>
        ))}
        {location ? <Badge tone="brand">库位 {location}</Badge> : null}
      </div>

      <div className="card max-w-xl space-y-4 p-4">
        <div key={formKey}>
          <MaterialCombobox
            onSelect={(selected) => {
              setMaterial(selected);
              setLocation(selected.location);
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
          <label htmlFor="inbound-location" className="mb-1 block text-xs text-ink-500">
            入库库位（默认取档案库位）
          </label>
          <SuggestInput
            id="inbound-location"
            value={location}
            onChange={setLocation}
            options={locationOptions}
            placeholder="A-01（可从已有库位选）"
          />
        </div>

        <div>
          <label htmlFor="inbound-doc" className="mb-1 block text-xs text-ink-500">
            来源单号（选填）
          </label>
          <TextInput
            id="inbound-doc"
            value={relatedDocNo}
            onChange={(event) => setRelatedDocNo(event.target.value)}
            placeholder="例如 PO-000123"
          />
        </div>

        {docError === 'MATERIAL_DISABLED' ? (
          <p role="alert" className="rounded-lg bg-low-bg px-3 py-2 text-xs text-low-fg">
            该物料已停用，无法入库。请先在档案中启用或改用其他物料。
          </p>
        ) : null}
        {inbound.error && docError !== 'MATERIAL_DISABLED' ? (
          <p role="alert" className="text-xs text-stockout-fg">
            {displayMessageOf(inbound.error)}
          </p>
        ) : null}

        <div className="flex items-center gap-2 border-t border-line pt-3">
          <Button variant="primary" onClick={onSubmit} disabled={inbound.pending} aria-busy={inbound.pending}>
            {inbound.pending ? '提交中…' : '确认入库'}
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
            入库完成，当前库存 {result.currentStock}，状态 <HealthBadge health={result.health} />。
            表单已重置，可继续录入下一笔。
          </div>
        ) : null}
      </div>
    </>
  );
}
