import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LayoutDashboard, Users, Bell, LogOut, Settings, Sliders, Brain, Heart, Repeat } from 'lucide-react';

function PillLogo({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="sb-redHalf" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#EF4444" /><stop offset="100%" stopColor="#DC2626" />
        </linearGradient>
        <linearGradient id="sb-blueHalf" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3B82F6" /><stop offset="100%" stopColor="#2563EB" />
        </linearGradient>
        <linearGradient id="sb-tabletGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#60A5FA" /><stop offset="100%" stopColor="#2563EB" />
        </linearGradient>
        <filter id="sb-pillShadow" x="-10%" y="-10%" width="120%" height="130%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#1E3A5F" floodOpacity="0.3" />
        </filter>
      </defs>
      <g transform="translate(32, 28) rotate(-35)" filter="url(#sb-pillShadow)">
        <path d="M-18,-7 L0,-7 L0,7 L-18,7 C-21.87,7 -25,3.87 -25,0 C-25,-3.87 -21.87,-7 -18,-7 Z" fill="url(#sb-redHalf)" />
        <path d="M0,-7 L18,-7 C21.87,-7 25,-3.87 25,0 C25,3.87 21.87,7 18,7 L0,7 Z" fill="url(#sb-blueHalf)" />
        <line x1="0" y1="-7" x2="0" y2="7" stroke="white" strokeWidth="0.8" opacity="0.5" />
        <ellipse cx="-12" cy="-3" rx="8" ry="2.5" fill="white" opacity="0.25" transform="rotate(-5)" />
        <ellipse cx="12" cy="-3" rx="8" ry="2.5" fill="white" opacity="0.2" transform="rotate(-5)" />
      </g>
      <g transform="translate(44, 46)">
        <circle cx="0" cy="0" r="10" fill="url(#sb-tabletGrad)" />
        <circle cx="0" cy="0" r="9" fill="none" stroke="white" strokeWidth="0.6" opacity="0.3" />
        <line x1="-6" y1="0" x2="6" y2="0" stroke="white" strokeWidth="1.2" opacity="0.5" strokeLinecap="round" />
        <ellipse cx="-2" cy="-4" rx="5" ry="3" fill="white" opacity="0.2" transform="rotate(-15)" />
      </g>
      <g transform="translate(14, 50)">
        <circle cx="0" cy="0" r="6" fill="#EF4444" />
        <circle cx="0" cy="0" r="5.3" fill="none" stroke="white" strokeWidth="0.5" opacity="0.3" />
      </g>
    </svg>
  );
}

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
    { to: '/alerts', icon: Bell, label: 'Tasks' },
    ...(isPractitioner ? [{ to: '/admin', icon: Sliders, label: 'Scoring Config' }] : []),
    { to: '/settings', icon: Settings, label: 'Settings' },
  ];

  const linkStyle = (isActive) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '9px 12px',
    borderRadius: '8px',
    border: isActive ? '1px solid var(--sma-border)' : '1px solid transparent',
    boxShadow: isActive ? '0 8px 20px rgba(31,36,33,0.045)' : 'none',
    backgroundColor: isActive ? 'var(--sma-surface)' : 'transparent',
    color: isActive ? 'var(--sma-brand)' : 'var(--sma-text-secondary)',
    fontSize: '13px',
    fontWeight: isActive ? '600' : '500',
    transition: 'background-color 0.15s, color 0.15s, box-shadow 0.15s',
    textDecoration: 'none',
  });

  return (
    <aside className="w-64 min-h-screen flex flex-col border-r" style={{ backgroundColor: '#FBFAF7', borderColor: 'var(--sma-border)' }} data-testid="sidebar">
      <div className="p-5 border-b" style={{ borderColor: 'var(--sma-border)' }}>
        <div className="flex items-center gap-3" data-testid="sidebar-logo">
          <PillLogo size={40} />
          <span className="text-xl font-semibold" style={{ fontFamily: 'Outfit', color: 'var(--sma-text-primary)' }}>SafeMedAI</span>
        </div>
        {/* Role badge — neutral colours, no risk-colour borrowing */}
        <div className="mt-4 flex items-center gap-2 p-2 rounded-lg" style={{
          backgroundColor: 'var(--sma-surface)',
          border: '1px solid var(--sma-border)',
        }}>
          {isPractitioner
            ? <Brain className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--sma-brand)' }} />
            : <Heart className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--sma-accent)' }} />
          }
          <span className="text-xs font-medium flex-1" style={{ color: 'var(--sma-text-secondary)' }}>
            {isPractitioner ? 'Practitioner' : 'Family / Carer'}
          </span>
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-1.5">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            data-testid={`nav-${link.label.toLowerCase().replace(/[^a-z]/g, '-')}`}
            style={({ isActive }) => linkStyle(isActive)}
            onMouseEnter={(e) => {
              if (!e.currentTarget.getAttribute('aria-current')) {
                e.currentTarget.style.backgroundColor = 'var(--sma-surface)';
                e.currentTarget.style.color = 'var(--sma-text-primary)';
              }
            }}
            onMouseLeave={(e) => {
              if (!e.currentTarget.getAttribute('aria-current')) {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'var(--sma-text-secondary)';
              }
            }}
          >
            <link.icon className="w-4 h-4 flex-shrink-0" />
            {link.label}
          </NavLink>
        ))}
      </nav>
      <div className="p-4 border-t" style={{ borderColor: 'var(--sma-border)' }}>
        <div className="flex items-center gap-3 px-1 mb-3">
          {user?.picture ? (
            <img src={user.picture} alt="" className="w-8 h-8 rounded-full" />
          ) : (
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--sma-brand)' }}>
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
          className="flex items-center gap-2 w-full px-4 py-2.5 rounded-lg text-sm font-medium cursor-pointer mb-1.5 transition-colors duration-150"
          style={{ backgroundColor: 'var(--sma-surface-alt)', color: 'var(--sma-brand)', border: '1px solid var(--sma-border)' }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--sma-border)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--sma-surface-alt)'; }}
        >
          <Repeat className="w-4 h-4" />
          Switch Profile
        </button>
        <button
          data-testid="logout-btn"
          onClick={handleLogout}
          className="flex items-center gap-2 w-full px-4 py-2 rounded-lg text-sm cursor-pointer transition-colors duration-150"
          style={{ color: 'var(--sma-risk-high-text)' }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--sma-risk-high-bg)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
