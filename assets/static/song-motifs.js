function songMotifTimeToSeconds(value) {
  const text = String(value || '').trim();
  if (!text) return 0;

  const parts = text.split(':').map((part) => Number(part));
  if (parts.some((part) => Number.isNaN(part))) {
    return 0;
  }

  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }

  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }

  return Number(text) || 0;
}

function songMotifFormatTime(seconds) {
  const safe = Math.max(0, Math.floor(Number(seconds) || 0));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return mins + ':' + String(secs).padStart(2, '0');
}

function songMotifsNormalizeYouTubeId(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    return '';
  }

  let candidate = raw;
  try {
    if (raw.includes('://')) {
      const parsed = new URL(raw);
      if (parsed.hostname.includes('youtu.be')) {
        candidate = parsed.pathname.replace(/^\//, '').split('/')[0] || '';
      } else {
        candidate = parsed.searchParams.get('v')
          || parsed.pathname.split('/').filter(Boolean).pop()
          || '';
      }
    }
  } catch (error) {
    // Keep raw candidate for non-URL-like input.
  }

  candidate = String(candidate).split(/[?&#]/)[0].trim();
  return /^[A-Za-z0-9_-]{11}$/.test(candidate) ? candidate : '';
}

function songMotifsReadDeclaredDuration() {
  const findTimeInText = (text) => {
    const match = String(text || '').match(/(\d{1,2}:\d{2}(?::\d{2})?)/);
    return match ? songMotifTimeToSeconds(match[1]) : 0;
  };

  const songLengthNodes = Array.from(document.querySelectorAll('.song-length'));

  for (const node of songLengthNodes) {
    if (!node || node.offsetParent === null) {
      continue;
    }

    const visibleDuration = findTimeInText(node.textContent);
    if (visibleDuration > 0) {
      return visibleDuration;
    }
  }

  for (const node of songLengthNodes) {
    const fallbackDuration = findTimeInText(node.textContent);
    if (fallbackDuration > 0) {
      return fallbackDuration;
    }
  }

  return 0;
}

function getSongMotifsMount() {
  const motifContents = Array.from(document.querySelectorAll('[id^="content-motifs"]'));
  const content = motifContents.find((node) => node && node.offsetParent !== null)
    || motifContents.find((node) => node && node.classList && node.classList.contains('active'))
    || document.getElementById('content-motifs');
  if (!content) {
    return null;
  }

  motifContents.forEach((node) => {
    if (!node) {
      return;
    }
    node.querySelectorAll('[id^="songMotifsContent"]').forEach((child) => child.remove());
  });

  const suffix = content.id === 'content-motifs'
    ? 'original'
    : content.id.replace(/^content-motifs-/, '') || 'original';

  let mount = content.querySelector('#songMotifsContent-' + suffix);
  if (mount) {
    return mount;
  }

  content.innerHTML = '';
  mount = document.createElement('div');
  mount.id = 'songMotifsContent-' + suffix;
  mount.className = 'song-motifs-content';
  content.appendChild(mount);
  return mount;
}

function songMotifsGetActiveVariantSuffix() {
  const visibleVersion = Array.from(document.querySelectorAll('[id^="version-"]')).find((node) => {
    return node && node.offsetParent !== null;
  });

  if (!visibleVersion) {
    return '';
  }

  const versionId = String(visibleVersion.id || '').toLowerCase();
  const suffix = versionId.replace(/^version-/, '');
  if (!suffix || suffix === 'original') {
    return '';
  }

  return suffix;
}

function songMotifsGetBaseSongSlug() {
  const file = (window.location.pathname.split('/').pop() || '').replace(/\.html$/i, '').toLowerCase();
  return file;
}

function songMotifsGetActiveVariantHashToken() {
  const activeVersionTab = document.querySelector('.version-tab.active');
  if (!activeVersionTab) {
    return '';
  }

  return String(activeVersionTab.textContent || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

function songMotifsResolveSongPathCandidates() {
  const baseSlug = songMotifsGetBaseSongSlug();
  const variantSuffix = songMotifsGetActiveVariantSuffix();
  if (!baseSlug) {
    return [];
  }

  if (!variantSuffix) {
    return [baseSlug + '.html'];
  }

  const hashToken = songMotifsGetActiveVariantHashToken();
  const candidates = [baseSlug + variantSuffix + '.html'];
  if (hashToken) {
    candidates.push(baseSlug + '.html#' + hashToken);
  }
  candidates.push(baseSlug + '.html#' + variantSuffix);
  return candidates;
}

function songMotifsResolveSongSlugs() {
  const baseSlug = songMotifsGetBaseSongSlug();
  const variantSuffix = songMotifsGetActiveVariantSuffix();
  if (!baseSlug) {
    return [];
  }

  if (!variantSuffix) {
    return [baseSlug];
  }

  return [baseSlug + variantSuffix];
}

function getSongMotifsState() {
  if (!window.__songMotifsState) {
    window.__songMotifsState = {
      player: null,
      timer: null,
      duration: 0,
      refsByMotif: [],
      legendNodes: new Map(),
      progressNode: null,
      currentLabel: null,
      durationLabel: null,
      mainTrack: null,
      playButton: null,
      declaredDuration: 0,
      volume: 100,
      volumeInput: null,
      karaokeEntries: [],
      lyricalRefs: [],
      karaokeCurrentIndex: -2,
      karaokeWrap: null,
      karaokeLayerHost: null,
      karaokeActiveLayer: null,
      karaokeTransitionTimer: null
    };
  }
  return window.__songMotifsState;
}

function songMotifsBuildKaraokePayload(currentIndex) {
  const state = getSongMotifsState();
  const previousEntry = currentIndex > 0 ? state.karaokeEntries[currentIndex - 1] : null;
  const currentEntry = currentIndex >= 0 ? state.karaokeEntries[currentIndex] : null;
  const nextEntry = currentIndex >= 0 && currentIndex + 1 < state.karaokeEntries.length
    ? state.karaokeEntries[currentIndex + 1]
    : null;

  return {
    previousEntry,
    currentEntry,
    nextEntry
  };
}

function songMotifsEscapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function songMotifsEscapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function songMotifsNormalizeSiteHref(value) {
  const text = String(value || '').trim();
  if (!text) {
    return '';
  }

  if (/^(https?:|mailto:|#|\/)/i.test(text)) {
    return text;
  }

  return '/' + text.replace(/^(\.\.\/)+/, '');
}

function songMotifsResolveMotifHref(motif, motifId) {
  if (motif && motif.hasPage !== false) {
    return '../../motifs/' + ((motif && motif.pageSlug) ? motif.pageSlug : (motif ? motif.id : motifId)) + '.html';
  }

  if (motif && motif.referenceLink) {
    return songMotifsNormalizeSiteHref(motif.referenceLink);
  }

  return '';
}

function songMotifsGetKaraokeLyricHighlights(entry) {
  const state = getSongMotifsState();
  if (!entry || !Array.isArray(state.lyricalRefs) || state.lyricalRefs.length === 0) {
    return [];
  }

  const entryStart = Number(entry.time) || 0;
  const entryEnd = Number(entry.endTime) > entryStart ? Number(entry.endTime) : entryStart;
  const entryText = String(entry.text || '');

  return state.lyricalRefs.filter((ref) => {
    const refStart = songMotifTimeToSeconds(ref.startTime);
    const refEndRaw = songMotifTimeToSeconds(ref.endTime);
    const refEnd = refEndRaw >= refStart ? refEndRaw : refStart;
    const refLyrics = String(ref.lyrics || '').trim();
    if (!refLyrics) {
      return false;
    }

    const overlapsLine = refStart <= (entryEnd + 0.02) && refEnd >= (entryStart - 0.02);
    const lyricPresent = entryText.toLowerCase().includes(refLyrics.toLowerCase());
    return overlapsLine && lyricPresent;
  });
}

function songMotifsBuildKaraokeLineHtml(entry) {
  if (!entry || !entry.text) {
    return ' ';
  }

  const highlights = songMotifsGetKaraokeLyricHighlights(entry)
    .filter((ref, index, list) => {
      const key = String(ref.motifId || '').toLowerCase() + '|' + String(ref.lyrics || '').toLowerCase();
      return list.findIndex((candidate) => {
        return String(candidate.motifId || '').toLowerCase() + '|' + String(candidate.lyrics || '').toLowerCase() === key;
      }) === index;
    })
    .sort((a, b) => String(b.lyrics || '').length - String(a.lyrics || '').length);

  if (highlights.length === 0) {
    return songMotifsEscapeHtml(entry.text);
  }

  let rendered = songMotifsEscapeHtml(entry.text);

  highlights.forEach((ref) => {
    const motif = window.MotifData && typeof window.MotifData.getMotifById === 'function'
      ? window.MotifData.getMotifById(ref.motifId)
      : null;
    const color = motif && motif.color ? motif.color : '#ef8a85';
    const escapedLyrics = songMotifsEscapeHtml(ref.lyrics);
    const pattern = new RegExp(songMotifsEscapeRegExp(escapedLyrics), 'g');
    rendered = rendered.replace(
      pattern,
      '<span class="song-karaoke-lyric-ref" style="--lyric-ref-color: ' + color + ';">$&</span>'
    );
  });

  return rendered;
}

function songMotifsPopulateKaraokeLine(node, entry) {
  node.innerHTML = songMotifsBuildKaraokeLineHtml(entry);
}

function songMotifsBuildKaraokeLayer(payload, layerClassName) {
  const layer = document.createElement('div');
  layer.className = 'song-karaoke-layer ' + layerClassName;

  const previous = document.createElement('p');
  previous.className = 'song-karaoke-line song-karaoke-line-prev';
  songMotifsPopulateKaraokeLine(previous, payload.previousEntry);
  layer.appendChild(previous);

  const current = document.createElement('p');
  current.className = 'song-karaoke-line song-karaoke-line-current';
  songMotifsPopulateKaraokeLine(current, payload.currentEntry);
  layer.appendChild(current);

  const next = document.createElement('p');
  next.className = 'song-karaoke-line song-karaoke-line-next';
  songMotifsPopulateKaraokeLine(next, payload.nextEntry);
  layer.appendChild(next);

  return layer;
}

const SONG_MOTIFS_KARAOKE_SYNC_LEAD_SECONDS = 0.9;

function songMotifsUpdateKaraoke(currentTime) {
  const state = getSongMotifsState();
  if (!state.karaokeWrap || !state.karaokeLayerHost) {
    return;
  }

  if (!Array.isArray(state.karaokeEntries) || state.karaokeEntries.length === 0) {
    state.karaokeWrap.style.display = 'none';
    return;
  }

  state.karaokeWrap.style.display = '';
  const syncedTime = currentTime + SONG_MOTIFS_KARAOKE_SYNC_LEAD_SECONDS;

  let currentIndex = -1;
  for (let i = 0; i < state.karaokeEntries.length; i += 1) {
    if (state.karaokeEntries[i].time <= syncedTime + 0.01) {
      currentIndex = i;
    } else {
      break;
    }
  }

  if (currentIndex === state.karaokeCurrentIndex) {
    return;
  }

  const previousIndex = state.karaokeCurrentIndex;
  state.karaokeCurrentIndex = currentIndex;
  const payload = songMotifsBuildKaraokePayload(currentIndex);

  if (state.karaokeTransitionTimer) {
    clearTimeout(state.karaokeTransitionTimer);
    state.karaokeTransitionTimer = null;
  }

  if (state.karaokeActiveLayer) {
    state.karaokeActiveLayer.classList.remove('song-karaoke-layer-entering');
    state.karaokeActiveLayer.classList.remove('song-karaoke-layer-entering-play');
    state.karaokeActiveLayer.classList.remove('song-karaoke-layer-leaving');
    state.karaokeActiveLayer.classList.add('song-karaoke-layer-active');
  }

  Array.from(state.karaokeLayerHost.children).forEach((child) => {
    if (child !== state.karaokeActiveLayer) {
      child.remove();
    }
  });

  if (!state.karaokeActiveLayer) {
    const initialLayer = songMotifsBuildKaraokeLayer(payload, 'song-karaoke-layer-active');
    state.karaokeLayerHost.innerHTML = '';
    state.karaokeLayerHost.appendChild(initialLayer);
    state.karaokeActiveLayer = initialLayer;
    return;
  }

  const shouldAnimate = Math.abs(currentIndex - previousIndex) === 1;
  if (!shouldAnimate) {
    const replacementLayer = songMotifsBuildKaraokeLayer(payload, 'song-karaoke-layer-active');
    state.karaokeLayerHost.innerHTML = '';
    state.karaokeLayerHost.appendChild(replacementLayer);
    state.karaokeActiveLayer = replacementLayer;
    return;
  }

  const leavingLayer = state.karaokeActiveLayer;
  leavingLayer.classList.remove('song-karaoke-layer-active');
  leavingLayer.classList.add('song-karaoke-layer-leaving');

  const enteringLayer = songMotifsBuildKaraokeLayer(payload, 'song-karaoke-layer-entering');
  state.karaokeLayerHost.appendChild(enteringLayer);
  state.karaokeActiveLayer = enteringLayer;
  void enteringLayer.offsetWidth;
  enteringLayer.classList.add('song-karaoke-layer-entering-play');

  state.karaokeTransitionTimer = setTimeout(() => {
    if (leavingLayer.parentNode) {
      leavingLayer.remove();
    }
    enteringLayer.classList.remove('song-karaoke-layer-entering');
    enteringLayer.classList.remove('song-karaoke-layer-entering-play');
    enteringLayer.classList.add('song-karaoke-layer-active');
    state.karaokeTransitionTimer = null;
  }, 500);
}

function songMotifsApplyKaraokeEntries(entries) {
  const state = getSongMotifsState();
  if (!Array.isArray(entries)) {
    state.karaokeEntries = [];
    songMotifsUpdateKaraoke(0);
    return;
  }

  const sortedEntries = entries
    .filter((entry) => entry && typeof entry.time === 'number' && typeof entry.text === 'string')
    .sort((a, b) => a.time - b.time);

  state.karaokeEntries = sortedEntries.map((entry, index) => {
    const next = sortedEntries[index + 1];
    const nextTime = next && typeof next.time === 'number' ? next.time : (entry.time + 8);
    const endTime = nextTime > entry.time ? nextTime : (entry.time + 0.01);
    return {
      time: entry.time,
      text: entry.text,
      endTime
    };
  });

  if (state.karaokeLayerHost) {
    state.karaokeLayerHost.innerHTML = '';
  }
  state.karaokeActiveLayer = null;

  state.karaokeCurrentIndex = -2;
  songMotifsUpdateKaraoke(0);
}

function setSongMotifsVolume(value) {
  const state = getSongMotifsState();
  const nextVolume = Math.max(0, Math.min(100, Number(value) || 0));
  state.volume = nextVolume;

  if (state.volumeInput) {
    state.volumeInput.value = String(nextVolume);
  }

  if (state.player && typeof state.player.setVolume === 'function') {
    state.player.setVolume(nextVolume);
  }
}

function songMotifsParseTimestamp(value) {
  const match = String(value || '').trim().match(/^(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?$/);
  if (!match) {
    return 0;
  }

  const mins = Number(match[1]);
  const secs = Number(match[2]);
  const frac = Number('0.' + String(match[3] || '0').padEnd(3, '0'));
  return mins * 60 + secs + frac;
}

function songMotifsParseLrcTimedEntries(text) {
  const lines = String(text || '').split(/\r?\n/);
  const entries = [];

  lines.forEach((line) => {
    const timestamps = line.match(/\[(\d{1,2}:\d{2}(?:\.\d{1,3})?)\]/g);
    if (!timestamps) {
      return;
    }

    const lyric = line.replace(/\[[^\]]+\]/g, '').trim();

    timestamps.forEach((stamp) => {
      const cleanStamp = stamp.slice(1, -1);
      entries.push({
        time: songMotifsParseTimestamp(cleanStamp),
        text: lyric
      });
    });
  });

  const seen = new Set();
  return entries
    .sort((a, b) => a.time - b.time)
    .filter((entry) => {
      const key = entry.time.toFixed(3) + '|' + entry.text;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
}

function songMotifsLoadKaraokeEntries() {
  const candidateSlugs = songMotifsResolveSongSlugs();
  const primarySlug = candidateSlugs[0] || '';

  if (window.SongLyrics && typeof window.SongLyrics.loadCurrentSongLyrics === 'function') {
    return window.SongLyrics.loadCurrentSongLyrics(primarySlug).then((data) => {
      if (!data || !Array.isArray(data.timedEntries)) {
        return [];
      }
      return data.timedEntries;
    });
  }

  const file = primarySlug;
  if (!file) {
    return Promise.resolve([]);
  }

  const path = '../../public/lyrics/' + file + '.lrc';
  return fetch(path, { cache: 'no-store' })
    .then((response) => {
      if (!response.ok) {
        throw new Error('No LRC file');
      }
      return response.text();
    })
    .then((text) => songMotifsParseLrcTimedEntries(text))
    .catch(() => []);
}

function buildSongMotifsVolumeControl() {
  const state = getSongMotifsState();
  const wrap = document.createElement('div');
  wrap.className = 'song-motif-volume-wrap';

  const label = document.createElement('label');
  label.className = 'song-motif-volume-label';
  label.htmlFor = 'songMotifVolumeSlider';
  label.textContent = 'Volume';
  wrap.appendChild(label);

  const input = document.createElement('input');
  input.id = 'songMotifVolumeSlider';
  input.className = 'song-motif-volume-slider';
  input.type = 'range';
  input.min = '0';
  input.max = '100';
  input.step = '1';
  input.value = String(state.volume);
  input.setAttribute('aria-label', 'Connections player volume');
  input.addEventListener('input', () => {
    setSongMotifsVolume(input.value);
  });
  wrap.appendChild(input);

  state.volumeInput = input;
  return wrap;
}

function songMotifsFindSong() {
  if (!window.SongData || !window.SongData.allSongs) {
    return null;
  }

  const expectedCandidates = songMotifsResolveSongPathCandidates();

  for (const expectedFile of expectedCandidates) {
    const match = window.SongData.allSongs.find((song) => {
      const songFile = String(song.path || '').split('/').pop();
      return songFile && songFile.toLowerCase() === expectedFile;
    });
    if (match) {
      return match;
    }
  }

  return null;
}

function songMotifsDisposeRuntimeState() {
  const state = getSongMotifsState();

  if (state.timer) {
    clearInterval(state.timer);
    state.timer = null;
  }

  if (state.karaokeTransitionTimer) {
    clearTimeout(state.karaokeTransitionTimer);
    state.karaokeTransitionTimer = null;
  }

  if (state.player && typeof state.player.destroy === 'function') {
    try {
      state.player.destroy();
    } catch (_err) {
      // Ignore teardown errors from iframe API during remount.
    }
  }

  state.player = null;
  state.volumeInput = null;
}

function songMotifsGroupRefs(song) {
  return songMotifsGroupReferenceList(song.motifRefs || [], 'motif');
}

function songMotifsGroupLyricalRefs(song) {
  return songMotifsGroupReferenceList(song.lyricalRefs || [], 'lyrical');
}

function songMotifsGroupSampleRefs(song) {
  return songMotifsGroupReferenceList(song.sampleRefs || [], 'sample');
}

function songMotifsResolveGroupType(entry) {
  if (!entry || !entry.motif) {
    return 'motif';
  }

  const type = String(entry.motif.motifType || '').toLowerCase();
  if (type === 'sample') {
    return 'sample';
  }
  if (type === 'lyrical' || entry.motif.isLyrical) {
    return 'lyrical';
  }
  return 'motif';
}

function songMotifsPartitionRefsByType(groupedRefs) {
  const buckets = {
    motif: [],
    sample: [],
    lyrical: []
  };

  groupedRefs.forEach((entry) => {
    buckets[songMotifsResolveGroupType(entry)].push(entry);
  });

  return buckets;
}

function songMotifsGroupReferenceList(refs, keyPrefix) {
  const map = new Map();

  refs.forEach((ref) => {
    const start = songMotifTimeToSeconds(ref.startTime);
    const end = songMotifTimeToSeconds(ref.endTime);
    const isSamplePoint = keyPrefix === 'sample' || !!ref.isSample;
    if (end < start && !ref.isDefinition) {
      return;
    }

    if (end === start && !ref.isDefinition && !isSamplePoint) {
      return;
    }

    const normalizedEnd = end > start ? end : start + 0.01;

    const motif = window.MotifData.getMotifById(ref.motifId);
    const isVariationMotif = motif && Array.isArray(motif.variations) && motif.variations.length > 0;
    const variationId = isVariationMotif ? (ref.variationId || '') : '';
    const canonicalMotifId = motif ? motif.id : ref.motifId;
    const key = keyPrefix + '::' + canonicalMotifId + '::' + variationId;

    if (!map.has(key)) {
      map.set(key, {
        key,
        motif,
        motifId: canonicalMotifId,
        variationId,
        ranges: []
      });
    }

    map.get(key).ranges.push({
      start,
      end: normalizedEnd,
      isVariation: !!ref.isVariation,
      isDefinition: !!ref.isDefinition
    });
  });

  const grouped = [];
  map.forEach((entry) => {
    entry.ranges.sort((a, b) => a.start - b.start);

    const variation = entry.motif && entry.variationId
      ? entry.motif.variations.find((item) => item.id === entry.variationId || item.label === entry.variationId)
      : null;

    const baseName = entry.motif ? entry.motif.name : entry.motifId;
    const variationLabel = variation ? (variation.label || variation.id) : '';
    const displayName = variationLabel ? (baseName + ' (' + variationLabel + ')') : baseName;
    const displayColor = (variation && variation.color) || (entry.motif && entry.motif.color) || '#999999';

    grouped.push({
      key: entry.key,
      motifId: entry.motifId,
      motif: entry.motif,
      variationId: entry.variationId,
      variation,
      ranges: entry.ranges,
      displayName,
      displayColor
    });
  });

  grouped.sort((a, b) => a.ranges[0].start - b.ranges[0].start);
  return grouped;
}

function songMotifsUpdateLegend(currentTime) {
  const state = getSongMotifsState();
  state.refsByMotif.forEach((entry) => {
    const active = entry.ranges.some((range) => currentTime >= range.start && currentTime <= range.end);
    const node = state.legendNodes.get(entry.key);
    if (!node) return;
    node.classList.toggle('active', active);
  });
}

function songMotifsUpdateProgress() {
  const state = getSongMotifsState();
  if (!state.player || typeof state.player.getCurrentTime !== 'function') {
    return;
  }

  const duration = state.duration > 0 ? state.duration : 1;
  const current = Math.min(duration, Math.max(0, state.player.getCurrentTime() || 0));
  state.progressNode.style.width = ((current / duration) * 100) + '%';
  state.currentLabel.textContent = songMotifFormatTime(current);
  songMotifsUpdateLegend(current);
  songMotifsUpdateKaraoke(current);
}

function songMotifsSeekTo(seconds) {
  const state = getSongMotifsState();
  if (!state.player || typeof state.player.seekTo !== 'function') {
    return;
  }

  const target = Math.min(state.duration, Math.max(0, seconds));
  state.player.seekTo(target, true);
  state.player.playVideo();
  state.currentLabel.textContent = songMotifFormatTime(target);
  state.progressNode.style.width = ((target / (state.duration || 1)) * 100) + '%';
  songMotifsUpdateLegend(target);
  songMotifsUpdateKaraoke(target);
}

function songMotifsRender(song, groupedRefs, groupedSampleRefs, youtubeId) {
  const mount = getSongMotifsMount();
  if (!mount) {
    return;
  }

  const state = getSongMotifsState();
  const groupedByType = songMotifsPartitionRefsByType(groupedRefs);
  const groupedMotifRefs = groupedByType.motif;
  const typedSampleRefs = groupedByType.sample;
  const explicitSampleRefs = Array.isArray(groupedSampleRefs) ? groupedSampleRefs : [];
  const allSampleEntries = typedSampleRefs.concat(explicitSampleRefs)
    .sort((a, b) => a.ranges[0].start - b.ranges[0].start);
  const groupedLyricalMotifRefs = groupedByType.lyrical;
  const groupedLyricalRefs = songMotifsGroupLyricalRefs(song);
  const allLyricalEntries = groupedLyricalMotifRefs.concat(groupedLyricalRefs);
  state.refsByMotif = groupedMotifRefs.concat(allSampleEntries, allLyricalEntries);
  state.lyricalRefs = song.lyricalRefs || [];

  const refsDuration = state.refsByMotif.reduce((max, entry) => {
    return Math.max(max, entry.ranges[entry.ranges.length - 1].end);
  }, 0);

  state.declaredDuration = songMotifsReadDeclaredDuration();
  state.duration = state.declaredDuration > 0 ? state.declaredDuration : refsDuration;

  mount.innerHTML = '';
  const hasVideo = !!youtubeId;

  const shell = document.createElement('section');
  shell.className = 'song-motifs-shell';
  mount.appendChild(shell);

  const videoWrap = document.createElement('div');
  videoWrap.className = 'song-motif-video-wrap';
  shell.appendChild(videoWrap);

  let overlayPlayButton = null;
  if (hasVideo) {
    const host = document.createElement('div');
    host.id = 'songMotifPlayerHost';
    host.className = 'song-motif-yt-host';
    videoWrap.appendChild(host);

    overlayPlayButton = document.createElement('button');
    overlayPlayButton.type = 'button';
    overlayPlayButton.className = 'song-motif-overlay-play';
    overlayPlayButton.textContent = '▶';
    videoWrap.appendChild(overlayPlayButton);
  } else {
    videoWrap.innerHTML = '<div class="song-motif-empty">Playback is unavailable for this song.</div>';
  }

  if (hasVideo) {
    const volumeWrap = buildSongMotifsVolumeControl();
    shell.appendChild(volumeWrap);
  } else {
    state.volumeInput = null;
  }

  const karaokeWrap = document.createElement('section');
  karaokeWrap.className = 'song-karaoke-wrap';
  karaokeWrap.style.display = 'none';
  shell.appendChild(karaokeWrap);

  const karaokeViewport = document.createElement('div');
  karaokeViewport.className = 'song-karaoke-viewport';
  karaokeWrap.appendChild(karaokeViewport);

  const karaokeLayerHost = document.createElement('div');
  karaokeLayerHost.className = 'song-karaoke-layer-host';
  karaokeViewport.appendChild(karaokeLayerHost);

  const controls = document.createElement('div');
  controls.className = 'song-motif-controls';
  shell.appendChild(controls);

  const timelineWrap = document.createElement('div');
  controls.appendChild(timelineWrap);

  const labels = document.createElement('div');
  labels.className = 'song-motif-time-labels';
  timelineWrap.appendChild(labels);

  const currentLabel = document.createElement('span');
  currentLabel.textContent = '0:00';
  labels.appendChild(currentLabel);

  const durationLabel = document.createElement('span');
  durationLabel.textContent = songMotifFormatTime(state.duration);
  labels.appendChild(durationLabel);

  const mainTrack = document.createElement('div');
  mainTrack.className = 'song-motif-main-track';
  timelineWrap.appendChild(mainTrack);

  const progress = document.createElement('div');
  progress.className = 'song-motif-main-progress';
  mainTrack.appendChild(progress);

  const rows = document.createElement('div');
  rows.className = 'song-motif-rows';

  function appendReferenceRows(targetRows, entries) {
    entries.forEach((entry) => {
      const row = document.createElement('article');
      row.className = 'song-motif-row';

      const motifName = entry.displayName;
      const motifColor = entry.displayColor;

      const track = document.createElement('div');
      track.className = 'song-motif-track';

      entry.ranges.forEach((range) => {
        const segment = document.createElement('button');
        segment.type = 'button';
        segment.className = 'song-motif-segment' + (range.isDefinition ? ' definition' : '');
        segment.title = songMotifFormatTime(range.start) + ' - ' + songMotifFormatTime(range.end);
        segment.style.left = ((range.start / state.duration) * 100) + '%';
        segment.style.width = Math.max(0.7, ((range.end - range.start) / state.duration) * 100) + '%';
        segment.style.background = motifColor;

        if (motifColor.toUpperCase() === '#FFFFFF') {
          segment.classList.add('white-segment');
        }

        if (range.isDefinition) {
          segment.title += ' (definition)';
        }

        segment.addEventListener('click', () => {
          songMotifsSeekTo(range.start);
        });

        track.appendChild(segment);
      });

      row.appendChild(track);

      const label = document.createElement('div');
      label.className = 'song-motif-label-link';
      label.classList.add('song-motif-label-text');
      label.textContent = motifName;
      row.appendChild(label);

      targetRows.appendChild(row);
    });
  }

  if (groupedMotifRefs.length === 0 && allSampleEntries.length === 0 && allLyricalEntries.length === 0) {
    shell.appendChild(rows);
    const empty = document.createElement('div');
    empty.className = 'song-motif-empty';
    empty.textContent = 'This song has no connections.';
    rows.appendChild(empty);
  }

  state.legendNodes.clear();
  function appendLegendEntries(targetLegend, entries) {
    entries.forEach((entry) => {
      const motifName = entry.displayName;
      const motifColor = entry.displayColor;

      const item = document.createElement('li');
      item.className = 'song-motif-legend-entry';

      const motifHref = songMotifsResolveMotifHref(entry.motif, entry.motifId);
      const content = motifHref
        ? document.createElement('a')
        : document.createElement('div');
      content.className = 'song-motif-legend-item';
      if (content.tagName === 'A') {
        content.href = motifHref;
      }

      const swatch = document.createElement('span');
      swatch.className = 'song-motif-swatch';
      swatch.style.background = motifColor;
      content.appendChild(swatch);

      const label = document.createElement('span');
      label.textContent = motifName;
      content.appendChild(label);

      item.appendChild(content);
      targetLegend.appendChild(item);
      state.legendNodes.set(entry.key, content);
    });
  }

  if (groupedMotifRefs.length > 0) {
    const listTitle = document.createElement('p');
    listTitle.className = 'song-motif-list-title';
    listTitle.textContent = 'Motifs in this song';
    shell.appendChild(listTitle);

    shell.appendChild(rows);
    appendReferenceRows(rows, groupedMotifRefs);

    const legend = document.createElement('ul');
    legend.className = 'song-motif-legend';
    shell.appendChild(legend);
    appendLegendEntries(legend, groupedMotifRefs);
  }

  if (allSampleEntries.length > 0) {
    const sampleTitle = document.createElement('p');
    sampleTitle.className = 'song-motif-list-title';
    sampleTitle.textContent = 'Samples';
    shell.appendChild(sampleTitle);

    const sampleRows = document.createElement('div');
    sampleRows.className = 'song-motif-rows';
    shell.appendChild(sampleRows);
    appendReferenceRows(sampleRows, allSampleEntries);

    const sampleLegend = document.createElement('ul');
    sampleLegend.className = 'song-motif-legend';
    shell.appendChild(sampleLegend);
    appendLegendEntries(sampleLegend, allSampleEntries);
  }

  if (allLyricalEntries.length > 0) {
    const lyricalTitle = document.createElement('p');
    lyricalTitle.className = 'song-motif-list-title';
    lyricalTitle.textContent = 'Lyrical References';
    shell.appendChild(lyricalTitle);

    const lyricalRows = document.createElement('div');
    lyricalRows.className = 'song-motif-rows';
    shell.appendChild(lyricalRows);
    appendReferenceRows(lyricalRows, allLyricalEntries);

    const lyricalLegend = document.createElement('ul');
    lyricalLegend.className = 'song-motif-legend';
    shell.appendChild(lyricalLegend);
    appendLegendEntries(lyricalLegend, allLyricalEntries);
  }

  state.progressNode = progress;
  state.currentLabel = currentLabel;
  state.durationLabel = durationLabel;
  state.mainTrack = mainTrack;
  state.playButton = overlayPlayButton;
  state.karaokeWrap = karaokeWrap;
  state.karaokeLayerHost = karaokeLayerHost;
  state.karaokeActiveLayer = null;

  if (overlayPlayButton) {
    overlayPlayButton.addEventListener('click', () => {
      if (!state.player || typeof state.player.getPlayerState !== 'function') {
        return;
      }

      if (state.player.getPlayerState() === 1) {
        state.player.pauseVideo();
      } else {
        state.player.playVideo();
      }
    });
  }

  mainTrack.addEventListener('click', (event) => {
    const rect = mainTrack.getBoundingClientRect();
    if (!rect.width) return;
    const percent = (event.clientX - rect.left) / rect.width;
    songMotifsSeekTo(state.duration * Math.min(1, Math.max(0, percent)));
  });
}

function songMotifsAttachPlayer(song, youtubeId) {
  const state = getSongMotifsState();

  if (!youtubeId || !window.YT || !window.YT.Player || state.player) {
    return;
  }

  state.player = new YT.Player('songMotifPlayerHost', {
    height: '220',
    width: '100%',
    videoId: youtubeId,
    playerVars: {
      playsinline: 1,
      controls: 0,
      autoplay: 0,
      disablekb: 1,
      fs: 0,
      modestbranding: 1,
      rel: 0,
      iv_load_policy: 3,
      cc_load_policy: 0
    },
    events: {
      onReady: (event) => {
        const iframe = event.target.getIframe && event.target.getIframe();
        if (iframe) {
          iframe.style.pointerEvents = 'none';
          iframe.setAttribute('tabindex', '-1');
          iframe.setAttribute('aria-hidden', 'true');
        }

        if (typeof event.target.setVolume === 'function') {
          event.target.setVolume(state.volume);
        }

        const ytDuration = Number(event.target.getDuration()) || 0;
        if (state.declaredDuration > 0) {
          state.duration = state.declaredDuration;
        } else {
          state.duration = Math.max(state.duration, ytDuration);
        }
        state.durationLabel.textContent = songMotifFormatTime(state.duration);

        const rows = document.querySelectorAll('.song-motif-track');
        state.refsByMotif.forEach((entry, index) => {
          const row = rows[index];
          if (!row) return;
          const segments = row.querySelectorAll('.song-motif-segment');
          entry.ranges.forEach((range, segIndex) => {
            const segment = segments[segIndex];
            if (!segment) return;
            segment.style.left = ((range.start / state.duration) * 100) + '%';
            segment.style.width = Math.max(0.7, ((range.end - range.start) / state.duration) * 100) + '%';
          });
        });
      },
      onStateChange: (event) => {
        const playing = event.data === 1;
        state.playButton.textContent = playing ? '||' : '▶';

        if (playing) {
          if (state.timer) {
            clearInterval(state.timer);
          }
          state.timer = setInterval(songMotifsUpdateProgress, 120);
        } else {
          if (state.timer) {
            clearInterval(state.timer);
            state.timer = null;
          }
          songMotifsUpdateProgress();
        }
      }
    }
  });
}

function renderSongMotifsSection() {
  const mount = getSongMotifsMount();
  if (!mount || !window.MotifData || !window.SongData) {
    return;
  }

  songMotifsDisposeRuntimeState();

  const song = songMotifsFindSong();
  if (!song) {
    mount.innerHTML = '<div class="song-motif-empty">This song has no connections.</div>';
    return;
  }

  const youtubeId = songMotifsNormalizeYouTubeId(song.youtubeId);
  const groupedRefs = songMotifsGroupRefs(song);
  const groupedSampleRefs = songMotifsGroupSampleRefs(song);
  songMotifsRender(song, groupedRefs, groupedSampleRefs, youtubeId);

  songMotifsLoadKaraokeEntries().then((entries) => {
    songMotifsApplyKaraokeEntries(entries);
  });

  if (youtubeId && window.YT && window.YT.Player) {
    songMotifsAttachPlayer(song, youtubeId);
  }

  const previousYouTubeReady = window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady = function onYouTubeIframeAPIReady() {
    if (typeof previousYouTubeReady === 'function') {
      previousYouTubeReady();
    }
    if (youtubeId) {
      songMotifsAttachPlayer(song, youtubeId);
    }
  };
}

function initializeSongMotifsFeature(attempt) {
  const tries = Number(attempt) || 0;
  if (!window.MotifData || !window.SongData) {
    if (tries < 40) {
      setTimeout(() => initializeSongMotifsFeature(tries + 1), 100);
    }
    return;
  }

  renderSongMotifsSection();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => initializeSongMotifsFeature(0));
} else {
  initializeSongMotifsFeature(0);
}

window.renderSongMotifsSection = renderSongMotifsSection;
