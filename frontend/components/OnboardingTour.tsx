import { useRouter } from 'next/router';
import {
  Sparkles, Building2, Users, Wrench, Landmark, BarChart3, Phone, PartyPopper, ArrowRight
} from 'lucide-react';
import { useTutorial } from '../lib/TutorialContext';
import { useLanguage } from '../lib/LanguageContext';

const STEP_ICON: Record<string, any> = {
  welcome: Sparkles,
  properties: Building2,
  tenants: Users,
  maintenance: Wrench,
  accounting: Landmark,
  executive: Sparkles,
  voiceLanguage: Phone,
  done: PartyPopper,
};

export default function OnboardingTour() {
  const { isOpen, stepIndex, steps, next, back, skip, closeTour } = useTutorial();
  const { t } = useLanguage();
  const router = useRouter();

  if (!isOpen) return null;

  const step = steps[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === steps.length - 1;
  const Icon = STEP_ICON[step.key] || Sparkles;

  const goThere = () => {
    closeTour();
    if (step.href) router.push(step.href);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 16, padding: 32, width: 460, maxWidth: '90vw' }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(var(--accent-rgb),0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
          <Icon size={24} color="#FBC02D" />
        </div>

        <h2 style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 20, color: 'var(--text-primary)', marginBottom: 10 }}>
          {t(`tour.${step.key}Title`)}
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
          {t(`tour.${step.key}Body`)}
        </p>

        <div style={{ display: 'flex', gap: 6, marginBottom: 22 }}>
          {steps.map((_, i) => (
            <div key={i} style={{
              height: 4, flex: 1, borderRadius: 2,
              background: i <= stepIndex ? '#FBC02D' : 'var(--border-strong)',
            }} />
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div>
            {!isFirst && !isLast && (
              <button onClick={back} style={{ padding: '9px 16px', background: 'transparent', border: '1px solid var(--border-strong)', borderRadius: 8, color: 'var(--text-secondary)', fontSize: 13, fontFamily: 'IBM Plex Sans', cursor: 'pointer' }}>
                {t('tour.back')}
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {!isLast && (
              <button onClick={skip} style={{ padding: '9px 16px', background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: 13, fontFamily: 'IBM Plex Sans', cursor: 'pointer' }}>
                {t('tour.skip')}
              </button>
            )}
            {step.href && !isLast && (
              <button onClick={goThere} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: 'rgba(var(--accent-rgb),0.08)', border: '1px solid rgba(var(--accent-rgb),0.3)', borderRadius: 8, color: '#FBC02D', fontSize: 13, fontFamily: 'IBM Plex Sans', cursor: 'pointer' }}>
                {t('tour.takeMeThere')} <ArrowRight size={13} />
              </button>
            )}
            <button onClick={next} style={{ padding: '9px 18px', background: 'linear-gradient(135deg, #FBC02D, #F57F17)', border: 'none', borderRadius: 8, color: 'var(--bg-app)', fontWeight: 700, fontFamily: 'Syne', fontSize: 13, cursor: 'pointer' }}>
              {isLast ? t('tour.finish') : t('tour.next')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
