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

function motifTranscriptUnique(values) {
  const seen = new Set();
  const list = [];
  values.forEach((value) => {
    const next = String(value || '').trim().toLowerCase();
    if (!next || seen.has(next)) {
      return;
    }
    seen.add(next);
    list.push(next);
  });
  return list;
}

function normalizeVariationKey(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeInstrumentToken(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function getMotifTranscriptDefaultInstrumentKey() {
  const html = document.documentElement;
  const requested = html
    ? String(html.getAttribute('data-transcript-instrument') || '').trim()
    : '';
  return requested || 'piano';
}

function createSoundfontSampler(instrumentFolder) {
  return new window.Tone.Sampler({
    urls: {
      A1: 'A1.mp3',
      C2: 'C2.mp3',
      'D#2': 'Eb2.mp3',
      'F#2': 'Gb2.mp3',
      A2: 'A2.mp3',
      C3: 'C3.mp3',
      'D#3': 'Eb3.mp3',
      'F#3': 'Gb3.mp3',
      A3: 'A3.mp3',
      C4: 'C4.mp3',
      'D#4': 'Eb4.mp3',
      'F#4': 'Gb4.mp3',
      A4: 'A4.mp3',
      C5: 'C5.mp3',
      'D#5': 'Eb5.mp3',
      'F#5': 'Gb5.mp3',
      A5: 'A5.mp3'
    },
    release: 1,
    baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/' + instrumentFolder + '-mp3/'
  }).toDestination();
}

function createSalamanderPianoSampler() {
  return new window.Tone.Sampler({
    urls: {
      A1: 'A1.mp3',
      C2: 'C2.mp3',
      'D#2': 'Ds2.mp3',
      'F#2': 'Fs2.mp3',
      A2: 'A2.mp3',
      C3: 'C3.mp3',
      'D#3': 'Ds3.mp3',
      'F#3': 'Fs3.mp3',
      A3: 'A3.mp3',
      C4: 'C4.mp3',
      'D#4': 'Ds4.mp3',
      'F#4': 'Fs4.mp3',
      A4: 'A4.mp3',
      C5: 'C5.mp3',
      'D#5': 'Ds5.mp3',
      'F#5': 'Fs5.mp3',
      A5: 'A5.mp3'
    },
    release: 1,
    baseUrl: 'https://tonejs.github.io/audio/salamander/'
  }).toDestination();
}

function createMeowSampler() {
  return new window.Tone.Sampler({
    urls: {
      C4: 'meow.mp3'
    },
    release: 0.9,
    baseUrl: '../public/samples/'
  }).toDestination();
}

function createWscPluckSampler() {
  return new window.Tone.Sampler({
    urls: {
      E5: 'WSC_E5.wav'
    },
    release: 0.8,
    baseUrl: '../public/samples/'
  }).toDestination();
}

function createWoofSampler() {
  return new window.Tone.Sampler({
    urls: {
      C5: 'woof.wav'
    },
    release: 0.9,
    baseUrl: '../public/samples/'
  }).toDestination();
}

function createPaisleyHornsSampler() {
  return new window.Tone.Sampler({
    urls: {
      C5: 'paisley-pudge-a_c5.wav',
      E5: 'paisley-pudge-a_a5.wav'
    },
    release: 0.9,
    baseUrl: '../public/samples/'
  }).toDestination();
}

function createWHTSampler() {
  return new window.Tone.Sampler({
    urls: {
      C4: 'where-hearts-thaw_c4.wav'
    },
    release: 0.9,
    baseUrl: '../public/samples/'
  }).toDestination();
}

function createMpPianoSampler() {
  return new window.Tone.Sampler({
    urls: {
      C5: 'mppiano.wav'
    },
    release: 0.9,
    baseUrl: '../public/samples/'
  }).toDestination();
}
function createPPPPluckSampler() {
  return new window.Tone.Sampler({
    urls: {
      'G#5': 'ppppluck.wav'
    },
    release: 0.9,
    baseUrl: '../public/samples/'
  }).toDestination();
}

function getMotifTranscriptInstrumentOptions() {
  return [
    {
      key: 'piano',
      label: 'Piano',
      create: () => createSalamanderPianoSampler()
    },
    {
      key: 'meow',
      label: 'Meow',
      create: () => createMeowSampler()
    },
    {
      key: 'woof',
      label: 'Woof',
      create: () => createWoofSampler()
    },
    {
      key: 'wscpluck',
      label: 'WSC Pluck',
      create: () => createWscPluckSampler()
    },
    {
      key: 'paisleyhorn',
      label: 'Paisley Horn',
      create: () => createPaisleyHornsSampler()
    },
    {
      key: 'mpPiano',
      label: 'Mario Paint Piano',
      create: () => createMpPianoSampler()
    },
    {
      key: 'ppppluck',
      label: 'PPPP Pluck',
      create: () => createPPPPluckSampler()
    }
  ];
}

function getMotifTranscriptInstrumentOption(key) {
  const options = getMotifTranscriptInstrumentOptions();
  const normalized = normalizeInstrumentToken(key);
  return options.find((option) => {
    const keyToken = normalizeInstrumentToken(option.key);
    const labelToken = normalizeInstrumentToken(option.label);
    return normalized === keyToken || normalized === labelToken;
  }) || options[0];
}

function getRequestedMotifVariationKey() {
  try {
    const params = new URLSearchParams(window.location.search || '');
    return normalizeVariationKey(params.get('v') || params.get('variation') || '');
  } catch (error) {
    return '';
  }
}

function motifEscapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function motifPageScriptBaseUrl() {
  const current = document.currentScript;
  if (current && current.src) {
    return current.src;
  }

  const known = document.querySelector('script[src*="/assets/static/motif-page.js"], script[src*="assets/static/motif-page.js"]');
  if (known && known.src) {
    return known.src;
  }

  return window.location.href;
}

function motifPageVendorUrl(fileName) {
  return new URL('./vendor/' + fileName, motifPageScriptBaseUrl()).href;
}

function renderMotifSummaryParagraphs(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) {
    return '';
  }

  const blocks = trimmed
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  const tabPrefix = '&nbsp;&nbsp;&nbsp;&nbsp;';

  return blocks
    .map((block) => {
      const escapedLines = block.split(/\n/).map((line) => motifEscapeHtml(line.trim()));
      return '<p>' + tabPrefix + escapedLines.join('<br>' + tabPrefix) + '</p>';
    })
    .join('');
}

function makeMotifEmptyBoxHtml(label) {
  return '<div class="motif-empty-box">This motif has no ' + label + '.</div>';
}

async function loadMotifSummaryText(motifId) {
  const candidates = [
    '../public/motif-summaries/' + motifId + '.txt',
    '../public/summaries/' + motifId + '.txt'
  ];

  for (const path of candidates) {
    try {
      const response = await fetch(path, { cache: 'no-store' });
      if (!response.ok) {
        continue;
      }

      const text = await response.text();
      const trimmed = String(text || '').trim();
      if (trimmed) {
        return trimmed;
      }
    } catch (_error) {
      // Keep trying candidates.
    }
  }

  return null;
}

async function renderMotifSummary(motifId) {
  const summaryNode = document.getElementById('motifSummaryContent');
  if (!summaryNode) {
    return;
  }

  const summaryText = await loadMotifSummaryText(motifId);
  if (!summaryText) {
    summaryNode.innerHTML = makeMotifEmptyBoxHtml('summary');
    return;
  }

  const html = renderMotifSummaryParagraphs(summaryText);
  summaryNode.innerHTML = html || makeMotifEmptyBoxHtml('summary');
}

function ensureMotifOverviewLayout() {
  const motifMain = document.querySelector('.motif-main');
  const motifName = document.getElementById('motifName');
  const motifImageWrap = document.querySelector('.motif-image-wrap');

  if (!motifMain || !motifName || !motifImageWrap) {
    return null;
  }

  let overview = document.getElementById('motifOverview');
  if (!overview) {
    overview = document.createElement('section');
    overview.id = 'motifOverview';
    overview.className = 'motif-overview';
    motifMain.insertBefore(overview, motifMain.firstChild);
  }

  let summaryColumn = overview.querySelector('.motif-overview-summary');
  if (!summaryColumn) {
    summaryColumn = document.createElement('div');
    summaryColumn.className = 'motif-overview-summary';
    overview.appendChild(summaryColumn);
  }

  let metaColumn = overview.querySelector('.motif-overview-meta');
  if (!metaColumn) {
    metaColumn = document.createElement('aside');
    metaColumn.className = 'motif-overview-meta';
    overview.appendChild(metaColumn);
  }

  if (motifName.parentNode !== summaryColumn) {
    summaryColumn.appendChild(motifName);
  }

  let summaryBox = document.getElementById('motifSummaryBox');
  if (!summaryBox) {
    summaryBox = document.createElement('div');
    summaryBox.id = 'motifSummaryBox';
    summaryBox.className = 'motif-summary-box';

    const summaryTitle = document.createElement('h2');
    summaryTitle.className = 'motif-summary-title';
    summaryTitle.textContent = 'Summary';
    summaryBox.appendChild(summaryTitle);

    const summaryContent = document.createElement('div');
    summaryContent.id = 'motifSummaryContent';
    summaryContent.className = 'motif-summary-content';
    summaryBox.appendChild(summaryContent);

    summaryColumn.appendChild(summaryBox);
  }

  if (!metaColumn.querySelector('#motifMetaPanel')) {
    const panel = document.createElement('div');
    panel.id = 'motifMetaPanel';
    panel.className = 'motif-meta-panel';
    metaColumn.appendChild(panel);
  }

  const panel = metaColumn.querySelector('#motifMetaPanel');
  if (panel && motifImageWrap.parentNode !== panel) {
    panel.appendChild(motifImageWrap);
  }

  if (panel && !panel.querySelector('#motifTranscriptControlDock')) {
    const controlDock = document.createElement('div');
    controlDock.id = 'motifTranscriptControlDock';
    controlDock.className = 'motif-transcript-control-dock';
    controlDock.style.display = 'none';

    const label = document.createElement('div');
    label.className = 'motif-transcript-control-label';
    label.textContent = 'Play Transcript';
    controlDock.appendChild(label);

    panel.appendChild(controlDock);
  }

  let firstAppearsWrap = document.getElementById('motifFirstAppearsWrap');
  if (!firstAppearsWrap) {
    firstAppearsWrap = document.createElement('div');
    firstAppearsWrap.id = 'motifFirstAppearsWrap';
    firstAppearsWrap.className = 'motif-first-appears';

    const heading = document.createElement('h3');
    heading.className = 'motif-first-appears-title';
    heading.textContent = 'First Appears In';
    firstAppearsWrap.appendChild(heading);

    const value = document.createElement('div');
    value.id = 'motifFirstAppearsValue';
    value.className = 'motif-first-appears-value';
    firstAppearsWrap.appendChild(value);

    if (panel) {
      panel.appendChild(firstAppearsWrap);
    }
  }

  return { overview, summaryColumn, metaColumn };
}

function setMotifTranscriptEmptyBubble(message) {
  const mount = document.getElementById('motifTranscriptMount');
  if (!mount) {
    return;
  }

  mount.innerHTML = '';
  const bubble = document.createElement('div');
  bubble.className = 'motif-empty-box';
  bubble.textContent = message;
  mount.appendChild(bubble);
}

function setMotifTranscriptUiVisible(visible) {
  const dock = document.getElementById('motifTranscriptControlDock');
  if (dock) {
    dock.style.display = visible ? '' : 'none';
  }

  const section = document.getElementById('motifTranscriptSection');
  if (section) {
    if (visible) {
      section.removeAttribute('hidden');
    } else {
      section.setAttribute('hidden', 'hidden');
    }
  }
}

function motifTranscriptStripTempoMarks(mount) {
  if (!mount) {
    return;
  }

  const strip = () => {
    mount.querySelectorAll('.vf-stavetempo, .vf-bpm').forEach((node) => {
      node.remove();
    });

    mount.querySelectorAll('text').forEach((node) => {
      const text = String(node.textContent || '').trim();
      if (/=\s*\d+/.test(text)) {
        const wrapper = node.closest('.vf-text') || node.closest('g');
        if (wrapper) {
          wrapper.remove();
        } else {
          node.remove();
        }
      }

      // VexFlow measure labels are emitted as numeric vf-text groups.
      if (/^\d+$/.test(text)) {
        const wrapper = node.closest('.vf-text');
        if (wrapper && wrapper.classList.contains('vf-text')) {
          wrapper.remove();
        }
      }
    });
  };

  strip();

  if (mount.__motifTempoObserver) {
    mount.__motifTempoObserver.disconnect();
    mount.__motifTempoObserver = null;
  }

  const observer = new MutationObserver(() => {
    strip();
  });

  observer.observe(mount, {
    childList: true,
    subtree: true,
    characterData: true
  });

  mount.__motifTempoObserver = observer;
  window.setTimeout(() => {
    if (mount.__motifTempoObserver === observer) {
      observer.disconnect();
      mount.__motifTempoObserver = null;
    }
  }, 5000);
}

function motifTranscriptFitToColumn(mount) {
  if (!mount) {
    return;
  }

  mount.style.visibility = 'hidden';

  const getVisualSeconds = () => {
    const state = getMotifTranscriptPlayerState();
    if (state.isPlaying && window.Tone) {
      const now = Number(window.Tone.getTransport().seconds) || 0;
      return motifTranscriptGetAudibleSeconds(now);
    }
    return state.offsetSeconds;
  };

  const fit = () => {
    mount.style.overflowX = 'hidden';
    mount.style.height = 'auto';

    const mountWidth = mount.clientWidth || 0;
    if (mountWidth <= 0) {
      return false;
    }

    const svg = mount.querySelector('svg');
    if (svg) {
      let contentWidth = Number(svg.dataset.motifIntrinsicWidth) || 0;
      let contentHeight = Number(svg.dataset.motifIntrinsicHeight) || 0;

      if (contentWidth <= 0 || contentHeight <= 0) {
        svg.style.transform = 'none';
        svg.style.width = 'auto';
        svg.style.height = 'auto';
        svg.style.maxWidth = 'none';

        const viewBox = String(svg.getAttribute('viewBox') || '').trim().split(/\s+/);
        if (viewBox.length === 4) {
          const vbWidth = Number(viewBox[2]);
          const vbHeight = Number(viewBox[3]);
          if (vbWidth > 0 && vbHeight > 0) {
            contentWidth = vbWidth;
            contentHeight = vbHeight;
          }
        }

        if (contentWidth <= 0 || contentHeight <= 0) {
          try {
            const box = svg.getBBox();
            if (box && box.width > 0 && box.height > 0) {
              const pad = 6;
              contentWidth = box.width + pad * 2;
              contentHeight = box.height + pad * 2;
              svg.setAttribute('viewBox',
                (box.x - pad) + ' ' + (box.y - pad) + ' ' + contentWidth + ' ' + contentHeight);
            }
          } catch (_error) {
            // Fallback handled below.
          }
        }

        if (contentWidth <= 0 || contentHeight <= 0) {
          const attrWidth = Number(svg.getAttribute('width'));
          const attrHeight = Number(svg.getAttribute('height'));
          if (attrWidth > 0 && attrHeight > 0) {
            contentWidth = attrWidth;
            contentHeight = attrHeight;
          }
        }

        if (contentWidth <= 0 || contentHeight <= 0) {
          const rect = svg.getBoundingClientRect();
          contentWidth = Math.max(1, rect.width);
          contentHeight = Math.max(1, rect.height);
        }

        svg.dataset.motifIntrinsicWidth = String(contentWidth);
        svg.dataset.motifIntrinsicHeight = String(contentHeight);
      }

      const scale = mountWidth / contentWidth;
      const verticalScale = scale * 0.86;
      const scaledHeight = Math.max(1, Math.ceil(contentHeight * verticalScale) + 3);

      svg.style.display = 'block';
      svg.style.width = contentWidth + 'px';
      svg.style.height = contentHeight + 'px';
      svg.style.maxWidth = 'none';
      svg.style.transformOrigin = 'top left';
      svg.style.transform = 'scale(' + scale + ', ' + verticalScale + ')';

      // Detect unexpected resize drift and re-normalize the engraving scale.
      const renderedRect = svg.getBoundingClientRect();
      if (renderedRect && renderedRect.width > 0) {
        const drift = Math.abs(renderedRect.width - mountWidth);
        if (drift > 2) {
          const correction = mountWidth / renderedRect.width;
          const correctedScale = scale * correction;
          const correctedVerticalScale = verticalScale * correction;
          svg.style.transform = 'scale(' + correctedScale + ', ' + correctedVerticalScale + ')';
          svg.dataset.motifAppliedScaleX = String(correctedScale);
          svg.dataset.motifAppliedScaleY = String(correctedVerticalScale);
        } else {
          svg.dataset.motifAppliedScaleX = String(scale);
          svg.dataset.motifAppliedScaleY = String(verticalScale);
        }
      }

      // Ensure notation follows the active theme instead of hardcoded black.
      motifTranscriptApplyThemeInk(mount);

      mount.style.height = scaledHeight + 'px';
      return true;
    }

    // Renderer may first create a canvas host and then inject the final SVG.
    // Do not treat canvas-only state as fitted; wait for the SVG engraving.
    return false;
  };

  const attemptFit = (attempt) => {
    const fitted = fit();
    if (fitted) {
      motifTranscriptBuildNoteVisuals();
      motifTranscriptUpdateSheetPlaybackVisuals(getVisualSeconds());
      mount.style.visibility = '';
      return;
    }

    if (attempt < 40) {
      window.setTimeout(() => {
        attemptFit(attempt + 1);
      }, 50);
      return;
    }

    // Fallback: reveal even if fitting did not converge in time.
    mount.style.visibility = '';
  };

  attemptFit(0);
}

function motifTranscriptInstallResizeGuard(mount) {
  if (!mount) {
    return;
  }

  if (typeof mount.__motifResizeGuardCleanup === 'function') {
    mount.__motifResizeGuardCleanup();
  }

  const queueFit = () => {
    if (mount.__motifResizeGuardRaf) {
      window.cancelAnimationFrame(mount.__motifResizeGuardRaf);
    }

    mount.__motifResizeGuardRaf = window.requestAnimationFrame(() => {
      mount.__motifResizeGuardRaf = null;
      if (!mount.isConnected) {
        return;
      }
      motifTranscriptFitToColumn(mount);
    });
  };

  const onWindowResize = () => {
    queueFit();
  };

  window.addEventListener('resize', onWindowResize, { passive: true });

  let resizeObserver = null;
  if (typeof window.ResizeObserver === 'function') {
    resizeObserver = new ResizeObserver(() => {
      queueFit();
    });

    resizeObserver.observe(mount);

    const svg = mount.querySelector('svg');
    if (svg) {
      resizeObserver.observe(svg);
    }
  }

  const mutationObserver = new MutationObserver(() => {
    if (resizeObserver) {
      const svg = mount.querySelector('svg');
      if (svg && svg !== mount.__motifResizeGuardObservedSvg) {
        mount.__motifResizeGuardObservedSvg = svg;
        resizeObserver.observe(svg);
      }
    }
    queueFit();
  });

  mutationObserver.observe(mount, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['style', 'width', 'height', 'viewBox']
  });

  mount.__motifResizeGuardCleanup = () => {
    window.removeEventListener('resize', onWindowResize);
    if (resizeObserver) {
      resizeObserver.disconnect();
    }
    mutationObserver.disconnect();
    if (mount.__motifResizeGuardRaf) {
      window.cancelAnimationFrame(mount.__motifResizeGuardRaf);
      mount.__motifResizeGuardRaf = null;
    }
    mount.__motifResizeGuardObservedSvg = null;
    mount.__motifResizeGuardCleanup = null;
  };
}

