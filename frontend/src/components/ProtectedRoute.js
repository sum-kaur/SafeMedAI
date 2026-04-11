import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

export default function ProtectedRoute({ children, requireRole = false }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (!loading && !user) {
      navigate('/', { replace: true });
    }
    if (!loading && user && requireRole && !user.role) {
      navigate('/select-role', { replace: true });
    }
  }, [loading, user, requireRole, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--sma-bg)' }}>
        <div className="flex flex-col items-center gap-4" data-testid="loading-spinner">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--sma-brand)' }} />
          <p className="text-sm" style={{ color: 'var(--sma-text-muted)' }}>Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;
  if (requireRole && !user.role) return null;

  return children;
}
