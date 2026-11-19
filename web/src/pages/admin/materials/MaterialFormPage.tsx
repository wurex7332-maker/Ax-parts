import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../../api';
import { displayMessageOf, errorCodeOf } from '../../../api/errors';
import { ImageUploadField, type ImageValue } from '../../../components/domain/ImageUploadField';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Field, Select, TextInput } from '../../../components/ui/Field';
import { ErrorState, Skeleton } from '../../../components/ui/Feedback';
import { CATEGORIES, UNITS } from '../../../domain/enums';
import { centsToYuan, yuanToCents } from '../../../domain/format';
import type { UpdateMaterialInput } from '../../../api/port';
import { useDocumentTitle } from '../../../hooks/useA11y';
import { PATHS } from '../../../routes/paths';
import { useMutation } from '../../../state/useMutation';
import { useQuery } from '../../../state/useQuery';
import { announce } from '../../../components/a11y/Announcer';
import { toastSuccess } from '../../../state/toast';

interface FormState {
  sku: string;
  name: string;
  category: string;
  specModel: string;
  brand: string;
  unit: string;
  location: string;
  price: string;
  safetyStock: string;
  supplier: string;
  image: ImageValue;
}

const EMPTY: FormState = {
  sku: '',
  name: '',
  category: CATEGORIES[0],
  specModel: '',
  brand: '',
  unit: UNITS[0],
  location: '',
  price: '0.00',
  safetyStock: '0',
  supplier: '',
  image: { imageUrl: '', alt: '' },
};

