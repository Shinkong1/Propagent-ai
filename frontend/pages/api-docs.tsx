import Head from 'next/head';
import Link from 'next/link';
import { Zap, KeyRound, Globe, AlertTriangle, Terminal } from 'lucide-react';
import PublicFooter from '../components/PublicFooter';

const BASE_URL = 'https://propagent-api.onrender.com/api/v1';

type Field = { name: string; type: string; note?: string };

type Endpoint = {
  method: 'GET' | 'POST';
  path: string;
  summary: string;
  query?: Field[];
  body?: Field[];
  responseFields: Field[];
  responseIsArray?: boolean;
  curl: string;
  exampleResponse: string;
};

const ENDPOINTS: Endpoint[] = [
  {
    method: 'GET',
    path: '/me',
    summary: "Verify an API key and return the organization it belongs to. Useful as a connection test.",
    responseFields: [
      { name: 'id', type: 'UUID' },
      { name: 'name', type: 'string' },
    ],
    curl: `curl ${BASE_URL}/me \\\n  -H "X-API-Key: pa_live_..."`,
    exampleResponse: `{\n  "id": "b3f1e2a0-6c1a-4e9d-9a3f-2d6e7c1a9b44",\n  "name": "Sunrise Property Group"\n}`,
  },
  {
    method: 'GET',
    path: '/properties',
    summary: 'List all properties in your organization, ordered by name. Read-only.',
    responseIsArray: true,
    responseFields: [
      { name: 'id', type: 'UUID' },
      { name: 'name', type: 'string' },
      { name: 'address', type: 'string' },
      { name: 'city', type: 'string' },
      { name: 'state', type: 'string' },
      { name: 'total_units', type: 'integer' },
    ],
    curl: `curl ${BASE_URL}/properties \\\n  -H "X-API-Key: pa_live_..."`,
    exampleResponse: `[\n  {\n    "id": "d4a2f6e1-...",\n    "name": "Maple Court Apartments",\n    "address": "120 Maple St",\n    "city": "Austin",\n    "state": "TX",\n    "total_units": 24\n  }\n]`,
  },
  {
    method: 'GET',
    path: '/tenants',
    summary: 'List tenants in your organization, newest first.',
    query: [
      { name: 'since', type: 'ISO 8601 datetime', note: 'optional — only tenants created after this timestamp' },
      { name: 'limit', type: 'integer', note: 'optional, default 25, max 100' },
    ],
    responseIsArray: true,
    responseFields: [
      { name: 'id', type: 'UUID' },
      { name: 'first_name', type: 'string' },
      { name: 'last_name', type: 'string' },
      { name: 'email', type: 'string | null' },
      { name: 'phone', type: 'string | null' },
      { name: 'is_active', type: 'boolean' },
      { name: 'created_at', type: 'ISO 8601 datetime' },
    ],
    curl: `curl "${BASE_URL}/tenants?since=2026-08-01T00:00:00Z&limit=25" \\\n  -H "X-API-Key: pa_live_..."`,
    exampleResponse: `[\n  {\n    "id": "8a1c...",\n    "first_name": "Maria",\n    "last_name": "Gomez",\n    "email": "maria@example.com",\n    "phone": "+15125550100",\n    "is_active": true,\n    "created_at": "2026-08-05T14:22:01Z"\n  }\n]`,
  },
  {
    method: 'POST',
    path: '/tenants',
    summary: 'Create a tenant in your organization.',
    body: [
      { name: 'first_name', type: 'string', note: 'required' },
      { name: 'last_name', type: 'string', note: 'required' },
      { name: 'email', type: 'string | null', note: 'optional' },
      { name: 'phone', type: 'string | null', note: 'optional' },
    ],
    responseFields: [
      { name: 'id', type: 'UUID' },
      { name: 'first_name', type: 'string' },
      { name: 'last_name', type: 'string' },
      { name: 'email', type: 'string | null' },
      { name: 'phone', type: 'string | null' },
      { name: 'is_active', type: 'boolean' },
      { name: 'created_at', type: 'ISO 8601 datetime' },
    ],
    curl: `curl -X POST ${BASE_URL}/tenants \\\n  -H "X-API-Key: pa_live_..." \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "first_name": "Maria",\n    "last_name": "Gomez",\n    "email": "maria@example.com",\n    "phone": "+15125550100"\n  }'`,
    exampleResponse: `{\n  "id": "8a1c...",\n  "first_name": "Maria",\n  "last_name": "Gomez",\n  "email": "maria@example.com",\n  "phone": "+15125550100",\n  "is_active": true,\n  "created_at": "2026-08-07T18:04:12Z"\n}`,
  },
  {
    method: 'GET',
    path: '/maintenance',
    summary: 'List maintenance tickets across all your properties, newest first.',
    query: [
      { name: 'since', type: 'ISO 8601 datetime', note: 'optional' },
      { name: 'limit', type: 'integer', note: 'optional, default 25, max 100' },
    ],
    responseIsArray: true,
    responseFields: [
      { name: 'id', type: 'UUID' },
      { name: 'property_id', type: 'UUID' },
      { name: 'title', type: 'string' },
      { name: 'description', type: 'string' },
      { name: 'category', type: 'string', note: 'plumbing, electrical, hvac, appliance, structural, pest_control, cleaning, landscaping, other' },
      { name: 'priority', type: 'string', note: 'low, medium, high, emergency' },
      { name: 'status', type: 'string', note: 'open, in_progress, waiting_vendor, scheduled, completed, cancelled' },
      { name: 'created_at', type: 'ISO 8601 datetime' },
    ],
    curl: `curl "${BASE_URL}/maintenance?limit=10" \\\n  -H "X-API-Key: pa_live_..."`,
    exampleResponse: `[\n  {\n    "id": "f0e9...",\n    "property_id": "d4a2f6e1-...",\n    "title": "Leaking kitchen faucet",\n    "description": "Tenant reports steady drip under the sink.",\n    "category": "plumbing",\n    "priority": "medium",\n    "status": "open",\n    "created_at": "2026-08-06T09:11:40Z"\n  }\n]`,
  },
  {
    method: 'POST',
    path: '/maintenance',
    summary: 'Create a maintenance ticket for one of your properties. Status is always set to open on creation.',
    body: [
      { name: 'property_id', type: 'UUID', note: 'required — must belong to your organization' },
      { name: 'title', type: 'string', note: 'required' },
      { name: 'description', type: 'string', note: 'required' },
      { name: 'category', type: 'string', note: 'optional, default "other" — see valid values above' },
      { name: 'priority', type: 'string', note: 'optional, default "medium" — low, medium, high, emergency' },
    ],
    responseFields: [
      { name: 'id', type: 'UUID' },
      { name: 'property_id', type: 'UUID' },
      { name: 'title', type: 'string' },
      { name: 'description', type: 'string' },
      { name: 'category', type: 'string' },
      { name: 'priority', type: 'string' },
      { name: 'status', type: 'string' },
      { name: 'created_at', type: 'ISO 8601 datetime' },
    ],
    curl: `curl -X POST ${BASE_URL}/maintenance \\\n  -H "X-API-Key: pa_live_..." \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "property_id": "d4a2f6e1-...",\n    "title": "Leaking kitchen faucet",\n    "description": "Tenant reports steady drip under the sink.",\n    "category": "plumbing",\n    "priority": "medium"\n  }'`,
    exampleResponse: `{\n  "id": "f0e9...",\n  "property_id": "d4a2f6e1-...",\n  "title": "Leaking kitchen faucet",\n  "description": "Tenant reports steady drip under the sink.",\n  "category": "plumbing",\n  "priority": "medium",\n  "status": "open",\n  "created_at": "2026-08-07T18:07:55Z"\n}`,
  },
  {
    method: 'GET',
    path: '/leads',
    summary: 'List leads in your organization, newest first.',
    query: [
      { name: 'since', type: 'ISO 8601 datetime', note: 'optional' },
      { name: 'limit', type: 'integer', note: 'optional, default 25, max 100' },
    ],
    responseIsArray: true,
    responseFields: [
      { name: 'id', type: 'UUID' },
      { name: 'first_name', type: 'string | null' },
      { name: 'last_name', type: 'string | null' },
      { name: 'company', type: 'string | null' },
      { name: 'email', type: 'string | null' },
      { name: 'phone', type: 'string | null' },
      { name: 'source', type: 'string', note: 'google_maps, linkedin, zillow, referral, website, cold_outreach, manual' },
      { name: 'status', type: 'string', note: 'new, contacted, interested, demo_scheduled, negotiating, closed_won, closed_lost' },
      { name: 'score', type: 'integer' },
      { name: 'created_at', type: 'ISO 8601 datetime' },
    ],
    curl: `curl "${BASE_URL}/leads?limit=25" \\\n  -H "X-API-Key: pa_live_..."`,
    exampleResponse: `[\n  {\n    "id": "3c7b...",\n    "first_name": "Alex",\n    "last_name": "Chen",\n    "company": "Chen Holdings",\n    "email": "alex@chenholdings.com",\n    "phone": "+15125550101",\n    "source": "website",\n    "status": "new",\n    "score": 62,\n    "created_at": "2026-08-07T11:30:00Z"\n  }\n]`,
  },
  {
    method: 'POST',
    path: '/leads',
    summary: 'Create a lead in your organization. Status is always set to new on creation — useful for piping in leads from a landing page, ad platform, or Zapier/Make.',
    body: [
      { name: 'first_name', type: 'string | null', note: 'optional' },
      { name: 'last_name', type: 'string | null', note: 'optional' },
      { name: 'company', type: 'string | null', note: 'optional' },
      { name: 'email', type: 'string | null', note: 'optional' },
      { name: 'phone', type: 'string | null', note: 'optional' },
      { name: 'source', type: 'string', note: 'optional, default "manual" — see valid values above' },
    ],
    responseFields: [
      { name: 'id', type: 'UUID' },
      { name: 'first_name', type: 'string | null' },
      { name: 'last_name', type: 'string | null' },
      { name: 'company', type: 'string | null' },
      { name: 'email', type: 'string | null' },
      { name: 'phone', type: 'string | null' },
      { name: 'source', type: 'string' },
      { name: 'status', type: 'string' },
      { name: 'score', type: 'integer' },
      { name: 'created_at', type: 'ISO 8601 datetime' },
    ],
    curl: `curl -X POST ${BASE_URL}/leads \\\n  -H "X-API-Key: pa_live_..." \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "first_name": "Alex",\n    "last_name": "Chen",\n    "email": "alex@chenholdings.com",\n    "source": "website"\n  }'`,
    exampleResponse: `{\n  "id": "3c7b...",\n  "first_name": "Alex",\n  "last_name": "Chen",\n  "company": null,\n  "email": "alex@chenholdings.com",\n  "phone": null,\n  "source": "website",\n  "status": "new",\n  "score": 0,\n  "created_at": "2026-08-07T18:12:03Z"\n}`,
  },
];

