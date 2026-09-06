// Determine base path - detect GitHub Pages subdirectory
const pathname = window.location.pathname;
const basePath = pathname.includes('/JamiePedia/') ? '/JamiePedia' : '';

function stripBasePath(path) {
  let normalized = String(path || '/');
  if (!normalized.startsWith('/')) {
    normalized = '/' + normalized;
  }

  if (basePath && normalized.startsWith(basePath + '/')) {
    return normalized.slice(basePath.length) || '/';
  }

  if (basePath && normalized === basePath) {
    return '/';
  }

  return normalized;
}

function toExtensionlessPath(path) {
  let normalized = stripBasePath(path).split('?')[0].split('#')[0];
  if (!normalized.startsWith('/')) {
    normalized = '/' + normalized;
  }

  if (normalized === '/index.html') {
    return '/';
  }

  normalized = normalized.replace(/\/index\.html$/i, '/');
  normalized = normalized.replace(/\.html$/i, '');

  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }

  return normalized || '/';
}

function withBasePath(path) {
  const normalized = String(path || '/').startsWith('/') ? String(path || '/') : '/' + String(path || '/');
  if (!basePath) {
    return normalized;
  }

  if (normalized === '/') {
    return basePath + '/';
  }

  if (normalized === basePath || normalized.startsWith(basePath + '/')) {
    return normalized;
  }

  return basePath + normalized;
}

function toSiteHref(rawHref) {
  const source = String(rawHref || '').trim();
  if (!source || source.startsWith('#') || /^(mailto:|tel:|javascript:|data:|blob:)/i.test(source)) {
    return source;
  }

  try {
    const absolute = new URL(source, window.location.href);
    if (absolute.origin !== window.location.origin) {
      return source;
    }

    const canonicalPath = withBasePath(toExtensionlessPath(absolute.pathname));
    return canonicalPath + absolute.search + absolute.hash;
  } catch (_error) {
    return source;
  }
}

function normalizeInternalAnchorTargets(root) {
  const scope = root && root.querySelectorAll ? root : document;
  scope.querySelectorAll('a[href]').forEach((anchor) => {
    const originalHref = anchor.getAttribute('href') || '';
    if (!originalHref || originalHref === 'javascript:void(0);') {
      return;
    }

    const normalizedHref = toSiteHref(originalHref);
    if (normalizedHref && normalizedHref !== originalHref) {
      anchor.setAttribute('href', normalizedHref);
    }
  });
}

function canonicalizeCurrentUrl() {
  if (!window.history || typeof window.history.replaceState !== 'function') {
    return;
  }

  const currentHref = window.location.pathname + window.location.search + window.location.hash;
  const canonicalHref = withBasePath(toExtensionlessPath(window.location.pathname)) + window.location.search + window.location.hash;
  if (canonicalHref !== currentHref) {
    window.history.replaceState(null, document.title, canonicalHref);
  }
}

window.toSiteHref = toSiteHref;
window.normalizeInternalAnchorTargets = normalizeInternalAnchorTargets;

function splitThemeCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
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

function parseThemeCsv(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return [];
  }

  const headers = splitThemeCsvLine(lines[0]);
  const rows = [];

  for (let i = 1; i < lines.length; i += 1) {
    const values = splitThemeCsvLine(lines[i]);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    rows.push(row);
  }

  return rows;
}

const themeColumnAliases = {
  surface_deep_black: 'text_base_black',
  text_primary_alt: 'text_primary',
  text_about_body: 'text_primary',
  text_control: 'text_primary',
  text_emphasis: 'text_primary',
  text_heading_dark: 'text_primary',
  text_body: 'text_primary',
  text_body_alt: 'text_primary',
  text_motif_summary: 'text_primary',
  border_dark: 'text_karaoke_next',
  text_tooltip: 'text_karaoke_next',
  text_motif_meta: 'text_karaoke_next',
  text_caption: 'text_karaoke_next',
  text_karaoke_incoming: 'text_transcript_muted',
  text_muted_alt: 'text_muted',
  text_karaoke_previous: 'text_muted',
  border_divider: 'border_segment',
  border_subtle: 'border_segment',
  accent_primary: 'meta_theme_color',
  surface_tint_header: 'background_base',
  surface_panel: 'background_base',
  border_title_rule: 'border_input',
  border_light: 'border_pill',
  border_karaoke_box: 'border_pill',
  border_field: 'border_pill',
  border_code: 'border_pill',
  accent_primary_hover: 'accent_hover',
  border_tooltip_arrow: 'border_pill',
  border_references: 'border_pill',
  surface_progress_rail: 'surface_track',
  surface_soft: 'border_card_soft',
  surface_button: 'border_card_soft',
  surface_control: 'border_card_soft',
  surface_empty_state: 'background_base',
  surface_base: 'background_base'
};

let loadedThemeRows = [];

function findThemeRowById(themeId) {
  const requested = String(themeId || '').trim();
  if (!requested || !Array.isArray(loadedThemeRows) || loadedThemeRows.length === 0) {
    return null;
  }

  return loadedThemeRows.find((row) => String(row.theme_id || '').trim() === requested) || null;
}

