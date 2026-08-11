import { Html, Head, Main, NextScript } from 'next/document';

const THEME_INIT_SCRIPT = `
(function() {
  try {
    var theme = localStorage.getItem('propagent_theme');
    if (theme !== 'dark' && theme !== 'light') {
      var user = JSON.parse(localStorage.getItem('user') || 'null');
      theme = (user && user.theme) || 'dark';
    }
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();
`;

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="icon" href="/icon-192.png" />
        {/* preconnect lets the browser open the connection to both Google
            Fonts hosts before it even knows it needs them; the stylesheet
            <link> (vs. a CSS @import) lets font fetching start immediately
            in parallel with everything else, instead of waiting for
            globals.css to be fetched and parsed first. Fixes the "PropAgent"
            wordmark rendering in a fallback font for a beat on slower mobile
            connections. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=IBM+Plex+Sans:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap"
        />
        <meta name="theme-color" content="#FBC02D" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="PropAgent" />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
