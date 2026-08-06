import { GetServerSideProps } from 'next';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Root-level catch-all -- ONLY reached for paths that don't match any other
// page (Next.js always prefers a static route like /login over this one).
// Exists so site-verification files (Google Search Console, Bing Webmaster,
// etc.) added via Owner Admin can be served at the domain root without a
// code deploy. Anything that isn't a known verification file falls through
// to a real 404, same as before this page existed.
export default function VerificationFilePassthrough() {
  return null;
}

export const getServerSideProps: GetServerSideProps = async ({ params, res }) => {
  const filename = params?.verificationFile;
  if (typeof filename !== 'string') return { notFound: true };

  try {
    const r = await fetch(`${API_URL}/public/verification/${encodeURIComponent(filename)}`);
    if (!r.ok) return { notFound: true };
    const content = await r.text();
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.write(content);
    res.end();
    return { props: {} };
  } catch {
    return { notFound: true };
  }
};
