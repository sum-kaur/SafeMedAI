import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Sidebar from '@/components/Sidebar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, BarChart3, MessageCircle, FileText, AlertTriangle, CheckCircle, Shield, Clock, Loader2, User, Phone, Stethoscope } from 'lucide-react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function PatientProfile() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchPatient(); }, [patientId]);

  const fetchPatient = async () => {
    try {
      const res = await axios.get(`${API}/patients/${patientId}`, { withCredentials: true });
      setData(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const riskStyle = (level) => ({
    high: { bg: 'var(--sma-risk-high-bg)', border: 'var(--sma-risk-high-border)', text: 'var(--sma-risk-high-text)', icon: AlertTriangle },
    medium: { bg: 'var(--sma-risk-med-bg)', border: 'var(--sma-risk-med-border)', text: 'var(--sma-risk-med-text)', icon: Shield },
    low: { bg: 'var(--sma-risk-low-bg)', border: 'var(--sma-risk-low-border)', text: 'var(--sma-risk-low-text)', icon: CheckCircle },
  }[level] || { bg: 'var(--sma-surface-alt)', border: 'var(--sma-border)', text: 'var(--sma-text-muted)', icon: Shield });

  if (loading) return (
    <div className="flex min-h-screen" style={{ backgroundColor: 'var(--sma-bg)' }}>
      <Sidebar />
      <main className="flex-1 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--sma-brand)' }} /></main>
    </div>
  );

  const { patient, documents, risk_results, alerts } = data || {};
  const latestRisk = risk_results?.[0];
  const rs = latestRisk ? riskStyle(latestRisk.risk_level) : null;

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: 'var(--sma-bg)' }}>
      <Sidebar />
      <main className="flex-1 p-8" data-testid="patient-profile">
        <div className="max-w-5xl mx-auto animate-fade-in">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight" style={{ fontFamily: 'Outfit', color: 'var(--sma-text-primary)' }}>{patient?.name}</h1>
              <p className="text-sm mt-1" style={{ color: 'var(--sma-text-muted)' }}>
                DOB: {patient?.dob || 'Not set'} {patient?.gender ? `| ${patient.gender}` : ''}
              </p>
            </div>
            <div className="flex gap-3">
              <Button data-testid="upload-doc-btn" onClick={() => navigate(`/upload/${patientId}`)} className="h-11 rounded-full font-medium transition-all duration-200 hover:-translate-y-0.5" style={{ backgroundColor: 'var(--sma-brand)', color: 'var(--sma-text-inverse)' }}>
                <Upload className="w-4 h-4 mr-2" /> Upload Summary
              </Button>
              {risk_results?.length > 0 && (
                <Button data-testid="view-results-btn" onClick={() => navigate(`/results/${patientId}`)} variant="outline" className="h-11 rounded-full font-medium" style={{ borderColor: 'var(--sma-brand)', color: 'var(--sma-brand)' }}>
                  <BarChart3 className="w-4 h-4 mr-2" /> View Results
                </Button>
              )}
              <Button data-testid="chat-btn" onClick={() => navigate(`/chat/${patientId}`)} variant="outline" className="h-11 rounded-full font-medium" style={{ borderColor: 'var(--sma-accent)', color: 'var(--sma-accent)' }}>
                <MessageCircle className="w-4 h-4 mr-2" /> Ask Questions
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Patient Info */}
            <div className="lg:col-span-1 space-y-6">
              <div className="rounded-xl shadow-sm p-6" style={{ backgroundColor: 'var(--sma-surface)', border: '1px solid var(--sma-border)' }}>
                <h2 className="text-lg font-medium mb-4" style={{ fontFamily: 'Outfit', color: 'var(--sma-text-primary)' }}>Patient Details</h2>
                <div className="space-y-3">
                  {patient?.emergency_contact && (
                    <div className="flex items-start gap-3">
                      <Phone className="w-4 h-4 mt-1 flex-shrink-0" style={{ color: 'var(--sma-text-muted)' }} />
                      <div><p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--sma-text-muted)' }}>Emergency Contact</p><p className="text-sm" style={{ color: 'var(--sma-text-primary)' }}>{patient.emergency_contact}</p></div>
                    </div>
                  )}
                  {patient?.gp_details && (
                    <div className="flex items-start gap-3">
                      <Stethoscope className="w-4 h-4 mt-1 flex-shrink-0" style={{ color: 'var(--sma-text-muted)' }} />
                      <div><p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--sma-text-muted)' }}>GP / Doctor</p><p className="text-sm" style={{ color: 'var(--sma-text-primary)' }}>{patient.gp_details}</p></div>
                    </div>
                  )}
                  {patient?.allergies?.length > 0 && (
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-4 h-4 mt-1 flex-shrink-0" style={{ color: 'var(--sma-risk-high-text)' }} />
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--sma-text-muted)' }}>Allergies</p>
                        <div className="flex flex-wrap gap-1 mt-1">{patient.allergies.map((a, i) => <span key={i} className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: 'var(--sma-risk-high-bg)', color: 'var(--sma-risk-high-text)' }}>{a}</span>)}</div>
                      </div>
                    </div>
                  )}
                  {patient?.medical_history && (
                    <div className="flex items-start gap-3">
                      <FileText className="w-4 h-4 mt-1 flex-shrink-0" style={{ color: 'var(--sma-text-muted)' }} />
                      <div><p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--sma-text-muted)' }}>Medical History</p><p className="text-sm" style={{ color: 'var(--sma-text-primary)' }}>{patient.medical_history}</p></div>
                    </div>
                  )}
                </div>
              </div>

              {/* Latest Risk */}
              {latestRisk && rs && (
                <div className="rounded-xl shadow-sm p-6 cursor-pointer transition-all duration-200 hover:-translate-y-0.5" onClick={() => navigate(`/results/${patientId}`)} style={{ backgroundColor: rs.bg, border: `2px solid ${rs.border}` }} data-testid="latest-risk-card">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm uppercase tracking-[0.15em] font-semibold" style={{ color: rs.text }}>Latest Risk Assessment</p>
                    <rs.icon className="w-6 h-6" style={{ color: rs.text }} />
                  </div>
                  <p className="text-4xl font-semibold" style={{ fontFamily: 'Outfit', color: rs.text }}>{latestRisk.risk_level.toUpperCase()}</p>
                  <p className="text-sm mt-1" style={{ color: rs.text }}>ACB Score: {latestRisk.total_score} | {latestRisk.flagged_count} medications flagged</p>
                </div>
              )}
            </div>

            {/* Timeline */}
            <div className="lg:col-span-2">
              <div className="rounded-xl shadow-sm p-6" style={{ backgroundColor: 'var(--sma-surface)', border: '1px solid var(--sma-border)' }}>
                <h2 className="text-lg font-medium mb-4" style={{ fontFamily: 'Outfit', color: 'var(--sma-text-primary)' }}>Activity Timeline</h2>
                {(!documents?.length && !risk_results?.length) ? (
                  <div className="text-center py-12">
                    <Upload className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--sma-text-muted)' }} />
                    <p style={{ color: 'var(--sma-text-secondary)' }}>No documents uploaded yet</p>
                    <Button data-testid="timeline-upload-btn" onClick={() => navigate(`/upload/${patientId}`)} className="mt-4 h-11 rounded-full" style={{ backgroundColor: 'var(--sma-brand)', color: 'var(--sma-text-inverse)' }}>Upload Discharge Summary</Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {risk_results?.map((r) => {
                      const s = riskStyle(r.risk_level);
                      return (
                        <div key={r.result_id} className="flex items-start gap-4 p-4 rounded-lg cursor-pointer transition-all duration-200 hover:-translate-y-0.5" style={{ backgroundColor: 'var(--sma-surface-alt)' }} onClick={() => navigate(`/results/${patientId}`)} data-testid={`timeline-risk-${r.result_id}`}>
                          <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: s.bg }}>
                            <s.icon className="w-5 h-5" style={{ color: s.text }} />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-sm" style={{ color: 'var(--sma-text-primary)' }}>Risk Assessment: <span className="uppercase font-semibold" style={{ color: s.text }}>{r.risk_level}</span></p>
                            <p className="text-xs mt-1" style={{ color: 'var(--sma-text-muted)' }}>ACB Score: {r.total_score} | {r.scoring_engine} Engine | {new Date(r.created_at).toLocaleDateString()}</p>
                          </div>
                        </div>
                      );
                    })}
                    {documents?.map((d) => (
                      <div key={d.document_id} className="flex items-start gap-4 p-4 rounded-lg" style={{ backgroundColor: 'var(--sma-surface-alt)' }} data-testid={`timeline-doc-${d.document_id}`}>
                        <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--sma-surface-alt)', border: '1px solid var(--sma-border)' }}>
                          <FileText className="w-5 h-5" style={{ color: 'var(--sma-text-muted)' }} />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-sm" style={{ color: 'var(--sma-text-primary)' }}>{d.original_filename}</p>
                          <p className="text-xs mt-1" style={{ color: 'var(--sma-text-muted)' }}>Status: {d.status} | {new Date(d.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 p-4 rounded-lg text-xs text-center" style={{ backgroundColor: 'var(--sma-surface-alt)', color: 'var(--sma-text-muted)' }}>
            This tool provides decision support only and does not replace professional medical judgment.
          </div>
        </div>
      </main>
    </div>
  );
}
