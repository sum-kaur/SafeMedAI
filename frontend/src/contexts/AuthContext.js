import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import axios from 'axios';
import { getApiUrl } from '../lib/utils';

const AuthContext = createContext(null);
const AUTH_STORAGE_KEY = 'safemed_session_token';

function setAuthToken(token) {
  if (token) {
    window.localStorage.setItem(AUTH_STORAGE_KEY, token);
    axios.defaults.headers.common.Authorization = `Bearer ${token}`;
    return;
  }

  window.localStorage.removeItem(AUTH_STORAGE_KEY);
  delete axios.defaults.headers.common.Authorization;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const res = await axios.get(getApiUrl('/api/auth/me'), { withCredentials: true });
      setUser(res.data);
    } catch {
      setAuthToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const storedToken = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (storedToken) {
      axios.defaults.headers.common.Authorization = `Bearer ${storedToken}`;
    }

    // CRITICAL: If returning from OAuth callback, skip the /me check.
    // AuthCallback will exchange the session_id and establish the session first.
    if (window.location.hash?.includes('session_id=')) {
      setLoading(false);
      return;
    }
    checkAuth();
  }, [checkAuth]);

  const login = async (role = 'medical_practitioner') => {
    const res = await axios.post(getApiUrl('/api/auth/demo-login'), { role }, { withCredentials: true });
    if (res.data?.session_token) {
      setAuthToken(res.data.session_token);
    }
    const nextUser = res.data?.user || res.data;
    setUser(nextUser);
    return nextUser;
  };

  const logout = async () => {
    try {
      await axios.post(getApiUrl('/api/auth/logout'), {}, { withCredentials: true });
    } catch {}
    setAuthToken(null);
    setUser(null);
  };

  const updateUser = (data) => setUser(data);

  const demoLogin = async (role) => {
    try {
      const res = await axios.post(getApiUrl('/api/auth/demo-login'), { role }, { withCredentials: true });
      if (res.data?.session_token) {
        setAuthToken(res.data.session_token);
      }
      const nextUser = res.data?.user || res.data;
      setUser(nextUser);
      return nextUser;
    } catch (err) {
      console.error('Demo login failed:', err);
      throw err;
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, checkAuth, updateUser, demoLogin }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
