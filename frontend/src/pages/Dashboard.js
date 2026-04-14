import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import Sidebar from '@/components/Sidebar';
import { Button } from '@/components/ui/button';
import {
  Users, FileText, AlertTriangle, Bell, ArrowRight, Plus, CheckCircle,
  Loader2, Shield, Download, Upload, MessageCircle, BarChart3, Phone,
  Stethoscope, Heart, Pill, ExternalLink, BookOpen, Activity, TrendingUp,
  Clock, ChevronRight, User
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [exporting, setExporting] = useState(false);
  const isPractitioner = user?.role === 'medical_practitioner';

  useEffect(() => { fetchStats(); }, []);

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
    } catch {
      toast.error('Failed to load demo data');
    } finally {
      setSeeding(false);
    }
  };

  const handleExportPatients = async () => {
    setExporting(true);
    try {
      const res = await axios.get(`${API}/export/patients`, { withCredentials: true, responseType: 'blob' });
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
          <PractitionerDashboard
            stats={stats} loading={loading} seeding={seeding} exporting={exporting}
            onSeed={handleSeed} onExport={handleExportPatients}
            navigate={navigate} user={user}
          />
        ) : (
          <FamilyDashboard
            stats={stats} loading={loading} seeding={seeding}
            onSeed={handleSeed} navigate={navigate} user={user}
          />
        )}
      </main>
    </div>
  );
}

