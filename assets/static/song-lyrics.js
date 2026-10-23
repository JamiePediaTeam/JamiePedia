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

function songLyricsParseLyricLineAndSingerTags(value) {
  const source = String(value || '');
  const trimmedSource = source.trim();
  if (!trimmedSource) {
    return { text: '', singerTag: '', singerTags: [], tokens: [] };
  }

  const tokens = [];
  const tagPattern = /\{([^{}]*)\}/g;
  let cursor = 0;
  let match;

  while ((match = tagPattern.exec(source)) !== null) {
    if (match.index > cursor) {
      tokens.push({
        type: 'text',
        value: source.slice(cursor, match.index)
      });
    }

    tokens.push({
      type: 'tag',
      value: String(match[1] || '').trim().toLowerCase()
    });

    cursor = match.index + match[0].length;
  }

  if (cursor < source.length) {
    tokens.push({
      type: 'text',
      value: source.slice(cursor)
    });
  }

  const text = tokens
    .filter((token) => token.type === 'text')
    .map((token) => String(token.value || ''))
    .join('')
    .trim();

  const singerTags = [];
  for (let index = tokens.length - 1; index >= 0; index -= 1) {
    const token = tokens[index];
    if (!token || token.type === 'text') {
      if (token && String(token.value || '').trim()) {
        break;
      }
      continue;
    }

    if (!String(token.value || '').trim()) {
      singerTags.length = 0;
      break;
    }

    singerTags.unshift(String(token.value || '').trim().toLowerCase());
  }

  return {
    text,
    singerTag: singerTags[0] || '',
    singerTags,
    tokens
  };
}

