'use client';
import styles from '../../styles/Landing.module.css';
import { useReveal } from './useReveal';

// The real commercial (male-voice cut) -- separate from PromoStage's
// hand-built CSS/SVG animation above it, which stays as the interactive
// piece. This is the literal video asset, with real captions.
export default function VideoSection() {
  const { ref, inView } = useReveal<HTMLDivElement>();
  return (
    <section className={styles.section} style={{ paddingBlockStart: 48 }}>
      <div ref={ref} className={`${styles.videoWrap} ${styles.rv} ${inView ? styles.rvIn : ''}`}>
        <video
          controls
          preload="metadata"
          poster="/video/propagent-commercial-poster.jpg"
          style={{ width: '100%', height: 'auto', display: 'block' }}
        >
          <source src="/video/propagent-commercial.mp4" type="video/mp4" />
          <track kind="captions" src="/video/propagent-commercial-captions.vtt" srcLang="en" label="English" default />
          Your browser doesn&apos;t support embedded video. <a href="/video/propagent-commercial.mp4">Download the video</a> instead.
        </video>
        <div className={styles.videoCaption}>See PropAgent handle a real 2 AM emergency, start to finish &middot; 30 seconds &middot; captions on</div>
      </div>
    </section>
  );
}
