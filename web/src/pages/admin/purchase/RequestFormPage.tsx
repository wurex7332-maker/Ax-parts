import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../../api';
import { displayMessageOf } from '../../../api/errors';
import { MaterialCombobox } from '../../../components/domain/MaterialCombobox';
import { QtyStepper } from '../../../components/domain/QtyStepper';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Badge, Skeleton } from '../../../components/ui/Feedback';
import { Textarea, TextInput } from '../../../components/ui/Field';
import { centsToYuanLabel, defaultExpectedDate, todayIso } from '../../../domain/format';
import type { MaterialDetail } from '../../../domain/types';
import { useDocumentTitle } from '../../../hooks/useA11y';
import { PATHS } from '../../../routes/paths';
import { useMutation } from '../../../state/useMutation';
import { useSession } from '../../../state/session';
import { announce } from '../../../components/a11y/Announcer';
import { toastSuccess } from '../../../state/toast';

export function RequestFormPage() {
  useDocumentTitle('新建采购申请');
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const actor = useSession((state) => state.actor());

  const fromAlert = params.get('from') === 'alert';
  const presetSku = params.get('sku') ?? '';
  const presetQty = Number(params.get('qty') ?? '') || undefined;

  const [material, setMaterial] = useState<MaterialDetail | null>(null);
  const [loadingMaterial, setLoadingMaterial] = useState(Boolean(fromAlert && presetSku));
  const [quantity, setQuantity] = useState(presetQty ?? 1);
  const [expectedDate, setExpectedDate] = useState(defaultExpectedDate());
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formKey, setFormKey] = useState(0);

  // 预填：suggestions 不带供应商，因此额外取物料详情（PRD §6.3）
  useEffect(() => {
    if (!fromAlert || !presetSku) return;
    let cancelled = false;
    setLoadingMaterial(true);
    api.materials
      .get(presetSku)
      .then((detail) => {
        if (cancelled) return;
        setMaterial(detail);
        const level = detail.currentStock <= 0 ? '断料' : '预警';
        setReason(
          `${level}补货：${detail.name}(${detail.sku}) 当前 ${detail.currentStock}，安全库存 ${detail.safetyStock}`,
        );
        setQuantity(presetQty ?? Math.max(2 * detail.safetyStock - detail.currentStock, 1));
      })
      .catch(() => {
        if (!cancelled) setErrors({ material: '预警物料不存在，请手动选择' });
      })
      .finally(() => {
        if (!cancelled) setLoadingMaterial(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fromAlert, presetSku, presetQty]);

  const create = useMutation(
    'purchase.createRequest',
    () =>
      api.purchase.createRequest({
        sku: material?.sku as string,
        quantity,
        expectedDate,
        reason: reason.trim(),
        source: fromAlert ? 'ALERT' : 'MANUAL',
        applicant: actor,
      }),
    {
      onSuccess: (data) => {
        toastSuccess(`申请已提交：${data.requestNo}，等待车间主管审批`);
        announce(`采购申请 ${data.requestNo} 已提交，状态为待审批`);
      },
    },
  );

  const onSubmit = async () => {
    const next: Record<string, string> = {};
    if (!material) next.material = '请先选择物料';
    if (!Number.isInteger(quantity) || quantity < 1) next.quantity = '数量需为不小于 1 的整数';
    if (!expectedDate) next.expectedDate = '期望到货日期必填';
    else if (expectedDate < todayIso()) next.expectedDate = '期望到货日期不能早于今天';
    if (!reason.trim()) next.reason = '申请理由必填';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const outcome = await create.run();
    if (outcome.ok) navigate(PATHS.requestDetail(outcome.data.id));
  };

  const estimate = material ? material.priceCents * quantity : 0;

  return (
    <>
      <PageHeader
        title="新建采购申请"
        description="后端无「预算」「供应商」字段：供应商由物料档案带出只读，金额为估算展示，均不提交。"
        breadcrumb={
          <Link to={PATHS.requests} className="underline decoration-dotted">
            采购申请
          </Link>
        }
      />

      {fromAlert ? (
        <p className="mb-3 rounded-lg border border-brand-100 bg-brand-50 px-3 py-2 text-xs text-brand-700">
          已由预警建议生成（建议量 {presetQty ?? '按公式计算'}），提交前请核对交期与理由。
        </p>
      ) : null}

      <div className="card max-w-2xl space-y-4 p-4">
        {loadingMaterial ? <Skeleton rows={2} /> : null}

        {fromAlert && material ? (
          <div className="rounded-lg border border-line bg-slate-50 p-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-ink-700">
              <span className="font-mono">{material.sku}</span>
              <span className="font-medium">{material.name}</span>
              <Badge>{material.location}</Badge>
              <Badge tone="brand">{material.unit}</Badge>
              <span className="text-ink-500">
                当前库存 {material.currentStock} / 安全库存 {material.safetyStock}
              </span>
            </div>
            <p className="mt-2 text-xs text-ink-500">
              供应商：{material.supplier || '—'}（只读，后端按 SKU 关联）
            </p>
            <button
              type="button"
              onClick={() => {
                setMaterial(null);
                setFormKey((k) => k + 1);
                setErrors({});
              }}
              className="mt-1 text-[11px] text-ink-500 underline decoration-dotted"
            >
              改为手动选择其他物料
            </button>
          </div>
        ) : (
          <div key={formKey}>
            <MaterialCombobox
              onSelect={(selected) => {
                setMaterial({ ...selected, currentStock: 0 });
                setErrors((prev) => ({ ...prev, material: '' }));
              }}
            />
            {errors.material ? (
              <p role="alert" className="mt-1 text-xs text-stockout-fg">
                {errors.material}
              </p>
            ) : null}
          </div>
        )}

        <QtyStepper value={quantity} onChange={setQuantity} min={1} error={errors.quantity} />

        <div>
          <label htmlFor="rq-date" className="mb-1 block text-xs text-ink-500">
            期望到货日期 <span className="text-stockout-fg">*</span>
          </label>
          <TextInput
            id="rq-date"
            type="date"
            value={expectedDate}
            min={todayIso()}
            onChange={(event) => {
              setExpectedDate(event.target.value);
              setErrors((prev) => ({ ...prev, expectedDate: '' }));
            }}
            invalid={Boolean(errors.expectedDate)}
            aria-describedby={errors.expectedDate ? 'rq-date-error' : 'rq-date-hint'}
          />
          <p id="rq-date-hint" className="mt-1 text-xs text-ink-500">
            默认今天 + 7 天；该字段后端必填，但无格式校验，故前端强制日期控件。
          </p>
          {errors.expectedDate ? (
            <p id="rq-date-error" role="alert" className="mt-1 text-xs text-stockout-fg">
              {errors.expectedDate}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="rq-reason" className="mb-1 block text-xs text-ink-500">
            申请理由 / 备注 <span className="text-stockout-fg">*</span>
          </label>
          <Textarea
            id="rq-reason"
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
              setErrors((prev) => ({ ...prev, reason: '' }));
            }}
            aria-invalid={Boolean(errors.reason) || undefined}
            aria-describedby={errors.reason ? 'rq-reason-error' : undefined}
            placeholder="说明用途与紧急程度"
          />
          {errors.reason ? (
            <p id="rq-reason-error" role="alert" className="mt-1 text-xs text-stockout-fg">
              {errors.reason}
            </p>
          ) : null}
        </div>

        <div className="rounded-lg border border-dashed border-line px-3 py-2 text-xs text-ink-500">
          估算金额：{material ? `${quantity} × ${centsToYuanLabel(material.priceCents)} ≈ ${centsToYuanLabel(estimate)}` : '—'}
          <span className="ml-1 text-ink-400">（仅展示，不入库）</span>
        </div>

        {create.error ? (
          <p role="alert" className="text-xs text-stockout-fg">
            {displayMessageOf(create.error)}
          </p>
        ) : null}

        <div className="flex items-center gap-2 border-t border-line pt-3">
          <Button variant="primary" onClick={onSubmit} disabled={create.pending} aria-busy={create.pending}>
            {create.pending ? '提交中…' : '提交申请'}
          </Button>
          <Link
            to={PATHS.requests}
            className="inline-flex h-10 items-center rounded-lg border border-line px-4 text-sm text-ink-700"
          >
            取消
          </Link>
        </div>
      </div>
    </>
  );
}
