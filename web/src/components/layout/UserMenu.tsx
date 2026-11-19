import { useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { roleLabelOf, useSession } from '../../state/session';
import { Badge } from '../ui/Feedback';

/** 顶栏身份区：显示当前登录人与角色，提供退出登录。 */
export function UserMenu({ compact = false }: { compact?: boolean }) {
  const user = useSession((state) => state.user);
  const clear = useSession((state) => state.clear);
  const navigate = useNavigate();

  if (!user) return null;

  const onLogout = async () => {
    try {
      await api.auth.logout();
    } catch {
      // 登出失败不影响本地清理
    }
    clear();
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex items-center gap-2">
      <span className={`text-xs text-ink-700 ${compact ? 'sr-only' : ''}`}>
        {user.displayName}
      </span>
      <Badge tone="brand">{roleLabelOf(user.role)}</Badge>
      <button
        type="button"
        onClick={onLogout}
        className="tap-target rounded-lg border border-line bg-white px-2 text-xs text-ink-600 hover:bg-slate-50"
      >
        退出
      </button>
    </div>
  );
}
