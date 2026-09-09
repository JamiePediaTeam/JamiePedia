const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const SONGS_CSV_PATH = path.join(__dirname, 'public/csv/JamiePedia Data - Songs.csv');
const ALBUMS_CSV_PATH = path.join(__dirname, 'public/csv/JamiePedia Data - Albums.csv');
const MOTIFS_CSV_PATH = path.join(__dirname, 'public/csv/JamiePedia Data - Motifs.csv');
const SONG_SHELL_PATH = path.join(__dirname, 'music/song-shell.html');
const ALBUM_SHELL_PATH = path.join(__dirname, 'music/album-shell.html');
const MOTIF_SHELL_PATH = path.join(__dirname, 'motifs/motif-shell.html');

function splitCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current);
  return values.map((value) => String(value || '').trim());
}

function normalizeSongRoutePath(rawPath) {
  const source = String(rawPath || '').trim();
  if (!source) {
    return '';
  }

  const hashless = source.split('#')[0].split('?')[0].trim();
  if (!hashless) {
    return '';
  }

  const withMusicPrefix = hashless.startsWith('/music/')
    ? hashless
    : '/music/' + hashless.replace(/^\/+/, '');

  let normalized = withMusicPrefix.replace(/\.html$/i, '');
  normalized = normalized.replace(/\/index$/i, '');
  if (normalized.length > 1) {
    normalized = normalized.replace(/\/+$/, '');
  }

  return normalized || '/';
}

function normalizeAlbumRoutePath(rawPath) {
  const source = String(rawPath || '').trim();
  if (!source) {
    return '';
  }

  const hashless = source.split('#')[0].split('?')[0].trim();
  if (!hashless) {
    return '';
  }

  const withMusicPrefix = hashless.startsWith('/music/')
    ? hashless
    : '/music/' + hashless.replace(/^\/+/, '');

  let normalized = withMusicPrefix.replace(/\.html$/i, '');
  normalized = normalized.replace(/\/index$/i, '');
  if (normalized.length > 1) {
    normalized = normalized.replace(/\/+$/, '');
  }

  if (!/^\/music\/[^/]+$/.test(normalized) || normalized === '/music') {
    return '';
  }

  return normalized;
}

function normalizeMotifRoutePath(rawPath) {
  const source = String(rawPath || '').trim();
  if (!source) {
    return '';
  }

  const hashless = source.split('#')[0].split('?')[0].trim();
  if (!hashless) {
    return '';
  }

  const withMotifPrefix = hashless.startsWith('/motifs/')
    ? hashless
    : '/motifs/' + hashless.replace(/^\/+/, '');

  let normalized = withMotifPrefix.replace(/\.html$/i, '');
  normalized = normalized.replace(/\/index$/i, '');
  if (normalized.length > 1) {
    normalized = normalized.replace(/\/+$/, '');
  }

  if (!/^\/motifs\/[^/]+$/.test(normalized) || normalized === '/motifs') {
    return '';
  }

  return normalized;
}

function loadKnownRoutesFromCsv(csvPath, candidateHeaders, normalizer) {
  const knownRoutes = new Set();

  try {
    const text = fs.readFileSync(csvPath, 'utf-8');
    const lines = String(text || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length < 2) {
      return knownRoutes;
    }

    const headers = splitCsvLine(lines[0]).map((value) => value.toLowerCase());
    const pathIndex = headers.findIndex((header) => (candidateHeaders || []).includes(header));

    if (pathIndex === -1) {
      return knownRoutes;
    }

    for (let index = 1; index < lines.length; index += 1) {
      const values = splitCsvLine(lines[index]);
      const normalized = normalizer(values[pathIndex] || '');
      if (normalized) {
        knownRoutes.add(normalized);
      }
    }
  } catch (error) {
    console.warn('Unable to load routes from CSV:', error.message);
  }

  return knownRoutes;
}

