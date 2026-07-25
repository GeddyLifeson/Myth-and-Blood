#!/usr/bin/env node
/**
 * Static server for dist/ with precompressed .br / .gz negotiation.
 * Usage: node scripts/serve-dist.mjs [port]
 */
import { createServer } from 'http';
import { readFileSync, existsSync, statSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const PORT = parseInt(process.argv[2] || '8765', 10);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.br': 'application/octet-stream',
  '.gz': 'application/gzip',
};

function safePath(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0]).replace(/\\/g, '/');
  const rel = clean.startsWith('/') ? clean.slice(1) : clean;
  const full = join(ROOT, rel);
  if (!full.startsWith(ROOT)) return null;
  return full;
}

function pickEncoding(req, filePath) {
  const accept = String(req.headers['accept-encoding'] || '');
  if (accept.includes('br') && existsSync(`${filePath}.br`)) {
    return { path: `${filePath}.br`, encoding: 'br' };
  }
  if (accept.includes('gzip') && existsSync(`${filePath}.gz`)) {
    return { path: `${filePath}.gz`, encoding: 'gzip' };
  }
  return { path: filePath, encoding: null };
}

const server = createServer((req, res) => {
  let filePath = safePath(req.url === '/' ? '/index.html' : req.url);
  if (!filePath || !existsSync(filePath)) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  if (statSync(filePath).isDirectory()) filePath = join(filePath, 'index.html');

  const ext = extname(filePath.replace(/\.(br|gz)$/, ''));
  const chosen = pickEncoding(req, filePath);
  const body = readFileSync(chosen.path);
  const headers = {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Content-Length': body.length,
    'Cache-Control': 'public, max-age=3600',
  };
  if (chosen.encoding) headers['Content-Encoding'] = chosen.encoding;
  res.writeHead(200, headers);
  res.end(body);
});

server.listen(PORT, () => {
  console.log(`Serving ${ROOT} at http://localhost:${PORT} (br/gzip enabled)`);
});