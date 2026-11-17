'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const localDb = require('./netlify/functions/lib/local-db');

const PORT = Number(process.env.PORT) || 8888;
const ROOT_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon'
};

function loadDotEnv() {
  const envPath = path.join(ROOT_DIR, '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = val;
    }
  }
}

loadDotEnv();

async function handleFunctionRequest(req, res, urlObj) {
  let fnName = urlObj.pathname
    .replace(/^\/\.netlify\/functions\//, '')
    .replace(/^\/api\//, '')
    .split('/')[0];

  const fnPath = path.join(ROOT_DIR, 'netlify', 'functions', `${fnName}.js`);
  if (!fs.existsSync(fnPath)) {
    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'FUNCTION_NOT_FOUND', message: `Fonksiyon bulunamadı: ${fnName}` }));
    return;
  }

  let body = '';
  for await (const chunk of req) {
    body += chunk;
  }

  const queryStringParameters = {};
  urlObj.searchParams.forEach((v, k) => {
    queryStringParameters[k] = v;
  });

  try {
    const mod = require(fnPath);
    const result = await mod.handler({
      httpMethod: req.method,
      headers: req.headers,
      queryStringParameters,
      body: body || null
    });

    res.writeHead(result.statusCode || 200, result.headers || { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(result.body || '');
  } catch (err) {
    const isMissingPkg = err.code === 'MODULE_NOT_FOUND';
    res.writeHead(isMissingPkg ? 503 : 500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      error: isMissingPkg ? 'DEPENDENCIES_NOT_INSTALLED' : 'LOCAL_SERVER_ERROR',
      message: isMissingPkg
        ? 'Sunucu fonksiyonları için "npm install" çalıştırılmalıdır.'
        : (err.message || 'Sunucu hatası')
    }));
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const urlObj = new URL(req.url || '/', `http://localhost:${PORT}`);
    if (urlObj.pathname === '/api/local-db') {
      if (req.method === 'GET') {
        const db = localDb.readDb();
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify(db));
        return;
      }
      if (req.method === 'POST') {
        let body = '';
        for await (const chunk of req) body += chunk;
        const parsed = JSON.parse(body || '{}');
        localDb.writeDb(parsed);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: true }));
        return;
      }
      res.writeHead(405);
      res.end('Method Not Allowed');
      return;
    }
    if (urlObj.pathname.startsWith('/.netlify/functions/') || urlObj.pathname.startsWith('/api/')) {
      await handleFunctionRequest(req, res, urlObj);
      return;
    }

    let relPath = decodeURIComponent(urlObj.pathname);
    if (relPath === '/') relPath = '/login.html';

    const safeTarget = path.normalize(path.join(ROOT_DIR, relPath));
    if (!safeTarget.startsWith(ROOT_DIR)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    if (!fs.existsSync(safeTarget) || fs.statSync(safeTarget).isDirectory()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Sayfa bulunamadı');
      return;
    }

    const ext = path.extname(safeTarget).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    });
    fs.createReadStream(safeTarget).pipe(res);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(err.message || 'Internal Server Error');
  }
});

server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} zaten kullanımda. Sunucu zaten çalışıyor olabilir (http://127.0.0.1:${PORT}).`);
    process.exit(1);
  }
  console.error('Sunucu hatası:', err);
  process.exit(1);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`ProjectVault local server running at http://127.0.0.1:${PORT}`);
});
