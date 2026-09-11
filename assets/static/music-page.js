(function () {
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

  function normalizeHeader(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  function parseCsvRows(text) {
    const lines = String(text || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length < 2) {
      return [];
    }

    const headers = splitCsvLine(lines[0]).map((header) => normalizeHeader(header));
    const rows = [];

    for (let rowIndex = 1; rowIndex < lines.length; rowIndex += 1) {
      const values = splitCsvLine(lines[rowIndex]);
      const row = {};

      headers.forEach((header, index) => {
        row[header] = String(values[index] || '').trim();
      });

      rows.push(row);
    }

    return rows;
  }

  function firstCoverFilename(value) {
    return splitPipeValues(value)[0] || '';
  }

  function normalizeMusicRoute(rawPath) {
    const source = String(rawPath || '').trim();
    if (!source) {
      return '';
    }

    const hashless = source.split('#')[0].split('?')[0].trim();
    if (!hashless) {
      return '';
    }

    const withPrefix = hashless.startsWith('/music/')
      ? hashless
      : '/music/' + hashless.replace(/^\/+/, '');

    let normalized = withPrefix.replace(/\.html$/i, '');
    normalized = normalized.replace(/\/index$/i, '');
    if (normalized.length > 1) {
      normalized = normalized.replace(/\/+$/, '');
    }

    return normalized;
  }

  function normalizeSongRouteFromPathId(rawValue) {
    const source = String(rawValue || '').trim();
    if (!source) {
      return '';
    }

    const hashless = source.split('#')[0].split('?')[0].trim();
    if (!hashless) {
      return '';
    }

    const slug = hashless.split('/').filter(Boolean).pop() || '';
    if (!slug) {
      return '';
    }

    return '/music/' + slug.replace(/\.html$/i, '').replace(/\/$/, '');
  }

  function sectionMapKey(value) {
    return String(value || '').trim().toLowerCase();
  }

  function sectionDisplayName(value) {
    return String(value || '').trim();
  }

  function cleanSongTitle(value) {
    return splitPipeValues(value).join(' ') || String(value || '').trim();
  }

  function hasSecretSection(sectionValue) {
    return sectionMapKey(sectionValue).includes('bonus');
  }

  function parseTrackNumber(value) {
    const first = splitPipeValues(value)[0] || String(value || '');
    const match = String(first).match(/\d+/);
    return match ? Number(match[0]) : Number.POSITIVE_INFINITY;
  }

  function parseSortableDate(value) {
    const text = String(value || '').trim();
    if (!text) {
      return Number.POSITIVE_INFINITY;
    }

    const primarySegment = text.split('|')[0].trim();
    if (!primarySegment) {
      return Number.POSITIVE_INFINITY;
    }

    const numericMatch = primarySegment.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
    if (numericMatch) {
      const month = Number(numericMatch[1]);
      const day = Number(numericMatch[2]);
      const year = Number(numericMatch[3]);
      if (month && day && year) {
        return Date.UTC(year, month - 1, day);
      }
    }

    const monthMatch = primarySegment.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:st|nd|rd|th)?\s+(\d{4})\b/i);
    if (monthMatch) {
      const monthNames = {
        january: 0,
        february: 1,
        march: 2,
        april: 3,
        may: 4,
        june: 5,
        july: 6,
        august: 7,
        september: 8,
        october: 9,
        november: 10,
        december: 11
      };
      const monthIndex = monthNames[String(monthMatch[1] || '').toLowerCase()];
      const day = Number(monthMatch[2]);
      const year = Number(monthMatch[3]);
      if (Number.isInteger(monthIndex) && day && year) {
        return Date.UTC(year, monthIndex, day);
      }
    }

    return Number.POSITIVE_INFINITY;
  }

  function shouldUseSongRow(row) {
    const pathId = String(row.path_id || row.path || row.page_path || '').trim();
    if (!pathId || pathId.indexOf('#') !== -1) {
      return false;
    }

    const altStatus = sectionMapKey(row.alt_tab_status || row.alt_tab);
    if (altStatus === 'alt tab') {
      return false;
    }

    const section = String(row.music_page_section || '').trim();
    if (!section || hasSecretSection(section)) {
      return false;
    }

    return true;
  }

  function buildAlbumTrackCountMap(songRows) {
    const tracksByAlbumId = new Map();

    function normalizeSongCountKey(pathId) {
      const raw = String(pathId || '').trim();
      if (!raw) {
        return '';
      }

      const hashIndex = raw.indexOf('#');
      const pathPart = hashIndex === -1 ? raw : raw.slice(0, hashIndex);
      const hashPart = hashIndex === -1 ? '' : raw.slice(hashIndex + 1).trim().toLowerCase();
      const slug = pathPart.split('?')[0].replace(/\.html$/i, '').split('/').filter(Boolean).pop() || '';
      if (!slug) {
        return '';
      }

      return hashPart ? (slug + '#' + hashPart) : slug;
    }

    (songRows || []).forEach((row) => {
      const pathId = String(row.path_id || row.path || row.page_path || '').trim();
      if (!pathId) {
        return;
      }

      if (hasSecretSection(String(row.music_page_section || ''))) {
        return;
      }

      const countKey = normalizeSongCountKey(pathId);
      if (!countKey) {
        return;
      }

      const albumIds = splitPipeValues(row.album_id || '')
        .map((value) => sectionMapKey(value))
        .filter((value) => value && value !== 'x');

      albumIds.forEach((albumId) => {
        if (!tracksByAlbumId.has(albumId)) {
          tracksByAlbumId.set(albumId, new Set());
        }

        tracksByAlbumId.get(albumId).add(countKey);
      });
    });

    const counts = new Map();
    tracksByAlbumId.forEach((value, key) => {
      counts.set(key, value.size);
    });

    return counts;
  }

  function createAlbumTileElement(basePath, tile) {
    const tileEl = document.createElement('div');
    tileEl.className = 'album-tile';

    const link = document.createElement('a');
    const href = typeof window.toSiteHref === 'function'
      ? window.toSiteHref(tile.route)
      : (basePath + tile.route);
    link.href = href;

    const image = document.createElement('img');
    image.className = 'album-cover';
    image.alt = tile.title || 'Music tile';
    if (tile.coverArt) {
      image.src = basePath + '/public/images/cover-art/' + tile.coverArt;
    }

    const title = document.createElement('span');
    title.className = 'album-title';
    title.textContent = tile.title || 'Untitled';

    link.appendChild(image);
    link.appendChild(title);

    if (tile.subtitle) {
      const subtitle = document.createElement('span');
      subtitle.className = 'album-subtitle';
      subtitle.textContent = tile.subtitle;
      link.appendChild(subtitle);
    }

    tileEl.appendChild(link);
    return tileEl;
  }

  function buildMusicPageSections() {
    const mount = document.getElementById('music-page-sections');
    if (!mount) {
      return;
    }

    const basePath = getBasePath();
    const albumsCsvUrl = basePath + '/public/csv/JamiePedia Data - Albums.csv';
    const songsCsvUrl = basePath + '/public/csv/JamiePedia Data - Songs.csv';
    const sectionsCsvUrl = basePath + '/public/csv/JamiePedia Data - Music Page Sections.csv';

    Promise.all([
      fetch(albumsCsvUrl, { cache: 'no-store' }).then((res) => (res.ok ? res.text() : '')),
      fetch(songsCsvUrl, { cache: 'no-store' }).then((res) => (res.ok ? res.text() : '')),
      fetch(sectionsCsvUrl, { cache: 'no-store' }).then((res) => (res.ok ? res.text() : ''))
    ])
      .then(([albumsCsvText, songsCsvText, sectionsCsvText]) => {
        const albumRows = parseCsvRows(albumsCsvText);
        const songRows = parseCsvRows(songsCsvText);
        const sectionRows = parseCsvRows(sectionsCsvText);
        const sectionToTiles = new Map();
        const seenRoutes = new Set();
        const orderedSections = [];
        const seenSections = new Set();
        let tileOrder = 0;

        const trackCountByAlbumId = buildAlbumTrackCountMap(songRows);
        const sectionOrderFromCsv = sectionRows
          .map((row) => sectionDisplayName(row.music_page_section || row.section || row.name || ''))
          .filter(Boolean);

        function registerSection(section) {
          const safeSection = sectionDisplayName(section);
          if (!safeSection || seenSections.has(safeSection)) {
            return;
          }

          seenSections.add(safeSection);
          orderedSections.push(safeSection);
        }

        function pushTile(section, tile) {
          const safeSection = sectionDisplayName(section);
          if (!safeSection || !tile || !tile.route) {
            return;
          }

          if (!sectionToTiles.has(safeSection)) {
            sectionToTiles.set(safeSection, []);
          }
          sectionToTiles.get(safeSection).push(tile);
          seenRoutes.add(tile.route);
        }

        albumRows.forEach((row) => {
          const route = normalizeMusicRoute(row.album_id || '');
          if (!route) {
            return;
          }

          const section = sectionDisplayName(row.music_page_section || 'Miscellaneous') || 'Miscellaneous';
          const title = String(row.album_title || row.page_title || '').trim() || 'Untitled';
          const coverArt = firstCoverFilename(row.album_art || row.album_art_paths || '');
          const albumId = sectionMapKey(row.album_id || '');
          const trackCount = albumId ? Number(trackCountByAlbumId.get(albumId) || 0) : 0;
          const subtitle = trackCount > 0 ? '(' + trackCount + ' tracks)' : '';

          pushTile(section, {
            type: 'album',
            route,
            title,
            coverArt,
            subtitle,
            sortDate: parseSortableDate(row.release_date || ''),
            sortIndex: tileOrder
          });
          tileOrder += 1;
        });

        songRows.forEach((row) => {
          if (!shouldUseSongRow(row)) {
            return;
          }

          const route = normalizeSongRouteFromPathId(row.path_id || row.path || row.page_path || '');
          if (!route || seenRoutes.has(route)) {
            return;
          }

          const section = String(row.music_page_section || '').trim();
          if (!section) {
            return;
          }

          pushTile(section, {
            type: 'song',
            route,
            title: cleanSongTitle(row.page_title || ''),
            coverArt: firstCoverFilename(row.album_art || row.album_art_paths || ''),
            subtitle: '',
            sortDate: parseSortableDate(row.release_date || ''),
            sortTrack: parseTrackNumber(row.track_number || row.album_track || ''),
            sortIndex: tileOrder
          });
          tileOrder += 1;
        });

        mount.innerHTML = '';

        sectionOrderFromCsv.forEach((section) => {
          registerSection(section);
        });

        Array.from(sectionToTiles.keys()).forEach((section) => {
          registerSection(section);
        });

        orderedSections.forEach((section) => {
          const tiles = sectionToTiles.get(section) || [];
          if (!tiles.length) {
            return;
          }

          const albumTiles = tiles
            .filter((tile) => tile.type === 'album')
            .sort((a, b) => {
              if (a.sortDate !== b.sortDate) {
                return a.sortDate - b.sortDate;
              }
              return a.sortIndex - b.sortIndex;
            });

          const songTiles = tiles
            .filter((tile) => tile.type === 'song')
            .sort((a, b) => {
              return a.sortIndex - b.sortIndex;
            });

          const orderedTiles = albumTiles.concat(songTiles);

          const heading = document.createElement('h2');
          heading.className = 'album-section-heading';
          heading.textContent = section;

          const gallery = document.createElement('div');
          gallery.className = 'albumgallery';
          orderedTiles.forEach((tile) => {
            gallery.appendChild(createAlbumTileElement(basePath, tile));
          });

          mount.appendChild(heading);
          mount.appendChild(gallery);
        });
      })
      .catch(() => {
        mount.innerHTML = '';
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildMusicPageSections, { once: true });
  } else {
    buildMusicPageSections();
  }
})();
