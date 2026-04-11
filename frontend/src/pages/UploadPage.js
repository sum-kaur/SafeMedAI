import React, { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Sidebar from '@/components/Sidebar';
import { Button } from '@/components/ui/button';
import { Upload, FileText, Image, X, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function UploadPage() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [uploadedDocs, setUploadedDocs] = useState([]);
  const [processResults, setProcessResults] = useState([]);
  const [dragOver, setDragOver] = useState(false);

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

  const removeFile = (idx) => {
    setFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    setUploading(true);
    try {
      const formData = new FormData();
      files.forEach(f => formData.append('files', f));
      const res = await axios.post(`${API}/upload/${patientId}`, formData, {
        withCredentials: true,
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUploadedDocs(res.data.documents);
      toast.success(`${res.data.documents.length} file(s) uploaded successfully`);
      setFiles([]);
      // Auto-process
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
      const hasSuccess = results.some(r => r.status === 'success');
      if (hasSuccess) {
        toast.success('Documents processed. Risk assessment complete.');
      }
    } catch (err) {
      toast.error('Upload failed: ' + (err.response?.data?.detail || err.message));
    } finally {
      setUploading(false);
      setProcessing(false);
    }
  };

  const hasResults = processResults.length > 0;

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: 'var(--sma-bg)' }}>
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="max-w-3xl mx-auto animate-fade-in">
          <h1 className="text-3xl font-semibold tracking-tight mb-2" style={{ fontFamily: 'Outfit', color: 'var(--sma-text-primary)' }}>Upload Discharge Summary</h1>
          <p className="text-base mb-8" style={{ color: 'var(--sma-text-secondary)' }}>Upload a hospital discharge summary photo or PDF for analysis</p>

          {!hasResults && (
            <>
              {/* Drop Zone */}
              <div
                data-testid="upload-dropzone"
                className={`min-h-[300px] rounded-xl flex flex-col items-center justify-center p-8 transition-all duration-200 cursor-pointer ${dragOver ? 'scale-[1.01]' : ''}`}
                style={{
                  border: `2px dashed ${dragOver ? 'var(--sma-brand)' : 'rgba(59,112,98,0.4)'}`,
                  backgroundColor: dragOver ? 'var(--sma-risk-low-bg)' : 'var(--sma-surface)',
                }}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-12 h-12 mb-4" style={{ color: 'var(--sma-brand)' }} />
                <p className="text-lg font-medium mb-2" style={{ fontFamily: 'Outfit', color: 'var(--sma-text-primary)' }}>
                  Drag & drop files here
                </p>
                <p className="text-sm mb-4" style={{ color: 'var(--sma-text-muted)' }}>or click to browse</p>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium" style={{ backgroundColor: 'var(--sma-surface-alt)', color: 'var(--sma-text-secondary)' }}>
                    <Image className="w-4 h-4" /> JPG, PNG
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium" style={{ backgroundColor: 'var(--sma-surface-alt)', color: 'var(--sma-text-secondary)' }}>
                    <FileText className="w-4 h-4" /> PDF
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  data-testid="file-input"
                  className="hidden"
                  multiple
                  accept=".jpg,.jpeg,.png,.heic,.pdf"
                  onChange={handleFileSelect}
                />
              </div>

              {/* Selected Files */}
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
                  <Button
                    data-testid="upload-submit-btn"
                    onClick={handleUpload}
                    disabled={uploading || processing}
                    className="w-full h-14 text-lg rounded-full font-medium transition-all duration-200"
                    style={{ backgroundColor: 'var(--sma-brand)', color: 'var(--sma-text-inverse)' }}
                  >
                    {uploading ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Uploading...</> :
                     processing ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Analysing documents...</> :
                     'Upload & Analyse'}
                  </Button>
                </div>
              )}
            </>
          )}

          {/* Processing State */}
          {(uploading || processing) && !hasResults && (
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

          {/* Results */}
          {hasResults && (
            <div className="mt-4 space-y-4" data-testid="upload-results">
              {processResults.map((r, i) => (
                <div key={i} className="p-6 rounded-xl" style={{
                  backgroundColor: r.status === 'success' ? 'var(--sma-risk-low-bg)' : 'var(--sma-risk-high-bg)',
                  border: `1px solid ${r.status === 'success' ? 'var(--sma-risk-low-border)' : 'var(--sma-risk-high-border)'}`,
                }}>
                  <div className="flex items-center gap-3 mb-2">
                    {r.status === 'success' ? <CheckCircle className="w-6 h-6" style={{ color: 'var(--sma-risk-low-text)' }} /> : <AlertTriangle className="w-6 h-6" style={{ color: 'var(--sma-risk-high-text)' }} />}
                    <p className="font-medium" style={{ color: r.status === 'success' ? 'var(--sma-risk-low-text)' : 'var(--sma-risk-high-text)' }}>
                      {r.status === 'success' ? 'Analysis Complete' : 'Processing Failed'}
                    </p>
                  </div>
                  {r.status === 'success' && r.data?.risk_result && (
                    <p className="text-sm" style={{ color: 'var(--sma-risk-low-text)' }}>
                      Risk Level: <strong className="uppercase">{r.data.risk_result.risk_level}</strong> | ACB Score: {r.data.risk_result.total_score} | {r.data.risk_result.flagged_count} medications flagged
                    </p>
                  )}
                  {r.status === 'error' && <p className="text-sm" style={{ color: 'var(--sma-risk-high-text)' }}>{r.error}</p>}
                </div>
              ))}
              <div className="flex gap-3">
                <Button data-testid="view-results-after-upload-btn" onClick={() => navigate(`/results/${patientId}`)} className="flex-1 h-14 text-lg rounded-full font-medium" style={{ backgroundColor: 'var(--sma-brand)', color: 'var(--sma-text-inverse)' }}>
                  View Results
                </Button>
                <Button data-testid="ask-questions-after-upload-btn" onClick={() => navigate(`/chat/${patientId}`)} variant="outline" className="flex-1 h-14 text-lg rounded-full font-medium" style={{ borderColor: 'var(--sma-accent)', color: 'var(--sma-accent)' }}>
                  Ask Questions
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