function motifTranscriptSchedulePostRenderFit(mount) {
  if (!mount) {
    return;
  }

  motifTranscriptInstallResizeGuard(mount);
  motifTranscriptFitToColumn(mount);

  [120, 380].forEach((delayMs) => {
    window.setTimeout(() => {
      if (!mount.isConnected) {
        return;
      }
      motifTranscriptFitToColumn(mount);
    }, delayMs);
  });
}

function motifTranscriptIsBlackColor(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized || normalized === 'none') {
    return false;
  }

  return normalized === '#000'
    || normalized === '#000000'
    || normalized === 'black'
    || normalized === 'rgb(0,0,0)'
    || normalized === 'rgb(0, 0, 0)'
    || normalized === 'rgba(0,0,0,1)'
    || normalized === 'rgba(0, 0, 0, 1)';
}

function motifTranscriptApplyThemeInk(mount) {
  if (!mount) {
    return;
  }

  const rootStyle = window.getComputedStyle(document.documentElement);
  const transcriptColor = String(
    rootStyle.getPropertyValue('--theme-color-text_base_black') || '#000000'
  ).trim() || '#000000';

  mount.style.color = transcriptColor;

  const svgList = mount.querySelectorAll('svg');
  svgList.forEach((svg) => {
    svg.style.color = transcriptColor;

    const nodes = svg.querySelectorAll('[fill],[stroke],[style],text,path,line,rect,circle,ellipse,polygon,polyline');
    nodes.forEach((node) => {
      const fill = node.getAttribute('fill');
      const stroke = node.getAttribute('stroke');
      const inlineStyle = node.getAttribute('style');

      if (motifTranscriptIsBlackColor(fill)) {
        node.setAttribute('fill', transcriptColor);
      }

      if (motifTranscriptIsBlackColor(stroke)) {
        node.setAttribute('stroke', transcriptColor);
      }

      if (inlineStyle) {
        const replacedStyle = inlineStyle
          .replace(/fill\s*:\s*(#000000|#000|black|rgb\(0\s*,\s*0\s*,\s*0\)|rgba\(0\s*,\s*0\s*,\s*0\s*,\s*1\))/gi, 'fill: ' + transcriptColor)
          .replace(/stroke\s*:\s*(#000000|#000|black|rgb\(0\s*,\s*0\s*,\s*0\)|rgba\(0\s*,\s*0\s*,\s*0\s*,\s*1\))/gi, 'stroke: ' + transcriptColor);

        if (replacedStyle !== inlineStyle) {
          node.setAttribute('style', replacedStyle);
        }
      }
    });
  });
}

function ensureMotifTranscriptSection(songsHeading, motifName) {
  if (!songsHeading || !songsHeading.parentNode) {
    return null;
  }

  const layout = ensureMotifOverviewLayout();
  const transcriptParent = layout && layout.summaryColumn
    ? layout.summaryColumn
    : songsHeading.parentNode;

  const existing = document.getElementById('motifTranscriptSection');
  if (existing) {
    if (transcriptParent && existing.parentNode !== transcriptParent) {
      transcriptParent.appendChild(existing);
    }
    return existing;
  }

  const section = document.createElement('section');
  section.id = 'motifTranscriptSection';
  section.className = 'motif-transcript-section';

  const heading = document.createElement('h2');
  heading.className = 'motif-section-title motif-transcript-title';
  heading.textContent = 'Transcription';
  section.appendChild(heading);

  const subtitle = document.createElement('p');
  subtitle.className = 'motif-transcript-subtitle';
  section.appendChild(subtitle);

  const status = document.createElement('p');
  status.id = 'motifTranscriptStatus';
  status.className = 'motif-transcript-status';
  section.appendChild(status);

  const player = document.createElement('div');
  player.id = 'motifTranscriptPlayer';
  player.className = 'motif-transcript-player is-hidden';

  const playerTop = document.createElement('div');
  playerTop.className = 'motif-transcript-player-top';

  const playButton = document.createElement('button');
  playButton.type = 'button';
  playButton.id = 'motifTranscriptPlayButton';
  playButton.className = 'motif-play-btn motif-transcript-play-btn';
  playButton.textContent = '▶';
  playerTop.appendChild(playButton);

  const timing = document.createElement('span');
  timing.id = 'motifTranscriptPlayerTiming';
  timing.className = 'motif-transcript-player-timing';
  timing.textContent = '0:00 / 0:00';
  playerTop.appendChild(timing);
  player.appendChild(playerTop);

  const controlDock = document.getElementById('motifTranscriptControlDock');
  if (controlDock) {
    controlDock.appendChild(player);
  } else {
    section.appendChild(player);
  }

  const instrumentWrap = document.createElement('label');
  instrumentWrap.className = 'motif-transcript-instrument-wrap';

  const instrumentLabel = document.createElement('span');
  instrumentLabel.className = 'motif-transcript-instrument-label';
  instrumentLabel.textContent = 'Inst';
  instrumentWrap.appendChild(instrumentLabel);

  const instrumentSelect = document.createElement('select');
  instrumentSelect.id = 'motifTranscriptInstrumentSelect';
  instrumentSelect.className = 'motif-transcript-instrument-select';
  instrumentSelect.setAttribute('aria-label', 'Transcript instrument');
  getMotifTranscriptInstrumentOptions().forEach((option) => {
    const node = document.createElement('option');
    node.value = option.key;
    node.textContent = option.label;
    instrumentSelect.appendChild(node);
  });
  instrumentWrap.appendChild(instrumentSelect);

  if (controlDock) {
    controlDock.appendChild(instrumentWrap);
  } else {
    section.appendChild(instrumentWrap);
  }

  const mount = document.createElement('div');
  mount.id = 'motifTranscriptMount';
  mount.className = 'motif-transcript-mount';
  section.appendChild(mount);

  if (transcriptParent) {
    transcriptParent.appendChild(section);
  } else {
    songsHeading.parentNode.insertBefore(section, songsHeading);
  }
  return section;
}

function setMotifTranscriptStatus(message, tone) {
  const node = document.getElementById('motifTranscriptStatus');
  if (!node) {
    return;
  }

  node.textContent = message;
  node.classList.remove('is-error');
  node.classList.remove('is-muted');
  if (tone === 'error') {
    node.classList.add('is-error');
  }
  if (tone === 'muted') {
    node.classList.add('is-muted');
  }
}

function setMotifTranscriptPlayerMessage(message, tone) {
  const node = document.getElementById('motifTranscriptPlayerMessage');
  if (!node) {
    return;
  }

  node.textContent = message;
  node.classList.remove('is-error');
  node.classList.remove('is-muted');
  if (tone === 'error') {
    node.classList.add('is-error');
  }
  if (tone === 'muted') {
    node.classList.add('is-muted');
  }
}

function getMotifTranscriptPlayerState() {
  if (!window.__motifTranscriptPlayerState) {
    window.__motifTranscriptPlayerState = {
      loadedTone: false,
      synth: null,
      instrumentKey: getMotifTranscriptInstrumentOption(getMotifTranscriptDefaultInstrumentKey()).key,
      part: null,
      duration: 0,
      offsetSeconds: 0,
      visualAttackLeadSeconds: 0.16,
      isPlaying: false,
      raf: null,
      boundControls: false,
      boundInstrumentControl: false,
      boundSheetSeek: false,
      playbackEvents: [],
      events: [],
      visualEvents: [],
      noteVisuals: [],
      rowExtents: [],
      rowBands: [],
      rowStaffBands: [],
      grandStaffScan: null,
      lastVisualIndex: -1,
      scanLineNode: null,
      lastScanRowIndex: -1
    };
  }

  return window.__motifTranscriptPlayerState;
}

function motifTranscriptMidiToNoteName(midiValue) {
  const midi = Number(midiValue);
  if (!Number.isFinite(midi)) {
    return '';
  }

  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const safeMidi = Math.max(0, Math.min(127, Math.round(midi)));
  const octave = Math.floor(safeMidi / 12) - 1;
  const note = names[safeMidi % 12];
  return note + octave;
}

function motifTranscriptUpdatePlayerTiming(currentSeconds, visualSeconds) {
  const state = getMotifTranscriptPlayerState();
  const timingNode = document.getElementById('motifTranscriptPlayerTiming');
  if (!timingNode) {
    return;
  }

  const duration = Math.max(0, Number(state.duration) || 0);
  const current = Math.max(0, Math.min(duration, Number(currentSeconds) || 0));
  timingNode.textContent = formatTime(current) + ' / ' + formatTime(duration);

  const visual = Number.isFinite(visualSeconds)
    ? Math.max(0, Math.min(duration, Number(visualSeconds) || 0))
    : current;

  motifTranscriptUpdateSheetPlaybackVisuals(visual);
}

function motifTranscriptEnsureScanLineNode() {
  const state = getMotifTranscriptPlayerState();
  const mount = document.getElementById('motifTranscriptMount');
  if (!mount) {
    state.scanLineNode = null;
    return null;
  }

  let line = mount.querySelector('.motif-transcript-scanline');
  if (!line) {
    line = document.createElement('div');
    line.className = 'motif-transcript-scanline';
    mount.appendChild(line);
  }

  state.scanLineNode = line;
  return line;
}

function motifTranscriptBuildNoteVisuals() {
  const state = getMotifTranscriptPlayerState();
  const mount = document.getElementById('motifTranscriptMount');
  if (!mount) {
    state.noteVisuals = [];
    state.rowExtents = [];
    state.rowBands = [];
    state.rowStaffBands = [];
    return;
  }

  const mountRect = mount.getBoundingClientRect();
  const noteheads = Array.from(mount.querySelectorAll('svg .vf-notehead'))
    .filter((node) => node.closest('.vf-stavenote') && node.closest('.vf-measure'))
    .filter((node) => {
      const rect = node.getBoundingClientRect();
      if (!rect || rect.width <= 0 || rect.height <= 0) {
        return false;
      }

      // Exclude rest-like glyphs while keeping grace noteheads in modifier groups.
      const ratio = rect.width / rect.height;
      const inModifierGroup = Boolean(node.closest('.vf-modifiers'));
      return rect.height <= 13.5 && (ratio >= 0.72 || inModifierGroup);
    });

  const visuals = noteheads.map((node) => {
    const rect = node.getBoundingClientRect();
    const noteGroup = node.closest('.vf-stavenote');
    const measureGroup = node.closest('.vf-measure');
    const noteGroupRect = noteGroup ? noteGroup.getBoundingClientRect() : rect;
    const measureRect = measureGroup ? measureGroup.getBoundingClientRect() : rect;
    const noteCenterY = rect.top - mountRect.top + mount.scrollTop + (rect.height / 2);
    const noteStartX = noteGroupRect.left - mountRect.left + mount.scrollLeft;
    const measureRightX = measureRect.right - mountRect.left + mount.scrollLeft;
    const measureTop = measureRect.top - mountRect.top + mount.scrollTop;
    const measureBottom = measureRect.bottom - mountRect.top + mount.scrollTop;
    return {
      node,
      noteGroup,
      x: noteStartX,
      measureRightX,
      noteY: noteCenterY,
      measureTop,
      measureBottom,
      rowIndex: 0
    };
  });

  function assignRowIndices(targetVisuals) {
    let rowIndex = 0;
    if (targetVisuals.length > 0) {
      targetVisuals[0].rowIndex = 0;
    }

    for (let index = 1; index < targetVisuals.length; index += 1) {
      const previous = targetVisuals[index - 1];
      const current = targetVisuals[index];
      const xWrapped = current.x < previous.x - 30;
      const yJumped = Math.abs(current.noteY - previous.noteY) > 46;
      if (xWrapped || yJumped) {
        rowIndex += 1;
      }
      current.rowIndex = rowIndex;
    }
  }

  let alignedVisuals = visuals.slice();
  assignRowIndices(alignedVisuals);

  const sourceEvents = Array.isArray(state.events) ? state.events.slice() : [];
  let alignedEvents = sourceEvents.slice();

  if (alignedVisuals.length > 0 && alignedEvents.length > 0) {
    if (alignedVisuals.length < alignedEvents.length) {
      let dropNeeded = alignedEvents.length - alignedVisuals.length;

      const dropMatching = (predicate) => {
        for (let index = alignedEvents.length - 1; index >= 0 && dropNeeded > 0; index -= 1) {
          if (!predicate(alignedEvents[index], index)) {
            continue;
          }
          alignedEvents.splice(index, 1);
          dropNeeded -= 1;
        }
      };

      // Prefer dropping continuation tie keyframes first; they are least visually distinct.
      dropMatching((event) => event && event.attack === false);

      // If still mismatched, trim from the tail to preserve earlier timing anchors.
      while (dropNeeded > 0 && alignedEvents.length > 0) {
        alignedEvents.pop();
        dropNeeded -= 1;
      }
    } else if (alignedVisuals.length > alignedEvents.length) {
      const sampledVisuals = [];
      const maxEventIndex = Math.max(1, alignedEvents.length - 1);
      const maxVisualIndex = Math.max(1, alignedVisuals.length - 1);

      for (let index = 0; index < alignedEvents.length; index += 1) {
        const mappedIndex = Math.round((index * maxVisualIndex) / maxEventIndex);
        sampledVisuals.push(alignedVisuals[mappedIndex]);
      }

      alignedVisuals = sampledVisuals;
      assignRowIndices(alignedVisuals);
    }
  }

  if (alignedEvents.length > 0 && alignedVisuals.length > alignedEvents.length) {
    alignedVisuals = alignedVisuals.slice(0, alignedEvents.length);
    assignRowIndices(alignedVisuals);
  }

  const rowExtents = [];
  const rowBands = [];
  alignedVisuals.forEach((visual) => {
    const existing = rowExtents[visual.rowIndex];
    if (!existing) {
      rowExtents[visual.rowIndex] = {
        minX: visual.x,
        maxX: Math.max(visual.x, visual.measureRightX || visual.x)
      };
    } else {
      existing.minX = Math.min(existing.minX, visual.x);
      existing.maxX = Math.max(existing.maxX, visual.x, visual.measureRightX || visual.x);
    }

    const band = rowBands[visual.rowIndex];
    if (!band) {
      rowBands[visual.rowIndex] = {
        top: visual.measureTop,
        bottom: visual.measureBottom,
        minNoteY: visual.noteY,
        maxNoteY: visual.noteY
      };
    } else {
      band.top = Math.min(band.top, visual.measureTop);
      band.bottom = Math.max(band.bottom, visual.measureBottom);
      band.minNoteY = Math.min(band.minNoteY, visual.noteY);
      band.maxNoteY = Math.max(band.maxNoteY, visual.noteY);
    }
  });

  // Expand row extents with all rendered measures so rest-only bars are scanline-addressable.
  const measureNodes = Array.from(mount.querySelectorAll('svg .vf-measure'));
  measureNodes.forEach((measureNode) => {
    const rect = measureNode.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) {
      return;
    }

    const measureLeft = rect.left - mountRect.left + mount.scrollLeft;
    const measureRight = rect.right - mountRect.left + mount.scrollLeft;
    const measureTop = rect.top - mountRect.top + mount.scrollTop;
    const measureBottom = rect.bottom - mountRect.top + mount.scrollTop;
    const measureCenter = measureTop + ((measureBottom - measureTop) / 2);

    let targetRow = -1;
    let bestOverlap = 0;
    rowBands.forEach((band, rowIndex) => {
      if (!band) {
        return;
      }

      const overlap = Math.max(0, Math.min(measureBottom, band.bottom) - Math.max(measureTop, band.top));
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        targetRow = rowIndex;
      }
    });

    if (targetRow < 0) {
      let nearestDistance = Number.POSITIVE_INFINITY;
      rowBands.forEach((band, rowIndex) => {
        if (!band) {
          return;
        }
        const bandCenter = band.top + ((band.bottom - band.top) / 2);
        const distance = Math.abs(measureCenter - bandCenter);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          targetRow = rowIndex;
        }
      });
    }

    if (targetRow < 0) {
      return;
    }

    const extent = rowExtents[targetRow];
    if (!extent) {
      rowExtents[targetRow] = {
        minX: measureLeft,
        maxX: measureRight
      };
      return;
    }

    extent.minX = Math.min(extent.minX, measureLeft);
    extent.maxX = Math.max(extent.maxX, measureRight);
  });

  const staffBands = [];
  const staveNodes = Array.from(mount.querySelectorAll('svg .vf-stave, svg .staffline'));
  const rawStaves = staveNodes.map((node) => {
    const rect = node.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) {
      return null;
    }

    const top = rect.top - mountRect.top + mount.scrollTop;
    const bottom = rect.bottom - mountRect.top + mount.scrollTop;
    return {
      top,
      bottom,
      center: top + ((bottom - top) / 2),
      source: node.classList && node.classList.contains('staffline') ? 'staffline' : 'stave'
    };
  }).filter(Boolean);

  const groupedStafflineStaves = (() => {
    const staffLines = rawStaves
      .filter((entry) => entry.source === 'staffline')
      .sort((left, right) => left.center - right.center);

    if (staffLines.length === 0) {
      return [];
    }

    // Some renderers expose one .staffline group per stave; others expose one per line.
    const averageHeight = staffLines.reduce((sum, entry) => sum + Math.max(0, entry.bottom - entry.top), 0) / staffLines.length;
    if (averageHeight >= 8) {
      return staffLines.map((entry) => ({
        top: entry.top,
        bottom: entry.bottom,
        center: entry.center
      }));
    }

    if (staffLines.length < 4) {
      return [];
    }

    const groups = [];
    let current = [staffLines[0]];
    const sameStaveThreshold = 14;

    for (let index = 1; index < staffLines.length; index += 1) {
      const previous = current[current.length - 1];
      const next = staffLines[index];
      if (Math.abs(next.center - previous.center) <= sameStaveThreshold) {
        current.push(next);
      } else {
        groups.push(current);
        current = [next];
      }
    }

    groups.push(current);

    return groups
      .filter((group) => group.length >= 4)
      .map((group) => {
        const top = Math.min(...group.map((entry) => entry.top));
        const bottom = Math.max(...group.map((entry) => entry.bottom));
        return {
          top,
          bottom,
          center: top + ((bottom - top) / 2)
        };
      });
  })();

  const staves = groupedStafflineStaves.length > 0
    ? groupedStafflineStaves
    : rawStaves
      .filter((entry) => entry.source === 'stave')
      .map((entry) => ({ top: entry.top, bottom: entry.bottom, center: entry.center }));

  rowBands.forEach((band, rowIndex) => {
    const rowVisuals = alignedVisuals.filter((visual) => visual.rowIndex === rowIndex);
    if (!band || rowVisuals.length === 0) {
      return;
    }

    const rowCenter = rowVisuals.reduce((sum, visual) => sum + visual.noteY, 0) / rowVisuals.length;

    let nearestStave = null;
    let nearestDistance = Number.POSITIVE_INFINITY;
    staves.forEach((stave) => {
      const distance = Math.abs(stave.center - rowCenter);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestStave = stave;
      }
    });

    if (nearestStave) {
      staffBands[rowIndex] = {
        top: nearestStave.top,
        bottom: nearestStave.bottom
      };
    }
  });

  state.noteVisuals = alignedVisuals;
  state.visualEvents = alignedEvents.slice(0, alignedVisuals.length);
  state.rowExtents = rowExtents;
  state.rowBands = rowBands;
  state.rowStaffBands = staffBands;

  const hasGrandStaffMarkup = Boolean(mount.querySelector('svg .vf-brace, svg .vf-connector'));
  if (hasGrandStaffMarkup && rowExtents.length >= 2 && staffBands.length >= 2) {
    const rowInfos = rowExtents
      .map((extent, rowIndex) => ({
        rowIndex,
        extent,
        staff: staffBands[rowIndex] || null
      }))
      .filter((entry) => entry.extent && entry.staff)
      .sort((left, right) => left.rowIndex - right.rowIndex);

    const usedRows = new Set();
    const systems = [];

    rowInfos.forEach((rowInfo) => {
      if (usedRows.has(rowInfo.rowIndex)) {
        return;
      }

      const primaryCenter = rowInfo.staff.top + ((rowInfo.staff.bottom - rowInfo.staff.top) / 2);
      let bestMatch = null;
      let bestDistance = Number.POSITIVE_INFINITY;

      rowInfos.forEach((candidate) => {
        if (candidate.rowIndex === rowInfo.rowIndex || usedRows.has(candidate.rowIndex)) {
          return;
        }

        const overlap = Math.max(
          0,
          Math.min(rowInfo.extent.maxX, candidate.extent.maxX) - Math.max(rowInfo.extent.minX, candidate.extent.minX)
        );
        const rowSpan = Math.max(1, rowInfo.extent.maxX - rowInfo.extent.minX);
        const candidateSpan = Math.max(1, candidate.extent.maxX - candidate.extent.minX);
        const rowCoverage = overlap / rowSpan;
        const candidateCoverage = overlap / candidateSpan;
        if (overlap < 12 || Math.max(rowCoverage, candidateCoverage) < 0.45) {
          return;
        }

        const candidateCenter = candidate.staff.top + ((candidate.staff.bottom - candidate.staff.top) / 2);
        const yDistance = Math.abs(candidateCenter - primaryCenter);
        if (yDistance < 14 || yDistance > 170) {
          return;
        }

        if (yDistance < bestDistance) {
          bestDistance = yDistance;
          bestMatch = candidate;
        }
      });

      const rows = bestMatch
        ? [rowInfo.rowIndex, bestMatch.rowIndex].sort((a, b) => a - b)
        : [rowInfo.rowIndex];

      rows.forEach((rowIndex) => {
        usedRows.add(rowIndex);
      });

      const systemMinX = Math.min(...rows.map((rowIndex) => rowExtents[rowIndex].minX));
      const systemMaxX = Math.max(...rows.map((rowIndex) => rowExtents[rowIndex].maxX));
      const systemTop = Math.min(...rows.map((rowIndex) => (staffBands[rowIndex] || rowBands[rowIndex]).top));
      const systemBottom = Math.max(...rows.map((rowIndex) => (staffBands[rowIndex] || rowBands[rowIndex]).bottom));

      const eventIndices = alignedVisuals
        .map((visual, index) => ({ visual, index }))
        .filter((entry) => rows.includes(entry.visual.rowIndex))
        .map((entry) => entry.index);

      if (eventIndices.length === 0) {
        return;
      }

      const firstEventIndex = Math.min(...eventIndices);
      const lastEventIndex = Math.max(...eventIndices);
      const startTime = Number((state.visualEvents[firstEventIndex] || state.events[firstEventIndex] || {}).time) || 0;
      const lastEvent = state.visualEvents[lastEventIndex] || state.events[lastEventIndex] || null;
      const endTime = Math.max(
        startTime + 0.001,
        (Number(lastEvent && lastEvent.time) || startTime)
          + Math.max(0.001, Number(lastEvent && lastEvent.duration) || 0.001)
      );

      systems.push({
        rows,
        minX: systemMinX,
        maxX: systemMaxX,
        top: systemTop,
        bottom: systemBottom,
        firstEventIndex,
        lastEventIndex,
        startTime,
        endTime
      });
    });

    systems.sort((left, right) => left.firstEventIndex - right.firstEventIndex);

    const hasDualStaffSystem = systems.some((system) => system.rows.length >= 2);
    if (systems.length > 0 && hasDualStaffSystem) {
      const firstSystem = systems[0];
      const lastSystem = systems[systems.length - 1];
      state.grandStaffScan = {
        enabled: true,
        systems,
        minX: firstSystem.minX,
        maxX: firstSystem.maxX,
        top: firstSystem.top,
        bottom: firstSystem.bottom,
        startTime: firstSystem.startTime,
        endTime: lastSystem.endTime
      };
    } else {
      state.grandStaffScan = null;
    }
  } else {
    state.grandStaffScan = null;
  }

  state.lastVisualIndex = -1;
}

