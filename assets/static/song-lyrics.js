function songLyricsParseTimestamp(value) {
  const text = String(value || '').trim();
  const match = text.match(/^(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?$/);
  if (!match) {
    return 0;
  }

  const mins = Number(match[1]);
  const secs = Number(match[2]);
  const fracText = match[3] || '0';
  const frac = Number('0.' + fracText.padEnd(3, '0'));

  return mins * 60 + secs + frac;
}

function songLyricsParseOffsetSeconds(text) {
  const lines = String(text || '').split(/\r?\n/);

  function parseOffsetValue(rawValue) {
    const source = String(rawValue || '').trim();
    if (!source) {
      return 0;
    }

    const sign = source.startsWith('-') ? -1 : 1;
    const unsigned = source.replace(/^[+-]/, '').trim();
    const parts = unsigned.split(':').map((part) => part.trim()).filter(Boolean);

    // Supports mm:ss:cc|mmm, mm:ss, or plain milliseconds.
    if (parts.length === 3) {
      const mins = Number(parts[0]);
      const secs = Number(parts[1]);
      const fractionDigits = parts[2].replace(/\D/g, '');
      if (!Number.isFinite(mins) || !Number.isFinite(secs) || !fractionDigits) {
        return 0;
      }

      const fractionNumber = Number(fractionDigits);
      const fraction = fractionDigits.length <= 2
        ? (fractionNumber / 100)
        : (fractionNumber / 1000);
      return sign * ((mins * 60) + secs + fraction);
    }

    if (parts.length === 2) {
      const mins = Number(parts[0]);
      const secs = Number(parts[1]);
      if (!Number.isFinite(mins) || !Number.isFinite(secs)) {
        return 0;
      }
      return sign * ((mins * 60) + secs);
    }

    if (parts.length === 1 && /^\d+$/.test(parts[0])) {
      return sign * (Number(parts[0]) / 1000);
    }

    return 0;
  }

  for (const line of lines) {
    const match = String(line || '').trim().match(/^\[offset\s*:\s*([^\]]+)\]$/i);
    if (!match) {
      continue;
    }

    return parseOffsetValue(match[1]);
  }

  return 0;
}

function songLyricsParseLrc(text) {
  const lines = String(text || '').split(/\r?\n/);
  const timedEntries = [];
  const offsetSeconds = songLyricsParseOffsetSeconds(text);

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
      timedEntries.push({
        time: songLyricsParseTimestamp(stamp) + offsetSeconds,
        text: lyric
      });
    });
  });

  const deduped = [];
  const seen = new Set();
  timedEntries
    .sort((a, b) => a.time - b.time)
    .forEach((entry) => {
      const key = entry.time.toFixed(3) + '|' + entry.text;
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      deduped.push(entry);
    });

  // Raw lyrics should follow the same timeline ordering as karaoke entries.
  const rawLines = deduped.map((entry) => entry.text);

  return {
    timedEntries: deduped,
    rawLines
  };
}

function songLyricsGetCurrentSongSlug() {
  const pathname = window.location.pathname || '';
  const file = pathname.split('/').pop() || '';
  return file.replace(/\.html$/i, '').toLowerCase();
}

function songLyricsNormalizeHashToken(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^#/, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

function songLyricsGetSongRowPathValue(row) {
  return String((row || {}).page_path || (row || {}).path_id || (row || {}).path || '').trim();
}

function songLyricsNormalizeRowPath(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    return '';
  }

  if (typeof normalizeSongSidebarPathKey === 'function') {
    return normalizeSongSidebarPathKey(raw);
  }

  const splitIndex = raw.indexOf('#');
  const pathPart = splitIndex === -1 ? raw : raw.slice(0, splitIndex);
  const hashPart = splitIndex === -1 ? '' : raw.slice(splitIndex + 1);
  const withMusicPrefix = pathPart.startsWith('/music/')
    ? pathPart
    : ('/music/' + pathPart.replace(/^\/+/, ''));
  const normalizedPath = withMusicPrefix.replace(/\.html$/i, '').replace(/\/$/, '');
  const normalizedHash = songLyricsNormalizeHashToken(hashPart);
  return normalizedHash ? (normalizedPath + '#' + normalizedHash) : normalizedPath;
}

