// Version configuration loaded from HTML data-versions attribute
let versionConfig = {};

// Ordered list of version keys for tab navigation
let versionOrder = [];

// Load configuration from HTML data attributes
function loadVersionConfig() {
  const htmlElement = document.documentElement;
  
  // Parse JSON from data-versions attribute
  if (htmlElement.hasAttribute('data-versions')) {
    try {
      const versionsJSON = JSON.parse(htmlElement.getAttribute('data-versions'));
      versionConfig = versionsJSON;
      versionOrder = Object.keys(versionsJSON);
    } catch (e) {
      console.error('Failed to parse data-versions JSON from HTML:', e);
      console.error('The data-versions attribute must contain valid JSON configuration for all versions.');
    }
  } else {
    console.error('No data-versions attribute found on HTML element. Version functionality requires this configuration.');
  }
}

function normalizeVersionHashToken(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^#/, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

function getCurrentHashVersionName() {
  const token = normalizeVersionHashToken(window.location.hash);
  if (!token || !versionOrder || versionOrder.length === 0) {
    return null;
  }

  if (versionConfig[token]) {
    return token;
  }

  for (const versionName of versionOrder) {
    const config = versionConfig[versionName] || {};
    const nameToken = normalizeVersionHashToken(config.name || versionName);
    if (token === nameToken) {
      return versionName;
    }
  }

  return null;
}

function getHashTokenForVersion(versionName) {
  if (!versionName || versionName === 'original') {
    return '';
  }

  const config = versionConfig[versionName] || {};
  const candidate = normalizeVersionHashToken(config.name || versionName);
  return candidate || normalizeVersionHashToken(versionName);
}

function syncVersionHash(versionName) {
  if (!window.history || typeof window.history.replaceState !== 'function') {
    return;
  }

  const token = getHashTokenForVersion(versionName);
  const url = new URL(window.location.href);
  url.hash = token ? ('#' + token) : '';
  window.history.replaceState(null, '', url.toString());
}

function getActiveVersionName() {
  if (!versionOrder || versionOrder.length === 0) {
    return 'original';
  }

  for (const versionName of versionOrder) {
    const versionElement = document.getElementById('version-' + versionName);
    if (versionElement && versionElement.style.display === 'flex') {
      return versionName;
    }
  }

  return 'original';
}

function getActiveMainTabName() {
  const activeTab = document.querySelector('.song-tab.active');
  if (!activeTab) {
    return 'motifs';
  }

  const onClick = String(activeTab.getAttribute('onclick') || '');
  if (onClick.includes("switchTab('summary')") || onClick.includes('switchTab("summary")')) {
    return 'summary';
  }
  if (onClick.includes("switchTab('lyrics')") || onClick.includes('switchTab("lyrics")')) {
    return 'lyrics';
  }
  if (onClick.includes("switchTab('extended')") || onClick.includes('switchTab("extended")')) {
    return 'extended';
  }
  return 'motifs';
}

function switchVersion(versionName, options) {
  const settings = options || {};
  const nextTabName = settings.preserveTab === false ? 'motifs' : getActiveMainTabName();
  // Hide all version content
  versionOrder.forEach(version => {
    const versionElement = document.getElementById('version-' + version);
    if (versionElement) {
      versionElement.style.display = 'none';
    }
  });
  
  // Remove active state from all version tabs
  document.querySelectorAll('.version-tab').forEach(el => {
    el.classList.remove('active');
  });
  
  // Check if this version exists in config
  if (!versionConfig[versionName]) {
    console.warn('Version not found:', versionName);
    return;
  }
  
  const config = versionConfig[versionName];
  const versionElement = document.getElementById('version-' + versionName);
  
  if (versionElement) {
    versionElement.style.display = 'flex';

    // Switch to the version-specific theme so all theme tokens update together.
    const versionThemeId = String(config.theme || '').trim();
    if (typeof window.applyThemeById === 'function') {
      const fallbackThemeId = String(document.documentElement.getAttribute('data-theme-id') || 'default').trim() || 'default';
      window.applyThemeById(versionThemeId || fallbackThemeId);
    } else if (versionThemeId) {
      document.documentElement.setAttribute('data-theme-id', versionThemeId);
    }
    
    // Reset album art tabs and image
    versionElement.querySelectorAll('.album-tab').forEach(el => {
      el.classList.remove('active');
    });
    
    const firstAlbumTab = versionElement.querySelector('.album-tab');
    if (firstAlbumTab) {
      firstAlbumTab.classList.add('active');
      const albumArtElement = document.getElementById(config.albumArtImageId);
      if (albumArtElement) {
        albumArtElement.src = '../../public/images/cover-art/' + config.defaultAlbumArt;
      }
      // Also update the cover artist credit for the default art
      const coverArtistDisplay = document.getElementById(config.coverArtistDisplayId);
      if (coverArtistDisplay) {
        const artist = getCoverArtist(config.defaultAlbumArt);
        if (artist !== null) {
          coverArtistDisplay.textContent = artist;
        }
      }
    }
  }
  
  // Activate the version tab
  const eventTarget = (typeof event !== 'undefined' && event && event.target && event.target.classList && event.target.classList.contains('version-tab'))
    ? event.target
    : null;
  const targetButton = eventTarget
    ? eventTarget
    : document.querySelector('.version-tab[onclick*="\'' + versionName + '\'"]');
  if (targetButton) {
    targetButton.classList.add('active');
  }

  if (!settings.skipHashUpdate) {
    syncVersionHash(versionName);
  }
  
  // Preserve the current tab when changing versions, defaulting to Connections.
  switchTab(nextTabName || 'motifs');
}


function switchTab(tabName) {
  // Hide all content in all versions
  document.querySelectorAll('.song-content').forEach(el => {
    el.classList.remove('active');
  });
  
  // Remove active state from all main tabs (globally, not just in active version)
  document.querySelectorAll('.song-tab').forEach(el => {
    el.classList.remove('active');
  });
  
  // Check if version system is in use
  let contentId;
  let lyricsSubtabsContainerId;
  let activeVersion;
  
  if (versionOrder && versionOrder.length > 0) {
    // Version-based logic
    let activeVersionName = 'original';
    for (const versionName of versionOrder) {
      const versionElement = document.getElementById('version-' + versionName);
      if (versionElement && versionElement.style.display === 'flex') {
        activeVersionName = versionName;
        break;
      }
    }
    
    // Show selected content with version-appropriate ID
    contentId = activeVersionName === 'original' ? ('content-' + tabName) : ('content-' + tabName + '-' + activeVersionName);
    lyricsSubtabsContainerId = activeVersionName === 'original' ? 'lyrics-subtabs-container' : ('lyrics-subtabs-container-' + activeVersionName);
    activeVersion = document.getElementById('version-' + activeVersionName);
  } else {
    // Simple logic for pages without version system
    contentId = 'content-' + tabName;
    lyricsSubtabsContainerId = 'lyrics-subtabs-container';
    activeVersion = document.querySelector('.song-container') || document.body;
  }
  
  const contentElement = document.getElementById(contentId);
  if (contentElement) {
    contentElement.classList.add('active');
  }

  const tabButton = Array.from(document.querySelectorAll('.song-tab')).find((button) => {
    const onClick = String(button.getAttribute('onclick') || '');
    return onClick.includes("switchTab('" + tabName + "')") || onClick.includes('switchTab("' + tabName + '")');
  });
  if (tabButton) {
    tabButton.classList.add('active');
  }
  
  // Show/hide lyrics subtabs based on selected tab
  const lyricsSubtabsContainer = document.getElementById(lyricsSubtabsContainerId);
  const songLength = activeVersion ? activeVersion.querySelector('.song-length') : null;
  
  if (lyricsSubtabsContainer) {
    if (tabName === 'lyrics') {
      lyricsSubtabsContainer.classList.add('active');
      if (songLength) songLength.classList.add('hide-border');
    } else {
      lyricsSubtabsContainer.classList.remove('active');
      if (songLength) songLength.classList.remove('hide-border');
    }
  }

  if (tabName === 'motifs' && typeof window.renderSongMotifsSection === 'function') {
    window.renderSongMotifsSection();
  }
}

function reorderSongTabs() {
  document.querySelectorAll('.song-tabs').forEach((tabsContainer) => {
    const tabs = Array.from(tabsContainer.querySelectorAll('.song-tab'));
    if (tabs.length === 0) {
      return;
    }

    const byName = {};
    tabs.forEach((button) => {
      const onClick = String(button.getAttribute('onclick') || '');
      if (onClick.includes("switchTab('summary')") || onClick.includes('switchTab("summary")')) {
        byName.summary = button;
      } else if (onClick.includes("switchTab('lyrics')") || onClick.includes('switchTab("lyrics")')) {
        byName.lyrics = button;
      } else if (onClick.includes("switchTab('motifs')") || onClick.includes('switchTab("motifs")')) {
        byName.motifs = button;
      } else if (onClick.includes("switchTab('extended')") || onClick.includes('switchTab("extended")')) {
        byName.extended = button;
      }
    });

    const spacer = tabsContainer.querySelector('.tabs-spacer');
    const orderedTabs = [byName.motifs, byName.summary, byName.lyrics, byName.extended].filter(Boolean);

    orderedTabs.forEach((button) => {
      tabsContainer.appendChild(button);
    });

    if (spacer) {
      tabsContainer.appendChild(spacer);
    }

    Array.from(tabsContainer.querySelectorAll('.version-tab')).forEach((button) => {
      tabsContainer.appendChild(button);
    });
  });
}

function switchLyricsTab(lyricsType) {
  if (lyricsType !== 'annotated') {
    lyricsType = 'annotated';
  }

  // Check if version system is in use
  if (versionOrder && versionOrder.length > 0) {
    // Version-based logic
    let activeVersionName = 'original';
    for (const versionName of versionOrder) {
      const versionElement = document.getElementById('version-' + versionName);
      if (versionElement && versionElement.style.display === 'flex') {
        activeVersionName = versionName;
        break;
      }
    }
    
    const activeVersion = document.getElementById('version-' + activeVersionName);
    if (!activeVersion) return;
    
    // Hide all lyrics content in the active version
    activeVersion.querySelectorAll('.lyrics-content').forEach(el => {
      el.classList.remove('active');
    });
    
    // Remove active state from all lyrics subtabs
    activeVersion.querySelectorAll('.lyrics-subtab').forEach(el => {
      el.classList.remove('active');
    });
    
    // Show selected lyrics content with version-appropriate ID
    const suffixId = activeVersionName === 'original' ? ('lyrics-' + lyricsType) : ('lyrics-' + lyricsType + '-' + activeVersionName);
    const selectedContent = document.getElementById(suffixId);
    if (selectedContent) {
      selectedContent.classList.add('active');
    }
    
    // Add active state to clicked lyrics subtab
    if (event && event.target) {
      event.target.classList.add('active');
    }
  } else {
    // Simple logic for pages without version system
    document.querySelectorAll('.lyrics-content').forEach(el => {
      el.classList.remove('active');
    });
    
    document.querySelectorAll('.lyrics-subtab').forEach(el => {
      el.classList.remove('active');
    });
    
    const selectedContent = document.getElementById('lyrics-' + lyricsType);
    if (selectedContent) {
      selectedContent.classList.add('active');
    }
    
    if (event && event.target) {
      event.target.classList.add('active');
    }
  }
}

function removeRawLyricsUi() {
  document.querySelectorAll('.lyrics-subtabs-container').forEach((container) => {
    const rawButtons = Array.from(container.querySelectorAll('.lyrics-subtab')).filter((button) => {
      const label = String(button.textContent || '').trim().toLowerCase();
      const onClick = String(button.getAttribute('onclick') || '').toLowerCase();
      return label === 'raw lyrics' || onClick.includes("switchlyricstab('raw')") || onClick.includes('switchlyricstab("raw")');
    });

    rawButtons.forEach((button) => button.remove());

    const remainingButtons = container.querySelectorAll('.lyrics-subtab');
    if (remainingButtons.length <= 1) {
      container.style.display = 'none';
    }

    if (remainingButtons[0]) {
      remainingButtons[0].classList.add('active');
    }
  });

  document.querySelectorAll('[id^="lyrics-raw"]').forEach((container) => {
    container.remove();
  });

  document.querySelectorAll('[id^="lyrics-annotated"]').forEach((container) => {
    container.classList.add('active');
  });
}

// Initialize lyrics subtabs visibility on page load
function loadScriptOnce(src) {
  return new Promise((resolve) => {
    const existing = document.querySelector('script[src="' + src + '"]');
    if (existing) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => resolve();
    document.head.appendChild(script);
  });
}

function getCurrentSongSlug() {
  const pathname = window.location.pathname || '';
  const file = pathname.split('/').pop() || '';
  return file.replace(/\.html$/i, '').toLowerCase();
}

function getContainerVariantSuffix(containerId, idPrefix) {
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

function buildVariantSongSlug(baseSlug, variantSuffix) {
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

function buildPublicTextPath(folder, slug, extension) {
  if (!slug) {
    return '';
  }
  return '../../public/' + folder + '/' + slug + '.' + extension;
}

function fetchTextFile(path) {
  if (!path) {
    return Promise.resolve(null);
  }

  return fetch(path, { cache: 'no-store' })
    .then((response) => {
      if (!response.ok) {
        return null;
      }
      return response.text();
    })
    .then((text) => {
      if (typeof text !== 'string') {
        return null;
      }
      return text.trim() ? text : null;
    })
    .catch(() => null);
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function sanitizeMarkdownUrl(url) {
  const candidate = String(url || '').trim();
  if (!candidate) {
    return '#';
  }

  if (/^(https?:|mailto:|\/|#|\.\/|\.\.\/)/i.test(candidate)) {
    return candidate.replace(/"/g, '%22');
  }

  return '#';
}

function renderMarkdownInline(text) {
  const codeTokens = [];
  let html = escapeHtml(text);

  html = html.replace(/`([^`]+)`/g, (_, codeText) => {
    const token = '@@CODETOKEN' + codeTokens.length + '@@';
    codeTokens.push('<code>' + codeText + '</code>');
    return token;
  });

  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => {
    const href = sanitizeMarkdownUrl(url);
    return '<a href="' + href + '">' + label + '</a>';
  });

  html = html
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/_([^_]+)_/g, '<em>$1</em>');

  html = html.replace(/@@CODETOKEN(\d+)@@/g, (_, index) => codeTokens[Number(index)] || '');
  return html;
}

function isMarkdownBlockBoundary(line) {
  const trimmed = String(line || '').trim();
  if (!trimmed) {
    return true;
  }

  return /^#{1,6}\s+/.test(trimmed)
    || /^```/.test(trimmed)
    || /^[-*+]\s+/.test(trimmed)
    || /^\d+\.\s+/.test(trimmed)
    || /^>\s?/.test(trimmed)
    || /^(-{3,}|\*{3,}|_{3,})$/.test(trimmed);
}

function renderMarkdownText(text) {
  const normalized = String(text || '').replace(/\r\n/g, '\n').trim();
  if (!normalized) {
    return '';
  }

  const lines = normalized.split('\n');
  const chunks = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    if (/^```/.test(trimmed)) {
      const codeLines = [];
      index += 1;
      while (index < lines.length && !/^```/.test(lines[index].trim())) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length && /^```/.test(lines[index].trim())) {
        index += 1;
      }

      const codeHtml = escapeHtml(codeLines.join('\n'));
      chunks.push('<pre class="song-markdown-code"><code>' + codeHtml + '</code></pre>');
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const tag = 'h' + level;
      const className = 'song-markdown-' + tag;
      chunks.push('<' + tag + ' class="' + className + '">' + renderMarkdownInline(headingMatch[2].trim()) + '</' + tag + '>');
      index += 1;
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      chunks.push('<hr class="song-markdown-hr">');
      index += 1;
      continue;
    }

    if (/^[-*+]\s+/.test(trimmed)) {
      const items = [];
      while (index < lines.length && /^[-*+]\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^[-*+]\s+/, ''));
        index += 1;
      }

      const listHtml = items.map((item) => '<li>' + renderMarkdownInline(item) + '</li>').join('');
      chunks.push('<ul>' + listHtml + '</ul>');
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^\d+\.\s+/, ''));
        index += 1;
      }

      const listHtml = items.map((item) => '<li>' + renderMarkdownInline(item) + '</li>').join('');
      chunks.push('<ol>' + listHtml + '</ol>');
      continue;
    }

    if (/^>\s?/.test(trimmed)) {
      const quoteLines = [];
      while (index < lines.length && /^>\s?/.test(lines[index].trim())) {
        quoteLines.push(lines[index].trim().replace(/^>\s?/, ''));
        index += 1;
      }

      const quoteHtml = quoteLines.map((quoteLine) => renderMarkdownInline(quoteLine)).join('<br>');
      chunks.push('<blockquote>' + quoteHtml + '</blockquote>');
      continue;
    }

    const paragraphLines = [];
    while (index < lines.length && !isMarkdownBlockBoundary(lines[index])) {
      paragraphLines.push(lines[index].trim());
      index += 1;
    }

    if (paragraphLines.length > 0) {
      const paragraphHtml = paragraphLines.map((paragraphLine) => renderMarkdownInline(paragraphLine)).join('<br>');
      chunks.push('<p>' + paragraphHtml + '</p>');
      continue;
    }

    index += 1;
  }

  return chunks.join('');
}

function renderTextParagraphs(text) {
  return renderMarkdownText(text);
}

function renderSummaryParagraphs(text) {
  const encoded = String(text || '').replace(/^[ \t]+/gm, (leadingWhitespace) => {
    let tabCount = 0;
    let spaceCount = 0;

    for (let index = 0; index < leadingWhitespace.length; index += 1) {
      if (leadingWhitespace[index] === '\t') {
        tabCount += 1;
      } else {
        spaceCount += 1;
      }
    }

    return '@@JPINDENT:' + tabCount + ':' + spaceCount + '@@';
  });

  const html = renderMarkdownText(encoded);

  return String(html || '').replace(/@@JPINDENT:(\d+):(\d+)@@/g, (_match, tabs, spaces) => {
    const tabIndent = '&nbsp;'.repeat(Number(tabs || 0) * 4);
    const spaceIndent = '&nbsp;'.repeat(Number(spaces || 0));
    return tabIndent + spaceIndent;
  });
}

function songLyricsFallbackParseTimestamp(value) {
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

function songLyricsFallbackParseRawLines(text) {
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
        time: songLyricsFallbackParseTimestamp(stamp),
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

  return deduped.map((entry) => entry.text);
}

function renderRawLyricsLines(rawLines) {
  const escapedLines = Array.isArray(rawLines) ? rawLines.map((line) =>
    String(line)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
  ) : [];

  if (escapedLines.length === 0) {
    return '';
  }

  return '<p>' + escapedLines.join('<br>') + '</p>';
}

function makeEmptyBoxHtml(label) {
  return '<div class="song-empty-box">This song has no ' + label + '.</div>';
}

function parseAnnotatedText(text) {
  const normalized = String(text || '').replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  const referencesHeadingIndex = lines.findIndex((line) => line.trim().toLowerCase() === 'references');

  const bodyText = referencesHeadingIndex >= 0
    ? lines.slice(0, referencesHeadingIndex).join('\n').trim()
    : normalized.trim();

  const referencesText = referencesHeadingIndex >= 0
    ? lines.slice(referencesHeadingIndex + 1).join('\n')
    : '';

  const references = [];
  let currentReference = null;

  referencesText.split('\n').forEach((line) => {
    const textLine = line.trim();
    if (!textLine) {
      return;
    }

    const refMatch = textLine.match(/^(\d+)(?:[\).:-]|\s)\s*(.+)$/);
    if (refMatch) {
      currentReference = {
        number: refMatch[1],
        text: refMatch[2].trim()
      };
      references.push(currentReference);
      return;
    }

    if (currentReference) {
      currentReference.text += ' ' + textLine;
    }
  });

  return {
    bodyText,
    references
  };
}

function renderAnnotatedLyricsContainer(container, text) {
  const parsed = parseAnnotatedText(text);
  if (!parsed.bodyText && parsed.references.length === 0) {
    container.innerHTML = makeEmptyBoxHtml('annotated lyrics');
    return;
  }

  const scopeKey = (container.id || 'lyrics-annotated').replace(/[^a-z0-9_-]/gi, '-');
  const markerCounts = {};
  const firstMarkerIdsByRef = {};

  const bodyHtml = renderTextParagraphs(parsed.bodyText).replace(/\[(\d+)\]/g, (_, refNum) => {
    markerCounts[refNum] = (markerCounts[refNum] || 0) + 1;
    const markerId = 'ref-marker-' + refNum + '-' + scopeKey + '-' + markerCounts[refNum];
    if (!firstMarkerIdsByRef[refNum]) {
      firstMarkerIdsByRef[refNum] = markerId;
    }

    const refId = 'ref-' + refNum + '-' + scopeKey;
    return '<a href="#' + refId + '" class="ref-tag" id="' + markerId + '" data-ref="' + refNum + '" data-ref-target="' + refId + '">[' + refNum + ']</a>';
  });

  const referencesHtml = parsed.references.length
    ? '<div class="references-section"><h3>References</h3><ol class="references-list">' + parsed.references.map((ref) => {
      const safeRefText = escapeHtml(ref.text);
      const refId = 'ref-' + ref.number + '-' + scopeKey;
      const markerId = firstMarkerIdsByRef[ref.number] || '';
      const backLinkHtml = markerId
        ? '<span class="ref-back-link"><a href="#' + markerId + '">↑</a></span>'
        : '';
      return '<li id="' + refId + '">' + backLinkHtml + safeRefText + '</li>';
    }).join('') + '</ol></div>'
    : '';

  container.innerHTML = bodyHtml + referencesHtml;
}

function renderTextContentIntoContainers(idPrefix, text, emptyLabel) {
  document.querySelectorAll('[id^="' + idPrefix + '"]').forEach((container) => {
    if (!text) {
      container.innerHTML = makeEmptyBoxHtml(emptyLabel);
      return;
    }

    const html = renderTextParagraphs(text);
    container.innerHTML = html || makeEmptyBoxHtml(emptyLabel);
  });
}

function loadSongTextContent() {
  const baseSlug = getCurrentSongSlug();
  if (!baseSlug) {
    return Promise.resolve();
  }

  const textCache = new Map();
  const fetchScopedText = (folder, slug, extension) => {
    const key = folder + '|' + slug + '|' + extension;
    if (!textCache.has(key)) {
      const path = buildPublicTextPath(folder, slug, extension);
      textCache.set(key, fetchTextFile(path));
    }
    return textCache.get(key);
  };

  const summaryTasks = Array.from(document.querySelectorAll('[id^="content-summary"]')).map((container) => {
    const variantSuffix = getContainerVariantSuffix(container.id, 'content-summary');
    const scopedSlug = buildVariantSongSlug(baseSlug, variantSuffix);
    return fetchScopedText('summaries', scopedSlug, 'txt').then((summaryText) => {
      if (!summaryText) {
        container.innerHTML = makeEmptyBoxHtml('summary');
        return;
      }

      const html = renderSummaryParagraphs(summaryText);
      container.innerHTML = html || makeEmptyBoxHtml('summary');
    });
  });

  const extendedTasks = Array.from(document.querySelectorAll('[id^="content-extended"]')).map((container) => {
    const variantSuffix = getContainerVariantSuffix(container.id, 'content-extended');
    const scopedSlug = buildVariantSongSlug(baseSlug, variantSuffix);
    return fetchScopedText('extended', scopedSlug, 'txt').then((extendedText) => {
      if (!extendedText) {
        container.innerHTML = makeEmptyBoxHtml('extended info');
        return;
      }

      const html = renderTextParagraphs(extendedText);
      container.innerHTML = html || makeEmptyBoxHtml('extended info');
    });
  });

  const annotatedTasks = Array.from(document.querySelectorAll('[id^="lyrics-annotated"]')).map((container) => {
    const variantSuffix = getContainerVariantSuffix(container.id, 'lyrics-annotated');
    const scopedSlug = buildVariantSongSlug(baseSlug, variantSuffix);
    return fetchScopedText('annotations', scopedSlug, 'txt').then((annotationsText) => {
      if (!annotationsText) {
        return fetchScopedText('lyrics', scopedSlug, 'lrc').then((lrcText) => {
          if (!lrcText) {
            container.innerHTML = makeEmptyBoxHtml('annotated lyrics');
            return;
          }

          const rawLines = songLyricsFallbackParseRawLines(lrcText);
          if (!rawLines.length) {
            container.innerHTML = makeEmptyBoxHtml('annotated lyrics');
            return;
          }

          container.innerHTML = renderRawLyricsLines(rawLines) || makeEmptyBoxHtml('annotated lyrics');
        });
      }

      renderAnnotatedLyricsContainer(container, annotationsText);
    });
  });

  return Promise.all(summaryTasks.concat(extendedTasks, annotatedTasks)).then(() => {
    initializeReferences();
  });
}

function initializeSongConnectionsFeature() {
  const prefix = '../../';

  loadScriptOnce('https://www.youtube.com/iframe_api')
    .then(() => loadScriptOnce(prefix + 'assets/static/csv-data.js'))
    .then(() => loadScriptOnce(prefix + 'assets/static/song-lyrics.js'))
    .then(() => loadScriptOnce(prefix + 'assets/static/song-motifs.js'));
}

function initializeCoverArtistCredits() {
  const containers = versionOrder && versionOrder.length > 0
    ? versionOrder.map((v) => document.getElementById('version-' + v)).filter(Boolean)
    : Array.from(document.querySelectorAll('.song-container')).filter(Boolean);

  containers.forEach((container) => {
    const activeTab = container.querySelector('.album-tab.active');
    if (!activeTab) {
      return;
    }

    const onclick = String(activeTab.getAttribute('onclick') || '');
    const match = onclick.match(/switchAlbumArt\('([^']+)'\)/);
    if (!match) {
      return;
    }

    const artist = getCoverArtist(match[1]);
    if (artist === null) {
      return;
    }

    const display = container.querySelector('[id^="cover-artist-display"]');
    if (display) {
      display.textContent = artist;
    }
  });
}

document.addEventListener('DOMContentLoaded', function() {
  loadVersionConfig();
  removeRawLyricsUi();
  reorderSongTabs();

  const hashVersionName = getCurrentHashVersionName();
  if (hashVersionName && versionConfig[hashVersionName]) {
    switchVersion(hashVersionName, { skipHashUpdate: true });
  } else {
    // Load connections as default tab
    switchTab('motifs');
  }

  const activeVersionName = getActiveVersionName();
  const lyricsSubtabsContainerId = activeVersionName === 'original'
    ? 'lyrics-subtabs-container'
    : ('lyrics-subtabs-container-' + activeVersionName);
  const contentLyricsId = activeVersionName === 'original'
    ? 'content-lyrics'
    : ('content-lyrics-' + activeVersionName);

  const activeVersion = document.getElementById('version-' + activeVersionName);
  const lyricsSubtabsContainer = document.getElementById(lyricsSubtabsContainerId);
  const contentLyrics = document.getElementById(contentLyricsId);
  const songLength = activeVersion ? activeVersion.querySelector('.song-length') : null;
  
  if (lyricsSubtabsContainer && contentLyrics && contentLyrics.classList.contains('active')) {
    lyricsSubtabsContainer.classList.add('active');
    if (songLength) songLength.classList.add('hide-border');
  }

  initializeCoverArtistCredits();
  loadSongTextContent();
  initializeSongConnectionsFeature();

  if (versionOrder && versionOrder.length > 0) {
    window.addEventListener('hashchange', () => {
      const versionName = getCurrentHashVersionName() || 'original';
      if (versionConfig[versionName]) {
        switchVersion(versionName, { skipHashUpdate: true });
      }
    });
  }
});

const coverArtists = {
    'aa.png': 'RJ Lake',
    'acs.png': 'angelwinter',
    'aed.png': 'Valerie Halla',
    'aisr.png': 'Braz_OS',
    'aod.png': 'divvydots',
    'aphextwin.jpg': 'Screenshot',
    'as.png': 'REVERIEQUE',
    'atm.jpg': 'Avi Roberts',
    'aw.jpg': 'Remy Boydell',
    'bb.png': 'Sidoopa',
    'bc.jpg': 'REVERIEQUE',
    'bdkt26.png': 'Kurumitsu',
    'bluesky.jpg': 'REVERIEQUE',
    'bs.png': 'REVERIEQUE',
    'bv.png': 'ricedeity',
    'bvcc.png': 'ajihaew',
    'bvi.png': 'ricedeity',
    'cb.jpg': 'ODDEEO',
    'cc.png': 'REVERIEQUE',
    'ccde.png': 'REVERIEQUE',
    'ccdev.jpg': 'REVERIEQUE',
    'ccii.png': 'REVERIEQUE',
    'ccolors.png': 'REVERIEQUE',
    'ccommune.jpg': 'Louie Zong',
    'contentcompanion.jpg': 'Jamie Paige',
    'ccontrepoint.png': 'ajihaew',
    'closer.jpg': 'Jamie Paige',
    'contentcompanion.jpg': 'Andrew Tsai',
    'crmg.jpg': 'FLStudio Screenshot, REVERIEQUE',
    'cs.png': 'Catherine G. Erhlhell',
    'ddiary.png': 'starapture',
    'ddoll.jpg': 'Crispy6usiness',
    'destiny.jpg': 'Bluffy',
    'dgtkchop.jpg': 'Twitter Screenshot',
    'dnh.png': 'Skaði Kaos',
    'ds2021.jpg': 'REVERIEQUE',
    'ds2024.png': 'BUNBUN © CFM',
    'ds2026.jpg': 'koharayuyu',
    'dsc2021.jpg': 'のう',
    'dsc2025.jpg': 'lack',
    'ebi.jpg': 'Jamie Paige',
    'ebiquaver.png': 'starapture',
    'encore.jpg': 'REVERIEQUE',
    'erb.png': 'Arusechika',
    'evilloop.jpg': 'Geoff Keighley',
    'evoevo.jpg': 'John Kafka, GraphersRock',
    'ewz.jpg': 'REVERIEQUE, ricedeity',
    'fire.png': 'angelfaise',
    'ghf.jpg': 'Unknown',
    'glpp.jpg': 'Unknown',
    'gr.jpg': 'kalrot',
    'hc.jpg': 'citruslucy',
    'headass.jpg': 'Unknown',
    'hmt.jpg': 'pipiskulle',
    'human.png': 'insertdisc5',
    "ifhm.jpg": 'FLStudio Screenshot',
    'iwticf.png': 'BEARVAMPS',
    'iwticfpd.png': 'starapture',
    'jpiaw.jpg': 'Unknown',
    'jpjp3.png': 'Jamie Paige',
    'jpjp4.png': 'Jamie Paige',
    'jpjp5.jpg': 'Jamie Paige',
    'jpjp5.png': 'Jamie Paige',
    'jpjp6.png': 'Jamie Paige',
    'liegelord.jpg': 'Synthesizer V Screenshot, Sakauchi Waka',
    'lilpp.jpg': 'BEARVAMPS', // https://bsky.app/profile/bearvamps.bsky.social/post/3m5zriu5lyk2k
    'loll.jpg': 'worm-suggestion',
    'lr.jpg': 'REVERIEQUE',
    'lscorrupted.png': 'REVERIEQUE',
    'lt.jpg': 'haru / oomr005',
    'matryoshka.png': 'milkbean',
    'meltdownww.png': 'Unknown, Twemoji',
    'ml.png': 'REVERIEQUE',
    'mm.png': 'Luciel Ellis',
    'motqddotk.jpg': 'Unknown',
    'mu.png': 'starapture',
    'mushroomfarmer.jpg': 'Logic Pro Screenshot',
    'naomirmx.jpg': 'Unknown',
    'noeulogies.png': 'Michelle Ramos',
    'nothingevercorrupted.png': 'REVERIEQUE',
    'notyet.jpg': 'REVERIEQUE',
    'nqtsc.jpg': 'Ryoko Kui',
    'of.jpg': 'Fourth Strike Records',
    'ofw.jpg': 'Yostar Games',
    'otw.jpg': 'nika37',
    'paisleypudge.png': 'veryeet', // https://x.com/veryeet/status/1584609209454587904
    'pjscpfp.jpg': 'REVERIEQUE',
    'plinkplonk.jpg': 'N/A',
    'pmprr.png': 'monolarkey',
    'ppiiharaylyhssltl.jpg': 'REVERIEQUE',
    'pppp.png': 'REVERIEQUE',
    'ptpt.jpg': 'Enid, friendxp',
    'qov.jpg': 'sferics32',
    'qovcc.png': 'ajihaew',
    'r4c.png': 'ricedeity',
    'rd.jpg': 'pierrotsdoll',
    'rdcc.png': 'ajihaew',
    'ride.jpg': 'LulunaRina',
    'rot.png': '[Brackets124]', // http://bsky.app/profile/brackets124.bsky.social
    'rotjpa.jpg': 'ODDEEO',
    'rr.jpeg': 'vippori',
    'sc.png': 'eggtan',
    'sd.png': 'Cochet',
    'sevenfour.jpg': 'Unknown',
    'sf.png': 'hoshizorelone',
    'sfrr.png': 'ajihaew',
    'sijpr.jpg': 'REVERIEQUE',
    'slurmbrain.jpg': 'Unknown',
    'smots.png': 'SoftySapphie',
    'spaceman': 'The Killers',
    'srid.png': 'nika37',
    'static.jpg': 'ricedeity',
    'su.png': 'Jamie Lee',
    'tb.png': 'starapture',
    'tetoboy.jpg': 'Sasuke Haraguchi',
    'thatsmydad.jpg': 'DALL-E mini',
    'tia.jpg': 'TheRyDesign',
    'tpoc.jpg': 'Unknown',
    'ts26.jpg': 'Kurumitsu',
    'twitter.jpg': 'vippori',
    'vhs.png': 'BEARVAMPS',
    'virtue.jpg': 'Cochet V.',
    'vvff.png': 'retrotenn',
    'vvjp.png': 'retrotenn',
    'wbtc.png': 'Raffums', // https://www.youtube.com/watch?v=U2suj6q_gME
    'wg.jpg': 'ippo.tsk',
    'wgcc.png': 'ajihaew',
    'wscrr.png': 'REVERIEQUE',
    'wtr.jpg': 'Edlinklover',
    'wtrcc.png': 'ajihaew',
    'ww.jpg': 'BEARVAMPS',
    'wwr.jpg': 'kheechuu',
    'wwrcc.png': 'ajihaew',
    'wwunbeatable.png': 'BEARVAMPS'
};

function getCoverArtist(filename) {
  return coverArtists[String(filename || '')] || null;
}

// Expose globally so load.js's populateAlbumPageCoverCredits can use this
// richer dict on pages that load song.js (overrides the load.js IIFE version).
window.getCoverArtist = getCoverArtist;

function formatSongLengthSeconds(totalSeconds) {
  const s = Math.floor(Math.max(0, Number(totalSeconds) || 0));
  const minutes = Math.floor(s / 60);
  const secs = s % 60;
  return minutes + ':' + String(secs).padStart(2, '0');
}

// Called by song-motifs.js after the YouTube player fires onReady with a real
// duration. Updates the visible .song-length paragraph so the user never has
// to type the duration manually. Falls back to whatever is already in the
// element when no YouTube link exists (song-motifs.js never calls this).
window.updateSongLengthFromYoutube = function (totalSeconds) {
  if (!totalSeconds || totalSeconds <= 0) {
    return;
  }

  const text = 'Length: ' + formatSongLengthSeconds(totalSeconds);
  const nodes = Array.from(document.querySelectorAll('.song-length'));

  // Prefer the element that is currently visible (active version).
  const visible = nodes.find((n) => n.offsetParent !== null);
  const target = visible || nodes[0];
  if (target) {
    target.textContent = text;
  }
};

function switchAlbumArt(filename) {
  let albumArtImageId;
  let coverArtistDisplayId;
  let activeVersionElement;

  // Check if version system is in use
  if (versionOrder && versionOrder.length > 0) {
    // Version-based logic
    let activeVersionName = 'original';
    for (const versionName of versionOrder) {
      const versionElement = document.getElementById('version-' + versionName);
      if (versionElement && versionElement.style.display === 'flex') {
        activeVersionName = versionName;
        break;
      }
    }

    // Get the config for the active version
    const config = versionConfig[activeVersionName];
    if (!config) return;

    albumArtImageId = config.albumArtImageId;
    coverArtistDisplayId = config.coverArtistDisplayId;
    activeVersionElement = document.getElementById('version-' + activeVersionName);
  } else {
    // Simple logic for pages without version system
    albumArtImageId = 'album-art-image';
    coverArtistDisplayId = 'cover-artist-display';
    activeVersionElement = document.querySelector('.song-container') || document.body;
  }

  // Update the image source
  const albumArtElement = document.getElementById(albumArtImageId);
  if (albumArtElement) {
    albumArtElement.src = '../../public/images/cover-art/' + filename;
  }

  // Remove active state from all album art tabs in the active version
  if (activeVersionElement) {
    activeVersionElement.querySelectorAll('.album-tab').forEach(el => {
      el.classList.remove('active');
    });
  }

  // Add active state to clicked tab
  if (typeof event !== 'undefined' && event && event.target) {
    event.target.classList.add('active');
  }

  // Update cover artist — keep existing text if the filename isn't in the map
  const coverArtistDisplay = document.getElementById(coverArtistDisplayId);
  if (coverArtistDisplay) {
    const artist = getCoverArtist(filename);
    if (artist !== null) {
      coverArtistDisplay.textContent = artist;
    }
  }
}

// Initialize reference tooltips
function initializeReferences() {
  document.querySelectorAll('.ref-tag').forEach(refTag => {
    if (refTag.dataset.refInitialized === 'true') {
      return;
    }

    const refNum = refTag.getAttribute('data-ref');
    const explicitRefTarget = refTag.getAttribute('data-ref-target');
    const refElement = explicitRefTarget
      ? document.getElementById(explicitRefTarget)
      : document.getElementById('ref-' + refNum);
    
    if (refElement) {
      // Get the text content of the reference (without the back link)
      const refText = refElement.textContent.replace('↑', '').trim();
      // Set the tooltip text
      refTag.setAttribute('data-ref-text', refText);
      refTag.dataset.refInitialized = 'true';
      
      // Add click handler to scroll to reference
      refTag.addEventListener('click', function(e) {
        e.preventDefault();
        refElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // Highlight the reference briefly
        refElement.style.backgroundColor = 'color-mix(in srgb, var(--theme-color-meta_theme_color) 10%, transparent)';
        setTimeout(() => {
          refElement.style.backgroundColor = '';
        }, 2000);
      });
    }
  });
}