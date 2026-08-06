import { GetServerSideProps } from 'next';

const SITE_URL = 'https://propagent.app';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const STATIC_ROUTES: { path: string; changefreq: string; priority: string }[] = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/pricing', changefreq: 'monthly', priority: '0.8' },
  { path: '/signup', changefreq: 'monthly', priority: '0.8' },
  { path: '/listings', changefreq: 'daily', priority: '0.9' },
  { path: '/terms', changefreq: 'yearly', priority: '0.3' },
  { path: '/privacy', changefreq: 'yearly', priority: '0.3' },
];

function urlTag(loc: string, changefreq: string, priority: string) {
  return `  <url>\n    <loc>${loc}</loc>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
}

function generateSiteMap(listingIds: string[]) {
  const staticTags = STATIC_ROUTES.map(r => urlTag(`${SITE_URL}${r.path}`, r.changefreq, r.priority));
  const listingTags = listingIds.map(id => urlTag(`${SITE_URL}/listings/${id}`, 'daily', '0.7'));
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...staticTags, ...listingTags].join('\n')}\n</urlset>`;
}

// No component body — this route only ever returns raw XML via getServerSideProps below.
export default function SiteMap() {
  return null;
}

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  let listingIds: string[] = [];
  try {
    const r = await fetch(`${API_URL}/public/listings`);
    if (r.ok) {
      const data = await r.json();
      listingIds = (data || []).map((l: any) => l.id);
    }
  } catch {
    // If the backend is briefly unreachable, still serve the static routes rather than a 500.
  }

  const xml = generateSiteMap(listingIds);
  res.setHeader('Content-Type', 'text/xml');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate');
  res.write(xml);
  res.end();

  return { props: {} };
};
