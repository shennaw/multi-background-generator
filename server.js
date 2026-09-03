// Zero-dependency static server for the Cover Generator.
// Usage: node server.js [port]
const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = Number(process.argv[2] || process.env.PORT || 5173);
const ROOT = path.join(__dirname, 'public');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const FONT_EXTENSIONS = ['.ttf', '.otf', '.woff', '.woff2'];
const MAX_FONT_BYTES = 20 * 1024 * 1024;

function saveFont(req, res, rawName) {
  // Only ever write a bare filename into public/fonts.
  const filename = path.basename(rawName);
  if (!filename || filename.startsWith('.') || !FONT_EXTENSIONS.includes(path.extname(filename).toLowerCase())) {
    res.writeHead(400, { 'Content-Type': TYPES['.json'] });
    res.end(JSON.stringify({ error: 'Expected a .ttf, .otf, .woff or .woff2 filename' }));
    return;
  }

  const chunks = [];
  let size = 0;
  req.on('data', (chunk) => {
    size += chunk.length;
    if (size > MAX_FONT_BYTES) {
      res.writeHead(413, { 'Content-Type': TYPES['.json'] });
      res.end(JSON.stringify({ error: 'Font file is larger than 20 MB' }));
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });
  req.on('end', () => {
    if (res.writableEnded) return;
    fs.writeFile(path.join(ROOT, 'fonts', filename), Buffer.concat(chunks), (err) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': TYPES['.json'] });
        res.end(JSON.stringify({ error: err.message }));
        return;
      }
      console.log(`Saved font ${filename}`);
      res.writeHead(200, { 'Content-Type': TYPES['.json'] });
      res.end(JSON.stringify({ filename }));
    });
  });
}

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);

  if (urlPath.startsWith('/api/fonts/') && (req.method === 'PUT' || req.method === 'POST')) {
    saveFont(req, res, urlPath.slice('/api/fonts/'.length));
    return;
  }

  // Whatever font files sit in public/fonts are offered to the page.
  if (urlPath === '/api/fonts') {
    fs.readdir(path.join(ROOT, 'fonts'), (err, entries) => {
      const fonts = err
        ? []
        : entries.filter((name) => FONT_EXTENSIONS.includes(path.extname(name).toLowerCase()));
      res.writeHead(200, { 'Content-Type': TYPES['.json'], 'Cache-Control': 'no-cache' });
      res.end(JSON.stringify(fonts));
    });
    return;
  }

  let filePath = path.join(ROOT, urlPath === '/' ? 'index.html' : urlPath);

  // Keep every request inside public/.
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
});

server.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`Cover Generator running at ${url}`);
  console.log('Press Ctrl+C to stop.');
  const open =
    process.platform === 'darwin' ? `open "${url}"` :
    process.platform === 'win32' ? `start "" "${url}"` :
    `xdg-open "${url}"`;
  exec(open, () => {});
});
