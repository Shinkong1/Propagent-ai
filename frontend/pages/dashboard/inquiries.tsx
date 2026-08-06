import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import DashboardLayout from '../../components/DashboardLayout';
import { UserSearch, Mail, Phone, Calendar, Building2, UserPlus, Users } from 'lucide-react';
import { inquiries as inquiriesApi, properties as propertiesApi } from '../../lib/api';
import toast from 'react-hot-toast';

const STATUS_COLOR: Record<string, string> = {
  new: '#3B82F6', contacted: '#8B5CF6', tour_scheduled: '#FBC02D',
  applied: '#F97316', converted: '#10B981', closed: '#64748B',
};
const STATUSES = ['new', 'contacted', 'tour_scheduled', 'applied', 'converted', 'closed'];

export default function Inquiries() {
  const router = useRouter();
  const [inquiryList, setInquiryList] = useState<any[]>([]);
  const [propertyList, setPropertyList] = useState<any[]>([]);
  const [propertyFilter, setPropertyFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [convertingId, setConvertingId] = useState<string | null>(null);

  const load = (propertyId?: string) => {
    inquiriesApi.list(propertyId === 'all' ? undefined : propertyId).then(r => setInquiryList(r.data || [])).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    propertiesApi.list().then(r => setPropertyList(r.data || [])).catch(() => {});
  }, []);

  const changeFilter = (propertyId: string) => {
    setPropertyFilter(propertyId);
    setLoading(true);
    load(propertyId);
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await inquiriesApi.update(id, { status });
      setInquiryList(prev => prev.map(i => i.id === id ? { ...i, status } : i));
    } catch {
      toast.error('Failed to update status');
    }
  };

  const convertToTenant = async (inquiry: any) => {
    setConvertingId(inquiry.id);
    try {
      const res = await inquiriesApi.convertToTenant(inquiry.id);
      setInquiryList(prev => prev.map(i => i.id === inquiry.id ? { ...i, status: 'converted' } : i));
      toast.success(res.data.lease_created ? 'Tenant created and leased into the unit!' : 'Tenant created (no unit was selected, so left unassigned)');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to convert');
    } finally {
      setConvertingId(null);
    }
  };

  const copyListingLink = (propertyId: string) => {
    const url = `${window.location.origin}/listings/${propertyId}`;
    navigator.clipboard.writeText(url);
    toast.success('Listing link copied!');
  };

  return (
    <DashboardLayout>
      <div style={{ maxWidth: 1100 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 28, color: 'var(--text-primary)', marginBottom: 4 }}>Rental Inquiries</h1>
            <p style={{ color: '#64748B', fontSize: 14 }}>{inquiryList.length} inquiries from your public listing pages</p>
          </div>
          <select value={propertyFilter} onChange={e => changeFilter(e.target.value)}
            style={{ padding: '9px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 8, color: 'var(--text-secondary)', fontSize: 13, fontFamily: 'IBM Plex Sans', outline: 'none' }}>
            <option value="all">All Properties</option>
            {propertyList.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        {propertyList.length > 0 && (
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 12, padding: '14px 18px', marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: '#64748B', marginBottom: 10 }}>Share a property's public listing page to start collecting inquiries:</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {propertyList.map(p => (
                <button key={p.id} onClick={() => copyListingLink(p.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'rgba(251,192,45,0.1)', border: '1px solid rgba(251,192,45,0.3)', borderRadius: 6, color: '#FBC02D', fontSize: 12, fontFamily: 'IBM Plex Mono', cursor: 'pointer' }}>
                  <Building2 size={12} /> Copy link — {p.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <div style={{ color: '#64748B', fontFamily: 'IBM Plex Mono' }}>Loading...</div>
        ) : (
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-strong)' }}>
                    {['Prospect', 'Property / Unit', 'Contact', 'Move-in', 'Status', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontFamily: 'IBM Plex Mono', color: '#64748B', letterSpacing: '0.5px', fontWeight: 500 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {inquiryList.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: '60px', color: '#475569', fontFamily: 'IBM Plex Sans' }}>
                      <UserSearch size={32} style={{ margin: '0 auto 12px', opacity: 0.3, display: 'block' }} />
                      No inquiries yet. Share a listing link above to start collecting them.
                    </td></tr>
                  ) : inquiryList.map((i: any) => (
                    <tr key={i.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'IBM Plex Sans' }}>{i.first_name} {i.last_name}</div>
                        {i.message && <div style={{ fontSize: 11, color: '#64748B', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={i.message}>{i.message}</div>}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
                          <Building2 size={12} /> {i.property_name}{i.unit_number ? ` · Unit ${i.unit_number}` : ''}
                        </div>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        {i.email && <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-secondary)' }}><Mail size={11} /> {i.email}</div>}
                        {i.phone && <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#64748B' }}><Phone size={11} /> {i.phone}</div>}
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: 12, color: 'var(--text-secondary)' }}>
                        {i.desired_move_in ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Calendar size={11} /> {new Date(i.desired_move_in).toLocaleDateString()}</div>
                        ) : '—'}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <select value={i.status} onChange={e => updateStatus(i.id, e.target.value)}
                          style={{ padding: '4px 8px', background: `${STATUS_COLOR[i.status]}15`, border: `1px solid ${STATUS_COLOR[i.status]}40`, borderRadius: 6, color: STATUS_COLOR[i.status], fontSize: 11, fontFamily: 'IBM Plex Mono', cursor: 'pointer', outline: 'none' }}>
                          {STATUSES.map(s => <option key={s} value={s} style={{ background: 'var(--bg-surface)', color: '#E2E8F0' }}>{s.replace('_', ' ')}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        {i.status !== 'converted' ? (
                          <button onClick={() => convertToTenant(i)} disabled={convertingId === i.id} title="Convert to tenant"
                            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: 6, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#10B981', fontSize: 11, fontFamily: 'IBM Plex Mono', cursor: 'pointer' }}>
                            <UserPlus size={11} /> {convertingId === i.id ? '...' : 'Convert'}
                          </button>
                        ) : (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#10B981' }}><Users size={11} /> Tenant</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
