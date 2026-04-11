import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Shield, LayoutDashboard, Users, Bell, LogOut, Settings, Sliders } from 'lucide-react';

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
        <div className="mt-3 px-2 py-1 rounded-full text-xs font-semibold inline-block" style={{
          backgroundColor: isPractitioner ? 'var(--sma-risk-low-bg)' : 'var(--sma-risk-med-bg)',
          color: isPractitioner ? 'var(--sma-risk-low-text)' : 'var(--sma-risk-med-text)',
        }}>
          {isPractitioner ? 'Practitioner' : 'Family / Carer'}
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
