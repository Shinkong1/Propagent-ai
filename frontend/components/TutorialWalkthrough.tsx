import { useState } from 'react';
import { useRouter } from 'next/router';
import {
  Building2, Users, Wrench, Phone, UserSearch, BarChart3, CreditCard,
  ChevronLeft, ChevronRight, Sparkles, CheckCircle,
} from 'lucide-react';

const STEPS = [
  {
    icon: Building2,
    color: '#3B82F6',
    title: 'Manage your portfolio',
    body: 'Add every property you manage — units, addresses, and type. This is the hub everything else connects to.',
    href: '/dashboard/properties',
    cta: 'Go to Properties',
    preview: (
      <PreviewGrid>
        <PreviewCard title="Sunset Towers" sub="24 units · Austin, TX" color="#3B82F6" />
        <PreviewCard title="Riverside Commons" sub="12 units · Austin, TX" color="#8B5CF6" />
      </PreviewGrid>
    ),
  },
  {
    icon: Building2,
    color: '#FBC02D',
    title: 'Drill into one property',
    body: 'Click any property to see its tenants, open maintenance tickets, revenue, unit occupancy, and the vendors who work there — all in one view.',
    href: '/dashboard/properties',
    cta: 'View a property',
    preview: (
      <PreviewStatRow>
        <PreviewStat label="Revenue" value="$10,800/mo" color="#10B981" />
        <PreviewStat label="Occupancy" value="5/7" color="#3B82F6" />
        <PreviewStat label="Open Tickets" value="3" color="#F97316" />
      </PreviewStatRow>
    ),
  },
  {
    icon: Users,
    color: '#8B5CF6',
    title: 'Tenants, organized by property',
    body: 'Every tenant is listed with the property they belong to. Filter to just one building when you need to focus.',
    href: '/dashboard/tenants',
    cta: 'Go to Tenants',
    preview: (
      <PreviewList items={['Marcus Williams — Sunset Towers', 'Sofia Rodriguez — Sunset Towers', 'Tyler Johnson — Riverside Commons']} />
    ),
  },
  {
    icon: Wrench,
    color: '#F97316',
    title: 'AI handles maintenance triage',
    body: 'A tenant texts "my toilet is overflowing" — the AI detects intent, classifies category and priority, creates a ticket, and dispatches a vendor automatically. No manual sorting.',
    href: '/dashboard/maintenance',
    cta: 'See the Maintenance board',
    preview: (
      <PreviewChat
        message="My toilet is overflowing"
        response="Created a plumbing ticket (high priority). Torres Plumbing has been notified."
      />
    ),
  },
  {
    icon: Phone,
    color: '#10B981',
    title: 'Voice AI answers the phone',
    body: 'Give tenants a phone number. Twilio + the same AI pipeline handles spoken maintenance requests — transcribes, classifies, creates the ticket, dispatches a vendor.',
    href: '/dashboard/voice',
    cta: 'Go to Voice AI',
    preview: (
      <PreviewList items={['📞 Incoming call...', '🎙️ "The AC stopped working"', '✅ HVAC ticket created + vendor dispatched']} />
    ),
  },
  {
    icon: UserSearch,
    color: '#EF4444',
    title: 'Grow your own client base',
    body: 'The Lead CRM scrapes landlord prospects and automates outreach sequences — this is how you grow the property management business itself, not something for your tenants.',
    href: '/dashboard/leads',
    cta: 'Go to Lead CRM',
    preview: (
      <PreviewList items={['David Park — 34 properties — Demo Scheduled', 'Tom Nguyen — 22 properties — Closed Won']} />
    ),
  },
  {
    icon: BarChart3,
    color: '#3B82F6',
    title: 'Analytics across your portfolio',
    body: 'Track occupancy, revenue trends, and maintenance volume across everything you manage.',
    href: '/dashboard/analytics',
    cta: 'View Analytics',
    preview: (
      <PreviewStatRow>
        <PreviewStat label="Vacancy" value="12.5%" color="#F97316" />
        <PreviewStat label="Total Revenue" value="$20,350" color="#10B981" />
      </PreviewStatRow>
    ),
  },
  {
    icon: CreditCard,
    color: '#FBC02D',
    title: "You're set up",
    body: 'Upgrade anytime as your portfolio grows — Voice AI and lead generation unlock on the Professional plan and up.',
    href: '/pricing',
    cta: 'View Plans',
    preview: (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '20px 0' }}>
        <CheckCircle size={28} color="#10B981" />
        <span style={{ color: 'var(--text-secondary)', fontFamily: 'IBM Plex Sans', fontSize: 14 }}>You know your way around PropAgent AI.</span>
      </div>
    ),
  },
];

