import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Sidebar from '@/components/Sidebar';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings, Bell, FileText, Loader2, Save, Clock, Upload, Shield, BarChart3, Trash2, Download } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function SettingsPage() {
  const { user } = useAuth();

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: 'var(--sma-bg)' }}>
      <Sidebar />
      <main className="flex-1 p-8" data-testid="settings-page">
        <div className="max-w-4xl mx-auto animate-fade-in">
          <h1 className="text-3xl font-semibold tracking-tight mb-2" style={{ fontFamily: 'Outfit', color: 'var(--sma-text-primary)' }}>Settings</h1>
          <p className="text-sm mb-8" style={{ color: 'var(--sma-text-muted)' }}>Manage your notification preferences and view activity history</p>

          <Tabs defaultValue="notifications" className="w-full">
            <TabsList className="mb-6 rounded-full p-1" style={{ backgroundColor: 'var(--sma-surface-alt)' }}>
              <TabsTrigger value="notifications" data-testid="tab-notifications" className="rounded-full px-6 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <Bell className="w-4 h-4 mr-2" /> Notifications
              </TabsTrigger>
              <TabsTrigger value="audit" data-testid="tab-audit" className="rounded-full px-6 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <FileText className="w-4 h-4 mr-2" /> Audit Log
              </TabsTrigger>
            </TabsList>
            <TabsContent value="notifications"><NotificationSettings /></TabsContent>
            <TabsContent value="audit"><AuditLogViewer /></TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}

function NotificationSettings() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchSettings(); }, []);

  const fetchSettings = async () => {
    try {
      const res = await axios.get(`${API}/settings/notifications`, { withCredentials: true });
      setSettings(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { user_id, updated_at, ...payload } = settings;
      await axios.put(`${API}/settings/notifications`, payload, { withCredentials: true });
      toast.success('Notification preferences saved');
    } catch (err) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const toggle = (key) => setSettings({ ...settings, [key]: !settings[key] });

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--sma-brand)' }} /></div>;

  return (
    <div className="rounded-xl shadow-sm p-6" style={{ backgroundColor: 'var(--sma-surface)', border: '1px solid var(--sma-border)' }}>
      <h2 className="text-xl font-medium mb-6 flex items-center gap-2" style={{ fontFamily: 'Outfit', color: 'var(--sma-text-primary)' }}>
        <Bell className="w-5 h-5" style={{ color: 'var(--sma-brand)' }} /> Notification Preferences
      </h2>
      <div className="space-y-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--sma-text-muted)' }}>Email Notifications</p>
          <EmailStatusBadge />
          <div className="space-y-4 mt-3">
            <SettingRow label="High risk assessments" desc="Receive email when a high-risk result is generated" checked={settings?.email_high_risk} onChange={() => toggle('email_high_risk')} testId="email-high-risk" />
            <SettingRow label="Medium risk assessments" desc="Receive email when a medium-risk result is generated" checked={settings?.email_medium_risk} onChange={() => toggle('email_medium_risk')} testId="email-medium-risk" />
          </div>
        </div>
        <div className="border-t pt-6" style={{ borderColor: 'var(--sma-border)' }}>
          <p className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--sma-text-muted)' }}>In-App Alerts</p>
          <div className="space-y-4">
            <SettingRow label="High risk alerts" desc="Show in-app alert for high-risk assessments" checked={settings?.in_app_high_risk} onChange={() => toggle('in_app_high_risk')} testId="inapp-high-risk" />
            <SettingRow label="Medium risk alerts" desc="Show in-app alert for medium-risk assessments" checked={settings?.in_app_medium_risk} onChange={() => toggle('in_app_medium_risk')} testId="inapp-medium-risk" />
            <SettingRow label="Low risk alerts" desc="Show in-app alert for low-risk assessments" checked={settings?.in_app_low_risk} onChange={() => toggle('in_app_low_risk')} testId="inapp-low-risk" />
          </div>
        </div>
      </div>
      <Button data-testid="save-notifications-btn" onClick={handleSave} disabled={saving} className="mt-6 h-11 rounded-full font-medium" style={{ backgroundColor: 'var(--sma-brand)', color: 'var(--sma-text-inverse)' }}>
        {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
        Save Preferences
      </Button>
    </div>
  );
}

function SettingRow({ label, desc, checked, onChange, testId }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: 'var(--sma-surface-alt)' }}>
      <div>
        <p className="text-sm font-medium" style={{ color: 'var(--sma-text-primary)' }}>{label}</p>
        <p className="text-xs" style={{ color: 'var(--sma-text-muted)' }}>{desc}</p>
      </div>
      <Switch data-testid={testId} checked={checked || false} onCheckedChange={onChange} />
    </div>
  );
}

