// Store full search results for filtering
let fullSearchResults = [];
let currentSearchQuery = '';
let searchImageCsvPromise = null;
let searchImageByPath = Object.create(null);
let searchAlbumTitleByPath = Object.create(null);
let searchSongRowsPromise = null;
let searchContentIndexPromise = null;
let searchContentIndex = {
  songs: Object.create(null),
  albums: Object.create(null),
  motifs: Object.create(null)
};

const searchSongCsvHeaderAliases = {
  page_path: ['page_path', 'path_id', 'path', 'page path', 'path id'],
  title: ['page_title', 'page title', 'title', 'song title'],
  album_id: ['album_id', 'album id'],
  album_title: ['album_title', 'album title'],
  artists: ['artists', 'artist'],
  vocalists: ['vocalists', 'vocalist'],
  mixing: ['mixing'],
  mastering: ['mastering'],
  instrumentals: ['instrumentals'],
  listen_text: ['listen_text', 'listen text'],
  listen_links: ['listen_links', 'listen links'],
  close_up: ['close_up', 'close up'],
  release_date: ['release_date', 'release date'],
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
  const normalizedRoute = normalizeSearchRoutePath(routePath);
  const currentPointer = normalizedRoute.split('/').filter(Boolean).pop() || '';
  const rows = Array.isArray(songRows) ? songRows : [];

  return rows.filter((row) => {
    const normalizedRowPath = normalizeSearchRoutePath(getSearchSongRowPathValue(row));
    if (!normalizedRowPath) {
      return false;
    }

    if (normalizedRowPath === normalizedRoute) {
      return true;
    }

    const rowPointer = normalizedRowPath.split('/').filter(Boolean).pop() || '';
    return !!rowPointer && !!currentPointer && rowPointer === currentPointer;
  });
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
  const normalizedRoute = normalizeSearchRoutePath(routePath);
  const baseSlug = normalizedRoute.split('/').filter(Boolean).pop() || '';
  if (!baseSlug) {
    return [];
  }

  const rows = getSearchSongRowsForRoute(routePath, songRows);
  const slugs = new Set([baseSlug]);

  rows.forEach((row) => {
    const rowPath = getSearchSongRowPathValue(row);
    const cleanedRowPath = String(rowPath || '').split('?')[0].replace(/\.html$/i, '').trim();
    const rowFileWithHash = cleanedRowPath.split('/').filter(Boolean).pop() || '';
    const hashIndex = String(rowPath || '').indexOf('#');
    const hashToken = hashIndex === -1 ? '' : String(rowPath.slice(hashIndex + 1) || '').trim();
    const tabName = normalizeSearchSongRowValue(row, 'tab_name');

    if (rowFileWithHash) {
      slugs.add(rowFileWithHash.toLowerCase());
      slugs.add(rowFileWithHash.replace(/[^a-z0-9]+/gi, '').toLowerCase());
    }

    if (hashToken) {
      slugs.add(baseSlug + hashToken.replace(/[^a-z0-9]+/gi, '').toLowerCase());
    }

    if (tabName) {
      slugs.add(baseSlug + tabName.replace(/[^a-z0-9]+/gi, '').toLowerCase());
    }
  });

  return Array.from(slugs);
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

      searchContentIndex = {
        songs,
        albums,
        motifs
      };
      return searchContentIndex;
    })
    .catch(() => {
      searchContentIndex = {
        songs: Object.create(null),
        albums: Object.create(null),
        motifs: Object.create(null)
      };
      return searchContentIndex;
    });

  return searchContentIndexPromise;
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
  const map = Object.create(null);
  const lines = String(csvText || '').split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) {
    return map;
  }

  const headers = splitSearchCsvLine(lines[0]);
  const pathIndex = findSearchSongCsvHeaderIndex(headers, ['path id', 'path_id', 'page_path', 'Path']);
  const artIndex = findSearchSongCsvHeaderIndex(headers, ['album_art_paths', 'Album Path', 'Album Art']);
  if (pathIndex === -1 || artIndex === -1) {
    return map;
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

    const firstArt = splitSearchPipeValues(values[artIndex])[0] || '';
    if (!firstArt) {
      continue;
    }

    map['/music/' + pagePath.replace(/^\/+/, '')] = '/public/images/cover-art/' + firstArt;
  }

  return map;
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
  const lines = String(csvText || '').split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) {
    return map;
  }

  const headers = splitSearchCsvLine(lines[0]).map((header) => header.toLowerCase());
  const categoryIdIndex = headers.indexOf('category id');
  const motifIdIndex = headers.indexOf('motif id');
  const motifImageIndex = headers.indexOf('motif image (page and map)');
  const hasPageIndex = headers.indexOf('has page');
  if (motifIdIndex === -1 || motifImageIndex === -1 || hasPageIndex === -1) {
    return map;
  }

  const motifRows = [];
  const imageByCategorySlug = Object.create(null);
  let firstMotifImagePath = '';

  for (let index = 1; index < lines.length; index += 1) {
    const values = splitSearchCsvLine(lines[index]);
    const motifId = String(values[motifIdIndex] || '').trim();
    const categoryId = String(categoryIdIndex >= 0 ? (values[categoryIdIndex] || '') : '').trim();
    if (!motifId || !isSearchTruthyFlag(values[hasPageIndex])) {
      continue;
    }

    const categorySlug = resolveSearchMotifPageSlug(categoryId, motifId);
    if (!categorySlug) {
      continue;
    }

    const imagePath = normalizeSearchImagePath(values[motifImageIndex]);
    motifRows.push({ motifId, categorySlug, imagePath });

    if (!firstMotifImagePath && imagePath) {
      firstMotifImagePath = imagePath;
    }

    if (imagePath && !imageByCategorySlug[categorySlug]) {
      imageByCategorySlug[categorySlug] = imagePath;
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

  return map;
}

function ensureSearchImageCsvLoaded(basePath) {
  if (searchImageCsvPromise) {
    return searchImageCsvPromise;
  }

  const songCsvUrl = (basePath || '') + '/public/csv/JamiePedia Data - Songs.csv';
  const motifCsvUrl = (basePath || '') + '/public/csv/JamiePedia Data - Motifs.csv';
  const albumCsvUrl = (basePath || '') + '/public/csv/JamiePedia Data - Albums.csv';

  searchImageCsvPromise = Promise.all([
    fetch(songCsvUrl, { cache: 'no-store' }).then((response) => response.ok ? response.text() : ''),
    fetch(motifCsvUrl, { cache: 'no-store' }).then((response) => response.ok ? response.text() : ''),
    fetch(albumCsvUrl, { cache: 'no-store' }).then((response) => response.ok ? response.text() : '')
  ]).then(([songCsvText, motifCsvText, albumCsvText]) => {
    const songMap = buildSearchImageMapFromSongCsv(songCsvText);
    const motifMap = buildSearchImageMapFromMotifCsv(motifCsvText);
    const albumMaps = buildSearchAlbumMapsFromAlbumCsv(albumCsvText);
    searchAlbumTitleByPath = albumMaps.titleByPath;
    searchImageByPath = Object.assign(Object.create(null), motifMap, albumMaps.imageByPath, songMap);
    return searchImageByPath;
  }).catch(() => {
    searchImageByPath = Object.create(null);
    searchAlbumTitleByPath = Object.create(null);
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

function buildSearchSnippet(text, query) {
  const sourceText = String(text || '').replace(/\s+/g, ' ').trim();
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
  if (index < 0) {
    return {
      snippet: sourceText.slice(0, 120).trim(),
      hasContentBefore: false,
      hasContentAfter: sourceText.length > 120
    };
  }

  const start = Math.max(0, index - 60);
  const end = Math.min(sourceText.length, index + normalizedQuery.length + 60);
  return {
    snippet: sourceText.substring(start, end).trim(),
    hasContentBefore: start > 0,
    hasContentAfter: end < sourceText.length
  };
}

function getSearchSongExternalContent(routePath, songRows) {
  const slugs = getSearchSongVariantSlugsFromRows(routePath, songRows);
  const songIndex = (searchContentIndex && searchContentIndex.songs) || Object.create(null);
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
    const lyricsText = String(entry.lyrics || '').trim();
    const extendedText = String(entry.extended || '').trim();

    if (summaryText) {
      content.summary += ' ' + summaryText;
    }
    if (annotationsText) {
      content.lyrics += ' ' + annotationsText;
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

// Fetch and search a single file
function searchFile(fileEntry, query, searchContext) {
  try {
    const context = searchContext || {};
    const basePath = context.basePath || (window.location.pathname.includes('/JamiePedia/') ? '/JamiePedia' : '');
    const routePath = normalizeSearchRoutePath(fileEntry.path);
    const pathParts = routePath.split('/').filter(Boolean);
    const isMotifPage = routePath === '/motifs' || pathParts[0] === 'motifs';
    const isMusicPage = pathParts[0] === 'music';
    const motifRouteSlug = pathParts[1] || '';
    const motifCategoryId = String((fileEntry || {}).motifCategoryId || motifRouteSlug || '').trim();
    const motifIdFromEntry = String((fileEntry || {}).motifId || '').trim();
    const motifSummaryKeys = Array.from(new Set([
      motifRouteSlug,
      motifCategoryId,
      motifIdFromEntry
    ].filter(Boolean)));

    const songRows = Array.isArray(context.songRows) ? context.songRows : [];
    const matchingSongRows = isMusicPage ? getSearchSongRowsForRoute(routePath, songRows) : [];
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

      const fileName = String(routePath || '').split('/').pop() || '';
      return fileName.replace(/-/g, ' ');
    })();

    const songMetadataText = rowsForMetadata.map((row) => [
      getSearchSongRowTitle(row),
      normalizeSearchSongRowValue(row, 'album_title'),
      normalizeSearchSongRowValue(row, 'artists'),
      normalizeSearchSongRowValue(row, 'vocalists'),
      normalizeSearchSongRowValue(row, 'mixing'),
      normalizeSearchSongRowValue(row, 'mastering'),
      normalizeSearchSongRowValue(row, 'instrumentals'),
      normalizeSearchSongRowValue(row, 'release_date'),
      normalizeSearchSongRowValue(row, 'listen_text'),
      normalizeSearchSongRowValue(row, 'listen_links'),
      normalizeSearchSongRowValue(row, 'close_up'),
      normalizeSearchSongRowValue(row, 'tab_name')
    ].filter(Boolean).join(' ')).filter(Boolean).join(' ').trim();

    const externalContent = isSongPage
      ? getSearchSongExternalContent(routePath, songRows)
      : isAlbumPage
        ? getSearchAlbumExternalContent(routePath)
        : isMotifPage
          ? { summary: getSearchMotifSummaryText(motifSummaryKeys), lyrics: '', extended: '' }
          : { summary: '', lyrics: '', extended: '' };

    const motifRelatedText = isMotifPage && typeof window.SongData !== 'undefined' && window.SongData && typeof window.SongData.getSongsWithMotifId === 'function'
      ? motifSummaryKeys
        .flatMap((motifKey) => window.SongData.getSongsWithMotifId(motifKey) || [])
        .map((song) => String((song || {}).title || '').trim())
        .filter(Boolean)
        .filter((value, index, array) => array.indexOf(value) === index)
        .join(' ')
      : '';

    const combinedSearchText = [
      title,
      fileEntry.album,
      songMetadataText,
      externalContent.summary,
      externalContent.lyrics,
      externalContent.extended,
      motifRelatedText
    ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();

    const lowerTextWithBr = combinedSearchText.toLowerCase();
    const lowerQuery = query.toLowerCase();
    
    if (lowerTextWithBr.includes(lowerQuery)) {
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
        const motifsText = rowsForMetadata.map((row) => [
          normalizeSearchSongRowValue(row, 'listen_text'),
          normalizeSearchSongRowValue(row, 'close_up')
        ].filter(Boolean).join(' ')).join(' ');
        if (motifsText.toLowerCase().includes(lowerQuery)) {
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

      const snippetCandidates = [
        externalContent.summary,
        externalContent.lyrics,
        externalContent.extended
      ].filter(Boolean);

      let snippetSource = combinedSearchText;
      for (const candidate of snippetCandidates) {
        if (String(candidate).toLowerCase().includes(lowerQuery)) {
          snippetSource = candidate;
          break;
        }
      }

      const snippetData = buildSearchSnippet(snippetSource, query);
      
      return {
        album: fileEntry.album,
        title: title,
        url: fileEntry.path,
        content: snippetData.snippet,
        coverSrc: coverSrc,
        hasContentBefore: snippetData.hasContentBefore,
        hasContentAfter: snippetData.hasContentAfter,
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
  
  displaySearchResults(results, query);
  
  // Store results and query for filtering
  fullSearchResults = results;
  currentSearchQuery = query;
}

// Display search results in modal
function displaySearchResults(results, originalQuery) {
  const resultsContainer = document.getElementById('searchResults');
  const searchTitle = document.getElementById('searchTitle');
  const basePath = window.location.pathname.includes('/JamiePedia/') ? '/JamiePedia' : '';
  
  // Escape special regex characters
  const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedQuery = escapeRegex(originalQuery);
  const queryRegex = new RegExp(`(${escapedQuery})`, 'gi');
  
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
      const highlightedContent = item.content.replace(queryRegex, '<strong style="background-color: var(--theme-color-surface_highlight); color: var(--theme-color-text_base_black); font-weight: bold;">$1</strong>');
      const beforeEllipsis = item.hasContentBefore ? '...' : '';
      const afterEllipsis = item.hasContentAfter ? '...' : '';
      const resultHref = typeof window.toSiteHref === 'function'
        ? window.toSiteHref(basePath + item.url)
        : basePath + item.url;
      contentDiv.innerHTML = '<div style="font-size: 12px; color: var(--theme-color-text_muted); font-weight: bold;">' + item.album + '</div>' +
        '<a href="' + resultHref + '" style="color: var(--theme-color-link_default); text-decoration: none; font-size: 16px; font-weight: bold;">' + 
        item.title + '</a>' +
        '<p style="margin: 5px 0 0 0; color: var(--theme-page-text); font-size: 13px;">' + beforeEllipsis + highlightedContent + afterEllipsis + '</p>';
      
      resultDiv.appendChild(coverImg);
      resultDiv.appendChild(contentDiv);
      resultsContainer.appendChild(resultDiv);
    });
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
