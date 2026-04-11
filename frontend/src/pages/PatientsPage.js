import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '@/components/Sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus, Search, ArrowRight, Users, Loader2 } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function PatientsPage() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', dob: '', gender: '', emergency_contact: '', gp_details: '' });
  const [creating, setCreating] = useState(false);

  useEffect(() => { fetchPatients(); }, []);

  const fetchPatients = async () => {
    try {
      const res = await axios.get(`${API}/patients`, { withCredentials: true });
      setPatients(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!form.name.trim()) { toast.error('Patient name is required'); return; }
    setCreating(true);
    try {
      const res = await axios.post(`${API}/patients`, form, { withCredentials: true });
      toast.success('Patient created');
      setOpen(false);
      setForm({ name: '', dob: '', gender: '', emergency_contact: '', gp_details: '' });
      navigate(`/patients/${res.data.patient_id}`);
    } catch (err) {
      toast.error('Failed to create patient');
    } finally {
      setCreating(false);
    }
  };

  const filtered = patients.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: 'var(--sma-bg)' }}>
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="max-w-5xl mx-auto animate-fade-in">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-semibold tracking-tight" style={{ fontFamily: 'Outfit', color: 'var(--sma-text-primary)' }}>Patients</h1>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button data-testid="create-patient-btn" className="h-11 px-5 rounded-full font-medium transition-all duration-200 hover:-translate-y-0.5" style={{ backgroundColor: 'var(--sma-brand)', color: 'var(--sma-text-inverse)' }}>
                  <Plus className="w-4 h-4 mr-2" /> Add Patient
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md" data-testid="create-patient-dialog">
                <DialogHeader>
                  <DialogTitle style={{ fontFamily: 'Outfit' }}>New Patient</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div>
                    <Label htmlFor="name">Full Name *</Label>
                    <Input id="name" data-testid="patient-name-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Enter patient full name" className="mt-1" />
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
                    <Input id="gp" data-testid="patient-gp-input" value={form.gp_details} onChange={e => setForm({ ...form, gp_details: e.target.value })} placeholder="Doctor name and practice" className="mt-1" />
                  </div>
                  <Button data-testid="save-patient-btn" onClick={handleCreate} disabled={creating} className="w-full h-11 rounded-full" style={{ backgroundColor: 'var(--sma-brand)', color: 'var(--sma-text-inverse)' }}>
                    {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Patient'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: 'var(--sma-text-muted)' }} />
              <Input data-testid="search-patients-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search patients..." className="pl-10 h-11 rounded-lg" style={{ borderColor: 'var(--sma-border)' }} />
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--sma-brand)' }} /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 rounded-xl" style={{ backgroundColor: 'var(--sma-surface)', border: '1px solid var(--sma-border)' }}>
              <Users className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--sma-text-muted)' }} />
              <h3 className="text-xl font-medium mb-2" style={{ fontFamily: 'Outfit', color: 'var(--sma-text-primary)' }}>No patients found</h3>
              <p style={{ color: 'var(--sma-text-secondary)' }}>Create a new patient to get started</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(p => (
                <button
                  key={p.patient_id}
                  data-testid={`patient-row-${p.patient_id}`}
                  onClick={() => navigate(`/patients/${p.patient_id}`)}
                  className="w-full flex items-center justify-between p-5 rounded-xl shadow-sm transition-all duration-200 hover:-translate-y-0.5 cursor-pointer text-left"
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
                  <ArrowRight className="w-5 h-5" style={{ color: 'var(--sma-text-muted)' }} />
                </button>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
