const http = require('http');
const fs = require('fs');
const path = require('path');
const { obtenerDatos, obtenerDispositivos, obtenerInfoDetalladaDispositivo, lookupOUI, pingLive, obtenerWiFiLive } = require('./escaneo');

// Manejo de errores no capturados para evitar crash del servidor
process.on('uncaughtException', (err) => {
  console.error('[ERROR NO CAPTURADO]', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[PROMESA RECHAZADA]', reason);
});

let PORT = 3001;

// Cache del ultimo escaneo de dispositivos (para pasar MAC al endpoint de detalle)
let lastDeviceCache = {};

// Cache de velocidad de internet (30 segundos)
let speedCache = { mbps: null, timestamp: 0, testing: false };

async function measureInternetSpeed() {
  const now = Date.now();
  if (speedCache.mbps !== null && (now - speedCache.timestamp) < 30000) {
    return { ok: true, mbps: speedCache.mbps, cached: true };
  }
  if (speedCache.testing) {
    while (speedCache.testing) { await new Promise(r => setTimeout(r, 200)); }
    return { ok: speedCache.mbps !== null, mbps: speedCache.mbps, cached: true };
  }
  speedCache.testing = true;
  try {
    const https = require('https');
    const result = await new Promise((resolve) => {
      const start = Date.now();
      const req = https.get('https://speed.cloudflare.com/__down?bytes=200000', { timeout: 10000 }, (res) => {
        let bytes = 0;
        res.on('data', chunk => { bytes += chunk.length; });
        res.on('end', () => {
          const elapsedSec = (Date.now() - start) / 1000;
          if (elapsedSec < 0.1) { resolve(null); return; }
          const mbps = ((bytes * 8) / elapsedSec) / 1_000_000;
          resolve(mbps);
        });
      });
      req.on('error', () => resolve(null));
      req.on('timeout', () => { req.destroy(); resolve(null); });
    });
    if (result !== null) {
      speedCache.mbps = Math.round(result * 10) / 10;
      speedCache.timestamp = Date.now();
      console.log('[SpeedTest] ' + speedCache.mbps + ' Mbps');
      return { ok: true, mbps: speedCache.mbps };
    }
    return { ok: false, mbps: null, error: 'Sin conexion a internet o timeout' };
  } finally {
    speedCache.testing = false;
  }
}

const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

function startServer(port) {
  const srv = http.createServer(async (req, res) => {
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

    if (req.url === '/api/devices') {
      try {
        const datos = await obtenerDatos();
        const gateway = datos.ip.gateway;
        const dispositivos = await obtenerDispositivos(gateway);
        // Guardar MACs en cache para el endpoint de detalle
        lastDeviceCache = {};
        for (const d of dispositivos) {
          if (d.mac && d.mac !== 'N/A') lastDeviceCache[d.ip] = d.mac;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, data: dispositivos, gateway }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
      return;
    }

    // Endpoint: info detallada de un dispositivo especifico
    const deviceMatch = req.url.match(/^\/api\/device\/(.+)$/);
    if (deviceMatch) {
      const targetIp = decodeURIComponent(deviceMatch[1]);
      try {
        const info = await obtenerInfoDetalladaDispositivo(targetIp);
        // Usar MAC del cache del escaneo principal si no se detecto
        if ((!info.mac || info.mac === 'N/A') && lastDeviceCache[targetIp]) {
          info.mac = lastDeviceCache[targetIp];
          info.fabricante = lookupOUI ? lookupOUI(info.mac) : 'Desconocido';
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, data: info }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
      return;
    }

    // Endpoint: ping en vivo a una IP
    const pingMatch = req.url.match(/^\/api\/ping\/(.+)$/);
    if (pingMatch) {
      const targetIp = decodeURIComponent(pingMatch[1]);
      try {
        const ms = await pingLive(targetIp);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, ms }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
      return;
    }

    // Endpoint: datos WiFi en vivo (senial, velocidad, canal)
    if (req.url === '/api/wifi/live') {
      try {
        const info = await obtenerWiFiLive();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(info));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
      return;
    }

    // Endpoint: velocidad de internet
    if (req.url === '/api/speed') {
      try {
        const result = await measureInternetSpeed();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
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

  srv.listen(port, '0.0.0.0', () => {
    console.log(`\n========================================`);
    console.log(`  NetPulse AI - Servidor Online`);
    console.log(`========================================`);
    console.log(`  Abre tu navegador en:`);
    console.log(`  http://localhost:${port}`);
    console.log(`========================================\n`);
  });

  srv.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`  Puerto ${port} ocupado, probando ${port + 1}...`);
      srv.close();
      startServer(port + 1);
    } else {
      console.error('[ERROR]', err.message);
      process.exit(1);
    }
  });
}

startServer(PORT);