function motifTranscriptGetScanX(currentSeconds) {
  const state = getMotifTranscriptPlayerState();
  const mount = document.getElementById('motifTranscriptMount');
  if (!mount) {
    return 12;
  }

  const duration = Math.max(0.001, Number(state.duration) || 0.001);
  const current = Math.max(0, Math.min(duration, Number(currentSeconds) || 0));

  const grandFrame = motifTranscriptGetGrandStaffFrame(current);
  if (grandFrame) {
    return grandFrame.x;
  }

  const visuals = state.noteVisuals;
  const events = Array.isArray(state.visualEvents) && state.visualEvents.length > 0
    ? state.visualEvents
    : state.events;

  if (!Array.isArray(visuals) || visuals.length === 0 || visuals.length !== events.length) {
    const minX = 12;
    const maxX = Math.max(minX + 1, mount.scrollWidth - 12);
    return minX + ((current / duration) * (maxX - minX));
  }

  if (current <= events[0].time) {
    return visuals[0].x;
  }

  const lastIndex = events.length - 1;
  if (current >= events[lastIndex].time) {
    const lastVisual = visuals[lastIndex];
    const rowInfo = state.rowExtents[lastVisual.rowIndex];
    const rowEndX = rowInfo
      ? Math.max(lastVisual.x + 1, rowInfo.maxX)
      : Math.max(lastVisual.x + 1, lastVisual.x);

    const lastStart = Number(events[lastIndex].time) || 0;
    const lastDuration = Math.max(0.001, Number(events[lastIndex].duration) || 0.001);
    const tailEnd = Math.max(lastStart + lastDuration, Number(state.duration) || 0);
    const tailProgress = Math.max(0, Math.min(1, (current - lastStart) / Math.max(0.001, tailEnd - lastStart)));

    return lastVisual.x + ((rowEndX - lastVisual.x) * tailProgress);
  }

  for (let index = 0; index < lastIndex; index += 1) {
    const currentEvent = events[index];
    const nextEvent = events[index + 1];
    if (current >= currentEvent.time && current < nextEvent.time) {
      const segmentDuration = Math.max(0.001, nextEvent.time - currentEvent.time);
      const elapsed = Math.max(0, current - currentEvent.time);
      const progress = Math.max(0, Math.min(1, elapsed / segmentDuration));
      if (visuals[index] && visuals[index + 1] && visuals[index].rowIndex !== visuals[index + 1].rowIndex) {
        const rowInfo = state.rowExtents[visuals[index].rowIndex];
        const rowEndX = rowInfo
          ? Math.max(visuals[index].x + 1, rowInfo.maxX)
          : Math.max(visuals[index].x + 1, visuals[index].x);
        const eased = Math.min(1, progress * 1.08);
        return visuals[index].x + ((rowEndX - visuals[index].x) * eased);
      }

      return visuals[index].x + ((visuals[index + 1].x - visuals[index].x) * progress);
    }
  }

  return visuals[lastIndex].x;
}

