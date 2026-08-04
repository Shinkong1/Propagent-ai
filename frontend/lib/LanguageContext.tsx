import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Language, translations } from './translations';
import { getToken, getUser, setUser } from './auth';
import { auth as authApi } from './api';

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
  language: 'en',
  setLanguage: () => {},
  t: (key: string) => key,
});

const STORAGE_KEY = 'propagent_language';

// Match the browser's preferred languages (e.g. "es-MX", "fr-CA") against our
// supported set by primary subtag, falling back to English if none match.
function detectBrowserLanguage(): Language {
  if (typeof navigator === 'undefined') return 'en';
  const candidates = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const primary = candidate.split('-')[0].toLowerCase();
    if (primary in translations) return primary as Language;
  }
  return 'en';
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (stored && stored in translations) {
      setLanguageState(stored as Language);
      return;
    }
    // No local override yet — fall back to the org's saved preference, if logged in.
    const orgLanguage = getUser()?.language;
    if (orgLanguage && orgLanguage in translations) {
      setLanguageState(orgLanguage as Language);
      return;
    }
    // First-ever visit, no account yet — auto-detect from the browser/region so
    // the site opens in the visitor's own language instead of always defaulting
    // to English. Persisted immediately so it behaves like a deliberate choice
    // from then on (the user can still override it via Settings > Language).
    const detected = detectBrowserLanguage();
    setLanguageState(detected);
    if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, detected);
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, lang);
    }
    // Persist so the backend (e.g. Voice AI) can pick up the same language.
    if (getToken()) {
      authApi.updateLanguage(lang).then(() => {
        const user = getUser();
        if (user) setUser({ ...user, language: lang });
      }).catch(() => {});
    }
  };

  const t = (key: string): string => {
    return translations[language]?.[key] ?? translations.en[key] ?? key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
