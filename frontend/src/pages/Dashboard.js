import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import Sidebar from '@/components/Sidebar';
import { Button } from '@/components/ui/button';
import { Users, FileText, AlertTriangle, Bell, ArrowRight, Plus, CheckCircle, Loader2, Shield, Download, Upload, MessageCircle, BarChart3, Phone, Stethoscope, Heart, Pill } from 'lucide-react';
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
    } catch (err) {
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
      const link = document.createElement('a'); link.href = url; link.setAttribute('download', `patients_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link); link.click(); link.remove();
      toast.success('Patients exported');
    } catch (err) { toast.error('Export failed'); }
    finally { setExporting(false); }
  };

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: 'var(--sma-bg)' }}>
      <Sidebar />
      <main className="flex-1 p-8" data-testid="dashboard-main">
        <div className="max-w-6xl mx-auto animate-fade-in">
          {isPractitioner ? (
            <PractitionerDashboard stats={stats} loading={loading} seeding={seeding} exporting={exporting} onSeed={handleSeed} onExport={handleExportPatients} navigate={navigate} user={user} />
          ) : (
            <FamilyDashboard stats={stats} loading={loading} seeding={seeding} onSeed={handleSeed} navigate={navigate} user={user} />
          )}
        </div>
      </main>
    </div>
  );
}

/* ======================== PRACTITIONER DASHBOARD ======================== */
function PractitionerDashboard({ stats, loading, seeding, exporting, onSeed, onExport, navigate, user }) {
  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight" style={{ fontFamily: 'Outfit', color: 'var(--sma-text-primary)' }}>Practitioner Dashboard</h1>
          <p className="text-base mt-1" style={{ color: 'var(--sma-text-secondary)' }}>Welcome back, {user?.name?.split(' ')[0]}</p>
        </div>
        <div className="flex gap-3">
          {stats?.total_patients > 0 && (
            <Button data-testid="export-patients-btn" onClick={onExport} disabled={exporting} variant="outline" className="h-11 px-5 rounded-full font-medium" style={{ borderColor: 'var(--sma-brand)', color: 'var(--sma-brand)' }}>
              {exporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />} Export CSV
            </Button>
          )}
          {stats?.total_patients === 0 && (
            <Button data-testid="seed-demo-btn" onClick={onSeed} disabled={seeding} className="h-11 px-5 rounded-full font-medium" style={{ backgroundColor: 'var(--sma-accent)', color: 'var(--sma-text-inverse)' }}>
              {seeding ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading Demo...</> : 'Load Demo Data'}
            </Button>
          )}
          <Button data-testid="add-patient-btn" onClick={() => navigate('/patients')} className="h-11 px-5 rounded-full font-medium hover:-translate-y-0.5" style={{ backgroundColor: 'var(--sma-brand)', color: 'var(--sma-text-inverse)' }}>
            <Plus className="w-4 h-4 mr-2" /> New Patient
          </Button>
        </div>
      </div>

      {loading ? <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--sma-brand)' }} /></div> : (
        <>
          <div className="grid gap-6 mb-8 grid-cols-1 md:grid-cols-3 lg:grid-cols-4">
            <StatCard icon={Users} label="Patients" value={stats?.total_patients || 0} color="var(--sma-brand)" />
            <StatCard icon={FileText} label="Documents" value={stats?.total_documents || 0} color="var(--sma-brand)" />
            <StatCard icon={AlertTriangle} label="High Risk" value={stats?.high_risk || 0} color="var(--sma-risk-high-text)" accent="var(--sma-risk-high-bg)" />
            <StatCard icon={Bell} label="Unread Alerts" value={stats?.unread_alerts || 0} color="var(--sma-risk-med-text)" accent="var(--sma-risk-med-bg)" />
          </div>
          <div className="grid gap-6 mb-8 grid-cols-1 md:grid-cols-3">
            {['low', 'medium', 'high'].map((level) => {
              const c = riskColor(level);
              return (
                <div key={level} className="p-6 rounded-xl" style={{ backgroundColor: c.bg, border: `1px solid ${c.border}` }} data-testid={`risk-summary-${level}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm uppercase tracking-[0.15em] font-semibold" style={{ color: c.text }}>{level} Risk</p>
                      <p className="text-3xl font-semibold mt-1" style={{ fontFamily: 'Outfit', color: c.text }}>{stats?.[`${level}_risk`] || 0}</p>
                    </div>
                    {level === 'high' && <AlertTriangle className="w-8 h-8" style={{ color: c.text }} />}
                    {level === 'medium' && <Shield className="w-8 h-8" style={{ color: c.text }} />}
                    {level === 'low' && <CheckCircle className="w-8 h-8" style={{ color: c.text }} />}
                  </div>
                </div>
              );
            })}
          </div>
          <RecentPatientsList stats={stats} navigate={navigate} />
          {stats?.total_patients === 0 && (
            <div className="text-center py-16 rounded-xl" style={{ backgroundColor: 'var(--sma-surface)', border: '1px solid var(--sma-border)' }}>
              <Users className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--sma-text-muted)' }} />
              <h3 className="text-xl font-medium mb-2" style={{ fontFamily: 'Outfit', color: 'var(--sma-text-primary)' }}>No patients yet</h3>
              <p className="mb-4" style={{ color: 'var(--sma-text-secondary)' }}>Add a patient or load demo data to get started</p>
            </div>
          )}
          <Disclaimer />
        </>
      )}
    </>
  );
}

