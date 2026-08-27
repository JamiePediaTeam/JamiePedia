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
    '/public/themes/themes - sheet1.csv',
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

  // Album pages typically do not include nav buttons in HTML.
  // Auto-create a container so album prev/next is centrally data-driven too.
  if (containers.length === 0 && activeList === navOrder.albums) {
    const bodybar = document.querySelector('.bodybar');
    if (bodybar) {
      const container = document.createElement('div');
      container.className = 'album-nav-buttons';
      container.innerHTML =
        '<a href="javascript:void(0);" class="album-nav-link">← Previous</a>' +
        '<a href="javascript:void(0);" class="album-nav-link">Next →</a>';
      bodybar.appendChild(container);
      containers = [container];
    }
  }

  containers.forEach((container) => {
    const links = Array.from(container.querySelectorAll('a.song-nav-link, button.song-nav-link, a.album-nav-link, button.album-nav-link, a, button'));
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
  initializeAlbumSummary();
});

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
  var allFiles = Array.isArray(window.musicFilePaths)
    ? window.musicFilePaths
    : (typeof musicFilePaths !== 'undefined' && Array.isArray(musicFilePaths) ? musicFilePaths : []);
  var sidebar2El = null;

  var songMatch = currentPath.match(/^\/music\/([^/]+)\/[^/]+$/);
  var albumMatch = !songMatch && currentPath.match(/^\/music\/([^/]+)$/);

  if (!songMatch && !albumMatch) return;

  var songEntries, albumSlug, albumName;

  if (songMatch) {
    var dirSlug = songMatch[1];
    var currentEntry = allFiles.find(function (item) {
      return item && item.path && toExtensionlessPath(item.path) === currentPath;
    });

    // Check if any album page declares sidebarSongsDir pointing at this directory.
    // If so, ALL songs in this directory belong to that album page.
    var dirRedirectEntry = allFiles.find(function (item) {
      return item && item.album === 'Album' && item.sidebarSongsDir === dirSlug;
    });

    if (dirRedirectEntry) {
      albumSlug = dirRedirectEntry.path.replace(/^\/music\//, '').replace(/\.html$/, '');
      albumName = dirRedirectEntry.sidebarAlbumName || slugToDisplayName(albumSlug);
      songEntries = allFiles.filter(function (item) {
        return item && item.path && item.album !== 'Album' && item.album !== 'Motifs'
          && item.path.startsWith('/music/' + dirSlug + '/');
      });
    } else if (currentEntry && currentEntry.sidebarAlbumSlug) {
      // Per-song override (different album page, all songs in dir)
      albumSlug = currentEntry.sidebarAlbumSlug;
      var overrideAlbumEntry = allFiles.find(function (item) {
        return item && item.album === 'Album' && item.path === '/music/' + albumSlug + '.html';
      });
      albumName = (overrideAlbumEntry && overrideAlbumEntry.sidebarAlbumName)
        || slugToDisplayName(albumSlug);
      songEntries = allFiles.filter(function (item) {
        return item && item.path && item.album !== 'Album' && item.album !== 'Motifs'
          && item.path.startsWith('/music/' + dirSlug + '/');
      });
    } else {
      // Default: directory slug = album slug, exclude songs belonging to other album pages
      albumSlug = dirSlug;
      songEntries = allFiles.filter(function (item) {
        return item && item.path && item.album !== 'Album' && item.album !== 'Motifs'
          && item.path.startsWith('/music/' + albumSlug + '/')
          && !item.sidebarAlbumSlug;
      });
      albumName = songEntries.length > 0 ? songEntries[0].album : null;
    }
  } else {
    albumSlug = albumMatch[1];
    var albumPageEntry = allFiles.find(function (item) {
      return item && item.album === 'Album' && item.path === '/music/' + albumSlug + '.html';
    });

    if (albumPageEntry && albumPageEntry.sidebarSongsDir) {
      // Album page whose songs live in a different directory
      var songsDir = albumPageEntry.sidebarSongsDir;
      albumName = albumPageEntry.sidebarAlbumName || slugToDisplayName(albumSlug);
      songEntries = allFiles.filter(function (item) {
        return item && item.path && item.album !== 'Album' && item.album !== 'Motifs'
          && item.path.startsWith('/music/' + songsDir + '/');
      });
    } else {
      // Default: songs in same directory, exclude those belonging to other album pages
      songEntries = allFiles.filter(function (item) {
        return item && item.path && item.album !== 'Album' && item.album !== 'Motifs'
          && item.path.startsWith('/music/' + albumSlug + '/')
          && !item.sidebarAlbumSlug;
      });
      albumName = songEntries.length > 0 ? songEntries[0].album : null;
    }
  }

  if (!songEntries || songEntries.length === 0) return;
  if (!albumName) return;
  if (albumName === 'Singles' || albumName === 'Features and Collaborations') return;

  var trackEntries = songEntries.map(function (item) {
    return { path: item.path, name: null };
  });

  sidebar2El = buildTracklistSidebarEl(albumName, '/music/' + albumSlug, trackEntries, currentPath, true);

  if (!sidebar2El) return;

  var songSidebarCol = document.querySelector('.song-sidebar-col');
  if (songSidebarCol) {
    var sidebar1El = songSidebarCol.querySelector('.sidebar1');
    var stickyWrapper = document.createElement('div');
    stickyWrapper.className = 'sidebar-sticky-wrapper';
    if (sidebar1El) {
      songSidebarCol.insertBefore(stickyWrapper, sidebar1El);
      stickyWrapper.appendChild(sidebar1El);
    } else {
      songSidebarCol.appendChild(stickyWrapper);
    }
    stickyWrapper.appendChild(sidebar2El);
  } else {
    var sidebar1 = document.querySelector('.sidebar1');
    if (!sidebar1) return;
    var stack = document.createElement('div');
    stack.className = 'sidebar-stack';
    sidebar1.parentNode.insertBefore(stack, sidebar1);
    stack.appendChild(sidebar1);
    stack.appendChild(sidebar2El);
  }
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