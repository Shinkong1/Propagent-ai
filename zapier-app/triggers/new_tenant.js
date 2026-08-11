const { BASE_URL } = require('../config');

const listTenants = async (z, bundle) => {
  // z.cursor persists a small string between polling runs -- we use it to
  // remember the newest created_at we've already seen, so a poll after a
  // burst of >25 new tenants doesn't silently skip the older ones in that
  // burst (plain "last 25, dedupe by id" would miss them). Best-effort only:
  // confirmed in testing that Zapier's RPC/cursor storage can be unreachable
  // ("RPC request failed after 3 attempts") even in production, so a cursor
  // failure must never take down the whole trigger -- fall back to a plain
  // "last 25" poll instead.
  let since;
  try {
    since = await z.cursor.get();
  } catch (e) {
    since = null;
  }
  const response = await z.request({
    url: `${BASE_URL}/tenants`,
    params: { limit: 25, ...(since ? { since } : {}) },
  });
  const tenants = response.data;
  if (tenants.length > 0) {
    // Backend returns newest-first, so the first item is the new high-water mark.
    try {
      await z.cursor.set(tenants[0].created_at);
    } catch (e) {
      // best-effort -- ignore, next poll just falls back to "last 25" again
    }
  }
  return tenants;
};

module.exports = {
  key: 'new_tenant',
  noun: 'Tenant',
  display: {
    label: 'New Tenant',
    description: 'Triggers when a new tenant is added in PropAgent AI.',
  },
  operation: {
    type: 'polling',
    perform: listTenants,
    sample: {
      id: '22222222-2222-2222-2222-222222222222',
      first_name: 'John',
      last_name: 'Smith',
      email: 'john@example.com',
      phone: '+15559876543',
      is_active: true,
      created_at: '2026-08-01T12:00:00Z',
    },
  },
};
