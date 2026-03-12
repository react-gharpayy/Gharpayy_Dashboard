import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, type AppRole } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children:      React.ReactNode;
  requiredRoles?: AppRole[];          // omit = any authenticated user
  redirectTo?:   string;             // default: /auth
}

const ProtectedRoute = ({
  children,
  requiredRoles,
  redirectTo = '/auth',
}: ProtectedRouteProps) => {
  const { user, role, loading, roleLoading } = useAuth();
  const location = useLocation();

  // Still resolving session
  if (loading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-7 w-7 animate-spin text-accent" />
          <p className="text-xs text-muted-foreground">Loading…</p>
        </div>
      </div>
    );
  }

  // Not authenticated → redirect to login, preserve intended path
  if (!user) {
    return (
      <Navigate
        to={redirectTo}
        state={{ from: location }}
        replace
      />
    );
  }

  // Authenticated but role check failed
  if (requiredRoles && requiredRoles.length > 0) {
    const hasAccess = role && requiredRoles.includes(role);
    if (!hasAccess) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center space-y-3 max-w-xs">
            <div className="text-4xl">🔒</div>
            <h2 className="font-display font-semibold text-foreground">
              Access Denied
            </h2>
            <p className="text-xs text-muted-foreground">
              Your account ({role ?? 'unknown role'}) does not have permission
              to view this page.
            </p>
            <p className="text-xs text-muted-foreground">
              Required: {requiredRoles.join(' or ')}
            </p>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;

// ── Usage examples (in your router) ─────────────────────────
//
// Any authenticated user:
// <ProtectedRoute><Dashboard /></ProtectedRoute>
//
// Admins and managers only:
// <ProtectedRoute requiredRoles={['admin', 'manager']}>
//   <Analytics />
// </ProtectedRoute>
//
// Admins only:
// <ProtectedRoute requiredRoles={['admin']}>
//   <UserManagement />
// </ProtectedRoute>
//
// Owners only:
// <ProtectedRoute requiredRoles={['owner']}>
//   <OwnerPortal />
// </ProtectedRoute>
