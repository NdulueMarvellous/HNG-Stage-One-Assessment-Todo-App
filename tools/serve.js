/**
 * Zero-dependency static file server (development only).
 *
 * NOTE: this file intentionally lives in tools/ instead of the repository root.
 * Vercel treats a root-level `server.js` (or `src/server.js`) that calls
 * `listen()` as a Node.js server entrypoint and deploys it as a Function
 * instead of serving the static site — which makes every URL answer
 * `404 — Not found`. Keeping the server here avoids that auto-detection while
 * still giving us a real http:// origin locally, where localStorage behaves
 * identically in every browser.
 *
 * Usage:  node tools/serve.js [port]
 */
'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

// Serve from the repository root, one level above tools/.
const ROOT = path.join(__dirname, '..');
const PORT = Number(process.argv[2] || process.env.PORT || 4173);
const HOST = process.env.HOST || '127.0.0.1';

const TEXT = 'text/plain; charset=utf-8';
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8'
};

function send(response, status, body, headers) {
  response.writeHead(
    status,
    Object.assign({ 'Content-Type': TEXT, 'Cache-Control': 'no-store' }, headers || {})
  );
  response.end(body);
}

/** Map a URL path onto a file inside ROOT, refusing to escape it. */
function resolveFile(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch (error) {
    return null;
  }
  const relative = path.normalize(decoded).replace(/^[\\/]+/, '');
  const target = path.resolve(ROOT, relative);
  const rootWithSeparator = ROOT.endsWith(path.sep) ? ROOT : ROOT + path.sep;
  if (target !== ROOT && !target.startsWith(rootWithSeparator)) return null;
  return target;
}

function serveFile(filePath, response, headOnly) {
  fs.stat(filePath, (statError, stats) => {
    if (!statError && stats.isDirectory()) {
      serveFile(path.join(filePath, 'index.html'), response, headOnly);
      return;
    }
    if (statError || !stats.isFile()) {
      send(response, 404, '404 — Not found');
      return;
    }
    const type = MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    response.writeHead(200, {
      'Content-Type': type,
      'Content-Length': stats.size,
      'Cache-Control': 'no-store'
    });
    if (headOnly) {
      response.end();
      return;
    }
    const stream = fs.createReadStream(filePath);
    stream.on('error', () => send(response, 500, '500 — Could not read the file'));
    stream.pipe(response);
  });
}

const server = http.createServer((request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    send(response, 405, '405 — Method not allowed', { Allow: 'GET, HEAD' });
    return;
  }

  const pathname = new URL(request.url, 'http://localhost').pathname;
  const filePath = resolveFile(pathname === '/' ? '/index.html' : pathname);
  if (!filePath) {
    send(response, 403, '403 — Forbidden');
    return;
  }
  serveFile(filePath, response, request.method === 'HEAD');
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Try: node tools/serve.js ${PORT + 1}`);
  } else {
    console.error(error.message);
  }
  process.exitCode = 1;
});

server.listen(PORT, HOST, () => {
  console.log(`Todo app running at http://${HOST}:${PORT}/  (Ctrl+C to stop)`);
});
