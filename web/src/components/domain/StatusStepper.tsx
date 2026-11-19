import { REQUEST_STATUSES } from '../../domain/enums';
import { STEPPER_STEPS, stepperIndex } from '../../domain/purchase';
import type { RequestStatus } from '../../domain/types';

/**
 * 采购状态步骤条。5 个节点，其中「已到货」为后端事务内瞬时态（到货即完成），
 * COMPLETED 时第 4、5 节点同时视为达成（PRD §2.3）。
 */
export function StatusStepper({ status, rejected }: { status: RequestStatus; rejected?: boolean }) {
  const reached = stepperIndex(status);
  const total = STEPPER_STEPS.length;

  return (
    <div>
      <ol className="flex flex-wrap items-start gap-y-2" aria-label="采购申请状态进度">
        {STEPPER_STEPS.map((step, index) => {
          const done = index < reached;
          const current = index === reached && status !== 'COMPLETED';
          const state = done ? '已完成' : current ? '进行中' : '未开始';
          return (
            <li key={step.status} className="flex min-w-[104px] flex-1 flex-col gap-1">
              <div className="flex items-center">
                <span
                  aria-hidden="true"
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold ${
                    done
                      ? 'border-normal-fg bg-normal-fg text-white'
                      : current
                        ? 'border-brand-500 bg-brand-50 text-brand-700'
                        : 'border-line bg-white text-ink-400'
                  }`}
                >
                  {done ? '✓' : index + 1}
                </span>
                {index < total - 1 ? (
                  <span aria-hidden="true" className={`ml-1 h-0.5 flex-1 ${done ? 'bg-normal-fg' : 'bg-line'}`} />
                ) : null}
              </div>
              <div>
                <p className={`text-xs ${current ? 'font-semibold text-brand-700' : 'text-ink-700'}`}>
                  {step.label}
                  <span className="sr-only">（{state}）</span>
                </p>
                {step.note ? <p className="text-[10px] leading-3 text-ink-400">{step.note}</p> : null}
              </div>
            </li>
          );
        })}
      </ol>
      <p className="mt-1 text-[11px] text-ink-400">
        当前：{REQUEST_STATUSES.find((s) => s.value === status)?.label ?? status}
        {rejected ? '｜已驳回，状态退回待审批' : ''}
      </p>
    </div>
  );
}
