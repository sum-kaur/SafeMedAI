import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Brain, Heart, Shield, CheckCircle, ArrowLeft, Loader2 } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function RoleSelection() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const hasExistingRole = !!user?.role;
  const currentRole = user?.role;

  const roles = [
    {
      id: 'medical_practitioner',
      icon: Brain,
      title: 'Medical Practitioner',
      desc: 'GP, pharmacist, nurse practitioner, care coordinator, or discharge support clinician',
      features: [
        'Clinical risk scoring with ACB / DBI / Sedative Load analysis',
        'Detailed medication extraction and scoring breakdown',
        'Clinical Q&A grounded in patient documents',
        'Patient management, scoring engine configuration',
      ],
      color: 'var(--sma-brand)',
      bg: 'var(--sma-risk-low-bg)',
      border: 'var(--sma-risk-low-border)',
      textColor: 'var(--sma-risk-low-text)',
    },
    {
      id: 'family_carer',
      icon: Heart,
      title: 'Family Member / Carer',
      desc: 'Adult child, spouse, informal carer, or home support person',
      features: [
        'Plain-language risk explanations',
        'Safe escalation guidance and next steps',
        'Questions to ask the doctor or pharmacist',
        'Contact information and action prompts',
      ],
      color: 'var(--sma-accent)',
      bg: 'var(--sma-risk-med-bg)',
      border: 'var(--sma-risk-med-border)',
      textColor: 'var(--sma-risk-med-text)',
    },
  ];

  const handleSelect = async (roleId) => {
    if (roleId === currentRole) {
      navigate('/dashboard', { replace: true });
      return;
    }
    setSaving(true);
    try {
      const res = await axios.put(`${API}/users/role`, { role: roleId }, { withCredentials: true });
      updateUser(res.data);
      const label = roleId === 'medical_practitioner' ? 'Practitioner' : 'Family / Carer';
      toast.success(`Switched to ${label} profile`);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      toast.error('Failed to switch profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: 'var(--sma-bg)' }}>
      <div className="max-w-2xl w-full animate-fade-in">
        {/* Header */}
        <div className="text-center mb-8">
          <Shield className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--sma-brand)' }} />
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-2" style={{ fontFamily: 'Outfit', color: 'var(--sma-text-primary)' }}>
            {hasExistingRole ? 'Switch Profile' : `Welcome, ${user?.name?.split(' ')[0]}`}
          </h1>
          <p className="text-base" style={{ color: 'var(--sma-text-secondary)' }}>
            {hasExistingRole
              ? 'Choose which profile to use. Your data is kept separate between profiles.'
              : 'Choose how you will be using SafeMedAI'
            }
          </p>
        </div>

        {/* Role Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
          {roles.map((role) => {
            const isActive = currentRole === role.id;
            return (
              <button
                key={role.id}
                data-testid={`role-${role.id}-btn`}
                onClick={() => handleSelect(role.id)}
                disabled={saving}
                className="w-full p-6 rounded-xl text-left transition-all duration-200 hover:-translate-y-1 cursor-pointer relative"
                style={{
                  backgroundColor: isActive ? role.bg : 'var(--sma-surface)',
                  border: isActive ? `2px solid ${role.border}` : '1px solid var(--sma-border)',
                }}
              >
                {isActive && (
                  <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ backgroundColor: role.color }}>
                    <CheckCircle className="w-3 h-3 text-white" />
                    <span className="text-[10px] font-bold text-white uppercase">Active</span>
                  </div>
                )}
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: role.bg }}>
                  <role.icon className="w-6 h-6" style={{ color: role.color }} />
                </div>
                <h3 className="text-lg font-semibold mb-1" style={{ fontFamily: 'Outfit', color: 'var(--sma-text-primary)' }}>
                  {role.title}
                </h3>
                <p className="text-xs mb-4" style={{ color: 'var(--sma-text-muted)' }}>{role.desc}</p>
                <ul className="space-y-2">
                  {role.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs" style={{ color: 'var(--sma-text-secondary)' }}>
                      <CheckCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: role.color }} />
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-5 w-full h-10 rounded-lg flex items-center justify-center font-medium text-sm transition-all" style={{
                  backgroundColor: isActive ? role.color : 'var(--sma-surface-alt)',
                  color: isActive ? 'white' : role.color,
                  border: isActive ? 'none' : `1px solid ${role.border}`,
                }}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : isActive ? 'Currently Active' : `Use ${role.title.split(' ')[0]} Profile`}
                </div>
              </button>
            );
          })}
        </div>

        {/* Back to Dashboard */}
        {hasExistingRole && (
          <Button
            data-testid="back-to-dashboard-btn"
            onClick={() => navigate('/dashboard', { replace: true })}
            variant="ghost"
            className="w-full h-11 rounded-full font-medium"
            style={{ color: 'var(--sma-text-secondary)' }}
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
          </Button>
        )}

        <p className="mt-6 text-xs text-center" style={{ color: 'var(--sma-text-muted)' }}>
          Both profiles use the same Google account ({user?.email}). Patient data you create under each profile is accessible when you switch back.
        </p>
      </div>
    </div>
  );
}