function songLyricsGetRowsForCurrentPage() {
  const rows = Array.isArray(window.__songSidebarCsvRows) ? window.__songSidebarCsvRows : [];
  if (!rows.length) {
    return [];
  }

  const currentPath = typeof toExtensionlessPath === 'function'
    ? toExtensionlessPath(window.location.pathname || '')
    : String(window.location.pathname || '').replace(/\.html$/i, '').replace(/\/$/, '');
  const currentPointer = String(currentPath || '').split('/').filter(Boolean).pop() || '';

  return rows.filter((row) => {
    const normalized = songLyricsNormalizeRowPath(songLyricsGetSongRowPathValue(row));
    if (!normalized) {
      return false;
    }

    const basePath = normalized.split('#')[0];
    if (basePath === currentPath) {
      return true;
    }

    const rowPointer = basePath.split('/').filter(Boolean).pop() || '';
    return !!rowPointer && rowPointer === currentPointer;
  });
}

function songLyricsGetVersionRows(rows) {
  const normalizedRows = Array.isArray(rows) ? rows : [];
  if (!normalizedRows.length) {
    return [];
  }

  const mainRow = normalizedRows.find((row) => String((row || {}).alt_tab || '').trim() === 'Main Tab')
    || normalizedRows.find((row) => String((row || {}).alt_tab || '').trim() === 'Nothing')
    || normalizedRows.find((row) => {
      const normalized = songLyricsNormalizeRowPath(songLyricsGetSongRowPathValue(row));
      return normalized && normalized.indexOf('#') === -1;
    })
    || normalizedRows[0]
    || null;

  const mainKey = songLyricsNormalizeRowPath(songLyricsGetSongRowPathValue(mainRow));
  const altRows = [];
  const seenAltKeys = new Set();

  normalizedRows.forEach((row) => {
    const mode = String((row || {}).alt_tab || '').trim();
    const normalized = songLyricsNormalizeRowPath(songLyricsGetSongRowPathValue(row));
    const isMainMode = mode === 'Main Tab' || mode === 'Nothing';
    const isAltMode = mode === 'Alt Tab';
    const isHashVariant = normalized.indexOf('#') !== -1;

    if (!normalized || normalized === mainKey || isMainMode) {
      return;
    }

    if (!isAltMode && !isHashVariant) {
      return;
    }

    if (seenAltKeys.has(normalized)) {
      return;
    }

    seenAltKeys.add(normalized);
    altRows.push(row);
  });

  return mainRow ? [mainRow].concat(altRows) : altRows;
}

