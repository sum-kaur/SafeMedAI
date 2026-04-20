import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '@/components/Sidebar';
import { Button } from '@/components/ui/button';
import { Bell, AlertTriangle, Shield, CheckCircle, Check, Loader2, ArrowRight } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { getApiUrl } from '@/lib/utils';

export default function AlertsPage() {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchAlerts(); }, []);

  const fetchAlerts = async () => {
    try {
      const res = await axios.get(`${getApiUrl('/api/')}alerts`, { withCredentials: true });
      setAlerts(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const markRead = async (alertId) => {
    try {
      await axios.put(`${getApiUrl('/api/')}alerts/${alertId}/read`, {}, { withCredentials: true });
      setAlerts(prev => prev.map(a => a.alert_id === alertId ? { ...a, read: true } : a));
    } catch (err) {
      toast.error('Failed to mark alert');
    }
  };

  const alertStyle = (severity) => ({
    high: { bg: 'var(--sma-risk-high-bg)', border: 'var(--sma-risk-high-border)', text: 'var(--sma-risk-high-text)', icon: AlertTriangle },
    medium: { bg: 'var(--sma-risk-med-bg)', border: 'var(--sma-risk-med-border)', text: 'var(--sma-risk-med-text)', icon: Shield },
    low: { bg: 'var(--sma-risk-low-bg)', border: 'var(--sma-risk-low-border)', text: 'var(--sma-risk-low-text)', icon: CheckCircle },
  }[severity] || { bg: 'var(--sma-surface-alt)', border: 'var(--sma-border)', text: 'var(--sma-text-secondary)', icon: Bell });

  const unread = alerts.filter(a => !a.read);
  const read = alerts.filter(a => a.read);

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: 'var(--sma-bg)' }}>
      <Sidebar />
      <main className="flex-1 p-8" data-testid="alerts-page">
        <div className="max-w-4xl mx-auto animate-fade-in">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight" style={{ fontFamily: 'Outfit', color: 'var(--sma-text-primary)' }}>Tasks</h1>
              <p className="text-sm mt-1" style={{ color: 'var(--sma-text-muted)' }}>{unread.length} item{unread.length !== 1 ? 's' : ''} need review</p>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--sma-brand)' }} /></div>
          ) : alerts.length === 0 ? (
            <div className="text-center py-16 rounded-xl" style={{ backgroundColor: 'var(--sma-surface)', border: '1px solid var(--sma-border)' }}>
              <Bell className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--sma-text-muted)' }} />
              <h3 className="text-xl font-medium mb-2" style={{ fontFamily: 'Outfit', color: 'var(--sma-text-primary)' }}>No tasks</h3>
              <p style={{ color: 'var(--sma-text-secondary)' }}>Risk review items will appear here after assessments are completed</p>
            </div>
          ) : (
            <div className="space-y-6">
              {unread.length > 0 && (
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--sma-text-muted)' }}>Needs Review</p>
                  <div className="space-y-3">
                    {unread.map(a => {
                      const s = alertStyle(a.severity);
                      const AlertIcon = s.icon;
                      return (
                        <div key={a.alert_id} className="flex flex-col sm:flex-row sm:items-start gap-4 p-5 rounded-2xl transition-all duration-200 hover:-translate-y-0.5" style={{ backgroundColor: 'var(--sma-surface)', border: '1px solid var(--sma-border)', boxShadow: '0 12px 30px rgba(31,36,33,0.055)' }} data-testid={`alert-${a.alert_id}`}>
                          <div className="flex items-start gap-4 flex-1">
                            <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ backgroundColor: s.border }} />
                            <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--sma-surface-alt)' }}>
                              <AlertIcon className="w-5 h-5" style={{ color: s.text }} />
                            </div>
                          <div className="flex-1">
                            <p className="font-medium" style={{ color: 'var(--sma-text-primary)' }}>{a.title}</p>
                            <p className="text-sm mt-1" style={{ color: 'var(--sma-text-secondary)' }}>{a.message}</p>
                            <p className="text-xs mt-2" style={{ color: 'var(--sma-text-muted)' }}>{new Date(a.created_at).toLocaleString()}</p>
                          </div>
                          </div>
                          <div className="flex gap-2 flex-shrink-0 sm:justify-end">
                            <Button data-testid={`alert-view-${a.alert_id}`} onClick={() => navigate(`/results/${a.patient_id}`)} size="sm" variant="ghost" className="h-8 rounded-lg text-xs gap-1.5" style={{ color: 'var(--sma-brand)' }}>
                              Review <ArrowRight className="w-3.5 h-3.5" />
                            </Button>
                            <Button data-testid={`alert-dismiss-${a.alert_id}`} onClick={() => markRead(a.alert_id)} variant="outline" size="sm" className="h-8 rounded-lg px-3 text-xs gap-1.5" style={{ borderColor: 'var(--sma-border)', color: 'var(--sma-text-secondary)' }} aria-label="Mark reviewed"><Check className="w-3.5 h-3.5" /> Done</Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {read.length > 0 && (
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--sma-text-muted)' }}>Reviewed</p>
                  <div className="space-y-3">
                    {read.map(a => {
                      const s = alertStyle(a.severity);
                      const AlertIcon = s.icon;
                      return (
                        <div key={a.alert_id} className="flex items-start gap-4 p-4 rounded-xl opacity-60" style={{ backgroundColor: 'var(--sma-surface)', border: '1px solid var(--sma-border)' }} data-testid={`alert-read-${a.alert_id}`}>
                          <AlertIcon className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: s.text }} />
                          <div className="flex-1">
                            <p className="font-medium text-sm" style={{ color: 'var(--sma-text-primary)' }}>{a.title}</p>
                            <p className="text-xs mt-1" style={{ color: 'var(--sma-text-muted)' }}>{a.message}</p>
                          </div>
                          <Button data-testid={`alert-view-read-${a.alert_id}`} onClick={() => navigate(`/results/${a.patient_id}`)} variant="ghost" size="sm" className="text-xs h-8" style={{ color: 'var(--sma-text-muted)' }}>Open</Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
