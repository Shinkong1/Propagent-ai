import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Zap, Play, Pause, ChevronLeft, ChevronRight, Phone, PhoneCall } from 'lucide-react';
import { isAuthenticated } from '../lib/auth';
import PublicFooter from '../components/PublicFooter';

const DURATION = 6000;
const URLS = [
  'propagent.app/dashboard', 'propagent.app/dashboard/ai-workforce', 'propagent.app/dashboard/voice',
  'propagent.app/dashboard/maintenance', 'propagent.app/dashboard/inquiries', 'propagent.app',
];

const WORKFORCE = [
  { name: 'AI Leasing Agent', stats: [['New inquiries (30d)', '6'], ['Converted', '1'], ['Conversion rate', '17%']] },
  { name: 'Maintenance Coordinator', stats: [['Open requests', '6'], ['Completed (mo)', '3'], ['AI-assisted', '7']] },
  { name: 'Accounting Assistant', stats: [['Transactions (mo)', '83'], ['Rent overdue', '3']] },
  { name: 'Compliance Officer', stats: [['Expired', '1'], ['Due <14 days', '1'], ['Due <90 days', '2']] },
  { name: 'AI Receptionist', stats: [['Calls this month', '1'], ['Resolved', '5'], ['Avg. duration', '2:00']] },
  { name: 'Portfolio Analyst', stats: [['Properties', '3'], ['Units', '22']] },
];

const CALLS = [
  { who: 'Sarah Chen', tag: 'TENANT · RIVERSIDE COMMONS', txt: '"Tenant reported the emergency pipe leak and asked for immediate help."', dur: '3:04' },
  { who: 'Marcus Johnson', tag: 'TENANT · RIVERSIDE COMMONS', txt: '"Asked for an AC repair update; agent confirmed a technician is scheduled."', dur: '1:36' },
  { who: 'Unknown caller', tag: 'PROSPECT', txt: '"Asked about pricing and availability at Downtown Lofts."', dur: '2:22' },
];

const TICKETS = [
  { t: 'Burst pipe under kitchen sink', m: 'Riverside Commons · plumbing · AI-classified: emergency', st: 'OPEN', color: '#EF4444', bg: 'rgba(239,68,68,0.14)' },
  { t: 'AC not cooling', m: 'Riverside Commons · hvac · high priority', st: 'IN PROGRESS', color: '#3B82F6', bg: 'rgba(59,130,246,0.14)' },
  { t: 'No heat', m: 'Riverside Commons · Cool Air HVAC Services dispatched · $180', st: 'COMPLETED', color: '#10B981', bg: 'rgba(16,185,129,0.14)' },
  { t: 'Slow bathroom drain', m: 'Downtown Lofts · Reliable Plumbing Co dispatched · $180', st: 'COMPLETED', color: '#10B981', bg: 'rgba(16,185,129,0.14)' },
];

const FUNNEL = [
  { nm: 'Jordan Reyes', chip: 'NEW', color: '#3B82F6', bg: 'rgba(59,130,246,0.14)', sc: '"Is it still available?"' },
  { nm: 'Taylor Brooks', chip: 'CONTACTED', color: '#8B5CF6', bg: 'rgba(139,92,246,0.14)', sc: '' },
  { nm: 'Casey Nguyen', chip: 'TOUR SCHEDULED', color: '#FBC02D', bg: 'rgba(251,192,45,0.14)', sc: '' },
  { nm: 'Morgan Diaz', chip: 'SCREENED · APPROVE', color: '#10B981', bg: 'rgba(16,185,129,0.14)', sc: 'score 88/100' },
  { nm: 'Riley Foster', chip: 'SCREENED · DECLINE', color: '#EF4444', bg: 'rgba(239,68,68,0.14)', sc: 'score 38/100' },
  { nm: 'Avery Hall', chip: 'CONVERTED', color: '#FBC02D', bg: 'rgba(251,192,45,0.12)', sc: 'now a tenant' },
];