function motifTranscriptGetGrandStaffFrame(currentSeconds) {
  const state = getMotifTranscriptPlayerState();
  if (!state.grandStaffScan || !state.grandStaffScan.enabled) {
    return null;
  }

  const systems = Array.isArray(state.grandStaffScan.systems) ? state.grandStaffScan.systems : [];
  if (systems.length === 0) {
    const minX = Number(state.grandStaffScan.minX) || 12;
    const maxX = Math.max(minX + 1, Number(state.grandStaffScan.maxX) || (minX + 1));
    const duration = Math.max(0.001, Number(state.duration) || 0.001);
    const clamped = Math.max(0, Math.min(duration, Number(currentSeconds) || 0));
    return {
      x: minX + ((clamped / duration) * (maxX - minX)),
      top: Number(state.grandStaffScan.top) || 10,
      bottom: Number(state.grandStaffScan.bottom) || 70,
      systemIndex: 0
    };
  }

  const time = Math.max(0, Number(currentSeconds) || 0);

  if (time <= systems[0].startTime) {
    return {
      x: systems[0].minX,
      top: systems[0].top,
      bottom: systems[0].bottom,
      systemIndex: 0
    };
  }

  for (let index = 0; index < systems.length; index += 1) {
    const system = systems[index];
    const next = systems[index + 1] || null;
    if (time < system.startTime) {
      continue;
    }

    if (time <= system.endTime) {
      const span = Math.max(0.001, system.endTime - system.startTime);
      const progress = Math.max(0, Math.min(1, (time - system.startTime) / span));
      return {
        x: system.minX + ((system.maxX - system.minX) * progress),
        top: system.top,
        bottom: system.bottom,
        systemIndex: index
      };
    }

    if (next && time < next.startTime) {
      return {
        x: system.maxX,
        top: system.top,
        bottom: system.bottom,
        systemIndex: index
      };
    }
  }

  const lastIndex = systems.length - 1;
  const last = systems[lastIndex];
  return {
    x: last.maxX,
    top: last.top,
    bottom: last.bottom,
    systemIndex: lastIndex
  };
}

