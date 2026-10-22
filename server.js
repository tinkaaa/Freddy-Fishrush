// Zero-dependency Node.js HTTP server + Scraping Proxy
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function fetchUrl(targetUrl, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) {
      return reject(new Error('Demasiadas redirecciones'));
    }

    try {
      const parsedUrl = new URL(targetUrl);
      const client = parsedUrl.protocol === 'https:' ? https : http;

      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 TibiaTracker/1.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9,es;q=0.8'
        }
      };

      const req = client.request(options, (res) => {
        // Handle redirects
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const redirectUrl = new URL(res.headers.location, targetUrl).toString();
          return resolve(fetchUrl(redirectUrl, maxRedirects - 1));
        }

        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: data
          });
        });
      });

      req.on('error', (err) => {
        reject(err);
      });

      req.setTimeout(12000, () => {
        req.destroy();
        reject(new Error('Tiempo de espera agotado (timeout)'));
      });

      req.end();
    } catch (e) {
      reject(e);
    }
  });
}

const server = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // Endpoint para leer npcs_data.json
  if (pathname === '/api/get-npcs') {
    try {
      const data = fs.readFileSync(path.join(__dirname, 'npcs_data.json'), 'utf8');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(data);
    } catch (e) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end('[]');
    }
  }

  // Endpoint para leer imbuements_data.json
  if (pathname === '/api/get-imbuements') {
    try {
      const data = fs.readFileSync(path.join(__dirname, 'imbuements_data.json'), 'utf8');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(data);
    } catch (e) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end('[]');
    }
  }

  // Endpoint para guardar npcs_data.json desde entorno web
  if (pathname === '/api/save-npcs' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body);
        fs.writeFileSync(path.join(__dirname, 'npcs_data.json'), JSON.stringify(parsed, null, 2), 'utf8');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, count: parsed.length }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // Guardar monstruos y bosses endpoint
  if (req.method === 'POST' && pathname === '/api/save-monsters') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body);
        fs.writeFileSync(path.join(__dirname, 'monsters_data.json'), JSON.stringify(parsed, null, 2), 'utf8');
        const jsContent = 'const MONSTERS_DATA = ' + JSON.stringify(parsed, null, 2) + ';\n\nif (typeof module !== "undefined" && module.exports) {\n  module.exports = MONSTERS_DATA;\n}\n';
        fs.writeFileSync(path.join(__dirname, 'monsters_data.js'), jsContent, 'utf8');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, count: Object.keys(parsed).length }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // Scraping proxy endpoint
  if (pathname === '/api/scrape') {
    const targetUrl = parsedUrl.query.url;
    if (!targetUrl) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Falta el parámetro ?url=' }));
    }

    try {
      let pageTitle = targetUrl;
      if (targetUrl.startsWith('http://') || targetUrl.startsWith('https://')) {
        const u = new URL(targetUrl);
        const parts = u.pathname.split('/').filter(Boolean);
        pageTitle = decodeURIComponent(parts[parts.length - 1] || '').replace(/_/g, ' ');
      }

      // Para Fandom, consultar MediaWiki API con redirects automáticos
      if (targetUrl.includes('fandom.com') || !targetUrl.startsWith('http')) {
        try {
          const apiUrl = `https://tibia.fandom.com/api.php?action=parse&page=${encodeURIComponent(pageTitle.replace(/\s+/g, '_'))}&redirects=1&prop=text|wikitext|images&format=json`;
          const apiRes = await fetchUrl(apiUrl);
          const apiData = JSON.parse(apiRes.body);
          if (apiData.parse && apiData.parse.text) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({
              url: targetUrl,
              statusCode: 200,
              html: apiData.parse.text['*'],
              wikitext: apiData.parse.wikitext ? apiData.parse.wikitext['*'] : '',
              title: apiData.parse.title || pageTitle
            }));
          }
        } catch (apiErr) {
          console.warn('API error in server.js, falling back to direct:', apiErr);
        }
      }

      const response = await fetchUrl(targetUrl);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        url: targetUrl,
        statusCode: response.statusCode,
        html: response.body
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: err.message || 'Error al descargar la página' }));
    }
  }

  // Image proxy endpoint (evita bloqueos de referer de Wikia/Fandom)
  if (pathname === '/api/image') {
    const imageUrl = parsedUrl.query.url;
    if (!imageUrl) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      return res.end('Falta parámetro ?url=');
    }
    try {
      const parsed = new URL(imageUrl);
      const client = parsed.protocol === 'https:' ? https : http;
      const options = {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Referer': 'https://tibia.fandom.com/',
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
        }
      };
      client.get(options, (imgRes) => {
        // Redirecciones
        if (imgRes.statusCode >= 300 && imgRes.statusCode < 400 && imgRes.headers.location) {
          const redirUrl = new URL(imgRes.headers.location, imageUrl).toString();
          return res.writeHead(302, { 'Location': '/api/image?url=' + encodeURIComponent(redirUrl) }).end();
        }
        res.writeHead(imgRes.statusCode, {
          'Content-Type': imgRes.headers['content-type'] || 'image/webp',
          'Cache-Control': 'public, max-age=86400',
          'Access-Control-Allow-Origin': '*'
        });
        imgRes.pipe(res);
      }).on('error', (e) => {
        res.writeHead(502);
        res.end();
      });
    } catch (e) {
      res.writeHead(400);
      res.end();
    }
    return;
  }

  // Health / info endpoint
  if (pathname === '/api/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'online', service: 'Tibia NPC Tracker API' }));
  }

  // Yasir live status endpoint (fallback para modo web)
  if (pathname === '/api/yasir-status') {
    const worldParam = parsedUrl.query.world || 'Solidera';
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      success: true,
      activeWorlds: ['Yubra'], // valor referencial de Hakai Market
      targetWorld: worldParam,
      isActiveInTarget: false,
      timestamp: new Date().toISOString()
    }));
  }

  // Static file serving
  let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);
  
  // Security check to avoid directory traversal
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    return res.end('Acceso denegado');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Archivo no encontrado');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const headers = { 'Content-Type': contentType };
    if (['.html', '.js', '.css', '.json'].includes(ext)) {
      headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
    }

    res.writeHead(200, headers);
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`[Tibia NPC Tracker] Servidor corriendo en http://localhost:${PORT}`);
});
