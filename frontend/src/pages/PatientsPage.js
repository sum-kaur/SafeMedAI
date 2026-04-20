import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import Sidebar from '@/components/Sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Search, ArrowRight, Users, Loader2, FileText, X, Plus } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { getApiUrl } from '@/lib/utils';
import { uploadAndProcessDocuments } from '@/lib/uploadRisk';

const API = getApiUrl('/api');

export default function PatientsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const isFamily = user?.role === 'family_carer';
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', dob: '', gender: '', emergency_contact: '', gp_details: '', gp_phone: '', medical_history: '' });
  const [files, setFiles] = useState([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => { fetchPatients(); }, []);

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setOpen(true);
    }
  }, [searchParams]);

  const fetchPatients = async () => {
    try {
      const res = await axios.get(`${API}/patients`, { withCredentials: true });
      if (!Array.isArray(res.data)) {
        console.error('Unexpected patients response:', res.data);
        toast.error('Could not load patients. Please sign in again.');
        setPatients([]);
        return;
      }
      setPatients(res.data);
    } catch (err) {
      console.error('Failed to fetch patients:', err);
      setPatients([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!form.name.trim()) { toast.error('Patient name is required'); return; }
    setCreating(true);
    try {
      const res = await axios.post(`${API}/patients`, form, { withCredentials: true });
      const patientId = res.data.patient_id;
      toast.success(isFamily ? 'Loved one added' : 'Patient created');

      if (files.length > 0) {
        const { results } = await uploadAndProcessDocuments(patientId, files, {
          onUploaded: (documents) => toast.success(`${documents.length} file(s) received`),
        });
        if (results.some(r => r.status === 'success')) {
          toast.success('Risk assessment complete');
          navigate(`/results/${patientId}`);
        } else {
          toast.error('File received, but analysis failed');
          navigate(`/upload/${patientId}`);
        }
      } else {
        navigate(`/upload/${patientId}`);
      }

      setOpen(false);
      setSearchParams({});
      setForm({ name: '', dob: '', gender: '', emergency_contact: '', gp_details: '', gp_phone: '', medical_history: '' });
      setFiles([]);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create patient');
    } finally {
      setCreating(false);
    }
  };

  const handleFileSelect = (e) => {
    const selected = Array.from(e.target.files || []).filter(f =>
      ['image/jpeg', 'image/png', 'image/heic', 'application/pdf'].includes(f.type) || f.name.match(/\.(jpg|jpeg|png|heic|pdf)$/i)
    );
    setFiles(selected);
  };

  const filtered = Array.isArray(patients)
    ? patients.filter(p => (p.name || '').toLowerCase().includes(search.toLowerCase()))
    : [];

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: 'var(--sma-bg)' }}>
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="max-w-5xl mx-auto animate-fade-in">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-semibold tracking-tight" style={{ fontFamily: 'Outfit', color: 'var(--sma-text-primary)' }}>{isFamily ? 'My Family' : 'Patients'}</h1>
            <Dialog open={open} onOpenChange={(nextOpen) => {
              setOpen(nextOpen);
              if (!nextOpen) {
                setFiles([]);
                if (searchParams.get('new') === '1') setSearchParams({});
              }
            }}>
              <DialogTrigger asChild>
                <Button data-testid="create-patient-btn" className="h-11 px-5 rounded-lg font-medium transition-all duration-200 hover:-translate-y-0.5" style={{ backgroundColor: 'var(--sma-brand)', color: 'var(--sma-text-inverse)' }}>
                  <Plus className="w-4 h-4 mr-2" /> {isFamily ? 'Add Person' : 'New Case'}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg" data-testid="create-patient-dialog">
                <DialogHeader>
                  <DialogTitle style={{ fontFamily: 'Outfit' }}>{isFamily ? 'Add Loved One' : 'New Patient'}</DialogTitle>
                </DialogHeader>
                <p className="text-sm mt-1" style={{ color: 'var(--sma-text-secondary)' }}>
                  Add the essentials and attach a discharge summary to check medication risk.
                </p>
                <div className="space-y-4 mt-4">
                  <div>
                    <Label htmlFor="name">Full Name *</Label>
                    <Input id="name" data-testid="patient-name-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder={isFamily ? "Enter loved one's full name" : "Enter patient full name"} className="mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="dob">Date of Birth</Label>
                    <Input id="dob" data-testid="patient-dob-input" type="date" value={form.dob} onChange={e => setForm({ ...form, dob: e.target.value })} className="mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="gender">Gender</Label>
                    <Input id="gender" data-testid="patient-gender-input" value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })} placeholder="e.g. Female, Male" className="mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="ec">Emergency Contact</Label>
                    <Input id="ec" data-testid="patient-emergency-input" value={form.emergency_contact} onChange={e => setForm({ ...form, emergency_contact: e.target.value })} placeholder="Name and phone number" className="mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="gp">GP / Usual Doctor</Label>
                    <Input id="gp" data-testid="patient-gp-input" value={form.gp_details} onChange={e => setForm({ ...form, gp_details: e.target.value })} placeholder={isFamily ? "Doctor name and practice" : "Doctor name and practice"} className="mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="gp_phone">GP Contact Number</Label>
                    <Input id="gp_phone" data-testid="patient-gp-phone-input" type="tel" value={form.gp_phone} onChange={e => setForm({ ...form, gp_phone: e.target.value })} placeholder="e.g. 03 9123 4567" className="mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="medical_history">{isFamily ? 'Medical History' : 'Past Medical History'}</Label>
                    <Textarea id="medical_history" data-testid="patient-medical-history-input" value={form.medical_history} onChange={e => setForm({ ...form, medical_history: e.target.value })} placeholder={isFamily ? "e.g. dementia, diabetes, heart conditions, previous hospitalisations" : "Relevant medical background, diagnoses, allergies"} className="mt-1" rows={3} />
                  </div>
                  <div>
                    <Label htmlFor="summary-file">Discharge Summary</Label>
                    <label
                      htmlFor="summary-file"
                      className="mt-1 flex items-center justify-between gap-3 rounded-lg px-4 py-3 cursor-pointer"
                      style={{ border: '1px dashed var(--sma-border)', backgroundColor: 'var(--sma-surface-alt)' }}
                    >
                      <span className="flex items-center gap-3 min-w-0">
                        <FileText className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--sma-brand)' }} />
                        <span className="text-sm truncate" style={{ color: 'var(--sma-text-secondary)' }}>
                          {files.length > 0 ? `${files.length} file${files.length > 1 ? 's' : ''} selected` : 'Attach PDF or photo'}
                        </span>
                      </span>
                      <span className="text-sm font-medium flex-shrink-0" style={{ color: 'var(--sma-brand)' }}>
                        Browse
                      </span>
                    </label>
                    <input
                      id="summary-file"
                      data-testid="embedded-upload-input"
                      type="file"
                      accept="image/jpeg,image/png,image/heic,application/pdf,.jpg,.jpeg,.png,.heic,.pdf"
                      multiple
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    {files.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {files.map((file, idx) => (
                          <div key={`${file.name}-${idx}`} className="flex items-center justify-between gap-2 text-xs rounded-md px-2 py-1" style={{ backgroundColor: 'var(--sma-surface-alt)', color: 'var(--sma-text-muted)' }}>
                            <span className="truncate">{file.name}</span>
                            <button type="button" onClick={() => setFiles(prev => prev.filter((_, i) => i !== idx))} aria-label={`Remove ${file.name}`}>
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button data-testid="save-patient-btn" onClick={handleCreate} disabled={creating} className="w-full h-11 rounded-full" style={{ backgroundColor: 'var(--sma-brand)', color: 'var(--sma-text-inverse)' }}>
                    {creating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing</> : <><FileText className="w-4 h-4 mr-2" /> {files.length > 0 ? 'Create & Analyse' : 'Create Case'}</>}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: 'var(--sma-text-muted)' }} />
              <Input data-testid="search-patients-input" value={search} onChange={e => setSearch(e.target.value)} placeholder={isFamily ? "Search loved ones..." : "Search patients..."} className="pl-10 h-11 rounded-lg" style={{ borderColor: 'var(--sma-border)' }} />
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--sma-brand)' }} /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 rounded-xl" style={{ backgroundColor: 'var(--sma-surface)', border: '1px solid var(--sma-border)' }}>
              <Users className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--sma-text-muted)' }} />
              <h3 className="text-xl font-medium mb-2" style={{ fontFamily: 'Outfit', color: 'var(--sma-text-primary)' }}>{isFamily ? 'No loved ones found' : 'No patients found'}</h3>
              <p style={{ color: 'var(--sma-text-secondary)' }}>{isFamily ? 'Add a loved one, then attach their discharge summary' : 'Create a patient, then attach a discharge summary'}</p>
              <Button data-testid="empty-create-upload-btn" onClick={() => setOpen(true)} className="mt-5 h-11 rounded-full font-medium" style={{ backgroundColor: 'var(--sma-brand)', color: 'var(--sma-text-inverse)' }}>
                <FileText className="w-4 h-4 mr-2" /> {isFamily ? 'Add Person' : 'New Case'}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(p => (
                <div
                  key={p.patient_id}
                  data-testid={`patient-row-${p.patient_id}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/patients/${p.patient_id}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') navigate(`/patients/${p.patient_id}`);
                  }}
                  className="w-full flex items-center justify-between gap-4 p-5 rounded-xl shadow-sm transition-all duration-200 hover:-translate-y-0.5 cursor-pointer text-left"
                  style={{ backgroundColor: 'var(--sma-surface)', border: '1px solid var(--sma-border)' }}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--sma-risk-low-bg)' }}>
                      <span className="text-sm font-semibold" style={{ color: 'var(--sma-brand)' }}>{p.name[0]}</span>
                    </div>
                    <div>
                      <p className="font-medium" style={{ color: 'var(--sma-text-primary)' }}>{p.name}</p>
                      <p className="text-sm" style={{ color: 'var(--sma-text-muted)' }}>DOB: {p.dob || 'Not set'} {p.gender ? `| ${p.gender}` : ''}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      type="button"
                      data-testid={`patient-upload-${p.patient_id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/upload/${p.patient_id}`);
                      }}
                      className="h-9 px-3 rounded-lg text-sm font-medium flex items-center gap-2"
                      style={{ backgroundColor: 'var(--sma-risk-low-bg)', color: 'var(--sma-brand)', border: '1px solid var(--sma-risk-low-border)' }}
                    >
                      <FileText className="w-4 h-4" /> Analyse
                    </button>
                    <ArrowRight className="w-5 h-5" style={{ color: 'var(--sma-text-muted)' }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
