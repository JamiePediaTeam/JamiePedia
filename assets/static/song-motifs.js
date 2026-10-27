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
  const totalMs = Math.max(0, Number(seconds) || 0) * 1000;
  const mins = Math.floor(totalMs / 60000);
  const secs = Math.floor((totalMs % 60000) / 1000);
  const hundredths = Math.floor((totalMs % 1000) / 10);
  return mins + ':' + String(secs).padStart(2, '0') + '.' + String(hundredths).padStart(2, '0');
}

function songMotifsNormalizeYouTubeId(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    return '';
  }

  let candidate = raw;
  try {
function songMotifsResolveSingerByToken(value) {
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
  const getActiveScope = () => {
    if (typeof window.getActiveVersionName === 'function') {
      const activeVersionName = String(window.getActiveVersionName() || '').trim();
      if (activeVersionName) {
        const scope = document.getElementById('version-' + activeVersionName);
        if (scope) {
          return scope;
        }
      }
    }

    const visibleVersion = Array.from(document.querySelectorAll('[id^="version-"]')).find((node) => {
      return node && node.offsetParent !== null;
    });

    return visibleVersion || document;
  };

  const findTimeInText = (text) => {
    const match = String(text || '').match(/(\d{1,2}:\d{2}(?::\d{2})?(?:\.\d+)?)/);
    return match ? songMotifTimeToSeconds(match[1]) : 0;
  };

  const songLengthNodes = Array.from(getActiveScope().querySelectorAll('.song-length'));
  if (!songLengthNodes.length) {
    return 0;
  }

  for (const node of songLengthNodes) {
    if (!node || node.offsetParent === null) {
      continue;
    }

    const source = String((node.dataset || {}).songLengthSource || '').trim().toLowerCase();
    if (source && source !== 'manual') {
      continue;
    }

    const visibleDuration = findTimeInText(node.textContent);
    if (visibleDuration > 0) {
      return visibleDuration;
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
  if (typeof window.getActiveVersionName === 'function') {
    const activeVersionName = String(window.getActiveVersionName() || '').trim().toLowerCase();
    if (!activeVersionName || activeVersionName === 'original') {
      return '';
    }
    return activeVersionName;
  }

  const visibleVersion = Array.from(document.querySelectorAll('[id^="version-"]')).find((node) => node && node.offsetParent !== null);

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
  if (typeof getMusicRouteContext === 'function') {
    const route = getMusicRouteContext(window.location.pathname || '');
    if (route && route.slug) {
      return String(route.slug).toLowerCase();
    }
  }

  const file = (window.location.pathname.split('/').pop() || '').replace(/\.html$/i, '').toLowerCase();
  return file;
}

function songMotifsNormalizeVersionHashToken(value) {
  const source = String(value || '').trim().replace(/^#/, '');
  const versionPart = source.split('/')[0] || '';
  return String(versionPart || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

function songMotifsGetActiveVariantHashToken() {
  const activeVariantSuffix = songMotifsGetActiveVariantSuffix();
  if (!activeVariantSuffix) {
    return '';
  }

  if (typeof window.getHashTokenForVersion === 'function') {
    const helperToken = String(window.getHashTokenForVersion(activeVariantSuffix) || '').trim();
    if (helperToken) {
      return songMotifsNormalizeVersionHashToken(helperToken);
    }
  }

  const hashToken = songMotifsNormalizeVersionHashToken(window.location.hash);
  if (hashToken) {
    return hashToken;
  }

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
  const variantHashToken = songMotifsGetActiveVariantHashToken();
  if (!baseSlug) {
    return [];
  }

  if (!variantSuffix) {
    return [baseSlug];
  }

  const candidates = [];
  if (variantHashToken) {
    candidates.push(baseSlug + '#' + variantHashToken);
  }
  candidates.push(baseSlug + variantSuffix);
  return candidates;
}

const JAMIEPEDIA_VOLUME_STORAGE_KEY = 'jamiepedia.playerVolume';

function readPersistedPlayerVolume() {
  try {
    const stored = window.localStorage ? window.localStorage.getItem(JAMIEPEDIA_VOLUME_STORAGE_KEY) : null;
    const parsed = Number(stored);
    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.min(100, parsed));
    }
  } catch (_error) {
    // Ignore storage access errors (private mode, blocked storage, etc.).
  }

  return 100;
}

function persistPlayerVolume(value) {
  try {
    if (window.localStorage) {
      window.localStorage.setItem(JAMIEPEDIA_VOLUME_STORAGE_KEY, String(value));
    }
  } catch (_error) {
    // Ignore storage access errors.
  }
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
      motifProgressNodes: [],
      motifRenderCallbacks: [],
      currentLabel: null,
      durationLabel: null,
      mainTrack: null,
      playButton: null,
      declaredDuration: 0,
      karaokeDuration: 0,
      youtubeDuration: 0,
      volume: readPersistedPlayerVolume(),
      volumeInput: null,
      karaokeEntries: [],
      lyricalRefs: [],
      karaokeCurrentIndex: -2,
      karaokeWrap: null,
      karaokeViewport: null,
      karaokeLayerHost: null,
      karaokeActiveLayer: null,
      karaokeTransitionTimer: null,
      karaokeMainReentryAnimationTimer: null,
      karaokeWrapResizeTimer: null,
      karaokeLayoutMode: 'hidden',
      karaokeConfiguredBackingTrackCount: 0,
      karaokeBackingVisible: false,
      karaokeBackingWrap: null,
      karaokeBackingTracks: [],
      karaokePrimarySingerToken: '',
      karaokePrimarySingerArtist: null,
      renderKey: ''
    };
  }
  if (typeof window.__songMotifsState.renderKey !== 'string') {
    window.__songMotifsState.renderKey = '';
  }
  if (!Array.isArray(window.__songMotifsState.motifProgressNodes)) {
    window.__songMotifsState.motifProgressNodes = [];
  }
  if (!Array.isArray(window.__songMotifsState.motifRenderCallbacks)) {
    window.__songMotifsState.motifRenderCallbacks = [];
  }
  return window.__songMotifsState;
}

function songMotifsFindCurrentEntryIndex(entries, syncedTime) {
  const list = Array.isArray(entries) ? entries : [];
  if (!list.length) {
    return -1;
  }

  let currentIndex = -1;
  for (let i = 0; i < list.length; i += 1) {
    if ((Number(list[i].time) || 0) <= syncedTime + 0.01) {
      currentIndex = i;
    } else {
      break;
    }
  }

  return currentIndex;
}

function songMotifsEntryHasRenderableText(entry) {
  return Boolean(String((entry || {}).text || '').trim());
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

function songMotifsBuildKaraokePayloadForEntries(entries, currentIndex) {
  const list = Array.isArray(entries) ? entries : [];
  const previousEntry = currentIndex > 0 ? list[currentIndex - 1] : null;
  const currentEntry = currentIndex >= 0 ? list[currentIndex] : null;
  const nextEntry = currentIndex >= 0 && currentIndex + 1 < list.length
    ? list[currentIndex + 1]
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

function songMotifsExtractWordSequence(value) {
  return String(value || '')
    .replace(/<[^<>]*>/g, ' ')
    .toLowerCase()
    .match(/[a-z0-9']+/g) || [];
}

function songMotifsReferenceWordsMatch(sourceText, referenceText) {
  const sourceWords = songMotifsExtractWordSequence(sourceText);
  const patternWords = songMotifsExtractWordSequence(referenceText);
  if (!patternWords.length || !sourceWords.length) {
    return false;
  }

  let patternIndex = 0;
  for (let sourceIndex = 0; sourceIndex < sourceWords.length && patternIndex < patternWords.length; sourceIndex += 1) {
    if (sourceWords[sourceIndex] === patternWords[patternIndex]) {
      patternIndex += 1;
    }
  }

  return patternIndex === patternWords.length;
}

function songMotifsHighlightTextWithInsertedGaps(sourceText, matchText, color) {
  const source = String(sourceText || '');
  const pattern = String(matchText || '');
  const escapedSource = songMotifsEscapeHtml(source);

  if (!source || !pattern) {
    return escapedSource;
  }

  const patternWords = songMotifsExtractWordSequence(pattern);
  if (!patternWords.length) {
    return escapedSource;
  }

  const sourceWords = songMotifsExtractWordSequence(source);
  const highlightedWordIndexes = new Set();
  let patternIndex = 0;

  for (let sourceIndex = 0; sourceIndex < sourceWords.length && patternIndex < patternWords.length; sourceIndex += 1) {
    if (sourceWords[sourceIndex] === patternWords[patternIndex]) {
      highlightedWordIndexes.add(sourceIndex);
      patternIndex += 1;
    }
  }

  if (patternIndex !== patternWords.length) {
    return escapedSource;
  }

  const wordMatches = [...source.matchAll(/[A-Za-z0-9'’]+/g)];
  let output = '';
  let lastIndex = 0;

  wordMatches.forEach((match, wordIndex) => {
    const text = match[0];
    const startIndex = match.index || 0;
    if (startIndex > lastIndex) {
      output += songMotifsEscapeHtml(source.slice(lastIndex, startIndex));
    }

    if (highlightedWordIndexes.has(wordIndex)) {
      output += '<span class="song-karaoke-lyric-ref" style="--lyric-ref-color: ' + color + ';">' + songMotifsEscapeHtml(text) + '</span>';
    } else {
      output += songMotifsEscapeHtml(text);
    }

    lastIndex = startIndex + text.length;
  });

  if (lastIndex < source.length) {
    output += songMotifsEscapeHtml(source.slice(lastIndex));
  }

  return output;
}

function songMotifsStripInsertedLyricGaps(value) {
  return String(value || '')
    .replace(/<[^<>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function songMotifsNormalizeLyricLine(value) {
  return songMotifsStripInsertedLyricGaps(String(value || ''))
    .replace(/\r\n/g, '\n')
    .replace(/\|/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function songMotifsRenderLyricText(value) {
  return songMotifsEscapeHtml(songMotifsStripInsertedLyricGaps(String(value || '')))
    .replace(/\r\n/g, '\n')
    .replace(/\|/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('<br>');
}

function songMotifsSplitPipeValues(value) {
  return String(value || '')
    .split(/\s*\|\s*/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function songMotifsResolveArtistByToken(value) {
  const token = String(value || '').trim();
  if (!token || typeof window.getArtistPreviewEntry !== 'function') {
    return null;
  }

  return window.getArtistPreviewEntry(token) || null;
}

function songMotifsRefreshPrimarySingerContext() {
  const state = getSongMotifsState();
  const row = typeof window.getActiveSongPageRow === 'function'
    ? window.getActiveSongPageRow()
    : null;

  const vocalists = songMotifsSplitPipeValues((row || {}).vocalists || '');
  const primarySingerToken = String(vocalists[0] || '').trim();
  state.karaokePrimarySingerToken = primarySingerToken;
  state.karaokePrimarySingerArtist = songMotifsResolveArtistByToken(primarySingerToken);
}

function songMotifsResolveSingersForEntry(entry) {
  const state = getSongMotifsState();
  if (entry && entry.explicitNone) {
    return [];
  }
  const entrySingerTags = Array.isArray((entry || {}).singerTags) ? (entry || {}).singerTags : [];
  const singerTags = entrySingerTags.length > 0
    ? entrySingerTags
    : (String((entry || {}).singerTag || '').trim() ? [String((entry || {}).singerTag || '').trim()] : []);

  const resolved = singerTags
    .map((tag) => songMotifsResolveArtistByToken(tag))
    .filter(Boolean);

  if (resolved.length > 0) {
    return resolved;
  }

  if (state.karaokePrimarySingerArtist) {
    return [state.karaokePrimarySingerArtist];
  }

  if (state.karaokePrimarySingerToken) {
    const fallbackSinger = songMotifsResolveArtistByToken(state.karaokePrimarySingerToken);
    return fallbackSinger ? [fallbackSinger] : [];
  }

  return [];
}

function songMotifsResolveSingerForEntry(entry) {
  const singers = songMotifsResolveSingersForEntry(entry);
  return singers[0] || null;
}

function songMotifsBuildSingerGradientValue(singers) {
  const colors = (Array.isArray(singers) ? singers : [])
    .map((singer) => String((singer || {}).color || '').trim() || '#ef8a85')
    .filter(Boolean);

  if (colors.length === 0) {
    return '';
  }

  if (colors.length === 1) {
    return colors[0];
  }

  const stops = [];
  const singerCount = colors.length;
  const transitionCount = singerCount - 1;
  const solidWidth = 50 / singerCount;
  const transitionWidth = transitionCount > 0 ? (50 / transitionCount) : 0;
  let cursor = 0;

  colors.forEach((color, index) => {
    const solidStart = cursor;
    const solidEnd = solidStart + solidWidth;
    stops.push(color + ' ' + solidStart.toFixed(4) + '%');
    stops.push(color + ' ' + solidEnd.toFixed(4) + '%');
    cursor = solidEnd;

    if (index >= singerCount - 1) {
      return;
    }

    const nextColor = colors[index + 1];
    const transitionStart = cursor;
    const transitionEnd = transitionStart + transitionWidth;
    stops.push(color + ' ' + transitionStart.toFixed(4) + '%');
    stops.push(nextColor + ' ' + transitionEnd.toFixed(4) + '%');
    cursor = transitionEnd;
  });

  return 'linear-gradient(90deg, ' + stops.join(', ') + ')';
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

function songMotifsIsSongReferenceId(value) {
  const text = String(value || '').trim();
  if (!text) {
    return false;
  }

  // Song IDs are authored as all-caps tokens in the CSV.
  return /[A-Z]/.test(text) && text === text.toUpperCase();
}

function songMotifsGetSongById(songId) {
  const normalized = String(songId || '').trim();
  if (!normalized || !window.SongData) {
    return null;
  }

  if (window.SongData.Songs && window.SongData.Songs[normalized]) {
    return window.SongData.Songs[normalized];
  }

  if (Array.isArray(window.SongData.allSongs)) {
    return window.SongData.allSongs.find((song) => String(song.songId || '') === normalized) || null;
  }

  return null;
}

function songMotifsResolveReferenceTarget(referenceId) {
  const normalizedId = String(referenceId || '').trim();
  if (!normalizedId) {
    return {
      type: 'motif',
      motif: null,
      song: null,
      canonicalId: ''
    };
  }

  if (songMotifsIsSongReferenceId(normalizedId)) {
    const song = songMotifsGetSongById(normalizedId);
    return {
      type: 'song',
      motif: null,
      song,
      canonicalId: song && song.songId ? song.songId : normalizedId
    };
  }

  const motif = window.MotifData.getMotifById(normalizedId);
  return {
    type: 'motif',
    motif,
    song: null,
    canonicalId: motif ? motif.id : normalizedId
  };
}

function songMotifsResolveMotifHref(motif, motifId) {
  if (motif && motif.hasPage !== false) {
    return '../../motifs/' + ((motif && motif.pageSlug) ? motif.pageSlug : (motif ? motif.id : motifId));
  }

  if (motif && motif.referenceLink) {
    return songMotifsNormalizeSiteHref(motif.referenceLink);
  }

  return '';
}

function songMotifsResolveReferenceHref(entry) {
  if (!entry) {
    return '';
  }

  if (entry.referenceType === 'song') {
    return entry.song && entry.song.path ? songMotifsNormalizeSiteHref(entry.song.path) : '';
  }

  const baseHref = songMotifsResolveMotifHref(entry.motif, entry.motifId);
  if (!baseHref) {
    return '';
  }

  const variationKey = String(entry.variationId || '').trim();
  if (!variationKey) {
    return baseHref;
  }

  const separator = baseHref.includes('?') ? '&' : '?';
  return baseHref + separator + 'v=' + encodeURIComponent(variationKey);
}

function songMotifsGetKaraokeLyricHighlights(entry) {
  const state = getSongMotifsState();
  if (!entry || !Array.isArray(state.lyricalRefs) || state.lyricalRefs.length === 0) {
    return [];
  }

  const entryStart = Number(entry.time) || 0;
  const entryEnd = Number(entry.endTime) > entryStart ? Number(entry.endTime) : entryStart;
  const entryText = String(entry.text || '');
  const normalizedEntryText = songMotifsNormalizeLyricLine(entryText);

  return state.lyricalRefs.filter((ref) => {
    const refStart = songMotifTimeToSeconds(ref.startTime);
    const refEndRaw = songMotifTimeToSeconds(ref.endTime);
    const refEnd = refEndRaw >= refStart ? refEndRaw : refStart;
    const refLyricsLines = Array.isArray(ref.lyricsLines) && ref.lyricsLines.length > 0
      ? ref.lyricsLines
      : String(ref.lyrics || '').split(/\s*\|\s*/);
    const normalizedRefLyricsLines = refLyricsLines
      .map((line) => songMotifsNormalizeLyricLine(line))
      .filter(Boolean);
    if (normalizedRefLyricsLines.length === 0) {
      return false;
    }

    const overlapsLine = refStart <= (entryEnd + 0.02) && refEnd >= (entryStart - 0.02);
    const lyricPresent = normalizedRefLyricsLines.some((line) => songMotifsReferenceWordsMatch(normalizedEntryText, line));
    return overlapsLine && lyricPresent;
  });
}

function songMotifsBuildKaraokeLineHtml(entry) {
  if (!entry || !entry.text) {
    return ' ';
  }

  const normalizedEntryText = songMotifsNormalizeLyricLine(entry.text);

  const highlights = songMotifsGetKaraokeLyricHighlights(entry)
    .filter((ref, index, list) => {
      const refLyricsKey = Array.isArray(ref.lyricsLines) && ref.lyricsLines.length > 0
        ? ref.lyricsLines.join('|')
        : String(ref.lyrics || '');
      const key = String(ref.motifId || '').toLowerCase() + '|' + songMotifsNormalizeLyricLine(refLyricsKey);
      return list.findIndex((candidate) => {
        const candidateLyricsKey = Array.isArray(candidate.lyricsLines) && candidate.lyricsLines.length > 0
          ? candidate.lyricsLines.join('|')
          : String(candidate.lyrics || '');
        return String(candidate.motifId || '').toLowerCase() + '|' + songMotifsNormalizeLyricLine(candidateLyricsKey) === key;
      }) === index;
    })
    .sort((a, b) => {
      const aLyrics = Array.isArray(a.lyricsLines) && a.lyricsLines.length > 0 ? a.lyricsLines.join(' ') : String(a.lyrics || '');
      const bLyrics = Array.isArray(b.lyricsLines) && b.lyricsLines.length > 0 ? b.lyricsLines.join(' ') : String(b.lyrics || '');
      return bLyrics.length - aLyrics.length;
    });

  let rendered = songMotifsEscapeHtml(entry.text);

  if (highlights.length > 0) {
    highlights.forEach((ref) => {
      const target = songMotifsResolveReferenceTarget(ref.motifId);
      const color = target.type === 'song'
        ? (target.song && target.song.color ? target.song.color : '#ef8a85')
        : (target.motif && target.motif.color ? target.motif.color : '#ef8a85');
      const refLyricsLines = Array.isArray(ref.lyricsLines) && ref.lyricsLines.length > 0
        ? ref.lyricsLines
        : String(ref.lyrics || '').split(/\s*\|\s*/);
      const matchText = refLyricsLines.find((line) => normalizedEntryText.includes(songMotifsNormalizeLyricLine(line)))
        || refLyricsLines[0]
        || ref.lyrics
        || '';
      rendered = songMotifsHighlightTextWithInsertedGaps(entry.text, matchText, color);
    });
  }

  const singers = songMotifsResolveSingersForEntry(entry);
  const singerSegments = Array.isArray((entry || {}).singerSegments) ? entry.singerSegments : [];

  if (singerSegments.length > 0) {
    const plainText = String((entry || {}).text || '').replace(/\s+/g, ' ').trim();
    const escapedPlainText = songMotifsEscapeHtml(plainText);
    let textCursor = 0;
    const segmentStops = [];
    const segmentHitboxes = [];
    const uniqueSingerMap = new Map();
    let defaultColor = '#ef8a85';

    singerSegments.forEach((segment) => {
      const segmentText = String((segment || {}).text || '').replace(/\s+/g, ' ').trim();
      if (!segmentText) {
        return;
      }

      const segmentSingers = songMotifsResolveSingersForEntry({
        singerTag: segment.singerTag,
        singerTags: Array.isArray(segment.singerTags) ? segment.singerTags : [],
        explicitNone: !!(segment && segment.explicitNone)
      });
      const primarySinger = segmentSingers[0] || null;
      const segmentColor = primarySinger
        ? (String(primarySinger.color || '').trim() || '#ef8a85')
        : 'transparent';
      const isUnattributed = !!(segment && segment.explicitNone) || !primarySinger;

      if (primarySinger && defaultColor === '#ef8a85') {
        defaultColor = segmentColor;
      }

      if (primarySinger) {
        const singerId = String(primarySinger.id || '').trim();
        if (singerId && !uniqueSingerMap.has(singerId)) {
          uniqueSingerMap.set(singerId, primarySinger);
        }
      }

      const searchIndex = plainText.toLowerCase().indexOf(segmentText.toLowerCase(), textCursor);
      const startIndex = searchIndex >= 0 ? searchIndex : textCursor;
      const endIndex = Math.min(plainText.length, startIndex + segmentText.length);
      const startPercent = plainText.length > 0 ? (startIndex / plainText.length) * 100 : 0;
      const endPercent = plainText.length > 0 ? (endIndex / plainText.length) * 100 : 100;

      if (endPercent > startPercent + 0.01) {
        segmentStops.push({
          start: startPercent,
          end: endPercent,
          color: segmentColor,
          singer: primarySinger,
          unattributed: isUnattributed
        });
      }

      textCursor = Math.max(textCursor, endIndex);
    });

    if (!segmentStops.length) {
      return '<span class="song-karaoke-line-fit-target">' + rendered + '</span>';
    }

    segmentStops.sort((left, right) => left.start - right.start);

    // Build a full stop list with explicit transparent gaps so singer boundaries at spaces
    // appear as visual breaks instead of color interpolation.
    const fullSegmentStops = [];
    let coverageCursor = 0;
    segmentStops.forEach((stop) => {
      const boundedStart = Math.max(0, Math.min(100, stop.start));
      const boundedEnd = Math.max(boundedStart, Math.min(100, stop.end));

      if (boundedStart > coverageCursor + 0.01) {
        fullSegmentStops.push({
          start: coverageCursor,
          end: boundedStart,
          color: 'transparent',
          singer: null,
          unattributed: true
        });
      }

      if (boundedEnd > boundedStart + 0.01) {
        fullSegmentStops.push({
          start: boundedStart,
          end: boundedEnd,
          color: stop.color,
          singer: stop.singer,
          unattributed: stop.unattributed
        });
      }

      coverageCursor = Math.max(coverageCursor, boundedEnd);
    });

    if (coverageCursor < 99.99) {
      fullSegmentStops.push({
        start: coverageCursor,
        end: 100,
        color: 'transparent',
        singer: null,
        unattributed: true
      });
    }

    const gradientStops = [];
    fullSegmentStops.forEach((stop) => {
      const safeStart = Math.max(0, Math.min(100, stop.start));
      const safeEnd = Math.max(safeStart, Math.min(100, stop.end));
      const color = stop.unattributed ? 'transparent' : stop.color;
      gradientStops.push(color + ' ' + safeStart.toFixed(4) + '%');
      gradientStops.push(color + ' ' + safeEnd.toFixed(4) + '%');

      if (!stop.singer || stop.unattributed) {
        return;
      }

      const singer = stop.singer;
      const singerColor = String((singer || {}).color || '#ef8a85').trim() || '#ef8a85';
      const singerId = String((singer || {}).id || '').trim();
      const singerName = String((singer || {}).name || singerId || 'Singer').trim() || 'Singer';
      const singerHref = String((singer || {}).href || '').trim()
        || (singer && singer.pageSlug
          ? (typeof window.toSiteHref === 'function' ? window.toSiteHref('/artists/' + singer.pageSlug) : ('/artists/' + singer.pageSlug))
          : '');
      const previewAttr = singerId ? ' data-artist-preview-id="' + songMotifsEscapeHtml(singerId) + '"' : '';
      const ariaLabel = 'View singer: ' + singerName;
      const widthPercent = Math.max(0, safeEnd - safeStart);
      segmentHitboxes.push(
        '<a class="song-karaoke-singer-link song-karaoke-singer-hitbox" href="' + songMotifsEscapeHtml(singerHref || '#') + '" aria-label="' + songMotifsEscapeHtml(ariaLabel) + '" style="--karaoke-singer-color: ' + songMotifsEscapeHtml(singerColor) + '; flex-basis: ' + widthPercent.toFixed(4) + '%;"' + previewAttr + '></a>'
      );
    });

    const singerCount = uniqueSingerMap.size || 1;
    return '<span class="song-karaoke-singer-line song-karaoke-line-fit-target" style="--singer-gradient: linear-gradient(90deg, ' + gradientStops.join(', ') + '); --singer-count: ' + singerCount + '; --karaoke-singer-color: ' + songMotifsEscapeHtml(defaultColor) + ';">' +
      '<span class="song-karaoke-singer-text">' + rendered + '</span>' +
      '<span class="song-karaoke-singer-underline" aria-hidden="true"></span>' +
      '<span class="song-karaoke-singer-hitboxes">' + segmentHitboxes.join('') + '</span>' +
      '</span>';
  }

  if (!singers.length) {
    return '<span class="song-karaoke-line-fit-target">' + rendered + '</span>';
  }

  const singerGradient = songMotifsBuildSingerGradientValue(singers);
  const singerCount = singers.length;
  const hitboxesHtml = singers.map((singer) => {
    const singerColor = String((singer || {}).color || '#ef8a85').trim() || '#ef8a85';
    const singerId = String((singer || {}).id || '').trim();
    const singerName = String((singer || {}).name || singerId || 'Singer').trim() || 'Singer';
    const singerHref = String((singer || {}).href || '').trim()
      || (singer && singer.pageSlug
        ? (typeof window.toSiteHref === 'function' ? window.toSiteHref('/artists/' + singer.pageSlug) : ('/artists/' + singer.pageSlug))
        : '');
    const previewAttr = singerId ? ' data-artist-preview-id="' + songMotifsEscapeHtml(singerId) + '"' : '';
    const ariaLabel = 'View singer: ' + singerName;
    return '<a class="song-karaoke-singer-link song-karaoke-singer-hitbox" href="' + songMotifsEscapeHtml(singerHref || '#') + '" aria-label="' + songMotifsEscapeHtml(ariaLabel) + '" style="--karaoke-singer-color: ' + songMotifsEscapeHtml(singerColor) + ';"' + previewAttr + '></a>';
  }).join('');

  return '<span class="song-karaoke-singer-line song-karaoke-line-fit-target" style="--singer-gradient: ' + songMotifsEscapeHtml(singerGradient) + '; --singer-count: ' + singerCount + ';">' +
    '<span class="song-karaoke-singer-text">' + rendered + '</span>' +
    '<span class="song-karaoke-singer-underline" aria-hidden="true"></span>' +
    '<span class="song-karaoke-singer-hitboxes">' + hitboxesHtml + '</span>' +
    '</span>';
}

function songMotifsFitBackingLaneText(lane) {
  if (!lane || !lane.isBacking || !lane.layerHost) {
    return;
  }

  const lineNodes = Array.from(lane.layerHost.querySelectorAll('.song-karaoke-line'));
  lineNodes.forEach((lineNode) => {
    const fitTarget = lineNode.querySelector('.song-karaoke-line-fit-target');
    if (!fitTarget) {
      return;
    }

    fitTarget.style.setProperty('--karaoke-fit-scale', '1');
    const availableWidth = Math.max(0, lineNode.clientWidth - 16);
    const contentWidth = Math.ceil(fitTarget.scrollWidth || 0);

    if (availableWidth <= 0 || contentWidth <= 0) {
      return;
    }

    const rawScale = availableWidth / contentWidth;
    const scale = Math.max(0.22, Math.min(1, rawScale * 0.92));
    fitTarget.style.setProperty('--karaoke-fit-scale', String(scale));
  });
}

function songMotifsLaneHasRenderableLyrics(payload) {
  if (!payload) {
    return false;
  }

  return songMotifsEntryHasRenderableText(payload.previousEntry)
    || songMotifsEntryHasRenderableText(payload.currentEntry)
    || songMotifsEntryHasRenderableText(payload.nextEntry);
}

function songMotifsPopulateKaraokeLine(node, entry) {
  node.innerHTML = songMotifsBuildKaraokeLineHtml(entry);
  if (typeof window.initializeArtistCreditPreviews === 'function') {
    window.initializeArtistCreditPreviews(node);
  }
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

function songMotifsResetKaraokeLane(lane) {
  if (!lane) {
    return;
  }

  if (lane.transitionTimer) {
    clearTimeout(lane.transitionTimer);
    lane.transitionTimer = null;
  }

  lane.currentIndex = -2;
  lane.activeLayer = null;
  if (lane.layerHost) {
    lane.layerHost.innerHTML = '';
  }
}

function songMotifsUpdateKaraokeLane(lane, payload, currentIndex) {
  if (!lane || !lane.layerHost) {
    return;
  }

  if (currentIndex === lane.currentIndex) {
    return;
  }

  const previousIndex = lane.currentIndex;
  lane.currentIndex = currentIndex;

  if (lane.transitionTimer) {
    clearTimeout(lane.transitionTimer);
    lane.transitionTimer = null;
  }

  if (lane.activeLayer) {
    lane.activeLayer.classList.remove('song-karaoke-layer-entering');
    lane.activeLayer.classList.remove('song-karaoke-layer-entering-play');
    lane.activeLayer.classList.remove('song-karaoke-layer-leaving');
    lane.activeLayer.classList.add('song-karaoke-layer-active');
  }

  Array.from(lane.layerHost.children).forEach((child) => {
    if (child !== lane.activeLayer) {
      child.remove();
    }
  });

  if (!lane.activeLayer) {
    const initialLayer = songMotifsBuildKaraokeLayer(payload, 'song-karaoke-layer-active');
    lane.layerHost.innerHTML = '';
    lane.layerHost.appendChild(initialLayer);
    lane.activeLayer = initialLayer;
    if (lane.isBacking) {
      songMotifsFitBackingLaneText(lane);
    }
    return;
  }

  const shouldAnimate = Math.abs(currentIndex - previousIndex) === 1;
  if (!shouldAnimate) {
    const replacementLayer = songMotifsBuildKaraokeLayer(payload, 'song-karaoke-layer-active');
    lane.layerHost.innerHTML = '';
    lane.layerHost.appendChild(replacementLayer);
    lane.activeLayer = replacementLayer;
    if (lane.isBacking) {
      songMotifsFitBackingLaneText(lane);
    }
    return;
  }

  const leavingLayer = lane.activeLayer;
  leavingLayer.classList.remove('song-karaoke-layer-active');
  leavingLayer.classList.add('song-karaoke-layer-leaving');

  const enteringLayer = songMotifsBuildKaraokeLayer(payload, 'song-karaoke-layer-entering');
  lane.layerHost.appendChild(enteringLayer);
  lane.activeLayer = enteringLayer;
  if (lane.isBacking) {
    songMotifsFitBackingLaneText(lane);
  }
  void enteringLayer.offsetWidth;
  enteringLayer.classList.add('song-karaoke-layer-entering-play');

  lane.transitionTimer = setTimeout(() => {
    if (leavingLayer.parentNode) {
      leavingLayer.remove();
    }
    enteringLayer.classList.remove('song-karaoke-layer-entering');
    enteringLayer.classList.remove('song-karaoke-layer-entering-play');
    enteringLayer.classList.add('song-karaoke-layer-active');
    if (lane.isBacking) {
      songMotifsFitBackingLaneText(lane);
    }
    lane.transitionTimer = null;
  }, 500);
}

const SONG_MOTIFS_KARAOKE_SYNC_LEAD_SECONDS = 0.9;
const SONG_MOTIFS_KARAOKE_PRE_GROW_LEAD_SECONDS = 0.5;
const SONG_MOTIFS_KARAOKE_WRAP_RESIZE_MS = 500;

function songMotifsClearKaraokeWrapResizeAnimation(state) {
  if (!state || !state.karaokeWrap) {
    return;
  }

  if (state.karaokeWrapResizeTimer) {
    clearTimeout(state.karaokeWrapResizeTimer);
    state.karaokeWrapResizeTimer = null;
  }

  state.karaokeWrap.classList.remove('song-karaoke-measure-layout');
  state.karaokeWrap.style.height = '';
  state.karaokeWrap.style.overflow = '';
  state.karaokeWrap.style.transition = '';
  state.karaokeWrap.style.willChange = '';
}

function songMotifsApplyKaraokeLayoutState(state, options) {
  if (!state || !state.karaokeWrap) {
    return;
  }

  const config = options || {};
  const showMainViewport = !!config.showMainViewport;
  const shouldPreGrowMain = !!config.shouldPreGrowMain;
  const hasBackingLyricsOnScreen = !!config.hasBackingLyricsOnScreen;
  const showBackingOnlyLayout = !!config.showBackingOnlyLayout;
  const backingTrackCount = Math.max(0, Number(config.backingTrackCount) || 0);
  const nextLayoutMode = String(config.nextLayoutMode || 'hidden');
  const previousLayoutMode = String(state.karaokeLayoutMode || 'hidden');
  const previousBackingTrackCount = Math.max(0, Number(state.karaokeConfiguredBackingTrackCount) || 0);
  const previousBackingVisible = !!state.karaokeBackingVisible;
  const wrap = state.karaokeWrap;

  const applyLayoutState = () => {
    wrap.style.display = '';
    wrap.classList.toggle('song-karaoke-backing-count-1', backingTrackCount === 1);
    wrap.classList.toggle('song-karaoke-backing-count-2', backingTrackCount >= 2);
    wrap.classList.toggle('song-karaoke-layout-with-main', showMainViewport);
    wrap.classList.toggle('song-karaoke-layout-backing-only', showBackingOnlyLayout);
    wrap.classList.toggle('song-karaoke-main-preopen', shouldPreGrowMain);

    if (state.karaokeViewport) {
      state.karaokeViewport.classList.toggle('is-open', showMainViewport);
      state.karaokeViewport.classList.toggle('is-preopen', shouldPreGrowMain);
    }

    if (state.karaokeBackingWrap) {
      state.karaokeBackingWrap.style.display = hasBackingLyricsOnScreen ? 'grid' : 'none';
    }
  };

  const shouldAnimateWrapResize = previousLayoutMode !== 'hidden'
    && nextLayoutMode !== 'hidden'
    && (
      previousLayoutMode !== nextLayoutMode
      || previousBackingTrackCount !== backingTrackCount
      || previousBackingVisible !== hasBackingLyricsOnScreen
    );

  if (!shouldAnimateWrapResize) {
    applyLayoutState();
    state.karaokeLayoutMode = nextLayoutMode;
    state.karaokeConfiguredBackingTrackCount = backingTrackCount;
    state.karaokeBackingVisible = hasBackingLyricsOnScreen;
    return;
  }

  const startHeight = wrap.getBoundingClientRect().height;

  wrap.classList.add('song-karaoke-measure-layout');
  applyLayoutState();
  void wrap.offsetHeight;
  const targetHeight = wrap.getBoundingClientRect().height;
  wrap.classList.remove('song-karaoke-measure-layout');

  songMotifsClearKaraokeWrapResizeAnimation(state);
  state.karaokeLayoutMode = nextLayoutMode;
  state.karaokeConfiguredBackingTrackCount = backingTrackCount;
  state.karaokeBackingVisible = hasBackingLyricsOnScreen;

  if (startHeight <= 0 || targetHeight <= 0 || Math.abs(targetHeight - startHeight) < 0.75) {
    return;
  }

  wrap.style.height = startHeight + 'px';
  wrap.style.overflow = 'hidden';
  wrap.style.willChange = 'height';
  void wrap.offsetHeight;
  wrap.style.transition = 'height ' + SONG_MOTIFS_KARAOKE_WRAP_RESIZE_MS + 'ms ease';
  wrap.style.height = targetHeight + 'px';

  state.karaokeWrapResizeTimer = setTimeout(() => {
    songMotifsClearKaraokeWrapResizeAnimation(state);
  }, SONG_MOTIFS_KARAOKE_WRAP_RESIZE_MS + 40);
}

function songMotifsFindUpcomingMainReentryCue(entries, currentIndex) {
  const list = Array.isArray(entries) ? entries : [];
  if (!list.length) {
    return null;
  }

  let nextTextIndex = -1;
  for (let i = Math.max(-1, currentIndex) + 1; i < list.length; i += 1) {
    if (songMotifsEntryHasRenderableText(list[i])) {
      nextTextIndex = i;
      break;
    }
  }

  if (nextTextIndex < 0) {
    return null;
  }

  let cueTime = null;
  for (let i = nextTextIndex - 1; i >= 0; i -= 1) {
    if (!songMotifsEntryHasRenderableText(list[i])) {
      cueTime = Number(list[i].time);
      break;
    }
    if (songMotifsEntryHasRenderableText(list[i])) {
      break;
    }
  }

  if (!Number.isFinite(cueTime)) {
    return null;
  }

  const nextTextTime = Number(list[nextTextIndex].time);
  if (!Number.isFinite(nextTextTime)) {
    return null;
  }

  return {
    cueTime,
    nextTextTime
  };
}

function songMotifsSyncHiddenMainLane(state, currentIndex) {
  if (!state || !state.karaokeLayerHost) {
    return;
  }

  if (state.karaokeTransitionTimer) {
    clearTimeout(state.karaokeTransitionTimer);
    state.karaokeTransitionTimer = null;
  }

  if (currentIndex === state.karaokeCurrentIndex && state.karaokeActiveLayer) {
    return;
  }

  state.karaokeCurrentIndex = currentIndex;
  const payload = songMotifsBuildKaraokePayload(currentIndex);
  const hiddenLayer = songMotifsBuildKaraokeLayer(payload, 'song-karaoke-layer-active');
  state.karaokeLayerHost.innerHTML = '';
  state.karaokeLayerHost.appendChild(hiddenLayer);
  state.karaokeActiveLayer = hiddenLayer;
}

function songMotifsAnimateMainReentryBottomLine(state) {
  if (!state || !state.karaokeActiveLayer) {
    return;
  }

  if (state.karaokeMainReentryAnimationTimer) {
    clearTimeout(state.karaokeMainReentryAnimationTimer);
    state.karaokeMainReentryAnimationTimer = null;
  }

  const layer = state.karaokeActiveLayer;
  layer.classList.remove('song-karaoke-layer-main-reentry');
  void layer.offsetWidth;
  layer.classList.add('song-karaoke-layer-main-reentry');

  state.karaokeMainReentryAnimationTimer = setTimeout(() => {
    layer.classList.remove('song-karaoke-layer-main-reentry');
    state.karaokeMainReentryAnimationTimer = null;
  }, 500);
}

function songMotifsUpdateKaraoke(currentTime) {
  const state = getSongMotifsState();
  if (!state.karaokeWrap || !state.karaokeLayerHost) {
    return;
  }

  const wasMainViewportVisible = state.karaokeLayoutMode === 'with-main';
  const syncedTime = currentTime + SONG_MOTIFS_KARAOKE_SYNC_LEAD_SECONDS;
  const hasMainEntries = Array.isArray(state.karaokeEntries) && state.karaokeEntries.length > 0;
  const backingTracks = Array.isArray(state.karaokeBackingTracks) ? state.karaokeBackingTracks : [];
  const hasBackingEntries = backingTracks.some((track) => Array.isArray(track.entries) && track.entries.length > 0);

  if (!hasMainEntries && !hasBackingEntries) {
    songMotifsClearKaraokeWrapResizeAnimation(state);
    state.karaokeLayoutMode = 'hidden';
    state.karaokeBackingVisible = false;
    state.karaokeWrap.style.display = 'none';
    return;
  }

  const currentIndex = hasMainEntries
    ? songMotifsFindCurrentEntryIndex(state.karaokeEntries, syncedTime)
    : -1;
  const currentMainEntry = currentIndex >= 0 ? state.karaokeEntries[currentIndex] : null;
  const hasMainLine = songMotifsEntryHasRenderableText(currentMainEntry);
  let hasActiveBackingLine = false;
  let hasBackingLyricsOnScreen = false;
  const configuredBackingTrackCount = backingTracks.reduce((count, track) => {
    return count + ((track && Array.isArray(track.entries) && track.entries.length > 0) ? 1 : 0);
  }, 0);

  backingTracks.forEach((track) => {
    if (!track || !Array.isArray(track.entries)) {
      return;
    }

    const trackHasEntries = track.entries.length > 0;
    if (track.trackNode) {
      track.trackNode.style.display = trackHasEntries ? '' : 'none';
    }

    if (!trackHasEntries) {
      songMotifsResetKaraokeLane(track);
      return;
    }

    const trackIndex = songMotifsFindCurrentEntryIndex(track.entries, syncedTime);
    const trackEntry = trackIndex >= 0 ? track.entries[trackIndex] : null;
    const hasTrackLine = songMotifsEntryHasRenderableText(trackEntry);
    if (hasTrackLine) {
      hasActiveBackingLine = true;
    }

    const payload = songMotifsBuildKaraokePayloadForEntries(track.entries, trackIndex);
    if (songMotifsLaneHasRenderableLyrics(payload)) {
      hasBackingLyricsOnScreen = true;
    }
    songMotifsUpdateKaraokeLane(track, payload, trackIndex);
    songMotifsFitBackingLaneText(track);

    if (track.trackNode) {
      track.trackNode.classList.toggle('is-empty', !hasTrackLine);
    }
  });

  if (!hasMainLine && !hasActiveBackingLine && !hasMainEntries) {
    songMotifsClearKaraokeWrapResizeAnimation(state);
    state.karaokeLayoutMode = 'hidden';
    state.karaokeBackingVisible = false;
    state.karaokeWrap.style.display = 'none';
    return;
  }

  const computeMainViewportVisibility = (sampleSyncedTime) => {
    const sampleMainIndex = hasMainEntries
      ? songMotifsFindCurrentEntryIndex(state.karaokeEntries, sampleSyncedTime)
      : -1;
    const sampleMainEntry = sampleMainIndex >= 0 ? state.karaokeEntries[sampleMainIndex] : null;
    const sampleHasMainLine = songMotifsEntryHasRenderableText(sampleMainEntry);
    let sampleHasBackingLyricsOnScreen = false;

    backingTracks.forEach((track) => {
      if (!track || !Array.isArray(track.entries)) {
        return;
      }
      const sampleTrackIndex = songMotifsFindCurrentEntryIndex(track.entries, sampleSyncedTime);
      const samplePayload = songMotifsBuildKaraokePayloadForEntries(track.entries, sampleTrackIndex);
      if (songMotifsLaneHasRenderableLyrics(samplePayload)) {
        sampleHasBackingLyricsOnScreen = true;
      }
    });

    return hasMainEntries && (sampleHasMainLine || !sampleHasBackingLyricsOnScreen);
  };

  const reentryCue = hasMainEntries
    ? songMotifsFindUpcomingMainReentryCue(state.karaokeEntries, currentIndex)
    : null;
  const showMainDuringCueWindow = !hasMainLine
    && hasBackingLyricsOnScreen
    && reentryCue
    && syncedTime >= reentryCue.cueTime
    && syncedTime < reentryCue.nextTextTime;

  const showMainViewport = hasMainEntries
    && (hasMainLine || !hasBackingLyricsOnScreen || showMainDuringCueWindow);
  let shouldPreGrowMain = !showMainViewport
    && computeMainViewportVisibility(syncedTime + SONG_MOTIFS_KARAOKE_PRE_GROW_LEAD_SECONDS);
  const showBackingOnlyLayout = !showMainViewport && hasBackingLyricsOnScreen;

  if (!showMainViewport && hasMainEntries && reentryCue && syncedTime >= reentryCue.cueTime && syncedTime < reentryCue.nextTextTime) {
    shouldPreGrowMain = true;
  }
  const nextLayoutMode = showMainViewport
    ? 'with-main'
    : (showBackingOnlyLayout ? 'backing-only' : 'idle');

  songMotifsApplyKaraokeLayoutState(state, {
    showMainViewport,
    shouldPreGrowMain,
    hasBackingLyricsOnScreen,
    showBackingOnlyLayout,
    backingTrackCount: configuredBackingTrackCount,
    nextLayoutMode
  });

  if (showMainViewport && !wasMainViewportVisible && showMainDuringCueWindow) {
    songMotifsAnimateMainReentryBottomLine(state);
  }

  if (!showMainViewport) {
    songMotifsSyncHiddenMainLane(state, currentIndex);
    return;
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

function songMotifsHasMeasuredPlaybackDuration() {
  const state = getSongMotifsState();
  const measured = Number(state.youtubeDuration) || 0;
  if (!Number.isFinite(measured) || measured <= 0) {
    return false;
  }

  if (!Number.isInteger(measured)) {
    return true;
  }

  const player = state.player;
  const currentTime = player && typeof player.getCurrentTime === 'function' ? Number(player.getCurrentTime()) || 0 : 0;
  const playerState = player && typeof player.getPlayerState === 'function' ? player.getPlayerState() : -1;
  return currentTime > 0 || playerState === 1;
}

function songMotifsResolvePlaybackDuration() {
  const state = getSongMotifsState();

  if (state.player && typeof state.player.getDuration === 'function') {
    const liveDuration = Number(state.player.getDuration()) || 0;
    if (Number.isFinite(liveDuration) && liveDuration > 0) {
      const hasPreciseStoredDuration = Number.isFinite(Number(state.youtubeDuration))
        && Number(state.youtubeDuration) > 0
        && !Number.isInteger(Number(state.youtubeDuration));

      if (hasPreciseStoredDuration) {
        state.duration = Number(state.youtubeDuration);
        return Number(state.youtubeDuration);
      }

      state.youtubeDuration = liveDuration;
      return liveDuration;
    }
  }

  if (Number.isFinite(Number(state.youtubeDuration)) && Number(state.youtubeDuration) > 0) {
    return Number(state.youtubeDuration);
  }

  if (Number.isFinite(Number(state.karaokeDuration)) && Number(state.karaokeDuration) > 0) {
    return Number(state.karaokeDuration);
  }

  if (Number.isFinite(Number(state.declaredDuration)) && Number(state.declaredDuration) > 0) {
    return Number(state.declaredDuration);
  }

  if (Number.isFinite(Number(state.duration)) && Number(state.duration) > 0) {
    return Number(state.duration);
  }

  return 0;
}

function songMotifsApplyKaraokeEntries(entries) {
  const state = getSongMotifsState();
  songMotifsRefreshPrimarySingerContext();

  if (!Array.isArray(entries)) {
    state.karaokeEntries = [];
    state.karaokeDuration = 0;
    if (!Number.isFinite(Number(state.youtubeDuration)) || Number(state.youtubeDuration) <= 0) {
      state.duration = songMotifsResolvePlaybackDuration();
    }
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
    const singerTags = Array.isArray(entry.singerTags)
      ? entry.singerTags.map((tag) => String(tag || '').trim().toLowerCase()).filter(Boolean)
      : [];
    return {
      time: entry.time,
      text: entry.text,
      singerTag: String(entry.singerTag || '').trim().toLowerCase(),
      singerTags,
      explicitNone: !!entry.explicitNone,
      endTime
    };
  });

  state.karaokeDuration = state.karaokeEntries.length > 0
    ? Math.max(...state.karaokeEntries.map((entry) => Number(entry.time) || 0))
    : 0;

  if (state.karaokeLayerHost) {
    state.karaokeLayerHost.innerHTML = '';
  }
  state.karaokeActiveLayer = null;

  state.karaokeCurrentIndex = -2;
  if (!Number.isFinite(Number(state.youtubeDuration)) || Number(state.youtubeDuration) <= 0) {
    state.duration = songMotifsResolvePlaybackDuration();
    if (state.durationLabel && songMotifsHasMeasuredPlaybackDuration()) {
      state.durationLabel.textContent = songMotifFormatTime(state.duration);
    } else if (state.durationLabel) {
      state.durationLabel.textContent = '';
    }
  }
  songMotifsUpdateKaraoke(0);
}

function songMotifsNormalizeKaraokeEntries(entries) {
  const source = Array.isArray(entries) ? entries : [];
  const sortedEntries = source
    .filter((entry) => entry && typeof entry.time === 'number' && typeof entry.text === 'string')
    .sort((a, b) => a.time - b.time);

  return sortedEntries.map((entry, index) => {
    const next = sortedEntries[index + 1];
    const nextTime = next && typeof next.time === 'number' ? next.time : (entry.time + 8);
    const endTime = nextTime > entry.time ? nextTime : (entry.time + 0.01);
    const singerTags = Array.isArray(entry.singerTags)
      ? entry.singerTags.map((tag) => String(tag || '').trim().toLowerCase()).filter(Boolean)
      : [];
    const singerSegments = Array.isArray(entry.singerSegments)
      ? entry.singerSegments
        .map((segment) => {
          if (!segment) {
            return null;
          }

          const segmentText = String(segment.text || '').replace(/\s+/g, ' ').trim();
          if (!segmentText) {
            return null;
          }

          const segmentSingerTags = Array.isArray(segment.singerTags)
            ? segment.singerTags.map((tag) => String(tag || '').trim().toLowerCase()).filter(Boolean)
            : [];

          return {
            text: segmentText,
            singerTag: String(segment.singerTag || '').trim().toLowerCase(),
            singerTags: segmentSingerTags,
            explicitNone: !!segment.explicitNone
          };
        })
        .filter(Boolean)
      : [];

    return {
      time: entry.time,
      text: entry.text,
      singerTag: String(entry.singerTag || '').trim().toLowerCase(),
      singerTags,
      explicitNone: !!entry.explicitNone,
      singerSegments,
      endTime
    };
  });
}

function songMotifsApplyKaraokeBundle(bundle) {
  const state = getSongMotifsState();
  const payload = bundle || {};
  const mainEntries = songMotifsNormalizeKaraokeEntries(Array.isArray(payload.mainEntries) ? payload.mainEntries : []);
  const backingTracksPayload = Array.isArray(payload.backingTracks) ? payload.backingTracks : [];

  songMotifsRefreshPrimarySingerContext();
  state.karaokeEntries = mainEntries;

  const existingTracks = Array.isArray(state.karaokeBackingTracks) ? state.karaokeBackingTracks : [];
  state.karaokeBackingTracks = backingTracksPayload.map((track, index) => {
    const existing = existingTracks[index] || {};
    return {
      id: String((track || {}).id || ('backing' + String(index + 1))).trim(),
      entries: songMotifsNormalizeKaraokeEntries((track || {}).entries),
      trackNode: existing.trackNode || null,
      layerHost: existing.layerHost || null,
      activeLayer: null,
      transitionTimer: null,
      currentIndex: -2
    };
  });

  state.karaokeDuration = Math.max(
    state.karaokeEntries.length > 0
      ? Math.max(...state.karaokeEntries.map((entry) => Number(entry.time) || 0))
      : 0,
    state.karaokeBackingTracks.reduce((max, track) => {
      const entries = Array.isArray((track || {}).entries) ? track.entries : [];
      if (!entries.length) {
        return max;
      }
      return Math.max(max, Math.max(...entries.map((entry) => Number(entry.time) || 0)));
    }, 0)
  );

  if (state.karaokeLayerHost) {
    state.karaokeLayerHost.innerHTML = '';
  }
  state.karaokeBackingTracks.forEach((track) => {
    songMotifsResetKaraokeLane(track);
  });
  state.karaokeActiveLayer = null;
  state.karaokeCurrentIndex = -2;

  if (!Number.isFinite(Number(state.youtubeDuration)) || Number(state.youtubeDuration) <= 0) {
    state.duration = songMotifsResolvePlaybackDuration();
    if (state.durationLabel && songMotifsHasMeasuredPlaybackDuration()) {
      state.durationLabel.textContent = songMotifFormatTime(state.duration);
    } else if (state.durationLabel) {
      state.durationLabel.textContent = '';
    }
  }

  songMotifsUpdateKaraoke(0);
}

function setSongMotifsVolume(value) {
  const state = getSongMotifsState();
  const nextVolume = Math.max(0, Math.min(100, Number(value) || 0));
  state.volume = nextVolume;
  persistPlayerVolume(nextVolume);

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

function songMotifsParseOffsetSeconds(text) {
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

function songMotifsParseLyricLineAndSingerTags(value) {
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

function songMotifsParseLrcTimedEntries(text) {
  const lines = String(text || '').split(/\r?\n/);
  const entries = [];
  const offsetSeconds = songMotifsParseOffsetSeconds(text);
  let currentSingerTags = [];
  const singerTagsByLyricKey = Object.create(null);

  function normalizeLyricKey(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
  }

  lines.forEach((line) => {
    const timestamps = line.match(/\[(\d{1,2}:\d{2}(?:\.\d{1,3})?)\]/g);
    if (!timestamps) {
      return;
    }

    const lyricParts = songMotifsParseLyricLineAndSingerTags(line.replace(/\[[^\]]+\]/g, ''));
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
      const cleanStamp = stamp.slice(1, -1);
      entries.push({
        time: songMotifsParseTimestamp(cleanStamp) + offsetSeconds,
        text: collapsedLineText,
        singerTag: entrySingerTags[0] || '',
        singerTags: entrySingerTags,
        explicitNone: entryExplicitNone,
        singerSegments
      });
    });
  });

  const seen = new Set();
  return entries
    .sort((a, b) => a.time - b.time)
    .filter((entry) => {
      const singerKey = Array.isArray(entry.singerTags) && entry.singerTags.length > 0
        ? entry.singerTags.join(',')
        : String(entry.singerTag || '');
      const segmentKey = Array.isArray(entry.singerSegments)
        ? entry.singerSegments.map((segment) => {
          const tags = Array.isArray(segment.singerTags) ? segment.singerTags.join(',') : String(segment.singerTag || '');
          return String(segment.text || '') + ':' + tags + ':' + (segment.explicitNone ? '1' : '0');
        }).join('|')
        : '';
      const key = entry.time.toFixed(3) + '|' + entry.text + '|' + singerKey + '|' + (entry.explicitNone ? '1' : '0') + '|' + segmentKey;
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

  function buildBackingSlug(baseSlug, backingSuffix) {
    const slug = String(baseSlug || '').trim().toLowerCase();
    if (!slug) {
      return '';
    }

    const hashIndex = slug.indexOf('#');
    const slugBase = hashIndex === -1 ? slug : slug.slice(0, hashIndex);
    const slugHash = hashIndex === -1 ? '' : slug.slice(hashIndex);
    return slugBase + backingSuffix + slugHash;
  }

  function buildBackingCandidates(backingSuffix) {
    const slugs = [];
    const seen = new Set();
    const baseSlug = songMotifsGetBaseSongSlug();
    const sources = candidateSlugs.concat([primarySlug, baseSlug]);

    sources.forEach((source) => {
      const candidate = buildBackingSlug(source, backingSuffix);
      if (!candidate || seen.has(candidate)) {
        return;
      }
      seen.add(candidate);
      slugs.push(candidate);
    });

    return slugs;
  }

  function loadTimedEntriesBySlugCandidates(slugCandidates) {
    const candidates = Array.isArray(slugCandidates) ? slugCandidates.filter(Boolean) : [];
    if (!candidates.length) {
      return Promise.resolve([]);
    }

    if (window.SongLyrics && typeof window.SongLyrics.loadCurrentSongLyrics === 'function') {
      const attempt = (index) => {
        if (index >= candidates.length) {
          return Promise.resolve([]);
        }

        return window.SongLyrics.loadCurrentSongLyrics(candidates[index])
          .then((data) => {
            if (data && Array.isArray(data.timedEntries) && data.timedEntries.length > 0) {
              return data.timedEntries;
            }
            return attempt(index + 1);
          })
          .catch(() => attempt(index + 1));
      };

      return attempt(0);
    }

    const fetchAttempt = (index) => {
      if (index >= candidates.length) {
        return Promise.resolve([]);
      }

      const path = '../../public/songs/lyrics/' + encodeURIComponent(candidates[index]) + '.lrc';
      return fetch(path, { cache: 'no-store' })
        .then((response) => {
          if (!response.ok) {
            throw new Error('No LRC file');
          }
          return response.text();
        })
        .then((text) => songMotifsParseLrcTimedEntries(text))
        .then((entries) => (Array.isArray(entries) && entries.length > 0 ? entries : fetchAttempt(index + 1)))
        .catch(() => fetchAttempt(index + 1));
    };

    return fetchAttempt(0);
  }

  if (window.SongLyrics && typeof window.SongLyrics.loadCurrentSongLyrics === 'function') {
    return Promise.all([
      window.SongLyrics.loadCurrentSongLyrics()
        .then((data) => data || (primarySlug ? window.SongLyrics.loadCurrentSongLyrics(primarySlug) : null))
        .catch(() => null),
      loadTimedEntriesBySlugCandidates(buildBackingCandidates('_backing1')),
      loadTimedEntriesBySlugCandidates(buildBackingCandidates('_backing2'))
    ]).then((results) => {
      const mainData = results[0];
      const mainEntries = mainData && Array.isArray(mainData.timedEntries) ? mainData.timedEntries : [];
      return {
        mainEntries,
        backingTracks: [
          { id: 'backing1', entries: Array.isArray(results[1]) ? results[1] : [] },
          { id: 'backing2', entries: Array.isArray(results[2]) ? results[2] : [] }
        ]
      };
    });
  }

  if (!primarySlug) {
    return Promise.resolve({ mainEntries: [], backingTracks: [] });
  }

  const mainPath = '../../public/songs/lyrics/' + encodeURIComponent(primarySlug) + '.lrc';
  return Promise.all([
    fetch(mainPath, { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) {
          throw new Error('No LRC file');
        }
        return response.text();
      })
      .then((text) => songMotifsParseLrcTimedEntries(text))
      .catch(() => []),
    loadTimedEntriesBySlugCandidates(buildBackingCandidates('_backing1')),
    loadTimedEntriesBySlugCandidates(buildBackingCandidates('_backing2'))
  ]).then((results) => {
    return {
      mainEntries: Array.isArray(results[0]) ? results[0] : [],
      backingTracks: [
        { id: 'backing1', entries: Array.isArray(results[1]) ? results[1] : [] },
        { id: 'backing2', entries: Array.isArray(results[2]) ? results[2] : [] }
      ]
    };
  });
}

function ensureSongMotifsSidebarControls() {
  const state = getSongMotifsState();
  const scope = typeof getActiveSongSidebarScope === 'function' ? getActiveSongSidebarScope() : document;
  const rightView = scope && scope.querySelector ? scope.querySelector('.song-rightview') : null;

  if (!rightView) {
    return;
  }

  const existing = rightView.querySelector('.song-motif-volume-wrap');
  if (existing) {
    existing.remove();
  }

  const wrap = buildSongMotifsVolumeControl();
  const navButtons = rightView.querySelector('.song-nav-buttons');
  const sidebar = rightView.querySelector('.song-info-sidebar');
  const insertionTarget = navButtons || sidebar;

  if (insertionTarget) {
    rightView.insertBefore(wrap, insertionTarget);
  } else {
    rightView.appendChild(wrap);
  }

  state.volumeInput = wrap.querySelector('#songMotifVolumeSlider');
  state.playButton = wrap.querySelector('.song-motif-play-button');
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

  const row = document.createElement('div');
  row.className = 'song-motif-control-row';
  wrap.appendChild(row);

  const playButton = document.createElement('button');
  playButton.type = 'button';
  playButton.className = 'song-motif-play-button';
  playButton.textContent = '▶';
  playButton.setAttribute('aria-label', 'Play or pause playback');
  playButton.addEventListener('click', () => {
    if (!state.player || typeof state.player.getPlayerState !== 'function') {
      return;
    }

    if (state.player.getPlayerState() === 1) {
      state.player.pauseVideo();
    } else {
      state.player.playVideo();
    }
  });
  row.appendChild(playButton);

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
  row.appendChild(input);

  state.volumeInput = input;
  state.playButton = playButton;
  return wrap;
}

function songMotifsCreateBackingTrack(index) {
  const track = document.createElement('div');
  track.className = 'song-karaoke-backing-track';
  track.setAttribute('data-karaoke-backing-track', String(index + 1));

  const viewport = document.createElement('div');
  viewport.className = 'song-karaoke-backing-viewport';
  track.appendChild(viewport);

  const layerHost = document.createElement('div');
  layerHost.className = 'song-karaoke-layer-host';
  viewport.appendChild(layerHost);

  return { track, layerHost };
}

function songMotifsFindSong() {
  if (typeof window.getActiveSongPageRow === 'function') {
    const activeRow = window.getActiveSongPageRow();
    if (activeRow) {
      const activePathId = String(getSongRowPathValue(activeRow) || '').trim();
      if (activePathId) {
        const activeNormalized = typeof normalizeSongRowPath === 'function'
          ? normalizeSongRowPath(activePathId)
          : activePathId;
        const activePointer = String(activeNormalized || '').split('#')[0].split('/').filter(Boolean).pop() || '';

        const exactMatch = window.SongData.allSongs.find((song) => {
          const songPath = String((song || {}).path || '').trim();
          if (!songPath) {
            return false;
          }

          const songNormalized = typeof normalizeSongRowPath === 'function'
            ? normalizeSongRowPath(songPath)
            : songPath;

          return songNormalized === activeNormalized;
        });

        const pageMatch = exactMatch || window.SongData.allSongs.find((song) => {
          const songPath = String((song || {}).path || '').trim();
          if (!songPath) {
            return false;
          }

          const songNormalized = typeof normalizeSongRowPath === 'function'
            ? normalizeSongRowPath(songPath)
            : songPath;
          const songPointer = String(songNormalized || '').split('#')[0].split('/').filter(Boolean).pop() || '';
          return !!activePointer && activePointer === songPointer;
        });

        if (pageMatch) {
          const activeYoutubeId = String(activeRow.embed_link || activeRow.youtube_id || activeRow.youtubeId || '').trim();
          if (Object.prototype.hasOwnProperty.call(activeRow, 'embed_link') || Object.prototype.hasOwnProperty.call(activeRow, 'youtube_id') || Object.prototype.hasOwnProperty.call(activeRow, 'youtubeId')) {
            return Object.assign({}, pageMatch, {
              youtubeId: activeYoutubeId
            });
          }

          return pageMatch;
        }
      }
    }
  }

  if (!window.SongData || !window.SongData.allSongs) {
    return null;
  }

  const toComparableSongPath = (value) => {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) {
      return '';
    }

    const normalized = raw
      .replace(/^https?:\/\/[^/]+/i, '')
      .replace(/^\.{1,2}\//, '/')
      .replace(/\.html$/i, '')
      .replace(/\/+$/, '');

    return normalized.startsWith('/') ? normalized : ('/' + normalized);
  };

  const expectedPath = toComparableSongPath(window.location.pathname || '');
  if (expectedPath) {
    const directMatch = window.SongData.allSongs.find((song) => {
      const songPath = toComparableSongPath((song || {}).path || '');
      return songPath === expectedPath;
    });

    if (directMatch) {
      return directMatch;
    }
  }

  const currentBaseSlug = songMotifsGetBaseSongSlug();
  const currentHashToken = songMotifsNormalizeVersionHashToken(window.location.hash || '');
  if (currentBaseSlug) {
    const slugMatch = window.SongData.allSongs.find((song) => {
      const normalizedSongPath = toComparableSongPath((song || {}).path || '');
      if (!normalizedSongPath) {
        return false;
      }

      const splitIndex = normalizedSongPath.indexOf('#');
      const pathPart = splitIndex === -1 ? normalizedSongPath : normalizedSongPath.slice(0, splitIndex);
      const hashPart = splitIndex === -1 ? '' : normalizedSongPath.slice(splitIndex + 1);
      const songSlug = pathPart.split('/').filter(Boolean).pop() || '';

      if (songSlug !== currentBaseSlug) {
        return false;
      }

      const songHashToken = songMotifsNormalizeVersionHashToken(hashPart);
      if (!songHashToken) {
        return !currentHashToken;
      }

      return songHashToken === currentHashToken;
    });

    if (slugMatch) {
      return slugMatch;
    }
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

  const baseSlug = songMotifsGetBaseSongSlug();
  if (baseSlug) {
    const baseFile = baseSlug + '.html';
    const fallback = window.SongData.allSongs.find((song) => {
      const songFile = String(song.path || '').split('/').pop();
      return songFile && songFile.toLowerCase() === baseFile;
    });
    if (fallback) {
      return fallback;
    }
  }

  return null;
}

function songMotifsDisposeRuntimeState() {
  const state = getSongMotifsState();

  if (state.timer) {
    if (typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(state.timer);
    } else {
      clearInterval(state.timer);
    }
    state.timer = null;
  }

  if (state.karaokeTransitionTimer) {
    clearTimeout(state.karaokeTransitionTimer);
    state.karaokeTransitionTimer = null;
  }

  if (state.karaokeMainReentryAnimationTimer) {
    clearTimeout(state.karaokeMainReentryAnimationTimer);
    state.karaokeMainReentryAnimationTimer = null;
  }

  songMotifsClearKaraokeWrapResizeAnimation(state);
  state.karaokeLayoutMode = 'hidden';

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

    const target = songMotifsResolveReferenceTarget(ref.motifId);
    const motif = target.motif;
    const song = target.song;
    const referenceType = target.type;
    const isVariationMotif = referenceType === 'motif' && motif && Array.isArray(motif.variations) && motif.variations.length > 0;
    const variationId = isVariationMotif ? (ref.variationId || ref.motifId || '') : '';
    const canonicalReferenceId = target.canonicalId;
    const key = keyPrefix + '::' + referenceType + '::' + canonicalReferenceId + '::' + variationId;

    if (!map.has(key)) {
      map.set(key, {
        key,
        referenceType,
        motif,
        song,
        motifId: canonicalReferenceId,
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

    const baseName = entry.referenceType === 'song'
      ? ((entry.song && entry.song.title) || entry.motifId)
      : (entry.motif ? entry.motif.name : entry.motifId);
    const variationLabel = variation ? (variation.label || variation.id) : '';
    const displayName = variationLabel ? (baseName + ' (' + variationLabel + ')') : baseName;
    const displayColor = entry.referenceType === 'song'
      ? ((entry.song && entry.song.color) || '#999999')
      : ((variation && variation.color) || (entry.motif && entry.motif.color) || '#999999');

    grouped.push({
      key: entry.key,
      referenceType: entry.referenceType,
      motifId: entry.motifId,
      motif: entry.motif,
      song: entry.song,
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

function songMotifsRefreshTimelineGeometry() {
  const state = getSongMotifsState();
  document.querySelectorAll('.song-motif-segment').forEach((segment) => {
    const start = Number(segment.getAttribute('data-segment-start')) || 0;
    const end = Number(segment.getAttribute('data-segment-end')) || start;
    segment.style.left = ((start / (state.duration || 1)) * 100) + '%';
    segment.style.width = Math.max(0.7, ((end - start) / (state.duration || 1)) * 100) + '%';
  });
  state.motifRenderCallbacks.forEach((render) => render());
}

function songMotifsUpdateProgress() {
  const state = getSongMotifsState();
  if (!state.player || typeof state.player.getCurrentTime !== 'function') {
    return;
  }

  const liveDuration = Number(state.player.getDuration()) || 0;
  const currentRaw = state.player.getCurrentTime() || 0;
  const playerState = typeof state.player.getPlayerState === 'function' ? state.player.getPlayerState() : -1;
  const hasMeasuredRuntime = Number.isFinite(liveDuration) && liveDuration > 0
    && (!Number.isInteger(liveDuration) || currentRaw > 0 || playerState === 1)
    && songMotifsHasMeasuredPlaybackDuration();

  const previousDuration = state.duration;
  if (Number.isFinite(liveDuration) && liveDuration > 0) {
    const hasPreciseStoredDuration = Number.isFinite(Number(state.youtubeDuration))
      && Number(state.youtubeDuration) > 0
      && !Number.isInteger(Number(state.youtubeDuration));

    if (hasPreciseStoredDuration) {
      state.youtubeDuration = Number(state.youtubeDuration);
      state.duration = state.youtubeDuration;
    } else if (Math.abs((state.duration || 0) - liveDuration) > 0.05 || state.duration <= 0) {
      state.youtubeDuration = liveDuration;
      state.duration = liveDuration;
    }
  }

  if (Math.abs(state.duration - previousDuration) > 0.05) {
    songMotifsRefreshTimelineGeometry();
  }

  if (state.durationLabel) {
    if (hasMeasuredRuntime && songMotifsHasMeasuredPlaybackDuration()) {
      state.durationLabel.textContent = songMotifFormatTime(state.duration);
    } else {
      state.durationLabel.textContent = '';
    }
  }

  const duration = state.duration > 0 ? state.duration : 1;
  const current = Math.min(duration, Math.max(0, currentRaw));

  if (currentRaw <= 0 && playerState !== 1) {
    state.currentLabel.textContent = '';
    state.progressNode.style.width = '0%';
    state.motifProgressNodes.forEach((node) => {
      node.style.width = '0%';
    });
    return;
  }

  const progressWidth = ((current / duration) * 100) + '%';
  state.progressNode.style.width = progressWidth;
  state.motifProgressNodes.forEach((node) => {
    node.style.width = progressWidth;
  });
  state.currentLabel.textContent = songMotifFormatTime(current);
  songMotifsUpdateLegend(current);
  songMotifsUpdateKaraoke(current);
}

function songMotifsStartProgressTicker() {
  const state = getSongMotifsState();

  if (state.timer) {
    if (typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(state.timer);
    } else {
      clearInterval(state.timer);
    }
    state.timer = null;
  }

  const tick = () => {
    if (!state.player || typeof state.player.getPlayerState !== 'function') {
      state.timer = null;
      return;
    }

    if (state.player.getPlayerState() !== 1) {
      state.timer = null;
      return;
    }

    songMotifsUpdateProgress();
    state.timer = requestAnimationFrame(tick);
  };

  state.timer = requestAnimationFrame(tick);
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
  const progressWidth = ((target / (state.duration || 1)) * 100) + '%';
  state.progressNode.style.width = progressWidth;
  state.motifProgressNodes.forEach((node) => {
    node.style.width = progressWidth;
  });
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
  state.motifProgressNodes = [];
  state.motifRenderCallbacks = [];

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

  if (hasVideo) {
    const host = document.createElement('div');
    host.id = 'songMotifPlayerHost';
    host.className = 'song-motif-yt-host';
    videoWrap.appendChild(host);
  } else {
    videoWrap.innerHTML = '<div class="song-motif-empty">Playback is unavailable for this song.</div>';
  }

  const controls = document.createElement('div');
  controls.className = 'song-motif-controls';
  shell.appendChild(controls);

  const karaokeWrap = document.createElement('section');
  karaokeWrap.className = 'song-karaoke-wrap';
  karaokeWrap.style.display = 'none';
  shell.appendChild(karaokeWrap);

  if (hasVideo) {
    ensureSongMotifsSidebarControls();
  } else {
    state.volumeInput = null;
  }

  const karaokeViewport = document.createElement('div');
  karaokeViewport.className = 'song-karaoke-viewport';
  karaokeWrap.appendChild(karaokeViewport);

  const karaokeLayerHost = document.createElement('div');
  karaokeLayerHost.className = 'song-karaoke-layer-host';
  karaokeViewport.appendChild(karaokeLayerHost);

  const karaokeBackingWrap = document.createElement('div');
  karaokeBackingWrap.className = 'song-karaoke-backing-wrap';
  karaokeBackingWrap.style.display = 'none';
  karaokeWrap.appendChild(karaokeBackingWrap);

  const backingTrackNodes = [songMotifsCreateBackingTrack(0), songMotifsCreateBackingTrack(1)];
  backingTrackNodes.forEach((entry) => {
    karaokeBackingWrap.appendChild(entry.track);
  });

  const songColor = String(song && song.color ? song.color : '').trim() || '#ef8a85';

  const timelineWrap = document.createElement('div');
  controls.appendChild(timelineWrap);

  const labels = document.createElement('div');
  labels.className = 'song-motif-time-labels';
  timelineWrap.appendChild(labels);

  const currentLabel = document.createElement('span');
  currentLabel.textContent = '0:00.00';
  labels.appendChild(currentLabel);

  const durationLabel = document.createElement('span');
  durationLabel.textContent = '';
  labels.appendChild(durationLabel);

  const mainTrack = document.createElement('div');
  mainTrack.className = 'song-motif-main-track';
  timelineWrap.appendChild(mainTrack);

  const progress = document.createElement('div');
  progress.className = 'song-motif-main-progress';
  progress.style.background = songColor;
  mainTrack.appendChild(progress);

  const rows = document.createElement('div');
  rows.className = 'song-motif-rows';

  function appendTypeRow(targetRows, label, entries, fallbackColor, legendEntries) {
    if (!Array.isArray(entries) || entries.length === 0) {
      return;
    }

    const segments = [];
    entries.forEach((entry) => {
      entry.ranges.forEach((range) => {
        segments.push({
          start: range.start,
          end: range.end,
          isDefinition: !!range.isDefinition,
          motifName: entry.displayName,
          color: entry.displayColor || fallbackColor
        });
      });
    });

    segments.sort((a, b) => a.start - b.start);

    if (!segments.length) {
      return;
    }

      const row = document.createElement('article');
      row.className = 'song-motif-row';

      const track = document.createElement('div');
      track.className = 'song-motif-track';
      row.appendChild(track);

      const trackProgress = document.createElement('div');
      trackProgress.className = 'song-motif-track-progress';
      trackProgress.style.background = songColor;
      trackProgress.setAttribute('aria-hidden', 'true');
      track.appendChild(trackProgress);
      state.motifProgressNodes.push(trackProgress);

      const labelNode = document.createElement('div');
      labelNode.className = 'song-motif-label-link';
      labelNode.classList.add('song-motif-label-text');
      labelNode.textContent = label;
      row.appendChild(labelNode);

      const legend = document.createElement('ul');
      legend.className = 'song-motif-legend';
      row.appendChild(legend);
      appendLegendEntries(legend, legendEntries || entries);

      targetRows.appendChild(row);

      const boundaries = Array.from(new Set(segments.flatMap((range) => [range.start, range.end])))
        .filter((time) => Number.isFinite(time) && time >= 0 && time <= state.duration)
        .sort((a, b) => a - b);
      const stripeWidth = 3;
      const canvas = document.createElement('canvas');
      canvas.className = 'song-motif-canvas';
      canvas.setAttribute('aria-hidden', 'true');
      track.appendChild(canvas);

      for (let boundaryIndex = 0; boundaryIndex < boundaries.length - 1; boundaryIndex += 1) {
        const pieceStart = boundaries[boundaryIndex];
        const pieceEnd = boundaries[boundaryIndex + 1];
        if (pieceEnd - pieceStart < 0.001) {
          continue;
        }

        const midpoint = (pieceStart + pieceEnd) / 2;
        const activeRanges = segments
          .map((range, rangeIndex) => ({ range, rangeIndex }))
          .filter(({ range }) => range.start <= midpoint && range.end > midpoint);

        activeRanges.forEach(({ range, rangeIndex }, layerIndex) => {
          const depth = activeRanges.length;
          const isPieceStartOfMotif = Math.abs(pieceStart - range.start) < 0.001;
          const isPieceEndOfMotif = Math.abs(pieceEnd - range.end) < 0.001;
          const segment = document.createElement('button');
          segment.type = 'button';
          segment.className = 'song-motif-segment';
          if (range.isDefinition) {
            segment.classList.add('definition');
          }
          if (isPieceStartOfMotif) {
            segment.classList.add('motif-start');
          }
          if (isPieceEndOfMotif) {
            segment.classList.add('motif-end');
          }
          if (state.duration > 0 && pieceStart <= state.duration * 0.005) {
            segment.classList.add('edge-start');
          }
          if (state.duration > 0 && pieceEnd >= state.duration * 0.995) {
            segment.classList.add('edge-end');
          }

          const isWhite = String(range.color || fallbackColor).toUpperCase() === '#FFFFFF';
          if (isWhite) {
            segment.classList.add('white-segment');
          }

          segment.title = (range.motifName || label) + ' (' + songMotifFormatTime(range.start) + ' - ' + songMotifFormatTime(range.end) + ')';
          if (range.isDefinition) {
            segment.title += ' (definition)';
          }
          segment.style.left = ((pieceStart / state.duration) * 100) + '%';
          segment.style.width = Math.max(0.1, ((pieceEnd - pieceStart) / state.duration) * 100) + '%';
          segment.style.zIndex = String(layerIndex + 2);
          segment.setAttribute('data-segment-start', String(pieceStart));
          segment.setAttribute('data-segment-end', String(pieceEnd));
          segment.setAttribute('data-motif-start', String(range.start));
          segment.setAttribute('data-motif-end', String(range.end));

          track.appendChild(segment);
        });
      }

      const renderTrack = () => {
        const trackWidth = track.clientWidth;
        if (!trackWidth) {
          return;
        }
        const trackHeight = track.clientHeight;
        const pixelRatio = Math.max(1, Number(window.devicePixelRatio) || 1);
        const pixelWidth = Math.max(1, Math.round(trackWidth * pixelRatio));
        const pixelHeight = Math.max(1, Math.round(trackHeight * pixelRatio));
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
        canvas.style.width = trackWidth + 'px';
        canvas.style.height = trackHeight + 'px';

        const context = canvas.getContext('2d');
        if (!context) {
          return;
        }
        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        context.clearRect(0, 0, trackWidth, trackHeight);

        const darkColorCache = new Map();
        const darken = (color) => {
          if (darkColorCache.has(color)) {
            return darkColorCache.get(color);
          }
          context.save();
          context.fillStyle = color;
          const normalized = context.fillStyle;
          context.restore();
          const hex = normalized.match(/^#([0-9a-f]{6})$/i);
          const rgb = normalized.match(/^rgba?\((\d+)\D+(\d+)\D+(\d+)/i);
          let darker = '#333333';
          if (hex) {
            const value = hex[1];
            const channels = [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16));
            darker = '#' + channels.map((channel) => Math.round(channel * 0.58).toString(16).padStart(2, '0')).join('');
          } else if (rgb) {
            darker = 'rgb(' + [rgb[1], rgb[2], rgb[3]].map((channel) => Math.round(Number(channel) * 0.58)).join(', ') + ')';
          }
          darkColorCache.set(color, darker);
          return darker;
        };

        const getActiveRanges = (time) => segments.filter((range) => range.start <= time && range.end > time);
        const rangePaths = new Map();
        segments.forEach((range) => {
          const startX = (range.start / state.duration) * trackWidth;
          const endX = (range.end / state.duration) * trackWidth;
          const width = endX - startX;
          if (width <= 0) {
            return;
          }
          const path = new Path2D();
          path.roundRect(startX, 0, width, trackHeight, Math.min(trackHeight / 2, width / 2));
          rangePaths.set(range, path);
        });
        const stripeSlotAt = (x, y, depth) => {
          const diagonalIndex = Math.floor((x + y) / stripeWidth);
          return ((diagonalIndex % depth) + depth) % depth;
        };
        const isInsideRoundedRange = (range, x, y) => {
          const path = rangePaths.get(range);
          return Boolean(path && context.isPointInPath(path, x * pixelRatio, y * pixelRatio));
        };
        const getVisibleLayerIndex = (activeRanges, x, y) => {
          if (!activeRanges.length) {
            return -1;
          }
          return activeRanges.length > 1 ? stripeSlotAt(x, y, activeRanges.length) : 0;
        };

        for (let pixelX = 0; pixelX < pixelWidth; pixelX += 1) {
          const x = (pixelX + 0.5) / pixelRatio;
          const columnLeft = pixelX / pixelRatio;
          const time = (x / trackWidth) * state.duration;
          const activeRanges = getActiveRanges(time);
          if (!activeRanges.length) {
            continue;
          }

          let runStart = 0;
          let previousColor = '';
          for (let pixelY = 0; pixelY < pixelHeight; pixelY += 1) {
            const y = (pixelY + 0.5) / pixelRatio;
            const roundedActiveRanges = activeRanges.filter((range) => isInsideRoundedRange(range, x, y));
            const layerIndex = getVisibleLayerIndex(roundedActiveRanges, x, y);
            const color = layerIndex < 0 ? '' : roundedActiveRanges[layerIndex].color || fallbackColor;
            if (pixelY === 0) {
              previousColor = color;
              runStart = pixelY;
            } else if (color !== previousColor) {
              if (previousColor) {
                context.fillStyle = previousColor;
                context.fillRect(columnLeft, runStart / pixelRatio, 1 / pixelRatio, (pixelY - runStart) / pixelRatio);
              }
              previousColor = color;
              runStart = pixelY;
            }
          }
          if (previousColor) {
            context.fillStyle = previousColor;
            context.fillRect(columnLeft, runStart / pixelRatio, 1 / pixelRatio, (pixelHeight - runStart) / pixelRatio);
          }
        }

        segments.forEach((range) => {
          const startX = (range.start / state.duration) * trackWidth;
          const endX = (range.end / state.duration) * trackWidth;
          const width = endX - startX;
          if (width <= 0) {
            return;
          }
          const radius = Math.min(trackHeight / 2, width / 2);
          const inset = 0.5 / pixelRatio;
          context.beginPath();
          context.roundRect(
            startX + inset,
            inset,
            Math.max(0, width - 2 * inset),
            Math.max(0, trackHeight - 2 * inset),
            radius
          );
          context.lineWidth = 1 / pixelRatio;
          context.strokeStyle = darken(range.color || fallbackColor);
          context.stroke();
        });
      };
      state.motifRenderCallbacks.push(renderTrack);
      renderTrack();
      if (typeof ResizeObserver === 'function') {
        const observer = new ResizeObserver(renderTrack);
        observer.observe(track);
      }

      track.addEventListener('click', (event) => {
        const rect = track.getBoundingClientRect();
        if (!rect.width || !state.duration) {
          return;
        }

        const localX = Math.min(rect.width, Math.max(0, event.clientX - rect.left));
        const localY = Math.min(rect.height, Math.max(0, event.clientY - rect.top));
        const clickTime = (localX / rect.width) * state.duration;
        const activeRanges = segments.filter((range) => range.start <= clickTime && range.end > clickTime)
          .filter((range) => {
            const startX = (range.start / state.duration) * rect.width;
            const endX = (range.end / state.duration) * rect.width;
            const radius = Math.min(rect.height / 2, (endX - startX) / 2);
            const dx = Math.max(startX + radius - localX, 0, localX - (endX - radius));
            const dy = Math.max(radius - localY, 0, localY - (rect.height - radius));
            return dx * dx + dy * dy <= radius * radius;
          });

        if (!activeRanges.length) {
          songMotifsSeekTo(clickTime);
          return;
        }

        const stripeIndex = Math.floor((localX + localY) / stripeWidth);
        const visibleRange = activeRanges[((stripeIndex % activeRanges.length) + activeRanges.length) % activeRanges.length];
        const midpoint = visibleRange.start + (visibleRange.end - visibleRange.start) / 2;
        songMotifsSeekTo(clickTime >= midpoint ? visibleRange.end : visibleRange.start);
      });
  }

  const allTimelineEntries = groupedMotifRefs.concat(allSampleEntries, allLyricalEntries);

  if (allTimelineEntries.length === 0) {
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

      const referenceHref = songMotifsResolveReferenceHref(entry);
      const content = referenceHref
        ? document.createElement('a')
        : document.createElement('div');
      content.className = 'song-motif-legend-item';
      if (content.tagName === 'A') {
        content.href = referenceHref;
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

  if (allTimelineEntries.length > 0) {
    const listTitle = document.createElement('p');
    listTitle.className = 'song-motif-list-title';
    listTitle.textContent = 'Motif types in this song';
    shell.appendChild(listTitle);

    shell.appendChild(rows);
    appendTypeRow(rows, 'Rhythmic Motifs', groupedMotifRefs, '#ef8a85');
    appendTypeRow(rows, 'Lyrical Motifs', allLyricalEntries, '#777777');
    appendTypeRow(rows, 'Samples', allSampleEntries, '#6d63b5');
  }

  state.progressNode = progress;
  state.currentLabel = currentLabel;
  state.durationLabel = durationLabel;
  state.mainTrack = mainTrack;
  state.karaokeWrap = karaokeWrap;
  state.karaokeViewport = karaokeViewport;
  state.karaokeLayerHost = karaokeLayerHost;
  state.karaokeBackingWrap = karaokeBackingWrap;
  state.karaokeLayoutMode = 'hidden';
  state.karaokeBackingTracks = backingTrackNodes.map((entry, index) => ({
    id: 'backing' + String(index + 1),
    entries: [],
    trackNode: entry.track,
    isBacking: true,
    layerHost: entry.layerHost,
    activeLayer: null,
    transitionTimer: null,
    currentIndex: -2
  }));
  state.karaokeActiveLayer = null;

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

  const syncPlayerDuration = (player) => {
    if (!player || typeof player.getDuration !== 'function') {
      return;
    }

    const liveDuration = Number(player.getDuration()) || 0;
    if (!Number.isFinite(liveDuration) || liveDuration <= 0) {
      return;
    }

    const currentTime = typeof player.getCurrentTime === 'function' ? Number(player.getCurrentTime()) || 0 : 0;
    const playerState = typeof player.getPlayerState === 'function' ? player.getPlayerState() : -1;
    const hasMeasuredRuntime = Number.isFinite(liveDuration) && liveDuration > 0
      && (!Number.isInteger(liveDuration) || currentTime > 0 || playerState === 1);
    const hasPreciseStoredDuration = Number.isFinite(Number(state.youtubeDuration))
      && Number(state.youtubeDuration) > 0
      && !Number.isInteger(Number(state.youtubeDuration));

    if (hasPreciseStoredDuration) {
      state.youtubeDuration = Number(state.youtubeDuration);
      state.duration = state.youtubeDuration;
    } else {
      state.youtubeDuration = liveDuration;
      if (state.duration <= 0 || Math.abs(state.duration - liveDuration) > 0.05) {
        state.duration = liveDuration;
      }
    }

    if (state.durationLabel && hasMeasuredRuntime && songMotifsHasMeasuredPlaybackDuration()) {
      state.durationLabel.textContent = songMotifFormatTime(state.duration);
    } else if (state.durationLabel) {
      state.durationLabel.textContent = '';
    }
  };

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

        syncPlayerDuration(event.target);

        // Keep the page summary rounded to the nearest whole second, but always
        // use the live fractional player duration for the progress bar.
        if (state.youtubeDuration > 0 && typeof window.updateSongLengthFromYoutube === 'function') {
          window.updateSongLengthFromYoutube(state.youtubeDuration);
        }

        songMotifsRefreshTimelineGeometry();
      },
      onStateChange: (event) => {
        syncPlayerDuration(event.target);

        const playing = event.data === 1;
        state.playButton.textContent = playing ? '||' : '▶';

        if (playing) {
          songMotifsStartProgressTicker();
        } else {
          if (state.timer) {
            if (typeof cancelAnimationFrame === 'function') {
              cancelAnimationFrame(state.timer);
            } else {
              clearInterval(state.timer);
            }
            state.timer = null;
          }
          songMotifsUpdateProgress();
        }
      }
    }
  });
}

function renderSongMotifsSection(options) {
  const settings = options || {};
  const forceReset = Boolean(settings.forceReset);
  const state = getSongMotifsState();
  const mount = getSongMotifsMount();
  if (!mount || !window.MotifData || !window.SongData) {
    return;
  }

  const song = songMotifsFindSong();
  const nextRenderKey = song ? String(song.path || '') : '__empty__';
  const isSameRenderedSong = !forceReset
    && state.renderKey
    && state.renderKey === nextRenderKey
    && mount.getAttribute('data-song-motifs-key') === nextRenderKey
    && mount.childElementCount > 0;

  if (isSameRenderedSong) {
    return;
  }

  songMotifsDisposeRuntimeState();

  if (!song) {
    state.renderKey = nextRenderKey;
    mount.setAttribute('data-song-motifs-key', nextRenderKey);
    mount.innerHTML = '<div class="song-motif-empty">This song has no connections.</div>';
    return;
  }

  const youtubeId = songMotifsNormalizeYouTubeId(song.youtubeId);
  const groupedRefs = songMotifsGroupRefs(song);
  const groupedSampleRefs = songMotifsGroupSampleRefs(song);
  songMotifsRender(song, groupedRefs, groupedSampleRefs, youtubeId);
  state.renderKey = nextRenderKey;
  mount.setAttribute('data-song-motifs-key', nextRenderKey);

  songMotifsLoadKaraokeEntries().then((karaokeBundle) => {
    songMotifsApplyKaraokeBundle(karaokeBundle);
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

function resetSongMotifsPlaybackForVersionChange() {
  const state = getSongMotifsState();
  songMotifsDisposeRuntimeState();
  state.renderKey = '';
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
window.resetSongMotifsPlaybackForVersionChange = resetSongMotifsPlaybackForVersionChange;
