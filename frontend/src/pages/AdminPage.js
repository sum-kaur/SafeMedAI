import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Sidebar from '@/components/Sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Settings, Plus, Trash2, Save, Loader2, AlertTriangle, Shield, CheckCircle, RefreshCw } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AdminPage() {
  const { user } = useAuth();
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [thresholds, setThresholds] = useState({ low: [0, 2], medium: [3, 5], high: [6, 999] });
  const [newMed, setNewMed] = useState({ name: '', score: '1' });
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [deleting, setDeleting] = useState(null);

  useEffect(() => { fetchConfig(); }, []);

  const fetchConfig = async () => {
    try {
      const res = await axios.get(`${API}/admin/scoring-config`, { withCredentials: true });
      setConfig(res.data);
      if (res.data.thresholds) setThresholds(res.data.thresholds);
    } catch (err) {
      if (err.response?.status === 403) toast.error('Access denied: Admin or practitioner role required');
      else console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const saveThresholds = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/admin/scoring-config/thresholds`, thresholds, { withCredentials: true });
      toast.success('Thresholds updated successfully');
    } catch (err) {
      toast.error('Failed to update thresholds');
    } finally {
      setSaving(false);
    }
  };

  const addMedication = async () => {
    if (!newMed.name.trim()) { toast.error('Medication name required'); return; }
    try {
      await axios.post(`${API}/admin/scoring-config/medications`, { name: newMed.name, score: parseInt(newMed.score) }, { withCredentials: true });
      toast.success(`Added ${newMed.name} with ACB score ${newMed.score}`);
      setNewMed({ name: '', score: '1' });
      setAddOpen(false);
      fetchConfig();
    } catch (err) {
      toast.error('Failed to add medication');
    }
  };

  const removeMedication = async (name) => {
    setDeleting(name);
    try {
      await axios.delete(`${API}/admin/scoring-config/medications/${encodeURIComponent(name)}`, { withCredentials: true });
      toast.success(`Removed ${name}`);
      fetchConfig();
    } catch (err) {
      toast.error('Failed to remove medication');
    } finally {
      setDeleting(null);
    }
  };

  const medications = config?.medications ? Object.entries(config.medications) : [];
  const filtered = medications.filter(([name]) => name.toLowerCase().includes(search.toLowerCase()));
  const score3 = filtered.filter(([, s]) => s === 3);
  const score2 = filtered.filter(([, s]) => s === 2);
  const score1 = filtered.filter(([, s]) => s === 1);

  if (loading) return (
    <div className="flex min-h-screen" style={{ backgroundColor: 'var(--sma-bg)' }}>
      <Sidebar /><main className="flex-1 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--sma-brand)' }} /></main>
    </div>
  );

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: 'var(--sma-bg)' }}>
      <Sidebar />
      <main className="flex-1 p-8" data-testid="admin-page">
        <div className="max-w-5xl mx-auto animate-fade-in">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight" style={{ fontFamily: 'Outfit', color: 'var(--sma-text-primary)' }}>Scoring Engine Configuration</h1>
              <p className="text-sm mt-1" style={{ color: 'var(--sma-text-muted)' }}>Configure ACB (Anticholinergic Cognitive Burden) scoring thresholds and medication database</p>
            </div>
            <Button data-testid="refresh-config-btn" variant="outline" onClick={fetchConfig} className="h-10 rounded-full" style={{ borderColor: 'var(--sma-brand)', color: 'var(--sma-brand)' }}>
              <RefreshCw className="w-4 h-4 mr-2" /> Refresh
            </Button>
          </div>

          {/* Thresholds */}
          <div className="rounded-xl shadow-sm p-6 mb-6" style={{ backgroundColor: 'var(--sma-surface)', border: '1px solid var(--sma-border)' }}>
            <h2 className="text-xl font-medium mb-4 flex items-center gap-2" style={{ fontFamily: 'Outfit', color: 'var(--sma-text-primary)' }}>
              <Settings className="w-5 h-5" style={{ color: 'var(--sma-brand)' }} /> Risk Thresholds
            </h2>
            <p className="text-sm mb-6" style={{ color: 'var(--sma-text-secondary)' }}>Define the ACB score ranges for each risk level</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { key: 'low', label: 'Low Risk', icon: CheckCircle, color: 'var(--sma-risk-low-text)', bg: 'var(--sma-risk-low-bg)' },
                { key: 'medium', label: 'Medium Risk', icon: Shield, color: 'var(--sma-risk-med-text)', bg: 'var(--sma-risk-med-bg)' },
                { key: 'high', label: 'High Risk', icon: AlertTriangle, color: 'var(--sma-risk-high-text)', bg: 'var(--sma-risk-high-bg)' },
              ].map(({ key, label, icon: Icon, color, bg }) => (
                <div key={key} className="p-4 rounded-xl" style={{ backgroundColor: bg }} data-testid={`threshold-${key}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <Icon className="w-5 h-5" style={{ color }} />
                    <p className="font-medium text-sm" style={{ color }}>{label}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div>
                      <Label className="text-xs" style={{ color }}>Min</Label>
                      <Input
                        data-testid={`threshold-${key}-min`}
                        type="number"
                        value={thresholds[key]?.[0] ?? 0}
                        onChange={(e) => setThresholds({ ...thresholds, [key]: [parseInt(e.target.value) || 0, thresholds[key]?.[1] ?? 0] })}
                        className="h-9 w-20 mt-1"
                      />
                    </div>
                    <span className="mt-5 font-medium" style={{ color }}>-</span>
                    <div>
                      <Label className="text-xs" style={{ color }}>Max</Label>
                      <Input
                        data-testid={`threshold-${key}-max`}
                        type="number"
                        value={thresholds[key]?.[1] ?? 0}
                        onChange={(e) => setThresholds({ ...thresholds, [key]: [thresholds[key]?.[0] ?? 0, parseInt(e.target.value) || 0] })}
                        className="h-9 w-20 mt-1"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <Button data-testid="save-thresholds-btn" onClick={saveThresholds} disabled={saving} className="mt-6 h-11 rounded-full font-medium" style={{ backgroundColor: 'var(--sma-brand)', color: 'var(--sma-text-inverse)' }}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save Thresholds
            </Button>
          </div>

          {/* Medications Database */}
          <div className="rounded-xl shadow-sm p-6" style={{ backgroundColor: 'var(--sma-surface)', border: '1px solid var(--sma-border)' }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-medium flex items-center gap-2" style={{ fontFamily: 'Outfit', color: 'var(--sma-text-primary)' }}>
                  Medication ACB Scores
                </h2>
                <p className="text-sm mt-1" style={{ color: 'var(--sma-text-muted)' }}>{medications.length} medications in database</p>
              </div>
              <Dialog open={addOpen} onOpenChange={setAddOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="add-medication-btn" className="h-10 rounded-full font-medium" style={{ backgroundColor: 'var(--sma-brand)', color: 'var(--sma-text-inverse)' }}>
                    <Plus className="w-4 h-4 mr-2" /> Add Medication
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-sm" data-testid="add-medication-dialog">
                  <DialogHeader><DialogTitle style={{ fontFamily: 'Outfit' }}>Add Medication</DialogTitle></DialogHeader>
                  <div className="space-y-4 mt-2">
                    <div>
                      <Label>Medication Name</Label>
                      <Input data-testid="new-med-name-input" value={newMed.name} onChange={(e) => setNewMed({ ...newMed, name: e.target.value })} placeholder="e.g. Amitriptyline" className="mt-1" />
                    </div>
                    <div>
                      <Label>ACB Score</Label>
                      <Select value={newMed.score} onValueChange={(v) => setNewMed({ ...newMed, score: v })}>
                        <SelectTrigger className="mt-1" data-testid="new-med-score-select">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 - Potential anticholinergic</SelectItem>
                          <SelectItem value="2">2 - Clinically relevant</SelectItem>
                          <SelectItem value="3">3 - Definite anticholinergic</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button data-testid="confirm-add-med-btn" onClick={addMedication} className="w-full h-10 rounded-full" style={{ backgroundColor: 'var(--sma-brand)', color: 'var(--sma-text-inverse)' }}>Add Medication</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <Input data-testid="search-medications-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search medications..." className="mb-4 h-10" style={{ borderColor: 'var(--sma-border)' }} />

            {[
              { label: 'Score 3 - Definite Anticholinergic', items: score3, color: 'var(--sma-risk-high-text)', bg: 'var(--sma-risk-high-bg)' },
              { label: 'Score 2 - Clinically Relevant', items: score2, color: 'var(--sma-risk-med-text)', bg: 'var(--sma-risk-med-bg)' },
              { label: 'Score 1 - Potential', items: score1, color: 'var(--sma-risk-low-text)', bg: 'var(--sma-risk-low-bg)' },
            ].map(({ label, items, color, bg }) => items.length > 0 && (
              <div key={label} className="mb-6">
                <p className="text-sm font-semibold uppercase tracking-wider mb-2" style={{ color }}>{label} ({items.length})</p>
                <div className="flex flex-wrap gap-2">
                  {items.sort((a, b) => a[0].localeCompare(b[0])).map(([name, score]) => (
                    <div key={name} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm" style={{ backgroundColor: bg, color }} data-testid={`med-chip-${name}`}>
                      <span className="capitalize">{name}</span>
                      <button onClick={() => removeMedication(name)} className="ml-1 hover:opacity-70 cursor-pointer" data-testid={`remove-med-${name}`} disabled={deleting === name}>
                        {deleting === name ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
