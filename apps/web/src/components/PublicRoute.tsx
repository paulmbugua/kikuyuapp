// src/components/PublicRoute.tsx
import { Navigate } from '@/lib/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface PublicRouteProps {
  children: React.ReactNode;
}

const PublicRoute = ({ children }: PublicRouteProps) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
        <div className="text-center space-y-4">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 bg-gradient-to-r from-primary to-accent rounded-full animate-pulse" />
            </div>
          </div>
          <p className="text-sm text-muted-foreground animate-pulse">Checking authentication...</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/feed" replace />;
  }

  return <>{children}</>;
};

export default PublicRoute;