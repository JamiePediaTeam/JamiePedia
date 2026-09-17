// Version configuration loaded from HTML data-versions attribute
let versionConfig = {};

// Ordered list of version keys for tab navigation
let versionOrder = [];

let songSidebarRowsPromise = null;
let songHasCloseup = false;
let songCloseupAvailabilityByVersion = {};
const songCloseupAvailabilityBySlug = Object.create(null);
let songCloseupSourceSlugByVersion = {};
const CLOSEUP_TAB_NAME = 'closeup';

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

function getSongRowPathValue(row) {
  return String((row || {}).page_path || (row || {}).path_id || (row || {}).path || '').trim();
}

window.getSongRowPathValue = getSongRowPathValue;

function getSongPathPointer(value) {
  const normalized = normalizeSongRowPath(value);
  const basePath = String(normalized || '').split('#')[0];
  return basePath.split('/').filter(Boolean).pop() || '';
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
  const normalizedRowPath = normalizeSongRowPath(getSongRowPathValue(row));
  const rowPointer = getSongPathPointer(getSongRowPathValue(row));
  if (!normalizedRowPath || !window.SongData || !Array.isArray(window.SongData.allSongs)) {
    return false;
  }

  const match = window.SongData.allSongs.find((song) => {
    const normalizedSongPath = normalizeSongRowPath((song || {}).path || '');
    if (normalizedSongPath === normalizedRowPath) {
      return true;
    }

    const songPointer = getSongPathPointer((song || {}).path || '');
    return !!rowPointer && songPointer === rowPointer;
  });

  return !!String((match || {}).youtubeId || '').trim();
}

