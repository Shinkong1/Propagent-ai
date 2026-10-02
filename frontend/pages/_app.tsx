import type { AppProps } from 'next/app';
import Head from 'next/head';
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import '../styles/globals.css';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from '../lib/ThemeContext';
import { LanguageProvider } from '../lib/LanguageContext';
import { CurrencyProvider } from '../lib/CurrencyContext';
import { TutorialProvider } from '../lib/TutorialContext';
import { SidebarProvider } from '../lib/SidebarContext';
import { trackPageview } from '../lib/siteTracking';

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();

  // First-party visitor analytics (lib/siteTracking.ts): one beacon for the
  // landing page load, then one per client-side route change.
  useEffect(() => {
    trackPageview(window.location.pathname);
    const onRouteDone = (url: string) => trackPageview(url.split('?')[0].split('#')[0]);
    router.events.on('routeChangeComplete', onRouteDone);
    return () => router.events.off('routeChangeComplete', onRouteDone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
    <Head>
      <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
    </Head>
    <ThemeProvider>
      <LanguageProvider>
        <CurrencyProvider>
          <TutorialProvider>
            <SidebarProvider>
              <Component {...pageProps} />
              <Toaster
                position="top-right"
                toastOptions={{
                  style: {
                    background: 'var(--bg-toast, var(--border-subtle))',
                    color: 'var(--text-primary, #E2E8F0)',
                    border: '1px solid var(--border-strong, var(--border-strong))',
                    fontFamily: 'IBM Plex Sans, sans-serif',
                  },
                }}
              />
            </SidebarProvider>
          </TutorialProvider>
        </CurrencyProvider>
      </LanguageProvider>
    </ThemeProvider>
    </>
  );
}