export default function TutorialWalkthrough() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 16, padding: 28, maxWidth: 640 }}>
      {/* Progress dots */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 24 }}>
        {STEPS.map((_, i) => (
          <div key={i} onClick={() => setStep(i)} style={{
            flex: 1, height: 4, borderRadius: 2, cursor: 'pointer',
            background: i <= step ? '#FBC02D' : 'var(--border-input)',
            transition: 'background 0.2s',
          }} />
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: `${current.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={20} color={current.color} />
        </div>
        <div>
          <div style={{ fontSize: 11, color: '#64748B', fontFamily: 'IBM Plex Mono' }}>STEP {step + 1} OF {STEPS.length}</div>
          <h3 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 18, color: 'var(--text-primary)' }}>{current.title}</h3>
        </div>
      </div>

      <p style={{ color: 'var(--text-secondary)', fontSize: 14, fontFamily: 'IBM Plex Sans', lineHeight: 1.6, marginBottom: 18 }}>
        {current.body}
      </p>

      <div style={{ background: 'var(--bg-app)', border: '1px solid var(--border-strong)', borderRadius: 10, padding: 16, marginBottom: 20, minHeight: 90 }}>
        {current.preview}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button
          onClick={() => setStep(s => Math.max(0, s - 1))}
          disabled={step === 0}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', background: 'transparent', border: '1px solid var(--border-strong)', borderRadius: 8, color: step === 0 ? '#334155' : 'var(--text-secondary)', fontSize: 13, fontFamily: 'IBM Plex Sans', cursor: step === 0 ? 'default' : 'pointer' }}>
          <ChevronLeft size={14} /> Back
        </button>

        <button
          onClick={() => router.push(current.href)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', background: 'rgba(var(--accent-rgb),0.1)', border: '1px solid rgba(var(--accent-rgb),0.3)', borderRadius: 8, color: '#FBC02D', fontSize: 13, fontFamily: 'IBM Plex Sans', fontWeight: 600, cursor: 'pointer' }}>
          <Sparkles size={14} /> {current.cta}
        </button>

        {isLast ? (
          <button
            onClick={() => setStep(0)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', background: 'linear-gradient(135deg, #FBC02D, #F57F17)', border: 'none', borderRadius: 8, color: 'var(--bg-app)', fontSize: 13, fontFamily: 'Syne', fontWeight: 700, cursor: 'pointer' }}>
            Restart
          </button>
        ) : (
          <button
            onClick={() => setStep(s => Math.min(STEPS.length - 1, s + 1))}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', background: 'linear-gradient(135deg, #FBC02D, #F57F17)', border: 'none', borderRadius: 8, color: 'var(--bg-app)', fontSize: 13, fontFamily: 'Syne', fontWeight: 700, cursor: 'pointer' }}>
            Next <ChevronRight size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

function PreviewGrid({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', gap: 10 }}>{children}</div>;
}

function PreviewCard({ title, sub, color }: { title: string; sub: string; color: string }) {
  return (
    <div style={{ flex: 1, background: 'var(--bg-surface)', border: `1px solid ${color}40`, borderRadius: 8, padding: 10 }}>
      <div style={{ width: 20, height: 20, borderRadius: 5, background: `${color}25`, marginBottom: 8 }} />
      <div style={{ fontSize: 12, color: 'var(--text-primary)', fontFamily: 'IBM Plex Sans', fontWeight: 600 }}>{title}</div>
      <div style={{ fontSize: 10, color: '#64748B' }}>{sub}</div>
    </div>
  );
}

function PreviewStatRow({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', gap: 10 }}>{children}</div>;
}

function PreviewStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ flex: 1, textAlign: 'center' }}>
      <div style={{ fontSize: 16, fontWeight: 700, color, fontFamily: 'Syne' }}>{value}</div>
      <div style={{ fontSize: 10, color: '#64748B', fontFamily: 'IBM Plex Mono' }}>{label.toUpperCase()}</div>
    </div>
  );
}

function PreviewList({ items }: { items: string[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {items.map((item, i) => (
        <div key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'IBM Plex Sans', padding: '6px 10px', background: 'var(--bg-surface)', borderRadius: 6 }}>
          {item}
        </div>
      ))}
    </div>
  );
}

function PreviewChat({ message, response }: { message: string; response: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ alignSelf: 'flex-end', maxWidth: '80%', background: 'var(--border-input)', color: 'var(--text-primary)', fontSize: 12, padding: '8px 12px', borderRadius: '10px 10px 2px 10px', fontFamily: 'IBM Plex Sans' }}>
        {message}
      </div>
      <div style={{ alignSelf: 'flex-start', maxWidth: '85%', background: 'rgba(var(--accent-rgb),0.1)', color: '#FBC02D', fontSize: 12, padding: '8px 12px', borderRadius: '10px 10px 10px 2px', fontFamily: 'IBM Plex Sans' }}>
        {response}
      </div>
    </div>
  );
}
