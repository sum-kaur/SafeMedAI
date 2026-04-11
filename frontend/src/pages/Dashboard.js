import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import Sidebar from '@/components/Sidebar';
import { Button } from '@/components/ui/button';
import { Users, FileText, AlertTriangle, Bell, ArrowRight, Plus, CheckCircle, Loader2, Shield } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const isPractitioner = user?.role === 'medical_practitioner';

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await axios.get(`${API}/dashboard/stats`, { withCredentials: true });
      setStats(res.data);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await axios.post(`${API}/seed`, {}, { withCredentials: true });
      toast.success('Demo data loaded successfully');
      fetchStats();
    } catch (err) {
      toast.error('Failed to load demo data');
    } finally {
      setSeeding(false);
    }
  };

  const riskColor = (level) => ({
    high: { bg: 'var(--sma-risk-high-bg)', border: 'var(--sma-risk-high-border)', text: 'var(--sma-risk-high-text)' },
    medium: { bg: 'var(--sma-risk-med-bg)', border: 'var(--sma-risk-med-border)', text: 'var(--sma-risk-med-text)' },
    low: { bg: 'var(--sma-risk-low-bg)', border: 'var(--sma-risk-low-border)', text: 'var(--sma-risk-low-text)' },
  }[level] || { bg: 'var(--sma-surface-alt)', border: 'var(--sma-border)', text: 'var(--sma-text-secondary)' });

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: 'var(--sma-bg)' }}>
      <Sidebar />
      <main className="flex-1 p-8" data-testid="dashboard-main">
        <div className="max-w-6xl mx-auto animate-fade-in">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight" style={{ fontFamily: 'Outfit', color: 'var(--sma-text-primary)' }}>
                {isPractitioner ? 'Practitioner Dashboard' : 'Family Dashboard'}
              </h1>
              <p className="text-base mt-1" style={{ color: 'var(--sma-text-secondary)' }}>
                Welcome back, {user?.name?.split(' ')[0]}
              </p>
            </div>
            <div className="flex gap-3">
              {stats?.total_patients === 0 && (
                <Button
                  data-testid="seed-demo-btn"
                  onClick={handleSeed}
                  disabled={seeding}
                  className="h-11 px-5 rounded-full font-medium transition-all duration-200"
                  style={{ backgroundColor: 'var(--sma-accent)', color: 'var(--sma-text-inverse)' }}
                >
                  {seeding ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading Demo...</> : 'Load Demo Data'}
                </Button>
              )}
              <Button
                data-testid="add-patient-btn"
                onClick={() => navigate('/patients')}
                className="h-11 px-5 rounded-full font-medium transition-all duration-200 hover:-translate-y-0.5"
                style={{ backgroundColor: 'var(--sma-brand)', color: 'var(--sma-text-inverse)' }}
              >
                <Plus className="w-4 h-4 mr-2" /> New Patient
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--sma-brand)' }} /></div>
          ) : (
            <>
              {/* Stats Grid */}
              <div className={`grid gap-6 mb-8 ${isPractitioner ? 'grid-cols-1 md:grid-cols-3 lg:grid-cols-4' : 'grid-cols-1 md:grid-cols-2'}`}>
                <StatCard icon={Users} label="Patients" value={stats?.total_patients || 0} color="var(--sma-brand)" />
                <StatCard icon={FileText} label="Documents" value={stats?.total_documents || 0} color="var(--sma-brand)" />
                <StatCard icon={AlertTriangle} label="High Risk" value={stats?.high_risk || 0} color="var(--sma-risk-high-text)" accent="var(--sma-risk-high-bg)" />
                {isPractitioner && (
                  <StatCard icon={Bell} label="Unread Alerts" value={stats?.unread_alerts || 0} color="var(--sma-risk-med-text)" accent="var(--sma-risk-med-bg)" />
                )}
              </div>

              {/* Risk Summary */}
              <div className="grid gap-6 mb-8 grid-cols-1 md:grid-cols-3">
                {['low', 'medium', 'high'].map((level) => {
                  const c = riskColor(level);
                  const count = stats?.[`${level}_risk`] || 0;
                  return (
                    <div key={level} className="p-6 rounded-xl" style={{ backgroundColor: c.bg, border: `1px solid ${c.border}` }} data-testid={`risk-summary-${level}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm uppercase tracking-[0.15em] font-semibold" style={{ color: c.text }}>{level} Risk</p>
                          <p className="text-3xl font-semibold mt-1" style={{ fontFamily: 'Outfit', color: c.text }}>{count}</p>
                        </div>
                        {level === 'high' && <AlertTriangle className="w-8 h-8" style={{ color: c.text }} />}
                        {level === 'medium' && <Shield className="w-8 h-8" style={{ color: c.text }} />}
                        {level === 'low' && <CheckCircle className="w-8 h-8" style={{ color: c.text }} />}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Recent Patients */}
              {stats?.recent_patients?.length > 0 && (
                <div className="rounded-xl shadow-sm p-6" style={{ backgroundColor: 'var(--sma-surface)', border: '1px solid var(--sma-border)' }}>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-medium" style={{ fontFamily: 'Outfit', color: 'var(--sma-text-primary)' }}>Recent Patients</h2>
                    <Button data-testid="view-all-patients-btn" variant="ghost" onClick={() => navigate('/patients')} className="text-sm" style={{ color: 'var(--sma-brand)' }}>
                      View All <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {stats.recent_patients.map((p) => (
                      <button
                        key={p.patient_id}
                        data-testid={`patient-card-${p.patient_id}`}
                        onClick={() => navigate(`/patients/${p.patient_id}`)}
                        className="w-full flex items-center justify-between p-4 rounded-lg transition-all duration-200 hover:-translate-y-0.5 cursor-pointer text-left"
                        style={{ backgroundColor: 'var(--sma-surface-alt)', border: '1px solid var(--sma-border)' }}
                      >
                        <div>
                          <p className="font-medium" style={{ color: 'var(--sma-text-primary)' }}>{p.name}</p>
                          <p className="text-sm" style={{ color: 'var(--sma-text-muted)' }}>DOB: {p.dob || 'Not set'}</p>
                        </div>
                        <ArrowRight className="w-5 h-5" style={{ color: 'var(--sma-text-muted)' }} />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {stats?.total_patients === 0 && (
                <div className="text-center py-16 rounded-xl" style={{ backgroundColor: 'var(--sma-surface)', border: '1px solid var(--sma-border)' }}>
                  <Users className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--sma-text-muted)' }} />
                  <h3 className="text-xl font-medium mb-2" style={{ fontFamily: 'Outfit', color: 'var(--sma-text-primary)' }}>No patients yet</h3>
                  <p className="mb-4" style={{ color: 'var(--sma-text-secondary)' }}>Add a patient or load demo data to get started</p>
                </div>
              )}

              {/* Disclaimer */}
              <div className="mt-8 p-4 rounded-lg text-xs text-center" style={{ backgroundColor: 'var(--sma-surface-alt)', color: 'var(--sma-text-muted)' }} data-testid="dashboard-disclaimer">
                This tool provides decision support only and does not replace professional medical judgment.
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color, accent }) {
  return (
    <div className="p-6 rounded-xl shadow-sm" style={{ backgroundColor: accent || 'var(--sma-surface)', border: '1px solid var(--sma-border)' }} data-testid={`stat-${label.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="flex items-center gap-3 mb-2">
        <Icon className="w-5 h-5" style={{ color }} />
        <p className="text-sm font-medium" style={{ color: 'var(--sma-text-secondary)' }}>{label}</p>
      </div>
      <p className="text-3xl font-semibold" style={{ fontFamily: 'Outfit', color }}>{value}</p>
    </div>
  );
}
