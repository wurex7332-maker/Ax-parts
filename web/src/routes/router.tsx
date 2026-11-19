import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AdminLayout } from '../components/layout/AdminLayout';
import { MobileLayout } from '../components/layout/MobileLayout';
import { FocusOnRouteChange, useDocumentTitle } from '../hooks/useA11y';
import { AlertListPage } from '../pages/admin/alerts/AlertListPage';
import { DashboardPage } from '../pages/admin/DashboardPage';
import { MaterialFormPage } from '../pages/admin/materials/MaterialFormPage';
import { MaterialListPage } from '../pages/admin/materials/MaterialListPage';
import { NotificationPage } from '../pages/admin/notifications/NotificationPage';
import { OrderListPage } from '../pages/admin/purchase/OrderListPage';
import { RequestDetailPage } from '../pages/admin/purchase/RequestDetailPage';
import { RequestFormPage } from '../pages/admin/purchase/RequestFormPage';
import { RequestListPage } from '../pages/admin/purchase/RequestListPage';
import { ReportsPage } from '../pages/admin/reports/ReportsPage';
import { AdjustPage } from '../pages/admin/stock/AdjustPage';
import { CountPage } from '../pages/admin/stock/CountPage';
import { InboundPage } from '../pages/admin/stock/InboundPage';
import { MovementListPage } from '../pages/admin/stock/MovementListPage';
import { OutboundPage } from '../pages/admin/stock/OutboundPage';
import { StockLedgerPage } from '../pages/admin/stock/StockLedgerPage';
import { MobileApprovalDetailPage } from '../pages/mobile/MobileApprovalDetailPage';
import { MobileApprovalListPage } from '../pages/mobile/MobileApprovalListPage';
import { MobileHomePage } from '../pages/mobile/MobileHomePage';
import { MobileNotificationsPage } from '../pages/mobile/MobileNotificationsPage';
import { MobileSearchPage } from '../pages/mobile/MobileSearchPage';
import { ScanOutboundPage } from '../pages/mobile/ScanOutboundPage';
import { EmptyState } from '../components/ui/Feedback';
import { Link } from 'react-router-dom';
import { useSession } from '../state/session';
import { RequireAuth, RequireRole } from './guards';
import { LoginPage } from '../pages/LoginPage';
import { UserListPage } from '../pages/admin/users/UserListPage';
import { AuditLogPage } from '../pages/admin/audit/AuditLogPage';
import { DictionaryPage } from '../pages/admin/dictionaries/DictionaryPage';

const ADMIN_ROLES = ['warehouse', 'supervisor', 'buyer'] as const;

function IndexRedirect() {
  const user = useSession((state) => state.user);
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === 'operator' ? '/m' : '/admin/dashboard'} replace />;
}

function NotFound({ mobile }: { mobile?: boolean }) {
  const location = useLocation();
  useDocumentTitle('页面不存在');
  return (
    <div className="py-10">
      <h1 tabIndex={-1} className="text-lg font-semibold text-ink-900">
        页面不存在
      </h1>
      <p className="mt-1 text-xs text-ink-500">未找到路径 {location.pathname}</p>
      <EmptyState
        title="请从导航进入"
        description="也可返回首页重新开始。"
        action={
          <Link
            to={mobile ? '/m' : '/admin/dashboard'}
            className="mt-2 inline-flex h-10 items-center rounded-lg bg-brand-500 px-4 text-sm text-white"
          >
            返回首页
          </Link>
        }
      />
    </div>
  );
}

export function AppRoutes() {
  return (
    <>
      <FocusOnRouteChange />
      <Routes>
        <Route path="/" element={<IndexRedirect />} />
        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/admin"
          element={
            <RequireAuth>
              <RequireRole roles={[...ADMIN_ROLES]}>
                <AdminLayout />
              </RequireRole>
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="materials" element={<MaterialListPage />} />
          <Route path="materials/new" element={<MaterialFormPage />} />
          <Route path="materials/:sku/edit" element={<MaterialFormPage />} />
          <Route path="stock" element={<StockLedgerPage />} />
          <Route path="stock/inbound" element={<InboundPage />} />
          <Route path="stock/outbound" element={<OutboundPage />} />
          <Route path="stock/count" element={<CountPage />} />
          <Route path="stock/adjust" element={<AdjustPage />} />
          <Route path="stock/movements" element={<MovementListPage />} />
          <Route path="alerts" element={<AlertListPage />} />
          <Route path="purchase/requests" element={<RequestListPage />} />
          <Route path="purchase/requests/new" element={<RequestFormPage />} />
          <Route path="purchase/requests/:id" element={<RequestDetailPage />} />
          <Route path="purchase/orders" element={<OrderListPage />} />
          <Route path="reports" element={<Navigate to="/admin/reports/movements" replace />} />
          <Route path="reports/:tab" element={<ReportsPage />} />
          <Route path="notifications" element={<NotificationPage />} />
          <Route
            path="users"
            element={
              <RequireRole roles={['supervisor']}>
                <UserListPage />
              </RequireRole>
            }
          />
          <Route
            path="audit"
            element={
              <RequireRole roles={['supervisor']}>
                <AuditLogPage />
              </RequireRole>
            }
          />
          <Route
            path="dictionaries"
            element={
              <RequireRole roles={['supervisor']}>
                <DictionaryPage />
              </RequireRole>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Route>

        <Route
          path="/m"
          element={
            <RequireAuth>
              <RequireRole roles={['operator', 'supervisor']}>
                <MobileLayout />
              </RequireRole>
            </RequireAuth>
          }
        >
          <Route index element={<MobileHomePage />} />
          <Route path="scan" element={<ScanOutboundPage />} />
          <Route path="search" element={<MobileSearchPage />} />
          <Route
            path="approvals"
            element={
              <RequireRole roles={['supervisor']}>
                <MobileApprovalListPage />
              </RequireRole>
            }
          />
          <Route
            path="approvals/:id"
            element={
              <RequireRole roles={['supervisor']}>
                <MobileApprovalDetailPage />
              </RequireRole>
            }
          />
          <Route path="notifications" element={<MobileNotificationsPage />} />
          <Route path="*" element={<NotFound mobile />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}
