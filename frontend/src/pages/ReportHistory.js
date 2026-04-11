import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import Sidebar from '@/components/Sidebar';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle, Shield, ArrowRight, ArrowDown, ArrowUp, Minus, BarChart3, Loader2, Clock, Download, GitCompare } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const riskColor = (level) => ({
  high: { bg: 'var(--sma-risk-high-bg)', border: 'var(--sma-risk-high-border)', text: 'var(--sma-risk-high-text)', icon: AlertTriangle },
  medium: { bg: 'var(--sma-risk-med-bg)', border: 'var(--sma-risk-med-border)', text: 'var(--sma-risk-med-text)', icon: Shield },
  low: { bg: 'var(--sma-risk-low-bg)', border: 'var(--sma-risk-low-border)', text: 'var(--sma-risk-low-text)', icon: CheckCircle },
}[level] || { bg: 'var(--sma-surface-alt)', border: 'var(--sma-border)', text: 'var(--sma-text-muted)', icon: Shield });

export default function ReportHistory() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedA, setSelectedA] = useState(null);
  const [selectedB, setSelectedB] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [comparing, setComparing] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => { fetchHistory(); }, [patientId]);

  const fetchHistory = async () => {
    try {
      const res = await axios.get(`${API}/risk-results/${patientId}/history`, { withCredentials: true });
      setResults(res.data);
      if (res.data.length >= 2) { setSelectedA(res.data[1].result_id); setSelectedB(res.data[0].result_id); }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleCompare = async () => {
    if (!selectedA || !selectedB || selectedA === selectedB) { toast.error('Select two different assessments to compare'); return; }
    setComparing(true);
    try {
      const res = await axios.get(`${API}/risk-results/${patientId}/compare?result_a=${selectedA}&result_b=${selectedB}`, { withCredentials: true });
      setComparison(res.data);
    } catch (err) { toast.error('Comparison failed'); }
    finally { setComparing(false); }
  };

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const res = await axios.get(`${API}/export/risk-results/${patientId}`, { withCredentials: true, responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a'); link.href = url; link.setAttribute('download', `risk_history_${new Date().toISOString().slice(0,10)}.csv`);
      document.body.appendChild(link); link.click(); link.remove();
    } catch (err) { toast.error('Export failed'); }
    finally { setExporting(false); }
  };

  if (loading) return (
    <div className="flex min-h-screen" style={{ backgroundColor: 'var(--sma-bg)' }}>
      <Sidebar /><main className="flex-1 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--sma-brand)' }} /></main>
    </div>
  );

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: 'var(--sma-bg)' }}>
      <Sidebar />
      <main className="flex-1 p-8" data-testid="report-history-page">
        <div className="max-w-6xl mx-auto animate-fade-in">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight" style={{ fontFamily: 'Outfit', color: 'var(--sma-text-primary)' }}>Assessment History</h1>
              <p className="text-sm mt-1" style={{ color: 'var(--sma-text-muted)' }}>{results.length} assessment{results.length !== 1 ? 's' : ''} on record</p>
            </div>
            <div className="flex gap-3">
              <Button data-testid="export-history-csv-btn" onClick={handleExportCSV} disabled={exporting} variant="outline" className="h-10 rounded-full" style={{ borderColor: 'var(--sma-brand)', color: 'var(--sma-brand)' }}>
                {exporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />} Export CSV
              </Button>
              <Button data-testid="back-to-results-btn" onClick={() => navigate(`/results/${patientId}`)} className="h-10 rounded-full" style={{ backgroundColor: 'var(--sma-brand)', color: 'var(--sma-text-inverse)' }}>
                <BarChart3 className="w-4 h-4 mr-2" /> Latest Results
              </Button>
            </div>
          </div>

          {results.length === 0 ? (
            <div className="text-center py-16 rounded-xl" style={{ backgroundColor: 'var(--sma-surface)', border: '1px solid var(--sma-border)' }}>
              <Clock className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--sma-text-muted)' }} />
              <h3 className="text-xl font-medium mb-2" style={{ fontFamily: 'Outfit' }}>No assessment history</h3>
              <p style={{ color: 'var(--sma-text-secondary)' }}>Upload discharge summaries to build a risk history</p>
            </div>
          ) : (
            <>
              {/* Timeline */}
              <div className="rounded-xl shadow-sm p-6 mb-6" style={{ backgroundColor: 'var(--sma-surface)', border: '1px solid var(--sma-border)' }}>
                <h2 className="text-lg font-medium mb-4" style={{ fontFamily: 'Outfit', color: 'var(--sma-text-primary)' }}>Risk Score Timeline</h2>
                <div className="space-y-3">
                  {results.map((r, idx) => {
                    const c = riskColor(r.risk_level);
                    const RIcon = c.icon;
                    const isSelA = selectedA === r.result_id;
                    const isSelB = selectedB === r.result_id;
                    return (
                      <div key={r.result_id} className="flex items-center gap-4 p-4 rounded-lg transition-all duration-200 hover:-translate-y-0.5"
                        style={{ backgroundColor: (isSelA || isSelB) ? c.bg : 'var(--sma-surface-alt)', border: (isSelA || isSelB) ? `2px solid ${c.border}` : '1px solid var(--sma-border)' }}
                        data-testid={`history-row-${r.result_id}`}>
                        <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: c.bg }}>
                          <RIcon className="w-5 h-5" style={{ color: c.text }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold uppercase text-sm" style={{ color: c.text }}>{r.risk_level}</span>
                            <span className="text-xs" style={{ color: 'var(--sma-text-muted)' }}>Score: {r.total_score} | {r.scoring_engine}</span>
                          </div>
                          <p className="text-xs" style={{ color: 'var(--sma-text-muted)' }}>
                            {new Date(r.created_at).toLocaleDateString()} {new Date(r.created_at).toLocaleTimeString()} | {r.flagged_count} flagged of {r.medication_count}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => setSelectedA(r.result_id)} className={`px-3 py-1 rounded-full text-xs font-semibold cursor-pointer transition-all`}
                            style={{ backgroundColor: isSelA ? 'var(--sma-brand)' : 'var(--sma-surface)', color: isSelA ? 'white' : 'var(--sma-text-secondary)', border: '1px solid var(--sma-border)' }}
                            data-testid={`select-a-${r.result_id}`}>A</button>
                          <button onClick={() => setSelectedB(r.result_id)} className={`px-3 py-1 rounded-full text-xs font-semibold cursor-pointer transition-all`}
                            style={{ backgroundColor: isSelB ? 'var(--sma-accent)' : 'var(--sma-surface)', color: isSelB ? 'white' : 'var(--sma-text-secondary)', border: '1px solid var(--sma-border)' }}
                            data-testid={`select-b-${r.result_id}`}>B</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {results.length >= 2 && (
                  <Button data-testid="compare-btn" onClick={handleCompare} disabled={comparing || !selectedA || !selectedB || selectedA === selectedB}
                    className="mt-4 h-11 rounded-full font-medium w-full" style={{ backgroundColor: 'var(--sma-brand)', color: 'var(--sma-text-inverse)' }}>
                    {comparing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <GitCompare className="w-4 h-4 mr-2" />}
                    Compare Selected (A vs B)
                  </Button>
                )}
              </div>

              {/* Comparison Results */}
              {comparison && (
                <div className="space-y-6 animate-fade-in" data-testid="comparison-results">
                  {/* Score Change */}
                  <div className="rounded-xl shadow-sm p-6" style={{ backgroundColor: 'var(--sma-surface)', border: '1px solid var(--sma-border)' }}>
                    <h2 className="text-lg font-medium mb-4 flex items-center gap-2" style={{ fontFamily: 'Outfit', color: 'var(--sma-text-primary)' }}>
                      <GitCompare className="w-5 h-5" style={{ color: 'var(--sma-brand)' }} /> Score Comparison
                    </h2>
                    <div className="grid grid-cols-3 gap-4 items-center">
                      <ComparisonCard label="Assessment A" result={comparison.result_a} date={comparison.result_a?.created_at} />
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-2 mb-2">
                          {comparison.score_change > 0 ? <ArrowUp className="w-6 h-6" style={{ color: 'var(--sma-risk-high-text)' }} /> :
                           comparison.score_change < 0 ? <ArrowDown className="w-6 h-6" style={{ color: 'var(--sma-risk-low-text)' }} /> :
                           <Minus className="w-6 h-6" style={{ color: 'var(--sma-text-muted)' }} />}
                        </div>
                        <p className="text-2xl font-bold" style={{
                          fontFamily: 'Outfit',
                          color: comparison.score_change > 0 ? 'var(--sma-risk-high-text)' : comparison.score_change < 0 ? 'var(--sma-risk-low-text)' : 'var(--sma-text-muted)'
                        }}>
                          {comparison.score_change > 0 ? '+' : ''}{comparison.score_change}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--sma-text-muted)' }}>Score Change</p>
                        {comparison.level_change?.from !== comparison.level_change?.to && (
                          <p className="text-xs mt-1">
                            <span className="uppercase font-semibold" style={{ color: riskColor(comparison.level_change?.from).text }}>{comparison.level_change?.from}</span>
                            <ArrowRight className="w-3 h-3 inline mx-1" />
                            <span className="uppercase font-semibold" style={{ color: riskColor(comparison.level_change?.to).text }}>{comparison.level_change?.to}</span>
                          </p>
                        )}
                      </div>
                      <ComparisonCard label="Assessment B" result={comparison.result_b} date={comparison.result_b?.created_at} />
                    </div>
                  </div>

                  {/* Medication Changes */}
                  <div className="rounded-xl shadow-sm p-6" style={{ backgroundColor: 'var(--sma-surface)', border: '1px solid var(--sma-border)' }}>
                    <h2 className="text-lg font-medium mb-4" style={{ fontFamily: 'Outfit', color: 'var(--sma-text-primary)' }}>Medication Changes</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <MedDiffSection title="Added" meds={comparison.medication_diff?.added} color="var(--sma-risk-med-text)" bg="var(--sma-risk-med-bg)" />
                      <MedDiffSection title="Removed" meds={comparison.medication_diff?.removed} color="var(--sma-risk-high-text)" bg="var(--sma-risk-high-bg)" />
                      <MedDiffSection title="Unchanged" meds={comparison.medication_diff?.unchanged} color="var(--sma-risk-low-text)" bg="var(--sma-risk-low-bg)" />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          <div className="mt-6 p-4 rounded-lg text-xs text-center" style={{ backgroundColor: 'var(--sma-surface-alt)', color: 'var(--sma-text-muted)' }}>
            This tool provides decision support only and does not replace professional medical judgment.
          </div>
        </div>
      </main>
    </div>
  );
}

function ComparisonCard({ label, result, date }) {
  if (!result) return null;
  const c = riskColor(result.risk_level);
  const Icon = c.icon;
  return (
    <div className="p-4 rounded-xl text-center" style={{ backgroundColor: c.bg, border: `1px solid ${c.border}` }}>
      <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: c.text }}>{label}</p>
      <Icon className="w-6 h-6 mx-auto mb-1" style={{ color: c.text }} />
      <p className="text-3xl font-bold" style={{ fontFamily: 'Outfit', color: c.text }}>{result.total_score}</p>
      <p className="text-xs uppercase font-semibold" style={{ color: c.text }}>{result.risk_level}</p>
      <p className="text-[10px] mt-1" style={{ color: c.text, opacity: 0.7 }}>{date ? new Date(date).toLocaleDateString() : ''}</p>
    </div>
  );
}

function MedDiffSection({ title, meds, color, bg }) {
  return (
    <div>
      <p className="text-sm font-semibold uppercase tracking-wider mb-2" style={{ color }}>{title} ({meds?.length || 0})</p>
      {meds?.length > 0 ? (
        <div className="space-y-1">
          {meds.map((m, i) => (
            <div key={i} className="px-3 py-1.5 rounded-lg text-sm" style={{ backgroundColor: bg, color }}>
              {m.name} {m.dose ? `(${m.dose})` : ''}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs" style={{ color: 'var(--sma-text-muted)' }}>None</p>
      )}
    </div>
  );
}
