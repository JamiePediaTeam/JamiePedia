// Music file paths for search/nav/random/tracklist behavior.
// Songs are sourced from Songs CSV, album index pages from Albums CSV,
// and motif pages from Motifs CSV.

const musicFilePaths = [];
window.musicFilePaths = musicFilePaths;

const staticMiscEntries = [
  { album: 'Motifs', path: '/motifs' }
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

function resolveMotifPageSlug(categoryId, motifId) {
  const normalizedCategoryId = String(categoryId || '').trim().toLowerCase();
  const normalizedMotifId = String(motifId || '').trim().toLowerCase();
  const baseSlug = normalizedCategoryId || normalizedMotifId;
  if (baseSlug === 'kalia-vibte') {
    return 'kalia-vibte';
  }
  return baseSlug;
}

function buildMotifSearchTitle(motifName, categoryId, motifId) {
  const baseName = String(motifName || '').trim();
  const normalizedCategoryId = String(categoryId || '').trim().toLowerCase();
  const normalizedMotifId = String(motifId || '').trim().toLowerCase();

  if (!baseName) {
    return normalizedMotifId;
  }

  if (!normalizedCategoryId || !normalizedMotifId || !normalizedMotifId.startsWith(normalizedCategoryId + '-')) {
    return baseName;
  }

  const suffix = normalizedMotifId.slice(normalizedCategoryId.length + 1).trim();
  if (!suffix) {
    return baseName;
  }

  return baseName + ' ' + suffix.toUpperCase();
}

function parseSongEntriesFromCsv(text, albumTitleById) {
  const lines = String(text || '').split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) {
    return [];
  }

  const headers = splitCsvLine(lines[0]);
  const pathIndex = findSongCsvHeaderIndex(headers, ['path id', 'path_id', 'page_path', 'Path']);
  const albumIdIndex = findSongCsvHeaderIndex(headers, ['album_id']);
  const pageTitleIndex = findSongCsvHeaderIndex(headers, ['page title', 'page_title', 'title']);

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

    const rawWithoutQuery = pathIdRaw.split('?')[0].trim().replace(/\.html$/i, '');
    const hashIndex = rawWithoutQuery.indexOf('#');
    const rawPathPart = hashIndex === -1 ? rawWithoutQuery : rawWithoutQuery.slice(0, hashIndex);
    const rawHashPart = hashIndex === -1 ? '' : rawWithoutQuery.slice(hashIndex + 1).trim();
    const pathSlug = rawPathPart.split('/').filter(Boolean).pop() || '';
    if (!pathSlug) {
      continue;
    }

    const normalizedPagePath = '/music/' + pathSlug + (rawHashPart ? ('#' + rawHashPart) : '');
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
    const pageTitle = String(pageTitleIndex >= 0 ? (values[pageTitleIndex] || '') : '').trim();
    entries.push({
      album,
      path: normalizedPagePath,
      title: pageTitle
    });
  }

  return entries;
}

function parseMotifEntriesFromCsv(text) {
  const lines = String(text || '').split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) {
    return [];
  }

  const headers = splitCsvLine(lines[0]).map((header) => header.toLowerCase());
  const motifNameIndex = headers.indexOf('motif name');
  const categoryIdIndex = headers.indexOf('category id');
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
    const categoryId = String(categoryIdIndex >= 0 ? (values[categoryIdIndex] || '') : '').trim();
    const motifName = String(motifNameIndex >= 0 ? (values[motifNameIndex] || '') : '').trim();
    const hasPage = isTruthyFlag(values[hasPageIndex]);

    if (!motifId || !hasPage || seenMotifIds.has(motifId)) {
      continue;
    }

    const pageSlug = resolveMotifPageSlug(categoryId, motifId);
    if (!pageSlug) {
      continue;
    }

    seenMotifIds.add(motifId);
    entries.push({
      album: 'Motifs',
      title: buildMotifSearchTitle(motifName, categoryId, motifId),
      path: '/motifs/' + pageSlug,
      motifId: motifId,
      motifCategoryId: String(categoryId || motifId).trim().toLowerCase()
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
