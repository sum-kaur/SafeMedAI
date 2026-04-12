import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import Sidebar from '@/components/Sidebar';
import { Button } from '@/components/ui/button';
import { Upload, FileText, Image, X, Loader2, CheckCircle, AlertTriangle, Camera, Shield, BarChart3, MessageCircle, ArrowRight, Clock, Pill, Info } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const riskColor = (level) => ({
  high: { bg: 'var(--sma-risk-high-bg)', border: 'var(--sma-risk-high-border)', text: 'var(--sma-risk-high-text)', icon: AlertTriangle },
  medium: { bg: 'var(--sma-risk-med-bg)', border: 'var(--sma-risk-med-border)', text: 'var(--sma-risk-med-text)', icon: Shield },
  low: { bg: 'var(--sma-risk-low-bg)', border: 'var(--sma-risk-low-border)', text: 'var(--sma-risk-low-text)', icon: CheckCircle },
}[level] || { bg: 'var(--sma-surface-alt)', border: 'var(--sma-border)', text: 'var(--sma-text-muted)', icon: Shield });

export default function UploadPage() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const isFamily = user?.role === 'family_carer';
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processResults, setProcessResults] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [prevDocs, setPrevDocs] = useState([]);
  const [patient, setPatient] = useState(null);
  const [latestRisk, setLatestRisk] = useState(null);
  const [loadingPrev, setLoadingPrev] = useState(true);

  useEffect(() => { fetchPreviousData(); }, [patientId]);

  const fetchPreviousData = async () => {
    try {
      const [patRes, riskRes] = await Promise.all([
        axios.get(`${API}/patients/${patientId}`, { withCredentials: true }),
        axios.get(`${API}/risk-results/${patientId}/latest`, { withCredentials: true }),
      ]);
      setPatient(patRes.data.patient);
      setPrevDocs(patRes.data.documents || []);
      if (riskRes.data?.risk_result) setLatestRisk(riskRes.data);
    } catch (err) { console.error(err); }
    finally { setLoadingPrev(false); }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = Array.from(e.dataTransfer.files).filter(f =>
      ['image/jpeg', 'image/png', 'image/heic', 'application/pdf'].includes(f.type) || f.name.match(/\.(jpg|jpeg|png|heic|pdf)$/i)
    );
    setFiles(prev => [...prev, ...dropped]);
  };

  const handleFileSelect = (e) => {
    const selected = Array.from(e.target.files);
    setFiles(prev => [...prev, ...selected]);
  };

  const removeFile = (idx) => setFiles(prev => prev.filter((_, i) => i !== idx));

  const handleUpload = async () => {
    if (files.length === 0) return;
    setUploading(true);
    setProcessResults([]);
    try {
      const formData = new FormData();
      files.forEach(f => formData.append('files', f));
      const res = await axios.post(`${API}/upload/${patientId}`, formData, { withCredentials: true, headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success(`${res.data.documents.length} file(s) uploaded`);
      setFiles([]);
      setProcessing(true);
      const results = [];
      for (const doc of res.data.documents) {
        if (doc.status === 'error') continue;
        try {
          const processRes = await axios.post(`${API}/process/${doc.document_id}`, {}, { withCredentials: true });
          results.push({ doc_id: doc.document_id, status: 'success', data: processRes.data });
        } catch (err) {
          results.push({ doc_id: doc.document_id, status: 'error', error: err.response?.data?.detail || 'Processing failed' });
        }
      }
      setProcessResults(results);
      if (results.some(r => r.status === 'success')) {
        toast.success('Risk assessment complete');
        fetchPreviousData();
      }
    } catch (err) {
      toast.error('Upload failed: ' + (err.response?.data?.detail || err.message));
    } finally {
      setUploading(false);
      setProcessing(false);
    }
  };

  const hasNewResults = processResults.length > 0;
  const newResult = processResults.find(r => r.status === 'success')?.data;

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: 'var(--sma-bg)' }}>
      <Sidebar />
      <main className="flex-1 p-8" data-testid="upload-page">
        <div className="max-w-4xl mx-auto animate-fade-in">
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight" style={{ fontFamily: 'Outfit', color: 'var(--sma-text-primary)' }}>
                {isFamily ? 'Upload Discharge Summary' : 'Upload Document'}
              </h1>
              {patient && <p className="text-sm mt-1" style={{ color: 'var(--sma-text-muted)' }}>Patient: {patient.name} {patient.dob ? `| DOB: ${patient.dob}` : ''}</p>}
            </div>
            {latestRisk?.risk_result && (
              <Button data-testid="go-to-results-btn" onClick={() => navigate(`/results/${patientId}`)} variant="outline" className="h-10 rounded-full" style={{ borderColor: riskColor(latestRisk.risk_result.risk_level).border, color: riskColor(latestRisk.risk_result.risk_level).text }}>
                <BarChart3 className="w-4 h-4 mr-2" /> View Full Analysis
              </Button>
            )}
          </div>
          <p className="text-base mb-6" style={{ color: 'var(--sma-text-secondary)' }}>
            {isFamily ? 'Upload a hospital discharge summary photo or PDF to get a medication risk score' : 'Upload discharge summary photo, screenshot, or PDF for analysis'}
          </p>

          {/* Inline New Risk Score Result */}
          {hasNewResults && newResult?.risk_result && (
            <InlineRiskScore result={newResult} isFamily={isFamily} navigate={navigate} patientId={patientId} />
          )}

          {/* Upload Zone (show when no new results, or allow re-upload) */}
          {(!hasNewResults || processResults.every(r => r.status === 'error')) && (
            <>
              <div
                data-testid="upload-dropzone"
                className={`min-h-[250px] rounded-xl flex flex-col items-center justify-center p-8 transition-all duration-200 cursor-pointer ${dragOver ? 'scale-[1.01]' : ''}`}
                style={{ border: `2px dashed ${dragOver ? 'var(--sma-brand)' : 'rgba(59,112,98,0.4)'}`, backgroundColor: dragOver ? 'var(--sma-risk-low-bg)' : 'var(--sma-surface)' }}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-12 h-12 mb-4" style={{ color: 'var(--sma-brand)' }} />
                <p className="text-lg font-medium mb-2" style={{ fontFamily: 'Outfit', color: 'var(--sma-text-primary)' }}>Drag & drop files here</p>
                <p className="text-sm mb-4" style={{ color: 'var(--sma-text-muted)' }}>or click to browse</p>
                <div className="flex items-center gap-4 flex-wrap justify-center">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium" style={{ backgroundColor: 'var(--sma-surface-alt)', color: 'var(--sma-text-secondary)' }}><Image className="w-4 h-4" /> JPG, PNG</div>
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium" style={{ backgroundColor: 'var(--sma-surface-alt)', color: 'var(--sma-text-secondary)' }}><FileText className="w-4 h-4" /> PDF</div>
                </div>
                <input ref={fileInputRef} type="file" data-testid="file-input" className="hidden" multiple accept=".jpg,.jpeg,.png,.heic,.pdf" onChange={handleFileSelect} />
              </div>
              <div className="mt-4">
                <Button data-testid="camera-capture-btn" onClick={(e) => { e.stopPropagation(); cameraInputRef.current?.click(); }} variant="outline" className="w-full h-14 text-base rounded-xl font-medium hover:-translate-y-0.5" style={{ borderColor: 'var(--sma-accent)', color: 'var(--sma-accent)' }}>
                  <Camera className="w-5 h-5 mr-2" /> Take Photo with Camera
                </Button>
                <input ref={cameraInputRef} type="file" data-testid="camera-input" className="hidden" accept="image/*" capture="environment" onChange={handleFileSelect} />
                <p className="text-xs mt-2 text-center" style={{ color: 'var(--sma-text-muted)' }}>Use your phone camera to capture a discharge summary directly</p>
              </div>
              {files.length > 0 && (
                <div className="mt-6 space-y-3">
                  <p className="text-sm font-medium" style={{ color: 'var(--sma-text-secondary)' }}>{files.length} file(s) selected</p>
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: 'var(--sma-surface)', border: '1px solid var(--sma-border)' }} data-testid={`selected-file-${i}`}>
                      <div className="flex items-center gap-3">
                        {f.type?.includes('pdf') ? <FileText className="w-5 h-5" style={{ color: 'var(--sma-accent)' }} /> : <Image className="w-5 h-5" style={{ color: 'var(--sma-brand)' }} />}
                        <span className="text-sm" style={{ color: 'var(--sma-text-primary)' }}>{f.name}</span>
                        <span className="text-xs" style={{ color: 'var(--sma-text-muted)' }}>({(f.size / 1024).toFixed(1)} KB)</span>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); removeFile(i); }} className="p-1 rounded hover:bg-red-50" data-testid={`remove-file-${i}`}>
                        <X className="w-4 h-4" style={{ color: 'var(--sma-risk-high-text)' }} />
                      </button>
                    </div>
                  ))}
                  <Button data-testid="upload-submit-btn" onClick={handleUpload} disabled={uploading || processing} className="w-full h-14 text-lg rounded-full font-medium" style={{ backgroundColor: 'var(--sma-brand)', color: 'var(--sma-text-inverse)' }}>
                    {uploading ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Uploading...</> :
                     processing ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Analysing...</> :
                     'Upload & Get Risk Score'}
                  </Button>
                </div>
              )}
            </>
          )}

          {/* Processing State */}
          {(uploading || processing) && !hasNewResults && (
            <div className="mt-8 text-center p-8 rounded-xl" style={{ backgroundColor: 'var(--sma-surface)', border: '1px solid var(--sma-border)' }} data-testid="processing-state">
              <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin" style={{ color: 'var(--sma-brand)' }} />
              <p className="text-lg font-medium" style={{ fontFamily: 'Outfit', color: 'var(--sma-text-primary)' }}>
                {uploading ? 'Uploading files...' : 'Analysing discharge summary...'}
              </p>
              <p className="text-sm mt-2" style={{ color: 'var(--sma-text-muted)' }}>
                {processing ? 'Extracting medications, calculating risk score, and generating recommendations' : 'Securely uploading your files'}
              </p>
            </div>
          )}

          {/* Upload Another after results */}
          {hasNewResults && processResults.some(r => r.status === 'success') && (
            <Button data-testid="upload-another-btn" onClick={() => setProcessResults([])} variant="outline" className="w-full h-12 rounded-xl font-medium mt-4" style={{ borderColor: 'var(--sma-brand)', color: 'var(--sma-brand)' }}>
              <Upload className="w-4 h-4 mr-2" /> Upload Another Document
            </Button>
          )}

          {/* Error results */}
          {hasNewResults && processResults.every(r => r.status === 'error') && (
            <div className="mt-4 p-6 rounded-xl" style={{ backgroundColor: 'var(--sma-risk-high-bg)', border: '1px solid var(--sma-risk-high-border)' }}>
              <div className="flex items-center gap-3 mb-2">
                <AlertTriangle className="w-6 h-6" style={{ color: 'var(--sma-risk-high-text)' }} />
                <p className="font-medium" style={{ color: 'var(--sma-risk-high-text)' }}>Processing Failed</p>
              </div>
              <p className="text-sm" style={{ color: 'var(--sma-risk-high-text)' }}>{processResults[0]?.error}</p>
            </div>
          )}

          {/* Previously Uploaded Documents */}
          {!loadingPrev && prevDocs.length > 0 && (
            <div className="mt-8 rounded-xl shadow-sm p-6" style={{ backgroundColor: 'var(--sma-surface)', border: '1px solid var(--sma-border)' }} data-testid="previous-documents-section">
              <h2 className="text-lg font-medium mb-4 flex items-center gap-2" style={{ fontFamily: 'Outfit', color: 'var(--sma-text-primary)' }}>
                <Clock className="w-5 h-5" style={{ color: 'var(--sma-brand)' }} /> Previously Uploaded Documents
              </h2>
              <div className="space-y-2">
                {prevDocs.map((d) => (
                  <div key={d.document_id} className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: 'var(--sma-surface-alt)' }} data-testid={`prev-doc-${d.document_id}`}>
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 flex-shrink-0" style={{ color: d.status === 'processed' ? 'var(--sma-brand)' : 'var(--sma-text-muted)' }} />
                      <div>
                        <p className="text-sm font-medium" style={{ color: 'var(--sma-text-primary)' }}>{d.original_filename}</p>
                        <p className="text-xs" style={{ color: 'var(--sma-text-muted)' }}>{new Date(d.created_at).toLocaleDateString()} | {d.status}</p>
                      </div>
                    </div>
                    {d.status === 'processed' && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ backgroundColor: 'var(--sma-risk-low-bg)', color: 'var(--sma-risk-low-text)' }}>Analysed</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Existing Latest Risk (if no new upload) */}
          {!hasNewResults && latestRisk?.risk_result && (
            <div className="mt-6 rounded-xl p-6" style={{ backgroundColor: riskColor(latestRisk.risk_result.risk_level).bg, border: `2px solid ${riskColor(latestRisk.risk_result.risk_level).border}` }} data-testid="existing-risk-summary">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  {React.createElement(riskColor(latestRisk.risk_result.risk_level).icon, { className: "w-6 h-6", style: { color: riskColor(latestRisk.risk_result.risk_level).text } })}
                  <div>
                    <p className="text-sm uppercase font-bold tracking-wider" style={{ color: riskColor(latestRisk.risk_result.risk_level).text }}>Latest: {latestRisk.risk_result.risk_level} Risk</p>
                    <p className="text-xs" style={{ color: riskColor(latestRisk.risk_result.risk_level).text }}>Score: {latestRisk.risk_result.total_score} | {latestRisk.risk_result.flagged_count} medications flagged</p>
                  </div>
                </div>
                <Button data-testid="view-full-analysis-btn" onClick={() => navigate(`/results/${patientId}`)} size="sm" className="h-8 rounded-full text-xs" style={{ backgroundColor: riskColor(latestRisk.risk_result.risk_level).text, color: 'white' }}>
                  View Full Analysis
                </Button>
              </div>
            </div>
          )}

          <div className="mt-8 p-4 rounded-lg text-xs text-center" style={{ backgroundColor: 'var(--sma-surface-alt)', color: 'var(--sma-text-muted)' }}>
            Your files are processed securely. This tool provides decision support only and does not replace professional medical judgment.
          </div>
        </div>
      </main>
    </div>
  );
}

