import { useEffect, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '../../components/DashboardLayout';
import { Building2, Plus, MapPin, Home, X, Users, Wrench, Trash2 } from 'lucide-react';
import { properties as propertiesApi } from '../../lib/api';
import ConfirmDialog from '../../components/ConfirmDialog';
import toast from 'react-hot-toast';

export default function Properties() {
  const [props, setProps] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', address: '', city: '', state: '', zip_code: '', property_type: 'apartment', total_units: 1, description: '' });
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<any | null>(null);

  useEffect(() => { propertiesApi.list().then(r => setProps(r.data)).catch(() => {}); }, []);

  const create = async () => {
    setLoading(true);
    try {
      const res = await propertiesApi.create(form);
      setProps(p => [...p, res.data]);
      setShowModal(false);
      toast.success('Property added!');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to create property');
    }
    finally { setLoading(false); }
  };

  const deleteProperty = async (p: any) => {
    setDeletingId(p.id);
    try {
      await propertiesApi.delete(p.id);
      setProps(prev => prev.filter(x => x.id !== p.id));
      toast.success('Property deleted');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to delete property');
    } finally {
      setDeletingId(null);
    }
  };

  const TYPE_COLOR: any = { apartment: '#3B82F6', single_family: '#10B981', multi_family: '#8B5CF6', condo: '#F97316', commercial: '#EF4444' };

  return (
    <DashboardLayout>
      <div style={{ maxWidth: 1100 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <h1 style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 28, color: 'var(--text-primary)', marginBottom: 4 }}>Properties</h1>
            <p style={{ color: '#64748B', fontSize: 14 }}>{props.length} properties in portfolio</p>
          </div>
          <button onClick={() => setShowModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: 'linear-gradient(135deg, #FBC02D, #F57F17)', color: 'var(--bg-app)', border: 'none', borderRadius: 8, fontWeight: 700, fontFamily: 'Syne', fontSize: 14, cursor: 'pointer' }}>
            <Plus size={16} /> Add Property
          </button>
        </div>

        {props.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#475569' }}>
            <Building2 size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
            <p style={{ fontFamily: 'IBM Plex Sans', fontSize: 16 }}>No properties yet. Add your first property.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {props.map((p: any) => (
              <div key={p.id} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 12, padding: 20, transition: 'all 0.2s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#FBC02D'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-strong)'; }}>
                <Link href={`/dashboard/properties/${p.id}`} style={{ textDecoration: 'none', display: 'block' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: `${TYPE_COLOR[p.property_type] || '#3B82F6'}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Building2 size={20} color={TYPE_COLOR[p.property_type] || '#3B82F6'} />
                    </div>
                    <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 4, background: `${TYPE_COLOR[p.property_type] || '#3B82F6'}20`, color: TYPE_COLOR[p.property_type] || '#3B82F6', fontFamily: 'IBM Plex Mono', textTransform: 'capitalize' }}>
                      {p.property_type?.replace('_', ' ')}
                    </span>
                  </div>
                  <h3 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', marginBottom: 6 }}>{p.name}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748B', fontSize: 12, fontFamily: 'IBM Plex Sans', marginBottom: 12 }}>
                    <MapPin size={12} />
                    {p.city}, {p.state}
                  </div>
                  <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}><span style={{ fontFamily: 'IBM Plex Mono', color: 'var(--text-primary)', fontWeight: 600 }}>{p.total_units}</span> units</div>
                  </div>
                </Link>
                <div style={{ display: 'flex', gap: 8, borderTop: '1px solid var(--border-strong)', paddingTop: 12 }}>
                  <Link href={`/dashboard/tenants?property=${p.id}`} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '7px', borderRadius: 6, background: 'rgba(255,255,255,0.03)', color: 'var(--text-secondary)', fontSize: 11, fontFamily: 'IBM Plex Mono', textDecoration: 'none' }}>
                    <Users size={12} /> Tenants
                  </Link>
                  <Link href={`/dashboard/maintenance?property=${p.id}`} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '7px', borderRadius: 6, background: 'rgba(255,255,255,0.03)', color: 'var(--text-secondary)', fontSize: 11, fontFamily: 'IBM Plex Mono', textDecoration: 'none' }}>
                    <Wrench size={12} /> Maintenance
                  </Link>
                  <button onClick={() => setConfirmTarget(p)} disabled={deletingId === p.id} title="Delete property"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, padding: '7px', borderRadius: 6, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444', cursor: 'pointer' }}>
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add Property Modal */}
        {showModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 16, padding: 28, width: 480, maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h2 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 18, color: 'var(--text-primary)' }}>Add Property</h2>
                <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer' }}><X size={18} /></button>
              </div>
              {[
                { k: 'name', label: 'Property Name', ph: 'Sunset Apartments' },
                { k: 'address', label: 'Street Address', ph: '123 Main St' },
                { k: 'city', label: 'City', ph: 'Austin' },
                { k: 'state', label: 'State', ph: 'TX' },
                { k: 'zip_code', label: 'ZIP Code', ph: '78701' },
              ].map(({ k, label, ph }) => {
                const noSpellcheck = k === 'state' || k === 'zip_code';
                return (
                  <div key={k} style={{ marginBottom: 14 }}>
                    <label style={{ display: 'block', marginBottom: 5, fontSize: 12, fontFamily: 'IBM Plex Mono', color: 'var(--text-secondary)' }}>{label}</label>
                    <input value={(form as any)[k]} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))} placeholder={ph}
                      spellCheck={!noSpellcheck} autoCorrect={noSpellcheck ? 'off' : 'on'} autoCapitalize={noSpellcheck ? 'off' : 'words'}
                      style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-app)', border: '1px solid var(--border-input)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, fontFamily: 'IBM Plex Sans', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                );
              })}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                <div>
                  <label style={{ display: 'block', marginBottom: 5, fontSize: 12, fontFamily: 'IBM Plex Mono', color: 'var(--text-secondary)' }}>Type</label>
                  <select value={form.property_type} onChange={e => setForm(p => ({ ...p, property_type: e.target.value }))}
                    style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-app)', border: '1px solid var(--border-input)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none' }}>
                    {['apartment','single_family','multi_family','condo','commercial'].map(t => <option key={t} value={t}>{t.replace('_',' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 5, fontSize: 12, fontFamily: 'IBM Plex Mono', color: 'var(--text-secondary)' }}>Total Units</label>
                  <input type="number" value={form.total_units} onChange={e => setForm(p => ({ ...p, total_units: parseInt(e.target.value) || 1 }))}
                    spellCheck={false} autoCorrect="off"
                    style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-app)', border: '1px solid var(--border-input)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>
              <button onClick={create} disabled={loading} style={{ width: '100%', padding: 12, background: 'linear-gradient(135deg, #FBC02D, #F57F17)', color: 'var(--bg-app)', fontWeight: 700, fontFamily: 'Syne', fontSize: 14, border: 'none', borderRadius: 8, cursor: 'pointer' }}>
                {loading ? 'Creating...' : 'Add Property'}
              </button>
            </div>
          </div>
        )}

        <ConfirmDialog
          open={!!confirmTarget}
          message={`Delete ${confirmTarget?.name || ''}? This can't be undone.`}
          confirmLabel="Delete"
          cancelLabel="Cancel"
          onCancel={() => setConfirmTarget(null)}
          onConfirm={() => { const p = confirmTarget; setConfirmTarget(null); deleteProperty(p); }}
        />
      </div>
    </DashboardLayout>
  );
}
