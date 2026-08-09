const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

const server = http.createServer((req, res) => {
  // Parse URL so query strings do not become part of the local file path.
  const rawUrl = req.url || '/';
  let requestPath = '/';
  try {
    const parsedUrl = new URL(rawUrl, 'http://localhost');
    requestPath = decodeURIComponent(parsedUrl.pathname || '/');
  } catch (error) {
    // Fall back to best effort for malformed URLs.
    requestPath = rawUrl.split('?')[0].split('#')[0] || '/';
    try {
      requestPath = decodeURIComponent(requestPath);
    } catch (decodeError) {
      // Keep undecoded fallback path.
    }
  }

  let filePath = requestPath === '/' ? 'index.html' : requestPath.startsWith('/') ? requestPath.slice(1) : requestPath;
  filePath = path.join(__dirname, filePath);

  const rawRouteRequested = /\/raw\/?$/i.test(requestPath);
  
  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (rawRouteRequested) {
        const fallbackPath = path.join(__dirname, '404.html');
        fs.readFile(fallbackPath, (fallbackErr, fallbackContent) => {
          if (fallbackErr) {
            console.error(`Error reading ${fallbackPath}:`, fallbackErr.message);
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end('404 - File Not Found', 'utf-8');
            return;
          }

          res.writeHead(404, { 'Content-Type': 'text/html' });
          res.end(fallbackContent, 'utf-8');
        });
        return;
      }

      console.error(`Error reading ${filePath}:`, err.message);
      res.writeHead(404, { 'Content-Type': 'text/html' });
      res.end('404 - File Not Found', 'utf-8');
    } else {
      let contentType = 'text/html';
      if (filePath.endsWith('.css')) contentType = 'text/css';
      else if (filePath.endsWith('.js')) contentType = 'application/javascript';
      else if (filePath.endsWith('.csv')) contentType = 'text/csv';
      else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) contentType = 'image/jpeg';
      else if (filePath.endsWith('.png')) contentType = 'image/png';
      else if (filePath.endsWith('.gif')) contentType = 'image/gif';
      
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
});