export default function ApiDocs() {
  return (
    <>
      <Head>
        <title>API Docs — PropAgent AI</title>
        <meta name="description" content="Developer documentation for the PropAgent AI public REST API — authentication, endpoints, and example requests." />
      </Head>
      <div style={{ minHeight: '100vh', background: 'var(--bg-app)', color: '#E2E8F0' }}>
        <nav style={{ display: 'flex', alignItems: 'center', padding: '20px 48px', borderBottom: '1px solid var(--border-subtle)' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #FBC02D, #F57F17)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={16} color="var(--bg-app)" strokeWidth={2.5} />
            </div>
            <span style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 18, color: 'var(--text-primary)' }}>PropAgent AI</span>
          </Link>
        </nav>

        <div style={{ maxWidth: 900, margin: '0 auto', padding: '48px 24px 80px' }}>
          <h1 style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 36, color: 'var(--text-primary)', marginBottom: 10 }}>API Documentation</h1>
          <p style={{ fontSize: 15, lineHeight: 1.75, color: 'var(--text-secondary)', marginBottom: 20, maxWidth: 680 }}>
            The PropAgent AI public REST API lets you read and write core records — properties, tenants,
            maintenance tickets, and leads — from your own scripts or from tools like Zapier and Make. This is
            the same API our official{' '}
            <a href="https://github.com/Shinkong1/Propagent-ai/tree/main/zapier-app" target="_blank" rel="noopener noreferrer" style={{ color: '#FBC02D' }}>Zapier integration</a>{' '}
            is built on.
          </p>

          <div style={{ display: 'flex', gap: 12, background: 'rgba(251,192,45,0.08)', border: '1px solid rgba(251,192,45,0.25)', borderRadius: 12, padding: '16px 18px', marginBottom: 40, maxWidth: 680 }}>
            <KeyRound size={20} color="#FBC02D" style={{ flexShrink: 0, marginTop: 2 }} />
            <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
              This is an Enterprise-plan feature. Get your API key from your dashboard at{' '}
              <Link href="/dashboard/settings" style={{ color: '#FBC02D' }}>Settings → API Key</Link>{' '}
              — generate one if you don&apos;t have one yet, and reveal or copy it from there any time. If you&apos;re
              not on Enterprise, see <Link href="/pricing" style={{ color: '#FBC02D' }}>Pricing</Link>.
            </p>
          </div>

          <Section icon={Globe} title="Base URL">
            <CodeBlock>{BASE_URL}</CodeBlock>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 12, lineHeight: 1.7 }}>
              Every endpoint below is relative to this base URL. All requests and responses use JSON.
            </p>
          </Section>

          <Section icon={KeyRound} title="Authentication">
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.7 }}>
              Send your organization&apos;s API key on every request in an <code style={inlineCode}>X-API-Key</code> header.
              There is no OAuth flow and no separate bearer token — the key itself is the credential, scoped to your
              organization the same way a logged-in dashboard user is.
            </p>
            <CodeBlock>{`X-API-Key: pa_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`}</CodeBlock>
            <ul style={{ ...list, marginTop: 14 }}>
              <li style={li}>Missing the header returns <code style={inlineCode}>401 Unauthorized</code> with <code style={inlineCode}>{`{"detail": "Missing X-API-Key header"}`}</code>.</li>
              <li style={li}>An invalid key returns <code style={inlineCode}>401 Unauthorized</code> with <code style={inlineCode}>{`{"detail": "Invalid API key"}`}</code>.</li>
              <li style={li}>A key belonging to an org whose trial has ended or subscription has lapsed returns <code style={inlineCode}>402 Payment Required</code>.</li>
              <li style={li}>Regenerating your key from Settings immediately invalidates the old one — update it everywhere you use it (including any Zapier/Make connection).</li>
            </ul>
          </Section>

          <Section icon={AlertTriangle} title="Notes &amp; limits">
            <ul style={list}>
              <li style={li}>Every record is scoped to your organization — there is no way to read or write another organization&apos;s data with your key.</li>
              <li style={li}><code style={inlineCode}>GET</code> list endpoints (<code style={inlineCode}>/tenants</code>, <code style={inlineCode}>/maintenance</code>, <code style={inlineCode}>/leads</code>) support <code style={inlineCode}>since</code> (ISO 8601 timestamp) and <code style={inlineCode}>limit</code> (default 25, max 100) query params for polling-style integrations.</li>
              <li style={li}>Invalid enum values (e.g. an unrecognized <code style={inlineCode}>category</code>, <code style={inlineCode}>priority</code>, or <code style={inlineCode}>source</code>) return <code style={inlineCode}>422 Unprocessable Entity</code> listing the valid options.</li>
              <li style={li}>There is currently no published per-key rate limit on these endpoints beyond normal fair use — if you&apos;re building a high-frequency integration, please keep polling intervals reasonable (e.g. once a minute or slower) and reach out via <Link href="/contact" style={{ color: '#FBC02D' }}>Contact</Link> if you need something higher-throughput.</li>
            </ul>
          </Section>

          <Section icon={Terminal} title="Endpoints">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {ENDPOINTS.map(ep => (
                <EndpointCard key={`${ep.method}-${ep.path}`} ep={ep} />
              ))}
            </div>
          </Section>

          <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text-muted)', marginTop: 40 }}>
            Questions or need a higher-volume integration? Reach us via{' '}
            <Link href="/contact" style={{ color: '#FBC02D' }}>Contact</Link>, or see our{' '}
            <Link href="/security" style={{ color: '#FBC02D' }}>Security &amp; Data Handling</Link> page for how
            organization data is isolated.
          </p>
        </div>
        <PublicFooter />
      </div>
    </>
  );
}