/* ======================== PRACTITIONER DASHBOARD ======================== */
function PractitionerDashboard({ stats, loading, seeding, exporting, onSeed, onExport, navigate, user }) {
  const firstName = user?.name?.split(' ')[0] || 'Doctor';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-6xl mx-auto animate-fade-in">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <p className="text-sm font-medium mb-1" style={{ color: 'var(--sma-brand)' }}>
              {greeting},
            </p>
            <h1 className="text-3xl font-semibold tracking-tight" style={{ fontFamily: 'Outfit', color: 'var(--sma-text-primary)' }}>
              {firstName}
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--sma-text-secondary)' }}>
              {new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {stats?.total_patients > 0 && (
              <Button
                data-testid="export-patients-btn"
                onClick={onExport}
                disabled={exporting}
                variant="outline"
                className="h-10 px-4 rounded-xl font-medium text-sm gap-2"
                style={{ borderColor: 'var(--sma-border)', color: 'var(--sma-text-secondary)' }}
              >
                {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Export CSV
              </Button>
            )}
            {stats?.total_patients === 0 && (
              <Button
                data-testid="seed-demo-btn"
                onClick={onSeed}
                disabled={seeding}
                className="h-10 px-4 rounded-xl font-medium text-sm gap-2"
                style={{ backgroundColor: 'var(--sma-accent)', color: 'white' }}
              >
                {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
                {seeding ? 'Loading...' : 'Load Demo Data'}
              </Button>
            )}
            <Button
              data-testid="add-patient-btn"
              onClick={() => navigate('/patients')}
              className="h-10 px-5 rounded-xl font-medium text-sm gap-2"
              style={{ backgroundColor: 'var(--sma-brand)', color: 'white' }}
            >
              <Plus className="w-4 h-4" /> New Patient
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
            {/* Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <StatCard icon={Users} label="Total Patients" value={stats?.total_patients || 0} color="var(--sma-brand)" bg="var(--sma-surface)" />
              <StatCard icon={FileText} label="Documents" value={stats?.total_documents || 0} color="var(--sma-brand)" bg="var(--sma-surface)" />
              <StatCard icon={AlertTriangle} label="High Risk" value={stats?.high_risk || 0} color="var(--sma-risk-high-text)" bg="var(--sma-risk-high-bg)" />
              <StatCard icon={Bell} label="Unread Alerts" value={stats?.unread_alerts || 0} color="var(--sma-risk-med-text)" bg="var(--sma-risk-med-bg)" />
            </div>

            {/* Risk Breakdown Row */}
            {stats?.total_patients > 0 && (
              <div className="grid grid-cols-3 gap-4 mb-8">
                {['low', 'medium', 'high'].map((level) => {
                  const c = riskColor(level);
                  const icons = { low: CheckCircle, medium: Shield, high: AlertTriangle };
                  const Icon = icons[level];
                  const counts = { low: stats?.low_risk || 0, medium: stats?.medium_risk || 0, high: stats?.high_risk || 0 };
                  const total = stats?.total_patients || 1;
                  const pct = Math.round((counts[level] / total) * 100);
                  return (
                    <div
                      key={level}
                      className="p-5 rounded-2xl"
                      style={{ backgroundColor: c.bg, border: `1px solid ${c.border}` }}
                      data-testid={`risk-summary-${level}`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${c.border}30` }}>
                          <Icon className="w-5 h-5" style={{ color: c.text }} />
                        </div>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${c.border}30`, color: c.text }}>
                          {pct}%
                        </span>
                      </div>
                      <p className="text-2xl font-bold" style={{ fontFamily: 'Outfit', color: c.text }}>{counts[level]}</p>
                      <p className="text-xs font-medium mt-0.5 capitalize" style={{ color: c.text }}>{level} Risk</p>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Recent Patients */}
            {stats?.recent_patients?.length > 0 ? (
              <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold" style={{ fontFamily: 'Outfit', color: 'var(--sma-text-primary)' }}>
                    Recent Patients
                  </h2>
                  <button
                    data-testid="view-all-patients-btn"
                    onClick={() => navigate('/patients')}
                    className="flex items-center gap-1 text-sm font-medium transition-opacity hover:opacity-70"
                    style={{ color: 'var(--sma-brand)' }}
                  >
                    View all <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-3">
                  {stats.recent_patients.map((p) => (
                    <PractitionerPatientCard key={p.patient_id} patient={p} navigate={navigate} />
                  ))}
                </div>
              </div>
            ) : (
              <EmptyState
                icon={Users}
                title="No patients yet"
                subtitle="Add a patient or load demo data to see the dashboard in action."
                action={
                  <div className="flex gap-3 justify-center">
                    <Button
                      data-testid="seed-demo-btn"
                      onClick={onSeed}
                      disabled={seeding}
                      variant="outline"
                      className="h-10 px-5 rounded-xl font-medium text-sm"
                      style={{ borderColor: 'var(--sma-brand)', color: 'var(--sma-brand)' }}
                    >
                      {seeding ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                      Load Demo Data
                    </Button>
                    <Button
                      data-testid="add-patient-empty-btn"
                      onClick={() => navigate('/patients')}
                      className="h-10 px-5 rounded-xl font-medium text-sm"
                      style={{ backgroundColor: 'var(--sma-brand)', color: 'white' }}
                    >
                      <Plus className="w-4 h-4 mr-2" /> Add Patient
                    </Button>
                  </div>
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

/* ======================== FAMILY DASHBOARD ======================== */
function FamilyDashboard({ stats, loading, seeding, onSeed, navigate, user }) {
  const firstName = user?.name?.split(' ')[0] || 'there';
  const highRiskPatients = stats?.recent_patients?.filter(p => p.latest_risk_level === 'high') || [];
  const medRiskPatients = stats?.recent_patients?.filter(p => p.latest_risk_level === 'medium') || [];

  React.useEffect(() => {
    if (!loading && stats?.recent_patients?.length === 1) {
      navigate(`/upload/${stats.recent_patients[0].patient_id}`, { replace: true });
    }
  }, [loading, stats, navigate]);

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-3xl mx-auto animate-fade-in">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-sm font-medium mb-1" style={{ color: 'var(--sma-brand)' }}>Welcome back,</p>
            <h1 className="text-3xl font-semibold tracking-tight" style={{ fontFamily: 'Outfit', color: 'var(--sma-text-primary)' }}>
              {firstName}
            </h1>
          </div>
          <div className="flex gap-3">
            {stats?.total_patients === 0 && (
              <Button
                data-testid="seed-demo-btn"
                onClick={onSeed}
                disabled={seeding}
                variant="outline"
                className="h-10 px-4 rounded-xl text-sm font-medium"
                style={{ borderColor: 'var(--sma-accent)', color: 'var(--sma-accent)' }}
              >
                {seeding ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Try a Demo
              </Button>
            )}
            <Button
              data-testid="add-patient-btn"
              onClick={() => navigate('/patients')}
              className="h-10 px-5 rounded-xl text-sm font-medium gap-2"
              style={{ backgroundColor: 'var(--sma-brand)', color: 'white' }}
            >
              <Plus className="w-4 h-4" /> Add Loved One
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-3">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--sma-brand)' }} />
            <p className="text-sm" style={{ color: 'var(--sma-text-muted)' }}>Loading…</p>
          </div>
        ) : (
          <>
            {/* Urgent Alert Banners */}
            {highRiskPatients.length > 0 && (
              <div
                className="mb-5 p-5 rounded-2xl"
                style={{ backgroundColor: 'var(--sma-risk-high-bg)', border: '2px solid var(--sma-risk-high-border)' }}
                data-testid="high-risk-alert-banner"
              >
                <div className="flex gap-4">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--sma-risk-high-border)' }}>
                    <AlertTriangle className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="font-semibold mb-1" style={{ color: 'var(--sma-risk-high-text)', fontFamily: 'Outfit' }}>
                      Urgent: Medication Review Needed
                    </h2>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--sma-risk-high-text)' }}>
                      <strong>{highRiskPatients.map(p => p.name).join(', ')}</strong> {highRiskPatients.length === 1 ? 'has' : 'have'} a high medication risk score. Please book a GP appointment and request a pharmacist medication review as soon as possible.
                    </p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <Button data-testid="alert-book-gp-btn" size="sm" className="h-8 rounded-lg text-xs font-semibold" style={{ backgroundColor: 'var(--sma-risk-high-border)', color: 'white' }}>
                        <Phone className="w-3 h-3 mr-1.5" /> Book GP Appointment
                      </Button>
                      <Button data-testid="alert-call-pharmacist-btn" size="sm" className="h-8 rounded-lg text-xs font-semibold" style={{ backgroundColor: 'var(--sma-risk-high-border)', color: 'white' }}>
                        <Pill className="w-3 h-3 mr-1.5" /> Request Pharmacist Review
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {medRiskPatients.length > 0 && (
              <div
                className="mb-5 p-5 rounded-2xl"
                style={{ backgroundColor: 'var(--sma-risk-med-bg)', border: '1px solid var(--sma-risk-med-border)' }}
                data-testid="medium-risk-alert-banner"
              >
                <div className="flex gap-4">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--sma-risk-med-border)' }}>
                    <Shield className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="font-semibold mb-1" style={{ color: 'var(--sma-risk-med-text)', fontFamily: 'Outfit' }}>
                      Medication Review Recommended
                    </h2>
                    <p className="text-sm" style={{ color: 'var(--sma-risk-med-text)' }}>
                      <strong>{medRiskPatients.map(p => p.name).join(', ')}</strong> {medRiskPatients.length === 1 ? 'has' : 'have'} a medium risk score. Consider booking a GP appointment in the next 1–2 weeks.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              <StatCard icon={Users} label="My Family" value={stats?.total_patients || 0} color="var(--sma-brand)" bg="var(--sma-surface)" />
              <StatCard icon={FileText} label="Summaries" value={stats?.total_documents || 0} color="var(--sma-brand)" bg="var(--sma-surface)" />
              <StatCard
                icon={AlertTriangle}
                label="Need Attention"
                value={(stats?.high_risk || 0) + (stats?.medium_risk || 0)}
                color="var(--sma-risk-high-text)"
                bg="var(--sma-risk-high-bg)"
              />
            </div>

            {/* Patient Cards */}
            {stats?.recent_patients?.length > 0 ? (
              <div className="mb-8">
                <h2 className="text-lg font-semibold mb-4" style={{ fontFamily: 'Outfit', color: 'var(--sma-text-primary)' }}>
                  My Family
                </h2>
                <div className="space-y-4">
                  {stats.recent_patients.map((p) => (
                    <FamilyPatientCard key={p.patient_id} patient={p} navigate={navigate} />
                  ))}
                </div>
              </div>
            ) : (
              <EmptyState
                icon={Heart}
                title="No loved ones added yet"
                subtitle="Add your loved one's details and upload their discharge summary to get started."
                action={
                  <Button
                    data-testid="family-add-patient-btn"
                    onClick={() => navigate('/patients')}
                    className="h-10 px-6 rounded-xl font-medium text-sm gap-2"
                    style={{ backgroundColor: 'var(--sma-brand)', color: 'white' }}
                  >
                    <Plus className="w-4 h-4" /> Add Loved One
                  </Button>
                }
              />
            )}

            {/* Helpful Contacts */}
            {stats?.total_patients > 0 && (
              <div className="rounded-2xl p-6 mb-6" style={{ backgroundColor: 'var(--sma-surface)', border: '1px solid var(--sma-border)' }}>
                <h2 className="text-base font-semibold mb-4 flex items-center gap-2" style={{ fontFamily: 'Outfit', color: 'var(--sma-text-primary)' }}>
                  <Phone className="w-4 h-4" style={{ color: 'var(--sma-brand)' }} /> Helpful Contacts
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { icon: Stethoscope, label: 'Book GP Appointment', desc: 'Contact your usual GP for a medication review', color: 'var(--sma-brand)' },
                    { icon: Pill, label: 'Pharmacist Review', desc: 'Ask your local pharmacy for a medicines check', color: 'var(--sma-accent)' },
                    { icon: Phone, label: 'Health Advice Line', desc: 'Call 1800 022 222 for health advice (AU)', color: 'var(--sma-risk-med-text)' },
                    { icon: AlertTriangle, label: 'Emergency: 000', desc: 'Call immediately for medical emergencies', color: 'var(--sma-risk-high-text)' },
                  ].map((item, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 p-3 rounded-xl"
                      style={{ backgroundColor: 'var(--sma-surface-alt)' }}
                      data-testid={`contact-card-${i}`}
                    >
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--sma-surface)' }}>
                        <item.icon className="w-4 h-4" style={{ color: item.color }} />
                      </div>
                      <div>
                        <p className="text-sm font-medium" style={{ color: 'var(--sma-text-primary)' }}>{item.label}</p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--sma-text-muted)' }}>{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Disclaimer />
          </>
        )}
      </div>
    </div>
  );
}

/* ======================== PRACTITIONER PATIENT CARD ======================== */
function PractitionerPatientCard({ patient: p, navigate }) {
  const hasRisk = !!p.latest_risk_level;
  const c = riskColor(p.latest_risk_level);
  const isHighMed = p.latest_risk_level === 'high' || p.latest_risk_level === 'medium';
  const RIcon = p.latest_risk_level === 'high' ? AlertTriangle : p.latest_risk_level === 'medium' ? Shield : CheckCircle;

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        backgroundColor: 'var(--sma-surface)',
        border: hasRisk && isHighMed ? `1.5px solid ${c.border}` : '1px solid var(--sma-border)',
      }}
      data-testid={`practitioner-patient-card-${p.patient_id}`}
    >
      {/* Coloured top strip for risky patients */}
      {hasRisk && isHighMed && (
        <div className="h-1 w-full" style={{ backgroundColor: c.border }} />
      )}

      <div className="p-5">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 text-base font-bold"
            style={{ backgroundColor: hasRisk ? c.bg : 'var(--sma-surface-alt)', color: hasRisk ? c.text : 'var(--sma-brand)' }}
          >
            {p.name?.[0]}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-base" style={{ fontFamily: 'Outfit', color: 'var(--sma-text-primary)' }}>{p.name}</h3>
              {hasRisk && (
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
                  style={{ backgroundColor: c.bg, color: c.text }}
                >
                  <RIcon className="w-3 h-3" />
                  {p.latest_risk_level} risk · {p.latest_risk_score}
                </span>
              )}
            </div>
            <p className="text-xs mt-0.5" style={{ color: 'var(--sma-text-muted)' }}>
              DOB: {p.dob || 'N/A'}{p.gender ? ` · ${p.gender}` : ''}
            </p>
          </div>

          {/* Profile link */}
          <Button
            data-testid={`prac-view-profile-${p.patient_id}`}
            onClick={() => navigate(`/patients/${p.patient_id}`)}
            variant="ghost"
            size="sm"
            className="text-xs h-8 px-3 rounded-lg flex-shrink-0"
            style={{ color: 'var(--sma-brand)' }}
          >
            Profile <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
          </Button>
        </div>

        {/* Action Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
          <ActionBtn
            testId={`prac-upload-${p.patient_id}`}
            icon={Upload}
            label="Upload"
            onClick={() => navigate(`/upload/${p.patient_id}`)}
            primary
          />
          <ActionBtn
            testId={`prac-results-${p.patient_id}`}
            icon={BarChart3}
            label={hasRisk ? 'Risk Score' : 'No Score'}
            onClick={() => navigate(`/results/${p.patient_id}`)}
            riskColor={hasRisk ? c : null}
          />
          <ActionBtn
            testId={`prac-chat-${p.patient_id}`}
            icon={MessageCircle}
            label="Clinical Q&A"
            onClick={() => navigate(`/chat/${p.patient_id}`)}
            accent
          />
          <ActionBtn
            testId={`prac-history-${p.patient_id}`}
            icon={Clock}
            label="History"
            onClick={() => navigate(`/history/${p.patient_id}`)}
          />
        </div>

        {/* Deprescribing link */}
        {isHighMed && (
          <a
            href="https://kiktools.amsterdamumc.org/falls/decision-tree/"
            target="_blank"
            rel="noopener noreferrer"
            data-testid={`deprescribing-link-${p.patient_id}`}
            className="flex items-center gap-3 p-3 rounded-xl mt-3 transition-opacity hover:opacity-80"
            style={{ backgroundColor: '#EDE9FE', border: '1px solid #C4B5FD' }}
          >
            <BookOpen className="w-4 h-4 flex-shrink-0" style={{ color: '#6D28D9' }} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold" style={{ color: '#5B21B6' }}>Medication Withdrawal Guidelines</p>
              <p className="text-[11px]" style={{ color: '#7C3AED' }}>Amsterdam UMC CAREFREE deprescribing decision tree</p>
            </div>
            <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#6D28D9' }} />
          </a>
        )}
      </div>
    </div>
  );
}

/* ======================== FAMILY PATIENT CARD ======================== */
function FamilyPatientCard({ patient: p, navigate }) {
  const hasRisk = !!p.latest_risk_level;
  const c = riskColor(p.latest_risk_level);
  const RIcon = p.latest_risk_level === 'high' ? AlertTriangle : p.latest_risk_level === 'medium' ? Shield : CheckCircle;

  const riskMsg = {
    high: 'Some medicines may interact or cause side effects. Please seek a medication review urgently.',
    medium: 'Some medications may need checking. Consider booking a GP or pharmacist review soon.',
    low: 'The current medications appear to have a low risk profile. Keep attending follow-up appointments.',
  };

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ backgroundColor: 'var(--sma-surface)', border: '1px solid var(--sma-border)' }}
      data-testid={`family-patient-card-${p.patient_id}`}
    >
      {hasRisk && <div className="h-1 w-full" style={{ backgroundColor: c.border }} />}

      <div className="p-5">
        {/* Patient Info */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center text-base font-bold"
              style={{ backgroundColor: hasRisk ? c.bg : 'var(--sma-surface-alt)', color: hasRisk ? c.text : 'var(--sma-brand)' }}
            >
              {p.name?.[0]}
            </div>
            <div>
              <h3 className="font-semibold" style={{ fontFamily: 'Outfit', color: 'var(--sma-text-primary)' }}>{p.name}</h3>
              <p className="text-xs mt-0.5" style={{ color: 'var(--sma-text-muted)' }}>
                DOB: {p.dob || 'Not set'}{p.gender ? ` · ${p.gender}` : ''}
              </p>
            </div>
          </div>
          {hasRisk && (
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold flex-shrink-0"
              style={{ backgroundColor: c.bg, color: c.text }}
              data-testid={`patient-risk-banner-${p.patient_id}`}
            >
              <RIcon className="w-3.5 h-3.5" />
              {p.latest_risk_level} · {p.latest_risk_score}
            </span>
          )}
        </div>

        {/* Risk explanation */}
        {hasRisk && (
          <div
            className="p-4 rounded-xl mb-4 text-sm leading-relaxed"
            style={{ backgroundColor: c.bg, color: c.text }}
            data-testid={`risk-explanation-${p.patient_id}`}
          >
            {riskMsg[p.latest_risk_level] || riskMsg.low}
          </div>
        )}

        {/* Actions */}
        <div className="grid grid-cols-3 gap-2">
          <ActionBtn
            testId={`family-upload-${p.patient_id}`}
            icon={Upload}
            label="Upload"
            onClick={() => navigate(`/upload/${p.patient_id}`)}
            primary
          />
          <ActionBtn
            testId={`family-view-analysis-${p.patient_id}`}
            icon={TrendingUp}
            label={hasRisk ? 'View Analysis' : 'No Analysis'}
            onClick={() => navigate(`/results/${p.patient_id}`)}
            riskColor={hasRisk ? c : null}
          />
          <ActionBtn
            testId={`family-ask-questions-${p.patient_id}`}
            icon={MessageCircle}
            label="Ask Questions"
            onClick={() => navigate(`/chat/${p.patient_id}`)}
            accent
          />
        </div>
      </div>
    </div>
  );
}

/* ======================== SHARED COMPONENTS ======================== */

function ActionBtn({ testId, icon: Icon, label, onClick, primary, accent, riskColor: rc }) {
  let bg = 'var(--sma-surface-alt)';
  let color = 'var(--sma-text-secondary)';
  let border = '1px solid var(--sma-border)';

  if (primary) { bg = 'var(--sma-brand)'; color = 'white'; border = 'none'; }
  else if (accent) { bg = 'transparent'; color = 'var(--sma-accent)'; border = `1px solid var(--sma-accent)`; }
  else if (rc) { bg = rc.bg; color = rc.text; border = `1px solid ${rc.border}`; }

  return (
    <button
      data-testid={testId}
      onClick={onClick}
      className="flex items-center justify-center gap-1.5 h-9 px-3 rounded-xl text-xs font-medium transition-opacity hover:opacity-80 w-full"
      style={{ backgroundColor: bg, color, border }}
    >
      <Icon className="w-3.5 h-3.5 flex-shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  );
}

function StatCard({ icon: Icon, label, value, color, bg }) {
  return (
    <div
      className="p-5 rounded-2xl"
      style={{ backgroundColor: bg, border: '1px solid var(--sma-border)' }}
      data-testid={`stat-${label.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4" style={{ color }} />
        <p className="text-xs font-medium" style={{ color: 'var(--sma-text-muted)' }}>{label}</p>
      </div>
      <p className="text-3xl font-bold" style={{ fontFamily: 'Outfit', color }}>{value}</p>
    </div>
  );
}

function EmptyState({ icon: Icon, title, subtitle, action }) {
  return (
    <div
      className="flex flex-col items-center justify-center py-16 px-6 text-center rounded-2xl mb-8"
      style={{ backgroundColor: 'var(--sma-surface)', border: '1px dashed var(--sma-border)' }}
    >
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
        style={{ backgroundColor: 'var(--sma-surface-alt)' }}
      >
        <Icon className="w-8 h-8" style={{ color: 'var(--sma-text-muted)' }} />
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
      className="mt-4 p-4 rounded-xl text-xs text-center"
      style={{ backgroundColor: 'var(--sma-surface-alt)', color: 'var(--sma-text-muted)' }}
      data-testid="dashboard-disclaimer"
    >
      This tool provides decision support only and does not replace professional medical judgment. Always consult a qualified healthcare professional.
    </div>
  );
}

const riskColor = (level) => ({
  high:   { bg: 'var(--sma-risk-high-bg)',  border: 'var(--sma-risk-high-border)',  text: 'var(--sma-risk-high-text)' },
  medium: { bg: 'var(--sma-risk-med-bg)',   border: 'var(--sma-risk-med-border)',   text: 'var(--sma-risk-med-text)' },
  low:    { bg: 'var(--sma-risk-low-bg)',   border: 'var(--sma-risk-low-border)',   text: 'var(--sma-risk-low-text)' },
}[level] || { bg: 'var(--sma-surface-alt)', border: 'var(--sma-border)', text: 'var(--sma-text-secondary)' });
