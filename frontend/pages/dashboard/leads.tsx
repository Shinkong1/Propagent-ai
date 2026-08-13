import { useEffect, useState } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import Link from 'next/link';
import { UserSearch, Plus, Mail, Zap, ExternalLink, Search, X, ShieldAlert, MessageCircle, Trash2 } from 'lucide-react';
import { leads as leadsApi } from '../../lib/api';
import { getUser } from '../../lib/auth';
import toast from 'react-hot-toast';

const STATUS_COLOR: any = { new: '#64748B', contacted: '#3B82F6', interested: '#8B5CF6', demo_scheduled: '#FBC02D', negotiating: '#F97316', closed_won: '#10B981', closed_lost: '#EF4444' };
const OUTREACH_COLOR: any = { queued: '#FBC02D', sent: '#10B981', failed: '#EF4444', logged_only: '#64748B' };
const OUTREACH_LABEL: any = { queued: 'Queued', sent: 'Sent', failed: 'Failed', logged_only: 'Logged only (SMTP off)' };

const EMPTY_LEAD_FORM = { first_name: '', last_name: '', company: '', email: '', phone: '', city: '', state: '' };

export default function Leads() {
  const [isMaster, setIsMaster] = useState(false);
  const [leadList, setLeadList] = useState<any[]>([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [scraping, setScraping] = useState(false);
  const [scrapeLocation, setScrapeLocation] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState(EMPTY_LEAD_FORM);
  const [saving, setSaving] = useState(false);
  // Must be declared here, before the `if (!isMaster) return` below -- not
  // down by queueUncontacted() where it previously lived. A master
  // account's first render takes the early-return path (isMaster still
  // false, pre-effect) and a later render doesn't (isMaster now true);
  // a hook declared only after that return gets called on some renders and
  // not others, which is a real, guaranteed-fatal Rules of Hooks violation
  // ("Rendered more hooks than during the previous render") -- confirmed as
  // the actual cause of the reported "Application error" crash, master-only
  // since only a master account's render ever crosses that isMaster
  // false->true boundary.
  const [backfilling, setBackfilling] = useState(false);

  useEffect(() => { setIsMaster(!!getUser()?.is_master); }, []);
  useEffect(() => { if (isMaster) leadsApi.list().then(r => setLeadList(r.data || [])).catch(() => {}); }, [isMaster]);

  if (!isMaster) {
    return (
      <DashboardLayout>
        <div style={{ maxWidth: 640, margin: '80px auto', textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <ShieldAlert size={26} color="#EF4444" />
          </div>
          <h1 style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 24, color: 'var(--text-primary)', marginBottom: 10 }}>Lead CRM</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 16 }}>This is PropAgent AI's own sales pipeline for finding new subscribers — it's restricted to the platform owner.</p>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            Looking for rental inquiries on your own listings instead? Those live on the{' '}
            <Link href="/dashboard/inquiries" style={{ color: '#FBC02D', fontWeight: 600 }}>Inquiries page</Link>.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  const addLead = async () => {
    if (!addForm.first_name.trim() && !addForm.last_name.trim() && !addForm.company.trim()) {
      toast.error('Enter at least a name or company');
      return;
    }
    setSaving(true);
    try {
      const res = await leadsApi.create(addForm);
      setLeadList(prev => [res.data, ...prev]);
      toast.success('Lead added');
      setShowAddModal(false);
      setAddForm(EMPTY_LEAD_FORM);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to add lead');
    } finally {
      setSaving(false);
    }
  };

  const sendOutreach = async (id: string) => {
    try {
      await leadsApi.sendOutreach(id);
      toast.success('Outreach email queued — sends on the next hourly cycle');
      // Background send happens later (hourly cron), but reflect the new
      // "queued" state right away instead of leaving the badge blank.
      setTimeout(() => { leadsApi.list().then(r => setLeadList(r.data || [])).catch(() => {}); }, 1000);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to queue email');
    }
  };

  const queueUncontacted = async () => {
    setBackfilling(true);
    try {
      await leadsApi.queueUncontacted();
      toast.success('Backfilling outreach for every uncontacted lead with an email on file — sends on the next cycle');
      setTimeout(() => { leadsApi.list().then(r => setLeadList(r.data || [])).catch(() => {}); }, 2000);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to start backfill');
    } finally {
      setBackfilling(false);
    }
  };

  const markReplied = async (id: string) => {
    try {
      await leadsApi.markReplied(id);
      toast.success('Marked replied — follow-up with the demo link queued');
      setTimeout(() => { leadsApi.list().then(r => setLeadList(r.data || [])).catch(() => {}); }, 1000);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to mark replied');
    }
  };

  const triggerScrape = async () => {
    if (!scrapeLocation.trim()) { toast.error('Enter a city to search, e.g. "Austin, TX"'); return; }
    setScraping(true);
    try {
      // Only Google Places is actually implemented -- the backend always
      // searches Google regardless of what "source" is passed, using it
      // only to LABEL the resulting leads. This used to offer LinkedIn and
      // Zillow buttons too, which silently ran the identical Google search
      // and mislabeled the results as if they'd come from those platforms.
      // Real, no-fabrication scrape source only, until LinkedIn/Zillow
      // scraping is actually built.
      await leadsApi.scrape({ source: 'google_maps', location: scrapeLocation.trim() });
      toast.success(`Scraping Google Maps for new leads in ${scrapeLocation.trim()}...`);
      setTimeout(() => { leadsApi.list().then(r => setLeadList(r.data || [])).catch(() => {}); setScraping(false); }, 3000);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Scrape failed');
      setScraping(false);
    }
  };

  const deleteLead = async (id: string, name: string) => {
    if (!confirm(`Delete lead "${name}"? This can't be undone.`)) return;
    try {
      await leadsApi.delete(id);
      setLeadList(p => p.filter(l => l.id !== id));
      toast.success('Lead deleted');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to delete lead');
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await leadsApi.updateStatus(id, { status });
      setLeadList(p => p.map(l => l.id === id ? { ...l, status } : l));
    } catch { toast.error('Update failed'); }
  };

  const filtered = leadList.filter(l => {
    const matchFilter = filter === 'all' || l.status === filter;
    const matchSearch = !search || `${l.first_name} ${l.last_name} ${l.company} ${l.email}`.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const scoreColor = (s: number) => s >= 80 ? '#10B981' : s >= 60 ? '#FBC02D' : '#64748B';

  return (
    <DashboardLayout>
      <div style={{ maxWidth: 1200 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 28, color: 'var(--text-primary)', marginBottom: 4 }}>Lead CRM</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>{leadList.length} leads · AI-powered outreach</p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setShowAddModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'linear-gradient(135deg, #FBC02D, #F57F17)', border: 'none', borderRadius: 8, color: 'var(--bg-app)', fontSize: 12, fontFamily: 'Syne', fontWeight: 700, cursor: 'pointer' }}>
              <Plus size={13} /> Add Lead
            </button>
            <button onClick={queueUncontacted} disabled={backfilling}
              title="Queues outreach for every lead with an email that's never been contacted -- catches leads scraped before auto-outreach existed, and any manually-added lead"
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 8, color: 'var(--text-secondary)', fontSize: 12, fontFamily: 'Syne', fontWeight: 700, cursor: backfilling ? 'default' : 'pointer', opacity: backfilling ? 0.6 : 1 }}>
              <Mail size={13} /> {backfilling ? 'Queuing…' : 'Queue Uncontacted'}
            </button>
            <input
              value={scrapeLocation}
              onChange={e => setScrapeLocation(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && triggerScrape()}
              placeholder="City, ST (e.g. Austin, TX)"
              spellCheck={false} autoCorrect="off"
              style={{ padding: '8px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 12, fontFamily: 'IBM Plex Sans', outline: 'none', width: 170 }}
            />
            <button onClick={() => triggerScrape()} disabled={scraping} title="Searches Google Maps for property management companies in this city"
              style={{ padding: '8px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 8, color: 'var(--text-secondary)', fontSize: 12, fontFamily: 'IBM Plex Mono', cursor: 'pointer' }}>
              {scraping ? '⟳ Scraping...' : '+ Scrape Google Maps'}
            </button>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search leads..."
              spellCheck autoCorrect="on"
              style={{ paddingLeft: 30, paddingRight: 12, paddingTop: 8, paddingBottom: 8, background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 8, color: '#E2E8F0', fontSize: 13, fontFamily: 'IBM Plex Sans', outline: 'none', width: 200 }} />
          </div>
          {['all', 'new', 'contacted', 'interested', 'demo_scheduled', 'closed_won'].map(s => (
            <button key={s} onClick={() => setFilter(s)} style={{
              padding: '6px 12px', borderRadius: 6, border: `1px solid ${filter === s ? (STATUS_COLOR[s] || '#FBC02D') : 'var(--border-strong)'}`,
              background: filter === s ? `${STATUS_COLOR[s] || '#FBC02D'}15` : 'transparent',
              color: filter === s ? (STATUS_COLOR[s] || '#FBC02D') : '#64748B',
              fontSize: 11, fontFamily: 'IBM Plex Mono', cursor: 'pointer', textTransform: 'capitalize',
            }}>
              {s.replace('_',' ')}
            </button>
          ))}
        </div>

        {/* Table */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-strong)' }}>
                {['Name', 'Company', 'Contact', 'Properties', 'Score', 'Status', 'Outreach', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontFamily: 'IBM Plex Mono', color: 'var(--text-muted)', letterSpacing: '0.5px', fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '48px', color: '#475569', fontFamily: 'IBM Plex Sans', fontSize: 14 }}>
                  No leads yet. Click a scrape button to find landlords.
                </td></tr>
              ) : filtered.map((l: any) => (
                <tr key={l.id} style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.15s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#E2E8F0', fontFamily: 'IBM Plex Sans' }}>{l.first_name} {l.last_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono' }}>{l.source}</div>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'IBM Plex Sans' }}>{l.company || '—'}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'IBM Plex Sans' }}>{l.email || '—'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{l.phone || ''}</div>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontFamily: 'IBM Plex Mono', color: 'var(--text-primary)', textAlign: 'center' }}>{l.num_properties || '—'}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, height: 4, background: 'var(--border-input)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ width: `${l.score}%`, height: '100%', background: scoreColor(l.score), borderRadius: 2 }} />
                      </div>
                      <span style={{ fontSize: 11, fontFamily: 'IBM Plex Mono', color: scoreColor(l.score) }}>{l.score}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <select value={l.status} onChange={e => updateStatus(l.id, e.target.value)}
                      style={{ padding: '4px 8px', background: `${STATUS_COLOR[l.status]}15`, border: `1px solid ${STATUS_COLOR[l.status]}40`, borderRadius: 6, color: STATUS_COLOR[l.status], fontSize: 11, fontFamily: 'IBM Plex Mono', cursor: 'pointer', outline: 'none' }}>
                      {Object.keys(STATUS_COLOR).map(s => <option key={s} value={s} style={{ background: 'var(--bg-surface)', color: '#E2E8F0' }}>{s.replace('_',' ')}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {l.outreach_status ? (
                      <span title={l.outreach_sent_at ? `Sent ${new Date(l.outreach_sent_at).toLocaleString()}` : 'Waiting for the next send cycle (runs hourly)'}
                        style={{ padding: '4px 8px', borderRadius: 6, background: `${OUTREACH_COLOR[l.outreach_status] || '#64748B'}15`, border: `1px solid ${OUTREACH_COLOR[l.outreach_status] || '#64748B'}40`, color: OUTREACH_COLOR[l.outreach_status] || '#64748B', fontSize: 11, fontFamily: 'IBM Plex Mono' }}>
                        {OUTREACH_LABEL[l.outreach_status] || l.outreach_status}
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, color: '#475569' }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => sendOutreach(l.id)} title="Send AI outreach" style={{ padding: '6px 10px', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 6, color: '#3B82F6', cursor: 'pointer', fontSize: 12 }}>
                        <Mail size={13} />
                      </button>
                      {l.outreach_status === 'sent' && (
                        <button onClick={() => markReplied(l.id)} title="They replied — send the demo follow-up" style={{ padding: '6px 10px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 6, color: '#10B981', cursor: 'pointer', fontSize: 12 }}>
                          <MessageCircle size={13} />
                        </button>
                      )}
                      <button onClick={() => deleteLead(l.id, `${l.first_name} ${l.last_name}`.trim() || l.email)} title="Delete lead" style={{ padding: '6px 10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, color: '#EF4444', cursor: 'pointer', fontSize: 12 }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </div>

      {showAddModal && (
        <div
          onClick={() => setShowAddModal(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 14, padding: 24, maxWidth: 440, width: '100%', maxHeight: '85vh', overflowY: 'auto' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 17, color: 'var(--text-primary)' }}>Add Lead</h2>
              <button onClick={() => setShowAddModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <FormField label="First Name" value={addForm.first_name} onChange={v => setAddForm(p => ({ ...p, first_name: v }))} />
              <FormField label="Last Name" value={addForm.last_name} onChange={v => setAddForm(p => ({ ...p, last_name: v }))} />
            </div>
            <FormField label="Company" value={addForm.company} onChange={v => setAddForm(p => ({ ...p, company: v }))} style={{ marginBottom: 10 }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <FormField label="Email" value={addForm.email} onChange={v => setAddForm(p => ({ ...p, email: v }))} />
              <FormField label="Phone" value={addForm.phone} onChange={v => setAddForm(p => ({ ...p, phone: v }))} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
              <FormField label="City" value={addForm.city} onChange={v => setAddForm(p => ({ ...p, city: v }))} />
              <FormField label="State" value={addForm.state} onChange={v => setAddForm(p => ({ ...p, state: v }))} />
            </div>

            <button
              onClick={addLead}
              disabled={saving}
              style={{
                width: '100%', padding: '11px', borderRadius: 8, cursor: saving ? 'default' : 'pointer',
                background: 'linear-gradient(135deg, #FBC02D, #F57F17)', color: 'var(--bg-app)',
                fontWeight: 700, fontFamily: 'Syne', fontSize: 14, border: 'none', opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? 'Saving...' : 'Add Lead'}
            </button>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

function FormField({ label, value, onChange, style }: { label: string; value: string; onChange: (v: string) => void; style?: React.CSSProperties }) {
  return (
    <div style={style}>
      <label style={{ display: 'block', marginBottom: 4, fontSize: 11, fontFamily: 'IBM Plex Mono', color: 'var(--text-secondary)' }}>{label}</label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        spellCheck autoCorrect="on"
        style={{ width: '100%', padding: '8px 10px', background: 'var(--bg-app)', border: '1px solid var(--border-input)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, fontFamily: 'IBM Plex Sans', outline: 'none', boxSizing: 'border-box' }}
      />
    </div>
  );
}