export function MaterialFormPage() {
  const { sku } = useParams<{ sku: string }>();
  const isEdit = Boolean(sku);
  useDocumentTitle(isEdit ? '编辑辅料' : '新增辅料');
  const navigate = useNavigate();

  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const detail = useQuery(`material:${sku ?? 'new'}`, () => api.materials.get(sku as string), {
    tags: ['materials'],
    enabled: isEdit,
  });

  useEffect(() => {
    if (!isEdit || !detail.data) return;
    const m = detail.data;
    setForm({
      sku: m.sku,
      name: m.name,
      category: m.category,
      specModel: m.specModel,
      brand: m.brand,
      unit: m.unit,
      location: m.location,
      price: centsToYuan(m.priceCents),
      safetyStock: String(m.safetyStock),
      supplier: m.supplier,
      image: { imageUrl: m.imageUrl, alt: m.name },
    });
  }, [isEdit, detail.data]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: '' }));
  };

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!form.sku.trim()) next.sku = 'SKU 必填';
    if (!form.name.trim()) next.name = '名称必填';
    if (!form.location.trim()) next.location = '存放位置必填';
    const safety = Number(form.safetyStock);
    if (!Number.isInteger(safety) || safety < 0) next.safetyStock = '安全库存需为不小于 0 的整数';
    if (yuanToCents(form.price) === null) next.price = '单价格式应为非负金额，最多两位小数';
    if (!CATEGORIES.includes(form.category as (typeof CATEGORIES)[number])) next.category = '类别不合法';
    if (!UNITS.includes(form.unit as (typeof UNITS)[number])) next.unit = '单位不合法';
    setErrors(next);
    const firstKey = Object.keys(next)[0];
    if (firstKey) {
      document.getElementById(`m-${firstKey}`)?.focus();
      return false;
    }
    return true;
  };

  const create = useMutation('material.create', () =>
    api.materials.create({
      sku: form.sku.trim(),
      name: form.name.trim(),
      category: form.category,
      specModel: form.specModel.trim(),
      brand: form.brand.trim(),
      unit: form.unit,
      location: form.location.trim(),
      priceCents: yuanToCents(form.price) ?? 0,
      safetyStock: Number(form.safetyStock),
      supplier: form.supplier.trim(),
      imageUrl: form.image.imageUrl,
    }),
  );

  const update = useMutation('material.update', (payload: UpdateMaterialInput) =>
    api.materials.update(sku as string, payload),
  );

  const pending = create.pending || update.pending;

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!validate()) return;

    if (isEdit) {
      const payload: UpdateMaterialInput = {
        name: form.name.trim(),
        category: form.category,
        specModel: form.specModel.trim(),
        brand: form.brand.trim(),
        unit: form.unit,
        location: form.location.trim(),
        priceCents: yuanToCents(form.price) ?? 0,
        safetyStock: Number(form.safetyStock),
        supplier: form.supplier.trim(),
        imageUrl: form.image.imageUrl,
      };
      const outcome = await update.run(payload);
      if (outcome.ok) {
        toastSuccess('已保存修改');
        announce(`已保存 ${form.sku} 的修改`);
        navigate(PATHS.materials);
      } else if (errorCodeOf(outcome.error) === 'VALIDATION_ERROR') {
        setErrors({ name: displayMessageOf(outcome.error) });
      }
      return;
    }

    const outcome = await create.run();
    if (outcome.ok) {
      toastSuccess(`新增成功：${outcome.data.sku}`);
      announce(`新增辅料成功：${outcome.data.sku} ${outcome.data.name}`);
      navigate(PATHS.stockInbound('PURCHASE'));
      return;
    }
    const code = errorCodeOf(outcome.error);
    if (code === 'DUPLICATE_SKU') {
      setErrors({ sku: '该 SKU 已存在，请更换' });
      document.getElementById('m-sku')?.focus();
    }
  };

  if (isEdit && detail.error) return <ErrorState error={detail.error} onRetry={detail.refetch} />;
  if (isEdit && !detail.data) return <Skeleton rows={8} />;

  return (
    <>
      <PageHeader
        title={isEdit ? `编辑辅料：${sku}` : '新增辅料'}
        description={
          isEdit
            ? 'SKU 不可修改（后端契约禁止提交 sku 字段）。'
            : '新增后建议立即入库，避免短暂出现在断料清单中。'
        }
        breadcrumb={
          <Link to={PATHS.materials} className="underline decoration-dotted">
            辅料档案
          </Link>
        }
      />

      <form onSubmit={onSubmit} noValidate className="card max-w-3xl space-y-4 p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="SKU" htmlFor="m-sku" required error={errors.sku} hint={isEdit ? '不可修改' : '唯一标识，例如 MON-004'}>
            <TextInput
              id="m-sku"
              value={form.sku}
              onChange={(event) => set('sku', event.target.value)}
              disabled={isEdit}
              invalid={Boolean(errors.sku)}
              aria-describedby={errors.sku ? 'm-sku-error' : undefined}
              placeholder="MON-004"
            />
          </Field>

          <Field label="名称" htmlFor="m-name" required error={errors.name}>
            <TextInput
              id="m-name"
              value={form.name}
              onChange={(event) => set('name', event.target.value)}
              invalid={Boolean(errors.name)}
              placeholder="24 寸显示器"
            />
          </Field>

          <Field label="类别" htmlFor="m-category" required error={errors.category} hint="仅后端允许的 5 个类别">
            <Select id="m-category" value={form.category} onChange={(event) => set('category', event.target.value)}>
              {CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="单位" htmlFor="m-unit" required error={errors.unit} hint="仅 台 / 个 / 盒 / 箱">
            <Select id="m-unit" value={form.unit} onChange={(event) => set('unit', event.target.value)}>
              {UNITS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="规格型号" htmlFor="m-specModel">
            <TextInput id="m-specModel" value={form.specModel} onChange={(event) => set('specModel', event.target.value)} />
          </Field>

          <Field label="品牌" htmlFor="m-brand">
            <TextInput id="m-brand" value={form.brand} onChange={(event) => set('brand', event.target.value)} />
          </Field>

          <Field label="存放位置" htmlFor="m-location" required error={errors.location} hint="库位编码，例如 A-03">
            <TextInput
              id="m-location"
              value={form.location}
              onChange={(event) => set('location', event.target.value)}
              invalid={Boolean(errors.location)}
              placeholder="A-03"
            />
          </Field>

          <Field label="单价（元）" htmlFor="m-price" error={errors.price} hint="以分为单位传输，界面按元显示">
            <TextInput
              id="m-price"
              value={form.price}
              onChange={(event) => set('price', event.target.value)}
              invalid={Boolean(errors.price)}
              inputMode="decimal"
            />
          </Field>

          <Field label="安全库存" htmlFor="m-safetyStock" required error={errors.safetyStock} hint="库存 ≤ 该值即判预警">
            <TextInput
              id="m-safetyStock"
              value={form.safetyStock}
              onChange={(event) => set('safetyStock', event.target.value)}
              invalid={Boolean(errors.safetyStock)}
              inputMode="numeric"
            />
          </Field>

          <Field label="供应商" htmlFor="m-supplier">
            <TextInput id="m-supplier" value={form.supplier} onChange={(event) => set('supplier', event.target.value)} />
          </Field>
        </div>

        <ImageUploadField
          value={form.image}
          onChange={(value) => set('image', value)}
          materialName={form.name}
        />

        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <Button type="submit" variant="primary" disabled={pending} aria-busy={pending}>
            {pending ? '保存中…' : isEdit ? '保存修改' : '提交新增'}
          </Button>
          <Link
            to={PATHS.materials}
            className="inline-flex h-10 items-center rounded-lg border border-line px-4 text-sm text-ink-700"
          >
            取消
          </Link>
          {create.error && errorCodeOf(create.error) !== 'DUPLICATE_SKU' ? (
            <p role="alert" className="text-xs text-stockout-fg">
              {displayMessageOf(create.error)}
            </p>
          ) : null}
        </div>
      </form>
    </>
  );
}