function applyThemeRow(themeRow) {
  if (!themeRow || typeof themeRow !== 'object') {
    return;
  }

  const root = document.documentElement;
  const rowValuesByKey = {};
  Object.keys(themeRow).forEach((key) => {
    rowValuesByKey[String(key || '').trim().toLowerCase()] = themeRow[key];
  });

  const normalizeThemeValue = (value) => String(value || '').trim().replace(/^"+|"+$/g, '');
  const resolveThemeKey = (key) => themeColumnAliases[key] || key;
  const toThemeVarKey = (key) => String(key || '').trim().toLowerCase().replace(/\s+/g, '_');
  const toThemeAssetCssValue = (rawValue, assetType) => {
    const value = normalizeThemeValue(rawValue);
    if (!value) {
      return '';
    }

    if (/^url\(/i.test(value)) {
      return value;
    }

    if (/^(https?:|data:|blob:)/i.test(value)) {
      return 'url("' + value.replace(/"/g, '%22') + '")';
    }

    let path = value;
    if (path.startsWith('/')) {
      if (basePath && !path.startsWith(basePath + '/')) {
        path = basePath + path;
      }
      return 'url("' + path.replace(/"/g, '%22') + '")';
    }

    if (assetType === 'background') {
      path = basePath + '/public/images/backgrounds/' + path;
      return 'url("' + path.replace(/"/g, '%22') + '")';
    }

    // Header values can be provided as plain filenames or explicit image paths.
    if (path.includes('/')) {
      path = basePath + '/public/images/' + path;
      return 'url("' + path.replace(/"/g, '%22') + '")';
    }

    path = basePath + '/public/images/headers/' + path;
    return 'url("' + path.replace(/"/g, '%22') + '")';
  };

  const pickThemeValue = (...keys) => {
    for (const key of keys) {
      const resolvedKey = resolveThemeKey(key);
      const value = normalizeThemeValue(rowValuesByKey[String(resolvedKey || '').trim().toLowerCase()]);
      if (value) {
        return value;
      }
    }
    return '';
  };

  const mapping = {
    '--theme-id': pickThemeValue('theme_id'),
    '--theme-name': pickThemeValue('theme_name'),
    '--theme-meta-color': pickThemeValue('meta_theme_color'),
    '--theme-page-background': pickThemeValue('page_background_color', 'surface_base'),
    '--theme-page-text': pickThemeValue('page_text_color', 'text_body_alt', 'text_body'),
    '--theme-link': pickThemeValue('link_color', 'link_default'),
    '--theme-link-hover': pickThemeValue('link_hover_color', 'accent_hover'),
    '--theme-panel-bg': pickThemeValue('panel_background_color', 'surface_panel'),
    '--theme-panel-border': pickThemeValue('panel_border_color', 'brand_frame'),
    '--theme-muted-text': pickThemeValue('muted_text_color', 'text_muted_alt', 'text_muted'),
    '--theme-strong-text': pickThemeValue('strong_text_color', 'text_primary_alt', 'text_primary'),
    '--theme-track-bg': pickThemeValue('track_background_color', 'surface_track'),
    '--theme-empty-bg': pickThemeValue('empty_background_color', 'surface_empty_state'),
    '--theme-empty-border': pickThemeValue('empty_border_color', 'border_empty_state'),
    '--theme-warning': pickThemeValue('warning_color', 'text_error'),
    '--theme-highlight': pickThemeValue('highlight_color', 'surface_highlight'),
    '--theme-tooltip-bg': pickThemeValue('tooltip_background_color', 'surface_base'),
    '--theme-tooltip-border': pickThemeValue('tooltip_border_color', 'border_light')
  };

  Object.entries(mapping).forEach(([name, value]) => {
    if (!value) {
      return;
    }
    root.style.setProperty(name, String(value).trim());
  });

  Object.keys(themeRow).forEach((key) => {
    if (key === 'theme_id' || key === 'theme_name') {
      return;
    }

    const value = normalizeThemeValue(themeRow[key]);
    if (!value) {
      return;
    }

    root.style.setProperty('--theme-color-' + toThemeVarKey(key), value);
  });

  const backgroundCssValue = toThemeAssetCssValue(
    pickThemeValue('background', 'background_image', 'background_image_link', 'page_background_image'),
    'background'
  );
  if (backgroundCssValue) {
    root.style.setProperty('--theme-background-image', backgroundCssValue);
    root.style.backgroundImage = backgroundCssValue;
  }

  const headerCssValue = toThemeAssetCssValue(
    pickThemeValue('header', 'header_image', 'header_image_link', 'logo_image'),
    'header'
  );
  if (headerCssValue) {
    root.style.setProperty('--theme-header-image', headerCssValue);
  }

  Object.keys(themeRow).forEach((key) => {
    if (!key.startsWith('theme_color_')) {
      return;
    }

    const value = String(themeRow[key] || '').trim();
    if (!value) {
      return;
    }

    const colorVar = '--' + key.replace(/^theme_color_/, 'theme-color-').replace(/_/g, '-');
    root.style.setProperty(colorVar, value);
  });

  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme && mapping['--theme-meta-color']) {
    metaTheme.setAttribute('content', mapping['--theme-meta-color']);
  }
}

function applyThemeById(themeId) {
  if (!Array.isArray(loadedThemeRows) || loadedThemeRows.length === 0) {
    return false;
  }

  const selected = findThemeRowById(themeId)
    || findThemeRowById('default')
    || loadedThemeRows[0];

  if (!selected) {
    return false;
  }

  const root = document.documentElement;
  const selectedThemeId = String(selected.theme_id || '').trim();
  if (selectedThemeId) {
    root.setAttribute('data-theme-id', selectedThemeId);
  }

  applyThemeRow(selected);
  return true;
}

window.applyThemeById = applyThemeById;

async function loadThemeFromCsv() {
  const root = document.documentElement;
  const requestedThemeId = String(root.getAttribute('data-theme-id') || 'default').trim() || 'default';
  const csvCandidates = [
    '/public/themes/JamiePedia Data - Themes.csv',
    '/public/themes/themes.csv'
  ];

  try {
    let csvText = '';

    let loadedCsvPath = '';

    for (const csvPath of csvCandidates) {
      const response = await fetch(basePath + csvPath, { cache: 'no-store' });
      if (!response.ok) {
        continue;
      }

      csvText = await response.text();
      if (String(csvText || '').trim()) {
        loadedCsvPath = csvPath;
        break;
      }
    }

    if (!String(csvText || '').trim()) {
      return;
    }

    const rows = parseThemeCsv(csvText);
    if (!rows.length) {
      return;
    }
    loadedThemeRows = rows;

    if (loadedCsvPath) {
      root.setAttribute('data-theme-source', loadedCsvPath);
    }

    applyThemeById(requestedThemeId);
  } catch (_error) {
    // Keep defaults if theme data cannot be fetched.
  }
}

