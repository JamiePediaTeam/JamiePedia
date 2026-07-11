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

function songLyricsBuildLrcPath() {
  const slug = songLyricsGetCurrentSongSlug();
  if (!slug) {
    return '';
  }
  return '../../public/lyrics/' + slug + '.lrc';
}

function songLyricsRenderRawLines(rawLines) {
  const rawContainers = Array.from(document.querySelectorAll('[id^="lyrics-raw"]'));
  if (rawContainers.length === 0) {
    return;
  }

  const escapedLines = rawLines.map((line) =>
    String(line)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
  );

  const html = '<p>' + escapedLines.join('<br>') + '</p>';
  rawContainers.forEach((container) => {
    container.innerHTML = html;
  });
}

const SongLyrics = {
  _cache: null,

  loadCurrentSongLyrics() {
    if (SongLyrics._cache) {
      return SongLyrics._cache;
    }

    const lrcPath = songLyricsBuildLrcPath();
    if (!lrcPath) {
      SongLyrics._cache = Promise.resolve(null);
      return SongLyrics._cache;
    }

    SongLyrics._cache = fetch(lrcPath, { cache: 'no-store' })
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

    return SongLyrics._cache;
  },

  initializeRawLyrics() {
    SongLyrics.loadCurrentSongLyrics().then((data) => {
      if (!data || !Array.isArray(data.rawLines) || data.rawLines.length === 0) {
        return;
      }
      songLyricsRenderRawLines(data.rawLines);
    });
  }
};

window.SongLyrics = SongLyrics;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => SongLyrics.initializeRawLyrics());
} else {
  SongLyrics.initializeRawLyrics();
}
