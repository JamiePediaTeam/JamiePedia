// Store full search results for filtering
let fullSearchResults = [];
let currentSearchQuery = '';
let searchImageCsvPromise = null;
let searchImageByPath = Object.create(null);
let searchAlbumTitleByPath = Object.create(null);
let searchMotifTitleByPath = Object.create(null);
let searchPageTitleByPath = Object.create(null);
let searchSongRowsPromise = null;
let searchContentIndexPromise = null;
let searchMotifIndexPromise = null;
let searchMotifNamesBySongId = Object.create(null);
let searchMotifIdsByCategory = Object.create(null);
let searchSongIdsByMotifId = Object.create(null);
let searchReferencedSongIdsBySongId = Object.create(null);
let searchArtistCsvSummariesBySlug = Object.create(null);
let searchContentIndex = {
  songs: Object.create(null),
  albums: Object.create(null),
  motifs: Object.create(null),
  artists: Object.create(null)
};

const searchSongCsvHeaderAliases = {
  page_path: ['page_path', 'path_id', 'path', 'page path', 'path id'],
  title: ['page_title', 'page title', 'title', 'song title'],
  song_id: ['song_id', 'song id'],
  album_id: ['album_id', 'album id'],
  album_title: ['album_title', 'album title'],
  artists: ['artists', 'artist'],
  vocalists: ['vocalists', 'vocalist'],
  mixing: ['mixing'],
  mastering: ['mastering'],
  instrumentals: ['instrumentals'],
  close_up: ['close_up', 'close up'],
  alt_tab: ['alt_tab', 'alt tab status?'],
  tab_name: ['tab_name', 'alt tab name'],
  theme: ['theme', 'version_theme']
};

function searchEscapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function parseSearchLrcRawLines(text) {
  const lines = String(text || '').split(/\r?\n/);
  const timedEntries = [];

  lines.forEach((line) => {
    const timestamps = [];
    const timestampPattern = /\[(\d{1,2}:\d{2}(?:\.\d{1,3})?)\]/g;
    let match;

    while ((match = timestampPattern.exec(line)) !== null) {
      timestamps.push(match[1]);
    }

    if (timestamps.length === 0) {
      return;
    }

    const lyric = line.replace(/\[[^\]]+\]/g, '').trim();
    timestamps.forEach((stamp) => {
      timedEntries.push({ stamp, text: lyric });
    });
  });

  const seen = new Set();
  return timedEntries
    .filter((entry) => {
      const key = entry.stamp + '|' + entry.text;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .map((entry) => entry.text);
}

function resolveSearchPath(basePath, filePath) {
  if (!filePath) {
    return '';
  }
  return (basePath || '') + filePath;
}

function normalizeSearchRoutePath(path) {
  let normalized = String(path || '').trim();
  if (!normalized) {
    return '';
  }

  if (typeof toExtensionlessPath === 'function') {
    return toExtensionlessPath(normalized);
  }

  normalized = normalized.split('?')[0].split('#')[0];
  normalized = normalized.replace(/\.html$/i, '').replace(/\/index\.html$/i, '/');
  if (!normalized.startsWith('/')) {
    normalized = '/' + normalized;
  }
  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

function splitSearchRouteValues(value) {
  return String(value || '')
    .split(/\s*\|\s*/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeSearchSongRowValue(row, key) {
  const sourceRow = row || {};
  const canonicalKey = String(key || '').trim();
  if (!canonicalKey) {
    return '';
  }

  const aliasList = searchSongCsvHeaderAliases[canonicalKey] || [];
  const candidateKeys = [
    canonicalKey,
    canonicalKey.toLowerCase(),
    canonicalKey.replace(/_/g, ' '),
    canonicalKey.replace(/_/g, '-'),
    canonicalKey.replace(/_/g, '')
  ]
    .concat(aliasList)
    .concat(aliasList.map((alias) => String(alias || '').trim().toLowerCase()));

  for (const candidateKey of candidateKeys) {
    if (Object.prototype.hasOwnProperty.call(sourceRow, candidateKey)) {
      const value = String(sourceRow[candidateKey] || '').trim();
      if (value) {
        return value;
      }
    }
  }

  const loweredCandidates = candidateKeys.map((candidate) => String(candidate || '').trim().toLowerCase());
  for (const [rowKey, value] of Object.entries(sourceRow)) {
    if (loweredCandidates.includes(String(rowKey || '').trim().toLowerCase())) {
      const text = String(value || '').trim();
      if (text) {
        return text;
      }
    }
  }

  return '';
}

function getSearchSongRowPathValue(row) {
  return normalizeSearchSongRowValue(row, 'page_path')
    || normalizeSearchSongRowValue(row, 'path_id')
    || normalizeSearchSongRowValue(row, 'path');
}

function getSearchSongRowTitle(row) {
  return normalizeSearchSongRowValue(row, 'title')
    || normalizeSearchSongRowValue(row, 'page_title')
    || normalizeSearchSongRowValue(row, 'song_title');
}

function getSearchSongRowAlbumIds(row) {
  return splitSearchRouteValues(normalizeSearchSongRowValue(row, 'album_id')).map((value) => value.toLowerCase());
}

function parseSearchSongRows(csvText) {
  const lines = String(csvText || '').split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) {
    return [];
  }

  const headers = splitSearchCsvLine(lines[0]).map((header) => String(header || '').trim().toLowerCase());
  const aliasLookup = new Map();

  Object.entries(searchSongCsvHeaderAliases).forEach(([canonicalKey, aliases]) => {
    aliases.forEach((alias) => aliasLookup.set(String(alias || '').trim().toLowerCase(), canonicalKey));
  });

  const rows = [];
  for (let index = 1; index < lines.length; index += 1) {
    const values = splitSearchCsvLine(lines[index]);
    const row = {};

    headers.forEach((header, headerIndex) => {
      const canonicalKey = aliasLookup.get(header) || header;
      row[canonicalKey] = values[headerIndex] || '';
    });

    if (Object.keys(row).length > 0) {
      rows.push(row);
    }
  }

  return rows;
}

function ensureSearchSongRowsLoaded(basePath) {
  if (Array.isArray(window.__songSidebarCsvRows) && window.__songSidebarCsvRows.length > 0) {
    return Promise.resolve(window.__songSidebarCsvRows);
  }

  if (searchSongRowsPromise) {
    return searchSongRowsPromise;
  }

  if (typeof ensureSongSidebarCsvLoaded === 'function') {
    searchSongRowsPromise = new Promise((resolve) => {
      ensureSongSidebarCsvLoaded((rows) => {
        resolve(Array.isArray(rows) ? rows : []);
      });
    });
    return searchSongRowsPromise;
  }

  searchSongRowsPromise = fetch((basePath || '') + '/public/csv/JamiePedia Data - Songs.csv', { cache: 'no-store' })
    .then((response) => response.ok ? response.text() : '')
    .then((text) => parseSearchSongRows(text))
    .catch(() => []);

  return searchSongRowsPromise;
}

function getSearchSongRowsForRoute(routePath, songRows) {
  const currentPointer = getSearchSongVariantPointer(routePath);
  if (!currentPointer) {
    return [];
  }
  const rows = Array.isArray(songRows) ? songRows : [];

  return rows.filter((row) => getSearchSongVariantPointer(getSearchSongRowPathValue(row)) === currentPointer);
}

function getSearchSongVariantPointer(routePath) {
  let rawPath = String(routePath || '').trim().split('?')[0];
  if (!rawPath) {
    return '';
  }

  rawPath = rawPath.replace(/\.html$/i, '').replace(/\/+$/, '');
  const parts = rawPath.split('/').filter(Boolean);
  const pointer = String(parts[parts.length - 1] || '').trim();
  return pointer.toLowerCase();
}

function getSearchSongRowsForAlbum(albumId, songRows) {
  const normalizedAlbumId = String(albumId || '').trim().toLowerCase();
  if (!normalizedAlbumId) {
    return [];
  }

  return (Array.isArray(songRows) ? songRows : []).filter((row) => {
    const albumIds = getSearchSongRowAlbumIds(row);
    return albumIds.includes(normalizedAlbumId);
  });
}

function getSearchSongVariantSlugsFromRows(routePath, songRows) {
  const pointer = getSearchSongVariantPointer(routePath);
  return pointer ? [pointer] : [];
}

function resolveSearchImageSrc(basePath, pagePath, rawSrc) {
  const source = String(rawSrc || '').trim();
  if (!source) {
    return '';
  }

  if (/^(https?:|data:|blob:)/i.test(source)) {
    return source;
  }

  let normalized = source;
  if (normalized.startsWith('/') && basePath && !normalized.startsWith(basePath + '/')) {
    normalized = basePath + normalized;
  }

  try {
    const pageUrl = new URL((basePath || '') + pagePath, window.location.origin);
    const resolved = new URL(normalized, pageUrl.href);
    if (resolved.origin === window.location.origin) {
      return resolved.pathname + resolved.search + resolved.hash;
    }
    return resolved.href;
  } catch (_error) {
    return normalized;
  }
}

async function fetchSearchText(path) {
  if (!path) {
    return null;
  }

  try {
    const response = await fetch(path);
    if (!response.ok) {
      return null;
    }
    const text = await response.text();
    return String(text || '').trim() ? text : null;
  } catch (_error) {
    return null;
  }
}

function ensureSearchContentIndexLoaded(basePath) {
  if (searchContentIndexPromise) {
    return searchContentIndexPromise;
  }

  const indexUrl = (basePath || '') + '/public/search/search-content-index.json';
  searchContentIndexPromise = fetch(indexUrl, { cache: 'no-store' })
    .then((response) => response.ok ? response.json() : null)
    .then((payload) => {
      const songs = payload && payload.songs && typeof payload.songs === 'object'
        ? payload.songs
        : Object.create(null);
      const albums = payload && payload.albums && typeof payload.albums === 'object'
        ? payload.albums
        : Object.create(null);
      const motifs = payload && payload.motifs && typeof payload.motifs === 'object'
        ? payload.motifs
        : Object.create(null);
      const indexedArtists = payload && payload.artists && typeof payload.artists === 'object'
        ? payload.artists
        : Object.create(null);
      const artists = Object.assign(Object.create(null), searchArtistCsvSummariesBySlug, indexedArtists);

      searchContentIndex = {
        songs,
        albums,
        motifs,
        artists
      };
      return searchContentIndex;
    })
    .catch(() => {
      searchContentIndex = {
        songs: Object.create(null),
        albums: Object.create(null),
        motifs: Object.create(null),
        artists: Object.create(null)
      };
      return searchContentIndex;
    });

  return searchContentIndexPromise;
}

function ensureSearchMotifIndexLoaded(basePath) {
  if (searchMotifIndexPromise) {
    return searchMotifIndexPromise;
  }

  const motifCsvUrl = (basePath || '') + '/public/csv/JamiePedia Data - Motifs.csv';
  const referencesCsvUrl = (basePath || '') + '/public/csv/JamiePedia Data - References.csv';
  searchMotifIndexPromise = Promise.all([
    fetch(motifCsvUrl, { cache: 'no-store' }).then((response) => response.ok ? response.text() : ''),
    fetch(referencesCsvUrl, { cache: 'no-store' }).then((response) => response.ok ? response.text() : '')
  ]).then(([motifCsvText, referencesCsvText]) => {
    const motifLines = String(motifCsvText || '').split(/\r?\n/).filter(Boolean);
    const referenceLines = String(referencesCsvText || '').split(/\r?\n/).filter(Boolean);
    const motifNames = Object.create(null);
    const motifIdsByCategory = Object.create(null);
    const motifHeaders = motifLines.length ? splitSearchCsvLine(motifLines[0]).map((header) => header.toLowerCase()) : [];
    const motifIdIndex = motifHeaders.indexOf('motif id');
    const motifNameIndex = motifHeaders.indexOf('motif name');
    const motifCategoryIndex = motifHeaders.indexOf('category id');

    motifLines.slice(1).forEach((line) => {
      const values = splitSearchCsvLine(line);
      const id = String(values[motifIdIndex] || '').trim().toLowerCase();
      const categoryId = String(values[motifCategoryIndex] || '').trim().toLowerCase();
      const name = String(values[motifNameIndex] || '').trim();
      if (id && name) {
        motifNames[id] = name;
      }
      if (id && categoryId) {
        if (!motifIdsByCategory[categoryId]) {
          motifIdsByCategory[categoryId] = [];
        }
        if (!motifIdsByCategory[categoryId].includes(id)) {
          motifIdsByCategory[categoryId].push(id);
        }
      }
    });

    const namesBySongId = Object.create(null);
    const songsByMotifId = Object.create(null);
    const referencedSongsBySongId = Object.create(null);
    const referenceHeaders = referenceLines.length ? splitSearchCsvLine(referenceLines[0]).map((header) => header.toLowerCase()) : [];
    const songIdIndex = referenceHeaders.indexOf('song id');
    const referenceMotifIdIndex = referenceHeaders.indexOf('motif id');
    referenceLines.slice(1).forEach((line) => {
      const values = splitSearchCsvLine(line);
      const songId = String(values[songIdIndex] || '').trim().toLowerCase();
      const motifId = String(values[referenceMotifIdIndex] || '').trim().toLowerCase();
      const motifName = motifNames[motifId];
      if (!songId || !motifId) {
        return;
      }

      if (motifName) {
        if (!namesBySongId[songId]) {
          namesBySongId[songId] = [];
        }
        if (!namesBySongId[songId].includes(motifName)) {
          namesBySongId[songId].push(motifName);
        }
      }

      if (!songsByMotifId[motifId]) {
        songsByMotifId[motifId] = [];
      }
      if (!songsByMotifId[motifId].includes(songId)) {
        songsByMotifId[motifId].push(songId);
      }

      if (!motifName) {
        if (!referencedSongsBySongId[songId]) {
          referencedSongsBySongId[songId] = [];
        }
        if (!referencedSongsBySongId[songId].includes(motifId)) {
          referencedSongsBySongId[songId].push(motifId);
        }
      }
    });

    searchMotifNamesBySongId = namesBySongId;
    searchMotifIdsByCategory = motifIdsByCategory;
    searchSongIdsByMotifId = songsByMotifId;
    searchReferencedSongIdsBySongId = referencedSongsBySongId;
    return namesBySongId;
  }).catch(() => {
    searchMotifNamesBySongId = Object.create(null);
    searchMotifIdsByCategory = Object.create(null);
    searchSongIdsByMotifId = Object.create(null);
    searchReferencedSongIdsBySongId = Object.create(null);
    return searchMotifNamesBySongId;
  });

  return searchMotifIndexPromise;
}

function getSearchMotifNamesForSongRows(rows) {
  const names = [];
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const songId = normalizeSearchSongRowValue(row, 'song_id').toLowerCase();
    (searchMotifNamesBySongId[songId] || []).forEach((name) => {
      if (!names.includes(name)) {
        names.push(name);
      }
    });
  });
  return names;
}

function getSearchSongTitlesForIds(songIds, songRows) {
  const wantedIds = new Set((Array.isArray(songIds) ? songIds : []).map((id) => String(id || '').trim().toLowerCase()).filter(Boolean));
  const titles = [];
  (Array.isArray(songRows) ? songRows : []).forEach((row) => {
    if (!wantedIds.has(normalizeSearchSongRowValue(row, 'song_id').toLowerCase())) {
      return;
    }
    const title = getSearchSongRowTitle(row);
    if (title && !titles.includes(title)) {
      titles.push(title);
    }
  });
  return titles;
}

function getSearchSongsForMotifKeys(motifKeys, songRows) {
  const motifIds = new Set();
  (Array.isArray(motifKeys) ? motifKeys : [motifKeys]).forEach((key) => {
    const normalized = String(key || '').trim().toLowerCase();
    if (!normalized) {
      return;
    }
    motifIds.add(normalized);
    (searchMotifIdsByCategory[normalized] || []).forEach((id) => motifIds.add(id));
  });

  const songIds = new Set();
  motifIds.forEach((motifId) => {
    (searchSongIdsByMotifId[motifId] || []).forEach((songId) => songIds.add(songId));
  });
  return getSearchSongTitlesForIds(Array.from(songIds), songRows);
}

function getSearchReferencedSongsForSongRows(rows, songRows) {
  const songIds = new Set();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const sourceSongId = normalizeSearchSongRowValue(row, 'song_id').toLowerCase();
    (searchReferencedSongIdsBySongId[sourceSongId] || []).forEach((songId) => songIds.add(songId));
  });
  return getSearchSongTitlesForIds(Array.from(songIds), songRows);
}

function buildSearchMetadataText(rows, fallbackAlbum) {
  const fields = [
    ['Album', 'album_title'],
    ['Artists', 'artists'],
    ['Vocalists', 'vocalists'],
    ['Mixing', 'mixing'],
    ['Mastering', 'mastering'],
    ['Instrumentals', 'instrumentals']
  ];
  const sections = [];
  const searchableValues = [];

  fields.forEach(([label, key]) => {
    const values = [];
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      const value = normalizeSearchSongRowValue(row, key);
      if (key === 'album_title' && value.toLowerCase() === 'album') {
        return;
      }
      if (value && !values.includes(value)) {
        values.push(value);
      }
    });

    if (key === 'album_title' && values.length === 0 && fallbackAlbum && String(fallbackAlbum).trim().toLowerCase() !== 'album') {
      values.push(String(fallbackAlbum).trim());
    }
    if (key === 'album_title' && values.length === 0) {
      (Array.isArray(rows) ? rows : []).forEach((row) => {
        splitSearchRouteValues(normalizeSearchSongRowValue(row, 'album_id')).forEach((albumId) => {
          const title = searchAlbumTitleByPath['/music/' + albumId.toLowerCase()] || albumId;
          if (title && !values.includes(title)) {
            values.push(title);
          }
        });
      });
    }

    if (values.length) {
      sections.push(label + ': ' + values.join(' | ') + ',');
      searchableValues.push(...values);
    }
  });

  if (sections.length) {
    sections[sections.length - 1] = sections[sections.length - 1].replace(/,$/u, '');
  }

  return {
    displayText: sections.join(' '),
    searchableText: searchableValues.join(' ')
  };
}

