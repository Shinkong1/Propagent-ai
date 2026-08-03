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

function applyTheme(theme: Theme) {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', theme);
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark');

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    let initial: Theme = 'dark';
    if (stored === 'dark' || stored === 'light') {
      initial = stored;
    } else {
      const orgTheme = getUser()?.theme;
      if (orgTheme === 'dark' || orgTheme === 'light') initial = orgTheme;
    }
    setThemeState(initial);
    applyTheme(initial);
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
