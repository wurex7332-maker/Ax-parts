import { ROLES, useSession, type Role } from '../../state/session';
import { Select } from '../ui/Select';

export function RoleSwitch({ compact = false }: { compact?: boolean }) {
  const role = useSession((state) => state.role);
  const setRole = useSession((state) => state.setRole);

  return (
    <div className="flex items-center gap-2">
      {!compact ? (
        <label htmlFor="role-switch" className="text-xs text-ink-500">
          演示视角
        </label>
      ) : null}
      <div className="w-[104px]">
        <Select
          id="role-switch"
          value={role}
          onChange={(event) => setRole(event.target.value as Role)}
          className="tap-target px-2 text-xs"
          aria-describedby="role-switch-hint"
          options={ROLES.map((item) => ({ value: item.value, label: item.label }))}
        />
      </div>
      <span id="role-switch-hint" className="sr-only">
        角色切换仅影响页面入口可见性；后端不做鉴权，不构成安全边界。
      </span>
    </div>
  );
}