function motifTranscriptGetActiveVisualIndex(currentSeconds) {
  const state = getMotifTranscriptPlayerState();
  const events = Array.isArray(state.visualEvents) && state.visualEvents.length > 0
    ? state.visualEvents
    : state.events;

  if (!Array.isArray(events) || events.length === 0) {
    return -1;
  }

  let activeIndex = -1;
  for (let index = 0; index < events.length; index += 1) {
    if (events[index].time <= currentSeconds + 0.01) {
      activeIndex = index;
    } else {
      break;
    }
  }

  return activeIndex;
}

function motifTranscriptGetSeekSecondsFromPosition(posX, posY) {
  const state = getMotifTranscriptPlayerState();
  const mount = document.getElementById('motifTranscriptMount');
  const events = Array.isArray(state.visualEvents) && state.visualEvents.length > 0
    ? state.visualEvents
    : state.events;
  const duration = Math.max(0, Number(state.duration) || 0);
  if (duration <= 0) {
    return 0;
  }

  if (!Array.isArray(state.noteVisuals)
      || state.noteVisuals.length === 0
      || state.noteVisuals.length !== events.length) {
    const width = Math.max(1, mount ? mount.scrollWidth : 1);
    return Math.max(0, Math.min(duration, (posX / width) * duration));
  }

  let targetRow = 0;
  let closestRowDistance = Number.POSITIVE_INFINITY;
  state.noteVisuals.forEach((visual) => {
    const distance = Math.abs(visual.noteY - posY);
    if (distance < closestRowDistance) {
      closestRowDistance = distance;
      targetRow = visual.rowIndex;
    }
  });

  const rowIndices = state.noteVisuals
    .map((visual, index) => ({ visual, index }))
    .filter((entry) => entry.visual.rowIndex === targetRow)
    .map((entry) => entry.index)
    .sort((left, right) => events[left].time - events[right].time);

  if (rowIndices.length === 0) {
    return Math.max(0, Math.min(duration, events[0].time || 0));
  }

  const firstIndex = rowIndices[0];
  const lastIndex = rowIndices[rowIndices.length - 1];
  const firstX = state.noteVisuals[firstIndex].x;
  const lastX = state.noteVisuals[lastIndex].x;

  if (posX <= firstX) {
    return events[firstIndex].time;
  }

  if (posX >= lastX) {
    return events[lastIndex].time;
  }

  for (let i = 0; i < rowIndices.length - 1; i += 1) {
    const leftIndex = rowIndices[i];
    const rightIndex = rowIndices[i + 1];
    const leftX = state.noteVisuals[leftIndex].x;
    const rightX = state.noteVisuals[rightIndex].x;
    const minX = Math.min(leftX, rightX);
    const maxX = Math.max(leftX, rightX);

    if (posX >= minX && posX <= maxX) {
      const width = Math.max(0.001, maxX - minX);
      const progress = (posX - minX) / width;
      const leftTime = events[leftIndex].time;
      const rightTime = events[rightIndex].time;
      return leftTime + ((rightTime - leftTime) * progress);
    }
  }

  return events[lastIndex].time;
}

function motifTranscriptSeekTo(seconds) {
  const state = getMotifTranscriptPlayerState();
  const safeDuration = Math.max(0, Number(state.duration) || 0);
  const next = Math.max(0, Math.min(safeDuration, Number(seconds) || 0));

  state.offsetSeconds = next;

  if (window.Tone) {
    const transport = window.Tone.getTransport();
    transport.seconds = next;
  }

  motifTranscriptUpdatePlayerTiming(next);
}

function motifTranscriptBindSheetSeek() {
  const state = getMotifTranscriptPlayerState();
  if (state.boundSheetSeek) {
    return;
  }

  const mount = document.getElementById('motifTranscriptMount');
  if (!mount) {
    return;
  }

  mount.addEventListener('click', (event) => {
    const stateAtClick = getMotifTranscriptPlayerState();
    const events = Array.isArray(stateAtClick.visualEvents) && stateAtClick.visualEvents.length > 0
      ? stateAtClick.visualEvents
      : stateAtClick.events;
    if (!Array.isArray(events) || events.length === 0) {
      return;
    }

    const rect = mount.getBoundingClientRect();
    const posX = (event.clientX - rect.left) + mount.scrollLeft;
    const posY = (event.clientY - rect.top) + mount.scrollTop;
    const seekSeconds = motifTranscriptGetSeekSecondsFromPosition(posX, posY);
    motifTranscriptSeekTo(seekSeconds);
  });

  state.boundSheetSeek = true;
}

