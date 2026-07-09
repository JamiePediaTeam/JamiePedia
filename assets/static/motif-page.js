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

function buildTimelineRow(song, motif, index) {
  const row = document.createElement('article');
  row.className = 'motif-player-row';

  const refs = song.motifRefs
    .filter((ref) => ref.motifId === motif.id)
    .map((ref) => ({
      startTime: timeToSeconds(ref.startTime),
      endTime: timeToSeconds(ref.endTime),
      isVariation: ref.isVariation
    }))
    .filter((ref) => ref.endTime > ref.startTime);

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
  motifLabel.textContent = motif.name;
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
    timer: null
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
    segment.className = 'motif-segment' + (ref.isVariation ? ' variation' : '');

    const left = (ref.startTime / rowState.duration) * 100;
    const width = ((ref.endTime - ref.startTime) / rowState.duration) * 100;

    segment.style.left = Math.max(0, left) + '%';
    segment.style.width = Math.max(0.6, width) + '%';
    const motifColor = rowState.motif.color || '#351854';
    segment.style.background = motifColor;

    if (ref.isVariation) {
      segment.style.background = 'repeating-linear-gradient(90deg, ' + motifColor + ', ' + motifColor + ' 4px, #ffffff 4px, #ffffff 8px)';
    }

    segment.title = formatTime(ref.startTime) + ' - ' + formatTime(ref.endTime);

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
  const songList = document.getElementById('motifSongList');
  const songsHeading = document.getElementById('motifSongsHeading');

  if (!motif || !motifName || !motifImage || !songList) {
    return;
  }

  document.title = 'JamiePedia! - Motif - ' + motif.name;
  motifName.textContent = motif.name;
  motifImage.src = motif.image || '../public/images/cover-art/bs.png';
  motifImage.alt = motif.name + ' motif image';
  if (songsHeading) {
    songsHeading.textContent = 'Songs with ' + motif.name;
  }

  const songs = window.SongData.getSongsWithMotifId(motif.id);
  songList.innerHTML = '';
  PlayerStore.rows = [];

  if (songs.length === 0) {
    const emptyState = document.createElement('div');
    emptyState.className = 'motif-empty';
    emptyState.textContent = 'No song entries yet. Add entries in assets/static/song-data.js.';
    songList.appendChild(emptyState);
    return;
  }

  songs.forEach((song, index) => {
    const built = buildTimelineRow(song, motif, index);
    PlayerStore.rows.push(built.state);
    songList.appendChild(built.element);
  });

  if (PlayerStore.apiReady || (window.YT && window.YT.Player)) {
    createYouTubePlayers();
  }
}

document.addEventListener('DOMContentLoaded', renderMotifPage);