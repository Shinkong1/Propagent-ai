import { useEffect, useState } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { Phone, Mic, PhoneCall, PhoneOff, Zap, CheckCircle, PhoneMissed } from 'lucide-react';
import { voice as voiceApi } from '../../lib/api';

const API_URL = 'https://propagent-api.onrender.com';

const INTENT_LABEL: any = { maintenance: 'Maintenance', leasing: 'Leasing', screening: 'Screening', tenant_support: 'Tenant Support', sales: 'Sales' };
const INTENT_COLOR: any = { maintenance: '#F97316', leasing: '#3B82F6', screening: '#8B5CF6', tenant_support: '#10B981', sales: '#FBC02D' };

const STATUS_LABEL: any = { in_progress: 'In progress', completed: 'Completed', failed: 'Failed', busy: 'Busy', 'no-answer': 'No answer', canceled: 'Canceled' };
const STATUS_COLOR: any = { in_progress: '#3B82F6', completed: '#10B981', failed: '#EF4444', busy: '#F97316', 'no-answer': '#64748B', canceled: '#64748B' };

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso + (iso.endsWith('Z') ? '' : 'Z')).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function Voice() {
  const [calls, setCalls] = useState<any[]>([]);
  const [stats, setStats] = useState<{ total_calls: number; calls_this_month: number; avg_duration_seconds: number | null; resolved_count: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    voiceApi.calls()
      .then(r => { setCalls(r.data.calls || []); setStats(r.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <DashboardLayout>
      <div style={{ maxWidth: 1000 }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 28, color: 'var(--text-primary)', marginBottom: 4 }}>Voice AI Call Center</h1>
          <p style={{ color: '#64748B', fontSize: 14 }}>Twilio-powered AI handles inbound tenant calls 24/7</p>
        </div>

        {/* Status Card */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 12, padding: 24, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(16,185,129,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Phone size={24} color="#10B981" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981', boxShadow: '0 0 8px #10B981' }} />
              <span style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 16, color: '#10B981' }}>AI Call Center Active</span>
            </div>
            <p style={{ color: '#64748B', fontSize: 13, fontFamily: 'IBM Plex Sans' }}>
              Twilio webhook active · Speech-to-text enabled · LangGraph agents connected
            </p>
          </div>
          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 24, fontWeight: 600, color: 'var(--text-primary)' }}>{loading ? '—' : (stats?.calls_this_month ?? 0)}</div>
            <div style={{ fontSize: 11, color: '#64748B', fontFamily: 'IBM Plex Mono' }}>calls this month</div>
          </div>
        </div>

        {/* Quick stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Total tracked calls', value: stats?.total_calls ?? 0 },
            { label: 'Resolved', value: stats?.resolved_count ?? 0 },
            { label: 'Avg. duration', value: formatDuration(stats?.avg_duration_seconds ?? null) },
          ].map(s => (
            <div key={s.label} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 20, fontWeight: 600, color: 'var(--text-primary)' }}>{loading ? '—' : s.value}</div>
              <div style={{ fontSize: 11, color: '#64748B', fontFamily: 'IBM Plex Mono', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Flow Diagram */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 12, padding: 24, marginBottom: 24 }}>
          <h3 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', marginBottom: 20 }}>Call Flow</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, overflowX: 'auto' }}>
            {[
              { label: 'Tenant Calls', icon: PhoneCall, color: '#3B82F6' },
              { label: 'Twilio Webhook', icon: Zap, color: '#FBC02D' },
              { label: 'Speech-to-Text', icon: Mic, color: '#8B5CF6' },
              { label: 'AI Agent', icon: Zap, color: '#F97316' },
              { label: 'Action Taken', icon: CheckCircle, color: '#10B981' },
            ].map(({ label, icon: Icon, color }, i) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ textAlign: 'center', minWidth: 90 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: `${color}15`, border: `1px solid ${color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px' }}>
                    <Icon size={20} color={color} />
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'IBM Plex Sans', lineHeight: 1.3 }}>{label}</div>
                </div>
                {i < 4 && <div style={{ width: 30, height: 1, background: 'var(--border-strong)', margin: '0 4px', marginTop: -16 }} />}
              </div>
            ))}
          </div>
        </div>

        {/* Call Log */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-strong)' }}>
            <h3 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>Recent Calls</h3>
          </div>

          {loading ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#64748B', fontSize: 13, fontFamily: 'IBM Plex Sans' }}>Loading call history…</div>
          ) : calls.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <PhoneMissed size={28} color="#64748B" style={{ marginBottom: 10 }} />
              <div style={{ color: 'var(--text-secondary)', fontSize: 14, fontFamily: 'IBM Plex Sans', marginBottom: 6 }}>No calls tracked yet</div>
              <p style={{ color: '#64748B', fontSize: 12, fontFamily: 'IBM Plex Sans', maxWidth: 440, margin: '0 auto' }}>
                Calls only show up here once your Twilio number receives one from a phone number
                already on file for a tenant — all subscribers currently share one Twilio number,
                so a call from an unrecognized number can't be matched to your organization.
              </p>
            </div>
          ) : (
          <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                {['Caller', 'Time', 'Duration', 'Topic', 'AI Summary', 'Status'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontFamily: 'IBM Plex Mono', color: '#64748B' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {calls.map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontFamily: 'IBM Plex Mono', color: '#E2E8F0' }}>
                    {c.tenant_name || c.from_number || 'Unknown'}
                    {c.property_name && <div style={{ fontSize: 11, color: '#64748B', fontFamily: 'IBM Plex Sans', marginTop: 2 }}>{c.property_name}</div>}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: '#64748B', fontFamily: 'IBM Plex Sans', whiteSpace: 'nowrap' }}>{timeAgo(c.started_at)}</td>
                  <td style={{ padding: '12px 16px', fontSize: 12, fontFamily: 'IBM Plex Mono', color: 'var(--text-secondary)' }}>{formatDuration(c.duration_seconds)}</td>
                  <td style={{ padding: '12px 16px' }}>
                    {c.intent ? (
                      <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, background: `${INTENT_COLOR[c.intent] || '#64748B'}20`, color: INTENT_COLOR[c.intent] || '#64748B', fontFamily: 'IBM Plex Mono' }}>
                        {INTENT_LABEL[c.intent] || c.intent}
                      </span>
                    ) : <span style={{ color: '#475569', fontSize: 12 }}>—</span>}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'IBM Plex Sans', maxWidth: 260 }}>
                    {c.outcome_summary || '—'}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 4, background: `${STATUS_COLOR[c.status] || '#64748B'}20`, color: STATUS_COLOR[c.status] || '#64748B', fontFamily: 'IBM Plex Mono', whiteSpace: 'nowrap' }}>
                      {STATUS_LABEL[c.status] || c.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          )}
        </div>

        {/* Config */}
        <div style={{ marginTop: 20, background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 12, padding: 20 }}>
          <h3 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', marginBottom: 14 }}>Webhook Configuration</h3>
          <div style={{ background: 'var(--bg-app)', border: '1px solid var(--border-input)', borderRadius: 8, padding: '12px 16px' }}>
            <div style={{ fontSize: 11, fontFamily: 'IBM Plex Mono', color: '#64748B', marginBottom: 6 }}>TWILIO WEBHOOK URL</div>
            <div style={{ fontSize: 13, fontFamily: 'IBM Plex Mono', color: '#FBC02D', wordBreak: 'break-all' }}>{API_URL}/voice/incoming</div>
          </div>
          <p style={{ marginTop: 12, fontSize: 12, color: '#475569', fontFamily: 'IBM Plex Sans' }}>
            Set this URL in your Twilio phone number settings under "Voice & Fax" → "A Call Comes In".
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
