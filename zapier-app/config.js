// Single place to change the API base URL (e.g. if the backend ever moves
// off Render). Every trigger/create/authentication file imports from here
// rather than hardcoding the URL.
module.exports = {
  BASE_URL: 'https://propagent-api.onrender.com/api/v1',
};
