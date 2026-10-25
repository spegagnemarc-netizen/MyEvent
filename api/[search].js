const accommodation = require('../server/search-accommodation');
const transport = require('../server/search-transport');
const ticketmaster = require('../server/search-ticketmaster');

// Vercel's dynamic file route keeps both public URLs in one function.
// Dispatch only by pathname: query parameters cannot select another handler.
module.exports = function handler(req, res) {
  const pathname = String(req.url || '').split('?')[0];
  if (pathname === '/api/sorties-api-audit') {
    // Load only for this exact path; the audit applies its own fail-closed guards.
    return require('../server/sorties-api-audit').createHandler()(req, res);
  }
  if (pathname === '/api/account-deletion') {
    return import('../server/account-deletion-request.mjs').then(module => module.default(req, res));
  }
  if (pathname === '/api/search-ticketmaster' || pathname === '/api/search-ticketmaster.js') {
    return ticketmaster(req, res);
  }
  if (pathname === '/api/search-accommodation' || pathname === '/api/search-accommodation.js') {
    return accommodation(req, res);
  }
  if (pathname === '/api/search-transport' || pathname === '/api/search-transport.js') {
    return transport(req, res);
  }
  return res.status(404).json({ error: 'Not found' });
};