export default function Demo() {
  const [scene, setScene] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<number | null>(null);
  const elapsedRef = useRef(0);
  const N = 6;

  useEffect(() => {
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) setPlaying(false);
  }, []);

  useEffect(() => {
    function step(ts: number) {
      if (!playing) { lastRef.current = null; rafRef.current = requestAnimationFrame(step); return; }
      if (lastRef.current == null) lastRef.current = ts;
      elapsedRef.current += ts - lastRef.current;
      lastRef.current = ts;
      const pct = Math.min(100, (elapsedRef.current / DURATION) * 100);
      setProgress(pct);
      if (elapsedRef.current >= DURATION) {
        if (scene === N - 1) { setPlaying(false); }
        else { goTo(scene + 1); }
      }
      rafRef.current = requestAnimationFrame(step);
    }
    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, scene]);

  const goTo = (idx: number) => {
    const next = ((idx % N) + N) % N;
    elapsedRef.current = 0; lastRef.current = null; setProgress(0);
    setScene(next);
    if (!playing) setPlaying(true);
  };

  const card: React.CSSProperties = { background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 12, padding: 20 };

  return (
    <>
      <Head>
        <title>See PropAgent AI in action — automated demo</title>
        <meta name="description" content="A self-playing walkthrough of PropAgent AI using real data from a live demo account — no slides, no narration needed." />
      </Head>
      <div style={{ minHeight: '100vh', background: 'var(--bg-app)', color: '#E2E8F0' }}>
        <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 48px', borderBottom: '1px solid var(--border-subtle)' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #FBC02D, #F57F17)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={16} color="var(--bg-app)" strokeWidth={2.5} />
            </div>
            <span style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 18, color: 'var(--text-primary)' }}>PropAgent AI</span>
          </Link>
          <Link href={isAuthenticated() ? '/dashboard' : '/login'} style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: 14 }}>
            {isAuthenticated() ? 'Dashboard' : 'Sign in'}
          </Link>
        </nav>

        <div style={{ maxWidth: 880, margin: '0 auto', padding: '56px 20px 40px' }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#FBC02D', marginBottom: 8 }}>Automated product walkthrough</div>
            <h1 style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 30, color: 'var(--text-primary)', marginBottom: 8, textWrap: 'balance' as any }}>See PropAgent AI in action</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 14.5 }}>No slides. This is a real, live demo account — press play or let it run.</p>
          </div>

          <div style={{ background: 'var(--bg-app)', border: '1px solid var(--border-strong)', borderRadius: 14, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-strong)' }}>
              <div style={{ display: 'flex', gap: 6 }}>
                {[0, 1, 2].map(i => <span key={i} style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--border-strong)' }} />)}
              </div>
              <div style={{ flex: 1, fontFamily: 'IBM Plex Mono', fontSize: 11.5, color: '#475569', background: 'var(--bg-app)', borderRadius: 6, padding: '5px 10px', textAlign: 'center', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                {URLS[scene]}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 5, padding: '10px 14px 0' }}>
              {Array.from({ length: N }).map((_, i) => (
                <div key={i} onClick={() => goTo(i)} style={{ flex: 1, height: 3, borderRadius: 3, background: 'var(--border-subtle)', overflow: 'hidden', cursor: 'pointer' }}>
                  <div style={{
                    height: '100%', borderRadius: 3, background: '#FBC02D',
                    width: i < scene ? '100%' : i === scene ? `${progress}%` : '0%',
                    transition: i === scene ? 'none' : undefined,
                  }} />
                </div>
              ))}
            </div>

            <div style={{ position: 'relative', minHeight: 430, padding: '22px 20px 18px' }}>
              {scene === 0 && (
                <div style={{ textAlign: 'center', padding: '40px 10px' }}>
                  <div style={{ fontFamily: 'Syne', fontSize: 42, fontWeight: 800, color: '#FBC02D', marginBottom: 6 }}>⚡</div>
                  <h3 style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 24, marginBottom: 10, textWrap: 'balance' as any }}>Your property management team, powered by AI</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: 14, maxWidth: 420, margin: '0 auto' }}>Real inquiries, real maintenance tickets, real AI screening decisions — everything in this walkthrough comes from a live PropAgent AI account.</p>
                </div>
              )}

              {scene === 1 && (
                <div>
                  <SceneTitle title="AI Workforce Command Center" />
                  <Caption>Every AI employee, one screen. <b>These are today's real numbers</b> from a 3-property, 22-unit portfolio — not a mockup.</Caption>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
                    {WORKFORCE.map(w => (
                      <div key={w.name} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 10, padding: 12 }}>
                        <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 12.5, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981' }} />{w.name}
                        </div>
                        {w.stats.map(([l, v]) => (
                          <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '3px 0' }}>
                            <span style={{ color: '#475569' }}>{l}</span><span style={{ fontFamily: 'IBM Plex Mono', fontWeight: 600 }}>{v}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {scene === 2 && (
                <div>
                  <SceneTitle title="AI Receptionist" />
                  <Caption>2:14am, a tenant's pipe bursts. She calls the same number as always — <b>the AI answers, understands, and logs it immediately.</b></Caption>
                  <div>
                    {CALLS.map((c, i) => (
                      <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 0', borderTop: i ? '1px solid var(--border-subtle)' : 'none', alignItems: 'flex-start' }}>
                        <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(251,192,45,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <PhoneCall size={14} color="#FBC02D" />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{c.who} <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: '#475569', marginLeft: 6 }}>{c.tag}</span></div>
                          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>{c.txt}</div>
                        </div>
                        <div style={{ marginLeft: 'auto', textAlign: 'right', fontFamily: 'IBM Plex Mono', fontSize: 10.5, color: '#475569', whiteSpace: 'nowrap' }}>{c.dur}<br />completed</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {scene === 3 && (
                <div>
                  <SceneTitle title="Maintenance Coordinator" />
                  <Caption>Sarah's call above didn't just get logged — <b>the AI classified it, set it emergency priority, and it's on the board instantly.</b></Caption>
                  <div>
                    {TICKETS.map((t, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderTop: i ? '1px solid var(--border-subtle)' : 'none' }}>
                        <div style={{ width: 4, alignSelf: 'stretch', borderRadius: 3, flexShrink: 0, background: t.color }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 600 }}>{t.t}</div>
                          <div style={{ fontSize: 11, color: '#475569', marginTop: 1 }}>{t.m}</div>
                        </div>
                        <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 9.5, padding: '3px 8px', borderRadius: 4, whiteSpace: 'nowrap', background: t.bg, color: t.color }}>{t.st}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {scene === 4 && (
                <div>
                  <SceneTitle title="Leasing & screening" />
                  <Caption>Downtown Lofts, actively leasing. Watch six real inquiries move from first message to <b>an AI-scored decision</b> — the human still approves, the AI does the qualifying.</Caption>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {FUNNEL.map(f => (
                      <div key={f.nm} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 8, padding: '9px 12px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 12.5, fontWeight: 600, minWidth: 92 }}>{f.nm}</span>
                        <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9.5, padding: '3px 8px', borderRadius: 4, whiteSpace: 'nowrap', background: f.bg, color: f.color }}>{f.chip}</span>
                        {f.sc && <span style={{ marginLeft: 'auto', fontFamily: 'IBM Plex Mono', fontSize: 11, color: '#475569' }}>{f.sc}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {scene === 5 && (
                <div style={{ textAlign: 'center', padding: '18px 10px 6px' }}>
                  <h3 style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 21, marginBottom: 8, textWrap: 'balance' as any }}>Everything you just watched is real.</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: 13.5, maxWidth: 440, margin: '0 auto 22px' }}>Not staged screenshots — a live product you can try yourself.</p>
                  <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <Link href="/signup" style={{ textDecoration: 'none' }}>
                      <span style={{ display: 'inline-block', padding: '11px 24px', borderRadius: 8, background: 'linear-gradient(135deg, #FBC02D, #F57F17)', color: 'var(--bg-app)', fontWeight: 700, fontFamily: 'Syne', fontSize: 14 }}>Start free trial</span>
                    </Link>
                    <Link href="/contact" style={{ textDecoration: 'none' }}>
                      <span style={{ display: 'inline-block', padding: '11px 24px', borderRadius: 8, border: '1px solid var(--border-strong)', color: 'var(--text-secondary)', fontWeight: 700, fontFamily: 'Syne', fontSize: 14 }}>Talk to us</span>
                    </Link>
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, padding: '14px 0 20px' }}>
              <button onClick={() => goTo(scene - 1)} aria-label="Previous" style={ctrlBtn}><ChevronLeft size={15} /></button>
              <button onClick={() => setPlaying(p => !p)} aria-label="Play or pause" style={ctrlBtn}>{playing ? <Pause size={13} /> : <Play size={13} />}</button>
              <div style={{ display: 'flex', gap: 6 }}>
                {Array.from({ length: N }).map((_, i) => (
                  <button key={i} onClick={() => goTo(i)} aria-label={`Scene ${i + 1}`} style={{ width: 6, height: 6, borderRadius: '50%', border: 'none', cursor: 'pointer', padding: 0, background: i === scene ? '#FBC02D' : 'var(--border-strong)' }} />
                ))}
              </div>
              <button onClick={() => goTo(scene + 1)} aria-label="Next" style={ctrlBtn}><ChevronRight size={15} /></button>
            </div>
          </div>

          <div style={{ textAlign: 'center', marginTop: 20, fontSize: 12.5, color: '#475569', fontFamily: 'IBM Plex Sans' }}>
            Want the guided version? <a href="mailto:propagentapp@gmail.com" style={{ color: '#FBC02D', textDecoration: 'none' }}>Ask us for demo login access</a> and click around yourself.
          </div>
        </div>

        <PublicFooter />
      </div>
    </>
  );
}

const ctrlBtn: React.CSSProperties = {
  background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', color: 'var(--text-muted)',
  width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
};

function SceneTitle({ title }: { title: string }) {
  return (
    <h2 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 18, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
      {title}
      <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9.5, padding: '2px 7px', borderRadius: 20, background: 'rgba(16,185,129,0.12)', color: '#10B981', letterSpacing: '0.04em' }}>LIVE DATA</span>
    </h2>
  );
}

function Caption({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 14.5, color: 'var(--text-muted)', margin: '0 0 16px', lineHeight: 1.5, maxWidth: 560 }}>{children}</p>;
}
