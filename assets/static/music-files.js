// Music file paths for search/nav/random/tracklist behavior.
// Songs are sourced from Songs CSV, motif pages from Motifs CSV,
// and album index pages remain static until album CSV migration is complete.

const musicFilePaths = [];
window.musicFilePaths = musicFilePaths;

const albumPageEntries = [
  { album: 'Album', path: '/music/aa.html' },
  { album: 'Album', path: '/music/aed.html' },
  { album: 'Album', path: '/music/bs.html' },
  { album: 'Album', path: '/music/cc.html' },
  { album: 'Album', path: '/music/ccde.html' },
  { album: 'Album', path: '/music/cs.html' },
  { album: 'Album', path: '/music/contentcompanion.html' },
  { album: 'Album', path: '/music/destiny.html' },
  { album: 'Album', path: '/music/PPPP.html' },
  { album: 'Album', path: '/music/dnh.html' },
  { album: 'Album', path: '/music/video-hunting-specimen.html' },
  { album: 'Album', path: '/music/aod.html' },
  { album: 'Album', path: '/music/bc.html' },
  { album: 'Album', path: '/music/jpjp3.html' },
  { album: 'Album', path: '/music/jpjp4.html' },
  { album: 'Album', path: '/music/jpjp5.html' },
  { album: 'Album', path: '/music/jpjp6.html' },
  { album: 'Album', path: '/music/ccii.html' },
  { album: 'Album', path: '/music/ccontrepoint.html' },
  { album: 'Album', path: '/music/ff2.html' },
  { album: 'Album', path: '/music/ds2021.html' },
  { album: 'Album', path: '/music/ds2024.html' },
  { album: 'Album', path: '/music/vvff.html' },
  { album: 'Album', path: '/music/vvjp.html' },
  { album: 'Album', path: '/music/bdkt26.html' },
  { album: 'Album', path: '/music/meff.html' },
  { album: 'Album', path: '/music/birdapp.html' },
  { album: 'Album', path: '/music/butterfly.html' },
  { album: 'Album', path: '/music/paisleyAcc.html' },
  { album: 'Album', path: '/music/tumble.html' },
  { album: 'Album', path: '/music/sound.html' },
  { album: 'Album', path: '/music/pamiejaige.html' }
];

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

function parseAlbumPageTitle(htmlText) {
  const html = String(htmlText || '');
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1Match && h1Match[1]) {
    const h1Text = h1Match[1].replace(/<[^>]+>/g, '').trim();
    if (h1Text) {
      return h1Text;
    }
  }

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch && titleMatch[1]) {
    const titleText = titleMatch[1].replace(/<[^>]+>/g, '').trim();
    if (titleText) {
      return titleText;
    }
  }

  return '';
}

function getAlbumIdFromAlbumPath(pathname) {
  const fileName = String(pathname || '').split('/').pop() || '';
  return fileName.replace(/\.html$/i, '').trim().toLowerCase();
}

function loadAlbumTitleByIdMap(basePath) {
  const requests = albumPageEntries.map((entry) => {
    const albumPath = String((entry || {}).path || '').trim();
    const albumId = getAlbumIdFromAlbumPath(albumPath);
    if (!albumPath || !albumId) {
      return Promise.resolve(null);
    }

    const url = String(basePath || '') + albumPath;
    return fetch(url, { cache: 'no-store' })
      .then((response) => response.ok ? response.text() : '')
      .then((html) => ({ albumId, title: parseAlbumPageTitle(html) }))
      .catch(() => null);
  });

  return Promise.all(requests).then((records) => {
    const map = new Map();
    records.forEach((record) => {
      if (!record || !record.albumId || !record.title) {
        return;
      }
      map.set(record.albumId, record.title);
    });
    return map;
  });
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
  const pathIndex = findSongCsvHeaderIndex(headers, ['page_path', 'Path']);
  const albumIdIndex = findSongCsvHeaderIndex(headers, ['album_id']);

  if (pathIndex === -1) {
    return [];
  }

  const entries = [];
  const seenPaths = new Set();

  for (let index = 1; index < lines.length; index += 1) {
    const values = splitCsvLine(lines[index]);
    const pagePath = String(values[pathIndex] || '').trim();
    if (!pagePath || pagePath.includes('#')) {
      continue;
    }

    const normalizedPagePath = '/music/' + pagePath.replace(/^\/+/, '');
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
      path: '/motifs/' + motifId + '.html'
    });
  }

  return entries;
}

function setMusicFilePaths(motifEntries, songEntries) {
  musicFilePaths.length = 0;

  staticMiscEntries.forEach((entry) => musicFilePaths.push(entry));
  motifEntries.forEach((entry) => musicFilePaths.push(entry));
  albumPageEntries.forEach((entry) => musicFilePaths.push(entry));
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
  const songCsvUrl = basePath + '/public/music/JamiePedia Data - Songs.csv';
  const motifCsvUrl = basePath + '/public/motifs/JamiePedia Data - Motifs.csv';

  Promise.all([
    fetch(songCsvUrl, { cache: 'no-store' }).then((response) => response.ok ? response.text() : ''),
    fetch(motifCsvUrl, { cache: 'no-store' }).then((response) => response.ok ? response.text() : ''),
    loadAlbumTitleByIdMap(basePath)
  ])
    .then(([songCsvText, motifCsvText, albumTitleById]) => {
      const songEntries = parseSongEntriesFromCsv(songCsvText, albumTitleById);
      const motifEntries = parseMotifEntriesFromCsv(motifCsvText);
      setMusicFilePaths(motifEntries, songEntries);
    })
    .catch(() => {
      setMusicFilePaths([], []);
    })
    .finally(() => {
      if (resolveMusicFilePathsReady) {
        resolveMusicFilePathsReady(musicFilePaths);
      }
    });
})();
