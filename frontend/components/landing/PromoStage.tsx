'use client';
import { useEffect, useRef } from 'react';
import styles from '../../styles/Landing.module.css';

// Ported from design/propagent-landing.html's vanilla-JS promo stage.
// Kept as an imperative, ref-driven rAF loop (not React state per frame --
// that would re-render 60x/second) exactly like the original; React only
// owns mount/unmount and cleanup (cancelAnimationFrame, clearInterval,
// IntersectionObserver.disconnect) via this single useEffect.
const SCENE_NAMES = ['Call', 'Understand', 'Dispatch', 'Tenant', 'Owner', 'PropAgent'];
const DUR = [4200, 5600, 4800, 4800, 4800, 4200];
const TYPED_TEXT = "There's water coming out from under the kitchen sink. It's all over the floor.";
// Swapped into playIconRef's innerHTML directly (matching the original's
// imperative icon.innerHTML swap) rather than a React re-render, since the
// play/pause button lives inside the same imperative effect as the rAF loop.
const ICON_PAUSE = '<rect x="3" y="2" width="3.5" height="12" rx="1"/><rect x="9.5" y="2" width="3.5" height="12" rx="1"/>';
const ICON_PLAY = '<path d="M4 2.5v11a.8.8 0 0 0 1.2.7l9-5.5a.8.8 0 0 0 0-1.4l-9-5.5A.8.8 0 0 0 4 2.5z"/>';

