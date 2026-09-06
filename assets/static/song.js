// Version configuration loaded from HTML data-versions attribute
let versionConfig = {};

// Ordered list of version keys for tab navigation
let versionOrder = [];

let songSidebarRowsPromise = null;

function splitSongDataValues(value) {
  return String(value || '')
    .split(/\s*\|\s*/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function ensureSongSidebarRowsLoaded() {
  if (Array.isArray(window.__songSidebarCsvRows) && window.__songSidebarCsvRows.length > 0) {
    return Promise.resolve(window.__songSidebarCsvRows);
  }

  if (songSidebarRowsPromise) {
    return songSidebarRowsPromise;
  }

  if (typeof ensureSongSidebarCsvLoaded === 'function') {
    songSidebarRowsPromise = new Promise((resolve) => {
      ensureSongSidebarCsvLoaded((rows) => {
        resolve(Array.isArray(rows) ? rows : []);
      });
    });
    return songSidebarRowsPromise;
  }

  songSidebarRowsPromise = Promise.resolve([]);
  return songSidebarRowsPromise;
}

function normalizeCurrentSongPathForRows() {
  if (typeof toExtensionlessPath === 'function') {
    return toExtensionlessPath(window.location.pathname || '');
  }

  return String(window.location.pathname || '')
    .replace(/\/index\.html$/i, '')
    .replace(/\.html$/i, '')
    .replace(/\/$/, '');
}

function normalizeSongRowPath(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    return '';
  }

  if (typeof normalizeSongSidebarPathKey === 'function') {
    return normalizeSongSidebarPathKey(raw);
  }

  const splitIndex = raw.indexOf('#');
  const pathPart = splitIndex === -1 ? raw : raw.slice(0, splitIndex);
  const hashPart = splitIndex === -1 ? '' : raw.slice(splitIndex + 1);
  const prefixed = pathPart.startsWith('/music/') ? pathPart : ('/music/' + pathPart.replace(/^\/+/, ''));
  const normalizedPath = prefixed.replace(/\.html$/i, '').replace(/\/$/, '');
  const normalizedHash = normalizeVersionHashToken(hashPart);
  return normalizedHash ? (normalizedPath + '#' + normalizedHash) : normalizedPath;
}

function songHasEmbedLinkForRow(row) {
  const normalizedRowPath = normalizeSongRowPath((row || {}).page_path || '');
  if (!normalizedRowPath || !window.SongData || !Array.isArray(window.SongData.allSongs)) {
    return false;
  }

  const match = window.SongData.allSongs.find((song) => {
    const normalizedSongPath = normalizeSongRowPath((song || {}).path || '');
    return normalizedSongPath === normalizedRowPath;
  });

  return !!String((match || {}).youtubeId || '').trim();
}

function getSongRowsForCurrentPage() {
  const currentPath = normalizeCurrentSongPathForRows();
  const rows = Array.isArray(window.__songSidebarCsvRows) ? window.__songSidebarCsvRows : [];
  if (!currentPath || !rows.length) {
    return [];
  }

  return rows.filter((row) => {
    const normalized = normalizeSongRowPath((row || {}).page_path || '');
    if (!normalized) {
      return false;
    }

    const basePath = normalized.split('#')[0];
    return basePath === currentPath;
  });
}

function getDeclaredVersionOrder() {
  const containerOrder = Array.from(document.querySelectorAll('.song-container[id^="version-"]'))
    .map((node) => String(node.id || '').replace(/^version-/, '').trim())
    .filter(Boolean);

  if (containerOrder.length) {
    return containerOrder;
  }

  return Array.from(document.querySelectorAll('.version-tab'))
    .map((button) => {
      const onClick = String(button.getAttribute('onclick') || '');
      const match = onClick.match(/switchVersion\((['"])(.*?)\1\)/);
      return match ? String(match[2] || '').trim() : '';
    })
    .filter(Boolean);
}

function getVersionRows(songRows) {
  return (Array.isArray(songRows) ? songRows : []).filter((row) => {
    const mode = String((row || {}).alt_tab || '').trim();
    return mode === 'Main Tab' || mode === 'Alt Tab';
  });
}

function buildInternalVersionOrder(songRows) {
  const versionRows = getVersionRows(songRows);
  if (versionRows.length <= 1) {
    return [];
  }

  return versionRows.map((_, index) => index === 0 ? 'original' : ('alt' + index));
}

function buildSongContainerShellHtml(versionName, isOriginal) {
  const suffix = isOriginal ? '' : ('-' + versionName);
  const idAttr = versionName ? (' id="version-' + versionName + '"') : '';
  const styleAttr = isOriginal || !versionName ? '' : ' style="display: none;"';

  return [
    '<div' + idAttr + ' class="song-container"' + styleAttr + '>',
    '  <div class="song-leftview">',
    '    <h1 class="song-title"></h1>',
    '    <p class="song-length"></p>',
    '    <div id="content-lyrics' + suffix + '" class="song-content active">',
    '      <div id="lyrics-annotated' + suffix + '" class="lyrics-content active"></div>',
    '    </div>',
    '    <div id="content-motifs' + suffix + '" class="song-content"></div>',
    '    <div id="content-summary' + suffix + '" class="song-content"></div>',
    '    <div id="content-extended' + suffix + '" class="song-content"></div>',
    '  </div>',
    '  <div class="song-rightview">',
    '    <div class="album-tabs-container">',
    '      <div class="album-tabs"></div>',
    '    </div>',
    '    <div class="song-cover"></div>',
    '    <div class="cover-art-footer">',
    '      <div class="cover-art-credit">Cover art by: <span id="cover-artist-display' + suffix + '"></span></div>',
    '    </div>',
    '    <div class="song-nav-buttons"></div>',
    '  </div>',
    '</div>'
  ].join('\n');
}

function buildSongMainColShell(songRows) {
  const mainCol = document.querySelector('.song-main-col');
  if (!mainCol) {
    return;
  }

  const versionOrderNames = buildInternalVersionOrder(songRows);
  const hasVersions = versionOrderNames.length > 0;
  const containerHtml = hasVersions
    ? versionOrderNames.map((versionName, index) => buildSongContainerShellHtml(versionName, index === 0)).join('\n')
    : buildSongContainerShellHtml('', true);

  mainCol.innerHTML = [
    '<div class="song-tabs-container">',
    '  <div class="song-tabs">',
    '    <button class="song-tab active" onclick="switchTab(\'summary\')">Summary</button>',
    '    <button class="song-tab" onclick="switchTab(\'lyrics\')">Lyrics</button>',
    '    <button class="song-tab" onclick="switchTab(\'motifs\')">Connections</button>',
    '    <button class="song-tab" onclick="switchTab(\'extended\')">Extended Info</button>',
    '    <div class="tabs-spacer"></div>',
    '  </div>',
    '</div>',
    '<div class="bodybar">',
    '  <div class="version-wrapper">',
         containerHtml,
    '  </div>',
    '</div>'
  ].join('\n');
}

function renderVersionTabsFromRows(songRows) {
  const versionRows = getVersionRows(songRows);
  const tabsContainers = Array.from(document.querySelectorAll('.song-tabs'));
  if (!tabsContainers.length) {
    return;
  }

  tabsContainers.forEach((tabsContainer) => {
    Array.from(tabsContainer.querySelectorAll('.version-tab')).forEach((button) => button.remove());

    if (versionRows.length <= 1) {
      return;
    }

    const spacer = tabsContainer.querySelector('.tabs-spacer');
    const insertBeforeNode = spacer ? spacer.nextSibling : null;

    versionRows.forEach((row, index) => {
      const versionName = versionOrder[index];
      if (!versionName) {
        return;
      }

      const button = document.createElement('button');
      button.className = 'version-tab' + (index === 0 ? ' active' : '');
      button.textContent = String((row || {}).tab_name || '').trim() || versionName;
      button.setAttribute('onclick', "switchVersion('" + versionName + "')");

      if (insertBeforeNode) {
        tabsContainer.insertBefore(button, insertBeforeNode);
      } else {
        tabsContainer.appendChild(button);
      }
    });
  });
}

// Load configuration from HTML data attributes
function loadVersionConfig(songRows) {
  const rows = Array.isArray(songRows) ? songRows : [];
  const versionRows = getVersionRows(rows);

  versionConfig = {};
  versionOrder = buildInternalVersionOrder(rows);

  if (!versionOrder.length) {
    return;
  }

  const baseRow = rows.find((row) => String((row || {}).alt_tab || '').trim() === 'Nothing')
    || rows.find((row) => String((row || {}).alt_tab || '').trim() === 'Main Tab')
    || rows.find((row) => String((row || {}).page_path || '').indexOf('#') === -1)
    || null;
  const orderedRows = versionRows.length > 1 ? versionRows : (baseRow ? [baseRow] : []);

  versionOrder.forEach((versionName, index) => {
    const row = orderedRows[index] || null;
    const albumArtPaths = splitSongDataValues((row || {}).album_art_paths || '');
    const normalizedPagePath = String((row || {}).page_path || '').trim();
    const hashToken = normalizedPagePath.includes('#')
      ? normalizeVersionHashToken(normalizedPagePath.split('#')[1])
      : '';

    versionConfig[versionName] = {
      name: String((row || {}).tab_name || '').trim() || versionName,
      theme: String((row || {}).version_theme || '').trim() || String(document.documentElement.getAttribute('data-theme-id') || 'default').trim() || 'default',
      defaultAlbumArt: albumArtPaths[0] || '',
      hashToken: versionName === 'original' ? '' : hashToken,
      row: row
    };
  });
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
    const hashToken = normalizeVersionHashToken(config.hashToken || '');
    if (token === hashToken || token === nameToken) {
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
  const candidate = normalizeVersionHashToken(config.hashToken || config.name || versionName);
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

function getVersionScope(versionName) {
  if (versionOrder && versionOrder.length > 0) {
    return document.getElementById('version-' + versionName);
  }
  return document.querySelector('.song-container') || document.body;
}

function formatSongTitleHtml(value) {
  return splitSongDataValues(value)
    .map((part) => escapeHtml(part))
    .join('<br>');
}

function buildCoverArtSrc(filename) {
  const trimmed = String(filename || '').trim();
  if (!trimmed) {
    return '';
  }
  return (typeof basePath === 'string' ? basePath : '') + '/public/images/cover-art/' + trimmed;
}

function extractCoverArtFilenameFromUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    return '';
  }

  try {
    const absolute = new URL(raw, window.location.href);
    const pathname = String(absolute.pathname || '');
    const file = pathname.split('/').pop() || '';
    return file.trim();
  } catch (_error) {
    const noQuery = raw.split('?')[0].split('#')[0];
    return (noQuery.split('/').pop() || '').trim();
  }
}

function getFallbackCoverArtFilename() {
  const ogMeta = document.querySelector('meta[property="og:image"]');
  const twitterMeta = document.querySelector('meta[property="twitter:image"], meta[name="twitter:image"]');
  const ogValue = ogMeta ? ogMeta.getAttribute('content') : '';
  const twitterValue = twitterMeta ? twitterMeta.getAttribute('content') : '';

  return extractCoverArtFilenameFromUrl(ogValue) || extractCoverArtFilenameFromUrl(twitterValue);
}

function ensureSongNavContainer(scope) {
  let container = scope.querySelector('.song-nav-buttons');
  if (container) {
    return container;
  }

  const rightView = scope.querySelector('.song-rightview');
  if (!rightView) {
    return null;
  }

  container = document.createElement('div');
  container.className = 'song-nav-buttons';
  rightView.appendChild(container);
  return container;
}

function applyAlbumArtToScope(scope, filename, buttonElement) {
  if (!scope) {
    return;
  }

  const songCover = scope.querySelector('.song-cover');
  if (!songCover) {
    return;
  }

  let image = songCover.querySelector('img');
  if (!image) {
    image = document.createElement('img');
    image.style.width = '100%';
    image.style.height = '100%';
    image.style.objectFit = 'cover';
    image.style.borderRadius = '4px';
    songCover.appendChild(image);
  }

  const src = buildCoverArtSrc(filename);
  if (src) {
    image.src = src;
  }

  const titleText = splitSongDataValues((scope.querySelector('.song-title') || {}).textContent || '').join(' ') || 'Song';
  image.alt = titleText + ' Cover';

  scope.querySelectorAll('.album-tab').forEach((tab) => tab.classList.remove('active'));
  if (buttonElement) {
    buttonElement.classList.add('active');
  }

  const coverArtistDisplay = scope.querySelector('[id^="cover-artist-display"], .cover-art-credit span');
  if (coverArtistDisplay) {
    const artist = getCoverArtist(filename);
    coverArtistDisplay.textContent = artist !== null ? artist : '';
  }
}

function renderSongPresentationIntoScope(scope, row) {
  if (!scope || !row) {
    return;
  }

  const titleElement = scope.querySelector('.song-title');
  if (titleElement) {
    titleElement.innerHTML = formatSongTitleHtml(String(row.page_title || '').trim());
  }

  const songLengthElement = scope.querySelector('.song-length');
  if (songLengthElement) {
    const lengthValue = String(row.song_length || '').trim();
    const hasEmbedLink = songHasEmbedLinkForRow(row);
    const hasManualLength = !hasEmbedLink && lengthValue && lengthValue.toLowerCase() !== 'x';
    songLengthElement.dataset.songLengthSource = hasManualLength ? 'manual' : 'youtube';
    songLengthElement.textContent = hasManualLength ? ('Length: ' + lengthValue) : '';
    songLengthElement.style.display = hasManualLength ? '' : 'none';
  }

  const albumTabs = scope.querySelector('.album-tabs');
  if (albumTabs) {
    const labels = splitSongDataValues(row.album_tab_labels || '');
    const rowArtPaths = splitSongDataValues(row.album_art_paths || '');
    const fallbackArt = getFallbackCoverArtFilename();
    const artPaths = rowArtPaths.length ? rowArtPaths : (fallbackArt ? [fallbackArt] : []);
    albumTabs.innerHTML = '';

    artPaths.forEach((artPath, index) => {
      const button = document.createElement('button');
      button.className = 'album-tab' + (index === 0 ? ' active' : '');
      button.textContent = labels[index] || labels[0] || 'Cover';
      button.addEventListener('click', function () {
        applyAlbumArtToScope(scope, artPath, button);
      });
      albumTabs.appendChild(button);
    });

    if (artPaths[0]) {
      applyAlbumArtToScope(scope, artPaths[0], albumTabs.querySelector('.album-tab'));
    }
  }

  const coverArtistDisplay = scope.querySelector('[id^="cover-artist-display"], .cover-art-credit span');
  if (coverArtistDisplay && !coverArtistDisplay.textContent.trim()) {
    const firstArtPath = splitSongDataValues(row.album_art_paths || '')[0] || '';
    const artist = getCoverArtist(firstArtPath);
    if (artist !== null) {
      coverArtistDisplay.textContent = artist;
    }
  }

  ensureSongNavContainer(scope);
}

function renderSongPagePresentation() {
  const rows = getSongRowsForCurrentPage();
  if (!rows.length) {
    const fallbackRow = {
      page_title: String(document.title || '').trim(),
      song_length: '',
      album_tab_labels: 'Cover',
      album_art_paths: getFallbackCoverArtFilename()
    };
    renderSongPresentationIntoScope(getVersionScope('original'), fallbackRow);
    return;
  }

  if (versionOrder && versionOrder.length > 0) {
    versionOrder.forEach((versionName) => {
      const scope = getVersionScope(versionName);
      const config = versionConfig[versionName] || {};
      renderSongPresentationIntoScope(scope, config.row || null);
    });
    return;
  }

  const baseRow = rows.find((row) => String((row || {}).page_path || '').indexOf('#') === -1) || rows[0];
  renderSongPresentationIntoScope(getVersionScope('original'), baseRow);
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
    renderSongPresentationIntoScope(versionElement, config.row || null);

    // Switch to the version-specific theme so all theme tokens update together.
    const versionThemeId = String(config.theme || '').trim();
    if (typeof window.applyThemeById === 'function') {
      const fallbackThemeId = String(document.documentElement.getAttribute('data-theme-id') || 'default').trim() || 'default';
      window.applyThemeById(versionThemeId || fallbackThemeId);
    } else if (versionThemeId) {
      document.documentElement.setAttribute('data-theme-id', versionThemeId);
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

  if (typeof window.initializeSongSidebarData === 'function') {
    window.initializeSongSidebarData();
  }
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

const coverArtistCsvPath = '../../public/music/JamiePedia Data - Cover Artists.csv';
let coverArtistsByFilename = {};
let coverArtistsLoadPromise = null;

function splitCoverArtistCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current);
  return values.map((value) => String(value || '').trim());
}

function parseCoverArtistCsv(text) {
  const map = {};
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return map;
  }

  const headers = splitCoverArtistCsvLine(lines[0]).map((header) => header.toLowerCase());
  const filenameIndex = headers.indexOf('filename');
  const creditIndex = headers.indexOf('credit');
  if (filenameIndex === -1 || creditIndex === -1) {
    return map;
  }

  for (let index = 1; index < lines.length; index += 1) {
    const values = splitCoverArtistCsvLine(lines[index]);
    const filename = String(values[filenameIndex] || '').trim().toLowerCase();
    const credit = String(values[creditIndex] || '').trim();
    if (!filename || !credit) {
      continue;
    }
    map[filename] = credit;
  }

  return map;
}

function ensureCoverArtistsLoaded() {
  if (coverArtistsLoadPromise) {
    return coverArtistsLoadPromise;
  }

  coverArtistsLoadPromise = fetch(coverArtistCsvPath, { cache: 'no-store' })
    .then((response) => response.ok ? response.text() : '')
    .then((text) => {
      coverArtistsByFilename = parseCoverArtistCsv(text);
    })
    .catch(() => {
      coverArtistsByFilename = {};
    });

  return coverArtistsLoadPromise;
}

function getCoverArtist(filename) {
  const key = String(filename || '').trim().toLowerCase();
  if (!key) {
    return null;
  }
  return coverArtistsByFilename[key] || null;
}

// Expose globally so load.js's populateAlbumPageCoverCredits can use this
// lookup on pages that load song.js.
window.getCoverArtist = getCoverArtist;

document.addEventListener('DOMContentLoaded', function() {
  Promise.all([ensureCoverArtistsLoaded(), ensureSongSidebarRowsLoaded()]).finally(() => {
    const songRows = getSongRowsForCurrentPage();
    buildSongMainColShell(songRows);
    loadVersionConfig(songRows);
    removeRawLyricsUi();
    renderVersionTabsFromRows(songRows);
    reorderSongTabs();
    renderSongPagePresentation();

    const hashVersionName = getCurrentHashVersionName();
    if (hashVersionName && versionConfig[hashVersionName]) {
      switchVersion(hashVersionName, { skipHashUpdate: true });
    } else {
      // Load connections as default tab
      switchTab('motifs');
    }

    // song.js now rebuilds .song-main-col at runtime; rehydrate sidebar fields
    // after that render pass so load.js's earlier DOMContentLoaded injection
    // cannot be lost due to replacement.
    if (typeof window.initializeSongSidebarData === 'function') {
      window.initializeSongSidebarData();
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
});

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
    target.dataset.songLengthSource = 'youtube';
    target.textContent = text;
    target.style.display = '';
  }
};

function switchAlbumArt(filename) {
  const activeVersionElement = versionOrder && versionOrder.length > 0
    ? (Array.from(document.querySelectorAll('.song-container[id^="version-"]')).find((node) => node && node.style.display === 'flex') || document.querySelector('.song-container'))
    : (document.querySelector('.song-container') || document.body);

  const targetButton = (typeof event !== 'undefined' && event && event.target) ? event.target : null;
  applyAlbumArtToScope(activeVersionElement, filename, targetButton);
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