// Load music file paths first, then search functionality
const musicFilesScript = document.createElement('script');
musicFilesScript.src = basePath + '/assets/static/music-files.js';
musicFilesScript.onload = function() {
  const continueLoadingDependentScripts = function () {
  const navOrderScript = document.createElement('script');
  navOrderScript.src = basePath + '/assets/static/nav-order.js';
  navOrderScript.onload = function() {
    if (document.readyState !== 'loading') {
      initializeDataNavButtons();
    }

    const searchScript = document.createElement('script');
    searchScript.src = basePath + '/assets/static/search.js';
    searchScript.onload = function() {
      // Initialize search after navibar loads
      $(function(){
        $("#navi").load(basePath + "/assets/static/navibar.html", function() {
          normalizeInternalAnchorTargets(document.getElementById('navi'));
          if (typeof initializeSearch === 'function') {
            initializeSearch();
          }
        });
        $("#sidebar").load(basePath + "/assets/static/sidebar.html", function() {
          normalizeInternalAnchorTargets(document.getElementById('sidebar'));
          initializeTracklistSidebar();
        });
        $("#linkbox").load(basePath + "/assets/static/linkbox.html", function() {
          normalizeInternalAnchorTargets(document.getElementById('linkbox'));
          // After jQuery loads content, add icons to any new links
          if (typeof addSocialMediaIcons === 'function') {
            addSocialMediaIcons();
          }
        });
      });
    };
    document.head.appendChild(searchScript);
  };
  document.head.appendChild(navOrderScript);
  };

  const readyPromise = typeof window.whenMusicFilePathsReady === 'function'
    ? window.whenMusicFilePathsReady()
    : window.musicFilePathsReadyPromise;

  if (readyPromise && typeof readyPromise.then === 'function') {
    readyPromise.finally(continueLoadingDependentScripts);
  } else {
    continueLoadingDependentScripts();
  }
};
document.head.appendChild(musicFilesScript);

// Load social icons stylesheet
const socialIconsLink = document.createElement('link');
socialIconsLink.rel = 'stylesheet';
socialIconsLink.href = basePath + '/css/social-icons.css';
document.head.appendChild(socialIconsLink);

const themeLink = document.createElement('link');
themeLink.rel = 'stylesheet';
themeLink.href = basePath + '/css/theme.css';
document.head.appendChild(themeLink);

loadThemeFromCsv();

// Load social icons script
const socialIconsScript = document.createElement('script');
socialIconsScript.src = basePath + '/assets/static/social-icons.js';
document.head.appendChild(socialIconsScript);

// Navigate to a song with proper base path
function goToSong(relativePath) {
  window.location.href = toSiteHref(relativePath);
}

function normalizePathForNav(path) {
  return toExtensionlessPath(path);
}

function setNavLinkTarget(element, targetPath) {
  const isAnchor = element.tagName.toLowerCase() === 'a';
  const hasTarget = Boolean(targetPath);

  element.removeAttribute('onclick');

  if (hasTarget) {
    const href = toSiteHref(targetPath);

    if (isAnchor) {
      element.setAttribute('href', href);
    } else {
      element.onclick = function () {
        window.location.href = href;
      };
    }

    element.setAttribute('aria-disabled', 'false');
    element.style.opacity = '';
    element.style.pointerEvents = '';
    return;
  }

  if (isAnchor) {
    element.setAttribute('href', 'javascript:void(0);');
  } else {
    element.onclick = function (event) {
      event.preventDefault();
    };
  }

  element.setAttribute('aria-disabled', 'true');
  element.style.opacity = '0.5';
  element.style.pointerEvents = 'none';
}

function getNavListForPath(currentPath) {
  const navOrder = window.navOrder;
  if (!navOrder) return null;

  if (Array.isArray(navOrder.songs) && navOrder.songs.some((item) => normalizePathForNav(item) === currentPath)) {
    return navOrder.songs;
  }

  if (Array.isArray(navOrder.albums) && navOrder.albums.some((item) => normalizePathForNav(item) === currentPath)) {
    return navOrder.albums;
  }

  if (Array.isArray(navOrder.motifs) && navOrder.motifs.some((item) => normalizePathForNav(item) === currentPath)) {
    return navOrder.motifs;
  }

  return null;
}

function initializeDataNavButtons() {
  const navOrder = window.navOrder;
  if (!navOrder) return;

  const currentPath = normalizePathForNav(window.location.pathname);
  const activeList = getNavListForPath(currentPath);
  if (!activeList) return;

  const currentIndex = activeList.findIndex((item) => normalizePathForNav(item) === currentPath);
  if (currentIndex === -1) return;

  const prevPath = currentIndex > 0 ? activeList[currentIndex - 1] : null;
  const nextPath = currentIndex < activeList.length - 1 ? activeList[currentIndex + 1] : null;

  let containers = Array.from(document.querySelectorAll('.song-nav-buttons, .album-nav-buttons'));

  // Auto-create a container so prev/next is centrally data-driven even when
  // song/album pages no longer hardcode those links in HTML.
  if (containers.length === 0 && (activeList === navOrder.albums || activeList === navOrder.songs)) {
    const isSong = activeList === navOrder.songs;
    const mount = isSong
      ? (document.querySelector('.song-container[id^="version-"][style*="display: flex"] .song-rightview')
        || document.querySelector('.song-container .song-rightview'))
      : document.querySelector('.bodybar');
    if (mount) {
      const container = document.createElement('div');
      container.className = isSong ? 'song-nav-buttons' : 'album-nav-buttons';
      container.innerHTML =
        '<a href="javascript:void(0);" class="' + (isSong ? 'song-nav-link' : 'album-nav-link') + '">← Previous</a>' +
        '<a href="javascript:void(0);" class="' + (isSong ? 'song-nav-link' : 'album-nav-link') + '">Next →</a>';
      mount.appendChild(container);
      containers = [container];
    }
  }

  containers.forEach((container) => {
    let links = Array.from(container.querySelectorAll('a.song-nav-link, button.song-nav-link, a.album-nav-link, button.album-nav-link, a, button'));
    if (links.length < 2) {
      const isSong = activeList === navOrder.songs;
      container.innerHTML =
        '<a href="javascript:void(0);" class="' + (isSong ? 'song-nav-link' : 'album-nav-link') + '">← Previous</a>' +
        '<a href="javascript:void(0);" class="' + (isSong ? 'song-nav-link' : 'album-nav-link') + '">Next →</a>';
      links = Array.from(container.querySelectorAll('a.song-nav-link, button.song-nav-link, a.album-nav-link, button.album-nav-link, a, button'));
    }
    if (links.length < 2) return;

    const prevElement = links.find((el) => /previous|←/i.test(el.textContent || '')) || links[0];
    const nextElement = links.find((el) => /next|→/i.test(el.textContent || '')) || links[1];

    setNavLinkTarget(prevElement, prevPath);
    setNavLinkTarget(nextElement, nextPath);
  });
}

