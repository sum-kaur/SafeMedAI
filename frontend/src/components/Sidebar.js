import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Shield, LayoutDashboard, Users, Bell, LogOut, Settings, Sliders, ArrowLeftRight, Loader2, Brain, Heart } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Sidebar() {
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();
  const [switching, setSwitching] = useState(false);
  const isPractitioner = user?.role === 'medical_practitioner';

  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  const handleSwitchRole = async () => {
    const newRole = isPractitioner ? 'family_carer' : 'medical_practitioner';
    setSwitching(true);
    try {
      const res = await axios.put(`${API}/users/role`, { role: newRole }, { withCredentials: true });
      updateUser(res.data);
      toast.success(`Switched to ${newRole === 'medical_practitioner' ? 'Practitioner' : 'Family / Carer'} portal`);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      toast.error('Failed to switch portal');
    } finally {
      setSwitching(false);
    }
  };

  const links = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/patients', icon: Users, label: isPractitioner ? 'Patients' : 'My Patients' },
    { to: '/alerts', icon: Bell, label: 'Alerts' },
    ...(isPractitioner ? [{ to: '/admin', icon: Sliders, label: 'Scoring Config' }] : []),
    { to: '/settings', icon: Settings, label: 'Settings' },
  ];

  const linkClass = (isActive) =>
    `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
      isActive ? '' : 'hover:-translate-y-0.5'
    }`;

  return (
    <aside className="w-64 min-h-screen flex flex-col border-r" style={{ backgroundColor: 'var(--sma-surface)', borderColor: 'var(--sma-border)' }} data-testid="sidebar">
      <div className="p-6 border-b" style={{ borderColor: 'var(--sma-border)' }}>
        <div className="flex items-center gap-2" data-testid="sidebar-logo">
          <Shield className="w-7 h-7" style={{ color: 'var(--sma-brand)' }} />
          <span className="text-xl font-semibold" style={{ fontFamily: 'Outfit', color: 'var(--sma-text-primary)' }}>SafeMedAI</span>
        </div>
        {/* Portal Toggle */}
        <button
          data-testid="switch-portal-btn"
          onClick={handleSwitchRole}
          disabled={switching}
          className="mt-3 w-full flex items-center justify-between p-2.5 rounded-lg transition-all duration-200 hover:-translate-y-0.5 cursor-pointer"
          style={{
            backgroundColor: isPractitioner ? 'var(--sma-risk-low-bg)' : 'var(--sma-risk-med-bg)',
            border: `1px solid ${isPractitioner ? 'var(--sma-risk-low-border)' : 'var(--sma-risk-med-border)'}`,
          }}
        >
          <div className="flex items-center gap-2">
            {isPractitioner
              ? <Brain className="w-4 h-4" style={{ color: 'var(--sma-risk-low-text)' }} />
              : <Heart className="w-4 h-4" style={{ color: 'var(--sma-risk-med-text)' }} />
            }
            <span className="text-xs font-semibold" style={{ color: isPractitioner ? 'var(--sma-risk-low-text)' : 'var(--sma-risk-med-text)' }}>
              {isPractitioner ? 'Practitioner' : 'Family / Carer'}
            </span>
          </div>
          {switching
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: isPractitioner ? 'var(--sma-risk-low-text)' : 'var(--sma-risk-med-text)' }} />
            : <ArrowLeftRight className="w-3.5 h-3.5" style={{ color: isPractitioner ? 'var(--sma-risk-low-text)' : 'var(--sma-risk-med-text)' }} />
          }
        </button>
        <p className="text-[10px] mt-1.5 text-center" style={{ color: 'var(--sma-text-muted)' }}>
          Click to switch to {isPractitioner ? 'Family / Carer' : 'Practitioner'} portal
        </p>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            data-testid={`nav-${link.label.toLowerCase().replace(/[^a-z]/g, '-')}`}
            className={({ isActive }) => linkClass(isActive)}
            style={({ isActive }) => ({
              backgroundColor: isActive ? 'var(--sma-risk-low-bg)' : 'transparent',
              color: isActive ? 'var(--sma-brand)' : 'var(--sma-text-secondary)',
            })}
          >
            <link.icon className="w-5 h-5" />
            {link.label}
          </NavLink>
        ))}
      </nav>
      <div className="p-4 border-t" style={{ borderColor: 'var(--sma-border)' }}>
        <div className="flex items-center gap-3 px-2 mb-3">
          {user?.picture ? (
            <img src={user.picture} alt="" className="w-8 h-8 rounded-full" />
          ) : (
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--sma-brand)' }}>
              <span className="text-sm font-medium text-white">{user?.name?.[0]}</span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate" style={{ color: 'var(--sma-text-primary)' }}>{user?.name}</p>
            <p className="text-xs truncate" style={{ color: 'var(--sma-text-muted)' }}>{user?.email}</p>
          </div>
        </div>
        <button
          data-testid="logout-btn"
          onClick={handleLogout}
          className="flex items-center gap-2 w-full px-4 py-2 rounded-lg text-sm transition-all duration-200 hover:bg-red-50 cursor-pointer"
          style={{ color: 'var(--sma-risk-high-text)' }}
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