/* ======================== FAMILY / CARER DASHBOARD ======================== */
function FamilyDashboard({ stats, loading, seeding, onSeed, navigate, user }) {
  const highRiskPatients = stats?.recent_patients?.filter(p => p.latest_risk_level === 'high') || [];
  const medRiskPatients = stats?.recent_patients?.filter(p => p.latest_risk_level === 'medium') || [];
  const hasAlerts = highRiskPatients.length > 0 || medRiskPatients.length > 0;

  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight" style={{ fontFamily: 'Outfit', color: 'var(--sma-text-primary)' }}>Family Dashboard</h1>
          <p className="text-base mt-1" style={{ color: 'var(--sma-text-secondary)' }}>Welcome back, {user?.name?.split(' ')[0]}. Here's what needs your attention.</p>
        </div>
        <div className="flex gap-3">
          {stats?.total_patients === 0 && (
            <Button data-testid="seed-demo-btn" onClick={onSeed} disabled={seeding} className="h-11 px-5 rounded-full font-medium" style={{ backgroundColor: 'var(--sma-accent)', color: 'var(--sma-text-inverse)' }}>
              {seeding ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading Demo...</> : 'Load Demo Data'}
            </Button>
          )}
          <Button data-testid="add-patient-btn" onClick={() => navigate('/patients')} className="h-11 px-5 rounded-full font-medium hover:-translate-y-0.5" style={{ backgroundColor: 'var(--sma-brand)', color: 'var(--sma-text-inverse)' }}>
            <Plus className="w-4 h-4 mr-2" /> Add Loved One
          </Button>
        </div>
      </div>

      {loading ? <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--sma-brand)' }} /></div> : (
        <>
          {/* Medication Review Alert Banners */}
          {highRiskPatients.length > 0 && (
            <div className="mb-6 p-5 rounded-xl animate-fade-in" style={{ backgroundColor: 'var(--sma-risk-high-bg)', border: '2px solid var(--sma-risk-high-border)' }} data-testid="high-risk-alert-banner">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--sma-risk-high-border)' }}>
                  <AlertTriangle className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-semibold" style={{ fontFamily: 'Outfit', color: 'var(--sma-risk-high-text)' }}>Urgent: Medication Review Needed</h2>
                  <p className="text-sm mt-1" style={{ color: 'var(--sma-risk-high-text)' }}>
                    {highRiskPatients.map(p => p.name).join(', ')} {highRiskPatients.length === 1 ? 'has' : 'have'} a <strong>high risk</strong> medication score. Please book a GP appointment as soon as possible and request a pharmacist medication review.
                  </p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Button data-testid="alert-book-gp-btn" size="sm" className="h-8 rounded-full text-xs font-semibold" style={{ backgroundColor: 'var(--sma-risk-high-border)', color: 'white' }}>
                      <Phone className="w-3.5 h-3.5 mr-1" /> Book GP Appointment
                    </Button>
                    <Button data-testid="alert-call-pharmacist-btn" size="sm" className="h-8 rounded-full text-xs font-semibold" style={{ backgroundColor: 'var(--sma-risk-high-border)', color: 'white' }}>
                      <Pill className="w-3.5 h-3.5 mr-1" /> Request Pharmacist Review
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {medRiskPatients.length > 0 && (
            <div className="mb-6 p-5 rounded-xl animate-fade-in" style={{ backgroundColor: 'var(--sma-risk-med-bg)', border: '2px solid var(--sma-risk-med-border)' }} data-testid="medium-risk-alert-banner">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--sma-risk-med-border)' }}>
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold" style={{ fontFamily: 'Outfit', color: 'var(--sma-risk-med-text)' }}>Medication Review Recommended</h2>
                  <p className="text-sm mt-1" style={{ color: 'var(--sma-risk-med-text)' }}>
                    {medRiskPatients.map(p => p.name).join(', ')} {medRiskPatients.length === 1 ? 'has' : 'have'} a <strong>medium risk</strong> score. Consider booking a GP appointment in the next 1-2 weeks for a medication check.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Stats Row */}
          <div className="grid gap-6 mb-8 grid-cols-1 sm:grid-cols-3">
            <StatCard icon={Users} label="My Family" value={stats?.total_patients || 0} color="var(--sma-brand)" />
            <StatCard icon={FileText} label="Summaries Uploaded" value={stats?.total_documents || 0} color="var(--sma-brand)" />
            <StatCard icon={AlertTriangle} label="Need Attention" value={(stats?.high_risk || 0) + (stats?.medium_risk || 0)} color="var(--sma-risk-high-text)" accent="var(--sma-risk-high-bg)" />
          </div>

          {/* Patient Cards with Actions */}
          {stats?.recent_patients?.length > 0 && (
            <div className="space-y-5 mb-8">
              <h2 className="text-xl font-medium" style={{ fontFamily: 'Outfit', color: 'var(--sma-text-primary)' }}>My Family</h2>
              {stats.recent_patients.map((p) => (
                <FamilyPatientCard key={p.patient_id} patient={p} navigate={navigate} />
              ))}
            </div>
          )}

          {stats?.total_patients === 0 && (
            <div className="text-center py-16 rounded-xl" style={{ backgroundColor: 'var(--sma-surface)', border: '1px solid var(--sma-border)' }}>
              <Heart className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--sma-accent)' }} />
              <h3 className="text-xl font-medium mb-2" style={{ fontFamily: 'Outfit', color: 'var(--sma-text-primary)' }}>No loved ones added yet</h3>
              <p className="mb-4 text-sm" style={{ color: 'var(--sma-text-secondary)' }}>Add your loved one's details and upload their hospital discharge summary to get started</p>
              <Button data-testid="family-add-patient-btn" onClick={() => navigate('/patients')} className="h-12 px-6 rounded-full font-medium" style={{ backgroundColor: 'var(--sma-brand)', color: 'var(--sma-text-inverse)' }}>
                <Plus className="w-4 h-4 mr-2" /> Add Loved One
              </Button>
            </div>
          )}

          {/* Helpful Contacts */}
          {stats?.total_patients > 0 && (
            <div className="rounded-xl shadow-sm p-6 mb-6" style={{ backgroundColor: 'var(--sma-surface)', border: '1px solid var(--sma-border)' }}>
              <h2 className="text-lg font-medium mb-4 flex items-center gap-2" style={{ fontFamily: 'Outfit', color: 'var(--sma-text-primary)' }}>
                <Phone className="w-5 h-5" style={{ color: 'var(--sma-brand)' }} /> Helpful Contacts & Actions
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  { icon: Stethoscope, label: 'Book GP Appointment', desc: 'Contact your usual doctor for a medication review', color: 'var(--sma-brand)' },
                  { icon: Pill, label: 'Pharmacist Review', desc: 'Ask your local pharmacy for a medication check', color: 'var(--sma-accent)' },
                  { icon: Phone, label: 'Health Advice Line', desc: 'Call 1800 022 222 for health advice (AU)', color: 'var(--sma-risk-med-text)' },
                  { icon: AlertTriangle, label: 'Emergency: 000', desc: 'Call immediately for emergencies', color: 'var(--sma-risk-high-text)' },
                  { icon: Heart, label: 'Hospital Discharge Team', desc: 'Contact the ward that discharged your loved one', color: 'var(--sma-brand)' },
                  { icon: MessageCircle, label: 'Ask SafeMedAI', desc: 'Ask questions about the discharge summary', color: 'var(--sma-brand)' },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg transition-all duration-200 hover:-translate-y-0.5" style={{ backgroundColor: 'var(--sma-surface-alt)' }} data-testid={`contact-card-${i}`}>
                    <item.icon className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: item.color }} />
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--sma-text-primary)' }}>{item.label}</p>
                      <p className="text-xs" style={{ color: 'var(--sma-text-muted)' }}>{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Disclaimer />
        </>
      )}
    </>
  );
}