canonicalizeCurrentUrl();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function onReady() {
    normalizeInternalAnchorTargets(document);
  }, { once: true });
} else {
  normalizeInternalAnchorTargets(document);
}

function isProgressiveArtPath(pathname) {
  return pathname.includes('/public/images/cover-art/') || pathname.includes('/public/images/motif-art/');
}

function replaceExtensionWithWebp(pathname) {
  return pathname.replace(/\.[a-z0-9]+$/i, '.webp');
}

function toPreviewPathname(pathname) {
  if (pathname.includes('/public/images/cover-art/')) {
    return replaceExtensionWithWebp(pathname.replace('/public/images/cover-art/', '/public/images/previews/cover-art/'));
  }

  if (pathname.includes('/public/images/motif-art/')) {
    return replaceExtensionWithWebp(pathname.replace('/public/images/motif-art/', '/public/images/previews/motif-art/'));
  }

  return '';
}

function toPreviewUrl(originalSrc) {
  if (!originalSrc) {
    return '';
  }

  try {
    const absolute = new URL(originalSrc, window.location.href);
    if (!isProgressiveArtPath(absolute.pathname)) {
      return '';
    }

    const previewPathname = toPreviewPathname(absolute.pathname);
    if (!previewPathname) {
      return '';
    }

    absolute.pathname = previewPathname;
    absolute.search = '';
    absolute.hash = '';
    return absolute.href;
  } catch (_error) {
    return '';
  }
}

function applyProgressiveArtPreviewToImage(image) {
  if (!image || image.nodeType !== 1 || image.tagName !== 'IMG') {
    return;
  }

  const currentSrc = image.getAttribute('src') || '';
  const managedHqSrc = image.dataset.previewManagedHqSrc || '';
  const managedPreviewSrc = image.dataset.previewManagedPreviewSrc || '';

  if (managedHqSrc) {
    if (currentSrc === managedHqSrc || currentSrc === managedPreviewSrc) {
      return;
    }

    image.dataset.previewManagedHqSrc = '';
    image.dataset.previewManagedPreviewSrc = '';
  }

  const originalSrc = currentSrc;
  const previewSrc = toPreviewUrl(originalSrc);
  if (!previewSrc) {
    return;
  }

  image.dataset.previewManagedHqSrc = originalSrc;
  image.dataset.previewManagedPreviewSrc = previewSrc;

  const previewProbe = new Image();
  previewProbe.onload = function () {
    if (image.dataset.previewManagedHqSrc !== originalSrc) {
      return;
    }

    image.src = previewSrc;

    const highQualityProbe = new Image();
    highQualityProbe.onload = function () {
      if (image.dataset.previewManagedHqSrc !== originalSrc) {
        return;
      }

      image.src = originalSrc;
    };
    highQualityProbe.src = originalSrc;
  };
  previewProbe.src = previewSrc;
}

function applyProgressiveArtPreviews(rootNode) {
  const root = rootNode && rootNode.nodeType === 1 ? rootNode : document;

  if (root.tagName === 'IMG') {
    applyProgressiveArtPreviewToImage(root);
    return;
  }

  const images = root.querySelectorAll ? root.querySelectorAll('img') : [];
  images.forEach((image) => {
    applyProgressiveArtPreviewToImage(image);
  });
}

function installProgressiveArtObserver() {
  if (window.__jamiePediaProgressiveArtObserverInstalled) {
    return;
  }

  window.__jamiePediaProgressiveArtObserverInstalled = true;
  applyProgressiveArtPreviews(document);

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          applyProgressiveArtPreviews(node);
        });
      }

      if (mutation.type === 'attributes' && mutation.target && mutation.target.tagName === 'IMG') {
        applyProgressiveArtPreviewToImage(mutation.target);
      }
    });
  });

  const observeRoot = document.body || document.documentElement;
  if (!observeRoot) {
    document.addEventListener('DOMContentLoaded', installProgressiveArtObserver, { once: true });
    return;
  }

  observer.observe(observeRoot, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src']
  });
}

installProgressiveArtObserver();

// The coverArtists dict lives in song.js for song pages. For album index pages
// (which don't load song.js) we provide the same lookup via an IIFE so there is
// no global const that would conflict with song.js's own const coverArtists.
window.getCoverArtist = (function () {
  const artists = {
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
    'dsc2021.jpg': 'Nou',
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
    'ifhm.jpg': 'FLStudio Screenshot',
    'iwticf.png': 'BEARVAMPS',
    'iwticfpd.png': 'starapture',
    'jpiaw.jpg': 'Unknown',
    'jpjp3.png': 'Jamie Paige',
    'jpjp4.png': 'Jamie Paige',
    'jpjp5.jpg': 'Jamie Paige',
    'jpjp5.png': 'Jamie Paige',
    'jpjp6.png': 'Jamie Paige',
    'liegelord.jpg': 'Synthesizer V Screenshot, Sakauchi Waka',
    'lilpp.jpg': 'BEARVAMPS',
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
    'paisleypudge.png': 'veryeet',
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
    'wbtc.png': 'Raffums',
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
  return function (filename) {
    return artists[String(filename || '')] || null;
  };
})();

function populateAlbumPageCoverCredits() {
  document.querySelectorAll('.album-cover-credit').forEach(function (creditEl) {
    const container = creditEl.closest('.album-cover-container');
    if (!container) {
      return;
    }

    const img = container.querySelector('img');
    if (!img) {
      return;
    }

    const filename = String(img.getAttribute('src') || '').split('/').pop();
    const artist = getCoverArtist(filename);
    if (artist) {
      creditEl.textContent = 'Artwork by ' + artist;
    }
  });
}

document.addEventListener('DOMContentLoaded', function () {
  initializeDataNavButtons();
  populateAlbumPageCoverCredits();
  initializeAlbumSongListFromCsv();
  initializeAlbumSummary();
  initializeSongSidebarData();
});

function splitCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
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

const songSidebarHeaderAliases = {
  page_path: ['page_path', 'path'],
  page_title: ['page_title', 'page title'],
  version_theme: ['version_theme', 'theme'],
  song_length: ['song_length', 'song length'],
  alt_tab: ['alt_tab', 'alt tab status?'],
  tab_name: ['tab_name', 'alt tab name'],
  album_id: ['album_id'],
  album_track: ['album_track', 'track number'],
  album_art_paths: ['album_art_paths', 'album path', 'album art'],
  album_tab_labels: ['album_tab_labels', 'cover art labels'],
  appears_on: ['appears_on', 'appears on text'],
  appears_on_enabled: ['appears_on_enabled'],
  release_date: ['release_date', 'release date'],
  release_date_enabled: ['release_date_enabled'],
  artists: ['artists'],
  artists_enabled: ['artists_enabled'],
  vocalists: ['vocalists'],
  vocalists_enabled: ['vocalists_enabled'],
  listen_text: ['listen_text', 'listen text'],
  listen_links: ['listen_links', 'listen links'],
  listen_enabled: ['listen_enabled'],
  close_up: ['close_up', 'close up'],
  close_up_enabled: ['close_up_enabled']
};

function normalizeSongSidebarHeader(header) {
  const key = String(header || '').trim().toLowerCase();
  if (!key) {
    return '';
  }

  for (const canonicalKey of Object.keys(songSidebarHeaderAliases)) {
    const aliases = songSidebarHeaderAliases[canonicalKey] || [];
    if (aliases.includes(key)) {
      return canonicalKey;
    }
  }

  return String(header || '').trim();
}

function parseSongSidebarCsv(text) {
  const rows = [];
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return rows;
  }

  const headers = splitCsvLine(lines[0]);
  const normalizedHeaders = headers.map((header) => normalizeSongSidebarHeader(header));
  for (let index = 1; index < lines.length; index += 1) {
    const values = splitCsvLine(lines[index]);
    const row = {};
    normalizedHeaders.forEach((header, headerIndex) => {
      if (!header) {
        return;
      }
      row[header] = values[headerIndex] || '';
    });
    if (Object.keys(row).length > 0) {
      rows.push(row);
    }
  }

  return rows;
}