function songLyricsRowToPathIdSlug(row) {
  const normalized = songLyricsNormalizeRowPath(songLyricsGetSongRowPathValue(row));
  if (!normalized) {
    return '';
  }

  const withoutPrefix = normalized.replace(/^\/music\//i, '');
  return withoutPrefix || '';
}

function songLyricsResolveScopedSlug(baseSlug, variantSuffix) {
  const normalizedSuffix = String(variantSuffix || '').trim().toLowerCase();
  const rows = songLyricsGetVersionRows(songLyricsGetRowsForCurrentPage());
  const isOriginal = !normalizedSuffix || normalizedSuffix === 'original';
  const altMatch = normalizedSuffix.match(/^alt(\d+)$/);
  const versionIndex = isOriginal ? 0 : (altMatch ? Number(altMatch[1]) : -1);

  if (versionIndex >= 0 && rows[versionIndex]) {
    const pathIdSlug = songLyricsRowToPathIdSlug(rows[versionIndex]);
    if (pathIdSlug) {
      return pathIdSlug;
    }
  }

  return songLyricsBuildVariantSlug(baseSlug, normalizedSuffix);
}

function songLyricsResolveActiveSlug(baseSlug) {
  const rows = songLyricsGetVersionRows(songLyricsGetRowsForCurrentPage());
  if (!rows.length) {
    return baseSlug;
  }

  const hashToken = songLyricsNormalizeHashToken(window.location.hash || '');
  if (!hashToken) {
    return songLyricsRowToPathIdSlug(rows[0]) || baseSlug;
  }

  const matched = rows.find((row) => {
    const normalized = songLyricsNormalizeRowPath(songLyricsGetSongRowPathValue(row));
    const rowHash = songLyricsNormalizeHashToken(normalized.split('#')[1] || '');
    const tabNameToken = songLyricsNormalizeHashToken((row || {}).tab_name || '');
    return rowHash === hashToken || tabNameToken === hashToken;
  });

  return songLyricsRowToPathIdSlug(matched || rows[0]) || baseSlug;
}

function songLyricsGetContainerVariantSuffix(containerId, idPrefix) {
  const normalizedId = String(containerId || '').toLowerCase();
  const normalizedPrefix = String(idPrefix || '').toLowerCase();
  if (!normalizedId || !normalizedPrefix) {
    return '';
  }

  if (normalizedId === normalizedPrefix) {
    return '';
  }

  const prefixWithDash = normalizedPrefix + '-';
  if (!normalizedId.startsWith(prefixWithDash)) {
    return '';
  }

  return normalizedId.slice(prefixWithDash.length).trim();
}

function songLyricsBuildVariantSlug(baseSlug, variantSuffix) {
  const normalizedBase = String(baseSlug || '').toLowerCase();
  const normalizedSuffix = String(variantSuffix || '').toLowerCase();
  if (!normalizedBase) {
    return '';
  }

  if (!normalizedSuffix || normalizedSuffix === 'original') {
    return normalizedBase;
  }

  return normalizedBase + normalizedSuffix;
}

function songLyricsGetScopedSlugForContainer(container) {
  const baseSlug = songLyricsGetCurrentSongSlug();
  const variantSuffix = songLyricsGetContainerVariantSuffix(container && container.id, 'lyrics-raw');
  return songLyricsResolveScopedSlug(baseSlug, variantSuffix);
}

function songLyricsBuildLrcPath(slugOverride) {
  const slug = String(slugOverride || songLyricsGetCurrentSongSlug()).toLowerCase();
  if (!slug) {
    return '';
  }
  return '../../public/songs/lyrics/' + encodeURIComponent(slug) + '.lrc';
}

function songLyricsRenderRawLines(container, rawLines) {
  const escapedLines = rawLines.map((line) =>
    String(line)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
  );

  const html = '<p>' + escapedLines.join('<br>') + '</p>';
  container.innerHTML = html;
}

function songLyricsRenderEmptyRawMessage(container) {
  container.innerHTML = '<div class="song-empty-box">This song has no raw lyrics.</div>';
}

const SongLyrics = {
  _cacheBySlug: new Map(),

  loadCurrentSongLyrics(slugOverride) {
    const resolvedDefaultSlug = songLyricsResolveActiveSlug(songLyricsGetCurrentSongSlug());
    const slug = String(slugOverride || resolvedDefaultSlug).toLowerCase();
    if (!slug) {
      return Promise.resolve(null);
    }

    if (SongLyrics._cacheBySlug.has(slug)) {
      return SongLyrics._cacheBySlug.get(slug);
    }

    const lrcPath = songLyricsBuildLrcPath(slug);
    if (!lrcPath) {
      return Promise.resolve(null);
    }

    const loadPromise = fetch(lrcPath, { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) {
          throw new Error('No LRC found for current song');
        }
        return response.text();
      })
      .then((text) => {
        const parsed = songLyricsParseLrc(text);
        return {
          path: lrcPath,
          timedEntries: parsed.timedEntries,
          rawLines: parsed.rawLines
        };
      })
      .catch(() => null);

    SongLyrics._cacheBySlug.set(slug, loadPromise);
    return loadPromise;
  },

  initializeRawLyrics() {
    const rawContainers = Array.from(document.querySelectorAll('[id^="lyrics-raw"]'));
    if (rawContainers.length === 0) {
      return;
    }

    const tasks = rawContainers.map((container) => {
      const scopedSlug = songLyricsGetScopedSlugForContainer(container);
      return SongLyrics.loadCurrentSongLyrics(scopedSlug).then((data) => {
        if (!data || !Array.isArray(data.rawLines) || data.rawLines.length === 0) {
          songLyricsRenderEmptyRawMessage(container);
          return;
        }

        songLyricsRenderRawLines(container, data.rawLines);
      });
    });

    return Promise.all(tasks);
  }
};

window.SongLyrics = SongLyrics;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => SongLyrics.initializeRawLyrics());
} else {
  SongLyrics.initializeRawLyrics();
}
