import { Navigate, Outlet, useLocation } from 'react-router';
import { Loader2Icon } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export function ProtectedRoute() {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <Loader2Icon
          className="size-8 animate-spin text-muted-foreground"
          aria-hidden
        />
        <span className="sr-only">Loading session…</span>
      </div>
    );
  }

  if (!session) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }

  return <Outlet />;
}
