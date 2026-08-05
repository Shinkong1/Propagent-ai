import { useEffect, useState } from 'react';
import Head from 'next/head';
import { Plus, X, Wrench } from 'lucide-react';
import toast from 'react-hot-toast';
import PortalLayout from '../../components/PortalLayout';
import { tenantPortal } from '../../lib/tenantApi';

const STATUS_COLOR: Record<string, string> = { open: '#EF4444', in_progress: '#3B82F6', waiting_vendor: '#F97316', scheduled: '#8B5CF6', completed: '#10B981', cancelled: '#64748B' };
const CATEGORIES = ['plumbing', 'electrical', 'hvac', 'appliance', 'structural', 'pest_control', 'cleaning', 'landscaping', 'other'];
const PRIORITIES = ['low', 'medium', 'high', 'emergency'];
const EMPTY_FORM = { title: '', description: '', category: 'other', priority: 'medium' };

export default function TenantMaintenance() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    tenantPortal.maintenanceList().then(r => setTickets(r.data || [])).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (!form.title.trim() || !form.description.trim()) {
      toast.error('Title and description are required');
      return;
    }
    setSubmitting(true);
    try {
      await tenantPortal.maintenanceCreate(form);
      toast.success('Request submitted');
      setShowModal(false);
      setForm(EMPTY_FORM);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PortalLayout>
      <Head><title>Tenant Portal — Maintenance</title></Head>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 24, color: 'var(--text-primary)' }}>Maintenance</h1>
        <button onClick={() => setShowModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: 'linear-gradient(135deg, #FBC02D, #F57F17)', color: 'var(--bg-app)', border: 'none', borderRadius: 8, fontWeight: 700, fontFamily: 'Syne', fontSize: 13, cursor: 'pointer' }}>
          <Plus size={15} /> New Request
        </button>
      </div>

      {loading ? (
        <div style={{ color: '#64748B', fontFamily: 'IBM Plex Mono' }}>Loading...</div>
      ) : tickets.length === 0 ? (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 14, padding: 40, textAlign: 'center', color: '#64748B' }}>
          <Wrench size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
          <p style={{ fontSize: 14 }}>No maintenance requests yet.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {tickets.map((t) => (
            <div key={t.id} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 12, padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 600, fontFamily: 'IBM Plex Sans', color: 'var(--text-primary)' }}>{t.title}</span>
                <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 4, background: `${STATUS_COLOR[t.status]}20`, color: STATUS_COLOR[t.status], fontFamily: 'IBM Plex Mono' }}>{t.status.replace('_', ' ')}</span>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>{t.description}</p>
              <div style={{ fontSize: 11, color: '#64748B', fontFamily: 'IBM Plex Mono' }}>
                {t.category.replace('_', ' ')} · {t.priority} · {new Date(t.created_at).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 440, maxHeight: '90vh', overflowY: 'auto', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 18, color: 'var(--text-primary)' }}>New Maintenance Request</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer' }}><X size={18} /></button>
            </div>

            <label style={lbl}>Title</label>
            <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Leaking kitchen faucet"
              spellCheck autoCorrect="on" style={{ ...inp, marginBottom: 14 }} />

            <label style={lbl}>Description</label>
            <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Describe the issue..."
              spellCheck autoCorrect="on" autoCapitalize="sentences" style={{ ...inp, height: 90, resize: 'none', marginBottom: 14 } as any} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
              <div>
                <label style={lbl}>Category</label>
                <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} style={{ ...inp } as any}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Priority</label>
                <select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))} style={{ ...inp } as any}>
                  {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>

            <button onClick={submit} disabled={submitting} style={{ width: '100%', padding: 12, background: 'linear-gradient(135deg, #FBC02D, #F57F17)', color: 'var(--bg-app)', fontWeight: 700, fontFamily: 'Syne', fontSize: 14, border: 'none', borderRadius: 8, cursor: 'pointer' }}>
              {submitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </div>
      )}
    </PortalLayout>
  );
}

const lbl: React.CSSProperties = { display: 'block', marginBottom: 5, fontSize: 12, fontFamily: 'IBM Plex Mono', color: 'var(--text-secondary)' };
const inp: React.CSSProperties = { width: '100%', padding: '9px 12px', background: 'var(--bg-app)', border: '1px solid var(--border-input)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, fontFamily: 'IBM Plex Sans', outline: 'none', boxSizing: 'border-box' };
