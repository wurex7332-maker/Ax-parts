import { useId, useState } from 'react';

export interface ImageValue {
  imageUrl: string;
  alt: string;
}

/**
 * 图片上传：本地压缩后转 data URL 预览。
 * 后端无上传接口（PRD O-2），因此仅提交 imageUrl 字符串；超长时提示。
 */
export function ImageUploadField({
  value,
  onChange,
  materialName = '',
}: {
  value: ImageValue;
  onChange: (value: ImageValue) => void;
  materialName?: string;
}) {
  const id = useId();
  const [warning, setWarning] = useState('');

  const handleFile = async (file: File) => {
    setWarning('');
    if (!file.type.startsWith('image/')) {
      setWarning('请选择图片文件');
      return;
    }
    try {
      const dataUrl = await compressImage(file);
      if (dataUrl.length > 200_000) {
        setWarning('图片过大，已压缩但可能影响保存；建议使用更小的图片。');
      }
      onChange({ imageUrl: dataUrl, alt: value.alt || materialName });
    } catch {
      setWarning('图片读取失败，请重试');
    }
  };

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-medium text-ink-700">
        物料图片
      </label>
      <div className="flex flex-wrap items-start gap-3">
        {value.imageUrl ? (
          <img
            src={value.imageUrl}
            alt={value.alt || `${materialName || '物料'} 图片`}
            className="h-20 w-20 rounded-lg border border-line object-cover"
          />
        ) : (
          <div
            role="img"
            aria-label="无图片"
            className="flex h-20 w-20 items-center justify-center rounded-lg border border-dashed border-line bg-slate-50 text-[10px] text-ink-400"
          >
            无图片
          </div>
        )}
        <div className="flex-1 space-y-2">
          <input
            id={id}
            type="file"
            accept="image/*"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleFile(file);
            }}
            className="block w-full text-xs text-ink-600 file:mr-2 file:rounded-md file:border file:border-line file:bg-white file:px-3 file:py-1.5 file:text-xs"
          />
          <div>
            <label htmlFor={`${id}-alt`} className="block text-[11px] text-ink-500">
              图片说明（alt）
            </label>
            <input
              id={`${id}-alt`}
              value={value.alt}
              onChange={(event) => onChange({ ...value, alt: event.target.value })}
              placeholder={materialName || '例如：24 寸显示器正面图'}
              className="mt-1 w-full rounded-lg border border-line px-2 py-1.5 text-xs"
            />
          </div>
        </div>
      </div>
      <p className="mt-1 text-[11px] text-ink-400">
        演示环境仅在本地预览与保存字符串，不上传文件（后端暂无上传接口）。
      </p>
      {warning ? (
        <p role="alert" className="mt-1 text-[11px] text-low-fg">
          {warning}
        </p>
      ) : null}
      {value.imageUrl ? (
        <button
          type="button"
          onClick={() => onChange({ imageUrl: '', alt: value.alt })}
          className="mt-1 text-[11px] text-ink-500 underline decoration-dotted"
        >
          移除图片
        </button>
      ) : null}
    </div>
  );
}

async function compressImage(file: File): Promise<string> {
  const dataUrl = await readAsDataUrl(file);
  if (typeof document === 'undefined' || file.size < 120_000) return dataUrl;

  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const maxSize = 512;
      const scale = Math.min(maxSize / image.width, maxSize / image.height, 1);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    image.onerror = () => resolve(dataUrl);
    image.src = dataUrl;
  });
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
