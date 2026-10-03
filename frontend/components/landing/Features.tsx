'use client';
import styles from '../../styles/Landing.module.css';
import { useReveal } from './useReveal';

// Each icon is one or more separate stroke-dasharray "draw" shapes, exactly
// matching the original file's SVG structure (some icons are a single path,
// others a rect + path, each animating independently on hover) -- collapsing
// multi-shape icons into one concatenated path would change the total path
// length the CSS's fixed stroke-dasharray:120 was tuned against.
type Shape = { rect: { x: number; y: number; w: number; h: number } } | { path: string } | { circle: { cx: number; cy: number; r: number } };

const FEATURES: { title: string; body: string; spec: string; shapes: Shape[] }[] = [
  {
    title: '24/7 tenant calls and texts',
    body: 'A real voice on the line at any hour. Answers questions, takes requests, and escalates true emergencies to you.',
    spec: 'Voice · SMS · email · portal',
    shapes: [{ path: 'M11 8h6l3 8-4 2.5a18 18 0 0 0 7.5 7.5L26 22l8 3v6a3 3 0 0 1-3 3C19 34 6 21 6 9a3 3 0 0 1 3-1z' }],
  },
  {
    title: 'Maintenance triage and dispatch',
    body: 'Sorts urgent from routine, picks a vendor from your list, opens the work order and tracks it to done.',
    spec: 'Spend limits · vendor rules · photos',
    shapes: [{ path: 'M24 6a8 8 0 0 0-7.6 10.4L6 26.8V34h7.2l10.4-10.4A8 8 0 1 0 24 6z' }, { circle: { cx: 26, cy: 14, r: 2 } }],
  },
  {
    title: 'Leasing and showings',
    body: 'Replies to listing inquiries in minutes, pre-screens prospects and books showings on your calendar.',
    spec: 'Inquiry → screen → tour',
    shapes: [{ rect: { x: 6, y: 9, w: 28, h: 25 } }, { path: 'M6 16h28M13 5v7M27 5v7M14 24l4 4 8-8' }],
  },
  {
    title: 'Rent and billing',
    body: 'Collects rent online, sends friendly reminders before the due date and follows up on late balances.',
    spec: 'Stripe · autopay · late notices',
    shapes: [{ rect: { x: 5, y: 10, w: 30, h: 21 } }, { path: 'M5 16h30M11 25h6' }],
  },
  {
    title: 'Listings',
    body: 'Writes the listing from your unit details and keeps availability current as leases turn over.',
    spec: 'Descriptions · availability · syndication',
    shapes: [{ path: 'M6 34V18L20 8l14 10v16H6z' }, { path: 'M16 34v-9h8v9' }],
  },
  {
    title: 'Photo inspections',
    body: 'Walk a unit at move-in, move-out or annually. AI flags visible damage in your photos and drafts a report with rough repair estimates.',
    spec: 'Estimates, not quotes · PDF report',
    shapes: [{ rect: { x: 7, y: 8, w: 26, h: 28 } }, { path: 'M14 8V5h12v3M14 22l4 4 8-8' }],
  },
  {
    title: 'Portfolio performance',
    body: 'Cap rate, cash flow and debt coverage for every property, plus an income-based value estimate you can adjust to your market.',
    spec: 'Estimate, not an appraisal',
    shapes: [{ path: 'M6 34V6M6 34h28' }, { path: 'M12 26l7-8 6 5 9-12' }],
  },
  {
    title: 'Owner reports',
    body: 'A daily digest of everything the agent did, with every call, message and dollar logged for review.',
    spec: 'Daily digest · full audit log',
    shapes: [{ path: 'M8 6h18l6 6v22H8z' }, { path: 'M14 20h12M14 26h12M14 14h6' }],
  },
];

function FeatureCard({ f, i }: { f: typeof FEATURES[number]; i: number }) {
  const { ref, inView } = useReveal<HTMLDivElement>();
  return (
    <article
      ref={ref}
      className={`${styles.feat} ${styles.rv} ${inView ? styles.rvIn : ''}`}
      style={{ transitionDelay: `${(i % 4) * 90}ms` }}
    >
      <div className={styles.fi}>
        <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          {f.shapes.map((s, k) => {
            if ('rect' in s) return <rect key={k} className={styles.draw} x={s.rect.x} y={s.rect.y} width={s.rect.w} height={s.rect.h} rx={3} />;
            if ('circle' in s) return <circle key={k} cx={s.circle.cx} cy={s.circle.cy} r={s.circle.r} />;
            return <path key={k} className={styles.draw} d={s.path} />;
          })}
        </svg>
      </div>
      <h3>{f.title}</h3>
      <p>{f.body}</p>
      <span className={styles.spec}>{f.spec}</span>
    </article>
  );
}

export default function Features() {
  const head = useReveal<HTMLDivElement>();
  return (
    <section id="features" className={styles.section}>
      <div ref={head.ref} className={`${styles.secHead} ${styles.rv} ${head.inView ? styles.rvIn : ''}`}>
        <span className={styles.eyebrow}>What it handles</span>
        <h2>The work that eats your week.</h2>
      </div>
      <div className={styles.feats}>
        {FEATURES.map((f, i) => <FeatureCard key={f.title} f={f} i={i} />)}
      </div>
    </section>
  );
}
