const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

const server = http.createServer((req, res) => {
  // Remove leading slash and build the file path
  let requestPath = req.url || '/';
  try {
    requestPath = decodeURIComponent(requestPath);
  } catch (error) {
    // Keep the original URL if it is malformed; the read will fail naturally.
  }

  let filePath = requestPath === '/' ? 'index.html' : requestPath.startsWith('/') ? requestPath.slice(1) : requestPath;
  filePath = path.join(__dirname, filePath);
  
  fs.readFile(filePath, (err, content) => {
    if (err) {
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
