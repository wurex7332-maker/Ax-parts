import { useCallback, useEffect, useRef, useState } from 'react';

export type ScannerStatus = 'idle' | 'starting' | 'scanning' | 'denied' | 'unsupported' | 'error';

export interface UseBarcodeScannerResult {
  status: ScannerStatus;
  errorMessage: string;
  videoRef: React.RefObject<HTMLVideoElement>;
  start: () => Promise<void>;
  stop: () => void;
}

/** 从二维码原文解析 SKU：支持 ?sku=xxx、SKU:xxx、纯 SKU 串（PRD 假设 A4） */
export function parseSku(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;
  const queryMatch = text.match(/[?&#]sku=([A-Za-z0-9_-]{2,40})/i);
  if (queryMatch) return queryMatch[1];
  const prefixMatch = text.match(/^SKU[:=]\s*([A-Za-z0-9_-]{2,40})$/i);
  if (prefixMatch) return prefixMatch[1];
  if (/^[A-Za-z0-9_-]{3,32}$/.test(text)) return text;
  return null;
}

function isSecure(): boolean {
  if (typeof window === 'undefined') return false;
  const { isSecureContext, location } = window;
  if (isSecureContext) return true;
  return location?.hostname === 'localhost' || location?.hostname === '127.0.0.1';
}

/**
 * 扫码能力分级：BarcodeDetector 优先，缺失时按需加载 ZXing；
 * 非安全上下文（局域网 http）不请求摄像头，直接回落到手动输入。
 */
export function useBarcodeScanner(onDetect: (raw: string) => void): UseBarcodeScannerResult {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<ScannerStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const streamRef = useRef<MediaStream | null>(null);
  const stopFlag = useRef(false);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const detectRef = useRef(onDetect);
  detectRef.current = onDetect;

  const stop = useCallback(() => {
    stopFlag.current = true;
    controlsRef.current?.stop?.();
    controlsRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setStatus((prev) => (prev === 'scanning' || prev === 'starting' ? 'idle' : prev));
  }, []);

  const start = useCallback(async () => {
    if (!isSecure()) {
      setStatus('unsupported');
      setErrorMessage('当前环境非 HTTPS 或 localhost，浏览器禁止访问摄像头。请改用下方的「手动输入 SKU」。');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('unsupported');
      setErrorMessage('当前浏览器不支持摄像头调用，请使用「手动输入 SKU」。');
      return;
    }

    setStatus('starting');
    setErrorMessage('');
    stopFlag.current = false;

    // 部分环境下 getUserMedia 可能长时间不返回，给一个可见的兜底时限
    const guard = window.setTimeout(() => {
      setStatus((prev) => (prev === 'starting' ? 'error' : prev));
      setErrorMessage((prev) =>
        prev || '摄像头启动超时（可能是设备被占用或系统未授权）。请使用「手动输入 SKU」，或检查浏览器权限后重试。',
      );
    }, 8000);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        video.setAttribute('playsinline', 'true');
        await video.play().catch(() => undefined);
      }
      clearTimeout(guard);
      setStatus('scanning');

      // 优先原生解码
      const DetectorCtor = (window as unknown as { BarcodeDetector?: new (opts: { formats: string[] }) => { detect: (src: HTMLVideoElement) => Promise<{ rawValue: string }[]> } })
        .BarcodeDetector;
      if (DetectorCtor) {
        const supported = await (DetectorCtor as unknown as { getSupportedFormats?: () => Promise<string[]> })
          .getSupportedFormats?.()
          .catch(() => [] as string[]);
        if (!supported || supported.includes('qr_code')) {
          const detector = new DetectorCtor({ formats: ['qr_code'] });
          const tick = async () => {
            if (stopFlag.current || !videoRef.current) return;
            try {
              const codes = await detector.detect(videoRef.current);
              const value = codes[0]?.rawValue;
              if (value) {
                stop();
                detectRef.current(value);
                return;
              }
            } catch {
              // 单帧失败继续
            }
            window.setTimeout(tick, 220);
          };
          void tick();
          return;
        }
      }

      // 回退：按需加载 ZXing（独立 chunk，不拖首屏）
      const zxing = await import('@zxing/browser');
      const reader = new zxing.BrowserQRCodeReader();
      const controls = await reader.decodeFromVideoElement(videoRef.current as HTMLVideoElement, (result, err) => {
        if (result) {
          stop();
          detectRef.current(result.getText());
        }
        if (err && !/NotFoundException/.test(String(err))) {
          // 解码器在无码帧会持续抛 NotFound，忽略
        }
      });
      controlsRef.current = controls as unknown as { stop: () => void };
    } catch (error) {
      clearTimeout(guard);
      const name = (error as { name?: string })?.name ?? '';
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        setStatus('denied');
        setErrorMessage('摄像头权限被拒绝。可在浏览器地址栏重新授权，或使用「手动输入 SKU」。');
      } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        setStatus('unsupported');
        setErrorMessage('未检测到可用摄像头。请使用「手动输入 SKU」。');
      } else if (name === 'NotReadableError') {
        setStatus('error');
        setErrorMessage('摄像头被其他程序占用，无法读取。');
      } else {
        setStatus('error');
        setErrorMessage('扫码启动失败，请重试或手动输入 SKU。');
      }
    }
  }, [stop]);

  useEffect(() => () => stop(), [stop]);

  return { status, errorMessage, videoRef, start, stop };
}
