import React, { useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';
import { Loader2 } from 'lucide-react';
import { getApiUrl } from '@/lib/utils';

const API = getApiUrl('/api');

export default function AuthCallback() {
  const hasProcessed = useRef(false);
  const navigate = useNavigate();
  const { updateUser } = useAuth();

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const hash = window.location.hash;
    const sessionId = new URLSearchParams(hash.substring(1)).get('session_id');

    if (!sessionId) {
      navigate('/', { replace: true });
      return;
    }

    const exchangeSession = async () => {
      try {
        const res = await axios.post(`${API}/auth/session`, { session_id: sessionId }, { withCredentials: true });
        updateUser(res.data);
        if (res.data.role) {
          navigate('/dashboard', { replace: true });
        } else {
          navigate('/select-role', { replace: true });
        }
      } catch (err) {
        console.error('Auth exchange failed:', err);
        navigate('/', { replace: true });
      }
    };

    exchangeSession();
  }, [navigate, updateUser]);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--sma-bg)' }}>
      <div className="flex flex-col items-center gap-4" data-testid="auth-callback-loading">
        <Loader2 className="w-10 h-10 animate-spin" style={{ color: 'var(--sma-brand)' }} />
        <p style={{ color: 'var(--sma-text-secondary)', fontFamily: 'Work Sans' }}>Signing you in securely...</p>
      </div>
    </div>
  );
}
