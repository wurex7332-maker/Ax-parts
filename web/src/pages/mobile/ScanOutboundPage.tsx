import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { displayMessageOf, errorCodeOf } from '../../api/errors';
import { HealthBadge } from '../../components/health/HealthBadge';
import { QtyStepper } from '../../components/domain/QtyStepper';
import { Button } from '../../components/ui/Button';
import { Badge, Spinner } from '../../components/ui/Feedback';
import { TextInput } from '../../components/ui/Field';
import { HEALTH_LABEL } from '../../domain/enums';
import { healthOf } from '../../domain/health';
import type { MaterialDetail } from '../../domain/types';
import { useBarcodeScanner, parseSku } from '../../hooks/useBarcodeScanner';
import { useDocumentTitle } from '../../hooks/useA11y';
import { PATHS } from '../../routes/paths';
import { useMutation } from '../../state/useMutation';
import { useSession } from '../../state/session';
import { announce } from '../../components/a11y/Announcer';
import { toastSuccess } from '../../state/toast';

type Phase = 'scan' | 'confirm' | 'success';

export function ScanOutboundPage() {
  useDocumentTitle('扫码领用');
  const recipientName = useSession((state) => state.recipientName);

  const [phase, setPhase] = useState<Phase>('scan');
  const [material, setMaterial] = useState<MaterialDetail | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [lookupError, setLookupError] = useState('');
  const [loading, setLoading] = useState(false);
  const [manualSku, setManualSku] = useState('');
  const [result, setResult] = useState<{ currentStock: number; availableStock: number; health: 'NORMAL' | 'LOW' | 'STOCKOUT' } | null>(
    null,
  );
  const idempotencyKey = useRef(crypto.randomUUID());

  const lookup = useCallback(async (rawSku: string) => {
    const sku = rawSku.trim().toUpperCase();
    if (!sku) return;
    setLoading(true);
    setLookupError('');
    try {
      const detail = await api.materials.get(sku);
      if (detail.status === 'DISABLED') {
        setLookupError(`物料 ${sku} 已停用，不可领用。`);
        return;
      }
      setMaterial(detail);
      setQuantity(1);
      setPhase('confirm');
      announce(`已识别 ${detail.sku} ${detail.name}，当前库存 ${detail.currentStock}`);
    } catch (error) {
      const code = errorCodeOf(error);
      setLookupError(
        code === 'MATERIAL_NOT_FOUND'
          ? `未找到物料 ${sku}，请确认二维码或手工输入的 SKU。`
          : displayMessageOf(error),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const scanner = useBarcodeScanner((raw) => {
    const sku = parseSku(raw);
    if (!sku) {
      setLookupError('未识别的二维码（内容不是 SKU）。请使用手动输入。');
      return;
    }
    void lookup(sku);
  });

  // 进入页面自动尝试开扫（系统行为，不计入操作步数）
  useEffect(() => {
    if (phase === 'scan') void scanner.start();
    return () => scanner.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const outbound = useMutation(
    'stock.outbound',
    () =>
      api.stock.outbound(
        { sku: material?.sku as string, quantity, recipient: recipientName || '操作员' },
        { idempotencyKey: idempotencyKey.current },
      ),
    {
      onSuccess: (data) => {
        setResult({ currentStock: data.currentStock, availableStock: data.availableStock, health: data.health });
        setPhase('success');
        toastSuccess(`领用成功，扣减后库存 ${data.currentStock}`);
        announce(`领用成功，扣减后库存 ${data.currentStock}，状态${HEALTH_LABEL[data.health]}`);
      },
    },
  );

  const submit = async () => {
    const outcome = await outbound.run();
    if (outcome.ok) idempotencyKey.current = crypto.randomUUID();
  };

  const restart = () => {
    setMaterial(null);
    setResult(null);
    setQuantity(1);
    setLookupError('');
    setManualSku('');
    setPhase('scan');
  };

  if (phase === 'success' && result) {
    return (
      <div className="space-y-4">
        <h1 tabIndex={-1} className="text-lg font-semibold text-ink-900">
          领用成功
        </h1>
        <div role="status" className="rounded-xl border border-normal-bd bg-normal-bg p-4">
          <p className="text-sm font-semibold text-normal-fg">
            {material?.sku} {material?.name}
          </p>
          <p className="mt-2 text-xs text-normal-fg">扣减数量 {quantity}{material?.unit}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-normal-fg">{result.currentStock}</p>
          <p className="text-xs text-normal-fg">扣减后当前库存</p>
          <div className="mt-2 flex items-center gap-2 text-xs text-normal-fg">
            <HealthBadge health={result.health} currentStock={result.currentStock} safetyStock={material?.safetyStock} />
            <span>可用 {result.availableStock}</span>
          </div>
        </div>

        <p className="rounded-lg bg-white px-3 py-2 text-xs leading-5 text-ink-500">
          Web 端的看板与台账读取同一份数据。若四个指标卡数字未变属正常：该物料领用后仍高于安全库存，
          佐证请看「库存台账」的库位库存、「流水明细」新增的领用记录。
        </p>

        <div className="flex flex-col gap-2">
          <Link
            to={PATHS.dashboard}
            className="tap-target flex items-center justify-center rounded-lg bg-brand-500 px-4 text-sm font-medium text-white"
          >
            查看 Web 看板
          </Link>
          <Button className="tap-target h-11 w-full" onClick={restart}>
            继续扫码领用
          </Button>
        </div>
      </div>
    );
  }

  if (phase === 'confirm' && material) {
    return (
      <div className="space-y-4">
        <h1 tabIndex={-1} className="text-lg font-semibold text-ink-900">
          确认领用
        </h1>

        <div className="card p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-ink-600">{material.sku}</span>
            <span className="text-sm font-semibold text-ink-900">{material.name}</span>
            <HealthBadge health={healthOf(material.currentStock, material.safetyStock)} currentStock={material.currentStock} safetyStock={material.safetyStock} />
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div>
              <dt className="text-ink-500">库位</dt>
              <dd className="text-ink-800">{material.location}</dd>
            </div>
            <div>
              <dt className="text-ink-500">当前库存</dt>
              <dd className="tabular-nums text-ink-800">
                {material.currentStock} {material.unit}
              </dd>
            </div>
            <div>
              <dt className="text-ink-500">安全库存</dt>
              <dd className="tabular-nums text-ink-800">{material.safetyStock}</dd>
            </div>
            <div>
              <dt className="text-ink-500">领用人</dt>
              <dd className="text-ink-800">{recipientName || '操作员'}</dd>
            </div>
          </dl>
        </div>

        <QtyStepper value={quantity} onChange={setQuantity} min={1} label="领用数量" hint={`单位：${material.unit}`} />

        {errorCodeOf(outbound.error) === 'STOCK_INSUFFICIENT' ? (
          <p role="alert" className="rounded-lg bg-stockout-bg px-3 py-2 text-xs text-stockout-fg">
            可用库存仅 {material.currentStock}，请调整数量。
          </p>
        ) : null}
        {outbound.error && errorCodeOf(outbound.error) !== 'STOCK_INSUFFICIENT' ? (
          <p role="alert" className="text-xs text-stockout-fg">
            {displayMessageOf(outbound.error)}
          </p>
        ) : null}

        <div className="flex flex-col gap-2">
          <Button
            variant="primary"
            className="tap-target h-12 w-full text-base"
            onClick={submit}
            disabled={outbound.pending}
            aria-busy={outbound.pending}
          >
            {outbound.pending ? '提交中…' : '确认领用'}
          </Button>
          <Button className="tap-target h-11 w-full" onClick={restart}>
            重新扫码
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 tabIndex={-1} className="text-lg font-semibold text-ink-900">
        扫码领用
      </h1>
      <p className="text-xs leading-5 text-ink-500">
        扫码识别与数量确认共 2 步。二维码内容应为物料 SKU。摄像头不可用时可直接手动输入，仍为 2 步。
      </p>

      <div className="relative overflow-hidden rounded-xl border border-line bg-ink-900">
        <video
          ref={scanner.videoRef}
          muted
          playsInline
          aria-label="摄像头取景画面"
          className="h-56 w-full object-cover"
        />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-32 w-32 rounded-lg border-2 border-white/80" aria-hidden="true" />
        </div>
        <div className="absolute inset-x-0 bottom-0 bg-ink-900/70 px-3 py-1.5 text-[11px] text-white">
          {scanner.status === 'scanning'
            ? '正在扫描…将二维码置于框内'
            : scanner.status === 'starting'
              ? '正在启动摄像头…'
              : scanner.status === 'idle'
                ? '摄像头未启动'
                : '摄像头不可用'}
        </div>
      </div>

      {scanner.errorMessage ? (
        <p role="alert" className="rounded-lg bg-low-bg px-3 py-2 text-xs leading-5 text-low-fg">
          {scanner.errorMessage}
        </p>
      ) : null}

      {scanner.status !== 'scanning' && scanner.status !== 'starting' ? (
        <Button className="tap-target h-11 w-full" onClick={() => void scanner.start()}>
          重新开启摄像头
        </Button>
      ) : null}

      <div className="card space-y-2 p-3">
        <label htmlFor="manual-sku" className="block text-xs font-medium text-ink-700">
          手动输入 SKU
        </label>
        <div className="flex gap-2">
          <TextInput
            id="manual-sku"
            value={manualSku}
            onChange={(event) => setManualSku(event.target.value)}
            placeholder="例如 MON-004"
            autoComplete="off"
          />
          <Button
            variant="primary"
            className="tap-target shrink-0"
            onClick={() => void lookup(manualSku)}
            disabled={loading || !manualSku.trim()}
          >
            识别
          </Button>
        </div>
        <p className="text-[11px] text-ink-400">演示可直接输入 MON-004，模拟扫码结果。</p>
      </div>

      {loading ? <Spinner label="查询物料中" /> : null}

      {lookupError ? (
        <p role="alert" className="rounded-lg bg-stockout-bg px-3 py-2 text-xs text-stockout-fg">
          {lookupError}
        </p>
      ) : null}

      <div className="rounded-lg border border-dashed border-line px-3 py-2 text-[11px] leading-5 text-ink-500">
        说明：手机端不提供档案维护、盘点、报表等后台入口；当前角色下的可见入口仅领用、查询、审批与消息。
        <Badge className="ml-1">权限收敛</Badge>
      </div>
    </div>
  );
}

