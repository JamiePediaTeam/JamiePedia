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

function songLyricsParseLrc(text) {
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
      timedEntries.push({
        time: songLyricsParseTimestamp(stamp),
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
  return songLyricsBuildVariantSlug(baseSlug, variantSuffix);
}

function songLyricsBuildLrcPath(slugOverride) {
  const slug = String(slugOverride || songLyricsGetCurrentSongSlug()).toLowerCase();
  if (!slug) {
    return '';
  }
  return '../../public/lyrics/' + slug + '.lrc';
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
    const slug = String(slugOverride || songLyricsGetCurrentSongSlug()).toLowerCase();
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
