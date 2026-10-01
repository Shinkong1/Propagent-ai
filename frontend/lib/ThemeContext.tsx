import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getToken, getUser, setUser } from './auth';
import { auth as authApi } from './api';

export type Theme = 'dark' | 'light';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  setTheme: () => {},
});

const STORAGE_KEY = 'propagent_theme';

function applyTheme(theme: Theme | null) {
  if (typeof document === 'undefined') return;
  if (theme) {
    document.documentElement.setAttribute('data-theme', theme);
  } else {
    // No explicit choice (see below) -- remove the attribute entirely
    // rather than defaulting to 'dark'. globals.css's bare :root already
    // carries a `@media (prefers-color-scheme: light)` block for exactly
    // this state, so leaving the attribute off is what lets the device's
    // own day/night schedule show through, live, with no JS involved.
    document.documentElement.removeAttribute('data-theme');
  }
}

function systemPrefersLight(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark');

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    let explicit: Theme | null = null;
    if (stored === 'dark' || stored === 'light') {
      explicit = stored;
    } else {
      const orgTheme = getUser()?.theme;
      if (orgTheme === 'dark' || orgTheme === 'light') explicit = orgTheme;
    }

    if (explicit) {
      // A real choice was made somewhere (this browser or this account) --
      // that always wins, and stays put regardless of the OS setting.
      setThemeState(explicit);
      applyTheme(explicit);
      return;
    }

    // Nobody has chosen yet -- follow the system setting, and keep
    // following it live for as long as this tab stays open (so a device
    // whose OS switches to dark at sunset switches this site too, without
    // a reload). `theme` here only drives React-rendered UI (e.g. the
    // active/inactive highlight on the two cards in Settings); the actual
    // visual theming for this branch comes from the CSS media query, not
    // from an attribute JS sets.
    applyTheme(null);
    setThemeState(systemPrefersLight() ? 'light' : 'dark');
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = (e: MediaQueryListEvent) => setThemeState(e.matches ? 'light' : 'dark');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const setTheme = (next: Theme) => {
    setThemeState(next);
    applyTheme(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, next);
    }
    if (getToken()) {
      authApi.updateTheme(next).then(() => {
        const user = getUser();
        if (user) setUser({ ...user, theme: next });
      }).catch(() => {});
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
