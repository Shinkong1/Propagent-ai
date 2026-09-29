import Head from 'next/head';
import PublicNav from '../components/PublicNav';
import PublicFooter from '../components/PublicFooter';
import PromoStage from '../components/landing/PromoStage';
import VideoSection from '../components/landing/VideoSection';
import HowItWorks from '../components/landing/HowItWorks';
import Features from '../components/landing/Features';
import DemoForm from '../components/landing/DemoForm';
import { landingFontVars } from '../lib/landingFonts';
import styles from '../styles/Landing.module.css';

// Ported from design/propagent-landing.html (see that file's own history in
// this session for the full port plan). Palette, fonts and most class names
// are scoped to Landing.module.css / this page only -- the rest of the site
// keeps its existing tokens. PublicNav/PublicFooter are reused from the rest
// of the site rather than the file's own bespoke nav/footer, so the whole
// site stays visually consistent (this page just sits on its own palette
// underneath that shared chrome).
export default function Home() {
  return (
    <>
      <Head>
        <title>PropAgent — AI property management</title>
        <meta name="description" content="PropAgent is an AI agent that answers tenant calls and texts, dispatches vendors, books showings and collects rent, day or night. Then it tells you exactly what it did." />
        <link rel="icon" href="/favicon-landing.svg" type="image/svg+xml" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://propagent.app" />
        <meta property="og:title" content="PropAgent — AI property management" />
        <meta property="og:description" content="An AI agent that answers tenant calls and texts, dispatches vendors, books showings and collects rent, day or night." />
        <meta property="og:image" content="https://propagent.app/video/propagent-commercial-poster.jpg" />
        {/* og:video lets Facebook/LinkedIn preview the real commercial inline on a
            shared link instead of a static image. Support is platform-dependent
            (LinkedIn honors it more reliably than Facebook for self-hosted mp4s),
            so this is a bonus, not a guarantee -- og:image above is the fallback. */}
        <meta property="og:video" content="https://propagent.app/video/propagent-commercial.mp4" />
        <meta property="og:video:secure_url" content="https://propagent.app/video/propagent-commercial.mp4" />
        <meta property="og:video:type" content="video/mp4" />
        <meta property="og:video:width" content="1920" />
        <meta property="og:video:height" content="1080" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="PropAgent — AI property management" />
        <meta name="twitter:description" content="An AI agent that answers tenant calls and texts, dispatches vendors, books showings and collects rent, day or night." />
        <meta name="twitter:image" content="https://propagent.app/video/propagent-commercial-poster.jpg" />
      </Head>

      <div className={`${styles.page} ${landingFontVars}`}>
        <div className={styles.wrap}>
          <PublicNav />

          <header className={styles.hero} id="top">
            <span className={styles.eyebrow}>AI property management</span>
            <div className={styles.heroRow}>
              <h1>Your properties, answered at <em>2&nbsp;AM</em>.</h1>
              <div style={{ display: 'grid', gap: 22 }}>
                <p className={styles.lede}>PropAgent is an AI agent that picks up tenant calls and texts, dispatches vendors, books showings and collects rent. Then it tells you exactly what it did.</p>
                <div className={styles.ctaRow}>
                  <a className={`${styles.btn} ${styles.btnAmber}`} href="#demo">Book a demo</a>
                  <a className={`${styles.btn} ${styles.btnGhost}`} href="#how">See how it works</a>
                </div>
              </div>
            </div>
            <PromoStage />
          </header>

          <VideoSection />
          <HowItWorks />
          <Features />
          <DemoForm />
          <p className={styles.disclaimer}>Example names and figures on this page are illustrative.</p>
          <PublicFooter />
        </div>
      </div>
    </>
  );
}