function isSongSidebarCsvLoaded() {
  return Array.isArray(window.__songSidebarCsvRows) && window.__songSidebarCsvRows.length > 0;
}

function ensureSongSidebarCsvLoaded(onReady) {
  if (isSongSidebarCsvLoaded()) {
    if (typeof onReady === 'function') {
      onReady(window.__songSidebarCsvRows);
    }
    return;
  }

  fetch(basePath + '/public/music/JamiePedia Data - Songs.csv', { cache: 'no-store' })
    .then((response) => response.ok ? response.text() : '')
    .then((text) => {
      if (!text) {
        return;
      }
      window.__songSidebarCsvRows = parseSongSidebarCsv(text);
      if (typeof onReady === 'function') {
        onReady(window.__songSidebarCsvRows);
      }
    })
    .catch(() => {});
}

const songSidebarFieldOrder = [
  { key: 'appears_on', label: 'Appears On', aliases: ['appears on'] },
  { key: 'release_date', label: 'Release Date', aliases: ['release date'] },
  { key: 'artists', label: 'Artists', aliases: ['artist', 'artists'] },
  { key: 'vocalists', label: 'Vocalists', aliases: ['vocalist', 'vocalists'] },
  { key: 'listen', label: 'Listen', aliases: ['listen'] },
  { key: 'close_up', label: 'Close-up', aliases: ['close-up', 'close up', 'closeup'] }
];