/* ======================== INLINE RISK SCORE DISPLAY ======================== */
function InlineRiskScore({ result, isFamily, navigate, patientId }) {
  const rr = result.risk_result;
  const summary = result.summary;
  const c = riskColor(rr.risk_level);
  const RIcon = c.icon;
  const recommendations = isFamily ? rr.recommendations_family : rr.recommendations_practitioner;

  return (
    <div className="mb-6 space-y-4 animate-fade-in" data-testid="inline-risk-score">
      {/* Score Card */}
      <div className="rounded-xl p-6" style={{ backgroundColor: c.bg, border: `2px solid ${c.border}` }}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.5)' }}>
              <p className="text-3xl font-bold" style={{ fontFamily: 'Outfit', color: c.text }}>{rr.total_score}</p>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <RIcon className="w-6 h-6" style={{ color: c.text }} />
                <p className="text-xl font-semibold uppercase" style={{ fontFamily: 'Outfit', color: c.text }}>{rr.risk_level} Risk</p>
              </div>
              <p className="text-sm mt-0.5" style={{ color: c.text }}>{rr.flagged_count} of {rr.medication_count} medications flagged | Engine: {rr.scoring_engine}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button data-testid="view-results-after-upload-btn" onClick={() => navigate(`/results/${patientId}`)} className="h-11 rounded-full font-medium" style={{ backgroundColor: c.text, color: 'white' }}>
              <BarChart3 className="w-4 h-4 mr-2" /> Full Analysis
            </Button>
            <Button data-testid="ask-questions-after-upload-btn" onClick={() => navigate(`/chat/${patientId}`)} variant="outline" className="h-11 rounded-full font-medium" style={{ borderColor: c.text, color: c.text }}>
              <MessageCircle className="w-4 h-4 mr-2" /> Ask Questions
            </Button>
          </div>
        </div>
      </div>

      {/* Flagged Medications */}
      {rr.risk_factors?.length > 0 && (
        <div className="rounded-xl shadow-sm p-5" style={{ backgroundColor: 'var(--sma-surface)', border: '1px solid var(--sma-border)' }}>
          <h3 className="text-base font-medium mb-3 flex items-center gap-2" style={{ fontFamily: 'Outfit', color: 'var(--sma-text-primary)' }}>
            <Pill className="w-4 h-4" style={{ color: c.text }} /> Flagged Medications
          </h3>
          <div className="flex flex-wrap gap-2">
            {rr.risk_factors.map((rf, i) => (
              <span key={i} className="px-3 py-1 rounded-full text-sm font-medium" style={{ backgroundColor: c.bg, color: c.text, border: `1px solid ${c.border}` }} data-testid={`flagged-inline-${i}`}>
                {rf.medication} <span className="opacity-70">(score {rf.score || rf.acb_score})</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Top Recommendations */}
      {recommendations?.length > 0 && (
        <div className="rounded-xl shadow-sm p-5" style={{ backgroundColor: 'var(--sma-surface)', border: '1px solid var(--sma-border)' }}>
          <h3 className="text-base font-medium mb-3" style={{ fontFamily: 'Outfit', color: 'var(--sma-text-primary)' }}>
            {isFamily ? 'What To Do Next' : 'Recommendations'}
          </h3>
          <div className="space-y-2">
            {recommendations.slice(0, 4).map((rec, i) => {
              const recStyle = {
                urgent: { bg: 'var(--sma-risk-high-bg)', text: 'var(--sma-risk-high-text)', icon: AlertTriangle },
                action: { bg: 'var(--sma-risk-med-bg)', text: 'var(--sma-risk-med-text)', icon: ArrowRight },
                warning: { bg: 'var(--sma-risk-high-bg)', text: 'var(--sma-risk-high-text)', icon: AlertTriangle },
                flag: { bg: 'var(--sma-risk-med-bg)', text: 'var(--sma-risk-med-text)', icon: Shield },
                info: { bg: 'var(--sma-risk-low-bg)', text: 'var(--sma-risk-low-text)', icon: Info },
                resource: { bg: '#EDE9FE', text: '#5B21B6', icon: Info },
              }[rec.type] || { bg: 'var(--sma-surface-alt)', text: 'var(--sma-text-secondary)', icon: Info };
              const RecIcon = recStyle.icon;
              return (
                <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-lg" style={{ backgroundColor: recStyle.bg }} data-testid={`inline-rec-${i}`}>
                  <RecIcon className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: recStyle.text }} />
                  <p className="text-sm" style={{ color: recStyle.text }}>{rec.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Extracted Summary Snippet */}
      {summary && (summary.diagnosis || summary.discharge_instructions) && (
        <div className="rounded-xl shadow-sm p-5" style={{ backgroundColor: 'var(--sma-surface)', border: '1px solid var(--sma-border)' }}>
          <h3 className="text-base font-medium mb-3" style={{ fontFamily: 'Outfit', color: 'var(--sma-text-primary)' }}>Extracted Summary</h3>
          {summary.diagnosis && (
            <div className="mb-2"><p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--sma-text-muted)' }}>Diagnosis</p><p className="text-sm" style={{ color: 'var(--sma-text-primary)' }}>{summary.diagnosis}</p></div>
          )}
          {summary.discharge_instructions && (
            <div className="mb-2"><p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--sma-text-muted)' }}>Instructions</p><p className="text-sm" style={{ color: 'var(--sma-text-primary)' }}>{summary.discharge_instructions}</p></div>
          )}
          {summary.follow_up && (
            <div><p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--sma-text-muted)' }}>Follow-Up</p><p className="text-sm" style={{ color: 'var(--sma-text-primary)' }}>{summary.follow_up}</p></div>
          )}
        </div>
      )}
    </div>
  );
}
