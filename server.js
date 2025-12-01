const http = require('http');
const { URL } = require('url');
const { handleCreateListing, handleHealth } = require('./create-listing');

const PORT = process.env.PORT || 3000;

function jsonResponse(res, status, payload) {
  const data = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data),
  });
  res.end(data);
}

function readJsonBody(req) {
  return new Promise((resolve) => {
    let data = '';

    req.on('data', (chunk) => {
      data += chunk;
    });

    req.on('end', () => {
      if (!data) {
        resolve({ ok: true, body: {} });
        return;
      }

      try {
        const parsed = JSON.parse(data);
        resolve({ ok: true, body: parsed });
      } catch (err) {
        resolve({ ok: false, error: 'Invalid JSON body' });
      }
    });

    req.on('error', () => {
      resolve({ ok: false, error: 'Failed to read request body' });
    });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'POST' && url.pathname === '/create-listing') {
    const parsed = await readJsonBody(req);
    if (!parsed.ok) {
      jsonResponse(res, 404, { message: parsed.error });
      return;
    }

    const result = await handleCreateListing(req.headers, parsed.body);
    jsonResponse(res, result.status, result.payload);
    return;
  }

  if (req.method === 'GET' && url.pathname === '/create-listing/health') {
    const result = handleHealth();
    jsonResponse(res, result.status, result.payload);
    return;
  }

  jsonResponse(res, 404, { message: 'Not Found' });
});

server.listen(PORT, () => {
  console.log(`Create-listing service listening on port ${PORT}`);
});
