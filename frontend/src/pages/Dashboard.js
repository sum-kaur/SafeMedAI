import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import Sidebar from '@/components/Sidebar';
import { Button } from '@/components/ui/button';
import {
  Users, FileText, AlertTriangle, Bell, Plus, CheckCircle,
  Loader2, Shield, Download, Heart, Upload,
  ChevronRight, X
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { getApiUrl } from '@/lib/utils';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const isPractitioner = user?.role === 'medical_practitioner';

  useEffect(() => { fetchStats(); }, []);

  const fetchStats = async () => {
    try {
      const res = await axios.get(`${getApiUrl('/api/')}dashboard/stats`, { withCredentials: true });
      setStats(res.data);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportPatients = async () => {
    setExporting(true);
    try {
      const res = await axios.get(`${getApiUrl('/api/')}export/patients`, { withCredentials: true, responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `patients_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Patients exported');
    } catch {
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: 'var(--sma-bg)' }}>
      <Sidebar />
      <main className="flex-1 overflow-auto" data-testid="dashboard-main">
        {isPractitioner ? (
          <PractitionerDashboardV2
            stats={stats} loading={loading} exporting={exporting}
            onExport={handleExportPatients}
            navigate={navigate} user={user}
          />
        ) : (
          <FamilyDashboard
            stats={stats} loading={loading} navigate={navigate} user={user}
          />
        )}
      </main>
    </div>
  );
}

/* ======================== PRACTITIONER DASHBOARD V2 ======================== */
function PractitionerDashboardV2({ stats, loading, exporting, onExport, navigate, user }) {
  const cleanName = (user?.name || '').replace(/^Dr\.?\s+/i, '').trim();
  const firstName = cleanName.split(' ')[0] || 'Doctor';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const today = new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' });

  const riskOrder = { high: 0, medium: 1, low: 2 };
  const patients = [...(stats?.recent_patients || [])].sort((a, b) => {
    const ra = riskOrder[a.latest_risk_level] ?? 3;
    const rb = riskOrder[b.latest_risk_level] ?? 3;
    return ra - rb;
  });
  const urgentPatients = patients.filter(p => p.latest_risk_level === 'high');
  const followUpPatients = patients.filter(p => p.latest_risk_level === 'medium');
  const recentlyAnalysed = patients.filter(p => p.latest_risk_level === 'low' || !p.latest_risk_level);
  const awaitingAnalysis = patients.filter(p => !p.latest_risk_level);
  const reviewCount = urgentPatients.length + followUpPatients.length;

  return (
    <div className="px-5 py-6 lg:px-8 lg:py-8">
      <div className="max-w-7xl mx-auto animate-fade-in">
        <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-5 mb-7">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--sma-text-muted)' }}>
              {today}
              {stats?.total_patients > 0 && (
                <span> · {stats.total_patients} patient{stats.total_patients !== 1 ? 's' : ''}</span>
              )}
            </p>
            <h1 className="text-3xl font-semibold tracking-tight" style={{ fontFamily: 'Outfit', color: 'var(--sma-text-primary)' }}>
              {greeting}, Dr {firstName}
            </h1>
            <p className="text-sm mt-2" style={{ color: 'var(--sma-text-secondary)' }}>
              Review high-priority patients, recent analyses, and follow-up actions.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {stats?.total_patients > 0 && (
              <Button
                data-testid="export-patients-btn"
                onClick={onExport}
                disabled={exporting}
                variant="outline"
                className="h-10 px-4 rounded-lg font-medium text-sm gap-2 transition-all hover:-translate-y-0.5"
                style={{ borderColor: 'var(--sma-border)', color: 'var(--sma-text-secondary)' }}
              >
                {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Export CSV
              </Button>
            )}
            <Button
              data-testid="select-patient-btn"
              onClick={() => navigate('/patients')}
              variant="outline"
              className="h-10 px-4 rounded-lg font-medium text-sm gap-2 transition-all hover:-translate-y-0.5"
              style={{ borderColor: 'var(--sma-border)', color: 'var(--sma-brand)', backgroundColor: 'var(--sma-surface)' }}
            >
              <Users className="w-4 h-4" /> Select Patient
            </Button>
            <Button
              data-testid="add-patient-btn"
              onClick={() => navigate('/patients?new=1')}
              className="h-10 px-5 rounded-lg font-medium text-sm gap-2 transition-all hover:-translate-y-0.5"
              style={{ backgroundColor: 'var(--sma-brand)', color: 'white' }}
            >
              <Plus className="w-4 h-4" /> New Case
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-3">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--sma-brand)' }} />
            <p className="text-sm" style={{ color: 'var(--sma-text-muted)' }}>Loading dashboard...</p>
          </div>
        ) : (
          <>
            <UploadFirstPanel
              title="Analyse a discharge summary"
              subtitle="Start here. Select a patient or create a new case, then attach the discharge summary to identify medication risk."
              primaryLabel="Select Patient"
              secondaryLabel="New Case"
              navigate={navigate}
              newPatientPath="/patients?new=1"
              testId="practitioner-upload-first"
              prominent
            />

            <section className="mb-6">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <h2 className="text-lg font-semibold" style={{ fontFamily: 'Outfit', color: 'var(--sma-text-primary)' }}>
                    Today's Priorities
                  </h2>
                  <p className="text-sm" style={{ color: 'var(--sma-text-muted)' }}>
                    Start with the work that needs clinical attention.
                  </p>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <PriorityCard
                  icon={AlertTriangle}
                  count={reviewCount}
                  label="Patients needing review"
                  detail={reviewCount > 0 ? 'Open high and medium risk cases' : 'No elevated-risk cases in queue'}
                  tone="high"
                  onClick={() => navigate('/patients')}
                  testId="priority-review-patients"
                />
                <PriorityCard
                  icon={Bell}
                  count={stats?.unread_alerts || 0}
                  label="New medication alerts"
                  detail={(stats?.unread_alerts || 0) > 0 ? 'Review clinical task items' : 'No new tasks waiting'}
                  tone="medium"
                  onClick={() => navigate('/alerts')}
                  testId="priority-medication-alerts"
                />
                <PriorityCard
                  icon={FileText}
                  count={awaitingAnalysis.length}
                  label="Cases awaiting analysis"
                  detail={awaitingAnalysis.length > 0 ? 'Attach a discharge summary' : 'All recent cases have a score'}
                  tone="neutral"
                  onClick={() => navigate('/patients')}
                  testId="priority-awaiting-analysis"
                />
              </div>
            </section>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
              <DashboardPanel
                title="Review Queue"
                subtitle="Grouped by clinical urgency"
                action={
                  <button
                    data-testid="view-all-patients-btn"
                    onClick={() => navigate('/patients')}
                    className="flex items-center gap-1 text-sm font-medium transition-opacity hover:opacity-70"
                    style={{ color: 'var(--sma-brand)' }}
                  >
                    All patients <ChevronRight className="w-4 h-4" />
                  </button>
                }
              >
                {patients.length > 0 ? (
                  <div className="space-y-6">
                    <QueueSection title="Urgent Review" count={urgentPatients.length}>
                      {urgentPatients.length > 0 ? urgentPatients.map(p => (
                        <QueueRow key={p.patient_id} patient={p} navigate={navigate} reason="High medication risk score" />
                      )) : <QuietEmptyLine text="No urgent cases." />}
                    </QueueSection>
                    <QueueSection title="Needs Follow-up" count={followUpPatients.length}>
                      {followUpPatients.length > 0 ? followUpPatients.map(p => (
                        <QueueRow key={p.patient_id} patient={p} navigate={navigate} reason="Medication profile needs follow-up" />
                      )) : <QuietEmptyLine text="No medium-risk follow-ups." />}
                    </QueueSection>
                    <QueueSection title="Recently Analysed" count={recentlyAnalysed.length}>
                      {recentlyAnalysed.length > 0 ? recentlyAnalysed.map(p => (
                        <QueueRow
                          key={p.patient_id}
                          patient={p}
                          navigate={navigate}
                          reason={p.latest_risk_level ? 'Recent analysis completed' : 'Awaiting discharge summary'}
                        />
                      )) : <QuietEmptyLine text="No recent analyses yet." />}
                    </QueueSection>
                  </div>
                ) : (
                  <EmptyState
                    icon={Users}
                    title="No patients yet"
                    subtitle="Add a patient and attach a discharge summary to begin risk analysis."
                    action={
                      <Button
                        data-testid="add-patient-empty-btn"
                        onClick={() => navigate('/patients?new=1')}
                        className="h-10 px-5 rounded-lg font-medium text-sm"
                        style={{ backgroundColor: 'var(--sma-brand)', color: 'white' }}
                      >
                        <Plus className="w-4 h-4 mr-2" /> New Case
                      </Button>
                    }
                  />
                )}
              </DashboardPanel>

              <div className="space-y-4">
                <CohortOverview stats={stats} />
                <ClinicalActivity
                  stats={stats}
                  patients={patients}
                  urgentPatients={urgentPatients}
                  followUpPatients={followUpPatients}
                  navigate={navigate}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ======================== PRACTITIONER DASHBOARD ======================== */
function PractitionerDashboard({ stats, loading, exporting, onExport, navigate, user }) {
  // Strip any "Dr" prefix — the greeting template adds it explicitly
  const cleanName = (user?.name || '').replace(/^Dr\.?\s+/i, '').trim();
  const firstName = cleanName.split(' ')[0] || 'Doctor';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  // Sort patients: high → medium → low → unscored
  const riskOrder = { high: 0, medium: 1, low: 2 };
  const sortedPatients = [...(stats?.recent_patients || [])].sort((a, b) => {
    const ra = riskOrder[a.latest_risk_level] ?? 3;
    const rb = riskOrder[b.latest_risk_level] ?? 3;
    return ra - rb;
  });

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-5xl mx-auto animate-fade-in">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: 'Outfit', color: 'var(--sma-text-primary)' }}>
              {greeting}, Dr {firstName}
            </h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--sma-text-muted)' }}>
              {new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}
              {stats?.total_patients > 0 && (
                <span> · {stats.total_patients} patient{stats.total_patients !== 1 ? 's' : ''}</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {stats?.total_patients > 0 && (
              <Button
                data-testid="export-patients-btn"
                onClick={onExport}
                disabled={exporting}
                variant="outline"
                className="h-9 px-4 rounded-xl font-medium text-sm gap-2"
                style={{ borderColor: 'var(--sma-border)', color: 'var(--sma-text-secondary)' }}
              >
                {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Export CSV
              </Button>
            )}
            <Button
              data-testid="add-patient-btn"
              onClick={() => navigate('/patients?new=1')}
              className="h-9 px-5 rounded-lg font-medium text-sm gap-2"
              style={{ backgroundColor: 'var(--sma-brand)', color: 'white' }}
            >
              <Plus className="w-4 h-4" /> New Case
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-3">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--sma-brand)' }} />
            <p className="text-sm" style={{ color: 'var(--sma-text-muted)' }}>Loading dashboard…</p>
          </div>
        ) : (
          <>
            <UploadFirstPanel
              title="Analyse a discharge summary"
              subtitle="Identify medication risk from a photo, PDF, or screenshot."
              primaryLabel="Select Patient"
              secondaryLabel="New Case"
              navigate={navigate}
              newPatientPath="/patients?new=1"
              testId="practitioner-upload-first"
            />

            {/* Two clickable stat cards */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <StatCard
                icon={AlertTriangle}
                label="High Risk"
                value={stats?.high_risk || 0}
                color="var(--sma-risk-high-text)"
                bg="var(--sma-surface)"
                compact
                accentBorder="var(--sma-risk-high-border)"
                onClick={() => navigate('/patients')}
              />
              <StatCard
                icon={Bell}
                label="Open Tasks"
                value={stats?.unread_alerts || 0}
                color="var(--sma-risk-med-text)"
                bg="var(--sma-surface)"
                compact
                accentBorder="var(--sma-risk-med-border)"
                onClick={() => navigate('/alerts')}
              />
            </div>

            {/* Risk Distribution Bar */}
            {stats?.total_patients > 0 && (
              <RiskDistributionBar stats={stats} />
            )}

            {/* Patient sections */}
            {sortedPatients.length > 0 ? (() => {
              const attention = sortedPatients.filter(p => p.latest_risk_level === 'high' || p.latest_risk_level === 'medium');
              const onTrack   = sortedPatients.filter(p => p.latest_risk_level === 'low' || !p.latest_risk_level);
              return (
                <div className="mb-6">
                  {attention.length > 0 ? (
                    <>
                      <div className="flex items-center justify-between mb-3">
                        <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--sma-text-muted)' }}>
                          Requires Attention
                          <span className="ml-2 px-1.5 py-0.5 rounded text-xs font-bold" style={{ backgroundColor: 'var(--sma-risk-high-bg)', color: 'var(--sma-risk-high-text)' }}>
                            {attention.length}
                          </span>
                        </h2>
                        <button
                          data-testid="view-all-patients-btn"
                          onClick={() => navigate('/patients')}
                          className="flex items-center gap-1 text-xs font-medium transition-opacity hover:opacity-70"
                          style={{ color: 'var(--sma-brand)' }}
                        >
                          All patients <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="space-y-2 mb-3">
                        {attention.map(p => <PractitionerPatientCard key={p.patient_id} patient={p} navigate={navigate} />)}
                      </div>
                      {onTrack.length > 0 && (
                        <div
                          className="flex items-center justify-between px-4 py-3 rounded-xl"
                          style={{ backgroundColor: 'var(--sma-surface)', border: '1px solid var(--sma-border)' }}
                        >
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--sma-risk-low-text)' }} />
                            <span className="text-sm" style={{ color: 'var(--sma-text-secondary)' }}>
                              {onTrack.length} patient{onTrack.length !== 1 ? 's' : ''} with low medication risk
                            </span>
                          </div>
                          <button
                            onClick={() => navigate('/patients')}
                            className="flex items-center gap-1 text-xs font-medium transition-opacity hover:opacity-70"
                            style={{ color: 'var(--sma-brand)' }}
                          >
                            View all <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div
                      className="p-5 rounded-xl flex items-start gap-4"
                      style={{ backgroundColor: 'var(--sma-risk-low-bg)', border: '1px solid var(--sma-risk-low-border)' }}
                    >
                      <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--sma-risk-low-text)' }} />
                      <div className="flex-1">
                        <p className="font-semibold text-sm" style={{ color: 'var(--sma-risk-low-text)', fontFamily: 'Outfit' }}>
                          All patients on track
                        </p>
                        <p className="text-sm mt-0.5" style={{ color: 'var(--sma-risk-low-text)' }}>
                          {onTrack.length} patient{onTrack.length !== 1 ? 's' : ''} — low medication risk profile
                        </p>
                      </div>
                      <button
                        data-testid="view-all-patients-btn"
                        onClick={() => navigate('/patients')}
                        className="flex items-center gap-1 text-sm font-medium transition-opacity hover:opacity-70 flex-shrink-0"
                        style={{ color: 'var(--sma-brand)' }}
                      >
                        View all <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })() : (
              <EmptyState
                icon={Users}
                title="No patients yet"
                subtitle="Add a patient to get started."
                action={
                  <Button
                    data-testid="add-patient-empty-btn"
                    onClick={() => navigate('/patients?new=1')}
                    className="h-9 px-5 rounded-xl font-medium text-sm"
                    style={{ backgroundColor: 'var(--sma-brand)', color: 'white' }}
                  >
                    <Plus className="w-4 h-4 mr-2" /> New Case
                  </Button>
                }
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function PriorityCard({ icon: Icon, count, label, detail, tone, onClick, testId }) {
  const tones = {
    high: { color: 'var(--sma-risk-high-text)', border: 'var(--sma-risk-high-border)', bg: 'var(--sma-risk-high-bg)' },
    medium: { color: 'var(--sma-risk-med-text)', border: 'var(--sma-risk-med-border)', bg: 'var(--sma-risk-med-bg)' },
    low: { color: 'var(--sma-risk-low-text)', border: 'var(--sma-risk-low-border)', bg: 'var(--sma-risk-low-bg)' },
    neutral: { color: 'var(--sma-brand)', border: 'var(--sma-border)', bg: 'var(--sma-surface-alt)' },
  };
  const t = tones[tone] || tones.neutral;

  return (
    <button
      data-testid={testId}
      onClick={onClick}
      className="text-left p-4 rounded-2xl transition-all hover:-translate-y-0.5"
      style={{
        backgroundColor: 'var(--sma-surface)',
        border: '1px solid var(--sma-border)',
        boxShadow: '0 10px 28px rgba(31,36,33,0.04)',
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-3xl font-semibold leading-none" style={{ fontFamily: 'Outfit', color: 'var(--sma-text-primary)' }}>
            {count}
          </p>
          <p className="text-sm font-semibold mt-2" style={{ color: 'var(--sma-text-primary)' }}>
            {label}
          </p>
          <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--sma-text-muted)' }}>
            {detail}
          </p>
        </div>
        <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: t.bg, border: `1px solid ${t.border}` }}>
          <Icon className="w-4 h-4" style={{ color: t.color }} />
        </div>
      </div>
    </button>
  );
}

function DashboardPanel({ title, subtitle, action, children }) {
  return (
    <section
      className="rounded-2xl p-5"
      style={{
        backgroundColor: 'var(--sma-surface)',
        border: '1px solid var(--sma-border)',
        boxShadow: '0 12px 34px rgba(31,36,33,0.045)',
      }}
    >
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h2 className="text-lg font-semibold" style={{ fontFamily: 'Outfit', color: 'var(--sma-text-primary)' }}>{title}</h2>
          {subtitle && <p className="text-sm mt-0.5" style={{ color: 'var(--sma-text-muted)' }}>{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function QueueSection({ title, count, children }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--sma-text-muted)' }}>{title}</h3>
        <span className="text-xs font-semibold px-2 py-1 rounded-full" style={{ color: 'var(--sma-text-secondary)', backgroundColor: 'var(--sma-surface-alt)' }}>
          {count}
        </span>
      </div>
      <div className="divide-y" style={{ borderColor: 'var(--sma-border)' }}>
        {children}
      </div>
    </div>
  );
}

function QueueRow({ patient: p, navigate, reason }) {
  const c = riskColor(p.latest_risk_level);
  const age = p.dob ? Math.floor((Date.now() - new Date(p.dob)) / (365.25 * 24 * 3600 * 1000)) : null;
  const demographics = [age ? `${age}` : null, p.gender].filter(Boolean).join(' / ') || 'Demographics not set';
  const destination = p.latest_risk_level ? `/patients/${p.patient_id}` : `/upload/${p.patient_id}`;

  return (
    <button
      data-testid={`review-queue-row-${p.patient_id}`}
      onClick={() => navigate(destination)}
      className="w-full py-3.5 text-left flex flex-col gap-3 md:flex-row md:items-center md:justify-between transition-colors"
      onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(31,36,33,0.025)'; }}
      onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-1 self-stretch min-h-12 rounded-full flex-shrink-0" style={{ backgroundColor: c.border }} />
        <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-semibold" style={{ backgroundColor: 'var(--sma-surface-alt)', color: 'var(--sma-brand)' }}>
          {p.name?.[0]}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold truncate" style={{ color: 'var(--sma-text-primary)' }}>{p.name}</p>
            <RiskBadge level={p.latest_risk_level} score={p.latest_risk_score} />
          </div>
          <p className="text-xs mt-1" style={{ color: 'var(--sma-text-muted)' }}>
            {demographics} · {reason}
          </p>
        </div>
      </div>
      <span className="inline-flex items-center gap-1 text-sm font-medium md:flex-shrink-0" style={{ color: 'var(--sma-brand)' }}>
        Open Case <ChevronRight className="w-4 h-4" />
      </span>
    </button>
  );
}

function RiskBadge({ level, score }) {
  const c = riskColor(level);
  const label = level ? `${level.charAt(0).toUpperCase()}${level.slice(1)}` : 'Awaiting';
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{ color: c.text, border: `1px solid ${c.border}`, backgroundColor: level ? c.bg : 'var(--sma-surface)' }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c.border }} />
      {label}{score ? ` · ${score}` : ''}
    </span>
  );
}

function QuietEmptyLine({ text }) {
  return (
    <div className="py-3 text-sm" style={{ color: 'var(--sma-text-muted)' }}>
      {text}
    </div>
  );
}

function CohortOverview({ stats }) {
  const rows = [
    { label: 'Low', value: stats?.low_risk || 0, color: 'var(--sma-risk-low-text)', dot: 'var(--sma-risk-low-border)' },
    { label: 'Medium', value: stats?.medium_risk || 0, color: 'var(--sma-risk-med-text)', dot: 'var(--sma-risk-med-border)' },
    { label: 'High', value: stats?.high_risk || 0, color: 'var(--sma-risk-high-text)', dot: 'var(--sma-risk-high-border)' },
  ];

  return (
    <DashboardPanel title="Cohort Overview" subtitle={`${stats?.total_patients || 0} total patient${(stats?.total_patients || 0) === 1 ? '' : 's'}`}>
      <div className="space-y-2">
        {rows.map(row => (
          <div key={row.label} className="flex items-center justify-between rounded-xl px-3 py-2" style={{ backgroundColor: 'var(--sma-surface-alt)' }}>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: row.dot }} />
              <span className="text-sm font-medium" style={{ color: 'var(--sma-text-secondary)' }}>{row.label}</span>
            </div>
            <span className="text-sm font-semibold" style={{ color: row.color }}>{row.value}</span>
          </div>
        ))}
      </div>
    </DashboardPanel>
  );
}

function ClinicalActivity({ stats, patients, urgentPatients, followUpPatients, navigate }) {
  const recent = patients.slice(0, 3);
  return (
    <DashboardPanel title="Clinical Activity" subtitle="Latest alerts, analyses, and follow-ups">
      <div className="space-y-4">
        <ActivityGroup title="Latest Alerts">
          <ActivityItem
            icon={Bell}
            tone={(stats?.unread_alerts || 0) > 0 ? 'medium' : 'low'}
            title={`${stats?.unread_alerts || 0} open task${(stats?.unread_alerts || 0) === 1 ? '' : 's'}`}
            detail={(stats?.unread_alerts || 0) > 0 ? 'Review medication alerts and follow-up actions' : 'No new alerts waiting'}
            onClick={() => navigate('/alerts')}
          />
        </ActivityGroup>
        <ActivityGroup title="Recent Analyses">
          {recent.length > 0 ? recent.map(p => (
            <ActivityItem
              key={p.patient_id}
              icon={FileText}
              tone={p.latest_risk_level || 'neutral'}
              title={p.name}
              detail={p.latest_risk_level ? `${p.latest_risk_level} medication risk` : 'Awaiting discharge summary'}
              onClick={() => navigate(p.latest_risk_level ? `/patients/${p.patient_id}` : `/upload/${p.patient_id}`)}
            />
          )) : <QuietEmptyLine text="No analyses yet." />}
        </ActivityGroup>
        <ActivityGroup title="Pending Follow-ups">
          <ActivityItem
            icon={Shield}
            tone={urgentPatients.length > 0 ? 'high' : followUpPatients.length > 0 ? 'medium' : 'low'}
            title={`${urgentPatients.length + followUpPatients.length} follow-up${urgentPatients.length + followUpPatients.length === 1 ? '' : 's'}`}
            detail={urgentPatients.length > 0 ? 'Urgent review is the next priority' : followUpPatients.length > 0 ? 'Medium-risk cases need review' : 'No elevated follow-ups'}
            onClick={() => navigate('/patients')}
          />
        </ActivityGroup>
      </div>
    </DashboardPanel>
  );
}

function ActivityGroup({ title, children }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--sma-text-muted)' }}>{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function ActivityItem({ icon: Icon, tone, title, detail, onClick }) {
  const c = riskColor(tone);
  return (
    <button
      onClick={onClick}
      className="w-full flex items-start gap-3 text-left rounded-xl p-2.5 transition-colors"
      style={{ backgroundColor: 'var(--sma-surface)' }}
      onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--sma-surface-alt)'; }}
      onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'var(--sma-surface)'; }}
    >
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: c.bg, border: `1px solid ${c.border}` }}>
        <Icon className="w-4 h-4" style={{ color: c.text }} />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color: 'var(--sma-text-primary)' }}>{title}</p>
        <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--sma-text-muted)' }}>{detail}</p>
      </div>
    </button>
  );
}

/* ======================== FAMILY DASHBOARD ======================== */
function FamilyDashboard({ stats, loading, navigate, user }) {
  // Strip any "Dr" prefix — families are never addressed as "Dr"
  const cleanName = (user?.name || '').replace(/^Dr\.?\s+/i, '').trim();
  const firstName = cleanName.split(' ')[0] || 'there';
  const [medDismissed, setMedDismissed] = useState(false);
  const highRiskPatients = stats?.recent_patients?.filter(p => p.latest_risk_level === 'high') || [];
  const medRiskPatients  = stats?.recent_patients?.filter(p => p.latest_risk_level === 'medium') || [];

  React.useEffect(() => {
    if (!loading && stats?.recent_patients?.length === 1) {
      navigate(`/upload/${stats.recent_patients[0].patient_id}`, { replace: true });
    }
  }, [loading, stats, navigate]);

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-2xl mx-auto animate-fade-in">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: 'Outfit', color: 'var(--sma-text-primary)' }}>
            Hi, {firstName}
          </h1>
          <Button
            data-testid="add-patient-btn"
            onClick={() => navigate('/patients?new=1')}
            className="h-9 px-4 rounded-lg text-sm font-medium gap-2"
            style={{ backgroundColor: 'var(--sma-brand)', color: 'white' }}
          >
            <Plus className="w-4 h-4" /> Add Person
          </Button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-3">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--sma-brand)' }} />
            <p className="text-sm" style={{ color: 'var(--sma-text-muted)' }}>Loading…</p>
          </div>
        ) : (
          <>
            <UploadFirstPanel
              title="Analyse a discharge summary"
              subtitle="Check medication risk for someone you care for."
              primaryLabel="Select Person"
              secondaryLabel="Add Person"
              navigate={navigate}
              newPatientPath="/patients?new=1"
              testId="family-upload-first"
            />

            {/* High-risk alert banner */}
            {highRiskPatients.length > 0 && (
              <div
                className="mb-4 p-4 rounded-xl"
                style={{ backgroundColor: 'var(--sma-surface)', border: '1px solid var(--sma-border)', borderLeft: '4px solid var(--sma-risk-high-border)' }}
                data-testid="high-risk-alert-banner"
              >
                <div className="flex gap-3">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--sma-risk-high-text)' }} />
                  <div>
                    <p className="font-semibold text-sm" style={{ color: 'var(--sma-text-primary)', fontFamily: 'Outfit' }}>
                      Urgent medication review
                    </p>
                    <p className="text-sm mt-0.5 leading-relaxed" style={{ color: 'var(--sma-text-secondary)' }}>
                      <strong>{highRiskPatients.map(p => p.name.split(' ')[0]).join(' and ')}</strong> {highRiskPatients.length === 1 ? 'has' : 'have'} a high medication risk score. Please book a GP appointment as soon as possible.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Medium-risk alert banner (dismissable) */}
            {medRiskPatients.length > 0 && !medDismissed && (
              <div
                className="mb-4 p-4 rounded-xl relative"
                style={{ backgroundColor: 'var(--sma-surface)', border: '1px solid var(--sma-border)', borderLeft: '4px solid var(--sma-risk-med-border)' }}
                data-testid="medium-risk-alert-banner"
              >
                <button
                  onClick={() => setMedDismissed(true)}
                  className="absolute top-3 right-3 rounded p-0.5"
                  style={{ color: 'var(--sma-text-muted)' }}
                  aria-label="Dismiss"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
                <div className="flex gap-3 pr-5">
                  <Shield className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--sma-risk-med-text)' }} />
                  <div>
                    <p className="font-semibold text-sm" style={{ color: 'var(--sma-text-primary)', fontFamily: 'Outfit' }}>
                      Review recommended
                    </p>
                    <p className="text-sm mt-0.5" style={{ color: 'var(--sma-text-secondary)' }}>
                      <strong>{medRiskPatients.map(p => p.name.split(' ')[0]).join(' and ')}</strong> {medRiskPatients.length === 1 ? 'has' : 'have'} a medium risk score. Book a GP or pharmacist review in the next 1–2 weeks.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Patient Cards */}
            {stats?.recent_patients?.length > 0 ? (
              <div className="mb-6">
                <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--sma-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  My Family
                </h2>
                <div className="space-y-3">
                  {stats.recent_patients.map((p) => (
                    <FamilyPatientCard key={p.patient_id} patient={p} navigate={navigate} />
                  ))}
                </div>
              </div>
            ) : (
              <EmptyState
                icon={Heart}
                title="No loved ones added yet"
                subtitle="Add your loved one's details and attach their discharge summary to get started."
                action={
                  <Button
                    data-testid="family-add-patient-btn"
                    onClick={() => navigate('/patients?new=1')}
                    className="h-10 px-6 rounded-xl font-medium text-sm gap-2"
                    style={{ backgroundColor: 'var(--sma-brand)', color: 'white' }}
                  >
                    <Plus className="w-4 h-4" /> Add Person
                  </Button>
                }
              />
            )}

            <Disclaimer />
          </>
        )}
      </div>
    </div>
  );
}

function UploadFirstPanel({ title, subtitle, primaryLabel, secondaryLabel, navigate, newPatientPath, testId, prominent = false }) {
  return (
    <div
      className={`${prominent ? 'mb-7 rounded-2xl p-6 lg:p-7' : 'mb-6 rounded-xl p-5'} flex flex-col md:flex-row md:items-center justify-between gap-4`}
      style={{
        backgroundColor: 'var(--sma-surface)',
        border: prominent ? '1px solid rgba(30,58,95,0.18)' : '1px solid var(--sma-border)',
        boxShadow: prominent ? '0 18px 44px rgba(31,36,33,0.075)' : '0 10px 30px rgba(31,36,33,0.05)',
      }}
      data-testid={testId}
    >
      <div className="flex items-start gap-4">
        <div
          className={`${prominent ? 'w-14 h-14' : 'w-12 h-12'} rounded-xl flex items-center justify-center flex-shrink-0`}
          style={{ backgroundColor: prominent ? 'var(--sma-brand)' : 'var(--sma-risk-low-bg)' }}
        >
          <Upload className={`${prominent ? 'w-7 h-7' : 'w-6 h-6'}`} style={{ color: prominent ? 'white' : 'var(--sma-brand)' }} />
        </div>
        <div>
          <h2 className={`${prominent ? 'text-2xl' : 'text-xl'} font-semibold`} style={{ fontFamily: 'Outfit', color: 'var(--sma-text-primary)' }}>
            {title}
          </h2>
          <p className={`${prominent ? 'text-base max-w-2xl' : 'text-sm'} mt-1`} style={{ color: 'var(--sma-text-secondary)' }}>
            {subtitle}
          </p>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row gap-2 md:flex-shrink-0">
        <Button
          data-testid={`${testId}-upload-btn`}
          onClick={() => navigate('/patients')}
          className={`${prominent ? 'h-12 px-6 text-base' : 'h-11'} rounded-lg font-medium gap-2 transition-all hover:-translate-y-0.5`}
          style={{ backgroundColor: 'var(--sma-brand)', color: 'white' }}
        >
          <Users className="w-4 h-4" /> {primaryLabel}
        </Button>
        <Button
          data-testid={`${testId}-new-btn`}
          onClick={() => navigate(newPatientPath)}
          variant="outline"
          className={`${prominent ? 'h-12 px-5' : 'h-11'} rounded-lg font-medium gap-2 transition-all hover:-translate-y-0.5`}
          style={{ borderColor: 'var(--sma-border)', color: 'var(--sma-text-secondary)' }}
        >
          <Plus className="w-4 h-4" /> {secondaryLabel}
        </Button>
      </div>
    </div>
  );
}

/* ======================== RISK DISTRIBUTION BAR ======================== */
function RiskDistributionBar({ stats }) {
  const low    = stats?.low_risk    || 0;
  const medium = stats?.medium_risk || 0;
  const high   = stats?.high_risk   || 0;
  const total  = stats?.total_patients || 1;

  const lowPct    = Math.round((low    / total) * 100);
  const medPct    = Math.round((medium / total) * 100);
  const highPct   = Math.round((high   / total) * 100);

  return (
    <div
      className="rounded-xl p-4 mb-6"
      style={{ backgroundColor: 'var(--sma-surface)', border: '1px solid var(--sma-border)' }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--sma-text-muted)' }}>
          Risk Distribution
        </span>
        <span className="text-xs" style={{ color: 'var(--sma-text-muted)' }}>
          {total} patient{total !== 1 ? 's' : ''} total
        </span>
      </div>
      {/* Segmented bar */}
      <div className="flex h-2 rounded-full overflow-hidden gap-px mb-3">
        {lowPct  > 0 && <div style={{ width: `${lowPct}%`,  backgroundColor: 'var(--sma-risk-low-border)',  borderRadius: '999px 0 0 999px' }} />}
        {medPct  > 0 && <div style={{ width: `${medPct}%`,  backgroundColor: 'var(--sma-risk-med-border)'  }} />}
        {highPct > 0 && <div style={{ width: `${highPct}%`, backgroundColor: 'var(--sma-risk-high-border)', borderRadius: '0 999px 999px 0' }} />}
        {/* Fallback if all zero */}
        {lowPct === 0 && medPct === 0 && highPct === 0 && (
          <div style={{ width: '100%', backgroundColor: 'var(--sma-border)', borderRadius: '999px' }} />
        )}
      </div>
      {/* Legend */}
      <div className="flex items-center gap-5 flex-wrap">
        {[
          { label: 'Low',    count: low,    pct: lowPct,  color: 'var(--sma-risk-low-text)',  dot: 'var(--sma-risk-low-border)' },
          { label: 'Medium', count: medium, pct: medPct,  color: 'var(--sma-risk-med-text)',  dot: 'var(--sma-risk-med-border)' },
          { label: 'High',   count: high,   pct: highPct, color: 'var(--sma-risk-high-text)', dot: 'var(--sma-risk-high-border)' },
        ].map(({ label, count, pct, color, dot }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: dot }} />
            <span className="text-xs" style={{ color: 'var(--sma-text-secondary)' }}>
              {label}
            </span>
            <span className="text-xs font-semibold" style={{ color }}>
              {count} ({pct}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ======================== PRACTITIONER PATIENT CARD ======================== */
function PractitionerPatientCard({ patient: p, navigate }) {
  const hasRisk   = !!p.latest_risk_level;
  const c         = riskColor(p.latest_risk_level);
  const isHighMed = p.latest_risk_level === 'high' || p.latest_risk_level === 'medium';
  const RIcon     = p.latest_risk_level === 'high' ? AlertTriangle : p.latest_risk_level === 'medium' ? Shield : CheckCircle;
  const age       = p.dob ? Math.floor((Date.now() - new Date(p.dob)) / (365.25 * 24 * 3600 * 1000)) : null;
  const riskLabel = p.latest_risk_level ? `${p.latest_risk_level.charAt(0).toUpperCase()}${p.latest_risk_level.slice(1)} risk` : null;

  return (
    <div
      className="rounded-2xl overflow-hidden cursor-pointer"
      style={{
        backgroundColor: 'var(--sma-surface)',
        border: '1px solid var(--sma-border)',
        boxShadow: '0 10px 28px rgba(31,36,33,0.045)',
        transition: 'box-shadow 0.15s, transform 0.15s',
      }}
      onClick={() => navigate(`/patients/${p.patient_id}`)}
      onMouseEnter={e => {
        e.currentTarget.style.boxShadow = '0 16px 34px rgba(31,36,33,0.08)';
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow = '0 10px 28px rgba(31,36,33,0.045)';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
      data-testid={`practitioner-patient-card-${p.patient_id}`}
    >
      <div className="px-4 py-4 flex items-center gap-3">
        {hasRisk && (
          <div
            className="w-1 self-stretch rounded-full flex-shrink-0"
            style={{ backgroundColor: isHighMed ? c.border : 'var(--sma-risk-low-border)' }}
          />
        )}

        {/* Avatar */}
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-bold"
          style={{ backgroundColor: 'var(--sma-surface-alt)', color: 'var(--sma-brand)' }}
        >
          {p.name?.[0]}
        </div>

        {/* Name + demographics */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm" style={{ fontFamily: 'Outfit', color: 'var(--sma-text-primary)' }}>
              {p.name}
            </span>
            {hasRisk && (
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                title={riskLabel || undefined}
                style={{ backgroundColor: 'var(--sma-surface)', color: c.text, border: `1px solid ${c.border}`, textTransform: 'capitalize' }}
              >
                <RIcon className="w-3 h-3" />
                {p.latest_risk_level} · {p.latest_risk_score}
              </span>
            )}
          </div>
          <p className="text-xs" style={{ color: 'var(--sma-text-muted)' }}>
            {[age ? `${age} yrs` : null, p.gender, p.dob ? `DOB: ${p.dob}` : null].filter(Boolean).join(' · ')}
          </p>
        </div>

        {/* Arrow */}
        <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--sma-text-muted)' }} />
      </div>
    </div>
  );
}

/* ======================== FAMILY PATIENT CARD ======================== */
function FamilyPatientCard({ patient: p, navigate }) {
  const hasRisk    = !!p.latest_risk_level;
  const c          = riskColor(p.latest_risk_level);
  const isHighMed  = p.latest_risk_level === 'high' || p.latest_risk_level === 'medium';
  const RIcon      = p.latest_risk_level === 'high' ? AlertTriangle : p.latest_risk_level === 'medium' ? Shield : CheckCircle;
  const pFirstName = p.name?.split(' ')[0] || 'Your loved one';
  const destination = hasRisk ? `/results/${p.patient_id}` : `/upload/${p.patient_id}`;
  const riskLabel = p.latest_risk_level ? `${p.latest_risk_level.charAt(0).toUpperCase()}${p.latest_risk_level.slice(1)} risk` : null;

  const riskMsg = {
    high:   `${pFirstName}'s medications include some that may cause side effects or interact in older adults. A GP review is needed urgently.`,
    medium: `${pFirstName}'s medications may need checking. A GP or pharmacist review is recommended in the next 1–2 weeks.`,
    low:    `${pFirstName}'s current medications appear low risk. Keep attending scheduled follow-up appointments.`,
  };

  return (
    <div
      className="rounded-2xl overflow-hidden cursor-pointer"
      style={{
        backgroundColor: 'var(--sma-surface)',
        border: '1px solid var(--sma-border)',
        boxShadow: '0 10px 28px rgba(31,36,33,0.045)',
        transition: 'box-shadow 0.15s, transform 0.15s',
      }}
      onClick={() => navigate(destination)}
      onMouseEnter={e => {
        e.currentTarget.style.boxShadow = '0 16px 34px rgba(31,36,33,0.08)';
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow = '0 10px 28px rgba(31,36,33,0.045)';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
      data-testid={`family-patient-card-${p.patient_id}`}
    >
      <div className="p-4">
        {/* Header row */}
        <div className="flex items-center gap-3 mb-3">
          {hasRisk && (
            <div
              className="w-1 self-stretch rounded-full flex-shrink-0"
              style={{ backgroundColor: isHighMed ? c.border : 'var(--sma-risk-low-border)' }}
            />
          )}
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0"
            style={{ backgroundColor: 'var(--sma-surface-alt)', color: 'var(--sma-brand)' }}
          >
            {p.name?.[0]}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm" style={{ fontFamily: 'Outfit', color: 'var(--sma-text-primary)' }}>{p.name}</span>
              {hasRisk && (
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                  style={{ backgroundColor: 'var(--sma-surface)', color: c.text, border: `1px solid ${c.border}` }}
                  data-testid={`patient-risk-banner-${p.patient_id}`}
                >
                  <RIcon className="w-3 h-3" />
                  {riskLabel}
                </span>
              )}
            </div>
            <p className="text-xs mt-0.5" style={{ color: 'var(--sma-text-muted)' }}>
              {p.dob ? `DOB: ${p.dob}` : 'No DOB set'}{p.gender ? ` · ${p.gender}` : ''}
            </p>
          </div>
          <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--sma-text-muted)' }} />
        </div>

        {/* Risk explanation */}
        {hasRisk && (
          <p
            className="text-sm leading-relaxed px-1"
            style={{ color: 'var(--sma-text-secondary)' }}
            data-testid={`risk-explanation-${p.patient_id}`}
          >
            {riskMsg[p.latest_risk_level]}
          </p>
        )}
      </div>
    </div>
  );
}

/* ======================== SHARED COMPONENTS ======================== */

function ActionBtn({ testId, icon: Icon, label, onClick, primary, accent, riskColor: rc }) {
  let bg     = 'var(--sma-surface-alt)';
  let color  = 'var(--sma-text-secondary)';
  let border = '1px solid var(--sma-border)';

  if (primary) { bg = 'var(--sma-brand)';    color = 'white'; border = 'none'; }
  else if (accent) { bg = 'transparent'; color = 'var(--sma-accent)'; border = `1px solid var(--sma-accent)`; }
  else if (rc)     { bg = rc.bg; color = rc.text; border = `1px solid ${rc.border}`; }

  return (
    <button
      data-testid={testId}
      onClick={onClick}
      className="flex items-center justify-center gap-1.5 h-8 px-3 rounded-xl text-xs font-medium transition-opacity hover:opacity-80 w-full"
      style={{ backgroundColor: bg, color, border }}
    >
      <Icon className="w-3.5 h-3.5 flex-shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  );
}

function StatCard({ icon: Icon, label, value, color, bg, compact = false, accentBorder = null, onClick = null }) {
  return (
    <div
      className={`p-4 rounded-2xl${onClick ? ' cursor-pointer' : ''}`}
      style={{
        backgroundColor: bg || 'var(--sma-surface)',
        border: '1px solid var(--sma-border)',
        boxShadow: '0 10px 28px rgba(31,36,33,0.04)',
        ...(accentBorder ? { borderTop: `3px solid ${accentBorder}` } : {}),
        transition: onClick ? 'box-shadow 0.15s, transform 0.15s' : undefined,
      }}
      onClick={onClick}
      onMouseEnter={onClick ? (e => {
        e.currentTarget.style.boxShadow = '0 16px 34px rgba(31,36,33,0.08)';
        e.currentTarget.style.transform = 'translateY(-1px)';
      }) : undefined}
      onMouseLeave={onClick ? (e => {
        e.currentTarget.style.boxShadow = '0 10px 28px rgba(31,36,33,0.04)';
        e.currentTarget.style.transform = 'translateY(0)';
      }) : undefined}
      data-testid={`stat-${label.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--sma-surface-alt)' }}>
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
        <p className="text-xs font-medium" style={{ color: 'var(--sma-text-muted)' }}>{label}</p>
        {onClick && <ChevronRight className="w-3.5 h-3.5 ml-auto" style={{ color: 'var(--sma-text-muted)' }} />}
      </div>
      <p className={`${compact ? 'text-2xl' : 'text-3xl'} font-bold`} style={{ fontFamily: 'Outfit', color }}>{value}</p>
    </div>
  );
}

function EmptyState({ icon: Icon, title, subtitle, action }) {
  return (
    <div
      className="flex flex-col items-center justify-center py-16 px-6 text-center rounded-2xl mb-8"
      style={{ backgroundColor: 'var(--sma-surface)', border: '1px dashed var(--sma-border)' }}
    >
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: 'var(--sma-surface-alt)' }}>
        <Icon className="w-7 h-7" style={{ color: 'var(--sma-text-muted)' }} />
      </div>
      <h3 className="text-lg font-semibold mb-2" style={{ fontFamily: 'Outfit', color: 'var(--sma-text-primary)' }}>{title}</h3>
      <p className="text-sm mb-6 max-w-sm" style={{ color: 'var(--sma-text-secondary)' }}>{subtitle}</p>
      {action}
    </div>
  );
}

function Disclaimer() {
  return (
    <div
      className="mt-4 p-4 rounded-xl flex items-start gap-2"
      style={{ backgroundColor: 'var(--sma-surface-alt)', color: 'var(--sma-text-muted)' }}
      data-testid="dashboard-disclaimer"
    >
      <Shield className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: 'var(--sma-text-muted)' }} />
      <p className="text-xs">Always talk to a doctor or pharmacist before making any changes to medication.</p>
    </div>
  );
}

const riskColor = (level) => ({
  high:   { bg: 'var(--sma-risk-high-bg)',  border: 'var(--sma-risk-high-border)',  text: 'var(--sma-risk-high-text)' },
  medium: { bg: 'var(--sma-risk-med-bg)',   border: 'var(--sma-risk-med-border)',   text: 'var(--sma-risk-med-text)' },
  low:    { bg: 'var(--sma-risk-low-bg)',   border: 'var(--sma-risk-low-border)',   text: 'var(--sma-risk-low-text)' },
}[level] || { bg: 'var(--sma-surface-alt)', border: 'var(--sma-border)', text: 'var(--sma-text-secondary)' });