function motifTranscriptUpdateSheetPlaybackVisuals(currentSeconds) {
  const state = getMotifTranscriptPlayerState();
  const mount = document.getElementById('motifTranscriptMount');
  const line = motifTranscriptEnsureScanLineNode();
  if (!mount || !line || state.duration <= 0) {
    return;
  }

  const x = motifTranscriptGetScanX(currentSeconds);
  const grandFrame = motifTranscriptGetGrandStaffFrame(currentSeconds);
  if (grandFrame) {
    const top = Math.max(8, (Number(grandFrame.top) || 10) - 8);
    const bottom = (Number(grandFrame.bottom) || 70) + 8;
    const height = Math.max(40, Math.min(120, bottom - top));
    line.style.top = top + 'px';
    line.style.height = height + 'px';
    mount.scrollLeft = 0;
    state.lastScanRowIndex = grandFrame.systemIndex;
    line.style.transform = 'translateX(' + x + 'px)';
    line.classList.toggle('active', state.isPlaying || currentSeconds > 0);
    return;
  }

  const activeIndex = motifTranscriptGetActiveVisualIndex(currentSeconds);
  const rowVisual = (activeIndex >= 0 && state.noteVisuals[activeIndex])
    ? state.noteVisuals[activeIndex]
    : (state.noteVisuals[0] || null);

  if (rowVisual) {
    const staffBand = Array.isArray(state.rowStaffBands) ? state.rowStaffBands[rowVisual.rowIndex] : null;
    const activeBand = staffBand || state.rowBands[rowVisual.rowIndex];
    if (activeBand) {
      const usesStaffBand = Number.isFinite(activeBand.top) && Number.isFinite(activeBand.bottom)
        && !Number.isFinite(activeBand.minNoteY);
      const rowTop = usesStaffBand
        ? activeBand.top - 8
        : (Number.isFinite(activeBand.minNoteY) ? activeBand.minNoteY - 6 : activeBand.top + 26);
      const rowBottom = usesStaffBand
        ? activeBand.bottom + 8
        : (Number.isFinite(activeBand.maxNoteY) ? activeBand.maxNoteY + 14 : activeBand.bottom - 22);
      const minHeight = usesStaffBand ? 30 : 40;
      const maxHeight = usesStaffBand ? 52 : 68;
      const top = Math.max(8, rowTop);
      const availableHeight = Math.max(0, rowBottom - top);
      const height = Math.max(minHeight, Math.min(maxHeight, availableHeight));
      line.style.top = top + 'px';
      line.style.height = height + 'px';
    } else {
      line.style.top = '10px';
      line.style.height = '60px';
    }

    // Keep a stationary sheet and move only the scanline.
    mount.scrollLeft = 0;

    state.lastScanRowIndex = rowVisual.rowIndex;
  }

  const displayX = x;
  line.style.transform = 'translateX(' + displayX + 'px)';
  line.classList.toggle('active', state.isPlaying || currentSeconds > 0);
}

function motifTranscriptResetSheetPlaybackVisuals() {
  const state = getMotifTranscriptPlayerState();
  state.lastVisualIndex = -1;
  state.lastScanRowIndex = -1;
  state.noteVisuals = [];
  state.rowExtents = [];
  state.rowBands = [];
  state.rowStaffBands = [];
  state.grandStaffScan = null;

  const mount = document.getElementById('motifTranscriptMount');
  if (!mount) {
    state.scanLineNode = null;
    return;
  }

  const line = motifTranscriptEnsureScanLineNode();
  if (line) {
    line.classList.remove('active');
    line.style.transform = 'translateX(12px)';
    line.style.top = '10px';
    line.style.height = '60px';
  }
}

function motifTranscriptCancelPlayerRaf() {
  const state = getMotifTranscriptPlayerState();
  if (state.raf) {
    cancelAnimationFrame(state.raf);
    state.raf = null;
  }
}

function motifTranscriptGetAudibleSeconds(scheduledSeconds) {
  const state = getMotifTranscriptPlayerState();
  if (!window.Tone) {
    return Math.max(0, Number(scheduledSeconds) || 0);
  }

  const context = window.Tone.getContext();
  const rawContext = context && context.rawContext ? context.rawContext : null;
  const lookAhead = Number(context && context.lookAhead) || 0;
  const baseLatency = Number(rawContext && rawContext.baseLatency) || 0;
  const outputLatency = Number(rawContext && rawContext.outputLatency) || 0;
  const attackLead = Number(state.visualAttackLeadSeconds) || 0;
  const compensation = (lookAhead * 0.45)
    + (baseLatency * 0.35)
    + (outputLatency * 0.25)
    + attackLead;
  return Math.max(0, (Number(scheduledSeconds) || 0) - compensation);
}

function motifTranscriptTick() {
  const state = getMotifTranscriptPlayerState();
  if (!window.Tone || !state.isPlaying) {
    motifTranscriptCancelPlayerRaf();
    return;
  }

  const transport = window.Tone.getTransport();
  const now = Number(transport.seconds) || 0;
  state.offsetSeconds = now;
  motifTranscriptUpdatePlayerTiming(now, motifTranscriptGetAudibleSeconds(now));

  if (now >= state.duration - 0.01) {
    transport.stop();
    state.isPlaying = false;
    state.offsetSeconds = 0;
    motifTranscriptUpdatePlayerButton();
    motifTranscriptUpdatePlayerTiming(0, 0);
    motifTranscriptCancelPlayerRaf();
    return;
  }

  state.raf = requestAnimationFrame(motifTranscriptTick);
}

function motifTranscriptUpdatePlayerButton() {
  const state = getMotifTranscriptPlayerState();
  const playButton = document.getElementById('motifTranscriptPlayButton');
  if (!playButton) {
    return;
  }

  playButton.textContent = state.isPlaying ? '||' : '▶';
}

async function loadMotifTranscriptToneLibrary() {
  if (window.Tone) {
    return true;
  }

  if (!window.__motifTranscriptTonePromise) {
    window.__motifTranscriptTonePromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = motifPageVendorUrl('Tone.js');
      script.async = true;
      script.onload = () => {
        if (window.Tone) {
          resolve(true);
          return;
        }
        reject(new Error('Tone.js unavailable'));
      };
      script.onerror = () => reject(new Error('Failed to load Tone.js'));
      document.head.appendChild(script);
    });
  }

  try {
    await window.__motifTranscriptTonePromise;
    return true;
  } catch (_error) {
    return false;
  }
}

function motifTranscriptResetPlaybackEngine() {
  const state = getMotifTranscriptPlayerState();
  motifTranscriptCancelPlayerRaf();

  if (window.Tone) {
    const transport = window.Tone.getTransport();
    transport.pause();
    transport.stop();
    transport.cancel();
  }

  state.isPlaying = false;
  state.offsetSeconds = 0;
  state.visualAttackLeadSeconds = 0.02;

  if (state.part) {
    state.part.dispose();
    state.part = null;
  }

  if (state.synth) {
    state.synth.dispose();
    state.synth = null;
  }

  state.playbackEvents = [];
  state.events = [];
  state.visualEvents = [];
  motifTranscriptResetSheetPlaybackVisuals();
  motifTranscriptUpdatePlayerButton();
  motifTranscriptUpdatePlayerTiming(0);
}

async function loadMotifTranscriptPlaybackData(slugCandidates) {
  for (const slug of slugCandidates) {
    const path = '../public/motifs/' + slug + '.playback.json';
    try {
      const response = await fetch(path, { cache: 'no-store' });
      if (!response.ok) {
        continue;
      }

      const payload = await response.json();
      if (payload && Array.isArray(payload.notes) && payload.notes.length > 0) {
        return { playbackData: payload, sourcePath: path };
      }
    } catch (_error) {
      // Continue trying remaining candidates.
    }
  }

  return null;
}

function motifTranscriptBindPlayerControls() {
  const state = getMotifTranscriptPlayerState();
  if (state.boundControls) {
    return;
  }

  const playButton = document.getElementById('motifTranscriptPlayButton');

  if (!playButton) {
    return;
  }

  playButton.addEventListener('click', async () => {
    if (!window.Tone || state.duration <= 0 || !state.synth) {
      return;
    }

    const transport = window.Tone.getTransport();

    if (state.isPlaying) {
      transport.pause();
      state.offsetSeconds = Number(transport.seconds) || 0;
      state.isPlaying = false;
      motifTranscriptUpdatePlayerButton();
      motifTranscriptCancelPlayerRaf();
      motifTranscriptUpdatePlayerTiming(
        state.offsetSeconds,
        motifTranscriptGetAudibleSeconds(state.offsetSeconds)
      );
      return;
    }

    await window.Tone.start();
    // Paint the line at the exact start point before transport time begins advancing.
    motifTranscriptUpdatePlayerTiming(
      state.offsetSeconds,
      motifTranscriptGetAudibleSeconds(state.offsetSeconds)
    );
    transport.start('+0.02', state.offsetSeconds);
    state.isPlaying = true;
    motifTranscriptUpdatePlayerButton();
    motifTranscriptCancelPlayerRaf();
    state.raf = requestAnimationFrame(motifTranscriptTick);
  });

  state.boundControls = true;
}

async function motifTranscriptSetInstrument(nextKey, options = {}) {
  const state = getMotifTranscriptPlayerState();
  if (!window.Tone) {
    return false;
  }

  const instrument = getMotifTranscriptInstrumentOption(nextKey);
  const resumeIfPlaying = options.resumeIfPlaying !== false;
  const transport = window.Tone.getTransport();
  const wasPlaying = state.isPlaying;

  if (state.isPlaying) {
    transport.pause();
    state.offsetSeconds = Number(transport.seconds) || 0;
    state.isPlaying = false;
    motifTranscriptCancelPlayerRaf();
    motifTranscriptUpdatePlayerButton();
    motifTranscriptUpdatePlayerTiming(
      state.offsetSeconds,
      motifTranscriptGetAudibleSeconds(state.offsetSeconds)
    );
  }

  if (state.synth) {
    state.synth.dispose();
    state.synth = null;
  }

  try {
    state.synth = instrument.create();
    state.instrumentKey = instrument.key;
  } catch (_error) {
    state.synth = null;
    return false;
  }

  const instrumentSelect = document.getElementById('motifTranscriptInstrumentSelect');
  if (instrumentSelect) {
    instrumentSelect.value = state.instrumentKey;
  }

  if (state.synth && state.synth.loaded && typeof state.synth.loaded.then === 'function') {
    setMotifTranscriptPlayerMessage('Loading ' + instrument.label + '...', 'muted');
    try {
      await state.synth.loaded;
      setMotifTranscriptPlayerMessage('', 'muted');
    } catch (_error) {
      const fallback = getMotifTranscriptInstrumentOption(getMotifTranscriptDefaultInstrumentKey());
      if (instrument.key !== fallback.key) {
        state.synth.dispose();
        state.synth = fallback.create();
        state.instrumentKey = fallback.key;
      }
      setMotifTranscriptPlayerMessage('Could not load that instrument. Switched to default.', 'error');
    }
  } else {
    setMotifTranscriptPlayerMessage('', 'muted');
  }

  if (wasPlaying && resumeIfPlaying && state.part && state.duration > 0) {
    await window.Tone.start();
    transport.start('+0.02', state.offsetSeconds);
    state.isPlaying = true;
    motifTranscriptUpdatePlayerButton();
    motifTranscriptCancelPlayerRaf();
    state.raf = requestAnimationFrame(motifTranscriptTick);
  }

  return true;
}