function Section({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 36 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(251,192,45,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={16} color="#FBC02D" strokeWidth={2.25} />
        </div>
        <h2 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 20, color: 'var(--text-primary)' }}>{title}</h2>
      </div>
      {children}
    </div>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre style={{
      background: 'var(--bg-app)', border: '1px solid var(--border-strong)', borderRadius: 10,
      padding: '14px 16px', overflowX: 'auto', margin: 0,
      fontFamily: 'IBM Plex Mono', fontSize: 12.5, lineHeight: 1.6, color: '#E2E8F0',
    }}>
      <code>{children}</code>
    </pre>
  );
}

function EndpointCard({ ep }: { ep: Endpoint }) {
  const methodColor = ep.method === 'GET' ? '#22C55E' : '#FBC02D';
  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 14, padding: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
        <span style={{
          fontFamily: 'IBM Plex Mono', fontSize: 11, fontWeight: 700, color: methodColor,
          border: `1px solid ${methodColor}`, borderRadius: 6, padding: '2px 8px', letterSpacing: '0.5px',
        }}>{ep.method}</span>
        <code style={{ fontFamily: 'IBM Plex Mono', fontSize: 14, color: 'var(--text-primary)' }}>{ep.path}</code>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 16 }}>{ep.summary}</p>

      {ep.query && (
        <FieldTable label="Query parameters" fields={ep.query} />
      )}
      {ep.body && (
        <FieldTable label="Request body (JSON)" fields={ep.body} />
      )}

      <div style={{ marginTop: 14, marginBottom: 6, fontSize: 11, fontFamily: 'IBM Plex Mono', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Example request</div>
      <CodeBlock>{ep.curl}</CodeBlock>

      <div style={{ marginTop: 14, marginBottom: 6, fontSize: 11, fontFamily: 'IBM Plex Mono', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        Example response{ep.responseIsArray ? ' (array)' : ''}
      </div>
      <CodeBlock>{ep.exampleResponse}</CodeBlock>

      <FieldTable label="Response fields" fields={ep.responseFields} collapsedTop />
    </div>
  );
}

function FieldTable({ label, fields, collapsedTop }: { label: string; fields: Field[]; collapsedTop?: boolean }) {
  return (
    <div style={{ marginTop: collapsedTop ? 14 : 0, marginBottom: collapsedTop ? 0 : 14 }}>
      <div style={{ marginBottom: 6, fontSize: 11, fontFamily: 'IBM Plex Mono', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
      <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 8, overflow: 'hidden' }}>
        {fields.map((f, i) => (
          <div key={f.name} style={{
            display: 'flex', gap: 12, padding: '8px 12px', fontSize: 12.5,
            borderTop: i === 0 ? 'none' : '1px solid var(--border-subtle)',
            fontFamily: 'IBM Plex Mono',
          }}>
            <span style={{ color: '#FBC02D', minWidth: 130 }}>{f.name}</span>
            <span style={{ color: 'var(--text-muted)', minWidth: 100 }}>{f.type}</span>
            {f.note && <span style={{ color: 'var(--text-secondary)', fontFamily: 'IBM Plex Sans' }}>{f.note}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

const inlineCode: React.CSSProperties = {
  fontFamily: 'IBM Plex Mono', fontSize: '0.9em', background: 'var(--bg-app)',
  border: '1px solid var(--border-subtle)', borderRadius: 4, padding: '1px 6px',
};
const list: React.CSSProperties = { listStyle: 'disc', margin: 0, padding: '0 0 0 18px', display: 'flex', flexDirection: 'column', gap: 10 };
const li: React.CSSProperties = { fontSize: 13, lineHeight: 1.65, color: 'var(--text-secondary)' };
