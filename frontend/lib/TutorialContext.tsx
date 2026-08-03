import { createContext, useContext, useState, ReactNode } from 'react';
import { getUser } from './auth';

export interface TutorialStep {
  key: string;
  href?: string;
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  { key: 'welcome' },
  { key: 'properties', href: '/dashboard/properties' },
  { key: 'tenants', href: '/dashboard/tenants' },
  { key: 'maintenance', href: '/dashboard/maintenance' },
  { key: 'accounting', href: '/dashboard/accounting' },
  { key: 'executive', href: '/dashboard/executive' },
  { key: 'voiceLanguage', href: '/dashboard/voice' },
  { key: 'done' },
];

const STORAGE_PREFIX = 'propagent_tour_seen_';

interface TutorialContextValue {
  isOpen: boolean;
  stepIndex: number;
  steps: TutorialStep[];
  openTour: () => void;
  closeTour: () => void;
  next: () => void;
  back: () => void;
  skip: () => void;
  autoStartIfNeeded: () => void;
}

const TutorialContext = createContext<TutorialContextValue>({
  isOpen: false,
  stepIndex: 0,
  steps: TUTORIAL_STEPS,
  openTour: () => {},
  closeTour: () => {},
  next: () => {},
  back: () => {},
  skip: () => {},
  autoStartIfNeeded: () => {},
});

function seenKey(): string | null {
  const user = getUser();
  const id = user?.user_id || user?.id;
  return id ? `${STORAGE_PREFIX}${id}` : null;
}

function markSeen() {
  const key = seenKey();
  if (key && typeof window !== 'undefined') localStorage.setItem(key, '1');
}

function hasSeen(): boolean {
  const key = seenKey();
  if (!key || typeof window === 'undefined') return true;
  return localStorage.getItem(key) === '1';
}

export function TutorialProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const openTour = () => {
    setStepIndex(0);
    setIsOpen(true);
  };

  const closeTour = () => {
    markSeen();
    setIsOpen(false);
  };

  const next = () => {
    setStepIndex(i => {
      if (i >= TUTORIAL_STEPS.length - 1) {
        markSeen();
        setIsOpen(false);
        return i;
      }
      return i + 1;
    });
  };

  const back = () => setStepIndex(i => Math.max(0, i - 1));

  const skip = () => {
    markSeen();
    setIsOpen(false);
  };

  const autoStartIfNeeded = () => {
    if (!hasSeen()) openTour();
  };

  return (
    <TutorialContext.Provider value={{ isOpen, stepIndex, steps: TUTORIAL_STEPS, openTour, closeTour, next, back, skip, autoStartIfNeeded }}>
      {children}
    </TutorialContext.Provider>
  );
}

export function useTutorial() {
  return useContext(TutorialContext);
}
