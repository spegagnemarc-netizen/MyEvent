const accommodation = require('../server/search-accommodation');
const transport = require('../server/search-transport');

// Vercel's dynamic file route keeps both public URLs in one function.
// Dispatch only by pathname: query parameters cannot select another handler.
module.exports = function handler(req, res) {
  const pathname = String(req.url || '').split('?')[0];
  if (pathname === '/api/search-accommodation' || pathname === '/api/search-accommodation.js') {
    return accommodation(req, res);
  }
  if (pathname === '/api/search-transport' || pathname === '/api/search-transport.js') {
    return transport(req, res);
  }
  return res.status(404).json({ error: 'Not found' });
};
