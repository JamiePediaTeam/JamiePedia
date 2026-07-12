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
  const previousText = currentIndex > 0 ? state.karaokeEntries[currentIndex - 1].text : '';
  const currentText = currentIndex >= 0 ? state.karaokeEntries[currentIndex].text : '';
  const nextText = currentIndex >= 0 && currentIndex + 1 < state.karaokeEntries.length
    ? state.karaokeEntries[currentIndex + 1].text
    : '';

  return {
    previousText: previousText || ' ',
    currentText: currentText || ' ',
    nextText: nextText || ' '
  };
}

function songMotifsBuildKaraokeLayer(payload, layerClassName) {
  const layer = document.createElement('div');
  layer.className = 'song-karaoke-layer ' + layerClassName;

  const previous = document.createElement('p');
  previous.className = 'song-karaoke-line song-karaoke-line-prev';
  previous.textContent = payload.previousText;
  layer.appendChild(previous);

  const current = document.createElement('p');
  current.className = 'song-karaoke-line song-karaoke-line-current';
  current.textContent = payload.currentText;
  layer.appendChild(current);

  const next = document.createElement('p');
  next.className = 'song-karaoke-line song-karaoke-line-next';
  next.textContent = payload.nextText;
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

  state.karaokeEntries = entries
    .filter((entry) => entry && typeof entry.time === 'number' && typeof entry.text === 'string')
    .sort((a, b) => a.time - b.time);

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
  const map = new Map();

  song.motifRefs.forEach((ref) => {
    const start = songMotifTimeToSeconds(ref.startTime);
    const end = songMotifTimeToSeconds(ref.endTime);
    if (end <= start && !ref.isDefinition) {
      return;
    }

    const motif = window.MotifData.getMotifById(ref.motifId);
    const isVariationMotif = motif && Array.isArray(motif.variations) && motif.variations.length > 0;
    const variationId = isVariationMotif ? (ref.variationId || '') : '';
    const canonicalMotifId = motif ? motif.id : ref.motifId;
    const key = canonicalMotifId + '::' + variationId;

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
      end,
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

function songMotifsRender(song, groupedRefs, youtubeId) {
  const mount = getSongMotifsMount();
  if (!mount) {
    return;
  }

  const state = getSongMotifsState();
  state.refsByMotif = groupedRefs;

  const refsDuration = groupedRefs.reduce((max, entry) => {
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
  shell.appendChild(rows);

  groupedRefs.forEach((entry) => {
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

    const link = document.createElement('a');
    link.className = 'song-motif-label-link';
    link.href = '../../motifs/' + ((entry.motif && entry.motif.pageSlug) ? entry.motif.pageSlug : (entry.motif ? entry.motif.id : entry.motifId)) + '.html';
    link.textContent = motifName;
    row.appendChild(link);

    rows.appendChild(row);
  });

  if (groupedRefs.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'song-motif-empty';
    empty.textContent = 'This song has no connections.';
    rows.appendChild(empty);
  }

  const listTitle = document.createElement('p');
  listTitle.className = 'song-motif-list-title';
  listTitle.textContent = 'Motifs in this song';
  shell.appendChild(listTitle);

  const legend = document.createElement('ul');
  legend.className = 'song-motif-legend';
  shell.appendChild(legend);

  state.legendNodes.clear();
  groupedRefs.forEach((entry) => {
    const motifName = entry.displayName;
    const motifColor = entry.displayColor;

    const item = document.createElement('li');
    item.className = 'song-motif-legend-item';

    const swatch = document.createElement('span');
    swatch.className = 'song-motif-swatch';
    swatch.style.background = motifColor;
    item.appendChild(swatch);

    const label = document.createElement('span');
    label.textContent = motifName;
    item.appendChild(label);

    legend.appendChild(item);
    state.legendNodes.set(entry.key, item);
  });

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
  songMotifsRender(song, groupedRefs, youtubeId);

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
