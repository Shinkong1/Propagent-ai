const { BASE_URL } = require('../config');

const listTenants = async (z, bundle) => {
  const response = await z.request({
    url: `${BASE_URL}/tenants`,
    params: { limit: 25 },
  });
  return response.data;
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
