import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Brain, Heart, Shield } from 'lucide-react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function RoleSelection() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);

  const roles = [
    {
      id: 'medical_practitioner',
      icon: Brain,
      title: 'Medical Practitioner',
      desc: 'GP, pharmacist, nurse practitioner, care coordinator, or discharge support clinician',
      color: 'var(--sma-brand)',
      bg: 'var(--sma-risk-low-bg)',
    },
    {
      id: 'family_carer',
      icon: Heart,
      title: 'Family Member / Carer',
      desc: 'Adult child, spouse, informal carer, or home support person',
      color: 'var(--sma-accent)',
      bg: 'var(--sma-risk-med-bg)',
    },
  ];

  const handleConfirm = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await axios.put(`${API}/users/role`, { role: selected }, { withCredentials: true });
      updateUser(res.data);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      console.error('Role update failed:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: 'var(--sma-bg)' }}>
      <div className="max-w-xl w-full animate-fade-in">
        <div className="text-center mb-8">
          <Shield className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--sma-brand)' }} />
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-2" style={{ fontFamily: 'Outfit', color: 'var(--sma-text-primary)' }}>
            Welcome, {user?.name?.split(' ')[0]}
          </h1>
          <p className="text-base" style={{ color: 'var(--sma-text-secondary)' }}>
            Select how you will be using SafeMedAI
          </p>
        </div>
        <div className="space-y-4 mb-8">
          {roles.map((role) => (
            <button
              key={role.id}
              data-testid={`role-${role.id}-btn`}
              onClick={() => setSelected(role.id)}
              className="w-full p-6 rounded-xl text-left transition-all duration-200 hover:-translate-y-0.5 cursor-pointer"
              style={{
                backgroundColor: selected === role.id ? role.bg : 'var(--sma-surface)',
                border: selected === role.id ? `2px solid ${role.color}` : '1px solid var(--sma-border)',
              }}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: role.bg }}>
                  <role.icon className="w-6 h-6" style={{ color: role.color }} />
                </div>
                <div>
                  <h3 className="text-lg font-medium" style={{ fontFamily: 'Outfit', color: 'var(--sma-text-primary)' }}>{role.title}</h3>
                  <p className="text-sm mt-1" style={{ color: 'var(--sma-text-secondary)' }}>{role.desc}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
        <Button
          data-testid="confirm-role-btn"
          onClick={handleConfirm}
          disabled={!selected || saving}
          className="w-full h-14 text-lg rounded-full font-medium transition-all duration-200"
          style={{
            backgroundColor: selected ? 'var(--sma-brand)' : 'var(--sma-border)',
            color: selected ? 'var(--sma-text-inverse)' : 'var(--sma-text-muted)',
          }}
        >
          {saving ? 'Setting up...' : 'Continue'}
        </Button>
      </div>
    </div>
  );
}
