import { useCallback, useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { Button } from './Button';

interface ModalProps {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children?: ReactNode;
  footer?: ReactNode;
  /** 移动端全屏呈现，主操作落在拇指区 */
  fullScreenOnMobile?: boolean;
}

/**
 * 轻量模态：role=dialog + aria-modal + Esc 关闭 + 焦点锁定与还原。
 * 复核点：确认类弹窗默认聚焦「取消」，降低误触（PRD §6.2）。
 */
export function Modal({ open, title, description, onClose, children, footer, fullScreenOnMobile }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    if (panel) {
      const target = panel.querySelector<HTMLElement>('[data-autofocus], button, input, select, textarea, a[href]');
      target?.focus();
    }
    return () => {
      previousFocus.current?.focus?.();
    };
  }, [open]);

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [onClose],
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/40 p-0 sm:items-center sm:p-4">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-describedby={description ? 'modal-desc' : undefined}
        onKeyDown={onKeyDown}
        className={`w-full overflow-y-auto bg-white p-5 shadow-xl sm:max-w-lg sm:rounded-2xl ${
          fullScreenOnMobile ? 'h-full sm:h-auto' : 'rounded-t-2xl'
        }`}
      >
        <h2 id="modal-title" className="text-base font-semibold text-ink-900">
          {title}
        </h2>
        {description ? (
          <p id="modal-desc" className="mt-1 text-xs leading-5 text-ink-500">
            {description}
          </p>
        ) : null}
        {children ? <div className="mt-4">{children}</div> : null}
        {footer ? <div className="mt-5 flex justify-end gap-2">{footer}</div> : null}
      </div>
    </div>
  );
}

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmText = '确认',
  cancelText = '取消',
  danger,
  pending,
  onConfirm,
  onCancel,
  children,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      title={title}
      description={description}
      onClose={onCancel}
      footer={
        <>
          <Button data-autofocus onClick={onCancel} disabled={pending}>
            {cancelText}
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} disabled={pending} aria-busy={pending}>
            {pending ? '处理中…' : confirmText}
          </Button>
        </>
      }
    >
      {children}
    </Modal>
  );
}
