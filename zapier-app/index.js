const authentication = require('./authentication');

const newLeadTrigger = require('./triggers/new_lead');
const newTenantTrigger = require('./triggers/new_tenant');
const newMaintenanceTicketTrigger = require('./triggers/new_maintenance_ticket');
const propertyListTrigger = require('./triggers/property_list');

const createTenant = require('./creates/create_tenant');
const createMaintenanceTicket = require('./creates/create_maintenance_ticket');
const createLead = require('./creates/create_lead');

// Every outbound request gets the org's API key attached automatically, so
// individual trigger/create files never have to repeat auth headers.
const includeApiKey = (request, z, bundle) => {
  if (bundle.authData && bundle.authData.api_key) {
    request.headers = request.headers || {};
    request.headers['X-API-Key'] = bundle.authData.api_key;
  }
  return request;
};

// Turn non-2xx responses into real errors with the backend's own message,
// instead of Zapier silently treating a 401/402/422 body as trigger data.
const checkForErrors = (response, z, bundle) => {
  if (response.status === 401) {
    throw new z.errors.Error(
      'Invalid or missing API key. Regenerate it in PropAgent AI under Settings > API.',
      'AuthenticationError',
      response.status
    );
  }
  if (response.status === 402) {
    throw new z.errors.Error(
      "This PropAgent AI organization's trial has ended or its subscription is inactive.",
      'PaymentRequiredError',
      response.status
    );
  }
  if (response.status >= 400) {
    const detail = (response.json && response.json.detail) || response.content;
    throw new z.errors.Error(
      `PropAgent AI API error (${response.status}): ${JSON.stringify(detail)}`,
      'RequestError',
      response.status
    );
  }
  return response;
};

module.exports = {
  version: require('./package.json').version,
  platformVersion: require('zapier-platform-core').version,

  authentication,

  beforeRequest: [includeApiKey],
  afterResponse: [checkForErrors],

  // Applies to every trigger/create instead of setting cleanInputData: false
  // on each one individually — keeps input data predictable/unmodified.
  flags: { cleanInputData: false },

  triggers: {
    [newLeadTrigger.key]: newLeadTrigger,
    [newTenantTrigger.key]: newTenantTrigger,
    [newMaintenanceTicketTrigger.key]: newMaintenanceTicketTrigger,
    [propertyListTrigger.key]: propertyListTrigger,
  },

  creates: {
    [createTenant.key]: createTenant,
    [createMaintenanceTicket.key]: createMaintenanceTicket,
    [createLead.key]: createLead,
  },

  searches: {},
  resources: {},
};
