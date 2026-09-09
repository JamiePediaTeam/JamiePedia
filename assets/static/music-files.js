// Music file paths for search/nav/random/tracklist behavior.
// Songs are sourced from Songs CSV, album index pages from Albums CSV,
// and motif pages from Motifs CSV.

const musicFilePaths = [];
window.musicFilePaths = musicFilePaths;

const staticMiscEntries = [
  { album: 'Motifs', path: '/motifs.html' }
];

function getBasePath() {
  const pathname = String(window.location.pathname || '');
  return pathname.includes('/JamiePedia/') ? '/JamiePedia' : '';
}

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

function splitPipeValues(value) {
  return String(value || '')
    .split(/\s*\|\s*/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getAlbumIdFromAlbumPath(pathname) {
  const fileName = String(pathname || '').split('/').pop() || '';
  return fileName.replace(/\.html$/i, '').trim().toLowerCase();
}

function parseAlbumEntriesFromCsv(text) {
  const lines = String(text || '').split(/\r?\n/).filter(Boolean);
  const entries = [];
  const titleById = new Map();

  if (lines.length < 2) {
    return { entries, titleById };
  }

  const headers = splitCsvLine(lines[0]);
  const albumIdIndex = findSongCsvHeaderIndex(headers, ['album_id', 'album id']);
  const titleIndex = findSongCsvHeaderIndex(headers, ['album_title', 'album title', 'page_title', 'page title', 'title']);

  if (albumIdIndex === -1) {
    return { entries, titleById };
  }

  const seenPaths = new Set();
  for (let index = 1; index < lines.length; index += 1) {
    const values = splitCsvLine(lines[index]);
    const albumId = String(values[albumIdIndex] || '').trim().toLowerCase();
    if (!albumId) {
      continue;
    }

    const normalizedPath = '/music/' + albumId;

    if (seenPaths.has(normalizedPath)) {
      continue;
    }
    seenPaths.add(normalizedPath);
    entries.push({ album: 'Album', path: normalizedPath });

    const albumTitle = String(values[titleIndex] || '').trim();
    if (albumId && albumTitle) {
      titleById.set(albumId.toLowerCase(), albumTitle);
    }
  }

  return { entries, titleById };
}

function isTruthyFlag(value) {
  const normalized = String(value || '').trim().toUpperCase();
  return normalized === 'TRUE' || normalized === 'YES' || normalized === '1';
}

function findSongCsvHeaderIndex(headers, aliases) {
  const lowered = headers.map((header) => String(header || '').trim().toLowerCase());
  for (const alias of aliases) {
    const index = lowered.indexOf(String(alias || '').trim().toLowerCase());
    if (index !== -1) {
      return index;
    }
  }
  return -1;
}

function parseSongEntriesFromCsv(text, albumTitleById) {
  const lines = String(text || '').split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) {
    return [];
  }

  const headers = splitCsvLine(lines[0]);
  const pathIndex = findSongCsvHeaderIndex(headers, ['path id', 'path_id', 'page_path', 'Path']);
  const albumIdIndex = findSongCsvHeaderIndex(headers, ['album_id']);

  if (pathIndex === -1) {
    return [];
  }

  const entries = [];
  const seenPaths = new Set();

  for (let index = 1; index < lines.length; index += 1) {
    const values = splitCsvLine(lines[index]);
    const pathIdRaw = String(values[pathIndex] || '').trim();
    if (!pathIdRaw) {
      continue;
    }

    const pathId = pathIdRaw.split('#')[0].split('?')[0].trim().replace(/\.html$/i, '').split('/').filter(Boolean).pop() || '';
    if (!pathId) {
      continue;
    }

    const normalizedPagePath = '/music/' + pathId;
    if (seenPaths.has(normalizedPagePath)) {
      continue;
    }
    seenPaths.add(normalizedPagePath);

    const primaryAlbumId = splitPipeValues(values[albumIdIndex])[0] || '';
    const normalizedAlbumId = primaryAlbumId.toLowerCase();
    const derivedAlbum = (albumTitleById && normalizedAlbumId)
      ? String(albumTitleById.get(normalizedAlbumId) || '').trim()
      : '';
    const album = derivedAlbum || 'Collection';
    entries.push({ album, path: normalizedPagePath });
  }

  return entries;
}

function parseMotifEntriesFromCsv(text) {
  const lines = String(text || '').split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) {
    return [];
  }

  const headers = splitCsvLine(lines[0]).map((header) => header.toLowerCase());
  const motifIdIndex = headers.indexOf('motif id');
  const hasPageIndex = headers.indexOf('has page');

  if (motifIdIndex === -1 || hasPageIndex === -1) {
    return [];
  }

  const entries = [];
  const seenMotifIds = new Set();

  for (let index = 1; index < lines.length; index += 1) {
    const values = splitCsvLine(lines[index]);
    const motifId = String(values[motifIdIndex] || '').trim();
    const hasPage = isTruthyFlag(values[hasPageIndex]);

    if (!motifId || !hasPage || seenMotifIds.has(motifId)) {
      continue;
    }

    seenMotifIds.add(motifId);
    entries.push({
      album: 'Motifs',
      path: '/motifs/' + motifId
    });
  }

  return entries;
}

function setMusicFilePaths(motifEntries, songEntries, albumEntries) {
  musicFilePaths.length = 0;
  const safeAlbumEntries = Array.isArray(albumEntries) ? albumEntries : [];

  staticMiscEntries.forEach((entry) => musicFilePaths.push(entry));
  motifEntries.forEach((entry) => musicFilePaths.push(entry));
  safeAlbumEntries.forEach((entry) => musicFilePaths.push(entry));
  songEntries.forEach((entry) => musicFilePaths.push(entry));

  window.dispatchEvent(new Event('musicFilePathsReady'));
}

let resolveMusicFilePathsReady = null;
const musicFilePathsReadyPromise = new Promise((resolve) => {
  resolveMusicFilePathsReady = resolve;
});

window.musicFilePathsReadyPromise = musicFilePathsReadyPromise;
window.whenMusicFilePathsReady = function () {
  return musicFilePathsReadyPromise;
};

(function loadMusicFilePathsFromCsv() {
  const basePath = getBasePath();
  const songCsvUrl = basePath + '/public/csv/JamiePedia Data - Songs.csv';
  const albumCsvUrl = basePath + '/public/csv/JamiePedia Data - Albums.csv';
  const motifCsvUrl = basePath + '/public/csv/JamiePedia Data - Motifs.csv';

  Promise.all([
    fetch(songCsvUrl, { cache: 'no-store' }).then((response) => response.ok ? response.text() : ''),
    fetch(albumCsvUrl, { cache: 'no-store' }).then((response) => response.ok ? response.text() : ''),
    fetch(motifCsvUrl, { cache: 'no-store' }).then((response) => response.ok ? response.text() : ''),
  ])
    .then(([songCsvText, albumCsvText, motifCsvText]) => {
      const albumCsv = parseAlbumEntriesFromCsv(albumCsvText);
      const albumEntries = albumCsv.entries;
      const albumTitleById = albumCsv.titleById;
      const songEntries = parseSongEntriesFromCsv(songCsvText, albumTitleById);
      const motifEntries = parseMotifEntriesFromCsv(motifCsvText);
      setMusicFilePaths(motifEntries, songEntries, albumEntries);
    })
    .catch(() => {
      setMusicFilePaths([], [], []);
    })
    .finally(() => {
      if (resolveMusicFilePathsReady) {
        resolveMusicFilePathsReady(musicFilePaths);
      }
    });
})();
