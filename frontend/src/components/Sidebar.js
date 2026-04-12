import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Shield, LayoutDashboard, Users, Bell, LogOut, Settings, Sliders, Brain, Heart, Repeat } from 'lucide-react';

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isPractitioner = user?.role === 'medical_practitioner';

  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  const links = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/patients', icon: Users, label: isPractitioner ? 'Patients' : 'My Family' },
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
        {/* Active Profile Badge */}
        <div className="mt-3 flex items-center gap-2 p-2 rounded-lg" style={{
          backgroundColor: isPractitioner ? 'var(--sma-risk-low-bg)' : 'var(--sma-risk-med-bg)',
          border: `1px solid ${isPractitioner ? 'var(--sma-risk-low-border)' : 'var(--sma-risk-med-border)'}`,
        }}>
          {isPractitioner
            ? <Brain className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--sma-risk-low-text)' }} />
            : <Heart className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--sma-risk-med-text)' }} />
          }
          <span className="text-xs font-semibold flex-1" style={{ color: isPractitioner ? 'var(--sma-risk-low-text)' : 'var(--sma-risk-med-text)' }}>
            {isPractitioner ? 'Practitioner Profile' : 'Family / Carer Profile'}
          </span>
        </div>
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
          data-testid="switch-profile-btn"
          onClick={() => navigate('/select-role')}
          className="flex items-center gap-2 w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 hover:-translate-y-0.5 cursor-pointer mb-2"
          style={{ backgroundColor: 'var(--sma-surface-alt)', color: 'var(--sma-brand)', border: '1px solid var(--sma-border)' }}
        >
          <Repeat className="w-4 h-4" />
          Switch Profile
        </button>
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
