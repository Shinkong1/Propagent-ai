import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getToken, getUser, setUser } from './auth';
import { auth as authApi } from './api';
import { CURRENCIES, getCurrencySymbol, formatMoneyWithSymbol } from './currency';

interface CurrencyContextValue {
  currency: string;
  symbol: string;
  setCurrency: (code: string) => void;
  formatMoney: (amount: number, options?: { maximumFractionDigits?: number }) => string;
}

const CurrencyContext = createContext<CurrencyContextValue>({
  currency: 'USD',
  symbol: '$',
  setCurrency: () => {},
  formatMoney: (amount) => formatMoneyWithSymbol('$', amount),
});

const STORAGE_KEY = 'propagent_currency';

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState('USD');

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (stored && CURRENCIES.some(c => c.code === stored)) {
      setCurrencyState(stored);
    } else {
      const orgCurrency = getUser()?.currency;
      if (orgCurrency && CURRENCIES.some(c => c.code === orgCurrency)) {
        setCurrencyState(orgCurrency);
      }
    }
  }, []);

  const setCurrency = (code: string) => {
    setCurrencyState(code);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, code);
    }
    if (getToken()) {
      authApi.updateOrganization({ currency: code }).then(() => {
        const user = getUser();
        if (user) setUser({ ...user, currency: code });
      }).catch(() => {});
    }
  };

  const symbol = getCurrencySymbol(currency);
  const formatMoney = (amount: number, options?: { maximumFractionDigits?: number }) =>
    formatMoneyWithSymbol(symbol, amount, options);

  return (
    <CurrencyContext.Provider value={{ currency, symbol, setCurrency, formatMoney }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
}
