// Servidor estático para probar el juego en la PC, sin dependencias ni caché.
//
//   node tools/serve.mjs            → http://127.0.0.1:5173/
//   node tools/serve.mjs 8080       → otro puerto
//   node tools/serve.mjs --lan      → también desde el celular en la misma red Wi-Fi
//
// En localhost el service worker no se registra (ver src/main.js), así que cada recarga trae lo último.
import http from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { networkInterfaces } from 'node:os';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const port = Number(args.find(a => /^\d+$/.test(a))) || 5173;
const lan = args.includes('--lan');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.md': 'text/plain; charset=utf-8',
};

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const f = join(ROOT, p);
  if (!f.startsWith(ROOT) || p.includes('/tools/node_modules/') || !existsSync(f) || statSync(f).isDirectory()) {
    res.writeHead(404); res.end('404'); return;
  }
  res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  res.end(readFileSync(f));
});

server.listen(port, lan ? '0.0.0.0' : '127.0.0.1', () => {
  console.log(`Pixelia en http://127.0.0.1:${port}/`);
  if (lan) for (const list of Object.values(networkInterfaces())) for (const n of list || [])
    if (n.family === 'IPv4' && !n.internal) console.log(`  desde el celu: http://${n.address}:${port}/`);
});
