const { BASE_URL } = require('./config');

// Custom (API key) auth — the key is generated per-organization in
// PropAgent AI under Settings > API, and sent on every request as the
// X-API-Key header (see index.js's includeApiKey beforeRequest hook).
const test = (z, bundle) =>
  z.request({
    url: `${BASE_URL}/me`,
  });

module.exports = {
  type: 'custom',
  fields: [
    {
      key: 'api_key',
      label: 'API Key',
      required: true,
      type: 'string',
      helpText:
        'Find your API key at https://propagent.app/dashboard/settings under the API tab. Click "Generate Key" if you don\'t have one yet.',
    },
  ],
  test,
  connectionLabel: '{{bundle.inputData.name}}',
};