function normalizeSongSidebarLabel(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function splitSongSidebarValues(value) {
  return String(value || '')
    .split(/\s*\|\s*/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseLegacySongSidebarPairs(value) {
  const labels = [];
  const links = [];

  splitSongSidebarValues(value).forEach((entry) => {
    const splitIndex = entry.indexOf('=');
    if (splitIndex === -1) {
      labels.push(entry);
      links.push('');
      return;
    }

    const label = entry.slice(0, splitIndex).trim();
    const href = entry.slice(splitIndex + 1).trim();
    if (!label && !href) {
      return;
    }
    labels.push(label);
    links.push(href);
  });

  return { labels, links };
}

function normalizeSongSidebarHashToken(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^#/, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

function normalizeSongSidebarPathKey(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    return '';
  }

  const splitIndex = raw.indexOf('#');
  const rawPath = splitIndex === -1 ? raw : raw.slice(0, splitIndex);
  const rawHash = splitIndex === -1 ? '' : raw.slice(splitIndex + 1);
  const withMusicPrefix = rawPath.startsWith('/music/')
    ? rawPath
    : ('/music/' + rawPath.replace(/^\/+/, ''));
  const normalizedPath = toExtensionlessPath(withMusicPrefix);
  const hashToken = normalizeSongSidebarHashToken(rawHash);

  return hashToken
    ? normalizedPath + '#' + hashToken
    : normalizedPath;
}

function getActiveSongSidebarScope() {
  const versionContainers = Array.from(document.querySelectorAll('.song-container[id^="version-"]'));
  if (!versionContainers.length) {
    return document;
  }

  const visible = versionContainers.find((container) => container.style.display !== 'none');
  return visible || versionContainers[0] || document;
}

function getSongSidebarRowForCurrentPage() {
  const currentPath = toExtensionlessPath(window.location.pathname);
  if (!document.querySelector('.song-page-wrapper')) {
    return null;
  }

  const csvUrl = basePath + '/public/music/JamiePedia Data - Songs.csv';
  if (!window.__songSidebarCsvRows) {
    return null;
  }

  const hashToken = normalizeSongSidebarHashToken(window.location.hash);
  const currentCandidate = currentPath.replace(/\/$/, '');
  const rows = window.__songSidebarCsvRows;

  if (hashToken) {
    const hashCandidate = currentCandidate + '#' + hashToken;
    const hashMatch = rows.find((row) => {
      const pagePath = String(row.page_path || '').trim();
      if (!pagePath) {
        return false;
      }
      return normalizeSongSidebarPathKey(pagePath) === hashCandidate;
    });

    if (hashMatch) {
      return hashMatch;
    }
  }

  return rows.find((row) => {
    const pagePath = String(row.page_path || '').trim();
    if (!pagePath) {
      return false;
    }
    return normalizeSongSidebarPathKey(pagePath) === currentCandidate;
  }) || null;
}

function createSongSidebarLinks(labelsValue, linksValue) {
  const labels = Array.isArray(labelsValue) ? labelsValue : splitSongSidebarValues(labelsValue);
  const links = Array.isArray(linksValue) ? linksValue : splitSongSidebarValues(linksValue);
  const total = Math.max(labels.length, links.length);
  const container = document.createElement('div');
  container.className = 'song-links';

  for (let index = 0; index < total; index += 1) {
    const label = String(labels[index] || '').trim();
    const rawHref = String(links[index] || '').trim();

    if (!label) {
      continue;
    }

    const link = document.createElement('a');
    link.textContent = label;
    if (rawHref && /^https?:/i.test(rawHref)) {
      link.href = rawHref;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    } else if (rawHref) {
      link.href = typeof window.toSiteHref === 'function' ? window.toSiteHref(rawHref) : rawHref;
    } else {
      link.href = '#';
    }
    container.appendChild(link);
  }

  return container;
}

function buildSongSidebarValueHtml(fieldKey, value, row) {
  const entries = splitSongSidebarValues(value);

  if (!entries.length) {
    return '';
  }

  const renderEntry = (entry) => {
    if (entry.includes('=')) {
      const splitIndex = entry.indexOf('=');
      const label = entry.slice(0, splitIndex).trim();
      const href = entry.slice(splitIndex + 1).trim();

      if (label && href) {
        const normalizedHref = /^https?:/i.test(href)
          ? href
          : (typeof window.toSiteHref === 'function' ? window.toSiteHref(href) : href);
        const isExternal = /^https?:/i.test(href);
        const anchor = '<a href="' + normalizedHref.replace(/"/g, '%22') + '"' + (isExternal ? ' target="_blank" rel="noopener noreferrer"' : '') + '>' + label + '</a>';
        return anchor;
      }

      return label || '';
    }

    return entry;
  };

  if (fieldKey === 'listen' || fieldKey === 'close_up') {
    return entries.map(renderEntry).join('<br>');
  }

  if (fieldKey === 'appears_on') {
    const albumIds = splitSongSidebarValues((row || {}).album_id || '');
    const singleAlbumFallback = albumIds.length === 1 ? albumIds[0] : '';

    return entries.map((entry, index) => {
      if (entry.includes('=')) {
        return renderEntry(entry);
      }

      const albumId = String(albumIds[index] || singleAlbumFallback || '').trim();
      if (albumId && albumId.toLowerCase() !== 'x') {
        const href = typeof window.toSiteHref === 'function'
          ? window.toSiteHref('/music/' + albumId)
          : ('/music/' + albumId);
        return '<a href="' + href.replace(/"/g, '%22') + '">' + entry + '</a>';
      }

      return entry;
    }).join('<br>');
  }

  return entries.join('<br>');
}

function populateSongSidebarBlock(block, row, key) {
  if (!block) {
    return;
  }

  const labelEl = block.querySelector('.song-info-label');
  const contentEl = block.querySelector('.song-info-content, .song-links');
  const enabled = String(row[key + '_enabled'] || '').toUpperCase() === 'TRUE';

  if (!enabled) {
    block.style.display = 'none';
    return;
  }

  block.style.display = '';
  if (labelEl) {
    const field = songSidebarFieldOrder.find((item) => item.key === key);
    if (key === 'artists') {
      const artistCount = splitSongSidebarValues(String(row.artists || '')).length;
      labelEl.textContent = artistCount === 1 ? 'Artist' : 'Artists';
    } else {
      labelEl.textContent = field ? field.label : labelEl.textContent;
    }
  }

  if (key === 'listen') {
    let labels = splitSongSidebarValues(row.listen_text || '');
    let links = splitSongSidebarValues(row.listen_links || '');

    if ((!labels.length && !links.length) && row.listen) {
      const legacy = parseLegacySongSidebarPairs(row.listen);
      labels = legacy.labels;
      links = legacy.links;
    }

    if (!labels.length && !links.length) {
      if (contentEl) {
        contentEl.textContent = '';
      }
      return;
    }

    const linkContainer = createSongSidebarLinks(labels, links);
    if (contentEl && contentEl.classList && contentEl.classList.contains('song-links')) {
      contentEl.replaceWith(linkContainer);
    } else {
      const parent = block.querySelector('.song-info-content');
      if (parent) {
        parent.replaceWith(linkContainer);
      } else if (contentEl) {
        contentEl.replaceWith(linkContainer);
      } else {
        block.appendChild(linkContainer);
      }
    }
    return;
  }

  const value = String(row[key] || '').trim();
  if (!value) {
    if (contentEl) {
      contentEl.textContent = '';
    }
    return;
  }

  if (key === 'close_up') {
    const parsed = parseLegacySongSidebarPairs(value);
    const labels = parsed.labels.length ? parsed.labels : splitSongSidebarValues(value);
    const links = parsed.links.some((entry) => String(entry || '').trim())
      ? parsed.links
      : splitSongSidebarValues(value);
    const linkContainer = createSongSidebarLinks(labels, links);
    if (contentEl && contentEl.classList && contentEl.classList.contains('song-links')) {
      contentEl.replaceWith(linkContainer);
    } else {
      const parent = block.querySelector('.song-info-content');
      if (parent) {
        parent.replaceWith(linkContainer);
      } else if (contentEl) {
        contentEl.replaceWith(linkContainer);
      } else {
        block.appendChild(linkContainer);
      }
    }
    return;
  }

  const outputHtml = buildSongSidebarValueHtml(key, value, row);
  if (contentEl && contentEl.classList && contentEl.classList.contains('song-info-content')) {
    contentEl.innerHTML = outputHtml;
  } else {
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'song-info-content';
    contentWrapper.innerHTML = outputHtml;
    const existing = block.querySelector('.song-info-content');
    if (existing) {
      existing.replaceWith(contentWrapper);
    } else if (contentEl) {
      contentEl.replaceWith(contentWrapper);
    } else {
      block.appendChild(contentWrapper);
    }
  }
}

function createSongSidebarBlock(field) {
  const block = document.createElement('div');
  block.className = 'song-info-block';

  const label = document.createElement('div');
  label.className = 'song-info-label';
  label.textContent = field ? field.label : '';

  const content = document.createElement('div');
  content.className = 'song-info-content';

  block.appendChild(label);
  block.appendChild(content);
  return block;
}

function getOrCreateSongSidebarBlock(sidebarScope, field) {
  if (!sidebarScope || !field) {
    return null;
  }

  const existingBlocks = Array.from(sidebarScope.querySelectorAll('.song-info-block'));
  const existing = existingBlocks.find((candidate) => {
    const labelText = (candidate.querySelector('.song-info-label') || {}).textContent || '';
    const normalized = normalizeSongSidebarLabel(labelText);
    const exactMatch = normalized === normalizeSongSidebarLabel(field.label);
    const aliasMatch = (field.aliases || []).some((alias) => normalized === normalizeSongSidebarLabel(alias));
    return exactMatch || aliasMatch;
  });

  if (existing) {
    return existing;
  }

  const rightView = sidebarScope.querySelector('.song-rightview');
  if (!rightView) {
    return null;
  }

  const block = createSongSidebarBlock(field);
  rightView.appendChild(block);
  return block;
}

function initializeSongSidebarData() {
  const currentPath = toExtensionlessPath(window.location.pathname);
  if (!document.querySelector('.song-page-wrapper')) {
    return;
  }

  if (!isSongSidebarCsvLoaded()) {
    ensureSongSidebarCsvLoaded(function () {
      initializeSongSidebarData();
    });
    return;
  }

  const row = getSongSidebarRowForCurrentPage();
  if (!row) {
    return;
  }

  const sidebarScope = getActiveSongSidebarScope();
  songSidebarFieldOrder.forEach((field) => {
    const block = getOrCreateSongSidebarBlock(sidebarScope, field);

    if (block) {
      populateSongSidebarBlock(block, row, field.key);
    }
  });
}

window.initializeSongSidebarData = initializeSongSidebarData;

function getAlbumIdFromCurrentPage() {
  const currentPath = toExtensionlessPath(window.location.pathname);
  if (!/^\/music\/[^/]+$/.test(currentPath) || currentPath === '/music') {
    return '';
  }
  return String(currentPath.split('/').pop() || '').toLowerCase();
}

function rowToAlbumSongHref(row) {
  const raw = String((row || {}).page_path || '').trim();
  if (!raw) {
    return '#';
  }
  return '/music/' + raw;
}

function rowToAlbumSongTitle(row) {
  const pageTitle = String((row || {}).page_title || '').trim();
  if (pageTitle) {
    return pageTitle.split(/\s*\|\s*/).filter(Boolean).join(' ');
  }

  const pathPart = String((row || {}).page_path || '').split('#')[0];
  return pathToPageName(pathPart);
}

function getTrackLabelForAlbum(row, albumId) {
  const ids = splitSongSidebarValues((row || {}).album_id || '').map((value) => value.toLowerCase());
  const tracks = splitSongSidebarValues((row || {}).album_track || '');
  const index = ids.indexOf(String(albumId || '').toLowerCase());
  if (index === -1) {
    return 'x';
  }
  return String(tracks[index] || 'x').trim() || 'x';
}

function initializeAlbumSongListFromCsv() {
  const songListEl = document.querySelector('.album-header .song-list');
  if (!songListEl) {
    return;
  }

  const albumId = getAlbumIdFromCurrentPage();
  if (!albumId) {
    return;
  }

  ensureSongSidebarCsvLoaded(function (rows) {
    if (!Array.isArray(rows) || !rows.length) {
      return;
    }

    const matches = rows.filter((row) => {
      const ids = splitSongSidebarValues((row || {}).album_id || '').map((value) => value.toLowerCase());
      return ids.includes(albumId);
    });

    if (!matches.length) {
      return;
    }

    const entries = matches.map((row, index) => {
      const trackLabel = getTrackLabelForAlbum(row, albumId);
      const parsedTrack = parseInt(String(trackLabel || '').trim(), 10);
      return {
        row: row,
        trackLabel: trackLabel,
        trackNumber: Number.isFinite(parsedTrack) ? parsedTrack : Number.POSITIVE_INFINITY,
        originalIndex: index
      };
    });

    entries.sort((a, b) => {
      if (a.trackNumber !== b.trackNumber) {
        return a.trackNumber - b.trackNumber;
      }
      return a.originalIndex - b.originalIndex;
    });

    songListEl.innerHTML = '';

    entries.forEach((entry) => {
      const row = entry.row;
      const title = rowToAlbumSongTitle(row);

      const songItem = document.createElement('div');
      songItem.className = 'song-item';

      const link = document.createElement('a');
      const href = rowToAlbumSongHref(row);
      link.href = typeof window.toSiteHref === 'function' ? window.toSiteHref(href) : href;
      link.textContent = title;

      songItem.appendChild(link);
      songListEl.appendChild(songItem);
    });
  });
}

// ---- Tracklist Sidebar ----

function slugToDisplayName(slug) {
  return String(slug || '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, function (c) { return c.toUpperCase(); });
}

function pathToPageName(filePath) {
  var filename = String(filePath || '').replace(/\.html$/i, '').split('/').pop() || '';
  return slugToDisplayName(filename);
}

function buildTracklistSidebarEl(headerText, headerHref, entries, currentPath, useOrderedList) {
  var el = document.createElement('div');
  el.className = 'sidebar2 tracklist-sidebar';

  var headerDiv = document.createElement('div');
  headerDiv.className = 'tracklist-header';

  var titleLink = document.createElement('a');
  titleLink.href = 'javascript:void(0);';
  titleLink.className = 'tracklist-album-title';
  titleLink.textContent = headerText;
  titleLink.addEventListener('click', function () {
    window.location.href = typeof window.toSiteHref === 'function'
      ? window.toSiteHref(headerHref)
      : withBasePath(headerHref);
  });

  headerDiv.appendChild(titleLink);

  var listEl = document.createElement(useOrderedList ? 'ol' : 'ul');
  listEl.className = 'tracklist-list';

  entries.forEach(function (entry) {
    var li = document.createElement('li');
    li.className = 'tracklist-item';
    if (toExtensionlessPath(entry.path) === currentPath) {
      li.classList.add('tracklist-current');
    }
    var a = document.createElement('a');
    a.href = 'javascript:void(0);';
    a.textContent = entry.name || pathToPageName(entry.path);
    var entryPath = entry.path;
    a.addEventListener('click', function () {
      window.location.href = typeof window.toSiteHref === 'function'
        ? window.toSiteHref(entryPath)
        : withBasePath(toExtensionlessPath(entryPath));
    });
    li.appendChild(a);
    listEl.appendChild(li);
  });

  el.appendChild(headerDiv);
  el.appendChild(listEl);
  return el;
}

function initializeTracklistSidebar() {
  var currentPath = toExtensionlessPath(window.location.pathname);
  if (!/^\/music\/[^/]+\/[^/]+$/.test(currentPath)) {
    return;
  }

  var allFiles = Array.isArray(window.musicFilePaths)
    ? window.musicFilePaths
    : (typeof musicFilePaths !== 'undefined' && Array.isArray(musicFilePaths) ? musicFilePaths : []);

  var dirSlug = currentPath.split('/').slice(2, -1)[0];
  var songEntries = allFiles.filter(function (item) {
    return item && item.path && item.album !== 'Album' && item.album !== 'Motifs'
      && item.path.startsWith('/music/' + dirSlug + '/');
  });

  if (!songEntries.length) {
    return;
  }

  var albumName = songEntries[0].album;
  if (albumName === 'Singles' || albumName === 'Features and Collaborations') {
    return;
  }

  var sidebar2El = buildTracklistSidebarEl(
    albumName,
    '/music/' + dirSlug,
    songEntries.map(function (item) {
      return { path: item.path, name: null };
    }),
    currentPath,
    true
  );

  var songSidebarCol = document.querySelector('.song-sidebar-col');
  if (!songSidebarCol) {
    return;
  }

  var sidebar1El = songSidebarCol.querySelector('.sidebar1');
  if (!sidebar1El) {
    return;
  }

  var stickyWrapper = document.createElement('div');
  stickyWrapper.className = 'sidebar-sticky-wrapper';
  songSidebarCol.insertBefore(stickyWrapper, sidebar1El);
  stickyWrapper.appendChild(sidebar1El);
  stickyWrapper.appendChild(sidebar2El);
}

function albumSummaryEscapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function albumSummarySanitizeUrl(url) {
  const candidate = String(url || '').trim();
  if (!candidate) return '#';
  if (/^(https?:|mailto:|\/|#|\.\/|\.\.\/)/i.test(candidate)) return candidate.replace(/"/g, '%22');
  return '#';
}

function albumSummaryRenderInline(text) {
  const codeTokens = [];
  let html = albumSummaryEscapeHtml(text);

  html = html.replace(/`([^`]+)`/g, (_, codeText) => {
    const token = '@@CODETOKEN' + codeTokens.length + '@@';
    codeTokens.push('<code>' + codeText + '</code>');
    return token;
  });

  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) =>
    '<a href="' + albumSummarySanitizeUrl(url) + '">' + label + '</a>'
  );

  html = html
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/_([^_]+)_/g, '<em>$1</em>');

  html = html.replace(/@@CODETOKEN(\d+)@@/g, (_, i) => codeTokens[Number(i)] || '');
  return html;
}

function albumSummaryIsBlockBoundary(line) {
  const t = String(line || '').trim();
  if (!t) return true;
  return /^#{1,6}\s+/.test(t) || /^```/.test(t) || /^[-*+]\s+/.test(t)
    || /^\d+\.\s+/.test(t) || /^>\s?/.test(t) || /^(-{3,}|\*{3,}|_{3,})$/.test(t);
}

function renderAlbumSummaryHtml(text) {
  const normalized = String(text || '').replace(/\r\n/g, '\n').trim();
  if (!normalized) return '';

  const lines = normalized.split('\n');
  const chunks = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) { index += 1; continue; }

    if (/^```/.test(trimmed)) {
      const codeLines = [];
      index += 1;
      while (index < lines.length && !/^```/.test(lines[index].trim())) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      chunks.push('<pre class="song-markdown-code"><code>' + albumSummaryEscapeHtml(codeLines.join('\n')) + '</code></pre>');
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const tag = 'h' + level;
      chunks.push('<' + tag + ' class="song-markdown-' + tag + '">' + albumSummaryRenderInline(headingMatch[2].trim()) + '</' + tag + '>');
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
      chunks.push('<ul>' + items.map((item) => '<li>' + albumSummaryRenderInline(item) + '</li>').join('') + '</ul>');
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^\d+\.\s+/, ''));
        index += 1;
      }
      chunks.push('<ol>' + items.map((item) => '<li>' + albumSummaryRenderInline(item) + '</li>').join('') + '</ol>');
      continue;
    }

    if (/^>\s?/.test(trimmed)) {
      const quoteLines = [];
      while (index < lines.length && /^>\s?/.test(lines[index].trim())) {
        quoteLines.push(lines[index].trim().replace(/^>\s?/, ''));
        index += 1;
      }
      chunks.push('<blockquote>' + quoteLines.map((ql) => albumSummaryRenderInline(ql)).join('<br>') + '</blockquote>');
      continue;
    }

    const paraLines = [];
    while (index < lines.length && !albumSummaryIsBlockBoundary(lines[index])) {
      paraLines.push(lines[index].trim());
      index += 1;
    }
    if (paraLines.length > 0) {
      chunks.push('<p>' + paraLines.map((pl) => albumSummaryRenderInline(pl)).join('<br>') + '</p>');
      continue;
    }

    index += 1;
  }

  return chunks.join('');
}

function initializeAlbumSummary() {
  // Only run on album index pages.
  if (!document.querySelector('.album-info')) {
    return;
  }

  // Derive slug from URL: /music/cc -> 'cc', /JamiePedia/music/cc -> 'cc'
  const pathParts = window.location.pathname
    .replace(/\/?index\.html$/i, '')
    .replace(/\.html$/i, '')
    .split('/')
    .filter(Boolean);
  const slug = pathParts[pathParts.length - 1];
  if (!slug || slug === 'music') {
    return;
  }

  const summaryPath = basePath + '/public/album-summaries/' + slug + '.txt';

  fetch(summaryPath, { cache: 'no-store' })
    .then(function (res) {
      return res.ok ? res.text() : null;
    })
    .then(function (text) {
      if (!text || !String(text).trim()) {
        return;
      }

      const section = document.createElement('div');
      section.className = 'album-summary-section';

      const content = document.createElement('div');
      content.className = 'album-summary-content';
      content.innerHTML = renderAlbumSummaryHtml(text.trim());
      section.appendChild(content);

      const albumHeader = document.querySelector('.album-header');
      if (albumHeader && albumHeader.parentNode) {
        albumHeader.parentNode.insertBefore(section, albumHeader.nextSibling);
      }
    })
    .catch(function () {});
}