function EmailStatusBadge() {
  const [status, setStatus] = useState(null);
  const [testing, setTesting] = useState(false);
  useEffect(() => {
    axios.get(`${API}/email/status`, { withCredentials: true }).then(r => setStatus(r.data)).catch(() => {});
  }, []);
  const sendTest = async () => {
    setTesting(true);
    try {
      const res = await axios.post(`${API}/email/test`, {}, { withCredentials: true });
      if (res.data.status === 'sent') toast.success('Test email sent successfully!');
      else if (res.data.status === 'skipped') toast.info('Email not configured. Add RESEND_API_KEY to enable.');
      else toast.error('Email send failed: ' + (res.data.error || 'unknown'));
    } catch (err) {
      toast.error('Failed to send test email');
    } finally {
      setTesting(false);
    }
  };
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg mb-2" style={{ backgroundColor: status?.configured ? 'var(--sma-risk-low-bg)' : 'var(--sma-risk-med-bg)' }} data-testid="email-status-badge">
      <div className="flex-1">
        <p className="text-xs font-semibold" style={{ color: status?.configured ? 'var(--sma-risk-low-text)' : 'var(--sma-risk-med-text)' }}>
          {status?.configured ? 'Email delivery active' : 'Email not configured'}
        </p>
        <p className="text-[10px]" style={{ color: status?.configured ? 'var(--sma-risk-low-text)' : 'var(--sma-risk-med-text)', opacity: 0.7 }}>
          {status?.configured ? `Sender: ${status.sender}` : 'Add RESEND_API_KEY to backend .env to enable email delivery'}
        </p>
      </div>
      <Button data-testid="send-test-email-btn" variant="ghost" size="sm" onClick={sendTest} disabled={testing} className="h-7 text-xs rounded-full"
        style={{ color: status?.configured ? 'var(--sma-risk-low-text)' : 'var(--sma-risk-med-text)' }}>
        {testing ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Test'}
      </Button>
    </div>
  );
}

function AuditLogViewer() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const limit = 20;

  useEffect(() => { fetchLogs(); }, [page]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/audit-logs?limit=${limit}&offset=${page * limit}`, { withCredentials: true });
      setLogs(res.data.logs);
      setTotal(res.data.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const actionIcon = (action) => {
    const map = {
      upload: Upload, export_pdf: Download, update_thresholds: Settings,
      add_medication: Shield, remove_medication: Trash2,
    };
    return map[action] || FileText;
  };

  const actionColor = (action) => {
    if (action.includes('remove') || action.includes('delete')) return 'var(--sma-risk-high-text)';
    if (action.includes('update') || action.includes('add')) return 'var(--sma-risk-med-text)';
    return 'var(--sma-brand)';
  };

  return (
    <div className="rounded-xl shadow-sm p-6" style={{ backgroundColor: 'var(--sma-surface)', border: '1px solid var(--sma-border)' }}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-medium flex items-center gap-2" style={{ fontFamily: 'Outfit', color: 'var(--sma-text-primary)' }}>
          <Clock className="w-5 h-5" style={{ color: 'var(--sma-brand)' }} /> Activity Log
        </h2>
        <p className="text-sm" style={{ color: 'var(--sma-text-muted)' }}>{total} entries</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--sma-brand)' }} /></div>
      ) : logs.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--sma-text-muted)' }} />
          <p style={{ color: 'var(--sma-text-secondary)' }}>No activity logged yet</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {logs.map((log) => {
              const Icon = actionIcon(log.action);
              return (
                <div key={log.log_id} className="flex items-start gap-3 p-3 rounded-lg" style={{ backgroundColor: 'var(--sma-surface-alt)' }} data-testid={`audit-log-${log.log_id}`}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--sma-surface)' }}>
                    <Icon className="w-4 h-4" style={{ color: actionColor(log.action) }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold uppercase" style={{ backgroundColor: 'var(--sma-surface)', color: actionColor(log.action) }}>
                        {log.action?.replace(/_/g, ' ')}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--sma-text-muted)' }}>
                        {new Date(log.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm mt-1 truncate" style={{ color: 'var(--sma-text-primary)' }}>{log.details}</p>
                  </div>
                </div>
              );
            })}
          </div>
          {total > limit && (
            <div className="flex items-center justify-center gap-3 mt-4">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)} data-testid="audit-prev-btn" className="rounded-full h-8">Previous</Button>
              <span className="text-sm" style={{ color: 'var(--sma-text-muted)' }}>Page {page + 1} of {Math.ceil(total / limit)}</span>
              <Button variant="outline" size="sm" disabled={(page + 1) * limit >= total} onClick={() => setPage(p => p + 1)} data-testid="audit-next-btn" className="rounded-full h-8">Next</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
