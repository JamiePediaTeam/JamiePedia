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

function getSongMotifsMount() {
  let mount = document.getElementById('songMotifsContent');
  if (mount) {
    return mount;
  }

  const content = document.getElementById('content-motifs');
  if (!content) {
    return null;
  }

  content.innerHTML = '';
  mount = document.createElement('div');
  mount.id = 'songMotifsContent';
  mount.className = 'song-motifs-content';
  content.appendChild(mount);
  return mount;
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
      playButton: null
    };
  }
  return window.__songMotifsState;
}

function songMotifsFindSong() {
  if (!window.SongData || !window.SongData.allSongs) {
    return null;
  }

  const currentFile = (window.location.pathname.split('/').pop() || '').toLowerCase();
  return window.SongData.allSongs.find((song) => {
    const songFile = String(song.path || '').split('/').pop();
    return songFile && songFile.toLowerCase() === currentFile;
  }) || null;
}

function songMotifsGroupRefs(song) {
  const map = new Map();

  song.motifRefs.forEach((ref) => {
    const start = songMotifTimeToSeconds(ref.startTime);
    const end = songMotifTimeToSeconds(ref.endTime);
    if (end <= start) {
      return;
    }

    if (!map.has(ref.motifId)) {
      map.set(ref.motifId, []);
    }

    map.get(ref.motifId).push({
      start,
      end,
      isVariation: !!ref.isVariation
    });
  });

  const grouped = [];
  map.forEach((ranges, motifId) => {
    ranges.sort((a, b) => a.start - b.start);
    const motif = window.MotifData.getMotifById(motifId);
    grouped.push({ motifId, motif, ranges });
  });

  grouped.sort((a, b) => a.ranges[0].start - b.ranges[0].start);
  return grouped;
}

function songMotifsUpdateLegend(currentTime) {
  const state = getSongMotifsState();
  state.refsByMotif.forEach((entry) => {
    const active = entry.ranges.some((range) => currentTime >= range.start && currentTime <= range.end);
    const node = state.legendNodes.get(entry.motifId);
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
}

function songMotifsRender(song, groupedRefs) {
  const mount = getSongMotifsMount();
  if (!mount) {
    return;
  }

  const state = getSongMotifsState();
  state.refsByMotif = groupedRefs;

  const refsDuration = groupedRefs.reduce((max, entry) => {
    return Math.max(max, entry.ranges[entry.ranges.length - 1].end);
  }, 0);

  state.duration = Math.max(refsDuration, songMotifTimeToSeconds('5:13'));

  mount.innerHTML = '';

  if (!song.youtubeId || groupedRefs.length === 0) {
    mount.innerHTML = '<div class="song-motif-empty">This song has no other connections.</div>';
    return;
  }

  const shell = document.createElement('section');
  shell.className = 'song-motifs-shell';
  mount.appendChild(shell);

  const videoWrap = document.createElement('div');
  videoWrap.className = 'song-motif-video-wrap';
  shell.appendChild(videoWrap);

  const host = document.createElement('div');
  host.id = 'songMotifPlayerHost';
  host.className = 'song-motif-yt-host';
  videoWrap.appendChild(host);

  const overlayPlayButton = document.createElement('button');
  overlayPlayButton.type = 'button';
  overlayPlayButton.className = 'song-motif-overlay-play';
  overlayPlayButton.textContent = '▶';
  videoWrap.appendChild(overlayPlayButton);

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

    const motifName = entry.motif ? entry.motif.name : entry.motifId;
    const motifColor = entry.motif && entry.motif.color ? entry.motif.color : '#999999';

    const track = document.createElement('div');
    track.className = 'song-motif-track';

    entry.ranges.forEach((range) => {
      const segment = document.createElement('button');
      segment.type = 'button';
      segment.className = 'song-motif-segment';
      segment.title = songMotifFormatTime(range.start) + ' - ' + songMotifFormatTime(range.end);
      segment.style.left = ((range.start / state.duration) * 100) + '%';
      segment.style.width = Math.max(0.7, ((range.end - range.start) / state.duration) * 100) + '%';
      segment.style.background = motifColor;

      if (motifColor.toUpperCase() === '#FFFFFF') {
        segment.classList.add('white-segment');
      }

      segment.addEventListener('click', () => {
        songMotifsSeekTo(range.start);
      });

      track.appendChild(segment);
    });

    row.appendChild(track);

    const link = document.createElement('a');
    link.className = 'song-motif-label-link';
    link.href = '../../motifs/' + entry.motifId + '.html';
    link.textContent = motifName;
    row.appendChild(link);

    rows.appendChild(row);
  });

  const listTitle = document.createElement('p');
  listTitle.className = 'song-motif-list-title';
  listTitle.textContent = 'Motifs in this song';
  shell.appendChild(listTitle);

  const legend = document.createElement('ul');
  legend.className = 'song-motif-legend';
  shell.appendChild(legend);

  state.legendNodes.clear();
  groupedRefs.forEach((entry) => {
    const motifName = entry.motif ? entry.motif.name : entry.motifId;
    const motifColor = entry.motif && entry.motif.color ? entry.motif.color : '#999999';

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
    state.legendNodes.set(entry.motifId, item);
  });

  state.progressNode = progress;
  state.currentLabel = currentLabel;
  state.durationLabel = durationLabel;
  state.mainTrack = mainTrack;
  state.playButton = overlayPlayButton;

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

  mainTrack.addEventListener('click', (event) => {
    const rect = mainTrack.getBoundingClientRect();
    if (!rect.width) return;
    const percent = (event.clientX - rect.left) / rect.width;
    songMotifsSeekTo(state.duration * Math.min(1, Math.max(0, percent)));
  });
}

function songMotifsAttachPlayer(song) {
  const state = getSongMotifsState();

  if (!window.YT || !window.YT.Player || state.player) {
    return;
  }

  state.player = new YT.Player('songMotifPlayerHost', {
    height: '220',
    width: '100%',
    videoId: song.youtubeId,
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

        const ytDuration = Number(event.target.getDuration()) || 0;
        state.duration = Math.max(state.duration, ytDuration);
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

  const song = songMotifsFindSong();
  if (!song) {
    mount.innerHTML = '<div class="song-motif-empty">This song has no other connections.</div>';
    return;
  }

  const groupedRefs = songMotifsGroupRefs(song);
  songMotifsRender(song, groupedRefs);

  if (window.YT && window.YT.Player) {
    songMotifsAttachPlayer(song);
  }

  const previousYouTubeReady = window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady = function onYouTubeIframeAPIReady() {
    if (typeof previousYouTubeReady === 'function') {
      previousYouTubeReady();
    }
    songMotifsAttachPlayer(song);
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
