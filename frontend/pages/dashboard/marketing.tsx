import { useEffect, useState } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import {
  ShieldAlert, Megaphone, Search, Building2, Share2, Copy, ExternalLink,
  CheckCircle2, Circle, Linkedin, Twitter, Facebook, Instagram, Home, PlayCircle, RefreshCw, KeyRound,
} from 'lucide-react';
import { getUser } from '../../lib/auth';
import { publicListings, admin as adminApi } from '../../lib/api';
import toast from 'react-hot-toast';

const SITE_URL = 'https://propagent.app';

const SOCIAL_POSTS = {
  linkedin: `Property management shouldn't mean being on call 24/7.

PropAgent AI handles tenant communication, maintenance dispatch, leasing inquiries, and screening with autonomous AI agents — so the 2am "water everywhere" text gets triaged and dispatched before you even see it.

Free 14-day trial: ${SITE_URL}`,
  twitter: `Property management that runs itself. AI agents handle tenant chat, maintenance dispatch, leasing inquiries & screening — 24/7. Free 14-day trial 👇 ${SITE_URL}`,
  facebook: `Running a rental property (or dozens)? PropAgent AI automates the parts that eat your evenings — tenant messages, maintenance requests, leasing inquiries — with AI agents that actually get the job done. Try it free for 14 days: ${SITE_URL}`,
};

const CHECKLIST_KEY = 'marketingHubChecklist';
const CHECKLIST_ITEMS = [
  { id: 'gsc', label: 'Submitted sitemap to Google Search Console' },
  { id: 'gbp', label: 'Created a Google Business Profile' },
  { id: 'linkedin', label: 'Posted on LinkedIn' },
  { id: 'twitter', label: 'Posted on X / Twitter' },
  { id: 'facebook', label: 'Posted on Facebook' },
  { id: 'zillow', label: 'Applied for Zillow Rental Manager' },
  { id: 'apartments', label: 'Applied for Apartments.com listing' },
];

function copy(text: string, label = 'Copied') {
  navigator.clipboard.writeText(text);
  toast.success(label);
}

