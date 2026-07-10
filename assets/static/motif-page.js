function getCurrentMotifId() {
  const pathname = window.location.pathname;
  const filename = pathname.split('/').pop() || '';
  return filename.replace('.html', '').toLowerCase();
}

function timeToSeconds(value) {
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

function formatTime(seconds) {
  const safe = Math.max(0, Math.floor(Number(seconds) || 0));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return mins + ':' + String(secs).padStart(2, '0');
}

function buildVariationIcon(motif, badges = [], extraClass = '') {
  const icon = document.createElement('div');
  icon.className = 'motif-variation-icon ' + extraClass;
  icon.style.setProperty('--motif-icon-color', motif.iconColor || motif.color || '#ef8a85');

  const baseText = document.createElement('span');
  baseText.className = 'motif-variation-base';
  baseText.textContent = motif.iconText || motif.name;
  icon.appendChild(baseText);

  const allBadges = badges.length > 0
    ? badges
    : (motif.variationLabel ? [motif.variationLabel] : []);

  if (allBadges.length > 0) {
    const badgeList = document.createElement('span');
    badgeList.className = 'motif-variation-badge-list';

    allBadges.forEach((label) => {
      const badge = document.createElement('span');
      badge.className = 'motif-variation-badge';
      badge.textContent = label;
      badgeList.appendChild(badge);
    });

    icon.appendChild(badgeList);
  }

  return icon;
}

function buildVariationImagePanel(motif, extraClass = '') {
  const panel = document.createElement('div');
  panel.className = 'motif-variation-image-panel ' + extraClass;

  const artWrap = document.createElement('div');
  artWrap.className = 'motif-variation-art-wrap';
  panel.appendChild(artWrap);

  const art = document.createElement('img');
  art.className = 'motif-variation-art';
  art.src = motif.image || '../public/images/cover-art/bs.png';
  art.alt = motif.name + ' motif image';
  artWrap.appendChild(art);

  const side = document.createElement('div');
  side.className = 'motif-variation-side';
  panel.appendChild(side);

  const variations = Array.isArray(motif.variations) ? motif.variations : [];
  variations.forEach((variation) => {
    const badge = document.createElement('div');
    badge.className = 'motif-variation-side-badge';
    badge.textContent = variation.label || variation.id || '?';
    badge.style.setProperty('--variation-color', variation.color || motif.color || '#351854');
    side.appendChild(badge);
  });

  return panel;
}

function getVariationForRef(motif, ref) {
  if (!motif || !Array.isArray(motif.variations) || motif.variations.length === 0) {
    return null;
  }

  if (!ref.variationId) {
    return null;
  }

  return motif.variations.find((variation) => variation.id === ref.variationId || variation.label === ref.variationId) || null;
}

function getSongRefsForMotif(song, motif, variationId = '') {
  return song.motifRefs
    .filter((ref) => ref.motifId === motif.id || motif.aliases.includes(ref.motifId))
    .map((ref) => ({
      startTime: timeToSeconds(ref.startTime),
      endTime: timeToSeconds(ref.endTime),
      isVariation: ref.isVariation,
      isDefinition: ref.isDefinition,
      variationId: ref.variationId || ''
    }))
    .filter((ref) => ref.endTime > ref.startTime)
    .filter((ref) => !variationId || ref.variationId === variationId)
    .sort((a, b) => a.startTime - b.startTime);
}

const PlayerStore = {
  rows: [],
  activeRow: null,
  apiReady: false
};

function pauseOthers(exceptRow) {
  PlayerStore.rows.forEach((row) => {
    if (row !== exceptRow && row.player && typeof row.player.pauseVideo === 'function') {
      row.player.pauseVideo();
    }
  });
}

function updateButtonState(row, isPlaying) {
  row.playButton.textContent = isPlaying ? '||' : '▶';
}

function updateProgress(row) {
  if (!row.player || typeof row.player.getCurrentTime !== 'function') {
    return;
  }

  const duration = row.duration > 0 ? row.duration : 1;
  const current = Math.min(duration, Math.max(0, row.player.getCurrentTime() || 0));
  const percent = (current / duration) * 100;

  row.progress.style.width = percent + '%';
  row.currentLabel.textContent = formatTime(current);
}

function seekToPercent(row, percent) {
  if (!row.player || typeof row.player.seekTo !== 'function') {
    return;
  }

  const clamped = Math.min(1, Math.max(0, percent));
  const target = row.duration * clamped;
  row.player.seekTo(target, true);
  row.player.playVideo();
  pauseOthers(row);
}

function buildTimelineRow(song, motif, index, refs, options = {}) {
  const row = document.createElement('article');
  row.className = 'motif-player-row';

  const left = document.createElement(song.path ? 'a' : 'div');
  left.className = 'motif-song-pill';
  left.style.borderColor = song.color || '#351854';
  left.textContent = song.title;
  if (song.path) {
    left.href = song.path;
  }
  row.appendChild(left);

  const right = document.createElement('div');
  right.className = 'motif-player-main';
  row.appendChild(right);

  const controls = document.createElement('div');
  controls.className = 'motif-controls';
  right.appendChild(controls);

  const playButton = document.createElement('button');
  playButton.className = 'motif-play-btn';
  playButton.textContent = '▶';
  controls.appendChild(playButton);

  const trackArea = document.createElement('div');
  trackArea.className = 'motif-track-area';
  controls.appendChild(trackArea);

  const labels = document.createElement('div');
  labels.className = 'motif-time-labels';
  trackArea.appendChild(labels);

  const currentLabel = document.createElement('span');
  currentLabel.textContent = '0:00';
  labels.appendChild(currentLabel);

  const durationLabel = document.createElement('span');
  durationLabel.textContent = '0:00';
  labels.appendChild(durationLabel);

  const mainTrack = document.createElement('div');
  mainTrack.className = 'motif-main-track';
  trackArea.appendChild(mainTrack);

  const progress = document.createElement('div');
  progress.className = 'motif-main-progress';
  progress.style.background = song.color || '#351854';
  mainTrack.appendChild(progress);

  const segmentTrack = document.createElement('div');
  segmentTrack.className = 'motif-segment-track';
  trackArea.appendChild(segmentTrack);

  const motifLabel = document.createElement('div');
  motifLabel.className = 'motif-label';
  motifLabel.textContent = options.labelText || motif.name;
  trackArea.appendChild(motifLabel);

  const ytHost = document.createElement('div');
  const ytHostId = 'motif-yt-' + index;
  ytHost.id = ytHostId;
  ytHost.className = 'motif-youtube-host';
  right.appendChild(ytHost);

  const rowState = {
    song,
    motif,
    refs,
    playButton,
    currentLabel,
    durationLabel,
    progress,
    mainTrack,
    segmentTrack,
    ytHostId,
    player: null,
    duration: refs.reduce((max, ref) => Math.max(max, ref.endTime), 0),
    timer: null,
    showVariationBadges: !!options.showVariationBadges
  };

  rowState.durationLabel.textContent = formatTime(rowState.duration);
  renderSegments(rowState);

  playButton.addEventListener('click', () => {
    if (!rowState.player || typeof rowState.player.getPlayerState !== 'function') {
      return;
    }

    const state = rowState.player.getPlayerState();
    if (state === 1) {
      rowState.player.pauseVideo();
    } else {
      rowState.player.playVideo();
      pauseOthers(rowState);
    }
  });

  mainTrack.addEventListener('click', (event) => {
    const rect = mainTrack.getBoundingClientRect();
    if (!rect.width) return;
    const percent = (event.clientX - rect.left) / rect.width;
    seekToPercent(rowState, percent);
  });

  return { element: row, state: rowState };
}

function renderSegments(rowState) {
  rowState.segmentTrack.innerHTML = '';

  if (rowState.duration <= 0) {
    return;
  }

  rowState.refs.forEach((ref) => {
    const segment = document.createElement('button');
    segment.type = 'button';
    const variation = getVariationForRef(rowState.motif, ref);
    segment.className = 'motif-segment'
      + (ref.isVariation ? ' variation' : '')
      + (ref.isDefinition ? ' definition' : '')
      + (variation ? ' has-variation' : '');

    const left = (ref.startTime / rowState.duration) * 100;
    const width = ((ref.endTime - ref.startTime) / rowState.duration) * 100;

    segment.style.left = Math.max(0, left) + '%';
    segment.style.width = Math.max(0.6, width) + '%';
    const motifColor = (variation && variation.color) || rowState.motif.color || '#351854';
    segment.style.background = motifColor;

    if (ref.isVariation) {
      segment.style.background = 'repeating-linear-gradient(90deg, ' + motifColor + ', ' + motifColor + ' 4px, #ffffff 4px, #ffffff 8px)';
    }

    if (variation && variation.label) {
      if (rowState.showVariationBadges) {
        const badge = document.createElement('span');
        badge.className = 'motif-segment-badge';
        badge.textContent = variation.label;
        segment.appendChild(badge);
      }
    }

    segment.title = formatTime(ref.startTime) + ' - ' + formatTime(ref.endTime) + (ref.isDefinition ? ' (definition)' : '');

    segment.addEventListener('click', () => {
      if (!rowState.player || typeof rowState.player.seekTo !== 'function') {
        return;
      }
      rowState.player.seekTo(ref.startTime, true);
      rowState.player.playVideo();
      pauseOthers(rowState);
    });

    rowState.segmentTrack.appendChild(segment);
  });
}

function startTimer(rowState) {
  if (rowState.timer) {
    clearInterval(rowState.timer);
  }

  rowState.timer = setInterval(() => updateProgress(rowState), 120);
}

function stopTimer(rowState) {
  if (rowState.timer) {
    clearInterval(rowState.timer);
    rowState.timer = null;
  }
}

function createYouTubePlayers() {
  if (!window.YT || !window.YT.Player) {
    return;
  }

  PlayerStore.rows.forEach((rowState) => {
    if (!rowState.song.youtubeId || rowState.player) {
      return;
    }

    rowState.player = new YT.Player(rowState.ytHostId, {
      height: '0',
      width: '0',
      videoId: rowState.song.youtubeId,
      playerVars: {
        playsinline: 1
      },
      events: {
        onReady: (event) => {
          const ytDuration = Number(event.target.getDuration()) || 0;
          const fallback = rowState.refs.reduce((max, ref) => Math.max(max, ref.endTime), 0);
          rowState.duration = Math.max(ytDuration, fallback);
          rowState.durationLabel.textContent = formatTime(rowState.duration);
          renderSegments(rowState);
        },
        onStateChange: (event) => {
          const playing = event.data === 1;
          updateButtonState(rowState, playing);

          if (playing) {
            PlayerStore.activeRow = rowState;
            pauseOthers(rowState);
            startTimer(rowState);
          } else {
            stopTimer(rowState);
            updateProgress(rowState);
          }
        }
      }
    });
  });
}

window.onYouTubeIframeAPIReady = function onYouTubeIframeAPIReady() {
  PlayerStore.apiReady = true;
  createYouTubePlayers();
};

function renderMotifPage() {
  if (!window.MotifData || !window.SongData) {
    return;
  }

  const motifId = getCurrentMotifId();
  const motif = window.MotifData.getMotifById(motifId);

  const motifName = document.getElementById('motifName');
  const motifImage = document.getElementById('motifImage');
  const motifImageWrap = document.querySelector('.motif-image-wrap');
  const songList = document.getElementById('motifSongList');
  const songsHeading = document.getElementById('motifSongsHeading');

  if (!motif || !motifName || !motifImage || !songList) {
    return;
  }

  document.title = 'JamiePedia! - Motif - ' + motif.name;
  motifName.textContent = motif.name;
  if (motifImageWrap) {
    const existingVariationIcon = motifImageWrap.querySelector('.motif-variation-icon');
    if (existingVariationIcon) {
      existingVariationIcon.remove();
    }

    const existingVariationPanel = motifImageWrap.querySelector('.motif-variation-image-panel');
    if (existingVariationPanel) {
      existingVariationPanel.remove();
    }
  }

  if (motif.variationGroup && motif.iconText && motifImageWrap) {
    const badges = Array.isArray(motif.variations)
      ? motif.variations.map((variation) => variation.label || variation.id).filter(Boolean)
      : [];

    if (motif.image && badges.length > 0) {
      motifImage.style.display = 'none';
      const panel = buildVariationImagePanel(motif, 'motif-image');
      panel.setAttribute('aria-label', motif.name + ' motif image with variation panels');
      motifImageWrap.appendChild(panel);
    } else if (motif.image) {
      motifImage.style.display = '';
      motifImage.src = motif.image;
      motifImage.alt = motif.name + ' motif image';
    } else {
      motifImage.style.display = 'none';
      const icon = buildVariationIcon(motif, badges, 'motif-image');
      icon.setAttribute('aria-label', motif.name + ' motif icon');
      motifImageWrap.appendChild(icon);
    }
  } else {
    motifImage.style.display = '';
    motifImage.src = motif.image || '../public/images/cover-art/bs.png';
    motifImage.alt = motif.name + ' motif image';
  }
  if (songsHeading) {
    songsHeading.textContent = 'Songs with ' + motif.name;
  }

  const motifIds = [motif.id].concat(motif.aliases || []);
  const songs = window.SongData.allSongs.filter((song) =>
    song.motifRefs.some((ref) => motifIds.includes(ref.motifId))
  );
  songList.innerHTML = '';
  PlayerStore.rows = [];

  if (songs.length === 0) {
    const emptyState = document.createElement('div');
    emptyState.className = 'motif-empty';
    emptyState.textContent = 'No song entries yet. Add entries in assets/static/song-data.js.';
    songList.appendChild(emptyState);
    return;
  }

  let rowIndex = 0;
  const hasVariations = Array.isArray(motif.variations) && motif.variations.length > 0;

  if (hasVariations) {
    if (songsHeading) {
      songsHeading.textContent = 'Motif Variations';
    }

    motif.variations.forEach((variation) => {
      const variationId = variation.id || variation.label || '';
      const variationLabel = variation.label || variation.id || '?';

      const section = document.createElement('section');
      section.className = 'motif-variation-section';

      const heading = document.createElement('h3');
      heading.className = 'motif-variation-heading';
      heading.textContent = 'Songs with ' + motif.name + ' (' + variationLabel + ')';
      section.appendChild(heading);

      const sectionList = document.createElement('div');
      sectionList.className = 'motif-song-list';
      section.appendChild(sectionList);

      songs.forEach((song) => {
        const refs = getSongRefsForMotif(song, motif, variationId);
        if (refs.length === 0) {
          return;
        }

        const built = buildTimelineRow(song, motif, rowIndex, refs, {
          labelText: motif.name + ' (' + variationLabel + ')',
          showVariationBadges: false
        });
        rowIndex += 1;

        PlayerStore.rows.push(built.state);
        sectionList.appendChild(built.element);
      });

      if (sectionList.children.length > 0) {
        songList.appendChild(section);
      }
    });
  } else {
    songs.forEach((song) => {
      const refs = getSongRefsForMotif(song, motif);
      if (refs.length === 0) {
        return;
      }

      const built = buildTimelineRow(song, motif, rowIndex, refs, {
        labelText: motif.name,
        showVariationBadges: true
      });
      rowIndex += 1;
      PlayerStore.rows.push(built.state);
      songList.appendChild(built.element);
    });
  }

  if (PlayerStore.apiReady || (window.YT && window.YT.Player)) {
    createYouTubePlayers();
  }
}

document.addEventListener('DOMContentLoaded', renderMotifPage);