/* ======================== FAMILY PATIENT CARD ======================== */
function FamilyPatientCard({ patient: p, navigate }) {
  const hasRisk = !!p.latest_risk_level;
  const c = riskColor(p.latest_risk_level);
  const RIcon = p.latest_risk_level === 'high' ? AlertTriangle : p.latest_risk_level === 'medium' ? Shield : CheckCircle;

  const riskExplanation = {
    high: 'This patient has a high medication risk score. Some of their medicines may interact or cause side effects, especially in older adults. Please seek a medication review urgently.',
    medium: 'Some medications may need checking. Consider booking a GP or pharmacist review in the next 1-2 weeks.',
    low: 'The current medications appear to have a low risk profile. Continue attending scheduled follow-up appointments.',
  };

  return (
    <div className="rounded-xl shadow-sm overflow-hidden" style={{ backgroundColor: 'var(--sma-surface)', border: '1px solid var(--sma-border)' }} data-testid={`family-patient-card-${p.patient_id}`}>
      {/* Risk Banner */}
      {hasRisk && (
        <div className="px-6 py-3 flex items-center gap-3" style={{ backgroundColor: c.bg, borderBottom: `2px solid ${c.border}` }} data-testid={`patient-risk-banner-${p.patient_id}`}>
          <RIcon className="w-5 h-5" style={{ color: c.text }} />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold uppercase" style={{ color: c.text }}>{p.latest_risk_level} Risk</span>
              <span className="text-sm" style={{ color: c.text }}>|</span>
              <span className="text-sm font-semibold" style={{ color: c.text }}>Score: {p.latest_risk_score}</span>
            </div>
          </div>
          {p.latest_risk_level !== 'low' && (
            <span className="px-3 py-1 rounded-full text-xs font-bold" style={{ backgroundColor: c.border, color: 'white' }}>
              {p.latest_risk_level === 'high' ? 'Seek Urgent Review' : 'Review Recommended'}
            </span>
          )}
        </div>
      )}

      <div className="p-6">
        {/* Patient Info */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl font-semibold" style={{ fontFamily: 'Outfit', color: 'var(--sma-text-primary)' }}>{p.name}</h3>
            <p className="text-sm" style={{ color: 'var(--sma-text-muted)' }}>DOB: {p.dob || 'Not set'} {p.gender ? `| ${p.gender}` : ''}</p>
          </div>
          <Button data-testid={`family-view-profile-${p.patient_id}`} onClick={() => navigate(`/patients/${p.patient_id}`)} variant="ghost" size="sm" className="text-xs rounded-full" style={{ color: 'var(--sma-brand)' }}>
            View Profile <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        </div>

        {/* Risk Explanation */}
        {hasRisk && (
          <div className="p-4 rounded-lg mb-4" style={{ backgroundColor: c.bg }} data-testid={`risk-explanation-${p.patient_id}`}>
            <p className="text-sm leading-relaxed" style={{ color: c.text }}>
              {riskExplanation[p.latest_risk_level] || riskExplanation.low}
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Button
            data-testid={`family-upload-${p.patient_id}`}
            onClick={() => navigate(`/upload/${p.patient_id}`)}
            className="h-12 rounded-xl font-medium transition-all duration-200 hover:-translate-y-0.5"
            style={{ backgroundColor: 'var(--sma-brand)', color: 'white' }}
          >
            <Upload className="w-4 h-4 mr-2" /> Upload Summary
          </Button>
          <Button
            data-testid={`family-view-analysis-${p.patient_id}`}
            onClick={() => navigate(`/results/${p.patient_id}`)}
            variant="outline"
            className="h-12 rounded-xl font-medium transition-all duration-200 hover:-translate-y-0.5"
            style={{ borderColor: hasRisk ? c.border : 'var(--sma-border)', color: hasRisk ? c.text : 'var(--sma-text-secondary)' }}
          >
            <BarChart3 className="w-4 h-4 mr-2" /> {hasRisk ? 'View Analysis' : 'No Analysis Yet'}
          </Button>
          <Button
            data-testid={`family-ask-questions-${p.patient_id}`}
            onClick={() => navigate(`/chat/${p.patient_id}`)}
            variant="outline"
            className="h-12 rounded-xl font-medium transition-all duration-200 hover:-translate-y-0.5"
            style={{ borderColor: 'var(--sma-accent)', color: 'var(--sma-accent)' }}
          >
            <MessageCircle className="w-4 h-4 mr-2" /> Ask Questions
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ======================== SHARED COMPONENTS ======================== */
function RecentPatientsList({ stats, navigate }) {
  if (!stats?.recent_patients?.length) return null;
  return (
    <div className="rounded-xl shadow-sm p-6" style={{ backgroundColor: 'var(--sma-surface)', border: '1px solid var(--sma-border)' }}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-medium" style={{ fontFamily: 'Outfit', color: 'var(--sma-text-primary)' }}>Recent Patients</h2>
        <Button data-testid="view-all-patients-btn" variant="ghost" onClick={() => navigate('/patients')} className="text-sm" style={{ color: 'var(--sma-brand)' }}>
          View All <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
      <div className="space-y-3">
        {stats.recent_patients.map((p) => {
          const isHighRisk = p.latest_risk_level === 'high';
          const isMedRisk = p.latest_risk_level === 'medium';
          return (
            <button key={p.patient_id} data-testid={`patient-card-${p.patient_id}`} onClick={() => navigate(`/patients/${p.patient_id}`)}
              className="w-full flex items-center justify-between p-4 rounded-lg transition-all duration-200 hover:-translate-y-0.5 cursor-pointer text-left"
              style={{ backgroundColor: isHighRisk ? 'var(--sma-risk-high-bg)' : 'var(--sma-surface-alt)', border: isHighRisk ? '2px solid var(--sma-risk-high-border)' : '1px solid var(--sma-border)' }}>
              <div className="flex items-center gap-3">
                {isHighRisk && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--sma-risk-high-border)' }} data-testid={`high-risk-flag-${p.patient_id}`}>
                    <AlertTriangle className="w-4 h-4 text-white" />
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium" style={{ color: isHighRisk ? 'var(--sma-risk-high-text)' : 'var(--sma-text-primary)' }}>{p.name}</p>
                    {isHighRisk && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase" style={{ backgroundColor: 'var(--sma-risk-high-border)', color: 'white' }}>High Risk</span>}
                    {isMedRisk && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase" style={{ backgroundColor: 'var(--sma-risk-med-border)', color: 'white' }}>Medium</span>}
                    {p.latest_risk_level === 'low' && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase" style={{ backgroundColor: 'var(--sma-risk-low-border)', color: 'white' }}>Low</span>}
                  </div>
                  <p className="text-sm" style={{ color: isHighRisk ? 'var(--sma-risk-high-text)' : 'var(--sma-text-muted)' }}>
                    DOB: {p.dob || 'Not set'}{p.latest_risk_score != null && <> | Score: {p.latest_risk_score}</>}
                  </p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 flex-shrink-0" style={{ color: isHighRisk ? 'var(--sma-risk-high-text)' : 'var(--sma-text-muted)' }} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Disclaimer() {
  return (
    <div className="mt-8 p-4 rounded-lg text-xs text-center" style={{ backgroundColor: 'var(--sma-surface-alt)', color: 'var(--sma-text-muted)' }} data-testid="dashboard-disclaimer">
      This tool provides decision support only and does not replace professional medical judgment.
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

const riskColor = (level) => ({
  high: { bg: 'var(--sma-risk-high-bg)', border: 'var(--sma-risk-high-border)', text: 'var(--sma-risk-high-text)' },
  medium: { bg: 'var(--sma-risk-med-bg)', border: 'var(--sma-risk-med-border)', text: 'var(--sma-risk-med-text)' },
  low: { bg: 'var(--sma-risk-low-bg)', border: 'var(--sma-risk-low-border)', text: 'var(--sma-risk-low-text)' },
}[level] || { bg: 'var(--sma-surface-alt)', border: 'var(--sma-border)', text: 'var(--sma-text-secondary)' });