function splitSearchCsvLine(line) {
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

function splitSearchPipeValues(value) {
  return String(value || '')
    .split(/\s*\|\s*/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeSearchImagePath(value) {
  let text = String(value || '').trim();
  if (!text) {
    return '';
  }

  if (/^https?:/i.test(text)) {
    return text;
  }

  text = text.replace(/^\.\//, '/').replace(/^(\.\.\/)+/, '/');
  if (!text.startsWith('/')) {
    text = '/' + text;
  }

  return text;
}

function resolveSearchMotifPageSlug(categoryId, motifId) {
  const normalizedCategoryId = String(categoryId || '').trim().toLowerCase();
  const normalizedMotifId = String(motifId || '').trim().toLowerCase();
  const baseSlug = normalizedCategoryId || normalizedMotifId;
  if (baseSlug === 'kalia-vibte') {
    return 'kalia-vibte';
  }
  return baseSlug;
}

function isSearchTruthyFlag(value) {
  const normalized = String(value || '').trim().toUpperCase();
  return normalized === 'TRUE' || normalized === 'YES' || normalized === '1';
}

function findSearchSongCsvHeaderIndex(headers, aliases) {
  const lowered = headers.map((header) => String(header || '').trim().toLowerCase());
  for (const alias of aliases) {
    const index = lowered.indexOf(String(alias || '').trim().toLowerCase());
    if (index !== -1) {
      return index;
    }
  }
  return -1;
}

function buildSearchImageMapFromSongCsv(csvText) {
  const imageByPath = Object.create(null);
  const titleByPath = Object.create(null);
  const lines = String(csvText || '').split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) {
    return { imageByPath, titleByPath };
  }

  const headers = splitSearchCsvLine(lines[0]);
  const pathIndex = findSearchSongCsvHeaderIndex(headers, ['path id', 'path_id', 'page_path', 'Path']);
  const artIndex = findSearchSongCsvHeaderIndex(headers, ['album_art_paths', 'Album Path', 'Album Art']);
  const titleIndex = findSearchSongCsvHeaderIndex(headers, ['page_title', 'page title', 'title', 'song title']);
  if (pathIndex === -1 || artIndex === -1) {
    return { imageByPath, titleByPath };
  }

  for (let index = 1; index < lines.length; index += 1) {
    const values = splitSearchCsvLine(lines[index]);
    const pagePathRaw = String(values[pathIndex] || '').trim();
    if (!pagePathRaw) {
      continue;
    }

    const pagePath = pagePathRaw
      .replace(/\.html$/i, '')
      .replace(/^\/+/, '')
      .trim();
    if (!pagePath) {
      continue;
    }

    const normalizedPath = '/music/' + pagePath.replace(/^\/+/, '');
    const firstArt = splitSearchPipeValues(values[artIndex])[0] || '';
    if (firstArt) {
      imageByPath[normalizedPath] = '/public/images/cover-art/' + firstArt;
    }

    const pageTitle = String((titleIndex >= 0 ? (values[titleIndex] || '') : '') || '').trim();
    if (pageTitle) {
      titleByPath[normalizedPath] = pageTitle;
    }
  }

  return { imageByPath, titleByPath };
}

function buildSearchAlbumMapsFromAlbumCsv(csvText) {
  const titleByPath = Object.create(null);
  const imageByPath = Object.create(null);
  const lines = String(csvText || '').split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) {
    return { titleByPath, imageByPath };
  }

  const headers = splitSearchCsvLine(lines[0]);
  const albumIdIndex = findSearchSongCsvHeaderIndex(headers, ['album_id', 'album id']);
  const titleIndex = findSearchSongCsvHeaderIndex(headers, ['album_title', 'album title', 'page_title', 'page title', 'title']);
  const artIndex = findSearchSongCsvHeaderIndex(headers, ['album_art', 'album art', 'album_art_paths', 'album path']);
  if (albumIdIndex === -1) {
    return { titleByPath, imageByPath };
  }

  for (let index = 1; index < lines.length; index += 1) {
    const values = splitSearchCsvLine(lines[index]);
    const albumId = String(values[albumIdIndex] || '').trim().toLowerCase();
    if (!albumId) {
      continue;
    }

    const albumPath = '/music/' + albumId;
    const albumTitle = titleIndex === -1 ? '' : String(values[titleIndex] || '').trim();
    const albumArt = artIndex === -1 ? '' : (splitSearchPipeValues(values[artIndex])[0] || '');

    if (albumTitle) {
      titleByPath[albumPath] = albumTitle;
    }
    if (albumArt) {
      imageByPath[albumPath] = '/public/images/cover-art/' + albumArt;
    }
  }

  return { titleByPath, imageByPath };
}

function buildSearchImageMapFromMotifCsv(csvText) {
  const map = Object.create(null);
  const titleByPath = Object.create(null);
  const lines = String(csvText || '').split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) {
    return { map, titleByPath };
  }

  const headers = splitSearchCsvLine(lines[0]).map((header) => header.toLowerCase());
  const categoryIdIndex = headers.indexOf('category id');
  const motifIdIndex = headers.indexOf('motif id');
  const motifNameIndex = headers.indexOf('motif name');
  const motifImageIndex = headers.indexOf('motif image (page and map)');
  const hasPageIndex = headers.indexOf('has page');
  if (motifIdIndex === -1 || motifImageIndex === -1 || hasPageIndex === -1) {
    return { map, titleByPath };
  }

  const motifRows = [];
  const imageByCategorySlug = Object.create(null);
  let firstMotifImagePath = '';

  for (let index = 1; index < lines.length; index += 1) {
    const values = splitSearchCsvLine(lines[index]);
    const motifId = String(values[motifIdIndex] || '').trim();
    const categoryId = String(categoryIdIndex >= 0 ? (values[categoryIdIndex] || '') : '').trim();
    const motifName = String(motifNameIndex >= 0 ? (values[motifNameIndex] || '') : '').trim();
    if (!motifId || !isSearchTruthyFlag(values[hasPageIndex])) {
      continue;
    }

    const categorySlug = resolveSearchMotifPageSlug(categoryId, motifId);
    if (!categorySlug) {
      continue;
    }

    const imagePath = normalizeSearchImagePath(values[motifImageIndex]);
    motifRows.push({ motifId, categorySlug, imagePath, motifName });

    if (!firstMotifImagePath && imagePath) {
      firstMotifImagePath = imagePath;
    }

    if (imagePath && !imageByCategorySlug[categorySlug]) {
      imageByCategorySlug[categorySlug] = imagePath;
    }

    const motifPath = '/motifs/' + motifId;
    if (motifName && !titleByPath[motifPath]) {
      titleByPath[motifPath] = motifName;
    }

    const categoryPath = '/motifs/' + categorySlug;
    if (motifName && !titleByPath[categoryPath]) {
      titleByPath[categoryPath] = motifName;
    }
  }

  motifRows.forEach((row) => {
    const categoryImage = imageByCategorySlug[row.categorySlug] || firstMotifImagePath || '';
    if (!categoryImage) {
      return;
    }

    const categoryPath = '/motifs/' + row.categorySlug;
    if (!map[categoryPath]) {
      map[categoryPath] = categoryImage;
    }

    const motifPath = '/motifs/' + row.motifId;
    if (!map[motifPath]) {
      map[motifPath] = categoryImage;
    }
  });

  if (firstMotifImagePath) {
    map['/motifs'] = firstMotifImagePath;
  }

  return { map, titleByPath };
}

function normalizeSearchArtistSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function splitSearchArtistPageId(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    return { pageId: '', hashToken: '' };
  }

  const splitIndex = raw.indexOf('#');
  return {
    pageId: splitIndex === -1 ? raw : raw.slice(0, splitIndex),
    hashToken: splitIndex === -1 ? '' : raw.slice(splitIndex + 1)
  };
}

