import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import Sidebar from '@/components/Sidebar';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, CheckCircle, Shield, Pill, ArrowRight, MessageCircle, FileDown, Loader2, Info, Clock, ExternalLink, BookOpen, Phone, CalendarPlus } from 'lucide-react';
import axios from 'axios';
import { getApiUrl } from '@/lib/utils';

const API = getApiUrl('/api');

export default function RiskResults() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const isPractitioner = user?.role === 'medical_practitioner';

  useEffect(() => { fetchResults(); }, [patientId]);

  const fetchResults = async () => {
    try {
      const res = await axios.get(`${API}/risk-results/${patientId}/latest`, { withCredentials: true });
      setData(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="flex min-h-screen" style={{ backgroundColor: 'var(--sma-bg)' }}>
      <Sidebar /><main className="flex-1 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--sma-brand)' }} /></main>
    </div>
  );

  if (!data?.risk_result) return (
    <div className="flex min-h-screen" style={{ backgroundColor: 'var(--sma-bg)' }}>
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="max-w-3xl mx-auto text-center py-16">
          <Shield className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--sma-text-muted)' }} />
          <h2 className="text-2xl font-medium mb-2" style={{ fontFamily: 'Outfit', color: 'var(--sma-text-primary)' }}>No Risk Results Yet</h2>
          <p style={{ color: 'var(--sma-text-secondary)' }}>Upload medication documents to generate a risk assessment</p>
          <Button data-testid="upload-from-results-btn" onClick={() => navigate(`/upload/${patientId}`)} className="mt-4 h-11 rounded-full" style={{ backgroundColor: 'var(--sma-brand)', color: 'var(--sma-text-inverse)' }}>Upload Documents</Button>
        </div>
      </main>
    </div>
  );

  const { risk_result, parsed_summary, recommendations, patient } = data;

  const handleDownloadPdf = async () => {
    setDownloading(true);
    try {
      const res = await axios.get(`${API}/reports/${risk_result.result_id}/pdf`, {
        withCredentials: true,
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `SafeMedAI_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PDF download failed:', err);
    } finally {
      setDownloading(false);
    }
  };

  const riskStyle = {
    high: { bg: 'var(--sma-risk-high-bg)', border: 'var(--sma-risk-high-border)', text: 'var(--sma-risk-high-text)', icon: AlertTriangle, label: 'HIGH RISK' },
    medium: { bg: 'var(--sma-risk-med-bg)', border: 'var(--sma-risk-med-border)', text: 'var(--sma-risk-med-text)', icon: Shield, label: 'MEDIUM RISK' },
    low: { bg: 'var(--sma-risk-low-bg)', border: 'var(--sma-risk-low-border)', text: 'var(--sma-risk-low-text)', icon: CheckCircle, label: 'LOW RISK' },
  }[risk_result.risk_level] || {};

  const RiskIcon = riskStyle.icon || Shield;

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: 'var(--sma-bg)' }}>
      <Sidebar />
      <main className="flex-1 p-8" data-testid="risk-results-page">
        <div className="max-w-5xl mx-auto animate-fade-in">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-semibold tracking-tight" style={{ fontFamily: 'Outfit', color: 'var(--sma-text-primary)' }}>Risk Assessment</h1>
            <div className="flex gap-3">
              <Button
                data-testid="view-history-btn"
                onClick={() => navigate(`/history/${patientId}`)}
                variant="outline"
                className="h-11 rounded-full font-medium"
                style={{ borderColor: 'var(--sma-text-secondary)', color: 'var(--sma-text-secondary)' }}
              >
                <Clock className="w-4 h-4 mr-2" /> History
              </Button>
              <Button
                data-testid="download-pdf-btn"
                onClick={handleDownloadPdf}
                disabled={downloading}
                variant="outline"
                className="h-11 rounded-full font-medium"
                style={{ borderColor: 'var(--sma-brand)', color: 'var(--sma-brand)' }}
              >
                {downloading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileDown className="w-4 h-4 mr-2" />}
                {downloading ? 'Generating...' : 'Download PDF'}
              </Button>
              <Button data-testid="ask-about-results-btn" onClick={() => navigate(`/chat/${patientId}`)} className="h-11 rounded-full font-medium" style={{ backgroundColor: 'var(--sma-accent)', color: 'var(--sma-text-inverse)' }}>
                <MessageCircle className="w-4 h-4 mr-2" /> Ask Questions
              </Button>
            </div>
          </div>

          {!isPractitioner && (risk_result.risk_level === 'high' || risk_result.risk_level === 'medium') && (
            <div className="rounded-xl p-5 mb-6" style={{ backgroundColor: 'var(--sma-surface)', border: '1px solid var(--sma-border)' }} data-testid="patient-appointment-actions">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold" style={{ fontFamily: 'Outfit', color: 'var(--sma-text-primary)' }}>Book a GP medication review</h2>
                  <p className="text-sm mt-1" style={{ color: 'var(--sma-text-secondary)' }}>
                    GP call number: <span style={{ color: 'var(--sma-brand)', fontWeight: 600 }}>{patient?.gp_phone || 'not added'}</span>
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button data-testid="call-gp-display-btn" variant="outline" className="h-10 rounded-lg" style={{ borderColor: 'var(--sma-border)', color: 'var(--sma-brand)' }}>
                    <Phone className="w-4 h-4 mr-2" /> {patient?.gp_phone ? `Call ${patient.gp_phone}` : 'Add GP Number'}
                  </Button>
                  <Button data-testid="add-to-calendar-demo-btn" className="h-10 rounded-lg" style={{ backgroundColor: 'var(--sma-brand)', color: 'white' }}>
                    <CalendarPlus className="w-4 h-4 mr-2" /> Add to Calendar
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Risk Score Card */}
          <div className="rounded-xl p-8 mb-6" style={{ backgroundColor: riskStyle.bg, border: `2px solid ${riskStyle.border}` }} data-testid="risk-score-card">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <RiskIcon className="w-8 h-8" style={{ color: riskStyle.text }} />
                  <p className="text-2xl font-semibold" style={{ fontFamily: 'Outfit', color: riskStyle.text }}>{riskStyle.label}</p>
                </div>
                <p className="text-lg" style={{ color: riskStyle.text }}>
                  ACB Score: <strong>{risk_result.total_score}</strong> | {risk_result.flagged_count} of {risk_result.medication_count} medications flagged
                </p>
                <p className="text-sm mt-1" style={{ color: riskStyle.text, opacity: 0.8 }}>
                  Calculator: {risk_result.scoring_engine || 'ACB'} | Confidence: {Math.round((risk_result.confidence || 0) * 100)}%
                </p>
              </div>
              <div className="text-center p-4 rounded-xl" style={{ backgroundColor: 'rgba(255,255,255,0.5)' }}>
                <p className="text-5xl font-bold" style={{ fontFamily: 'Outfit', color: riskStyle.text }}>{risk_result.total_score}</p>
                <p className="text-xs font-semibold uppercase tracking-wider mt-1" style={{ color: riskStyle.text }}>Total ACB Score</p>
              </div>
            </div>
          </div>

          {/* Explanation */}
          <div className="rounded-xl shadow-sm p-6 mb-6" style={{ backgroundColor: 'var(--sma-surface)', border: '1px solid var(--sma-border)' }}>
            <h2 className="text-lg font-medium mb-3" style={{ fontFamily: 'Outfit', color: 'var(--sma-text-primary)' }}>Assessment Explanation</h2>
            <p className="text-base leading-relaxed" style={{ color: 'var(--sma-text-secondary)' }}>{risk_result.explanation}</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Medications Table */}
            <div className="rounded-xl shadow-sm p-6" style={{ backgroundColor: 'var(--sma-surface)', border: '1px solid var(--sma-border)' }}>
              <h2 className="text-lg font-medium mb-4 flex items-center gap-2" style={{ fontFamily: 'Outfit', color: 'var(--sma-text-primary)' }}>
                <Pill className="w-5 h-5" style={{ color: 'var(--sma-brand)' }} /> Medications
              </h2>
              <div className="overflow-x-auto">
                <Table data-testid="medications-table">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-base p-4">Medication</TableHead>
                      <TableHead className="text-base p-4">Dose</TableHead>
                      <TableHead className="text-base p-4">Frequency</TableHead>
                      <TableHead className="text-base p-4">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsed_summary?.medications?.map((med, i) => {
                      const flagged = risk_result.risk_factors?.find(rf => rf.medication?.toLowerCase() === med.name?.toLowerCase());
                      return (
                        <TableRow key={i} className={i % 2 === 0 ? '' : ''} style={i % 2 !== 0 ? { backgroundColor: 'var(--sma-surface-alt)' } : {}} data-testid={`med-row-${i}`}>
                          <TableCell className="p-4 font-medium" style={{ color: flagged ? riskStyle.text : 'var(--sma-text-primary)' }}>
                            {med.name}
                            {flagged && <span className="ml-2 px-1.5 py-0.5 rounded text-xs font-semibold" style={{ backgroundColor: riskStyle.bg, color: riskStyle.text }}>ACB {flagged.acb_score}</span>}
                          </TableCell>
                          <TableCell className="p-4 text-base" style={{ color: 'var(--sma-text-secondary)' }}>{med.dose || '-'}</TableCell>
                          <TableCell className="p-4 text-base" style={{ color: 'var(--sma-text-secondary)' }}>{med.frequency || '-'}</TableCell>
                          <TableCell className="p-4">
                            {med.is_new && <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: 'var(--sma-risk-med-bg)', color: 'var(--sma-risk-med-text)' }}>New</span>}
                            {med.is_ceased && <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: 'var(--sma-risk-high-bg)', color: 'var(--sma-risk-high-text)' }}>Ceased</span>}
                            {!med.is_new && !med.is_ceased && <span className="text-sm" style={{ color: 'var(--sma-text-muted)' }}>Continuing</span>}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Flagged Medications */}
            <div className="space-y-6">
              {risk_result.risk_factors?.length > 0 && (
                <div className="rounded-xl shadow-sm p-6" style={{ backgroundColor: 'var(--sma-surface)', border: '1px solid var(--sma-border)' }}>
                  <h2 className="text-lg font-medium mb-4 flex items-center gap-2" style={{ fontFamily: 'Outfit', color: 'var(--sma-text-primary)' }}>
                    <AlertTriangle className="w-5 h-5" style={{ color: 'var(--sma-risk-high-text)' }} /> Flagged Medications
                  </h2>
                  <div className="space-y-3">
                    {risk_result.risk_factors.map((rf, i) => (
                      <div key={i} className="p-3 rounded-lg" style={{ backgroundColor: riskStyle.bg }} data-testid={`flagged-med-${i}`}>
                        <div className="flex items-center justify-between">
                          <p className="font-medium" style={{ color: riskStyle.text }}>{rf.medication}</p>
                          <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ backgroundColor: 'rgba(255,255,255,0.5)', color: riskStyle.text }}>ACB {rf.acb_score}</span>
                        </div>
                        <p className="text-xs mt-1 capitalize" style={{ color: riskStyle.text, opacity: 0.8 }}>{rf.level?.replace('_', ' ')}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommendations */}
              <div className="rounded-xl shadow-sm p-6" style={{ backgroundColor: 'var(--sma-surface)', border: '1px solid var(--sma-border)' }}>
                <h2 className="text-lg font-medium mb-4" style={{ fontFamily: 'Outfit', color: 'var(--sma-text-primary)' }}>
                  {isPractitioner ? 'Clinical Recommendations' : 'What To Do Next'}
                </h2>
                <div className="space-y-3">
                  {recommendations?.map((rec, i) => {
                    const recColors = {
                      urgent: { bg: 'var(--sma-risk-high-bg)', text: 'var(--sma-risk-high-text)', icon: AlertTriangle },
                      warning: { bg: 'var(--sma-risk-high-bg)', text: 'var(--sma-risk-high-text)', icon: AlertTriangle },
                      action: { bg: 'var(--sma-risk-med-bg)', text: 'var(--sma-risk-med-text)', icon: ArrowRight },
                      flag: { bg: 'var(--sma-risk-med-bg)', text: 'var(--sma-risk-med-text)', icon: Shield },
                      info: { bg: 'var(--sma-risk-low-bg)', text: 'var(--sma-risk-low-text)', icon: Info },
                      resource: { bg: '#EDE9FE', text: '#5B21B6', icon: BookOpen },
                    }[rec.type] || { bg: 'var(--sma-surface-alt)', text: 'var(--sma-text-secondary)', icon: Info };
                    const RecIcon = recColors.icon;
                    return (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-lg" style={{ backgroundColor: recColors.bg }} data-testid={`recommendation-${i}`}>
                        <RecIcon className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: recColors.text }} />
                        <div className="flex-1">
                          <p className="text-sm font-medium" style={{ color: recColors.text }}>{rec.text}</p>
                          {rec.url && (
                            <a href={rec.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 hover:-translate-y-0.5"
                              style={{ backgroundColor: recColors.text, color: 'white' }} data-testid={`resource-link-${i}`}>
                              <ExternalLink className="w-3 h-3" /> Open Withdrawal Guidelines
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Clinical Withdrawal Guidelines - Practitioner Only */}
          {isPractitioner && risk_result.risk_level !== 'low' && (
            <div className="rounded-xl shadow-sm p-6 mb-6" style={{ backgroundColor: 'var(--sma-surface)', border: '2px solid #8B5CF6' }} data-testid="withdrawal-guidelines-section">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#EDE9FE' }}>
                  <BookOpen className="w-6 h-6" style={{ color: '#5B21B6' }} />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-medium mb-1" style={{ fontFamily: 'Outfit', color: 'var(--sma-text-primary)' }}>
                    Medication Withdrawal Decision Tree
                  </h2>
                  <p className="text-sm mb-3" style={{ color: 'var(--sma-text-secondary)' }}>
                    Amsterdam UMC CAREFREE evidence-based guidelines for withdrawing fall-risk medications. Covers benzodiazepines, antidepressants, antipsychotics, opioids, antiepileptics, diuretics, antihypertensives, sedative antihistamines, and overactive bladder medications.
                  </p>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {(risk_result.risk_factors || []).map((rf, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: '#EDE9FE', color: '#5B21B6' }}>
                        {rf.medication}
                      </span>
                    ))}
                  </div>
                  <a
                    href="https://kiktools.amsterdamumc.org/falls/decision-tree/"
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="withdrawal-guidelines-link"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                    style={{ backgroundColor: '#5B21B6', color: 'white' }}
                  >
                    <ExternalLink className="w-4 h-4" /> Open Withdrawal Guidelines
                  </a>
                  <p className="text-xs mt-3" style={{ color: 'var(--sma-text-muted)' }}>
                    Source: Amsterdam UMC CAREFREE / ADFICE_IT Project. Clinician review required before any medication changes.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Discharge Info */}
          {parsed_summary && (
            <div className="rounded-xl shadow-sm p-6 mb-6" style={{ backgroundColor: 'var(--sma-surface)', border: '1px solid var(--sma-border)' }}>
              <h2 className="text-lg font-medium mb-4" style={{ fontFamily: 'Outfit', color: 'var(--sma-text-primary)' }}>Medication Document Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {parsed_summary.diagnosis && (
                  <div><p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--sma-text-muted)' }}>Diagnosis</p><p className="text-sm mt-1" style={{ color: 'var(--sma-text-primary)' }}>{parsed_summary.diagnosis}</p></div>
                )}
                {parsed_summary.discharge_date && (
                  <div><p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--sma-text-muted)' }}>Discharge Date</p><p className="text-sm mt-1" style={{ color: 'var(--sma-text-primary)' }}>{parsed_summary.discharge_date}</p></div>
                )}
                {parsed_summary.discharge_instructions && (
                  <div className="md:col-span-2"><p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--sma-text-muted)' }}>Discharge Instructions</p><p className="text-sm mt-1" style={{ color: 'var(--sma-text-primary)' }}>{parsed_summary.discharge_instructions}</p></div>
                )}
                {parsed_summary.follow_up && (
                  <div className="md:col-span-2"><p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--sma-text-muted)' }}>Follow-Up</p><p className="text-sm mt-1" style={{ color: 'var(--sma-text-primary)' }}>{parsed_summary.follow_up}</p></div>
                )}
              </div>
            </div>
          )}

          {/* Disclaimer */}
          <div className="p-4 rounded-xl text-center" style={{ backgroundColor: 'var(--sma-risk-med-bg)', border: '1px solid var(--sma-risk-med-border)' }} data-testid="results-disclaimer">
            <p className="text-sm font-medium" style={{ color: 'var(--sma-risk-med-text)' }}>
              This tool provides decision support information only and does not replace professional medical judgment. Always consult a qualified healthcare professional for medical advice.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

