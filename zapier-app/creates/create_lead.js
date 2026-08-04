const { BASE_URL } = require('../config');

const createLead = async (z, bundle) => {
  const response = await z.request({
    method: 'POST',
    url: `${BASE_URL}/leads`,
    body: {
      first_name: bundle.inputData.first_name,
      last_name: bundle.inputData.last_name,
      company: bundle.inputData.company,
      email: bundle.inputData.email,
      phone: bundle.inputData.phone,
      source: bundle.inputData.source || 'manual',
    },
  });
  return response.data;
};

module.exports = {
  key: 'create_lead',
  noun: 'Lead',
  display: {
    label: 'Create Lead',
    description: 'Creates a new lead in PropAgent AI — useful for piping in leads from a web form, another CRM, or an ad platform.',
  },
  operation: {
    inputFields: [
      { key: 'first_name', label: 'First Name', required: false, type: 'string' },
      { key: 'last_name', label: 'Last Name', required: false, type: 'string' },
      { key: 'company', label: 'Company', required: false, type: 'string' },
      { key: 'email', label: 'Email', required: false, type: 'string' },
      { key: 'phone', label: 'Phone', required: false, type: 'string' },
      {
        key: 'source',
        label: 'Source',
        required: false,
        type: 'string',
        choices: ['google_maps', 'linkedin', 'zillow', 'referral', 'website', 'cold_outreach', 'manual'],
        default: 'manual',
      },
    ],
    perform: createLead,
    sample: {
      id: '11111111-1111-1111-1111-111111111111',
      first_name: 'Jane',
      last_name: 'Doe',
      company: null,
      email: 'jane@example.com',
      phone: '+15551234567',
      source: 'website',
      status: 'new',
      score: 0,
      created_at: '2026-08-01T12:00:00Z',
    },
  },
};
