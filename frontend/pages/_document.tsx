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
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
