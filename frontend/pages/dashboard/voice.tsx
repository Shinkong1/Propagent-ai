import DashboardLayout from '../../components/DashboardLayout';
import { Phone, Mic, PhoneCall, PhoneOff, Zap, CheckCircle } from 'lucide-react';

const CALL_LOG = [
  { id: 1, caller: '+1 (512) 555-0134', time: '2h ago', duration: '3:24', intent: 'Maintenance', result: 'Ticket #1047 created', status: 'resolved' },
  { id: 2, caller: '+1 (737) 555-0289', time: '5h ago', duration: '1:52', intent: 'Leasing', result: 'Tour scheduled for Friday', status: 'resolved' },
  { id: 3, caller: '+1 (512) 555-0411', time: '1d ago', duration: '2:11', intent: 'Payment', result: 'Redirected to payment portal', status: 'resolved' },
  { id: 4, caller: '+1 (737) 555-0056', time: '1d ago', duration: '4:38', intent: 'Maintenance', result: 'Plumber dispatched', status: 'resolved' },
];

const INTENT_COLOR: any = { Maintenance: '#F97316', Leasing: '#3B82F6', Payment: '#10B981', General: '#8B5CF6' };

export default function Voice() {
  return (
    <DashboardLayout>
      <div style={{ maxWidth: 1000 }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 28, color: 'var(--text-primary)', marginBottom: 4 }}>Voice AI Call Center</h1>
          <p style={{ color: '#64748B', fontSize: 14 }}>Twilio-powered AI handles inbound tenant calls 24/7</p>
        </div>

        {/* Status Card */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 12, padding: 24, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 20 }}>
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
            <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 24, fontWeight: 600, color: 'var(--text-primary)' }}>247</div>
            <div style={{ fontSize: 11, color: '#64748B', fontFamily: 'IBM Plex Mono' }}>calls this month</div>
          </div>
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
          <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                {['Caller', 'Time', 'Duration', 'Intent', 'AI Action', 'Status'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontFamily: 'IBM Plex Mono', color: '#64748B' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CALL_LOG.map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontFamily: 'IBM Plex Mono', color: '#E2E8F0' }}>{c.caller}</td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: '#64748B', fontFamily: 'IBM Plex Sans' }}>{c.time}</td>
                  <td style={{ padding: '12px 16px', fontSize: 12, fontFamily: 'IBM Plex Mono', color: 'var(--text-secondary)' }}>{c.duration}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, background: `${INTENT_COLOR[c.intent]}20`, color: INTENT_COLOR[c.intent], fontFamily: 'IBM Plex Mono' }}>{c.intent}</span>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'IBM Plex Sans' }}>{c.result}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 4, background: 'rgba(16,185,129,0.12)', color: '#10B981', fontFamily: 'IBM Plex Mono' }}>{c.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>

        {/* Config */}
        <div style={{ marginTop: 20, background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 12, padding: 20 }}>
          <h3 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', marginBottom: 14 }}>Webhook Configuration</h3>
          <div style={{ background: 'var(--bg-app)', border: '1px solid var(--border-input)', borderRadius: 8, padding: '12px 16px' }}>
            <div style={{ fontSize: 11, fontFamily: 'IBM Plex Mono', color: '#64748B', marginBottom: 6 }}>TWILIO WEBHOOK URL</div>
            <div style={{ fontSize: 13, fontFamily: 'IBM Plex Mono', color: '#FBC02D' }}>https://api.propagent.ai/voice/incoming</div>
          </div>
          <p style={{ marginTop: 12, fontSize: 12, color: '#475569', fontFamily: 'IBM Plex Sans' }}>
            Set this URL in your Twilio phone number settings under "Voice & Fax" → "A Call Comes In".
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
