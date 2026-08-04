const { BASE_URL } = require('../config');

const listLeads = async (z, bundle) => {
  const response = await z.request({
    url: `${BASE_URL}/leads`,
    params: { limit: 25 },
  });
  return response.data;
};

module.exports = {
  key: 'new_lead',
  noun: 'Lead',
  display: {
    label: 'New Lead',
    description: 'Triggers when a new lead is added in PropAgent AI (from lead scraping, the website, or manual entry).',
  },
  operation: {
    type: 'polling',
    perform: listLeads,
    sample: {
      id: '11111111-1111-1111-1111-111111111111',
      first_name: 'Jane',
      last_name: 'Doe',
      company: null,
      email: 'jane@example.com',
      phone: '+15551234567',
      source: 'website',
      status: 'new',
      score: 42,
      created_at: '2026-08-01T12:00:00Z',
    },
  },
};
