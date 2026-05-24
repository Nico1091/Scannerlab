const http = require('http');
const fs = require('fs');
const path = require('path');
const { obtenerDatos } = require('./escaneo');

const PORT = 3000;

const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === '/api/scan') {
    try {
      const datos = await obtenerDatos();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, data: datos }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: err.message }));
    }
    return;
  }

  // SPA catch-all -> index.html
  const filePath = req.url === '/' || !path.extname(req.url)
    ? path.join(__dirname, 'index.html')
    : path.join(__dirname, req.url);

  const ext = path.extname(filePath);
  const contentType = MIME[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT' && req.url !== '/') {
        // fallback a index.html para SPA
        fs.readFile(path.join(__dirname, 'index.html'), (e2, html) => {
          if (e2) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not found');
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(html);
          }
        });
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Server error');
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n========================================`);
  console.log(`  WiFi Analyzer AI - Servidor Online`);
  console.log(`========================================`);
  console.log(`  Abre tu navegador en:`);
  console.log(`  http://localhost:${PORT}`);
  console.log(`========================================\n`);
});
