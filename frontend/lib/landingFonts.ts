import { IBM_Plex_Sans, IBM_Plex_Sans_Condensed, IBM_Plex_Mono } from 'next/font/google';

// Loaded via next/font/google (self-hosted at build time, no runtime
// Google Fonts request) and scoped to just the landing page -- the rest of
// the site already loads IBM Plex Sans/Mono site-wide via a <link> tag in
// pages/_document.tsx, which is untouched. IBM Plex Sans Condensed is new;
// it wasn't loaded anywhere else before this page needed it.
export const plexSans = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-plex-sans', display: 'swap' });
export const plexCondensed = IBM_Plex_Sans_Condensed({ subsets: ['latin'], weight: ['600', '700'], variable: '--font-plex-condensed', display: 'swap' });
export const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-plex-mono', display: 'swap' });

export const landingFontVars = `${plexSans.variable} ${plexCondensed.variable} ${plexMono.variable}`;