function normalizeSearchArtistHashToken(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^#/, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

function buildSearchArtistInternalPath(value) {
  const parts = splitSearchArtistPageId(value);
  const slug = normalizeSearchArtistSlug(parts.pageId);
  const hashToken = normalizeSearchArtistHashToken(parts.hashToken);
  if (!slug) {
    return '';
  }

  return hashToken ? ('/artists/' + slug + '#' + hashToken) : ('/artists/' + slug);
}

function buildSearchArtistMapFromCsv(csvText) {
  const imageByPath = Object.create(null);
  const summaryBySlug = Object.create(null);
  const lines = String(csvText || '').split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) {
    return { imageByPath, summaryBySlug };
  }

  const headers = splitSearchCsvLine(lines[0]).map((header) => header.toLowerCase());
  const artistIdIndex = headers.indexOf('artist id');
  const artistNameIndex = headers.indexOf('artist name');
  const artistImageIndex = headers.indexOf('artist image');
  const artistLinksIndex = headers.indexOf('artist links');
  const hasPageIndex = headers.indexOf('has page?') !== -1 ? headers.indexOf('has page?') : headers.indexOf('has page');
  const descriptionIndex = headers.indexOf('description');
  if (artistIdIndex === -1) {
    return { imageByPath, summaryBySlug };
  }

  for (let index = 1; index < lines.length; index += 1) {
    const values = splitSearchCsvLine(lines[index]);
    const firstArtistId = splitSearchPipeValues(values[artistIdIndex] || '')[0] || '';
    const firstArtistName = splitSearchPipeValues(values[artistNameIndex] || '')[0] || firstArtistId;
    const parts = splitSearchArtistPageId(firstArtistId);
    const slug = normalizeSearchArtistSlug(parts.pageId || firstArtistId);
    const internalPath = buildSearchArtistInternalPath(firstArtistId);
    if (!slug) {
      continue;
    }

    const hasPage = String(values[hasPageIndex] || '').trim().toUpperCase();
    const links = splitSearchPipeValues(values[artistLinksIndex] || '');
    const externalHref = String(links[0] || '').trim();
    const path = (hasPage === 'FALSE' || hasPage === 'NO' || hasPage === '0') && externalHref
      ? externalHref
      : internalPath;
    const firstImage = splitSearchPipeValues(values[artistImageIndex] || '')[0] || '';
    const normalizedImage = normalizeSearchImagePath(firstImage);
    if (normalizedImage) {
      imageByPath[path] = normalizedImage;
    }

    const description = String(values[descriptionIndex] || '').trim();
    const summaryText = [firstArtistName, description].filter(Boolean).join(' ').trim();
    if (summaryText) {
      summaryBySlug[slug] = summaryText;
    }
  }

  return { imageByPath, summaryBySlug };
}

function ensureSearchImageCsvLoaded(basePath) {
  if (searchImageCsvPromise) {
    return searchImageCsvPromise;
  }

  const songCsvUrl = (basePath || '') + '/public/csv/JamiePedia Data - Songs.csv';
  const motifCsvUrl = (basePath || '') + '/public/csv/JamiePedia Data - Motifs.csv';
  const albumCsvUrl = (basePath || '') + '/public/csv/JamiePedia Data - Albums.csv';
  const artistCsvUrl = (basePath || '') + '/public/csv/JamiePedia Data - Artists.csv';

  searchImageCsvPromise = Promise.all([
    fetch(songCsvUrl, { cache: 'no-store' }).then((response) => response.ok ? response.text() : ''),
    fetch(motifCsvUrl, { cache: 'no-store' }).then((response) => response.ok ? response.text() : ''),
    fetch(albumCsvUrl, { cache: 'no-store' }).then((response) => response.ok ? response.text() : ''),
    fetch(artistCsvUrl, { cache: 'no-store' }).then((response) => response.ok ? response.text() : '')
  ]).then(([songCsvText, motifCsvText, albumCsvText, artistCsvText]) => {
    const songMaps = buildSearchImageMapFromSongCsv(songCsvText);
    const motifMaps = buildSearchImageMapFromMotifCsv(motifCsvText);
    const albumMaps = buildSearchAlbumMapsFromAlbumCsv(albumCsvText);
    const artistMaps = buildSearchArtistMapFromCsv(artistCsvText);
    searchAlbumTitleByPath = albumMaps.titleByPath;
    searchMotifTitleByPath = motifMaps.titleByPath;
    searchPageTitleByPath = Object.assign(Object.create(null), songMaps.titleByPath, albumMaps.titleByPath, motifMaps.titleByPath);
    searchImageByPath = Object.assign(Object.create(null), artistMaps.imageByPath, motifMaps.map, albumMaps.imageByPath, songMaps.imageByPath);
    searchArtistCsvSummariesBySlug = artistMaps.summaryBySlug || Object.create(null);
    const mergedArtistSummaries = Object.assign(Object.create(null), searchArtistCsvSummariesBySlug, searchContentIndex.artists || {});
    searchContentIndex.artists = mergedArtistSummaries;
    return searchImageByPath;
  }).catch(() => {
    searchImageByPath = Object.create(null);
    searchAlbumTitleByPath = Object.create(null);
    searchMotifTitleByPath = Object.create(null);
    searchPageTitleByPath = Object.create(null);
    return searchImageByPath;
  });

  return searchImageCsvPromise;
}

function getSearchMotifSummaryText(motifKeys) {
  const keys = Array.isArray(motifKeys) ? motifKeys : [motifKeys];
  const normalizedKeys = Array.from(new Set(keys.map((key) => String(key || '').trim()).filter(Boolean)));
  const motifIndex = (searchContentIndex && searchContentIndex.motifs) || Object.create(null);
  return normalizedKeys
    .map((key) => String(motifIndex[String(key || '').toLowerCase()] || '').trim())
    .filter(Boolean)
    .join(' ')
    .trim();
}