function getSongRowsForCurrentPage() {
  const currentPath = normalizeCurrentSongPathForRows();
  const currentPointer = String(currentPath || '').split('/').filter(Boolean).pop() || '';
  const rows = Array.isArray(window.__songSidebarCsvRows) ? window.__songSidebarCsvRows : [];
  if (!currentPath || !rows.length) {
    return [];
  }

  return rows.filter((row) => {
    const normalized = normalizeSongRowPath(getSongRowPathValue(row));
    if (!normalized) {
      return false;
    }

    const basePath = normalized.split('#')[0];
    if (basePath === currentPath) {
      return true;
    }

    const rowPointer = basePath.split('/').filter(Boolean).pop() || '';
    return !!rowPointer && rowPointer === currentPointer;
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
  const rows = Array.isArray(songRows) ? songRows : [];
  if (!rows.length) {
    return [];
  }

  const mainRow = rows.find((row) => String((row || {}).alt_tab || '').trim() === 'Main Tab')
    || rows.find((row) => String((row || {}).alt_tab || '').trim() === 'Nothing')
    || rows.find((row) => {
      const normalized = normalizeSongRowPath(getSongRowPathValue(row));
      return normalized && normalized.indexOf('#') === -1;
    })
    || rows[0]
    || null;

  const mainKey = normalizeSongRowPath(getSongRowPathValue(mainRow));
  const altRows = [];
  const seenAltKeys = new Set();

  rows.forEach((row) => {
    const mode = String((row || {}).alt_tab || '').trim();
    const normalized = normalizeSongRowPath(getSongRowPathValue(row));
    const isMainMode = mode === 'Main Tab' || mode === 'Nothing';
    const isAltMode = mode === 'Alt Tab';
    const isHashVariant = normalized.indexOf('#') !== -1;

    if (!normalized || normalized === mainKey || isMainMode) {
      return;
    }

    if (!isAltMode && !isHashVariant) {
      return;
    }

    if (seenAltKeys.has(normalized)) {
      return;
    }

    seenAltKeys.add(normalized);
    altRows.push(row);
  });

  return mainRow ? [mainRow].concat(altRows) : altRows;
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
    '    <div class="song-info-sidebar"></div>',
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
    '    <button class="song-tab active" onclick="switchTab(\'summary\')" data-song-tab="summary">Summary</button>',
    '    <button class="song-tab" onclick="switchTab(\'lyrics\')" data-song-tab="lyrics">Lyrics</button>',
    '    <button class="song-tab" onclick="switchTab(\'motifs\')" data-song-tab="motifs">Connections</button>',
    '    <button class="song-tab" onclick="switchTab(\'extended\')" data-song-tab="extended">Extended Info</button>',
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

function ensureSongCloseupHostContainers() {
  const versionScopes = versionOrder && versionOrder.length > 0
    ? versionOrder.map((name) => getVersionScope(name)).filter(Boolean)
    : [getVersionScope('original')].filter(Boolean);

  versionScopes.forEach((scope, index) => {
    if (!scope) {
      return;
    }

    const versionName = versionOrder && versionOrder.length > 0 ? versionOrder[index] : 'original';
    const suffix = !versionName || versionName === 'original' ? '' : ('-' + versionName);
    if (scope.querySelector('[id="content-closeup' + suffix + '"]')) {
      return;
    }

    const closeupContent = document.createElement('div');
    closeupContent.id = 'content-closeup' + suffix;
    closeupContent.className = 'song-content song-closeup-content';
    closeupContent.style.display = 'none';
    scope.appendChild(closeupContent);
  });
}

function getCloseupHostForVersion(versionName) {
  const suffix = !versionName || versionName === 'original' ? '' : ('-' + versionName);
  return document.getElementById('content-closeup' + suffix);
}

function setSongCloseupModeEnabled(enabled) {
  const activeVersionName = getActiveVersionName();
  const activeScope = getVersionScope(activeVersionName);
  if (!activeScope) {
    return;
  }

  document.querySelectorAll('.song-container').forEach((scope) => {
    scope.classList.remove('song-closeup-mode');
    const parentBodybar = scope.closest('.bodybar');
    if (parentBodybar) {
      parentBodybar.classList.remove('song-closeup-body-active');
    }
  });

  const leftView = activeScope.querySelector('.song-leftview');
  const rightView = activeScope.querySelector('.song-rightview');
  const regularContents = Array.from(activeScope.querySelectorAll('.song-content')).filter((node) => !node.classList.contains('song-closeup-content'));
  const closeupHost = getCloseupHostForVersion(activeVersionName);

  if (enabled) {
    activeScope.classList.add('song-closeup-mode');
    const bodybar = activeScope.closest('.bodybar');
    if (bodybar) {
      bodybar.classList.add('song-closeup-body-active');
    }

    if (leftView) {
      leftView.style.display = 'none';
    }
    if (rightView) {
      rightView.style.display = 'none';
    }

    regularContents.forEach((node) => {
      node.classList.remove('active');
    });

    if (closeupHost) {
      closeupHost.style.display = 'block';
      closeupHost.classList.add('active');
    }
    return;
  }

  if (leftView) {
    leftView.style.display = '';
  }
  if (rightView) {
    rightView.style.display = '';
  }

  if (closeupHost) {
    closeupHost.classList.remove('active');
    closeupHost.style.display = 'none';
  }
}

async function detectSongCloseupAvailability() {
  const rows = getSongRowsForCurrentPage();
  const mainRow = rows.find((row) => getSongRowPathValue(row).indexOf('#') === -1) || rows[0] || null;
  const slug = mainRow
    ? getSongPathPointer(getSongRowPathValue(mainRow))
    : getCurrentSongSlug();

  if (!slug) {
    songHasCloseup = false;
    return false;
  }

  if (window.JamiePediaCloseup && typeof window.JamiePediaCloseup.hasCloseupForSlug === 'function') {
    songHasCloseup = await window.JamiePediaCloseup.hasCloseupForSlug(slug);
    return songHasCloseup;
  }

  const path = buildPublicTextPath('close ups/text', slug, 'txt').replace('/songs/', '/');
  const responseText = await fetchTextFile(path);
  songHasCloseup = !!responseText;
  return songHasCloseup;
}

function getSongSlugForVersion(versionName) {
  if (versionOrder && versionOrder.length > 0) {
    const config = versionConfig[versionName] || null;
    const rowPath = getSongRowPathValue((config || {}).row || null);
    const normalized = normalizeSongRowPath(rowPath);
    if (normalized) {
      const slug = normalized.replace(/^\/music\//i, '').split('#')[0].trim();
      if (slug) {
        return slug;
      }
    }
  }

  return getCurrentSongSlug();
}

function getVersionCloseupAvailability(versionName) {
  const key = String(versionName || 'original').trim() || 'original';
  return !!songCloseupAvailabilityByVersion[key];
}

async function hasCloseupForSlug(slug) {
  const normalizedSlug = String(slug || '').trim().toLowerCase();
  if (!normalizedSlug) {
    return false;
  }

  if (Object.prototype.hasOwnProperty.call(songCloseupAvailabilityBySlug, normalizedSlug)) {
    return !!songCloseupAvailabilityBySlug[normalizedSlug];
  }

  let available = false;
  if (window.JamiePediaCloseup && typeof window.JamiePediaCloseup.hasCloseupForSlug === 'function') {
    available = await window.JamiePediaCloseup.hasCloseupForSlug(normalizedSlug);
  } else {
    const path = buildPublicTextPath('close ups/text', normalizedSlug, 'txt').replace('/songs/', '/');
    const responseText = await fetchTextFile(path);
    available = !!responseText;
  }

  songCloseupAvailabilityBySlug[normalizedSlug] = !!available;
  return !!available;
}

function normalizeCloseupSlugToken(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\.txt$/i, '')
    .replace(/[#/]+/g, '-')
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function isCloseupEnabledFlag(value) {
  const token = String(value || '').trim().toLowerCase();
  return token === 'true' || token === 'yes' || token === '1';
}

function isCloseupDisabledFlag(value) {
  const token = String(value || '').trim().toLowerCase();
  return token === 'false' || token === 'no' || token === '0' || token === 'none' || token === 'n/a' || token === 'na';
}

function getVersionRowCloseupRawValue(row) {
  if (!row || typeof row !== 'object') {
    return '';
  }

  return String(
    row.close_up
    || row['close up']
    || row['Close Up']
    || row.closeup
    || row['closeup']
    || ''
  ).trim();
}

function getSongIdSlugFromRow(row) {
  if (!row || typeof row !== 'object') {
    return '';
  }

  const rawSongId = String(row.song_id || row['song id'] || row['Song ID'] || '').trim();
  if (!rawSongId) {
    return '';
  }

  return normalizeCloseupSlugToken(rawSongId);
}

function getCloseupSlugCandidatesForVersion(versionName) {
  const config = versionConfig[versionName] || versionConfig.original || null;
  const row = config && config.row ? config.row : null;
  const pagePath = normalizeSongRowPath(getSongRowPathValue(row));
  const baseSlug = normalizeCloseupSlugToken(pagePath.replace(/^\/music\//i, '').split('#')[0]);
  const hashToken = normalizeVersionHashToken((pagePath.split('#')[1] || '').trim());
  const closeupField = getVersionRowCloseupRawValue(row);
  const songIdSlug = getSongIdSlugFromRow(row);

  const candidates = [];
  const addCandidate = (value) => {
    const token = normalizeCloseupSlugToken(value);
    if (!token || candidates.includes(token)) {
      return;
    }
    candidates.push(token);
  };

  if (versionName === 'original') {
    addCandidate(baseSlug || getCurrentSongSlug());
    return candidates;
  }

  // Alternate versions should only expose Close-Up when they define a dedicated
  // source, or explicitly opt in to using the base song close-up.
  if (isCloseupDisabledFlag(closeupField)) {
    return [];
  }

  if (closeupField) {
    if (isCloseupEnabledFlag(closeupField)) {
      addCandidate(baseSlug || getCurrentSongSlug());
    } else {
      addCandidate(closeupField);
    }
  }

  if (baseSlug && hashToken) {
    addCandidate(baseSlug + '-' + hashToken);
  }
  addCandidate(songIdSlug);
  return candidates;
}

async function resolveCloseupSlugForVersion(versionName) {
  const candidates = getCloseupSlugCandidatesForVersion(versionName);
  for (const candidate of candidates) {
    const exists = await hasCloseupForSlug(candidate);
    if (exists) {
      return candidate;
    }
  }

  return '';
}

async function detectSongCloseupAvailabilityByVersion() {
  const nextAvailability = {};
  const nextSources = {};
  const names = (versionOrder && versionOrder.length > 0) ? versionOrder : ['original'];

  for (const versionName of names) {
    const closeupSlug = await resolveCloseupSlugForVersion(versionName);
    nextSources[versionName] = closeupSlug;
    nextAvailability[versionName] = !!closeupSlug;
  }

  songCloseupAvailabilityByVersion = nextAvailability;
  songCloseupSourceSlugByVersion = nextSources;
  songHasCloseup = Object.values(nextAvailability).some(Boolean);
  return songHasCloseup;
}

async function renderCloseupForSongVersion(versionName) {
  const host = getCloseupHostForVersion(versionName);
  if (!host) {
    return false;
  }

  const slug = String(songCloseupSourceSlugByVersion[versionName] || '').trim();

  if (!slug || !window.JamiePediaCloseup || typeof window.JamiePediaCloseup.renderIntoContainer !== 'function') {
    host.innerHTML = makeEmptyBoxHtml('close-up');
    return false;
  }

  const renderResult = await window.JamiePediaCloseup.renderIntoContainer(host, slug, {
    applyTheme: false,
    setDocumentTitle: false,
    includeHeader: true,
    includeBackLink: false,
    showNotFound: false
  });

  if (!renderResult || !renderResult.found) {
    host.innerHTML = makeEmptyBoxHtml('close-up');
    return false;
  }

  host.classList.add('closeup-inline-host');
  return true;
}

function ensureCloseupTabButton(versionName) {
  const activeVersionName = String(versionName || getActiveVersionName() || 'original').trim() || 'original';
  const shouldShow = getVersionCloseupAvailability(activeVersionName);
  const tabsContainers = Array.from(document.querySelectorAll('.song-tabs'));
  tabsContainers.forEach((tabsContainer) => {
    const existing = tabsContainer.querySelector('.song-tab[data-song-tab="closeup"]');
    if (shouldShow) {
      if (existing) {
        return;
      }

      const closeupTab = document.createElement('button');
      closeupTab.className = 'song-tab';
      closeupTab.type = 'button';
      closeupTab.setAttribute('data-song-tab', 'closeup');
      closeupTab.setAttribute('onclick', "switchTab('closeup')");
      closeupTab.textContent = 'Close-Up';

      const spacer = tabsContainer.querySelector('.tabs-spacer');
      if (spacer) {
        tabsContainer.insertBefore(closeupTab, spacer);
      } else {
        tabsContainer.appendChild(closeupTab);
      }
      return;
    }

    if (existing) {
      existing.remove();
    }
  });

  const activeTab = getActiveMainTabName();
  if (!shouldShow && activeTab === CLOSEUP_TAB_NAME) {
    switchTab('motifs');
  }

  // Keep content tabs grouped on the left of the spacer after runtime changes.
  reorderSongTabs();
}

const VERSION_SELECTOR_ALT_DROPDOWN_THRESHOLD = 2;

function closeAllVersionDropdownMenus() {
  document.querySelectorAll('.version-dropdown').forEach((dropdown) => {
    dropdown.classList.remove('open');
    const trigger = dropdown.querySelector('.version-dropdown-trigger');
    const menu = dropdown.querySelector('.version-dropdown-menu');
    if (menu) {
      menu.hidden = true;
    }
    if (trigger) {
      trigger.setAttribute('aria-expanded', 'false');
    }
  });
}

function updateVersionDropdownActiveState(versionName) {
  document.querySelectorAll('.version-dropdown').forEach((dropdown) => {
    const triggerLabel = dropdown.querySelector('.version-dropdown-label');
    const items = Array.from(dropdown.querySelectorAll('.version-dropdown-item'));
    let activeLabel = '';

    items.forEach((item) => {
      const itemVersionName = String(item.getAttribute('data-version-name') || '').trim();
      const isActive = itemVersionName === versionName;
      item.classList.toggle('active', isActive);
      item.setAttribute('aria-selected', isActive ? 'true' : 'false');
      if (isActive) {
        activeLabel = String(item.textContent || '').trim();
      }
    });

    if (triggerLabel && activeLabel) {
      triggerLabel.textContent = activeLabel;
    }
  });
}

function installVersionDropdownGlobalHandlers() {
  if (window.__songVersionDropdownGlobalHandlersInstalled) {
    return;
  }

  window.__songVersionDropdownGlobalHandlersInstalled = true;

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (target && target.closest && target.closest('.version-dropdown')) {
      return;
    }
    closeAllVersionDropdownMenus();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeAllVersionDropdownMenus();
    }
  });
}

function createVersionDropdown(versionRows) {
  const wrapper = document.createElement('div');
  wrapper.className = 'version-dropdown';

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'version-dropdown-trigger';
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');

  const label = document.createElement('span');
  label.className = 'version-dropdown-label';
  label.textContent = String((versionRows[0] || {}).tab_name || '').trim() || 'Original';

  const chevron = document.createElement('span');
  chevron.className = 'version-dropdown-chevron';
  chevron.setAttribute('aria-hidden', 'true');

  trigger.appendChild(label);
  trigger.appendChild(chevron);

  const menu = document.createElement('div');
  menu.className = 'version-dropdown-menu';
  menu.setAttribute('role', 'listbox');
  menu.hidden = true;

  versionRows.forEach((row, index) => {
    const versionName = versionOrder[index];
    if (!versionName) {
      return;
    }

    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'version-dropdown-item' + (index === 0 ? ' active' : '');
    item.setAttribute('role', 'option');
    item.setAttribute('aria-selected', index === 0 ? 'true' : 'false');
    item.setAttribute('data-version-name', versionName);
    item.textContent = String((row || {}).tab_name || '').trim() || versionName;
    item.addEventListener('click', () => {
      switchVersion(versionName);
      closeAllVersionDropdownMenus();
    });

    menu.appendChild(item);
  });

  trigger.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    const isOpen = wrapper.classList.contains('open');
    closeAllVersionDropdownMenus();
    if (!isOpen) {
      wrapper.classList.add('open');
      menu.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
      return;
    }

    wrapper.classList.remove('open');
    menu.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
  });

  wrapper.addEventListener('click', (event) => {
    event.stopPropagation();
  });

  wrapper.appendChild(trigger);
  wrapper.appendChild(menu);
  return wrapper;
}

function renderVersionTabsFromRows(songRows) {
  const versionRows = getVersionRows(songRows);
  const altCount = Math.max(0, versionRows.length - 1);
  const shouldUseDropdown = altCount > VERSION_SELECTOR_ALT_DROPDOWN_THRESHOLD;
  const tabsContainers = Array.from(document.querySelectorAll('.song-tabs'));
  if (!tabsContainers.length) {
    return;
  }

  tabsContainers.forEach((tabsContainer) => {
    Array.from(tabsContainer.querySelectorAll('.version-tab')).forEach((button) => button.remove());
    Array.from(tabsContainer.querySelectorAll('.version-dropdown')).forEach((dropdown) => dropdown.remove());

    if (versionRows.length <= 1) {
      return;
    }

    const spacer = tabsContainer.querySelector('.tabs-spacer');
    const insertBeforeNode = spacer ? spacer.nextSibling : null;

    if (shouldUseDropdown) {
      const dropdown = createVersionDropdown(versionRows);
      if (insertBeforeNode) {
        tabsContainer.insertBefore(dropdown, insertBeforeNode);
      } else {
        tabsContainer.appendChild(dropdown);
      }
      installVersionDropdownGlobalHandlers();
      return;
    }

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

  const orderedRows = versionRows;

  versionOrder.forEach((versionName, index) => {
    const row = orderedRows[index] || null;
    const albumArtPaths = splitSongDataValues((row || {}).album_art_paths || '');
    const normalizedPagePath = getSongRowPathValue(row);
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

function isCloseupSectionHash(value) {
  const normalized = String(value || '')
    .trim()
    .replace(/^#/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

  return normalized === 'closeup';
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

function getActiveSongPageRow() {
  if (versionOrder && versionOrder.length > 0) {
    const activeVersionName = getActiveVersionName();
    const config = versionConfig[activeVersionName] || versionConfig.original || null;
    if (config && config.row) {
      return config.row;
    }
  }

  const rows = getSongRowsForCurrentPage();
  if (!rows.length) {
    return null;
  }

  return rows.find((row) => getSongRowPathValue(row).indexOf('#') === -1) || rows[0] || null;
}

window.getActiveSongPageRow = getActiveSongPageRow;

function getActiveMainTabName() {
  const activeTab = document.querySelector('.song-tab.active');
  if (!activeTab) {
    return 'motifs';
  }

  const tabKey = String(activeTab.getAttribute('data-song-tab') || '').trim().toLowerCase();
  if (tabKey === CLOSEUP_TAB_NAME) {
    return CLOSEUP_TAB_NAME;
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
    const labels = splitSongDataValues(row.album_tab_labels || '').map((label) => String(label || '').trim());
    const hasAnyLabel = labels.some(Boolean);
    const rowArtPaths = splitSongDataValues(row.album_art_paths || '');
    const fallbackArt = getFallbackCoverArtFilename();
    const artPaths = rowArtPaths.length ? rowArtPaths : (fallbackArt ? [fallbackArt] : []);
    const albumTabsContainer = scope.querySelector('.album-tabs-container');
    albumTabs.innerHTML = '';

    if (albumTabsContainer) {
      albumTabsContainer.style.display = hasAnyLabel ? '' : 'none';
    }

    if (hasAnyLabel) {
      artPaths.forEach((artPath, index) => {
        const button = document.createElement('button');
        button.className = 'album-tab' + (index === 0 ? ' active' : '');
        button.textContent = labels[index] || labels[0] || '';
        button.addEventListener('click', function () {
          applyAlbumArtToScope(scope, artPath, button);
        });
        albumTabs.appendChild(button);
      });
    }

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

  const baseRow = rows.find((row) => getSongRowPathValue(row).indexOf('#') === -1) || rows[0];
  renderSongPresentationIntoScope(getVersionScope('original'), baseRow);
}

function getSongTitleForDocument(row) {
  const raw = String((row || {}).page_title || '').trim();
  if (!raw) {
    return '';
  }

  return splitSongDataValues(raw).join(' ') || raw;
}

function applySongDocumentState(row, themeIdOverride) {
  if (!row || typeof row !== 'object') {
    return;
  }

  const pageTitle = getSongTitleForDocument(row);
  if (pageTitle) {
    document.title = pageTitle;

    const titleMeta = document.querySelector('meta[name="title"]');
    if (titleMeta) {
      titleMeta.setAttribute('content', pageTitle);
    }

    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) {
      ogTitle.setAttribute('content', pageTitle);
    }

    const twitterTitle = document.querySelector('meta[property="twitter:title"]');
    if (twitterTitle) {
      twitterTitle.setAttribute('content', pageTitle);
    }
  }

  const themeId = String(themeIdOverride || row.version_theme || row.theme || '').trim();
  if (!themeId) {
    return;
  }

  if (typeof window.applyThemeById === 'function') {
    window.applyThemeById(themeId);
  } else {
    document.documentElement.setAttribute('data-theme-id', themeId);
  }
}

function syncSongDocumentStateToActiveVersion() {
  if (versionOrder && versionOrder.length > 0) {
    const activeVersionName = getActiveVersionName();
    const config = versionConfig[activeVersionName] || versionConfig.original || null;
    if (config && config.row) {
      applySongDocumentState(config.row, config.theme);
    }
    return;
  }

  const rows = getSongRowsForCurrentPage();
  if (!rows.length) {
    return;
  }

  const baseRow = rows.find((row) => getSongRowPathValue(row).indexOf('#') === -1) || rows[0];
  if (baseRow) {
    applySongDocumentState(baseRow);
  }
}

function refreshSongRowDependentUi() {
  if (typeof window.initializeSongSidebarData === 'function') {
    window.initializeSongSidebarData();
  }

  if (typeof window.initializeTracklistSidebar === 'function') {
    window.initializeTracklistSidebar();
  }

  if (typeof window.initializeDataNavButtons === 'function') {
    window.initializeDataNavButtons();
  }
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
  updateVersionDropdownActiveState(versionName);
  closeAllVersionDropdownMenus();
  
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
  updateVersionDropdownActiveState(versionName);

  ensureCloseupTabButton(versionName);

  if (getVersionCloseupAvailability(versionName)) {
    ensureSongCloseupHostContainers();
    renderCloseupForSongVersion(versionName);
  }

  if (!settings.skipHashUpdate) {
    syncVersionHash(versionName);
  }
  
  // Preserve the current tab when changing versions, defaulting to Connections.
  switchTab(nextTabName || 'motifs');

  syncSongDocumentStateToActiveVersion();
  refreshSongRowDependentUi();
}

window.switchVersion = switchVersion;


function switchTab(tabName) {
  const normalizedTabName = String(tabName || '').trim().toLowerCase();
  const isCloseupTab = normalizedTabName === CLOSEUP_TAB_NAME;
  const activeVersionName = getActiveVersionName();

  if (isCloseupTab && !getVersionCloseupAvailability(activeVersionName)) {
    if (isCloseupSectionHash(window.location.hash)) {
      syncVersionHash(activeVersionName);
    }
    switchTab('motifs');
    return;
  }

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
  if (contentElement && !isCloseupTab) {
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

  setSongCloseupModeEnabled(isCloseupTab);

  if (isCloseupTab) {
    renderCloseupForSongVersion(activeVersionName);
    if (lyricsSubtabsContainer) {
      lyricsSubtabsContainer.classList.remove('active');
    }
    if (songLength) {
      songLength.classList.remove('hide-border');
    }
    return;
  }
  
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

window.switchTab = switchTab;

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
    const closeupTab = tabs.find((button) => String(button.getAttribute('data-song-tab') || '').trim().toLowerCase() === CLOSEUP_TAB_NAME);
    const orderedTabs = [byName.motifs, byName.summary, byName.lyrics, byName.extended, closeupTab].filter(Boolean);

    orderedTabs.forEach((button) => {
      tabsContainer.appendChild(button);
    });

    if (spacer) {
      tabsContainer.appendChild(spacer);
    }

    Array.from(tabsContainer.querySelectorAll('.version-tab')).forEach((button) => {
      tabsContainer.appendChild(button);
    });

    Array.from(tabsContainer.querySelectorAll('.version-dropdown')).forEach((dropdown) => {
      tabsContainer.appendChild(dropdown);
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

window.switchLyricsTab = switchLyricsTab;

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
    const targetSrc = String(src || '').trim();
    if (!targetSrc) {
      resolve();
      return;
    }

    let absoluteTargetSrc = '';
    try {
      absoluteTargetSrc = new URL(targetSrc, window.location.href).href;
    } catch (_error) {
      absoluteTargetSrc = targetSrc;
    }

    const existing = Array.from(document.querySelectorAll('script[src]')).find((scriptTag) => {
      const candidateSrc = String(scriptTag.getAttribute('src') || '').trim();
      if (!candidateSrc) {
        return false;
      }

      if (candidateSrc === targetSrc) {
        return true;
      }

      try {
        return new URL(candidateSrc, window.location.href).href === absoluteTargetSrc;
      } catch (_error) {
        return scriptTag.src === absoluteTargetSrc;
      }
    });

    if (existing) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = targetSrc;
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

  const altMatch = normalizedSuffix.match(/^alt(\d+)$/);
  const versionIndex = altMatch ? Number(altMatch[1]) : -1;
  if (versionIndex >= 0 && Array.isArray(versionOrder) && versionOrder[versionIndex]) {
    const versionName = versionOrder[versionIndex];
    const config = versionConfig[versionName] || {};
    const rowPath = getSongRowPathValue(config.row || null);
    const normalized = normalizeSongRowPath(rowPath);
    if (normalized) {
      const pathIdSlug = normalized.replace(/^\/music\//i, '').split('#')[0].trim();
      if (pathIdSlug) {
        return pathIdSlug;
      }
    }
  }

  return normalizedBase + normalizedSuffix;
}

function buildLyricsSlugForVariant(baseSlug, variantSuffix) {
  const normalizedSuffix = String(variantSuffix || '').trim().toLowerCase();
  const isOriginal = !normalizedSuffix || normalizedSuffix === 'original';
  const altMatch = normalizedSuffix.match(/^alt(\d+)$/);
  const versionIndex = isOriginal ? 0 : (altMatch ? Number(altMatch[1]) : -1);

  if (versionIndex >= 0 && Array.isArray(versionOrder) && versionOrder[versionIndex]) {
    const versionName = versionOrder[versionIndex];
    const config = versionConfig[versionName] || {};
    const rowPath = getSongRowPathValue(config.row || null);
    const normalized = normalizeSongRowPath(rowPath);
    if (normalized) {
      const pathIdSlug = normalized.replace(/^\/music\//i, '').split('#')[0].trim();
      if (pathIdSlug) {
        return pathIdSlug;
      }
    }
  }

  return buildVariantSongSlug(baseSlug, normalizedSuffix);
}

function buildPublicTextPath(folder, slug, extension) {
  if (!slug) {
    return '';
  }
  const folderByType = {
    summaries: 'songs/summaries',
    annotations: 'songs/annotations',
    extended: 'songs/extended',
    lyrics: 'songs/lyrics'
  };
  const mappedFolder = folderByType[folder] || folder;
  return '../../public/' + mappedFolder + '/' + encodeURIComponent(slug) + '.' + extension;
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
  if (typeof window.resolveTxtInternalHref === 'function') {
    return window.resolveTxtInternalHref(url);
  }

  const candidate = String(url || '').trim();
  if (!candidate) {
    return '#';
  }

  if (/^(https?:|mailto:|\/|#|\.\/|\.\.\/)/i.test(candidate)) {
    return candidate.replace(/"/g, '%22');
  }

  return '#';
}

function isExternalMarkdownHref(href) {
  return /^https?:\/\//i.test(String(href || '').trim());
}

function renderMarkdownInline(text) {
  const codeTokens = [];
  const literalTokens = [];
  let html = escapeHtml(text);

  html = html.replace(/\\([\\`*_{}\[\]()#+\-.!>])/g, (_, escapedChar) => {
    const token = '@@LITERALTOKEN' + literalTokens.length + '@@';
    literalTokens.push(escapedChar);
    return token;
  });

  html = html.replace(/`([^`]+)`/g, (_, codeText) => {
    const token = '@@CODETOKEN' + codeTokens.length + '@@';
    codeTokens.push('<code>' + codeText + '</code>');
    return token;
  });

  html = html
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/_([^_]+)_/g, '<em>$1</em>');

  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => {
    const href = sanitizeMarkdownUrl(url);
    const isExternal = isExternalMarkdownHref(href);
    const attrs = isExternal
      ? ' class="txt-external-link" target="_blank" rel="noopener noreferrer"'
      : '';
    const glyph = isExternal
      ? '<span class="txt-external-link-glyph" aria-hidden="true">↗</span>'
      : '';
    return '<a href="' + href + '"' + attrs + '>' + label + glyph + '</a>';
  });

  html = html.replace(/@@LITERALTOKEN(\d+)@@/g, (_, index) => escapeHtml(literalTokens[Number(index)] || ''));
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

function songLyricsFallbackParseOffsetSeconds(text) {
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

function songLyricsFallbackParseRawLines(text) {
  const lines = String(text || '').split(/\r?\n/);
  const timedEntries = [];
  const offsetSeconds = songLyricsFallbackParseOffsetSeconds(text);

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
        time: songLyricsFallbackParseTimestamp(stamp) + offsetSeconds,
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

  const linkIndexTask = typeof window.ensureTxtInternalLinkIndexLoaded === 'function'
    ? window.ensureTxtInternalLinkIndexLoaded().catch(() => null)
    : Promise.resolve();

  const textCache = new Map();
  const fetchScopedText = (folder, slug, extension) => {
    const key = folder + '|' + slug + '|' + extension;
    if (!textCache.has(key)) {
      const path = buildPublicTextPath(folder, slug, extension);
      textCache.set(key, fetchTextFile(path));
    }
    return textCache.get(key);
  };

  const summaryTasks = linkIndexTask.then(() => {
    return Array.from(document.querySelectorAll('[id^="content-summary"]')).map((container) => {
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
  });

  const extendedTasks = linkIndexTask.then(() => {
    return Array.from(document.querySelectorAll('[id^="content-extended"]')).map((container) => {
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
  });

  const annotatedTasks = Array.from(document.querySelectorAll('[id^="lyrics-annotated"]')).map((container) => {
    const variantSuffix = getContainerVariantSuffix(container.id, 'lyrics-annotated');
    const scopedSlug = buildVariantSongSlug(baseSlug, variantSuffix);
    const lyricsSlug = buildLyricsSlugForVariant(baseSlug, variantSuffix);
    return fetchScopedText('annotations', scopedSlug, 'txt').then((annotationsText) => {
      if (!annotationsText) {
        return fetchScopedText('lyrics', lyricsSlug, 'lrc').then((lrcText) => {
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

  return Promise.all([
    summaryTasks.then((tasks) => Promise.all(tasks)),
    extendedTasks.then((tasks) => Promise.all(tasks)),
    Promise.all(annotatedTasks)
  ]).then(() => {
    initializeReferences();
  });
}

function initializeSongConnectionsFeature() {
  if (window.__songConnectionsInitPromise) {
    return window.__songConnectionsInitPromise;
  }

  const prefix = '../../';

  window.__songConnectionsInitPromise = loadScriptOnce('https://www.youtube.com/iframe_api')
    .then(() => loadScriptOnce(prefix + 'assets/static/csv-data.js'))
    .then(() => loadScriptOnce(prefix + 'assets/static/song-lyrics.js'))
    .then(() => loadScriptOnce(prefix + 'assets/static/song-motifs.js?v=20260917a'));

  return window.__songConnectionsInitPromise;
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

const coverArtistCsvPath = '../../public/csv/JamiePedia Data - Cover Artists.csv';
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

function initializeSongPage() {
  Promise.all([ensureCoverArtistsLoaded(), ensureSongSidebarRowsLoaded(), loadScriptOnce('../../assets/static/closeup-page.js?v=20260917c')]).finally(async () => {
    const songRows = getSongRowsForCurrentPage();
    buildSongMainColShell(songRows);
    loadVersionConfig(songRows);
    removeRawLyricsUi();

    await detectSongCloseupAvailabilityByVersion();
    ensureCloseupTabButton('original');
    ensureSongCloseupHostContainers();

    renderVersionTabsFromRows(songRows);
    reorderSongTabs();
    renderSongPagePresentation();

    const hashVersionName = getCurrentHashVersionName();
    if (hashVersionName && versionConfig[hashVersionName]) {
      switchVersion(hashVersionName, { skipHashUpdate: true, preserveTab: false });
    } else {
      // Load connections as default tab
      switchTab('motifs');
      syncSongDocumentStateToActiveVersion();
    }

    // song.js now rebuilds .song-main-col at runtime; rehydrate sidebar fields
    // after that render pass so load.js's earlier DOMContentLoaded injection
    // cannot be lost due to replacement.
    refreshSongRowDependentUi();

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
    const textLoadTask = loadSongTextContent();
    const connectionsLoadTask = initializeSongConnectionsFeature();
    await Promise.all([textLoadTask, connectionsLoadTask]);

    if (isCloseupSectionHash(window.location.hash)) {
      switchTab(CLOSEUP_TAB_NAME);
    }

    window.addEventListener('hashchange', () => {
      if (isCloseupSectionHash(window.location.hash)) {
        switchTab(CLOSEUP_TAB_NAME);
        return;
      }

      if (versionOrder && versionOrder.length > 0) {
        const versionName = getCurrentHashVersionName() || 'original';
        if (versionConfig[versionName]) {
          switchVersion(versionName, { skipHashUpdate: true });
        }
      }
    });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeSongPage, { once: true });
} else {
  initializeSongPage();
}

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