function songLyricsParseLrc(text) {
  const lines = String(text || '').split(/\r?\n/);
  const timedEntries = [];
  const offsetSeconds = songLyricsParseOffsetSeconds(text);
  let currentSingerTags = [];
  const singerTagsByLyricKey = Object.create(null);

  function normalizeLyricKey(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
  }

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

    const lyricSource = line.replace(/\[(\d{1,2}:\d{2}(?:\.\d{1,3})?)\]/g, '');
    const lyricParts = songLyricsParseLyricLineAndSingerTags(lyricSource);
    const tokens = Array.isArray(lyricParts.tokens) && lyricParts.tokens.length > 0
      ? lyricParts.tokens
      : [{ type: 'text', value: lyricParts.text }];

    const hasTagToken = tokens.some((token) => token && token.type === 'tag');
    const hasInnerTag = tokens.some((token, index) => {
      if (!token || token.type !== 'tag') {
        return false;
      }

      for (let nextIndex = index + 1; nextIndex < tokens.length; nextIndex += 1) {
        const nextToken = tokens[nextIndex];
        if (nextToken && nextToken.type === 'text' && String(nextToken.value || '').trim()) {
          return true;
        }
      }

      return false;
    });
    const lineText = tokens
      .filter((token) => token && token.type === 'text')
      .map((token) => String(token.value || ''))
      .join('')
      .replace(/\s+/g, ' ')
      .trim();
    const lineLyricKey = normalizeLyricKey(lineText);

    let activeSingerTags = currentSingerTags.slice();
    if (!hasTagToken && activeSingerTags.length === 0 && lineLyricKey && Array.isArray(singerTagsByLyricKey[lineLyricKey]) && singerTagsByLyricKey[lineLyricKey].length > 0) {
      activeSingerTags = singerTagsByLyricKey[lineLyricKey].slice();
    }

    let pendingSingerTags = null;
    const lineSegments = [];

    function pushLineSegment(segmentText) {
      const normalizedText = String(segmentText || '').replace(/\s+/g, ' ').trim();
      if (!normalizedText) {
        return;
      }

      const segmentSingerTags = activeSingerTags.slice();
      const segmentSingerTag = segmentSingerTags[0] || '';
      const lyricKey = normalizeLyricKey(normalizedText);
      if (lyricKey && segmentSingerTags.length > 0) {
        singerTagsByLyricKey[lyricKey] = segmentSingerTags.slice();
      }

      lineSegments.push({
        text: normalizedText,
        singerTag: segmentSingerTag,
        singerTags: segmentSingerTags,
        explicitNone: segmentSingerTags.length === 0
      });
    }

    tokens.forEach((token) => {
      if (!token) {
        return;
      }

      if (token.type === 'tag') {
        const normalizedTag = String(token.value || '').trim().toLowerCase();
        pendingSingerTags = normalizedTag ? [normalizedTag] : [];
        return;
      }

      if (token.type !== 'text') {
        return;
      }

      if (pendingSingerTags !== null) {
        activeSingerTags = pendingSingerTags.slice();
        pendingSingerTags = null;
      }

      if (hasInnerTag) {
        pushLineSegment(token.value);
      }
    });

    if (!hasInnerTag) {
      const explicitSingerTags = (Array.isArray(lyricParts.singerTags) ? lyricParts.singerTags : [])
        .map((tag) => String(tag || '').trim().toLowerCase());
      const hasExplicitEmptyTag = Array.isArray(lyricParts.tokens)
        && lyricParts.tokens.some((token) => token && token.type === 'tag' && !String(token.value || '').trim());

      if (hasExplicitEmptyTag) {
        activeSingerTags = [];
      } else if (explicitSingerTags.length > 0) {
        activeSingerTags = explicitSingerTags.slice();
      } else if (lineLyricKey && Array.isArray(singerTagsByLyricKey[lineLyricKey]) && singerTagsByLyricKey[lineLyricKey].length > 0) {
        activeSingerTags = singerTagsByLyricKey[lineLyricKey].slice();
      }

      const segmentSingerTags = activeSingerTags.slice();
      lineSegments.push({
        text: lineText,
        singerTag: segmentSingerTags[0] || '',
        singerTags: segmentSingerTags,
        explicitNone: hasExplicitEmptyTag
      });

      if (lineLyricKey && segmentSingerTags.length > 0) {
        singerTagsByLyricKey[lineLyricKey] = segmentSingerTags.slice();
      }
    } else if (!lineSegments.length && lineText) {
      pushLineSegment(lineText);
    }

    if (pendingSingerTags !== null) {
      currentSingerTags = pendingSingerTags.slice();
    } else if (hasTagToken) {
      currentSingerTags = activeSingerTags.slice();
    } else if (lineSegments.length > 0 && lineSegments[0].singerTags.length > 0) {
      currentSingerTags = lineSegments[0].singerTags.slice();
    }

    const collapsedLineText = lineSegments.map((segment) => String(segment.text || '')).join(' ').replace(/\s+/g, ' ').trim();
    const entrySingerTags = hasInnerTag
      ? []
      : ((lineSegments[0] && Array.isArray(lineSegments[0].singerTags)) ? lineSegments[0].singerTags.slice() : []);
    const entryExplicitNone = hasInnerTag
      ? false
      : !!(lineSegments[0] && lineSegments[0].explicitNone);
    const singerSegments = hasInnerTag
      ? lineSegments.map((segment) => ({
        text: String(segment.text || ''),
        singerTag: String(segment.singerTag || ''),
        singerTags: Array.isArray(segment.singerTags) ? segment.singerTags.slice() : [],
        explicitNone: !!segment.explicitNone
      }))
      : [];

    timestamps.forEach((stamp) => {
      timedEntries.push({
        time: songLyricsParseTimestamp(stamp) + offsetSeconds,
        text: collapsedLineText,
        singerTag: entrySingerTags[0] || '',
        singerTags: entrySingerTags,
        explicitNone: entryExplicitNone,
        singerSegments
      });
    });
  });

  const deduped = [];
  const seen = new Set();
  timedEntries
    .sort((a, b) => a.time - b.time)
    .forEach((entry) => {
      const segmentKey = Array.isArray(entry.singerSegments)
        ? entry.singerSegments.map((segment) => {
          const tags = Array.isArray(segment.singerTags) ? segment.singerTags.join(',') : String(segment.singerTag || '');
          return String(segment.text || '') + ':' + tags + ':' + (segment.explicitNone ? '1' : '0');
        }).join('|')
        : '';
      const key = entry.time.toFixed(3) + '|' + entry.text + '|' + String(entry.singerTags && entry.singerTags.length ? entry.singerTags.join(',') : entry.singerTag || '') + '|' + (entry.explicitNone ? '1' : '0') + '|' + segmentKey;
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
  if (typeof getMusicRouteContext === 'function') {
    const route = getMusicRouteContext(window.location.pathname || '');
    if (route && route.slug) {
      return String(route.slug).toLowerCase();
    }
  }

  const pathname = window.location.pathname || '';
  const file = pathname.split('/').pop() || '';
  return file.replace(/\.html$/i, '').toLowerCase();
}

function songLyricsNormalizeHashToken(value) {
  const source = String(value || '').trim().replace(/^#/, '');
  const versionPart = source.split('/')[0] || '';
  return String(versionPart || '')
    .trim()
    .toLowerCase()
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

  const route = typeof getMusicRouteContext === 'function'
    ? getMusicRouteContext(window.location.pathname || '')
    : null;
  const currentPath = route && route.basePath
    ? route.basePath
    : (typeof toExtensionlessPath === 'function'
      ? toExtensionlessPath(window.location.pathname || '')
      : String(window.location.pathname || '').replace(/\.html$/i, '').replace(/\/$/, ''));
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

function songLyricsRowToPathIdSlug(row, preserveHash) {
  const normalized = songLyricsNormalizeRowPath(songLyricsGetSongRowPathValue(row));
  if (!normalized) {
    return '';
  }

  const withoutPrefix = normalized.replace(/^\/music\//i, '').trim();
  if (!withoutPrefix) {
    return '';
  }

  return preserveHash ? withoutPrefix : withoutPrefix.split('#')[0].trim();
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

  if (matched) {
    const matchedSlug = songLyricsRowToPathIdSlug(matched, true);
    if (matchedSlug) {
      return matchedSlug;
    }
  }

  return songLyricsRowToPathIdSlug(rows[0]) || baseSlug;
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

    const slugCandidates = [slug];
    if (slug.indexOf('#') !== -1) {
      slugCandidates.push(slug.split('#')[0]);
    }

    const uniqueCandidates = slugCandidates
      .map((candidate) => String(candidate || '').toLowerCase())
      .filter((candidate, index, list) => candidate && list.indexOf(candidate) === index);

    if (!uniqueCandidates.length) {
      return Promise.resolve(null);
    }

    const loadPromise = uniqueCandidates.reduce((chain, candidateSlug) => {
      return chain.then((found) => {
        if (found) {
          return found;
        }

        const lrcPath = songLyricsBuildLrcPath(candidateSlug);
        if (!lrcPath) {
          return null;
        }

        return fetch(lrcPath, { cache: 'no-store' })
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
      });
    }, Promise.resolve(null));

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
