const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

function toRelativeRequestPath(requestPath) {
  if (requestPath === '/') {
    return 'index.html';
  }

  return requestPath.startsWith('/') ? requestPath.slice(1) : requestPath;
}

function getCandidatePaths(requestPath) {
  const relativePath = toRelativeRequestPath(requestPath);
  const candidates = [relativePath];

  if (!path.extname(relativePath)) {
    candidates.push(relativePath + '.html');
    candidates.push(path.join(relativePath, 'index.html'));
  }

  return Array.from(new Set(candidates)).map((candidate) => path.join(__dirname, candidate));
}

function detectContentType(filePath) {
  if (filePath.endsWith('.css')) return 'text/css';
  if (filePath.endsWith('.js')) return 'application/javascript';
  if (filePath.endsWith('.csv')) return 'text/csv';
  if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) return 'image/jpeg';
  if (filePath.endsWith('.png')) return 'image/png';
  if (filePath.endsWith('.gif')) return 'image/gif';
  if (filePath.endsWith('.webp')) return 'image/webp';
  if (filePath.endsWith('.ico')) return 'image/x-icon';
  return 'text/html';
}

function readFirstExistingFile(candidates, callback) {
  let index = 0;

  function next(lastError) {
    if (index >= candidates.length) {
      callback(lastError || new Error('File not found'));
      return;
    }

    const candidatePath = candidates[index];
    index += 1;

    fs.readFile(candidatePath, (error, content) => {
      if (error) {
        next(error);
        return;
      }

      callback(null, {
        filePath: candidatePath,
        content
      });
    });
  }

  next(null);
}

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

  const candidatePaths = getCandidatePaths(requestPath);

  const rawRouteRequested = /\/raw\/?$/i.test(requestPath);
  
  readFirstExistingFile(candidatePaths, (err, file) => {
    if (err) {
      const fallbackPath = path.join(__dirname, '404.html');
      fs.readFile(fallbackPath, (fallbackErr, fallbackContent) => {
        if (fallbackErr) {
          console.error(`Error reading ${fallbackPath}:`, fallbackErr.message);
          res.writeHead(404, { 'Content-Type': 'text/html' });
          res.end('404 - File Not Found', 'utf-8');
          return;
        }

        if (!rawRouteRequested) {
          console.error(`Error reading ${candidatePaths[0]}:`, err.message);
        }

        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end(fallbackContent, 'utf-8');
      });
    } else {
      const contentType = detectContentType(file.filePath);
      
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(file.content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
});