function motifTranscriptBindInstrumentControl() {
  const state = getMotifTranscriptPlayerState();
  if (state.boundInstrumentControl) {
    return;
  }

  const instrumentSelect = document.getElementById('motifTranscriptInstrumentSelect');
  if (!instrumentSelect) {
    return;
  }

  instrumentSelect.value = state.instrumentKey;
  instrumentSelect.addEventListener('change', async () => {
    if (!window.Tone || state.duration <= 0) {
      return;
    }

    const selectedKey = instrumentSelect.value;
    await motifTranscriptSetInstrument(selectedKey, { resumeIfPlaying: true });
  });

  state.boundInstrumentControl = true;
}

async function initializeMotifTranscriptPlayback(playbackResult) {
  const wrap = document.getElementById('motifTranscriptPlayer');
  const state = getMotifTranscriptPlayerState();

  if (!wrap) {
    return;
  }

  wrap.classList.add('is-hidden');
  setMotifTranscriptPlayerMessage('', 'muted');

  if (!playbackResult || !playbackResult.playbackData) {
    motifTranscriptResetPlaybackEngine();
    return;
  }

  const toneLoaded = await loadMotifTranscriptToneLibrary();
  if (!toneLoaded || !window.Tone) {
    motifTranscriptResetPlaybackEngine();
    return;
  }

  motifTranscriptResetPlaybackEngine();

  const notes = playbackResult.playbackData.notes || [];
  state.duration = Number(playbackResult.playbackData.duration) || 0;
  state.playbackEvents = notes
    .map((note) => ({
      time: Number(note.time) || 0,
      duration: Math.max(0.03, Number(note.duration) || 0.03),
      note: motifTranscriptMidiToNoteName(note.midi),
      velocity: Math.max(0.1, Math.min(1, Number(note.velocity) || 0.7)),
      grace: Boolean(note.grace)
    }))
    .filter((note) => note.note);

  const keyframes = Array.isArray(playbackResult.playbackData.keyframes)
    ? playbackResult.playbackData.keyframes
    : [];

  const visualEvents = keyframes.length > 0
    ? keyframes
      .map((event) => ({
        time: Number(event.time) || 0,
        duration: Math.max(0.03, Number(event.duration) || 0.03),
        note: motifTranscriptMidiToNoteName(event.midi),
        velocity: Math.max(0.1, Math.min(1, Number(event.velocity) || 0.7)),
        grace: Boolean(event.grace),
        attack: Boolean(event.attack)
      }))
      .filter((event) => event.note)
    : state.playbackEvents.map((event) => ({
      time: event.time,
      duration: event.duration,
      note: event.note,
      velocity: event.velocity,
      grace: event.grace,
      attack: true
    }));

  state.events = visualEvents;

  const playbackEnd = state.playbackEvents.length > 0
    ? Math.max(...state.playbackEvents.map((event) => (Number(event.time) || 0) + Math.max(0, Number(event.duration) || 0)))
    : 0;
  const visualEnd = state.events.length > 0
    ? Math.max(...state.events.map((event) => (Number(event.time) || 0) + Math.max(0, Number(event.duration) || 0)))
    : 0;
  state.duration = Math.max(0, playbackEnd, visualEnd);

  const onsetIntervals = [];
  for (let index = 1; index < state.events.length; index += 1) {
    const interval = state.events[index].time - state.events[index - 1].time;
    if (interval > 0.18) {
      onsetIntervals.push(interval);
    }
  }

  if (onsetIntervals.length > 0) {
    const minInterval = Math.min(...onsetIntervals);
    state.visualAttackLeadSeconds = Math.max(0.02, Math.min(0.06, minInterval * 0.2));
  } else {
    state.visualAttackLeadSeconds = 0.02;
  }

  if (state.playbackEvents.length === 0 || state.duration <= 0) {
    return;
  }

  await motifTranscriptSetInstrument(state.instrumentKey || 'piano', { resumeIfPlaying: false });

  state.part = new window.Tone.Part((time, event) => {
    if (state.synth) {
      state.synth.triggerAttackRelease(event.note, event.duration, time, event.velocity);
    }
  }, state.playbackEvents).start(0);

  state.part.loop = false;
  motifTranscriptBuildNoteVisuals();
  motifTranscriptBindSheetSeek();
  motifTranscriptResetSheetPlaybackVisuals();
  motifTranscriptBindPlayerControls();
  motifTranscriptBindInstrumentControl();
  motifTranscriptUpdatePlayerButton();
  motifTranscriptUpdatePlayerTiming(0);

  wrap.classList.remove('is-hidden');
}

function getMotifTranscriptRendererCtor() {
  const direct = window.Vex
    && window.Vex.Flow
    && window.Vex.Flow.MusicXmlRenderer;

  if (typeof direct === 'function') {
    return direct;
  }

  const defaultFlow = window.Vex
    && window.Vex.default
    && window.Vex.default.Flow
    && window.Vex.default.Flow.MusicXmlRenderer;

  if (typeof defaultFlow === 'function') {
    return defaultFlow;
  }

  return null;
}

async function loadMotifTranscriptLibrary() {
  if (getMotifTranscriptRendererCtor()) {
    return true;
  }

  if (!window.__motifTranscriptLibraryPromise) {
    window.__motifTranscriptLibraryPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = motifPageVendorUrl('vexflow-musicxml.js');
      script.async = true;
      script.onload = () => {
        if (getMotifTranscriptRendererCtor()) {
          resolve(true);
          return;
        }
        reject(new Error('MusicXmlRenderer unavailable'));
      };
      script.onerror = () => reject(new Error('Failed to load vexflow-musicxml'));
      document.head.appendChild(script);
    });
  }

  try {
    await window.__motifTranscriptLibraryPromise;
    return true;
  } catch (_error) {
    return false;
  }
}

async function loadMotifTranscriptFallbackLibrary() {
  if (window.opensheetmusicdisplay && window.opensheetmusicdisplay.OpenSheetMusicDisplay) {
    return true;
  }

  if (!window.__motifTranscriptFallbackLibraryPromise) {
    window.__motifTranscriptFallbackLibraryPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/opensheetmusicdisplay@1.9.2/build/opensheetmusicdisplay.min.js';
      script.async = true;
      script.onload = () => {
        if (window.opensheetmusicdisplay && window.opensheetmusicdisplay.OpenSheetMusicDisplay) {
          resolve(true);
          return;
        }
        reject(new Error('OpenSheetMusicDisplay unavailable'));
      };
      script.onerror = () => reject(new Error('Failed to load OpenSheetMusicDisplay'));
      document.head.appendChild(script);
    });
  }

  try {
    await window.__motifTranscriptFallbackLibraryPromise;
    return true;
  } catch (_error) {
    return false;
  }
}

async function renderMotifTranscriptFallback(xmlText, mount) {
  const fallbackLoaded = await loadMotifTranscriptFallbackLibrary();
  if (!fallbackLoaded) {
    return false;
  }

  try {
    const host = document.createElement('div');
    host.className = 'motif-transcript-canvas';
    host.style.width = '1000px';
    mount.appendChild(host);

    const osmd = new window.opensheetmusicdisplay.OpenSheetMusicDisplay(host, {
      drawingParameters: 'compact',
      autoResize: true
    });

    osmd.Zoom = 1;

    await osmd.load(xmlText);
    osmd.render();
    motifTranscriptStripTempoMarks(mount);
    motifTranscriptApplyThemeInk(mount);
    motifTranscriptSchedulePostRenderFit(mount);
    return true;
  } catch (_error) {
    return false;
  }
}

async function loadMotifTranscriptXmlText(slugCandidates) {
  for (const slug of slugCandidates) {
    const path = '../public/motifs/' + slug + '.xml';
    try {
      const response = await fetch(path, { cache: 'no-store' });
      if (!response.ok) {
        continue;
      }
      const text = await response.text();
      if (String(text || '').trim()) {
        return { xmlText: text, sourcePath: path };
      }
    } catch (_error) {
      // Continue trying remaining candidates.
    }
  }

  return null;
}

