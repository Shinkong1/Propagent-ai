import type { AppProps } from 'next/app';
import Head from 'next/head';
import '../styles/globals.css';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from '../lib/ThemeContext';
import { LanguageProvider } from '../lib/LanguageContext';
import { CurrencyProvider } from '../lib/CurrencyContext';
import { TutorialProvider } from '../lib/TutorialContext';
import { SidebarProvider } from '../lib/SidebarContext';

export default function App({ Component, pageProps }: AppProps) {
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
