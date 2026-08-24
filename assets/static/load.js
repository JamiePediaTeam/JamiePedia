// Determine base path - detect GitHub Pages subdirectory
const pathname = window.location.pathname;
const basePath = pathname.includes('/JamiePedia/') ? '/JamiePedia' : '';

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
  surface_empty_state: 'surface_tint_card',
  surface_base: 'surface_tint_card'
};

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

    const selected = rows.find((row) => String(row.theme_id || '').trim() === requestedThemeId)
      || rows.find((row) => String(row.theme_id || '').trim() === 'default')
      || rows[0];

    if (loadedCsvPath) {
      root.setAttribute('data-theme-source', loadedCsvPath);
    }

    applyThemeRow(selected);
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
          if (typeof initializeSearch === 'function') {
            initializeSearch();
          }
        });
        $("#sidebar").load(basePath + "/assets/static/sidebar.html");
        $("#linkbox").load(basePath + "/assets/static/linkbox.html", function() {
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
  window.location.href = basePath + relativePath;
}

function normalizePathForNav(path) {
  if (!path) return '/';

  let normalized = String(path).split('?')[0].split('#')[0];
  if (!normalized.startsWith('/')) {
    normalized = '/' + normalized;
  }

  if (basePath && normalized.startsWith(basePath + '/')) {
    normalized = normalized.slice(basePath.length);
  }

  return normalized;
}

function setNavLinkTarget(element, targetPath) {
  const isAnchor = element.tagName.toLowerCase() === 'a';
  const hasTarget = Boolean(targetPath);

  element.removeAttribute('onclick');

  if (hasTarget) {
    const href = basePath + targetPath;

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

  if (Array.isArray(navOrder.songs) && navOrder.songs.includes(currentPath)) {
    return navOrder.songs;
  }

  if (Array.isArray(navOrder.albums) && navOrder.albums.includes(currentPath)) {
    return navOrder.albums;
  }

  if (Array.isArray(navOrder.motifs) && navOrder.motifs.includes(currentPath)) {
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

  const currentIndex = activeList.indexOf(currentPath);
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

document.addEventListener('DOMContentLoaded', function () {
  initializeDataNavButtons();
});