export default function PromoStage() {
  const stageRef = useRef<HTMLDivElement>(null);
  const sceneRefs = useRef<(HTMLDivElement | null)[]>([]);
  const segBarRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const segRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const typedRef = useRef<HTMLSpanElement>(null);
  const playIconRef = useRef<SVGSVGElement>(null);
  const playBtnRef = useRef<HTMLButtonElement>(null);
  const showRef = useRef<(n: number) => void>(() => {});

  useEffect(() => {
    const scenes = sceneRefs.current.filter(Boolean) as HTMLDivElement[];
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let i = 0, elapsed = 0, last = 0, playing = !reduced, userPaused = false, raf = 0, typeTimer: ReturnType<typeof setInterval>;
    let typeStartTimeout: ReturnType<typeof setTimeout>;

    function type() {
      const typed = typedRef.current;
      if (!typed) return;
      clearInterval(typeTimer);
      clearTimeout(typeStartTimeout);
      if (reduced) { typed.textContent = TYPED_TEXT; return; }
      let n = 0;
      typed.innerHTML = `<span class="${styles.caret}"></span>`;
      typeStartTimeout = setTimeout(() => {
        typeTimer = setInterval(() => {
          n++;
          typed.innerHTML = TYPED_TEXT.slice(0, n) + `<span class="${styles.caret}"></span>`;
          if (n >= TYPED_TEXT.length) {
            clearInterval(typeTimer);
            setTimeout(() => { typed.textContent = TYPED_TEXT; }, 500);
          }
        }, 26);
      }, 350);
    }

    function paint() {
      segRefs.current.forEach((b, k) => {
        if (!b) return;
        b.classList.toggle(styles.segCur, k === i);
        b.setAttribute('aria-selected', String(k === i));
        const bar = segBarRefs.current[k]?.firstElementChild as HTMLElement | null;
        if (bar) bar.style.width = (k < i ? 100 : k === i ? Math.min(100, (elapsed / DUR[i]) * 100) : 0) + '%';
      });
    }

    function show(n: number) {
      i = n; elapsed = 0;
      scenes.forEach((s, k) => { if (k !== n) s.classList.remove(styles.sceneOn); });
      const s = scenes[n];
      s.classList.remove(styles.sceneOn);
      void s.offsetWidth; // force reflow so the transition restarts
      s.classList.add(styles.sceneOn);
      if (n === 1) type();
      paint();
    }
    showRef.current = show;

    function setPlay(p: boolean) {
      playing = p;
      if (playBtnRef.current) playBtnRef.current.setAttribute('aria-label', p ? 'Pause promo' : 'Play promo');
      if (playIconRef.current) playIconRef.current.innerHTML = p ? ICON_PAUSE : ICON_PLAY;
    }

    function tick(ts: number) {
      const dt = last ? Math.min(ts - last, 100) : 0;
      last = ts;
      if (playing) {
        elapsed += dt;
        if (elapsed >= DUR[i]) show((i + 1) % scenes.length); else paint();
      }
      raf = requestAnimationFrame(tick);
    }

    const onPlayClick = () => { userPaused = playing; setPlay(!playing); };
    playBtnRef.current?.addEventListener('click', onPlayClick);

    const stage = stageRef.current;
    const onFsClick = () => {
      const p = stage?.requestFullscreen ? stage.requestFullscreen() : null;
      if (p && (p as Promise<void>).catch) (p as Promise<void>).catch(() => {});
      show(0); setPlay(true);
    };
    const fsBtn = stage?.querySelector<HTMLButtonElement>(`.${styles.ctl}[data-fs]`);
    fsBtn?.addEventListener('click', onFsClick);

    let io: IntersectionObserver | undefined;
    if (stage) {
      io = new IntersectionObserver(([entry]) => {
        if (userPaused || reduced) return;
        setPlay(entry.isIntersecting);
      }, { threshold: 0.25 });
      io.observe(stage);
    }

    setPlay(playing);
    paint();
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      clearInterval(typeTimer);
      clearTimeout(typeStartTimeout);
      io?.disconnect();
      playBtnRef.current?.removeEventListener('click', onPlayClick);
      fsBtn?.removeEventListener('click', onFsClick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Segment buttons jump straight to that scene via the ref-captured show()
  // from the main effect above -- matches the original's plain
  // `b.onclick = () => show(k)`, without touching the playing/paused state.
  const segClick = (n: number) => showRef.current(n);

  return (
    <div className={styles.promo} aria-label="PropAgent promo, 27 seconds">
      <div className={styles.stage} ref={stageRef}>
        <div className={styles.stageTag}><i /> Example scenario &middot; Unit 4B</div>

        {/* 1 call */}
        <div className={`${styles.scene} ${styles.sceneOn}`} ref={el => { sceneRefs.current[0] = el; }}>
          <div className={styles.col}>
            <div className={`${styles.bigTime} ${styles.a}`} style={{ ['--d' as any]: '.05s' }}>2:14<span style={{ fontSize: '.45em', marginLeft: '.15em' }}>AM</span></div>
            <div className={`${styles.sCap} ${styles.a}`} style={{ ['--d' as any]: '.35s' }}>Tenants don&apos;t keep office hours.</div>
            <div className={`${styles.sSub} ${styles.a}`} style={{ ['--d' as any]: '.6s' }}>A leak doesn&apos;t wait until Monday. Neither does PropAgent.</div>
          </div>
          <div className={`${styles.phone} ${styles.a}`} style={{ ['--d' as any]: '.5s' }}>
            <div className={styles.ring}><svg viewBox="0 0 24 24" fill="#1A1204"><path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z" /></svg></div>
            <div className={styles.phoneWho}>Incoming call</div>
            <div className={styles.phoneMeta}>Maria T. &middot; Unit 4B<br />Maple Court Apartments</div>
            <div className={styles.phoneAns}><i />PropAgent answering</div>
          </div>
        </div>

        {/* 2 understand */}
        <div className={styles.scene} ref={el => { sceneRefs.current[1] = el; }}>
          <div className={styles.col} style={{ maxWidth: '26cqw', minWidth: 0 }}>
            <div className={`${styles.sCap} ${styles.a}`}>It listens, then it understands.</div>
            <div className={`${styles.wave} ${styles.a}`} style={{ ['--d' as any]: '.2s' }} aria-hidden="true">
              {[0, .1, .2, .3, .4, .15, .25, .05].map((d, k) => <b key={k} style={{ animationDelay: `${d}s` }} />)}
            </div>
          </div>
          <div className={styles.transcript}>
            <div className={`${styles.bubble} ${styles.a}`} style={{ ['--d' as any]: '.15s' }}><span className={styles.bubbleLbl}>Tenant &middot; voice</span><span ref={typedRef}>{TYPED_TEXT}</span></div>
            <div className={`${styles.bubble} ${styles.bubbleAgent} ${styles.a}`} style={{ ['--d' as any]: '2.3s' }}><span className={styles.bubbleLbl}>PropAgent</span>Got it, Maria. I&apos;m sending a plumber now. Can you reach the valve under the sink?</div>
            <div className={styles.chips}>
              <span className={`${styles.chip} ${styles.chipHot} ${styles.a}`} style={{ ['--d' as any]: '3s' }}>Urgent</span>
              <span className={`${styles.chip} ${styles.chipAmb} ${styles.a}`} style={{ ['--d' as any]: '3.2s' }}>Plumbing &middot; active leak</span>
              <span className={`${styles.chip} ${styles.a}`} style={{ ['--d' as any]: '3.4s' }}>Lease: landlord repair</span>
            </div>
          </div>
        </div>

        {/* 3 dispatch */}
        <div className={styles.scene} ref={el => { sceneRefs.current[2] = el; }}>
          <div className={styles.col} style={{ maxWidth: '28cqw' }}>
            <div className={`${styles.sCap} ${styles.a}`}>Picks the right vendor.</div>
            <div className={`${styles.sSub} ${styles.a}`} style={{ ['--d' as any]: '.25s' }}>Using your approved list, your spend limit and who&apos;s on call right now.</div>
          </div>
          <div className={styles.vendors}>
            <div className={`${styles.vendor} ${styles.vendorPick} ${styles.a}`} style={{ ['--d' as any]: '.35s' }}><span className={styles.vendorN}>Rivera Plumbing</span><span className={styles.vendorD}>On call &middot; 4.9 rating &middot; 3.1 mi</span><span className={styles.vendorSt}>ETA 45 min</span></div>
            <div className={`${styles.vendor} ${styles.a}`} style={{ ['--d' as any]: '.5s' }}><span className={styles.vendorN}>A1 Drain Co.</span><span className={styles.vendorD}>Closed until 8:00 AM</span><span className={styles.vendorSt}>&mdash;</span></div>
            <div className={`${styles.vendor} ${styles.a}`} style={{ ['--d' as any]: '.65s' }}><span className={styles.vendorN}>Metro Pipe &amp; Heat</span><span className={styles.vendorD}>After-hours fee $420</span><span className={styles.vendorSt}>Over limit</span></div>
            <div className={`${styles.wo} ${styles.a}`} style={{ ['--d' as any]: '2s' }}><svg width="14" height="14" viewBox="0 0 12 12"><path d="M2.5 6.2 5 8.6l4.5-5" fill="none" stroke="#3DD68C" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>WO-1042 created &middot; 2:15 AM &middot; $285 est.</div>
          </div>
        </div>

        {/* 4 tenant */}
        <div className={styles.scene} ref={el => { sceneRefs.current[3] = el; }}>
          <div className={styles.col} style={{ maxWidth: '28cqw' }}>
            <div className={`${styles.sCap} ${styles.a}`}>Keeps your tenant in the loop.</div>
            <div className={`${styles.sSub} ${styles.a}`} style={{ ['--d' as any]: '.25s' }}>Plain-language updates by text, in whatever language they speak.</div>
          </div>
          <div className={styles.sms}>
            <div className={`${styles.bubble} ${styles.bubbleAgent} ${styles.a}`} style={{ ['--d' as any]: '.4s' }}><span className={styles.bubbleLbl}>SMS &middot; to Maria T.</span>Hi Maria, a plumber from Rivera Plumbing is on the way. ETA about 3:00 AM. If you can, close the valve under the sink and move anything off the floor.</div>
            <div className={`${styles.smsFoot} ${styles.a}`} style={{ ['--d' as any]: '1s' }}><span>2:15 AM</span><b>Delivered</b></div>
            <div className={`${styles.bubble} ${styles.a}`} style={{ ['--d' as any]: '1.9s', alignSelf: 'flex-end', maxWidth: '70%' }}><span className={styles.bubbleLbl}>Maria T.</span>Valve&apos;s off. Thank you!!</div>
          </div>
        </div>

        {/* 5 owner */}
        <div className={styles.scene} ref={el => { sceneRefs.current[4] = el; }}>
          <div className={styles.col} style={{ maxWidth: '28cqw' }}>
            <div className={`${styles.sCap} ${styles.a}`}>You wake up to a summary, not a crisis.</div>
          </div>
          <div className={`${styles.digest} ${styles.a}`} style={{ ['--d' as any]: '.2s' }}>
            <div className={styles.digestHd}><span>7:00 AM &middot; Overnight digest</span><span>Maple Court</span></div>
            <div className={`${styles.row} ${styles.a}`} style={{ ['--d' as any]: '.6s' }}><span className={styles.tick}><svg viewBox="0 0 12 12"><path d="M2.5 6.2 5 8.6l4.5-5" fill="none" stroke="#3DD68C" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg></span><span>Leak in Unit 4B fixed<small>Rivera Plumbing &middot; $285, within your $350 limit</small></span></div>
            <div className={`${styles.row} ${styles.a}`} style={{ ['--d' as any]: '.9s' }}><span className={styles.tick}><svg viewBox="0 0 12 12"><path d="M2.5 6.2 5 8.6l4.5-5" fill="none" stroke="#3DD68C" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg></span><span>3 rent payments posted<small>Units 2A, 3C, 5B &middot; via Stripe</small></span></div>
            <div className={`${styles.row} ${styles.a}`} style={{ ['--d' as any]: '1.2s' }}><span className={styles.tick}><svg viewBox="0 0 12 12"><path d="M2.5 6.2 5 8.6l4.5-5" fill="none" stroke="#3DD68C" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg></span><span>2 showings booked for Saturday<small>Unit 1D &middot; 10:00 AM and 11:30 AM</small></span></div>
          </div>
        </div>

        {/* 6 lockup */}
        <div className={`${styles.scene} ${styles.lockup}`} ref={el => { sceneRefs.current[5] = el; }}>
          <div className={`${styles.lockupLg} ${styles.a}`}>
            <svg viewBox="0 0 40 40" aria-hidden="true">
              <rect x="1" y="1" width="38" height="38" rx="9" fill="#0F1B32" stroke="#2F4470" />
              <path d="M9 32V15.5L20 8l11 7.5V32" fill="none" stroke="#EAF0F8" strokeWidth={2} strokeLinejoin="round" />
              <path d="M6 32h28" stroke="#EAF0F8" strokeWidth={2} strokeLinecap="round" />
              <path className={styles.boltDraw} d="M22.5 12.5 15 22.5h5.2l-2 8.5 8-11h-5.4z" fill="none" stroke="#F5A524" strokeWidth={1.6} strokeLinejoin="round" />
              <path d="M22.5 12.5 15 22.5h5.2l-2 8.5 8-11h-5.4z" fill="#F5A524" className={styles.a} style={{ ['--d' as any]: '1.2s' }} />
            </svg>
            PropAgent
          </div>
          <div className={`${styles.lockupTag} ${styles.a}`} style={{ ['--d' as any]: '.5s' }}>The property manager that <em>never clocks out.</em></div>
          <div className={`${styles.lockupPill} ${styles.a}`} style={{ ['--d' as any]: '.9s' }}>Book a demo</div>
        </div>
      </div>

      <div className={styles.controls}>
        <button className={styles.ctl} ref={playBtnRef} aria-label="Pause promo">
          <svg ref={playIconRef} viewBox="0 0 16 16" fill="currentColor"><rect x="3" y="2" width="3.5" height="12" rx="1" /><rect x="9.5" y="2" width="3.5" height="12" rx="1" /></svg>
        </button>
        <div className={styles.segs} role="tablist" aria-label="Promo scenes">
          {SCENE_NAMES.map((name, k) => (
            <button
              key={name}
              ref={el => { segRefs.current[k] = el; }}
              className={styles.seg}
              role="tab"
              aria-label={`Scene ${k + 1}: ${name}`}
              onClick={() => segClick(k)}
            >
              <span className={styles.segBar} ref={el => { segBarRefs.current[k] = el; }}><i /></span>
              <span className={styles.segSpan}>{name}</span>
            </button>
          ))}
        </div>
        <button className={styles.ctl} data-fs aria-label="Fullscreen">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round"><path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" /></svg>
        </button>
      </div>
    </div>
  );
}