function loadKnownSongRoutesFromCsv() {
  const knownRoutes = new Set();

  try {
    const text = fs.readFileSync(SONGS_CSV_PATH, 'utf-8');
    const lines = String(text || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length < 2) {
      return knownRoutes;
    }

    const headers = splitCsvLine(lines[0]).map((value) => value.toLowerCase());
    const pathIndex = headers.findIndex((header) => ['path id', 'path_id', 'path', 'page_path'].includes(header));
    const albumIdIndex = headers.findIndex((header) => ['album_id', 'album id'].includes(header));

    if (pathIndex === -1) {
      return knownRoutes;
    }

    for (let index = 1; index < lines.length; index += 1) {
      const values = splitCsvLine(lines[index]);
      const rawPath = String(values[pathIndex] || '').trim();
      const normalized = normalizeSongRoutePath(rawPath);
      if (!normalized) {
        continue;
      }

      knownRoutes.add(normalized);

      if (albumIdIndex === -1 || normalized.includes('/', '/music/'.length)) {
        continue;
      }

      const baseSlug = normalized.replace(/^\/music\//, '');
      const albumIds = String(values[albumIdIndex] || '')
        .split(/\s*\|\s*/)
        .map((value) => String(value || '').trim())
        .filter((value) => value && value.toLowerCase() !== 'x');

      albumIds.forEach((albumId) => {
        const legacy = normalizeSongRoutePath('/music/' + albumId + '/' + baseSlug);
        if (legacy) {
          knownRoutes.add(legacy);
        }
      });
    }
  } catch (error) {
    console.warn('Unable to load song routes from CSV:', error.message);
  }

  return knownRoutes;
}

function loadKnownAlbumRoutesFromCsv() {
  return loadKnownRoutesFromCsv(
    ALBUMS_CSV_PATH,
    ['album_id', 'album id', 'path id', 'path_id', 'path', 'page_path'],
    normalizeAlbumRoutePath
  );
}

function loadKnownMotifRoutesFromCsv() {
  const knownRoutes = new Set();

  try {
    const text = fs.readFileSync(MOTIFS_CSV_PATH, 'utf-8');
    const lines = String(text || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length < 2) {
      return knownRoutes;
    }

    const headers = splitCsvLine(lines[0]).map((value) => value.toLowerCase());
    const motifIdIndex = headers.indexOf('motif id');
    const categoryIdIndex = headers.indexOf('category id');
    const hasPageIndex = headers.indexOf('has page');

    if (hasPageIndex === -1) {
      return knownRoutes;
    }

    for (let index = 1; index < lines.length; index += 1) {
      const values = splitCsvLine(lines[index]);
      const motifId = String(values[motifIdIndex] || '').trim();
      const categoryId = String(values[categoryIdIndex] || '').trim();
      const hasPage = String(values[hasPageIndex] || '').trim().toUpperCase();

      if (!motifId || !(hasPage === 'TRUE' || hasPage === 'YES' || hasPage === '1')) {
        continue;
      }

      const pageSlug = categoryId === 'kalia-vibte'
        ? 'bittersweet-kalia-vibte'
        : (categoryId || motifId);

      const normalized = normalizeMotifRoutePath('/motifs/' + pageSlug);
      if (normalized) {
        knownRoutes.add(normalized);
      }
    }
  } catch (error) {
    console.warn('Unable to load motif routes from CSV:', error.message);
  }

  return knownRoutes;
}

function getKnownSongRoutes() {
  return loadKnownSongRoutesFromCsv();
}

function getKnownAlbumRoutes() {
  return loadKnownAlbumRoutesFromCsv();
}

function getKnownMotifRoutes() {
  return loadKnownMotifRoutesFromCsv();
}

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

function isKnownSongRouteRequest(requestPath) {
  const normalized = normalizeSongRoutePath(requestPath);
  if (!normalized) {
    return false;
  }

  return getKnownSongRoutes().has(normalized);
}

function isKnownAlbumRouteRequest(requestPath) {
  const normalized = normalizeAlbumRoutePath(requestPath);
  if (!normalized) {
    return false;
  }

  return getKnownAlbumRoutes().has(normalized);
}

function isKnownMotifRouteRequest(requestPath) {
  const normalized = normalizeMotifRoutePath(requestPath);
  if (!normalized) {
    return false;
  }

  return getKnownMotifRoutes().has(normalized);
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
      if (!rawRouteRequested && isKnownSongRouteRequest(requestPath)) {
        fs.readFile(SONG_SHELL_PATH, (shellErr, shellContent) => {
          if (shellErr) {
            console.error(`Error reading ${SONG_SHELL_PATH}:`, shellErr.message);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('500 - Song shell missing', 'utf-8');
            return;
          }

          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(shellContent, 'utf-8');
        });
        return;
      }

      if (!rawRouteRequested && isKnownAlbumRouteRequest(requestPath)) {
        fs.readFile(ALBUM_SHELL_PATH, (shellErr, shellContent) => {
          if (shellErr) {
            console.error(`Error reading ${ALBUM_SHELL_PATH}:`, shellErr.message);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('500 - Album shell missing', 'utf-8');
            return;
          }

          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(shellContent, 'utf-8');
        });
        return;
      }

      if (!rawRouteRequested && isKnownMotifRouteRequest(requestPath)) {
        fs.readFile(MOTIF_SHELL_PATH, (shellErr, shellContent) => {
          if (shellErr) {
            console.error(`Error reading ${MOTIF_SHELL_PATH}:`, shellErr.message);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('500 - Motif shell missing', 'utf-8');
            return;
          }

          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(shellContent, 'utf-8');
        });
        return;
      }

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