export default function MarketingHub() {
  const isMaster = getUser()?.is_master;
  const [listingCount, setListingCount] = useState<number | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [rotating, setRotating] = useState(false);
  const [demoCreds, setDemoCreds] = useState<{ login_email: string; login_password: string } | null>(null);

  useEffect(() => {
    if (!isMaster) return;
    publicListings.browse().then(r => setListingCount((r.data || []).length)).catch(() => setListingCount(null));
    try {
      const saved = JSON.parse(localStorage.getItem(CHECKLIST_KEY) || '{}');
      setChecked(saved);
    } catch {}
  }, [isMaster]);

  const toggleCheck = (id: string) => {
    const next = { ...checked, [id]: !checked[id] };
    setChecked(next);
    localStorage.setItem(CHECKLIST_KEY, JSON.stringify(next));
  };

  const rotateDemoPassword = async () => {
    setRotating(true);
    setDemoCreds(null);
    try {
      const res = await adminApi.rotateDemoPassword();
      setDemoCreds(res.data);
      toast.success('New demo password generated');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to rotate password — run "Seed demo data" first if the account doesn\'t exist yet');
    } finally {
      setRotating(false);
    }
  };

  const doneCount = CHECKLIST_ITEMS.filter(i => checked[i.id]).length;

  if (!isMaster) {
    return (
      <DashboardLayout>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', textAlign: 'center', gap: 12 }}>
          <ShieldAlert size={32} color="#EF4444" />
          <h2 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 18, color: 'var(--text-primary)' }}>Owner access only</h2>
          <p style={{ color: '#64748B', fontSize: 14, maxWidth: 360 }}>The Marketing Hub is for the platform owner — it's about marketing PropAgent AI itself, not your own listings.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div style={{ maxWidth: 1000 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 8 }}>
          <div>
            <h1 style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 28, color: 'var(--text-primary)', marginBottom: 4 }}>Marketing Hub</h1>
            <p style={{ color: '#64748B', fontSize: 14 }}>Everything to start marketing PropAgent AI on Google, social, and rental listing sites.</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 10, background: 'var(--bg-surface)', border: '1px solid var(--border-strong)' }}>
            <CheckCircle2 size={14} color="#10B981" />
            <span style={{ fontSize: 12.5, fontFamily: 'IBM Plex Mono', color: 'var(--text-secondary)' }}>{doneCount}/{CHECKLIST_ITEMS.length} done</span>
          </div>
        </div>

        {listingCount !== null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(251,192,45,0.06)', border: '1px solid rgba(251,192,45,0.25)', borderRadius: 10, padding: '10px 16px', marginBottom: 24, fontSize: 13 }}>
            <Home size={15} color="#FBC02D" />
            <span style={{ color: 'var(--text-secondary)' }}>
              <b style={{ color: 'var(--text-primary)' }}>{listingCount}</b> {listingCount === 1 ? 'listing is' : 'listings are'} currently live on your public directory — that's real, indexable content search engines can find.
            </span>
          </div>
        )}

        {/* Automated demo */}
        <Section icon={PlayCircle} title="Automated demo">
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 12, padding: 16, display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 240 }}>
              <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 13.5, color: 'var(--text-primary)', marginBottom: 4 }}>Self-playing product walkthrough</div>
              <div style={{ fontSize: 12.5, color: '#64748B', marginBottom: 10, lineHeight: 1.5 }}>
                A 6-scene, self-advancing tour built from real demo-account data — AI Workforce, Voice Receptionist, Maintenance, Leasing &amp; screening.
                Send this link instead of walking a prospect through it live. It's automatically kept up to date whenever the demo data is refreshed.
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <a href="/demo" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 6, background: 'rgba(251,192,45,0.1)', border: '1px solid rgba(251,192,45,0.3)', color: '#FBC02D', fontSize: 11.5, fontFamily: 'Syne', fontWeight: 600 }}>
                    Open demo <ExternalLink size={11} />
                  </span>
                </a>
                <button onClick={() => copy(`${SITE_URL}/demo`, 'Demo link copied')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 6, background: 'var(--bg-app)', border: '1px solid var(--border-strong)', color: 'var(--text-secondary)', fontSize: 11.5, fontFamily: 'IBM Plex Mono', cursor: 'pointer' }}>
                  <Copy size={11} /> Copy link
                </button>
                <button onClick={rotateDemoPassword} disabled={rotating} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 6, background: 'var(--bg-app)', border: '1px solid var(--border-strong)', color: 'var(--text-secondary)', fontSize: 11.5, fontFamily: 'IBM Plex Mono', cursor: rotating ? 'default' : 'pointer', opacity: rotating ? 0.6 : 1 }}>
                  <RefreshCw size={11} /> {rotating ? 'Rotating…' : 'Rotate demo password'}
                </button>
              </div>

              {demoCreds && (
                <div style={{ marginTop: 12, background: 'var(--bg-app)', border: '1px solid rgba(251,192,45,0.3)', borderRadius: 8, padding: '10px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontFamily: 'IBM Plex Mono', color: '#FBC02D', marginBottom: 8 }}>
                    <KeyRound size={11} /> New demo login — copy this now, it's only shown once
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontFamily: 'IBM Plex Mono', color: 'var(--text-secondary)' }}>{demoCreds.login_email}</span>
                    <button onClick={() => copy(demoCreds.login_email, 'Email copied')} style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', padding: 2 }}><Copy size={12} /></button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 12, fontFamily: 'IBM Plex Mono', color: 'var(--text-primary)' }}>{demoCreds.login_password}</span>
                    <button onClick={() => copy(demoCreds.login_password, 'Password copied')} style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', padding: 2 }}><Copy size={12} /></button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Section>

        {/* Google */}
        <Section icon={Search} title="Google">
          <Card
            title="Search Console"
            body="Submit your sitemap so Google actually indexes every listing page, not just the homepage."
            action={{ label: 'Open Search Console', url: 'https://search.google.com/search-console' }}
            copyable={{ label: 'Sitemap URL', value: `${SITE_URL}/sitemap.xml` }}
            done={checked.gsc} onToggle={() => toggleCheck('gsc')}
          />
          <Card
            title="Business Profile"
            body="A free local listing — shows up when someone searches 'property management software' or your brand name directly."
            action={{ label: 'Create Business Profile', url: 'https://business.google.com' }}
            done={checked.gbp} onToggle={() => toggleCheck('gbp')}
          />
        </Section>

        {/* Social */}
        <Section icon={Share2} title="Social media">
          <SocialCard
            icon={Linkedin} name="LinkedIn" color="#0A66C2"
            post={SOCIAL_POSTS.linkedin}
            shareUrl={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL)}`}
            done={checked.linkedin} onToggle={() => toggleCheck('linkedin')}
          />
          <SocialCard
            icon={Twitter} name="X / Twitter" color="#1D9BF0"
            post={SOCIAL_POSTS.twitter}
            shareUrl={`https://twitter.com/intent/tweet?text=${encodeURIComponent(SOCIAL_POSTS.twitter)}`}
            done={checked.twitter} onToggle={() => toggleCheck('twitter')}
          />
          <SocialCard
            icon={Facebook} name="Facebook" color="#1877F2"
            post={SOCIAL_POSTS.facebook}
            shareUrl={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(SITE_URL)}`}
            done={checked.facebook} onToggle={() => toggleCheck('facebook')}
          />
        </Section>

        {/* Listing syndication */}
        <Section icon={Building2} title="Rental listing sites">
          <div style={{ fontSize: 12.5, color: '#64748B', marginBottom: 12, lineHeight: 1.6 }}>
            Zillow and Apartments.com don't offer a self-serve API — getting listings onto them means applying as an ILS
            (Internet Listing Service) partner, a business process rather than a code change. Worth doing once you have
            real listings live; start the applications below when you're ready.
          </div>
          <Card
            title="Zillow Rental Manager"
            body="The path for landlords/property managers to post rentals that appear on Zillow, Trulia, and HotPads."
            action={{ label: 'Start on Zillow', url: 'https://www.zillow.com/rental-manager/' }}
            done={checked.zillow} onToggle={() => toggleCheck('zillow')}
          />
          <Card
            title="Apartments.com"
            body="List directly or apply for their property manager network."
            action={{ label: 'Start on Apartments.com', url: 'https://www.apartments.com/manage/' }}
            done={checked.apartments} onToggle={() => toggleCheck('apartments')}
          />
        </Section>
      </div>
    </DashboardLayout>
  );
}

function Section({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'Syne', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', marginBottom: 14 }}>
        <Icon size={16} color="#FBC02D" /> {title}
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
    </div>
  );
}

function Card({ title, body, action, copyable, done, onToggle }: {
  title: string; body: string; action: { label: string; url: string };
  copyable?: { label: string; value: string }; done?: boolean; onToggle: () => void;
}) {
  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 12, padding: 16, display: 'flex', alignItems: 'flex-start', gap: 14 }}>
      <button onClick={onToggle} aria-label="Mark done" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: 2, flexShrink: 0 }}>
        {done ? <CheckCircle2 size={18} color="#10B981" /> : <Circle size={18} color="#64748B" />}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 13.5, color: 'var(--text-primary)', marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 12.5, color: '#64748B', marginBottom: 10, lineHeight: 1.5 }}>{body}</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <a href={action.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 6, background: 'rgba(251,192,45,0.1)', border: '1px solid rgba(251,192,45,0.3)', color: '#FBC02D', fontSize: 11.5, fontFamily: 'Syne', fontWeight: 600 }}>
              {action.label} <ExternalLink size={11} />
            </span>
          </a>
          {copyable && (
            <button onClick={() => copy(copyable.value, `${copyable.label} copied`)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 6, background: 'var(--bg-app)', border: '1px solid var(--border-strong)', color: 'var(--text-secondary)', fontSize: 11.5, fontFamily: 'IBM Plex Mono', cursor: 'pointer' }}>
              <Copy size={11} /> {copyable.label}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function SocialCard({ icon: Icon, name, color, post, shareUrl, done, onToggle }: {
  icon: any; name: string; color: string; post: string; shareUrl: string; done?: boolean; onToggle: () => void;
}) {
  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 12, padding: 16, display: 'flex', alignItems: 'flex-start', gap: 14 }}>
      <button onClick={onToggle} aria-label="Mark done" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: 2, flexShrink: 0 }}>
        {done ? <CheckCircle2 size={18} color="#10B981" /> : <Circle size={18} color="#64748B" />}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
          <Icon size={14} color={color} />
          <span style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 13.5, color: 'var(--text-primary)' }}>{name}</span>
        </div>
        <div style={{ background: 'var(--bg-app)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 12, fontSize: 12.5, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', marginBottom: 10, lineHeight: 1.5 }}>
          {post}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => copy(post, 'Post copied')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 6, background: 'var(--bg-app)', border: '1px solid var(--border-strong)', color: 'var(--text-secondary)', fontSize: 11.5, fontFamily: 'IBM Plex Mono', cursor: 'pointer' }}>
            <Copy size={11} /> Copy post
          </button>
          <a href={shareUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 6, background: 'rgba(251,192,45,0.1)', border: '1px solid rgba(251,192,45,0.3)', color: '#FBC02D', fontSize: 11.5, fontFamily: 'Syne', fontWeight: 600 }}>
              Open composer <ExternalLink size={11} />
            </span>
          </a>
        </div>
      </div>
    </div>
  );
}