async function renderMotifTranscript(motif, motifPageId, songsHeading, variationId = '') {
  const slugCandidates = buildMotifTranscriptSlugCandidates(motif, motifPageId, variationId);

  const xmlResult = await loadMotifTranscriptXmlText(slugCandidates);

  if (!xmlResult) {
    motifTranscriptResetPlaybackEngine();
    setMotifTranscriptUiVisible(false);
    return;
  }

  const section = ensureMotifTranscriptSection(songsHeading, motif.name);
  const mount = document.getElementById('motifTranscriptMount');
  if (!section || !mount) {
    return;
  }

  setMotifTranscriptUiVisible(true);
  motifTranscriptResetSheetPlaybackVisuals();
  mount.innerHTML = '';

  const playbackResult = await loadMotifTranscriptPlaybackData(slugCandidates);
  await initializeMotifTranscriptPlayback(playbackResult);

  const libraryLoaded = await loadMotifTranscriptLibrary();
  if (!libraryLoaded) {
    motifTranscriptResetPlaybackEngine();
    setMotifTranscriptUiVisible(false);
    return;
  }

  try {
    const host = document.createElement('canvas');
    host.className = 'motif-transcript-canvas';
    host.width = 1000;
    host.height = 480;
    host.style.width = '1000px';
    host.style.height = '480px';
    mount.appendChild(host);

    // Library API takes a MusicXML string and a mount element.
    const RendererCtor = getMotifTranscriptRendererCtor();
    if (!RendererCtor) {
      throw new Error('MusicXmlRenderer unavailable after load');
    }

    new RendererCtor(xmlResult.xmlText, host);
    motifTranscriptStripTempoMarks(mount);
    motifTranscriptApplyThemeInk(mount);
    motifTranscriptSchedulePostRenderFit(mount);
    motifTranscriptBuildNoteVisuals();
    motifTranscriptUpdateSheetPlaybackVisuals(0);

    setMotifTranscriptStatus('', 'muted');
  } catch (_error) {
    mount.innerHTML = '';

    const fallbackRendered = await renderMotifTranscriptFallback(xmlResult.xmlText, mount);
    if (fallbackRendered) {
      motifTranscriptSchedulePostRenderFit(mount);
      motifTranscriptBuildNoteVisuals();
      motifTranscriptUpdateSheetPlaybackVisuals(0);
      setMotifTranscriptStatus('');
      return;
    }

    motifTranscriptResetPlaybackEngine();
    setMotifTranscriptUiVisible(false);
  }
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

function buildVariationImagePanel(motif, extraClass = '', options = {}) {
  const activeVariationKey = normalizeVariationKey(options.activeVariationKey);
  const onSelectVariation = typeof options.onSelectVariation === 'function'
    ? options.onSelectVariation
    : null;

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
    const badge = document.createElement('button');
    badge.type = 'button';
    badge.className = 'motif-variation-side-badge';
    const label = variation.label || variation.id || '?';
    const variationKey = normalizeVariationKey(variation.id || variation.label);
    badge.textContent = label;
    badge.style.setProperty('--variation-color', variation.color || motif.color || '#351854');
    badge.dataset.variationId = variation.id || '';
    badge.dataset.variationLabel = label;
    badge.dataset.variationKey = variationKey;

    const isActive = !activeVariationKey || variationKey === activeVariationKey;
    badge.classList.toggle('is-active', isActive);
    badge.classList.toggle('is-inactive', !isActive);
    badge.setAttribute('aria-pressed', isActive ? 'true' : 'false');

    if (onSelectVariation) {
      badge.addEventListener('click', () => {
        onSelectVariation(variation);
      });
    }

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
  const variationKey = normalizeVariationKey(variationId);
  const sourceRefs = []
    .concat(song.motifRefs || [])
    .concat(song.sampleRefs || [])
    .concat(song.lyricalRefs || []);

  return sourceRefs
    .filter((ref) => ref.motifId === motif.id || motif.aliases.includes(ref.motifId))
    .map((ref) => ({
      startTime: timeToSeconds(ref.startTime),
      endTime: timeToSeconds(ref.endTime),
      isVariation: !!ref.isVariation,
      isDefinition: !!ref.isDefinition,
      isSample: !!ref.isSample,
      variationId: ref.variationId || ''
    }))
    .filter((ref) => {
      if (ref.endTime > ref.startTime || ref.isDefinition) {
        return true;
      }

      return motif.motifType === 'sample' || ref.isSample;
    })
    .map((ref) => ({
      startTime: ref.startTime,
      endTime: ref.endTime > ref.startTime ? ref.endTime : ref.startTime + 0.01,
      isVariation: ref.isVariation,
      isDefinition: ref.isDefinition,
      variationId: ref.variationId
    }))
    .filter((ref) => !variationKey || normalizeVariationKey(ref.variationId) === variationKey)
    .sort((a, b) => a.startTime - b.startTime);
}

function buildMotifTranscriptSlugCandidates(motif, motifPageId, variationId = '') {
  const variationKey = normalizeVariationKey(variationId);
  const baseCandidates = motifTranscriptUnique([
    motif.pageSlug,
    motif.id,
    motifPageId
  ]);

  if (!variationKey) {
    return baseCandidates;
  }

  const variationCandidates = motifTranscriptUnique([
    motif.pageSlug ? motif.pageSlug + '-' + variationKey : '',
    motif.id ? motif.id + '-' + variationKey : '',
    motifPageId ? motifPageId + '-' + variationKey : ''
  ]);

  return variationCandidates.concat(baseCandidates);
}

const PlayerStore = {
  rows: [],
  activeRow: null,
  apiReady: false,
  volume: 100,
  volumeInput: null
};

function setMotifPageVolume(value) {
  const nextVolume = Math.max(0, Math.min(100, Number(value) || 0));
  PlayerStore.volume = nextVolume;

  if (PlayerStore.volumeInput) {
    PlayerStore.volumeInput.value = String(nextVolume);
  }

  PlayerStore.rows.forEach((row) => {
    if (row.player && typeof row.player.setVolume === 'function') {
      row.player.setVolume(nextVolume);
    }
  });
}

function buildMotifVolumeControl() {
  const wrap = document.createElement('div');
  wrap.className = 'motif-volume-wrap';

  const label = document.createElement('label');
  label.className = 'motif-volume-label';
  label.htmlFor = 'motifVolumeSlider';
  label.textContent = 'Volume';
  wrap.appendChild(label);

  const input = document.createElement('input');
  input.id = 'motifVolumeSlider';
  input.className = 'motif-volume-slider';
  input.type = 'range';
  input.min = '0';
  input.max = '100';
  input.step = '1';
  input.value = String(PlayerStore.volume);
  input.setAttribute('aria-label', 'Motif player volume');
  input.addEventListener('input', () => {
    setMotifPageVolume(input.value);
  });
  wrap.appendChild(input);

  PlayerStore.volumeInput = input;
  return wrap;
}

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
          if (typeof event.target.setVolume === 'function') {
            event.target.setVolume(PlayerStore.volume);
          }
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
  const existingVolumeWrap = document.querySelector('.motif-volume-wrap');
  const songList = document.getElementById('motifSongList');
  const songsHeading = document.getElementById('motifSongsHeading');
  ensureMotifOverviewLayout();

  if (!motif || !motifName || !motifImage || !songList) {
    return;
  }

  renderMotifSummary(motifId);

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

  const hasVariations = Array.isArray(motif.variations) && motif.variations.length > 0;
  let activeVariation = hasVariations ? (motif.variations[0] || null) : null;
  const requestedVariationKey = getRequestedMotifVariationKey();
  if (hasVariations && requestedVariationKey) {
    const requestedVariation = motif.variations.find((variation) => {
      return normalizeVariationKey(variation.id || variation.label) === requestedVariationKey;
    }) || null;
    if (requestedVariation) {
      activeVariation = requestedVariation;
    }
  }

  const updateVariationBadgeState = (variation) => {
    const panel = motifImageWrap ? motifImageWrap.querySelector('.motif-variation-image-panel') : null;
    if (!panel) {
      return;
    }

    const activeKey = normalizeVariationKey(variation && (variation.id || variation.label));
    panel.querySelectorAll('.motif-variation-side-badge').forEach((badge) => {
      const badgeKey = normalizeVariationKey(
        badge.dataset.variationKey || badge.dataset.variationId || badge.dataset.variationLabel
      );
      const isActive = badgeKey === activeKey;
      badge.classList.toggle('is-active', isActive);
      badge.classList.toggle('is-inactive', !isActive);
      badge.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  };

  const updateVariationSections = (variation) => {
    const targetKey = normalizeVariationKey(variation && (variation.id || variation.label));
    const sections = songList ? songList.querySelectorAll('.motif-variation-section') : [];
    sections.forEach((section) => {
      const sectionKey = normalizeVariationKey(section.dataset.variationId || section.dataset.variationLabel);
      const show = sectionKey === targetKey;
      section.style.display = show ? '' : 'none';
    });

    if (songsHeading && variation) {
      const label = variation.label || variation.id || '?';
      songsHeading.textContent = 'Songs with ' + motif.name + ' (' + label + ')';
    }
  };

  const applyVariationView = (variation) => {
    if (!variation) {
      return;
    }

    activeVariation = variation;
    updateVariationBadgeState(variation);
    updateVariationSections(variation);
    renderMotifTranscript(motif, motifId, songsHeading, variation.id || variation.label || '');
  };

  if (hasVariations && motifImageWrap) {
    const badges = Array.isArray(motif.variations)
      ? motif.variations.map((variation) => variation.label || variation.id).filter(Boolean)
      : [];

    if (motif.image && badges.length > 0) {
      motifImage.style.display = 'none';
      const panel = buildVariationImagePanel(motif, 'motif-image', {
        activeVariationKey: activeVariation ? (activeVariation.id || activeVariation.label) : '',
        onSelectVariation: (variation) => {
          applyVariationView(variation);
        }
      });
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

  if (existingVolumeWrap) {
    existingVolumeWrap.remove();
  }

  const nextVolumeControl = buildMotifVolumeControl();
  const metaPanel = document.getElementById('motifMetaPanel');
  if (metaPanel) {
    metaPanel.appendChild(nextVolumeControl);

    const controlDock = document.getElementById('motifTranscriptControlDock');
    if (controlDock) {
      metaPanel.appendChild(controlDock);
    }
  } else if (motifImageWrap && motifImageWrap.parentNode) {
    motifImageWrap.insertAdjacentElement('afterend', nextVolumeControl);
  }

  if (songsHeading) {
    songsHeading.textContent = 'Songs with ' + motif.name;
  }

  if (!hasVariations) {
    renderMotifTranscript(motif, motifId, songsHeading);
  }

  const songs = window.SongData.allSongs.filter((song) => getSongRefsForMotif(song, motif).length > 0);

  const firstAppearsNode = document.getElementById('motifFirstAppearsValue');
  if (firstAppearsNode) {
    firstAppearsNode.innerHTML = '';
    let firstSong = null;
    let firstTime = Number.POSITIVE_INFINITY;

    songs.forEach((song) => {
      const refs = getSongRefsForMotif(song, motif);
      refs.forEach((ref) => {
        if (ref.startTime < firstTime) {
          firstTime = ref.startTime;
          firstSong = song;
        }
      });
    });

    if (firstSong) {
      if (firstSong.path) {
        const link = document.createElement('a');
        link.href = firstSong.path;
        link.textContent = firstSong.title;
        firstAppearsNode.appendChild(link);
      } else {
        firstAppearsNode.textContent = firstSong.title;
      }
    } else {
      firstAppearsNode.textContent = 'Unknown';
    }
  }

  songList.innerHTML = '';
  PlayerStore.rows = [];

  if (songs.length === 0) {
    if (hasVariations && activeVariation) {
      applyVariationView(activeVariation);
    }

    const emptyState = document.createElement('div');
    emptyState.className = 'motif-empty';
    emptyState.textContent = 'No songs for the ' + motif.name + ' motif.';
    songList.appendChild(emptyState);
    return;
  }

  let rowIndex = 0;
  if (hasVariations) {
    if (songsHeading) {
      songsHeading.textContent = 'Motif Variations';
    }

    motif.variations.forEach((variation) => {
      const variationId = variation.id || variation.label || '';
      const variationLabel = variation.label || variation.id || '?';

      const section = document.createElement('section');
      section.className = 'motif-variation-section';
      section.dataset.variationId = variation.id || '';
      section.dataset.variationLabel = variationLabel;

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

    applyVariationView(activeVariation);
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