function getSearchArtistSummaryText(routePath) {
  const artistIndex = (searchContentIndex && searchContentIndex.artists) || Object.create(null);
  const slug = String((routePath || '').split(/[?#]/u)[0].split('/').filter(Boolean).pop() || '').trim().toLowerCase();
  return String(artistIndex[slug] || '').trim();
}

function getSearchArtistPageEntry(routePath) {
  if (typeof window.getArtistPageEntryBySlug !== 'function') {
    return null;
  }

  const rawRoute = String(routePath || '').split('?')[0];
  const pathAndHash = rawRoute.split('#');
  const slug = pathAndHash[0].split('/').filter(Boolean).pop() || '';
  return slug ? window.getArtistPageEntryBySlug(slug, pathAndHash[1] || '') : null;
}

function getSearchArtistCreditsText(routePath, songRows) {
  const artist = getSearchArtistPageEntry(routePath);
  if (!artist) {
    return '';
  }

  const acceptedTokens = new Set();
  [artist.ids, artist.names, artist.aliases && artist.aliases.flatMap((alias) => [alias && alias.id, alias && alias.name]), [artist.primaryName]]
    .flat()
    .forEach((value) => {
      const token = String(value || '').trim().toLowerCase();
      if (token) {
        acceptedTokens.add(token);
      }
    });

  const roleFields = [
    ['artists', 'Artist'],
    ['vocalists', 'Vocalist'],
    ['mixing', 'Mixing'],
    ['mastering', 'Mastering'],
    ['instrumentals', 'Instrumentals']
  ];
  const songsByPath = new Map();
  const albumsById = new Map();

  const hasArtistMention = (value) => {
    const source = String(value || '').toLowerCase();
    return Array.from(acceptedTokens).some((token) => {
      let index = source.indexOf(token);
      while (index !== -1) {
        const before = source[index - 1] || '';
        const after = source[index + token.length] || '';
        if (!/[a-z0-9]/i.test(before) && !/[a-z0-9]/i.test(after)) {
          return true;
        }
        index = source.indexOf(token, index + 1);
      }
      return false;
    });
  };

  (Array.isArray(songRows) ? songRows : []).forEach((row) => {
    const roles = roleFields
      .filter(([key]) => splitSearchRouteValues(normalizeSearchSongRowValue(row, key)).some(hasArtistMention))
      .map(([, label]) => label);
    if (!roles.length) {
      return;
    }

    const rawPath = getSearchSongRowPathValue(row).split('?')[0];
    const pathParts = rawPath.split('#');
    const songSlug = pathParts[0].split('/').filter(Boolean).pop() || '';
    const songTitle = getSearchSongRowTitle(row);
    if (songSlug && songTitle) {
      const href = '/music/' + songSlug.replace(/\.html$/i, '') + (pathParts[1] ? '#' + pathParts[1] : '');
      if (!songsByPath.has(href)) {
        songsByPath.set(href, { title: songTitle, roles: new Set() });
      }
      roles.forEach((role) => songsByPath.get(href).roles.add(role));
    }

    splitSearchRouteValues(normalizeSearchSongRowValue(row, 'album_id')).forEach((albumId) => {
      const id = albumId.toLowerCase();
      const albumTitle = normalizeSearchSongRowValue(row, 'album_title');
      if (!id || !albumTitle) {
        return;
      }
      if (!albumsById.has(id)) {
        albumsById.set(id, { title: albumTitle, roles: new Set() });
      }
      roles.forEach((role) => albumsById.get(id).roles.add(role));
    });
  });

  const formatCredits = (items) => Array.from(items.values())
    .map((item) => item.title + ' (' + Array.from(item.roles).join(', ') + ')');
  const songCredits = formatCredits(songsByPath);
  const albumCredits = formatCredits(albumsById);
  const sections = [];
  if (songCredits.length) {
    sections.push('Songs: ' + songCredits.join('; '));
  }
  if (albumCredits.length) {
    sections.push('Albums: ' + albumCredits.join('; '));
  }
  return sections.length ? 'Credits: ' + sections.join(' ') : '';
}

function getSearchPageTitle(routePath) {
  const normalizedPath = normalizeSearchRoutePath(routePath);
  if (!normalizedPath) {
    return '';
  }

  if (searchPageTitleByPath[normalizedPath]) {
    return String(searchPageTitleByPath[normalizedPath] || '').trim();
  }

  const pathParts = normalizedPath.split('/').filter(Boolean);
  const pageType = String(pathParts[0] || '').trim().toLowerCase();
  const slug = String(pathParts[1] || '').trim();
  if (!slug) {
    return '';
  }

  if (pageType === 'motifs') {
    return slug.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  if (pageType === 'music') {
    return slug.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  if (pageType === 'artists') {
    return slug.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  return '';
}

function getSearchPageImage(routePath) {
  const normalizedPath = normalizeSearchRoutePath(routePath);
  if (!normalizedPath) {
    return '';
  }

  const imageValue = String(searchImageByPath[normalizedPath] || '').trim();
  if (!imageValue) {
    return '';
  }

  const basePath = (window.location.pathname.includes('/JamiePedia/') ? '/JamiePedia' : '');
  return resolveSearchImageSrc(basePath, normalizedPath, imageValue);
}

function getSearchPageSummaryText(routePath) {
  const normalizedPath = normalizeSearchRoutePath(routePath);
  const pathParts = normalizedPath.split('/').filter(Boolean);
  const pageType = String(pathParts[0] || '').trim().toLowerCase();
  const slug = String(pathParts[1] || '').trim().toLowerCase();
  if (!slug) {
    return '';
  }

  const index = searchContentIndex || {
    songs: Object.create(null),
    albums: Object.create(null),
    motifs: Object.create(null),
    artists: Object.create(null)
  };

  if (pageType === 'artists') {
    return getSearchArtistSummaryText(normalizedPath);
  }

  if (pageType === 'music') {
    const albumEntry = (index.albums && index.albums[slug]) || null;
    const albumSummary = albumEntry && typeof albumEntry === 'object' ? String(albumEntry.summary || '').trim() : '';
    if (albumSummary) {
      return albumSummary;
    }

    const songEntry = (index.songs && index.songs[slug]) || null;
    if (!songEntry || typeof songEntry !== 'object') {
      return '';
    }

    return String(songEntry.summary || '').trim();
  }

  if (pageType === 'motifs') {
    const motifEntry = index.motifs && (index.motifs[slug] || index.motifs[slug.toLowerCase()]);
    return String(motifEntry || '').trim();
  }

  return '';
}

window.getSearchArtistSummaryText = getSearchArtistSummaryText;
window.getSearchPageSummaryText = getSearchPageSummaryText;
window.getSearchPageTitle = getSearchPageTitle;
window.getSearchPageImage = getSearchPageImage;
window.ensureSearchContentIndexLoaded = ensureSearchContentIndexLoaded;

function buildSearchSnippet(text, query) {
  const sourceText = String(text || '')
    .replace(/\s*\|\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const normalizedQuery = String(query || '').toLowerCase();
  if (!sourceText || !normalizedQuery) {
    return {
      snippet: '',
      hasContentBefore: false,
      hasContentAfter: false
    };
  }

  const lowerSource = sourceText.toLowerCase();
  const index = lowerSource.indexOf(normalizedQuery);
  if (index >= 0) {
    const start = Math.max(0, index - 180);
    const end = Math.min(sourceText.length, index + normalizedQuery.length + 180);
    return {
      snippet: sourceText.substring(start, end).trim(),
      hasContentBefore: start > 0,
      hasContentAfter: end < sourceText.length
    };
  }

  const queryTerms = Array.from(new Set(tokenizeSearchText(query)));
  const ranges = queryTerms.map((term) => {
    let termIndex = lowerSource.indexOf(term);
    if (termIndex < 0 && term.length >= 4) {
      const sourceWords = sourceText.matchAll(/[\p{L}\p{N}]+/gu);
      let bestMatch = null;
      for (const match of sourceWords) {
        const similarity = getSearchEditSimilarity(term, match[0].toLowerCase());
        if (similarity >= 0.68 && (!bestMatch || similarity > bestMatch.similarity)) {
          bestMatch = { index: match.index, similarity };
        }
      }
      termIndex = bestMatch ? bestMatch.index : -1;
    }
    return termIndex < 0 ? null : {
      start: Math.max(0, termIndex - 100),
      end: Math.min(sourceText.length, termIndex + term.length + 100)
    };
  }).filter(Boolean).sort((left, right) => left.start - right.start);

  if (!ranges.length) {
    const snippet = sourceText.slice(0, 360).trim();
    return {
      snippet,
      hasContentBefore: false,
      hasContentAfter: sourceText.length > snippet.length
    };
  }

  const mergedRanges = [];
  ranges.forEach((range) => {
    const previousRange = mergedRanges[mergedRanges.length - 1];
    if (previousRange && range.start <= previousRange.end) {
      previousRange.end = Math.max(previousRange.end, range.end);
    } else {
      mergedRanges.push({ ...range });
    }
  });

  const snippet = mergedRanges
    .map((range) => sourceText.slice(range.start, range.end).trim())
    .join(' ... ');
  const start = mergedRanges[0].start;
  const end = mergedRanges[mergedRanges.length - 1].end;
  return {
    snippet,
    hasContentBefore: start > 0,
    hasContentAfter: end < sourceText.length
  };
}

const searchFieldWeights = {
  title: 9,
  lyrics: 6,
  summary: 3.5,
  tracklist: 3,
  connections: 2.5,
  credits: 2,
  metadata: 1.5,
  extended: 1.5
};

function tokenizeSearchText(value) {
  const normalized = String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
  return normalized.match(/[\p{L}\p{N}]+/gu) || [];
}

function buildSearchTermFrequencies(value) {
  const frequencies = new Map();
  const tokens = tokenizeSearchText(value);
  tokens.forEach((token) => frequencies.set(token, (frequencies.get(token) || 0) + 1));
  return { frequencies, length: tokens.length };
}

function getSearchEditSimilarity(left, right) {
  if (left === right) {
    return 1;
  }
  if (!left || !right) {
    return 0;
  }

  let previous = Array.from({ length: right.length + 1 }, (_value, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitutionCost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + substitutionCost
      );
    }
    previous = current;
  }

  return 1 - previous[right.length] / Math.max(left.length, right.length);
}

function rankSearchResults(results, query) {
  const terms = Array.from(new Set(tokenizeSearchText(query)));
  const documents = (Array.isArray(results) ? results : []).map((result, index) => {
    const fields = result.searchFields || {};
    const tokenizedFields = Object.create(null);
    Object.keys(searchFieldWeights).forEach((field) => {
      tokenizedFields[field] = buildSearchTermFrequencies(fields[field] || '');
    });
    return { result, index, fields, tokenizedFields };
  });

  if (!terms.length || !documents.length) {
    return [];
  }

  const fieldStats = Object.create(null);
  const vocabulary = new Set();
  Object.keys(searchFieldWeights).forEach((field) => {
    const totalLength = documents.reduce((sum, document) => {
      const tokenData = document.tokenizedFields[field];
      tokenData.frequencies.forEach((_frequency, token) => vocabulary.add(token));
      return sum + tokenData.length;
    }, 0);
    fieldStats[field] = {
      averageLength: totalLength / Math.max(1, documents.length),
      documentFrequency: new Map()
    };

    terms.forEach((term) => {
      const frequency = documents.reduce((count, document) => (
        count + (document.tokenizedFields[field].frequencies.has(term) ? 1 : 0)
      ), 0);
      fieldStats[field].documentFrequency.set(term, frequency);
    });
  });

  const fuzzyTermsByQueryTerm = new Map();
  terms.forEach((term) => {
    if (vocabulary.has(term) || term.length < 4) {
      fuzzyTermsByQueryTerm.set(term, []);
      return;
    }

    const matches = [];
    vocabulary.forEach((candidate) => {
      if (Math.abs(candidate.length - term.length) > 2) {
        return;
      }
      const similarity = getSearchEditSimilarity(term, candidate);
      if (similarity >= 0.68) {
        matches.push({ token: candidate, similarity });
      }
    });
    fuzzyTermsByQueryTerm.set(term, matches);
  });

  const queryPhrase = String(query || '').trim().toLowerCase();
  documents.forEach((document) => {
    let score = 0;
    let matchedTerms = 0;
    let titleMatchedTerms = 0;
    let fuzzyTitleMatches = 0;
    terms.forEach((term) => {
      let termMatched = false;
      const titleFrequencies = document.tokenizedFields.title.frequencies;
      if (titleFrequencies.has(term)) {
        titleMatchedTerms += 1;
      } else {
        const titleFuzzyMatch = (fuzzyTermsByQueryTerm.get(term) || [])
          .find((match) => titleFrequencies.has(match.token));
        if (titleFuzzyMatch) {
          titleMatchedTerms += 1;
          fuzzyTitleMatches += 1;
        }
      }

      Object.keys(searchFieldWeights).forEach((field) => {
        const tokenData = document.tokenizedFields[field];
        let termFrequency = tokenData.frequencies.get(term) || 0;
        let fuzzyFactor = 1;

        if (!termFrequency) {
          const fuzzyMatches = fuzzyTermsByQueryTerm.get(term) || [];
          let bestMatch = null;
          fuzzyMatches.forEach((match) => {
            const frequency = tokenData.frequencies.get(match.token) || 0;
            if (frequency && (!bestMatch || match.similarity > bestMatch.similarity)) {
              bestMatch = Object.assign({ frequency }, match);
            }
          });
          if (bestMatch) {
            termFrequency = bestMatch.frequency;
            fuzzyFactor = 0.25 * bestMatch.similarity;
          }
        }

        if (!termFrequency) {
          return;
        }
        termMatched = true;

        let documentFrequency = fieldStats[field].documentFrequency.get(term) || 0;
        if (documentFrequency === 0 && fuzzyFactor < 1) {
          documentFrequency = documents.reduce((count, candidateDocument) => {
            const frequencies = candidateDocument.tokenizedFields[field].frequencies;
            return count + ((fuzzyTermsByQueryTerm.get(term) || []).some((match) => frequencies.has(match.token)) ? 1 : 0);
          }, 0);
        }

        const totalDocuments = documents.length;
        const inverseDocumentFrequency = Math.log(1 + ((totalDocuments - documentFrequency + 0.5) / (documentFrequency + 0.5)));
        const averageLength = fieldStats[field].averageLength || 1;
        const lengthNormalization = 1.2 * (1 - 0.75 + 0.75 * tokenData.length / averageLength);
        const bm25TermScore = inverseDocumentFrequency * ((termFrequency * 2.2) / (termFrequency + lengthNormalization));
        score += searchFieldWeights[field] * bm25TermScore * fuzzyFactor;
      });
      if (termMatched) {
        matchedTerms += 1;
      }
    });

    const lowerTitle = String(document.fields.title || '').toLowerCase();
    const phraseMatch = queryPhrase && Object.values(document.fields).some((value) => String(value || '').toLowerCase().includes(queryPhrase));
    if (lowerTitle === queryPhrase) {
      score += 40;
    } else if (lowerTitle.startsWith(queryPhrase)) {
      score += 24;
    } else if (lowerTitle.includes(queryPhrase)) {
      score += 16;
    } else if (phraseMatch) {
      score += 4;
    }
    if (terms.length > 1 && titleMatchedTerms === terms.length) {
      score += fuzzyTitleMatches ? 24 : 12;
    }

    document.matchedTerms = matchedTerms;
    document.result.relevanceScore = score * (1 + matchedTerms / terms.length);
  });

  return documents
    .filter((document) => document.result.relevanceScore > 0 && document.matchedTerms === terms.length)
    .sort((left, right) => right.result.relevanceScore - left.result.relevanceScore || left.index - right.index)
    .map((document) => document.result);
}

function getSearchSongExternalContent(routePath, songRows) {
  const slugs = getSearchSongVariantSlugsFromRows(routePath, songRows);
  const songIndex = (searchContentIndex && searchContentIndex.songs) || Object.create(null);
  const variantSlug = slugs[0] || '';
  const isAltPage = variantSlug.includes('#');
  const mainSlug = isAltPage ? variantSlug.split('#')[0] : variantSlug;
  const mainEntry = songIndex[mainSlug] || null;
  const content = {
    summary: '',
    lyrics: '',
    extended: ''
  };

  slugs.forEach((slug) => {
    const key = String(slug || '').trim().toLowerCase();
    if (!key) {
      return;
    }

    const entry = songIndex[key] || null;
    if (!entry || typeof entry !== 'object') {
      return;
    }

    const summaryText = String(entry.summary || '').trim();
    const annotationsText = String(entry.annotations || '').trim();
    const lyricsText = annotationsText || String(entry.lyrics || '').trim();
    const extendedText = String(entry.extended || '').trim();
    const mainSummaryText = String((mainEntry || {}).summary || '').trim();

    if (summaryText && !(isAltPage && summaryText === mainSummaryText)) {
      content.summary += ' ' + summaryText;
    }
    if (lyricsText) {
      content.lyrics += ' ' + lyricsText;
    }
    if (extendedText) {
      content.extended += ' ' + extendedText;
    }
  });

  content.summary = content.summary.trim();
  content.lyrics = content.lyrics.trim();
  content.extended = content.extended.trim();
  return content;
}

function getSearchAlbumExternalContent(routePath) {
  const normalizedRoute = normalizeSearchRoutePath(routePath);
  const albumSlug = normalizedRoute.split('/').filter(Boolean).pop() || '';
  const albumIndex = (searchContentIndex && searchContentIndex.albums) || Object.create(null);
  const entry = albumIndex[String(albumSlug || '').toLowerCase()] || null;

  return {
    summary: String((entry || {}).summary || '').trim(),
    lyrics: '',
    extended: String((entry || {}).extended || '').trim()
  };
}

function getSearchAlbumTracklistText(rows) {
  const tracksByTitle = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const title = getSearchSongRowTitle(row).replace(/\s*\|\s*/gu, ' ').trim();
    const trackNumbers = splitSearchRouteValues(normalizeSearchSongRowValue(row, 'album_track'));
    const key = title.toLowerCase();
    if (!title || tracksByTitle.has(key)) {
      return;
    }

    const trackNumber = Number.parseFloat(trackNumbers[0] || '');
    tracksByTitle.set(key, {
      title,
      trackNumber: Number.isFinite(trackNumber) ? trackNumber : Number.POSITIVE_INFINITY
    });
  });

  const tracks = Array.from(tracksByTitle.values())
    .sort((left, right) => left.trackNumber - right.trackNumber || left.title.localeCompare(right.title));
  return tracks.length ? 'Tracklist: ' + tracks.map((track) => track.title).join(' | ') : '';
}

// Fetch and search a single file
function searchFile(fileEntry, query, searchContext) {
  try {
    const context = searchContext || {};
    const basePath = context.basePath || (window.location.pathname.includes('/JamiePedia/') ? '/JamiePedia' : '');
    const routePath = normalizeSearchRoutePath(fileEntry.path);
    const pathParts = routePath.split('/').filter(Boolean);
    const isMotifPage = routePath === '/motifs' || pathParts[0] === 'motifs';
    const isMusicPage = pathParts[0] === 'music';
    const isArtistPage = routePath === '/artists' || pathParts[0] === 'artists';
    const motifRouteSlug = pathParts[1] || '';
    const motifCategoryId = String((fileEntry || {}).motifCategoryId || motifRouteSlug || '').trim();
    const motifIdFromEntry = String((fileEntry || {}).motifId || '').trim();
    const motifSummaryKeys = Array.from(new Set([
      motifRouteSlug,
      motifCategoryId,
      motifIdFromEntry
    ].filter(Boolean)));

    const songRows = Array.isArray(context.songRows) ? context.songRows : [];
    const matchingSongRows = isMusicPage ? getSearchSongRowsForRoute(fileEntry.path, songRows) : [];
    const isSongPage = isMusicPage && matchingSongRows.length > 0;
    const isAlbumPage = isMusicPage && pathParts.length === 2 && matchingSongRows.length === 0;
    const albumRows = isAlbumPage ? getSearchSongRowsForAlbum(pathParts[1] || '', songRows) : [];
    const rowsForMetadata = isSongPage ? matchingSongRows : albumRows;

    const titleFromRows = (() => {
      if (isAlbumPage) {
        return String(searchAlbumTitleByPath[fileEntry.path] || fileEntry.album || '').trim();
      }

      if (isSongPage) {
        const entryTitle = String((fileEntry || {}).title || '').trim();
        if (entryTitle) {
          return entryTitle;
        }
      }

      for (const row of rowsForMetadata) {
        const rowTitle = getSearchSongRowTitle(row);
        if (rowTitle) {
          return rowTitle;
        }
      }
      return '';
    })();

    const title = titleFromRows || (() => {
      if (isMotifPage) {
        const motifTitle = String((fileEntry || {}).title || '').trim();
        if (motifTitle) {
          return motifTitle;
        }

        const motifSlug = pathParts[1] || '';
        return motifSlug ? motifSlug.replace(/-/g, ' ') : 'Motifs';
      }

      if (isArtistPage) {
        return String((fileEntry || {}).title || '').trim() || ((pathParts[1] || '').replace(/-/g, ' ') || 'Artists');
      }

      const fileName = String(routePath || '').split('/').pop() || '';
      return fileName.replace(/-/g, ' ');
    })();

    const songMetadata = isMusicPage
      ? buildSearchMetadataText(rowsForMetadata, fileEntry.album)
      : { displayText: '', searchableText: '' };
    const songMetadataText = songMetadata.searchableText;

    const externalContent = isSongPage
      ? getSearchSongExternalContent(fileEntry.path, songRows)
      : isAlbumPage
        ? Object.assign(getSearchAlbumExternalContent(routePath), {
          tracklist: getSearchAlbumTracklistText(albumRows)
        })
        : isMotifPage
          ? { summary: getSearchMotifSummaryText(motifSummaryKeys), lyrics: '', extended: '' }
          : isArtistPage
            ? {
              summary: getSearchArtistSummaryText(routePath),
              credits: getSearchArtistCreditsText(fileEntry.path, songRows),
              lyrics: '',
              extended: ''
            }
            : { summary: '', credits: '', lyrics: '', extended: '' };

    const motifRelatedSongs = isMotifPage ? getSearchSongsForMotifKeys(motifSummaryKeys, songRows) : [];
    const motifRelatedText = motifRelatedSongs.length ? 'Songs with this motif: ' + motifRelatedSongs.join(' | ') : '';
    const motifNames = isSongPage ? getSearchMotifNamesForSongRows(matchingSongRows) : [];
    const referencedSongs = isSongPage ? getSearchReferencedSongsForSongRows(matchingSongRows, songRows) : [];
    const motifsText = motifNames.length ? 'Motifs: ' + motifNames.join(' | ') : '';
    const songReferencesText = referencedSongs.length ? 'Referenced songs: ' + referencedSongs.join(' | ') : '';
    const connectionsText = [motifRelatedText, motifsText, songReferencesText].filter(Boolean).join(' ');
    const searchFields = {
      title,
      summary: externalContent.summary || '',
      lyrics: externalContent.lyrics || '',
      extended: externalContent.extended || '',
      credits: externalContent.credits || '',
      tracklist: externalContent.tracklist || '',
      connections: connectionsText,
      metadata: songMetadata.displayText || ''
    };
    const orderedDisplayText = [
      title,
      externalContent.lyrics ? 'Lyrics: ' + externalContent.lyrics : '',
      externalContent.summary,
      externalContent.credits,
      externalContent.extended,
      externalContent.tracklist,
      connectionsText,
      songMetadata.displayText
    ].filter(Boolean);
    const combinedSearchText = orderedDisplayText.join(' ').replace(/\s+/g, ' ').trim();
    const searchableText = [
      title,
      externalContent.summary,
      externalContent.credits,
      externalContent.extended,
      externalContent.tracklist,
      externalContent.lyrics,
      connectionsText,
      songMetadataText
    ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();

    const lowerTextWithBr = searchableText.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const matchesSearch = lowerQuery === 'lyrics'
      ? Boolean(externalContent.lyrics)
      : true;
    
    if (matchesSearch) {
      // Extract cover art image
      let coverSrc = basePath + '/public/images/cover-art/as.png'; // default fallback
      const csvCoverPath = searchImageByPath[fileEntry.path] || '';
      if (csvCoverPath) {
        const resolvedCsvCover = resolveSearchImageSrc(basePath, fileEntry.path, csvCoverPath);
        if (resolvedCsvCover) {
          coverSrc = resolvedCsvCover;
        }
      }
      
      if (!csvCoverPath) {
        // Fallback to page HTML images when CSV has no mapping.
        const coverImg = document.getElementById('album-art-image');
        if (coverImg && coverImg.getAttribute('src')) {
          const imagePath = coverImg.getAttribute('src');
          const resolvedCoverSrc = resolveSearchImageSrc(basePath, fileEntry.path, imagePath);
          if (resolvedCoverSrc) {
            coverSrc = resolvedCoverSrc;
          }
        } else {
          const albumCoverContainer = document.querySelector('.album-cover-container img');
          if (albumCoverContainer && albumCoverContainer.getAttribute('src')) {
            const imagePath = albumCoverContainer.getAttribute('src');
            const resolvedCoverSrc = resolveSearchImageSrc(basePath, fileEntry.path, imagePath);
            if (resolvedCoverSrc) {
              coverSrc = resolvedCoverSrc;
            }
          }
        }
      }
      
      // Detect which content types contain the search query
      const contentTypes = [];
      
      if (isSongPage) {
        if ((songMetadataText || '').toLowerCase().includes(lowerQuery)) {
          contentTypes.push('metadata');
        }

        const summaryText = (externalContent.summary || '');
        if (summaryText.toLowerCase().includes(lowerQuery)) {
          contentTypes.push('summary');
        }
        const lyricsText = externalContent.lyrics || '';
        if (lyricsText.toLowerCase().includes(lowerQuery)) {
          contentTypes.push('lyrics');
        }
        if (connectionsText.toLowerCase().includes(lowerQuery)) {
          contentTypes.push('connections');
        }
        const extendedText = externalContent.extended || '';
        if (extendedText.toLowerCase().includes(lowerQuery)) {
          contentTypes.push('extended');
        }
      }

      if (isAlbumPage && songMetadataText.toLowerCase().includes(lowerQuery)) {
        contentTypes.push('metadata');
      }

      if (isMotifPage) {
        if (combinedSearchText.toLowerCase().includes(lowerQuery) && !contentTypes.includes('metadata')) {
          contentTypes.push('metadata');
        }
        if ((externalContent.summary || '').toLowerCase().includes(lowerQuery)) {
          contentTypes.push('summary');
        }
      }
      
      // Check for page titles (directly check if songTitle contains the query)
      if (title && title.toLowerCase().includes(lowerQuery)) {
        contentTypes.push('page-titles');
      }
      
      // If no specific content type detected, mark as general
      if (contentTypes.length === 0) {
        contentTypes.push('other');
      }

      const snippetData = buildSearchSnippet(combinedSearchText, query);
      
      return {
        album: fileEntry.album,
        title: title,
        fullContent: combinedSearchText,
        searchFields,
        url: fileEntry.path,
        content: snippetData.snippet,
        contentHasContentBefore: snippetData.hasContentBefore,
        contentHasContentAfter: snippetData.hasContentAfter,
        coverSrc: coverSrc,
        pageType: isAlbumPage ? 'album' : (isMotifPage ? 'motif' : 'song'),
        contentTypes: contentTypes
      };
    }
  } catch (e) {
    // File fetch failed, skip
  }
  return null;
}

// Perform search across all site files
async function performSearch(query) {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return;
  }
  
  const resultsContainer = document.getElementById('searchResults');
  resultsContainer.innerHTML = '<p style="color: var(--theme-color-text_muted); text-align: center;">Searching...</p>';
  
  const modal = document.getElementById('searchModal');
  modal.style.display = 'block';

  const basePath = window.location.pathname.includes('/JamiePedia/') ? '/JamiePedia' : '';
  const pathsReadyPromise = typeof window.whenMusicFilePathsReady === 'function'
    ? window.whenMusicFilePathsReady()
    : Promise.resolve(window.musicFilePaths || []);

  const [songRows] = await Promise.all([
    ensureSearchSongRowsLoaded(basePath),
    ensureSearchImageCsvLoaded(basePath),
    ensureSearchContentIndexLoaded(basePath),
    ensureSearchMotifIndexLoaded(basePath),
    typeof window.ensureArtistDirectoryLoaded === 'function' ? window.ensureArtistDirectoryLoaded() : Promise.resolve(null),
    pathsReadyPromise
  ]);

  const searchContext = {
    basePath,
    songRows: Array.isArray(songRows) ? songRows : []
  };
  
  const results = [];
  const paths = Array.isArray(window.musicFilePaths) ? window.musicFilePaths : [];
  const searchPromises = paths.map((fileEntry) => Promise.resolve(searchFile(fileEntry, trimmedQuery, searchContext)));
  const searchResults = await Promise.all(searchPromises);
  
  searchResults.forEach(result => {
    if (result) {
      results.push(result);
    }
  });

  const rankedResults = trimmedQuery.toLowerCase() === 'lyrics'
    ? results.filter((result) => Boolean(result.searchFields && result.searchFields.lyrics))
    : rankSearchResults(results, trimmedQuery);

  displaySearchResults(rankedResults, query);
  currentSearchQuery = query;
  
  // Store results and query for filtering
  fullSearchResults = rankedResults;
}

// Display search results in modal
function displaySearchResults(results, originalQuery) {
  const resultsContainer = document.getElementById('searchResults');
  const searchTitle = document.getElementById('searchTitle');
  const basePath = window.location.pathname.includes('/JamiePedia/') ? '/JamiePedia' : '';
  
  resultsContainer.innerHTML = '';
  
  if (results.length === 0) {
    resultsContainer.innerHTML = '<p style="color: var(--theme-color-text_muted);">No results found for "' + originalQuery + '"</p>';
    searchTitle.textContent = 'Search Results (0)';
  } else {
    searchTitle.textContent = 'Search Results (' + results.length + ')';
    results.forEach(item => {
      const resultDiv = document.createElement('div');
      resultDiv.style.cssText = 'margin-bottom: 15px; padding: 10px; border: 3px solid var(--theme-color-brand_frame); background: var(--theme-color-background_base); display: flex; gap: 15px; align-items: flex-start; border-radius: 5px;';
      
      const coverImg = document.createElement('img');
      // Ensure absolute paths have basePath prepended for GitHub Pages
      let imgSrc = item.coverSrc;
      if (imgSrc.startsWith('/') && !imgSrc.startsWith(basePath)) {
        imgSrc = basePath + imgSrc;
      }
      coverImg.src = imgSrc;
      coverImg.onerror = function () {
        this.onerror = null;
        this.src = basePath + '/public/images/cover-art/as.png';
      };
      coverImg.alt = item.title;
      coverImg.style.cssText = 'width: 80px; height: auto; flex-shrink: 0; border: 1px solid var(--theme-color-border_pill); border-radius: 2px;';
      
      const contentDiv = document.createElement('div');
      contentDiv.style.cssText = 'flex: 1;';
      const resultHref = typeof window.toSiteHref === 'function'
        ? window.toSiteHref(basePath + item.url)
        : basePath + item.url;
      const albumLabel = document.createElement('div');
      albumLabel.style.cssText = 'font-size: 12px; color: var(--theme-color-text_muted); font-weight: bold;';
      albumLabel.textContent = item.album || '';
      contentDiv.appendChild(albumLabel);

      const titleLink = document.createElement('a');
      titleLink.href = resultHref;
      titleLink.style.cssText = 'color: var(--theme-color-link_default); text-decoration: none; font-size: 16px; font-weight: bold;';
      titleLink.textContent = item.title || '';
      contentDiv.appendChild(titleLink);

      const excerpt = document.createElement('p');
      excerpt.style.cssText = 'margin: 5px 0 0 0; color: var(--theme-page-text); font-size: 13px;';
      const beforeEllipsis = item.contentHasContentBefore ? '...' : '';
      const afterEllipsis = item.contentHasContentAfter ? '...' : '';
      appendSearchHighlightedText(excerpt, beforeEllipsis + item.content + afterEllipsis, originalQuery);
      contentDiv.appendChild(excerpt);
      
      resultDiv.appendChild(coverImg);
      resultDiv.appendChild(contentDiv);
      resultsContainer.appendChild(resultDiv);
    });
  }
}

function appendSearchHighlightedText(container, text, query) {
  const source = String(text || '');
  const normalizedQuery = String(query || '');
  if (!normalizedQuery) {
    container.appendChild(document.createTextNode(source));
    return;
  }

  const lowerSource = source.toLowerCase();
  const lowerQuery = normalizedQuery.toLowerCase();
  let cursor = 0;
  let matchIndex = lowerSource.indexOf(lowerQuery, cursor);
  while (matchIndex !== -1) {
    if (matchIndex > cursor) {
      container.appendChild(document.createTextNode(source.slice(cursor, matchIndex)));
    }
    const highlight = document.createElement('strong');
    highlight.textContent = source.slice(matchIndex, matchIndex + normalizedQuery.length);
    highlight.style.cssText = 'background-color: var(--theme-color-surface_highlight); color: var(--theme-color-text_base_black); font-weight: bold;';
    container.appendChild(highlight);
    cursor = matchIndex + normalizedQuery.length;
    matchIndex = lowerSource.indexOf(lowerQuery, cursor);
  }
  if (cursor < source.length) {
    container.appendChild(document.createTextNode(source.slice(cursor)));
  }
}

// Handle search input changes in modal
function handleModalSearchChange(e) {
  const query = e.target.value.trim();
  if (query) {
    performSearch(query);
  }
}

// Open search modal
function openSearchModal() {
  const query = document.getElementById('searchInput').value.trim();
  const resultFilterInput = document.getElementById('resultFilterInput');
  
  // Pre-populate the modal search input with main search bar value
  if (resultFilterInput) {
    resultFilterInput.value = query;
  }
  
  // Hide filters box by default
  const filterBox = document.getElementById('filterBox');
  if (filterBox) {
    filterBox.style.display = 'none';
  }
  
  // Reset all exclusion checkboxes
  document.getElementById('excludeAlbums').checked = false;
  document.getElementById('excludeSongs').checked = false;
  document.getElementById('excludeTitles').checked = false;
  document.getElementById('excludeSummary').checked = false;
  document.getElementById('excludeLyrics').checked = false;
  document.getElementById('excludeConnections').checked = false;
  document.getElementById('excludeExtended').checked = false;
  document.getElementById('excludeMetadata').checked = false;
  
  performSearch(query);
}

// Apply filters based on checkboxes
function applyResultsFilter() {
  // Get selected content exclusions (checkboxes)
  const excludedContentTypes = [];
  
  // Page type filters (new checkboxes)
  if (document.getElementById('excludeAlbums') && document.getElementById('excludeAlbums').checked) {
    excludedContentTypes.push('album');
  }
  if (document.getElementById('excludeSongs') && document.getElementById('excludeSongs').checked) {
    excludedContentTypes.push('song');
  }
  
  // Content type filters
  if (document.getElementById('excludeTitles') && document.getElementById('excludeTitles').checked) {
    excludedContentTypes.push('page-titles');
  }
  if (document.getElementById('excludeSummary') && document.getElementById('excludeSummary').checked) {
    excludedContentTypes.push('summary');
  }
  if (document.getElementById('excludeLyrics') && document.getElementById('excludeLyrics').checked) {
    excludedContentTypes.push('lyrics');
  }
  if (document.getElementById('excludeConnections') && document.getElementById('excludeConnections').checked) {
    excludedContentTypes.push('connections');
  }
  if (document.getElementById('excludeExtended') && document.getElementById('excludeExtended').checked) {
    excludedContentTypes.push('extended');
  }
  if (document.getElementById('excludeMetadata') && document.getElementById('excludeMetadata').checked) {
    excludedContentTypes.push('metadata');
  }
  
  // Filter results
  let filteredResults = fullSearchResults;
  
  // Filter by excluded page types
  if (excludedContentTypes.includes('album') || excludedContentTypes.includes('song')) {
    filteredResults = filteredResults.filter(result => {
      return !(
        (excludedContentTypes.includes('album') && result.pageType === 'album') ||
        (excludedContentTypes.includes('song') && result.pageType === 'song')
      );
    });
  }
  
  // Filter by excluded content types
  const contentExclusions = excludedContentTypes.filter(type => 
    !['album', 'song'].includes(type)
  );
  
  if (contentExclusions.length > 0) {
    filteredResults = filteredResults.filter(result => {
      // Keep result only if it has at least one content type that is NOT excluded
      return result.contentTypes.some(contentType => !contentExclusions.includes(contentType));
    });
  }
  
  displaySearchResults(filteredResults, currentSearchQuery);
}

// Close search modal
function closeSearchModal() {
  document.getElementById('searchModal').style.display = 'none';
}

// Handle search button click
function handleSearchClick(e) {
  e.preventDefault();
  openSearchModal();
}

// Initialize search handlers
function initializeSearch() {
  const searchBtn = document.getElementById('searchBtn');
  const closeBtn = document.getElementById('closeSearchModal');
  const modal = document.getElementById('searchModal');
  const searchInput = document.getElementById('searchInput');
  const resultFilterInput = document.getElementById('resultFilterInput');
  const filtersToggleBtn = document.getElementById('filtersToggleBtn');
  const filterBox = document.getElementById('filterBox');
  
  if (searchBtn) {
    searchBtn.addEventListener('click', handleSearchClick);
  }
  
  if (closeBtn) {
    closeBtn.addEventListener('click', closeSearchModal);
  }
  
  if (modal) {
    // Close modal when clicking outside the modal content
    modal.addEventListener('click', function(e) {
      if (e.target === modal) {
        closeSearchModal();
      }
    });
  }
  
  // Allow Enter key to search
  if (searchInput) {
    searchInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        handleSearchClick(e);
      }
    });
  }
  
  // Add event listener for modal search input changes
  if (resultFilterInput) {
    let searchTimeout;
    resultFilterInput.addEventListener('input', function(e) {
      clearTimeout(searchTimeout);
      // Debounce search to avoid excessive searches while typing
      searchTimeout = setTimeout(function() {
        handleModalSearchChange(e);
      }, 300);
    });
  }
  
  // Add event listener for filters toggle button
  if (filtersToggleBtn && filterBox) {
    filtersToggleBtn.addEventListener('click', function(e) {
      e.preventDefault();
      filterBox.style.display = filterBox.style.display === 'none' ? 'block' : 'none';
    });
  }

  // Add event listeners for all filter checkboxes
  const checkboxes = [
    'excludeAlbums',
    'excludeSongs',
    'excludeTitles',
    'excludeSummary',
    'excludeLyrics',
    'excludeConnections',
    'excludeExtended',
    'excludeMetadata'
  ];
  
  checkboxes.forEach(checkboxId => {
    const checkbox = document.getElementById(checkboxId);
    if (checkbox) {
      checkbox.addEventListener('change', applyResultsFilter);
    }
  });
}
