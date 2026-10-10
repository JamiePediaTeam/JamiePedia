// Determine base path - detect GitHub Pages subdirectory
const pathname = window.location.pathname;
const basePath = pathname.includes('/JamiePedia/') ? '/JamiePedia' : '';

const themeGateRoot = document.documentElement;
const themeGatePath = String(window.location.pathname || '');
const themeGateRoute = basePath && themeGatePath.startsWith(basePath)
  ? themeGatePath.slice(basePath.length) || '/'
  : themeGatePath;
const pageCarryStorageKey = 'jamiepedia:page-carry:v1';
const themeGateNeedsExplicitReady = /^\/music\/[^/]+(?:\/close-up)?$/i.test(themeGateRoute)
  || /^\/artists\/[^/]+$/i.test(themeGateRoute)
  || /^\/motifs\/[^/]+$/i.test(themeGateRoute);
let themeGateThemeLoaded = false;
let themeGatePageReady = !themeGateNeedsExplicitReady;
let themeGateReleased = false;
let pageCarryOverlayElement = null;

if (!document.getElementById('themeGateStyle')) {
  const themeGateStyle = document.createElement('style');
  themeGateStyle.id = 'themeGateStyle';
  themeGateStyle.textContent = 'html[data-theme-pending="true"] body{visibility:hidden !important;}';
  document.head.appendChild(themeGateStyle);
}

themeGateRoot.setAttribute('data-theme-pending', 'true');

function readPageCarryPayload() {
  try {
    const raw = window.sessionStorage.getItem(pageCarryStorageKey);
    if (!raw) {
      return null;
    }

    const payload = JSON.parse(raw);
    return payload && typeof payload === 'object' ? payload : null;
  } catch (_error) {
    return null;
  }
}

function clearPageCarryPayload() {
  try {
    window.sessionStorage.removeItem(pageCarryStorageKey);
  } catch (_error) {
    // Ignore storage failures.
  }
}

function ensurePageCarryStyle() {
  if (document.getElementById('pageCarryOverlayStyle')) {
    return;
  }

  const style = document.createElement('style');
  style.id = 'pageCarryOverlayStyle';
  style.textContent = [
    '#pageCarryOverlay{position:fixed;inset:0;z-index:2147483000;overflow:hidden;pointer-events:none;background:var(--theme-page-background,#f7f4ef);}',
    '#pageCarryOverlayFrame{position:absolute;inset:0;border:none;width:100%;height:100%;display:block;background:transparent;}'
  ].join('');
  document.head.appendChild(style);
}

function dismissPageCarryOverlay() {
  if (!pageCarryOverlayElement) {
    return;
  }

  const overlayToRemove = pageCarryOverlayElement;
  pageCarryOverlayElement = null;
  if (overlayToRemove && overlayToRemove.parentNode) {
    overlayToRemove.parentNode.removeChild(overlayToRemove);
  }
}

function buildPageCarrySrcdoc(pageHtml, scrollY) {
  const html = String(pageHtml || '');
  const y = Math.max(0, Number(scrollY || 0));
  const injectedStyle = '<style>html,body{margin:0 !important;overflow:hidden !important;}body{transform:translateY(-' + y + 'px) !important;transform-origin:top left;}</style>';

  if (!html) {
    return '';
  }

  if (/<head\b[^>]*>/i.test(html)) {
    return html.replace(/<head\b[^>]*>/i, function (match) {
      return match + injectedStyle;
    });
  }

  return '<!doctype html><html><head>' + injectedStyle + '</head><body>' + html + '</body></html>';
}

function mountPageCarryOverlayIfAvailable() {
  const payload = readPageCarryPayload();
  clearPageCarryPayload();

  if (!payload) {
    return;
  }

  const now = Date.now();
  const createdAt = Number(payload.createdAt || 0);
  if (!createdAt || now - createdAt > 15000) {
    return;
  }

  const expectedPath = String(payload.targetPath || '').trim();
  const fromPath = String(payload.fromPath || '').trim();
  const currentPath = toSiteHref(window.location.pathname + window.location.search + window.location.hash);
  if (expectedPath && expectedPath !== currentPath) {
    return;
  }

  if (!expectedPath && fromPath) {
    let referrerPath = '';
    try {
      if (document.referrer) {
        const referrerUrl = new URL(document.referrer);
        if (referrerUrl.origin === window.location.origin) {
          referrerPath = toSiteHref(referrerUrl.pathname + referrerUrl.search + referrerUrl.hash);
        }
      }
    } catch (_error) {
      referrerPath = '';
    }

    if (!referrerPath || referrerPath !== fromPath) {
      return;
    }
  }

  const pageHtml = String(payload.pageHtml || '');
  if (!pageHtml) {
    return;
  }

  ensurePageCarryStyle();

  const overlay = document.createElement('div');
  overlay.id = 'pageCarryOverlay';

  const frame = document.createElement('iframe');
  frame.id = 'pageCarryOverlayFrame';
  frame.setAttribute('aria-hidden', 'true');
  frame.setAttribute('tabindex', '-1');
  frame.setAttribute('sandbox', '');
  frame.srcdoc = buildPageCarrySrcdoc(pageHtml, payload.scrollY || 0);

  overlay.appendChild(frame);
  themeGateRoot.appendChild(overlay);
  pageCarryOverlayElement = overlay;
}

function maybeRevealThemeGate() {
  if (themeGateReleased || !themeGateThemeLoaded || !themeGatePageReady) {
    return;
  }

  themeGateReleased = true;
  const reveal = function () {
    themeGateRoot.removeAttribute('data-theme-pending');
    themeGateRoot.setAttribute('data-theme-ready', 'true');
    dismissPageCarryOverlay();
  };

  reveal();
}

window.releaseThemeGate = function () {
  themeGatePageReady = true;
  maybeRevealThemeGate();
};

window.setTimeout(function () {
  themeGateThemeLoaded = true;
  themeGatePageReady = true;
  maybeRevealThemeGate();
}, 5000);

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

function mapCloseupPathToSongSection(pathname) {
  const normalizedPath = toExtensionlessPath(pathname);
  const match = normalizedPath.match(/^\/music\/([^/]+)\/close-up$/i);
  if (!match) {
    return '';
  }

  const slug = String(match[1] || '').trim().toLowerCase();
  if (!slug) {
    return '';
  }

  return withBasePath('/music/' + slug) + '#close-up';
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

    const closeupRedirectHref = mapCloseupPathToSongSection(absolute.pathname);
    if (closeupRedirectHref) {
      return closeupRedirectHref;
    }

    const canonicalPath = withBasePath(toExtensionlessPath(absolute.pathname));
    return canonicalPath + absolute.search + absolute.hash;
  } catch (_error) {
    return source;
  }
}

function isNavigableInternalAnchor(anchor) {
  if (!anchor || anchor.tagName !== 'A') {
    return false;
  }

  const hrefAttr = String(anchor.getAttribute('href') || '').trim();
  if (!hrefAttr || hrefAttr.startsWith('#') || /^(mailto:|tel:|javascript:|data:|blob:)/i.test(hrefAttr)) {
    return false;
  }

  const target = String(anchor.getAttribute('target') || '').trim().toLowerCase();
  if (target && target !== '_self') {
    return false;
  }

  if (anchor.hasAttribute('download')) {
    return false;
  }

  let absolute;
  try {
    absolute = new URL(anchor.href, window.location.href);
  } catch (_error) {
    return false;
  }

  if (absolute.origin !== window.location.origin) {
    return false;
  }

  const currentPath = window.location.pathname + window.location.search + window.location.hash;
  const nextPath = absolute.pathname + absolute.search + absolute.hash;
  if (nextPath === currentPath) {
    return false;
  }

  return true;
}

function cacheCurrentPageForNextNavigation(targetPath) {
  const docRoot = document.documentElement;
  if (!docRoot) {
    return;
  }

  const pageHtml = String(docRoot.outerHTML || '');
  if (!pageHtml || pageHtml.length > 2400000) {
    clearPageCarryPayload();
    return;
  }

  try {
    const fromPath = toSiteHref(window.location.pathname + window.location.search + window.location.hash);
    window.sessionStorage.setItem(pageCarryStorageKey, JSON.stringify({
      createdAt: Date.now(),
      targetPath,
      fromPath,
      scrollY: window.scrollY || 0,
      pageHtml
    }));
  } catch (_error) {
    clearPageCarryPayload();
  }
}

document.addEventListener('click', function (event) {
  if (!event || event.defaultPrevented || event.button !== 0) {
    return;
  }

  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return;
  }

  const anchor = event.target && typeof event.target.closest === 'function'
    ? event.target.closest('a[href]')
    : null;

  if (!isNavigableInternalAnchor(anchor)) {
    return;
  }

  const targetPath = toSiteHref(anchor.getAttribute('href') || anchor.href || '');
  if (!targetPath) {
    return;
  }

  cacheCurrentPageForNextNavigation(targetPath);
}, true);

window.addEventListener('beforeunload', function () {
  const existing = readPageCarryPayload();
  if (existing && String(existing.targetPath || '').trim()) {
    return;
  }

  cacheCurrentPageForNextNavigation('');
});

mountPageCarryOverlayIfAvailable();

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

const txtInternalLinkIndex = {
  loaded: false,
  loadingPromise: null,
  songIds: new Set(),
  albumIds: new Set(),
  motifPageByMotifId: Object.create(null),
  motifPageByCategoryId: Object.create(null)
};

function parseTxtCsvLine(line) {
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

function parseTxtCsvRows(text) {
  const lines = String(text || '').split(/\r?\n/).filter((line) => String(line || '').trim());
  if (!lines.length) {
    return { headers: [], rows: [] };
  }

  const headers = parseTxtCsvLine(lines[0]).map((header) => String(header || '').trim().toLowerCase());
  const rows = lines.slice(1).map((line) => parseTxtCsvLine(line));
  return { headers, rows };
}

function findTxtHeaderIndex(headers, aliases) {
  const normalizedAliases = (Array.isArray(aliases) ? aliases : []).map((alias) => String(alias || '').trim().toLowerCase());
  for (let index = 0; index < headers.length; index += 1) {
    if (normalizedAliases.includes(String(headers[index] || '').trim().toLowerCase())) {
      return index;
    }
  }
  return -1;
}

function normalizeTxtLinkToken(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
    .replace(/\/index\.html$/i, '')
    .replace(/\.html$/i, '');
}

function isTxtTruthyFlag(value) {
  const normalized = String(value || '').trim().toUpperCase();
  return normalized === 'TRUE' || normalized === 'YES' || normalized === '1';
}

async function ensureTxtInternalLinkIndexLoaded() {
  if (txtInternalLinkIndex.loaded) {
    return txtInternalLinkIndex;
  }

  if (txtInternalLinkIndex.loadingPromise) {
    return txtInternalLinkIndex.loadingPromise;
  }

  txtInternalLinkIndex.loadingPromise = Promise.all([
    fetch(withBasePath('/public/csv/JamiePedia Data - Songs.csv'), { cache: 'no-store' }).then((response) => response.ok ? response.text() : ''),
    fetch(withBasePath('/public/csv/JamiePedia Data - Albums.csv'), { cache: 'no-store' }).then((response) => response.ok ? response.text() : ''),
    fetch(withBasePath('/public/csv/JamiePedia Data - Motifs.csv'), { cache: 'no-store' }).then((response) => response.ok ? response.text() : '')
  ]).then((texts) => {
    const songs = parseTxtCsvRows(texts[0] || '');
    const albums = parseTxtCsvRows(texts[1] || '');
    const motifs = parseTxtCsvRows(texts[2] || '');

    const pathIndex = findTxtHeaderIndex(songs.headers, ['path id', 'path_id', 'page_path', 'path']);
    songs.rows.forEach((values) => {
      if (pathIndex === -1) {
        return;
      }
      const token = normalizeTxtLinkToken(values[pathIndex] || '');
      if (token) {
        txtInternalLinkIndex.songIds.add(token);
      }
    });

    const albumIdIndex = findTxtHeaderIndex(albums.headers, ['album_id', 'album id', 'path id', 'path_id', 'path']);
    albums.rows.forEach((values) => {
      if (albumIdIndex === -1) {
        return;
      }
      const token = normalizeTxtLinkToken(values[albumIdIndex] || '');
      if (token) {
        txtInternalLinkIndex.albumIds.add(token);
      }
    });

    const motifIdIndex = findTxtHeaderIndex(motifs.headers, ['motif id', 'motif_id']);
    const categoryIdIndex = findTxtHeaderIndex(motifs.headers, ['category id', 'category_id']);
    const hasPageIndex = findTxtHeaderIndex(motifs.headers, ['has page', 'has_page']);
    motifs.rows.forEach((values) => {
      const hasPage = hasPageIndex === -1 ? true : isTxtTruthyFlag(values[hasPageIndex] || '');
      if (!hasPage) {
        return;
      }

      const motifId = normalizeTxtLinkToken(values[motifIdIndex] || '');
      const categoryId = normalizeTxtLinkToken(values[categoryIdIndex] || '');
      const pageSlug = categoryId === 'kalia-vibte'
        ? 'kalia-vibte'
        : (categoryId || motifId);

      if (!pageSlug) {
        return;
      }

      if (motifId && !txtInternalLinkIndex.motifPageByMotifId[motifId]) {
        txtInternalLinkIndex.motifPageByMotifId[motifId] = pageSlug;
      }

      if (categoryId && !txtInternalLinkIndex.motifPageByCategoryId[categoryId]) {
        txtInternalLinkIndex.motifPageByCategoryId[categoryId] = pageSlug;
      }
    });

    txtInternalLinkIndex.loaded = true;
    return txtInternalLinkIndex;
  }).catch(() => {
    txtInternalLinkIndex.loaded = true;
    return txtInternalLinkIndex;
  });

  return txtInternalLinkIndex.loadingPromise;
}

function resolveTxtInternalHref(rawHref) {
  const source = String(rawHref || '').trim();
  if (!source) {
    return '#';
  }

  if (/^(javascript:|data:|blob:)/i.test(source)) {
    return '#';
  }

  if (/^(https?:|mailto:|tel:|#|\/|\.\/|\.\.\/)/i.test(source)) {
    const normalized = source.replace(/"/g, '%22');
    return typeof toSiteHref === 'function' ? toSiteHref(normalized) : normalized;
  }

  const typedMatch = source.match(/^(album|path|song|motif|category)\s*:\s*(.+)$/i);
  const explicitType = typedMatch ? String(typedMatch[1] || '').toLowerCase() : '';
  const tokenSource = typedMatch ? typedMatch[2] : source;
  const token = normalizeTxtLinkToken(tokenSource);
  if (!token) {
    return '#';
  }

  if (token.startsWith('music/') || token.startsWith('motifs/')) {
    const mappedCloseupHref = token.startsWith('music/') ? mapCloseupPathToSongSection('/' + token) : '';
    if (mappedCloseupHref) {
      return mappedCloseupHref.replace(/"/g, '%22');
    }

    return withBasePath('/' + token).replace(/"/g, '%22');
  }

  if (token.includes('/')) {
    const mappedCloseupHref = mapCloseupPathToSongSection('/' + token);
    if (mappedCloseupHref) {
      return mappedCloseupHref.replace(/"/g, '%22');
    }

    return withBasePath('/' + token).replace(/"/g, '%22');
  }

  if (explicitType === 'motif') {
    const motifPage = txtInternalLinkIndex.motifPageByMotifId[token] || token;
    return withBasePath('/motifs/' + motifPage).replace(/"/g, '%22');
  }

  if (explicitType === 'category') {
    const categoryPage = txtInternalLinkIndex.motifPageByCategoryId[token] || token;
    return withBasePath('/motifs/' + categoryPage).replace(/"/g, '%22');
  }

  if (explicitType === 'album' || explicitType === 'path' || explicitType === 'song') {
    return withBasePath('/music/' + token).replace(/"/g, '%22');
  }

  const motifPage = txtInternalLinkIndex.motifPageByCategoryId[token] || txtInternalLinkIndex.motifPageByMotifId[token] || '';
  if (motifPage) {
    return withBasePath('/motifs/' + motifPage).replace(/"/g, '%22');
  }

  if (txtInternalLinkIndex.songIds.has(token) || txtInternalLinkIndex.albumIds.has(token)) {
    return withBasePath('/music/' + token).replace(/"/g, '%22');
  }

  return withBasePath('/music/' + token).replace(/"/g, '%22');
}

window.ensureTxtInternalLinkIndexLoaded = ensureTxtInternalLinkIndexLoaded;
window.resolveTxtInternalHref = resolveTxtInternalHref;
ensureTxtInternalLinkIndexLoaded().catch(function () {});

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
let themeCssLink = null;

function ensureThemeCssLoaded() {
  if (themeCssLink) {
    return themeCssLink;
  }

  themeCssLink = document.createElement('link');
  themeCssLink.rel = 'stylesheet';
  themeCssLink.href = basePath + '/css/theme.css';
  document.head.appendChild(themeCssLink);
  return themeCssLink;
}

function normalizeThemeIdToken(value) {
  return String(value || '').trim().toLowerCase();
}

function findThemeRowById(themeId) {
  const requested = normalizeThemeIdToken(themeId);
  if (!requested || !Array.isArray(loadedThemeRows) || loadedThemeRows.length === 0) {
    return null;
  }

  return loadedThemeRows.find((row) => normalizeThemeIdToken(row.theme_id) === requested) || null;
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

function requestThemeById(themeId) {
  const root = document.documentElement;
  const requestedThemeId = String(themeId || '').trim();
  if (!requestedThemeId) {
    return false;
  }

  root.setAttribute('data-theme-requested-id', requestedThemeId);
  root.setAttribute('data-theme-id', requestedThemeId);
  return applyThemeById(requestedThemeId);
}

window.requestThemeById = requestThemeById;

async function loadThemeFromCsv() {
  const root = document.documentElement;
  const csvCandidates = [
    '/public/csv/JamiePedia Data - Themes.csv',
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
      ensureThemeCssLoaded();
      themeGateThemeLoaded = true;
      maybeRevealThemeGate();
      return;
    }

    const rows = parseThemeCsv(csvText);
    if (!rows.length) {
      ensureThemeCssLoaded();
      themeGateThemeLoaded = true;
      maybeRevealThemeGate();
      return;
    }
    loadedThemeRows = rows;

    if (loadedCsvPath) {
      root.setAttribute('data-theme-source', loadedCsvPath);
    }

    const requestedThemeId = String(
      root.getAttribute('data-theme-requested-id')
      || root.getAttribute('data-theme-id')
      || 'default'
    ).trim() || 'default';
    applyThemeById(requestedThemeId);
    ensureThemeCssLoaded();
    themeGateThemeLoaded = true;
    maybeRevealThemeGate();
  } catch (_error) {
    // Keep defaults if theme data cannot be fetched.
    ensureThemeCssLoaded();
    themeGateThemeLoaded = true;
    maybeRevealThemeGate();
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
      const loadFragment = function (elementId, fragmentPath, afterLoad) {
        const target = document.getElementById(elementId);
        if (!target) {
          return Promise.resolve(false);
        }

        const executeEmbeddedScripts = function (scope) {
          const scripts = Array.from((scope && scope.querySelectorAll) ? scope.querySelectorAll('script') : []);
          scripts.forEach((script) => {
            const replacement = document.createElement('script');
            Array.from(script.attributes || []).forEach((attr) => {
              replacement.setAttribute(attr.name, attr.value);
            });
            replacement.textContent = script.textContent || '';
            script.parentNode.replaceChild(replacement, script);
          });
        };

        return fetch(fragmentPath, { cache: 'no-store' })
          .then((response) => (response.ok ? response.text() : ''))
          .then((html) => {
            if (!html) {
              return false;
            }

            target.innerHTML = html;
            executeEmbeddedScripts(target);
            normalizeInternalAnchorTargets(target);
            if (typeof afterLoad === 'function') {
              afterLoad(target);
            }
            return true;
          })
          .catch(() => false);
      };

      const runSharedLoads = function () {
        loadFragment('navi', basePath + '/assets/static/navibar.html', function () {
          if (typeof initializeSearch === 'function') {
            initializeSearch();
          }
        });

        loadFragment('sidebar', basePath + '/assets/static/sidebar.html', function () {
          const sidebarRoot = document.getElementById('sidebar');
          if (sidebarRoot) {
            Array.from(sidebarRoot.querySelectorAll('a[onclick*="goToPage"]')).forEach((anchor) => {
              const handler = String(anchor.getAttribute('onclick') || '');
              const match = handler.match(/goToPage\(\s*['\"]([^'\"]+)['\"]\s*\)/i);
              if (!match) {
                return;
              }

              anchor.setAttribute('href', toSiteHref(match[1] || '/'));
              anchor.removeAttribute('onclick');
            });

            const randomButton = sidebarRoot.querySelector('button[onclick*="goToRandomSong"]');
            if (randomButton) {
              randomButton.removeAttribute('onclick');
              randomButton.addEventListener('click', function () {
                if (!Array.isArray(window.musicFilePaths) || window.musicFilePaths.length === 0) {
                  return;
                }

                const randomEntry = window.musicFilePaths[Math.floor(Math.random() * window.musicFilePaths.length)];
                if (randomEntry && randomEntry.path) {
                  window.location.href = toSiteHref(randomEntry.path);
                }
              });
            }
          }

          initializeTracklistSidebar();
          if (typeof addSocialMediaIcons === 'function') {
            addSocialMediaIcons();
          }
        });

        loadFragment('linkbox', basePath + '/assets/static/linkbox.html', function () {
          if (typeof addSocialMediaIcons === 'function') {
            addSocialMediaIcons();
          }
        });
      };

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', runSharedLoads, { once: true });
      } else {
        runSharedLoads();
      }
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

loadThemeFromCsv();

// Load social icons script
const socialIconsScript = document.createElement('script');
socialIconsScript.src = basePath + '/assets/static/social-icons.js?v=20260917a';
document.head.appendChild(socialIconsScript);

// Navigate to a song with proper base path
function goToSong(relativePath) {
  window.location.href = toSiteHref(relativePath);
}

function normalizePathForNav(path) {
  return toExtensionlessPath(path);
}

function getCurrentSongNavKey() {
  const currentPath = toExtensionlessPath(window.location.pathname);
  const currentPointer = currentPath.split('/').filter(Boolean).pop() || '';
  const normalizedSongPath = currentPointer ? ('/music/' + currentPointer) : currentPath;
  const hashToken = normalizeSongSidebarHashToken(window.location.hash);
  if (hashToken === 'close-up' || hashToken === 'closeup') {
    return normalizedSongPath;
  }
  return hashToken ? (normalizedSongPath + '#' + hashToken) : normalizedSongPath;
}

function normalizeArtistNavPathKey(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    return '';
  }

  const splitIndex = raw.indexOf('#');
  const rawPath = splitIndex === -1 ? raw : raw.slice(0, splitIndex);
  const rawHash = splitIndex === -1 ? '' : raw.slice(splitIndex + 1);
  const withArtistPrefix = rawPath.startsWith('/artists/')
    ? rawPath
    : ('/artists/' + rawPath.replace(/^\/+/, ''));
  const normalizedPath = toExtensionlessPath(withArtistPrefix);
  const hashToken = normalizeArtistPageHashToken(rawHash);

  return hashToken
    ? (normalizedPath + '#' + hashToken)
    : normalizedPath;
}

function getCurrentArtistNavKey() {
  const currentPath = toExtensionlessPath(window.location.pathname);
  const currentPointer = currentPath.split('/').filter(Boolean).pop() || '';
  const normalizedArtistPath = currentPointer ? ('/artists/' + currentPointer) : currentPath;
  const hashToken = normalizeArtistPageHashToken(window.location.hash);
  return hashToken ? (normalizedArtistPath + '#' + hashToken) : normalizedArtistPath;
}

function getSongNavFamilyKey(value) {
  const normalized = normalizeSongSidebarPathKey(value);
  return normalized ? normalized.split('#')[0] : '';
}

function getArtistNavFamilyKey(value) {
  const normalized = normalizeArtistNavPathKey(value);
  return normalized ? normalized.split('#')[0] : '';
}

function getAlbumNavFamilyKey(value) {
  const normalized = normalizePathForNav(value);
  if (normalized === '/music/cc' || normalized === '/music/ccde') {
    return 'cc-family';
  }
  return '';
}

function getAlbumFamilyPreferredPath(familyKey, runItems) {
  if (familyKey !== 'cc-family') {
    return '';
  }

  const normalizedRunItems = (Array.isArray(runItems) ? runItems : [])
    .map((item) => normalizePathForNav(item))
    .filter(Boolean);

  return normalizedRunItems.includes('/music/ccde') ? '/music/ccde' : '';
}

function isSongNavVariantPath(value) {
  const normalized = normalizeSongSidebarPathKey(value);
  return Boolean(normalized && normalized.includes('#'));
}

function isArtistNavVariantPath(value) {
  const normalized = normalizeArtistNavPathKey(value);
  return Boolean(normalized && normalized.includes('#'));
}

function getCanonicalNavPathForRun(list, candidateIndex, familyResolver, preferredPathResolver) {
  const items = Array.isArray(list) ? list : [];
  if (!items.length || !Number.isFinite(candidateIndex) || typeof familyResolver !== 'function') {
    return null;
  }

  const candidate = items[candidateIndex];
  if (!candidate) {
    return null;
  }

  const candidateFamilyKey = familyResolver(candidate);
  if (!candidateFamilyKey) {
    return candidate;
  }

  let runStartIndex = candidateIndex;
  while (runStartIndex > 0) {
    const previous = items[runStartIndex - 1];
    if (!previous || familyResolver(previous) !== candidateFamilyKey) {
      break;
    }
    runStartIndex -= 1;
  }

  let runEndIndex = candidateIndex;
  while (runEndIndex < items.length - 1) {
    const next = items[runEndIndex + 1];
    if (!next || familyResolver(next) !== candidateFamilyKey) {
      break;
    }
    runEndIndex += 1;
  }

  if (typeof preferredPathResolver === 'function') {
    const preferredPath = normalizePathForNav(preferredPathResolver(candidateFamilyKey, items.slice(runStartIndex, runEndIndex + 1)) || '');
    if (preferredPath) {
      const preferredItem = items.find((item, index) => {
        return index >= runStartIndex
          && index <= runEndIndex
          && normalizePathForNav(item) === preferredPath;
      });
      if (preferredItem) {
        return preferredItem;
      }
    }
  }

  return items[runStartIndex] || candidate;
}

function findAdjacentNavPath(list, startIndex, direction, currentFamilyKey, familyResolver, preferredPathResolver) {
  const items = Array.isArray(list) ? list : [];
  if (!items.length || !Number.isFinite(startIndex) || !direction) {
    return null;
  }

  let index = startIndex + direction;
  while (index >= 0 && index < items.length) {
    const candidate = items[index];
    if (!candidate) {
      index += direction;
      continue;
    }

    if (typeof familyResolver !== 'function') {
      return candidate;
    }

    const candidateFamilyKey = familyResolver(candidate);

    if (!currentFamilyKey) {
      if (candidateFamilyKey) {
        return getCanonicalNavPathForRun(items, index, familyResolver, preferredPathResolver) || candidate;
      }
      return candidate;
    }

    if (candidateFamilyKey && candidateFamilyKey !== currentFamilyKey) {
      return getCanonicalNavPathForRun(items, index, familyResolver, preferredPathResolver) || candidate;
    }

    if (!candidateFamilyKey) {
      return candidate;
    }

    index += direction;
  }

  return null;
}

function buildSongNavListFromCsvRows(rows) {
  const list = [];
  const seen = new Set();

  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const pagePath = getSongSidebarRowPathValue(row);
    if (!pagePath) {
      return;
    }

    const normalized = normalizeSongSidebarPathKey(pagePath);
    if (!normalized || seen.has(normalized)) {
      return;
    }

    seen.add(normalized);
    list.push(normalized);
  });

  return list;
}

function getNavListForSongPage() {
  if (!document.querySelector('.song-page-wrapper')) {
    return null;
  }

  if (!isSongSidebarCsvLoaded()) {
    ensureSongSidebarCsvLoaded(function () {
      initializeDataNavButtons();
    });
    return null;
  }

  return buildSongNavListFromCsvRows(window.__songSidebarCsvRows || []);
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

  if (Array.isArray(navOrder.artists) && navOrder.artists.some((item) => normalizePathForNav(item) === currentPath)) {
    return navOrder.artists;
  }

  return null;
}

function initializeDataNavButtons() {
  const songNavList = getNavListForSongPage();
  const isSongPage = Array.isArray(songNavList) && songNavList.length > 0;
  const navOrder = window.navOrder;
  if (!navOrder && !isSongPage) {
    if (!window.__pendingDataNavButtonsRetry) {
      window.__pendingDataNavButtonsRetry = true;
      window.setTimeout(function () {
        window.__pendingDataNavButtonsRetry = false;
        initializeDataNavButtons();
      }, 120);
    }
    return;
  }

  let activeList = null;
  let currentIndex = -1;

  if (isSongPage) {
    const currentSongKey = getCurrentSongNavKey();
    activeList = songNavList;
    currentIndex = activeList.findIndex((item) => item === currentSongKey);

    if (currentIndex === -1) {
      const currentPath = normalizePathForNav(window.location.pathname);
      const currentPathId = currentPath.split('/').filter(Boolean).pop() || '';
      currentIndex = activeList.findIndex((item) => {
        const normalized = normalizeSongSidebarPathKey(item);
        if (!normalized) {
          return false;
        }

        const basePath = normalized.split('#')[0];
        if (basePath === currentPath) {
          return true;
        }

        const rowPathId = basePath.split('/').filter(Boolean).pop() || '';
        return !!rowPathId && rowPathId === currentPathId;
      });
    }
  }

  if (currentIndex === -1) {
    if (!navOrder) {
      if (!window.__pendingDataNavButtonsRetry) {
        window.__pendingDataNavButtonsRetry = true;
        window.setTimeout(function () {
          window.__pendingDataNavButtonsRetry = false;
          initializeDataNavButtons();
        }, 120);
      }
      return;
    }

    const currentPath = normalizePathForNav(window.location.pathname);
    activeList = getNavListForPath(currentPath);
    if (!activeList) return;
    const activeIsArtistList = Boolean(navOrder && activeList === navOrder.artists);
    if (activeIsArtistList) {
      const currentArtistKey = getCurrentArtistNavKey();
      currentIndex = activeList.findIndex((item) => normalizeArtistNavPathKey(item) === currentArtistKey);

      if (currentIndex === -1) {
        currentIndex = activeList.findIndex((item) => normalizePathForNav(item) === currentPath);
      }
    } else {
      currentIndex = activeList.findIndex((item) => normalizePathForNav(item) === currentPath);
    }
    if (currentIndex === -1) return;
  }

  const activeIsSongList = isSongPage && activeList === songNavList;
  const isSong = activeIsSongList || (navOrder && activeList === navOrder.songs);
  const isAlbum = Boolean(navOrder && activeList === navOrder.albums);
  const isArtist = Boolean(navOrder && activeList === navOrder.artists);

  const currentFamilyKey = isSong
    ? getSongNavFamilyKey(activeList[currentIndex])
    : (isArtist
      ? getArtistNavFamilyKey(activeList[currentIndex])
      : (isAlbum ? getAlbumNavFamilyKey(activeList[currentIndex]) : ''));
  const familyResolver = isSong
    ? getSongNavFamilyKey
    : (isArtist
      ? getArtistNavFamilyKey
      : (isAlbum ? getAlbumNavFamilyKey : null));
  const preferredPathResolver = isAlbum ? getAlbumFamilyPreferredPath : null;

  const prevPath = findAdjacentNavPath(activeList, currentIndex, -1, currentFamilyKey, familyResolver, preferredPathResolver);
  const nextPath = findAdjacentNavPath(activeList, currentIndex, 1, currentFamilyKey, familyResolver, preferredPathResolver);

  let containers = Array.from(document.querySelectorAll('.song-nav-buttons, .album-nav-buttons'));

  // Auto-create a container so prev/next is centrally data-driven even when
  // song/album pages no longer hardcode those links in HTML.
  if (containers.length === 0 && (isAlbum || isSong)) {
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

let progressiveArtUpgradeObserver = null;
let progressiveArtUpgradeQueue = [];
let progressiveArtUpgradeActiveCount = 0;
const PROGRESSIVE_ART_UPGRADE_MAX_CONCURRENT = 2;

function progressiveArtQueueHighQualityUpgrade(image) {
  if (!image || image.nodeType !== 1 || image.tagName !== 'IMG') {
    return;
  }

  if (image.dataset.previewManagedHqQueued === '1' || image.dataset.previewManagedUpgraded === '1') {
    return;
  }

  image.dataset.previewManagedHqQueued = '1';
  progressiveArtUpgradeQueue.push(image);
  progressiveArtRunHighQualityUpgradeQueue();
}

function progressiveArtRunHighQualityUpgradeQueue() {
  while (progressiveArtUpgradeActiveCount < PROGRESSIVE_ART_UPGRADE_MAX_CONCURRENT && progressiveArtUpgradeQueue.length > 0) {
    const image = progressiveArtUpgradeQueue.shift();
    if (!image || image.nodeType !== 1 || image.tagName !== 'IMG') {
      continue;
    }

    const originalSrc = image.dataset.previewManagedHqSrc || '';
    const previewSrc = image.dataset.previewManagedPreviewSrc || '';
    const currentSrc = image.getAttribute('src') || '';
    if (!originalSrc || !previewSrc || (currentSrc !== previewSrc && currentSrc !== originalSrc)) {
      image.dataset.previewManagedHqQueued = '';
      continue;
    }

    progressiveArtUpgradeActiveCount += 1;

    const highQualityProbe = new Image();
    try {
      highQualityProbe.decoding = 'async';
      if ('fetchPriority' in highQualityProbe) {
        highQualityProbe.fetchPriority = 'low';
      }
    } catch (_error) {
      // Ignore optional priority hints when unsupported.
    }

    highQualityProbe.onload = function () {
      if (image.dataset.previewManagedHqSrc !== originalSrc) {
        progressiveArtUpgradeActiveCount -= 1;
        image.dataset.previewManagedHqQueued = '';
        progressiveArtRunHighQualityUpgradeQueue();
        return;
      }

      image.dataset.previewManagedUpgraded = '1';
      image.src = originalSrc;
      image.dataset.previewManagedHqQueued = '';
      progressiveArtUpgradeActiveCount -= 1;
      progressiveArtRunHighQualityUpgradeQueue();
    };

    highQualityProbe.onerror = function () {
      image.dataset.previewManagedHqQueued = '';
      progressiveArtUpgradeActiveCount -= 1;
      progressiveArtRunHighQualityUpgradeQueue();
    };

    highQualityProbe.src = originalSrc;
  }
}

function progressiveArtScheduleHighQualityUpgrade(image) {
  if (!image || image.nodeType !== 1 || image.tagName !== 'IMG') {
    return;
  }

  progressiveArtQueueHighQualityUpgrade(image);
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

    if (image.__previewManagedErrorHandler) {
      image.removeEventListener('error', image.__previewManagedErrorHandler);
      image.__previewManagedErrorHandler = null;
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
  image.dataset.previewManagedUpgraded = '';
  image.dataset.previewManagedOriginalTried = '';

  try {
    image.decoding = 'async';
    if (!image.hasAttribute('loading') || image.getAttribute('loading') === 'lazy') {
      image.loading = 'eager';
    }
    if ('fetchPriority' in image) {
      image.fetchPriority = 'high';
    }
  } catch (_error) {
    // Ignore optional image hints in unsupported browsers.
  }

  if (image.__previewManagedErrorHandler) {
    image.removeEventListener('error', image.__previewManagedErrorHandler);
  }

  image.__previewManagedErrorHandler = function () {
    if (image.dataset.previewManagedPreviewSrc === previewSrc) {
      if (image.dataset.previewManagedOriginalTried === '1') {
        image.removeEventListener('error', image.__previewManagedErrorHandler);
        return;
      }

      image.dataset.previewManagedOriginalTried = '1';
      image.src = originalSrc;
    }
  };
  image.addEventListener('error', image.__previewManagedErrorHandler);

  image.src = previewSrc;
  progressiveArtScheduleHighQualityUpgrade(image);
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

const loadCoverArtistCsvPath = basePath + '/public/csv/JamiePedia Data - Cover Artists.csv';
const loadArtistCsvPath = basePath + '/public/csv/JamiePedia Data - Artists.csv';
let loadCoverArtistsByFilename = {};
let loadCoverArtistsLoadPromise = null;
let artistDirectoryLoadPromise = null;
let artistDirectoryLoaded = false;
let artistDirectory = {
  pages: [],
  byId: Object.create(null),
  byName: Object.create(null),
  bySlug: Object.create(null),
  byRouteKey: Object.create(null),
  byLyricTag: Object.create(null)
};

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
  if (loadCoverArtistsLoadPromise) {
    return loadCoverArtistsLoadPromise;
  }

  loadCoverArtistsLoadPromise = fetch(loadCoverArtistCsvPath, { cache: 'no-store' })
    .then((response) => response.ok ? response.text() : '')
    .then((text) => {
      loadCoverArtistsByFilename = parseCoverArtistCsv(text);
      return loadCoverArtistsByFilename;
    })
    .catch(() => {
      loadCoverArtistsByFilename = {};
      return loadCoverArtistsByFilename;
    });

  return loadCoverArtistsLoadPromise;
}

function getCoverArtist(filename) {
  const key = String(filename || '').trim().toLowerCase();
  if (!key) {
    return null;
  }

  return loadCoverArtistsByFilename[key] || null;
}

window.getCoverArtist = getCoverArtist;

function normalizeArtistDirectoryKey(value) {
  return String(value || '').trim().toLowerCase();
}

function splitArtistDataValues(value) {
  return String(value || '')
    .split(/\s*\|\s*/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeArtistPageSlug(value) {
  const normalized = normalizeArtistDirectoryKey(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || '';
}

function normalizeArtistPageHashToken(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^#/, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

function splitArtistPageId(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    return { pageId: '', hashToken: '' };
  }

  const splitIndex = raw.indexOf('#');
  return {
    pageId: (splitIndex === -1 ? raw : raw.slice(0, splitIndex)).trim(),
    hashToken: splitIndex === -1 ? '' : raw.slice(splitIndex + 1).trim()
  };
}

function normalizeArtistPageRouteKey(value) {
  const source = splitArtistPageId(value);
  const slug = normalizeArtistPageSlug(source.pageId);
  if (!slug) {
    return '';
  }

  const hashToken = normalizeArtistPageHashToken(source.hashToken);
  return hashToken ? ('/artists/' + slug + '#' + hashToken) : ('/artists/' + slug);
}

function normalizeArtistColorValue(value, fallback) {
  const raw = String(value || '').trim();
  if (!raw) {
    return fallback;
  }

  const prefixed = raw.startsWith('#') ? raw : ('#' + raw);
  return /^#[0-9a-fA-F]{6}$/.test(prefixed) ? prefixed.toUpperCase() : fallback;
}

function normalizeArtistType(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'musical artist' || raw === 'music artist' || raw === 'artist') {
    return 'Musical Artist';
  }
  if (raw === 'vocalist' || raw === 'voicebank' || raw === 'voice bank') {
    return 'Vocalist';
  }
  if (raw === 'graphic artist' || raw === 'visual artist' || raw === 'illustrator') {
    return 'Visual Artist';
  }
  if (raw === 'misc' || raw === 'misc.' || raw === 'miscellaneous') {
    return 'Misc.';
  }
  return 'Misc.';
}

function resolveArtistImagePath(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    return '';
  }

  if (/^(https?:|data:)/i.test(raw)) {
    return raw;
  }

  if (raw.startsWith('../public/')) {
    return withBasePath('/' + raw.replace(/^\.\.\//, '')).replace(/"/g, '%22');
  }

  if (raw.startsWith('/public/')) {
    return withBasePath(raw).replace(/"/g, '%22');
  }

  if (raw.startsWith('public/')) {
    return withBasePath('/' + raw).replace(/"/g, '%22');
  }

  if (raw.includes('/')) {
    return withBasePath('/' + raw.replace(/^\/+/, '')).replace(/"/g, '%22');
  }

  return withBasePath('/public/images/contributors/' + raw).replace(/"/g, '%22');
}

function buildArtistDirectoryFromCsv(text) {
  const directory = {
    pages: [],
    byId: Object.create(null),
    byName: Object.create(null),
    bySlug: Object.create(null),
    byRouteKey: Object.create(null),
    byLyricTag: Object.create(null)
  };

  const lines = String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return directory;
  }

  const headers = splitCoverArtistCsvLine(lines[0]).map((header) => String(header || '').trim().toLowerCase());
  const artistIdIndex = headers.indexOf('artist id');
  const lyricTagIndex = headers.indexOf('lyric tag');
  const artistNameIndex = headers.indexOf('artist name');
  const artistImageIndex = headers.indexOf('artist image');
  const imageLabelIndex = headers.indexOf('image label');
  const artistColorIndex = headers.indexOf('artist color');
  const artistTypeIndex = headers.indexOf('artist type');
  const themeIndex = headers.indexOf('theme');
  const linkTextIndex = headers.indexOf('link text');
  const artistLinksIndex = headers.indexOf('artist links');
  const descriptionIndex = headers.indexOf('description');
  const hasPageIndex = headers.indexOf('has page?') !== -1 ? headers.indexOf('has page?') : headers.indexOf('has page');

  if (artistIdIndex === -1 || artistNameIndex === -1) {
    return directory;
  }

  for (let index = 1; index < lines.length; index += 1) {
    const values = splitCoverArtistCsvLine(lines[index]);
    const ids = splitArtistDataValues(values[artistIdIndex] || '').map((value) => normalizeArtistDirectoryKey(value)).filter(Boolean);
    if (!ids.length) {
      continue;
    }

    const names = splitArtistDataValues(values[artistNameIndex] || '');
    const lyricTags = splitArtistDataValues(values[lyricTagIndex] || '').map((value) => normalizeArtistDirectoryKey(value));
    const images = splitArtistDataValues(values[artistImageIndex] || '');
    const imageLabels = splitArtistDataValues(values[imageLabelIndex] || '');
    const colors = splitArtistDataValues(values[artistColorIndex] || '');
    const descriptions = splitArtistDataValues(values[descriptionIndex] || '');
    const linkLabels = splitArtistDataValues(values[linkTextIndex] || '');
    const linkHrefs = splitArtistDataValues(values[artistLinksIndex] || '');
    const primaryPageId = splitArtistPageId(ids[0]);
    const pageSlug = normalizeArtistPageSlug(primaryPageId.pageId);
    const legacyPageSlug = normalizeArtistPageSlug(ids[0]);
    const pageRouteKey = normalizeArtistPageRouteKey(ids[0]);
    const hasPage = String(values[hasPageIndex] || '').trim().toUpperCase();
    const pageEnabled = hasPage === 'TRUE' || hasPage === 'YES' || hasPage === '1' || hasPage === '';

    if (!pageSlug) {
      continue;
    }

    const page = {
      slug: pageSlug,
      routeKey: pageEnabled ? (pageRouteKey || ('/artists/' + pageSlug)) : '',
      ids: ids.slice(),
      names: names.slice(),
      imagePaths: images.map((value) => resolveArtistImagePath(value)).filter(Boolean),
      imageLabels: imageLabels.slice(),
      primaryId: ids[0],
      pageId: primaryPageId.pageId || ids[0],
      pageHashToken: normalizeArtistPageHashToken(primaryPageId.hashToken),
      primaryName: String(names[0] || ids[0]).trim(),
      theme: String(values[themeIndex] || '').trim(),
      type: normalizeArtistType(values[artistTypeIndex] || ''),
      hasPage: pageEnabled,
      links: [],
      aliases: []
    };

    const totalLinks = Math.max(linkLabels.length, linkHrefs.length);
    for (let linkIndex = 0; linkIndex < totalLinks; linkIndex += 1) {
      const label = String(linkLabels[linkIndex] || '').trim();
      const href = String(linkHrefs[linkIndex] || '').trim();
      if (!label || !href) {
        continue;
      }
      page.links.push({ label, href });
    }

    ids.forEach((id, aliasIndex) => {
      const aliasPageId = splitArtistPageId(id);
      const aliasSlug = normalizeArtistPageSlug(aliasPageId.pageId);
      const aliasRouteKey = normalizeArtistPageRouteKey(id);
      const aliasHasPage = pageEnabled && Boolean(aliasSlug);
      const aliasHref = aliasHasPage
        ? (typeof window !== 'undefined' && typeof window.toSiteHref === 'function'
          ? window.toSiteHref(aliasRouteKey || ('/artists/' + aliasSlug))
          : (aliasRouteKey || ('/artists/' + aliasSlug)))
        : String(linkHrefs[0] || linkHrefs[aliasIndex] || '').trim();

      const alias = {
        id,
        pageSlug: aliasSlug,
        pageRouteKey: aliasRouteKey,
        href: aliasHref,
        hasPage: aliasHasPage,
        name: String(names[aliasIndex] || names[0] || id).trim(),
        image: page.imagePaths[aliasIndex] || page.imagePaths[0] || resolveArtistImagePath(images[aliasIndex] || images[0] || ''),
        imageLabel: String(imageLabels[aliasIndex] || imageLabels[0] || '').trim(),
        color: normalizeArtistColorValue(colors[aliasIndex] || colors[0] || '', '#F05E55'),
        description: String(descriptions[aliasIndex] || descriptions[0] || '').trim(),
        lyricTag: String(lyricTags[aliasIndex] || lyricTags[0] || '').trim(),
        type: page.type,
        theme: page.theme,
        links: page.links,
        pageName: page.primaryName
      };

      page.aliases.push(alias);
      directory.byId[id] = alias;
      if (pageEnabled && aliasRouteKey && !directory.byRouteKey[aliasRouteKey]) {
        directory.byRouteKey[aliasRouteKey] = page;
      }
      if (alias.name) {
        const normalizedAliasName = normalizeArtistDirectoryKey(alias.name);
        if (normalizedAliasName && !directory.byName[normalizedAliasName]) {
          directory.byName[normalizedAliasName] = alias;
        }
      }

      const explicitName = String(names[aliasIndex] || '').trim();
      if (explicitName) {
        const normalizedExplicitName = normalizeArtistDirectoryKey(explicitName);
        if (normalizedExplicitName && !directory.byName[normalizedExplicitName]) {
          directory.byName[normalizedExplicitName] = alias;
        }
      }

      if (alias.lyricTag && !directory.byLyricTag[normalizeArtistDirectoryKey(alias.lyricTag)]) {
        directory.byLyricTag[normalizeArtistDirectoryKey(alias.lyricTag)] = alias;
      }
    });

    const primaryAlias = page.aliases[0] || null;
    page.href = primaryAlias
      ? String(primaryAlias.href || '').trim()
      : '';

    names.forEach((name) => {
      const normalizedName = normalizeArtistDirectoryKey(name);
      if (normalizedName && !directory.byName[normalizedName]) {
        directory.byName[normalizedName] = page.aliases[0] || null;
      }
    });

    directory.pages.push(page);
    if (pageEnabled) {
      const existingPage = directory.bySlug[pageSlug] || null;
      const shouldReplaceExisting = Boolean(
        existingPage
        && existingPage.pageHashToken
        && !page.pageHashToken
      );

      if (pageSlug && (!existingPage || shouldReplaceExisting)) {
        directory.bySlug[pageSlug] = page;
      }
      if (legacyPageSlug && !directory.bySlug[legacyPageSlug]) {
        directory.bySlug[legacyPageSlug] = page;
      }
      if (pageRouteKey && !directory.byRouteKey[pageRouteKey]) {
        directory.byRouteKey[pageRouteKey] = page;
      }
    }
  }

  return directory;
}

function ensureArtistDirectoryLoaded() {
  if (artistDirectoryLoadPromise) {
    return artistDirectoryLoadPromise;
  }

  artistDirectoryLoadPromise = fetch(loadArtistCsvPath, { cache: 'no-store' })
    .then((response) => response.ok ? response.text() : '')
    .then((text) => {
      artistDirectory = buildArtistDirectoryFromCsv(text);
      artistDirectoryLoaded = true;
      return artistDirectory;
    })
    .catch(() => {
      artistDirectory = {
        pages: [],
        byId: Object.create(null),
        byName: Object.create(null),
        bySlug: Object.create(null),
        byRouteKey: Object.create(null),
        byLyricTag: Object.create(null)
      };
      artistDirectoryLoaded = true;
      return artistDirectory;
    });

  return artistDirectoryLoadPromise;
}

function getArtistPreviewEntryById(id) {
  return artistDirectory.byId[normalizeArtistDirectoryKey(id)] || null;
}

function getArtistPreviewEntry(value) {
  const key = normalizeArtistDirectoryKey(value);
  if (!key) {
    return null;
  }

  return artistDirectory.byId[key]
    || artistDirectory.byName[key]
    || artistDirectory.byLyricTag[key]
    || null;
}

function getArtistPageEntryBySlug(slug, hashToken) {
  return getArtistPageEntryBySlugWithHash(slug, hashToken);
}

function getArtistPageEntryBySlugWithHash(slug, hashToken) {
  const normalizedSlug = normalizeArtistPageSlug(slug);
  const normalizedHash = normalizeArtistPageHashToken(hashToken);
  const routeKey = normalizedSlug
    ? ('/artists/' + normalizedSlug + (normalizedHash ? ('#' + normalizedHash) : ''))
    : '';

  return (routeKey && artistDirectory.byRouteKey[routeKey])
    || artistDirectory.bySlug[normalizedSlug]
    || artistDirectory.bySlug[normalizeArtistPageSlug(slug)]
    || null;
}

function escapeArtistHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function isArtistMentionBoundary(char) {
  if (!char) {
    return true;
  }
  return !/[A-Za-z0-9]/.test(char);
}

function getArtistMentionPatterns() {
  const patterns = [];
  const seen = Object.create(null);

  function pushPattern(value, artist) {
    const raw = String(value || '').trim();
    const normalized = normalizeArtistDirectoryKey(raw);
    if (!normalized || seen[normalized] || !artist) {
      return;
    }

    seen[normalized] = true;
    patterns.push({
      needle: normalized,
      artist
    });
  }

  (artistDirectory.pages || []).forEach((page) => {
    (page.aliases || []).forEach((alias) => {
      pushPattern(alias.id, alias);
      pushPattern(alias.name, alias);
    });

    (page.names || []).forEach((name, index) => {
      pushPattern(name, (page.aliases || [])[index] || (page.aliases || [])[0] || null);
    });
  });

  patterns.sort((left, right) => right.needle.length - left.needle.length);
  return patterns;
}

function buildArtistMentionRanges(entry) {
  const source = String(entry || '');
  const normalizedSource = source.toLowerCase();
  const ranges = [];
  const patterns = getArtistMentionPatterns();

  patterns.forEach((pattern) => {
    let index = normalizedSource.indexOf(pattern.needle);
    while (index !== -1) {
      const end = index + pattern.needle.length;
      const overlaps = ranges.some((range) => !(end <= range.start || index >= range.end));
      const boundaryBefore = isArtistMentionBoundary(source[index - 1] || '');
      const boundaryAfter = isArtistMentionBoundary(source[end] || '');

      if (!overlaps && boundaryBefore && boundaryAfter) {
        ranges.push({
          start: index,
          end,
          artist: pattern.artist
        });
      }

      index = normalizedSource.indexOf(pattern.needle, index + 1);
    }
  });

  ranges.sort((left, right) => left.start - right.start);
  return ranges;
}

function buildArtistMentionLinkHtml(text, artist) {
  const href = String((artist && artist.href) || '').trim()
    || ((artist && artist.pageSlug)
      ? (typeof window.toSiteHref === 'function'
        ? window.toSiteHref('/artists/' + artist.pageSlug)
        : ('/artists/' + artist.pageSlug))
      : '');

  return '<a href="' + escapeArtistHtml(href) + '" class="artist-credit-link" data-artist-preview-id="' + escapeArtistHtml(artist.id) + '">' + escapeArtistHtml(text) + '</a>';
}

function buildArtistCreditEntryHtml(entry) {
  const source = String(entry || '');
  const ranges = buildArtistMentionRanges(source);
  if (!ranges.length) {
    const artist = getArtistPreviewEntry(source);
    if (!artist) {
      return escapeArtistHtml(source);
    }

    return buildArtistMentionLinkHtml(source, artist);
  }

  let cursor = 0;
  let html = '';
  ranges.forEach((range) => {
    if (range.start > cursor) {
      html += escapeArtistHtml(source.slice(cursor, range.start));
    }

    html += buildArtistMentionLinkHtml(source.slice(range.start, range.end), range.artist);
    cursor = range.end;
  });

  if (cursor < source.length) {
    html += escapeArtistHtml(source.slice(cursor));
  }

  return html;
}

function buildArtistCreditHtml(value) {
  const entries = splitArtistDataValues(value);
  if (!entries.length) {
    return '';
  }

  return entries.map((entry) => buildArtistCreditEntryHtml(entry)).join('<br>');
}

function ensureArtistPreviewStyles() {
  if (document.getElementById('artistPreviewStyles')) {
    return;
  }

  const style = document.createElement('style');
  style.id = 'artistPreviewStyles';
  style.textContent = [
    '.artist-preview-popover{position:fixed;z-index:1100;min-width:300px;max-width:calc(100vw - 24px);opacity:0;visibility:hidden;pointer-events:none;transition:opacity .2s,visibility .2s;}',
    '.artist-preview-popover.visible{opacity:1;visibility:visible;}',
    '.artist-preview-popover::before{content:"";position:absolute;left:50%;transform:translateX(-50%);width:0;height:0;bottom:-5px;border-left:5px solid transparent;border-right:5px solid transparent;border-top:5px solid var(--theme-color-border_pill);}',
    '.artist-preview-popover.below::before{top:-5px;bottom:auto;border-left:5px solid transparent;border-right:5px solid transparent;border-bottom:5px solid var(--theme-color-border_pill);border-top:none;}',
    '.artist-preview-card{display:grid;grid-template-columns:72px minmax(0,1fr);gap:12px;padding:14px 16px;border-radius:0;border:1px solid var(--theme-color-border_pill);background:#ffffff;color:#111111;box-shadow:0 2px 8px var(--theme-color-shadow_soft);}',
    '.artist-preview-media img{display:block;width:72px;height:72px;object-fit:cover;border-radius:6px;}',
    '.artist-preview-title{font-size:10.944px;font-weight:700;line-height:16.416px;color:#111111;margin:0 0 2px;}',
    '.artist-preview-description{font-size:10.944px;line-height:16.416px;color:#111111;overflow-wrap:break-word;}',
    '@media (max-width:760px){.artist-preview-popover{min-width:min(300px,calc(100vw - 24px));}.artist-preview-card{grid-template-columns:64px minmax(0,1fr);} .artist-preview-media img{width:64px;height:64px;}}'
  ].join('');
  document.head.appendChild(style);
}

function ensureArtistPreviewPopover() {
  ensureArtistPreviewStyles();

  let popover = document.getElementById('artistPreviewPopover');
  if (popover) {
    return popover;
  }

  popover = document.createElement('div');
  popover.id = 'artistPreviewPopover';
  popover.className = 'artist-preview-popover';
  popover.setAttribute('aria-hidden', 'true');
  popover.innerHTML = '<div class="artist-preview-card"><div class="artist-preview-media"><img alt=""></div><div class="artist-preview-copy"><div class="artist-preview-title"></div><div class="artist-preview-description"></div></div></div>';
  document.body.appendChild(popover);
  return popover;
}

function hideArtistPreviewPopover() {
  const popover = document.getElementById('artistPreviewPopover');
  if (!popover) {
    return;
  }

  window.__activeArtistPreviewTarget = null;
  popover.classList.remove('visible');
  popover.setAttribute('aria-hidden', 'true');
}

function positionArtistPreviewPopover(popover, target) {
  if (!popover || !target) {
    return;
  }

  const rect = target.getBoundingClientRect();
  const popoverRect = popover.getBoundingClientRect();
  const top = rect.top - popoverRect.height - 18;
  const left = rect.left + (rect.width / 2) - (popoverRect.width / 2);
  const boundedLeft = Math.max(12, Math.min(left, window.innerWidth - popoverRect.width - 12));
  const fallbackTop = rect.bottom + 18;
  const placeBelow = !(top > 12);

  popover.style.left = boundedLeft + 'px';
  popover.style.top = (placeBelow ? fallbackTop : top) + 'px';
  popover.classList.toggle('below', placeBelow);
}

function showArtistPreviewPopover(target) {
  const artistId = target ? target.getAttribute('data-artist-preview-id') : '';
  const artist = getArtistPreviewEntryById(artistId);
  if (!target || !artist) {
    hideArtistPreviewPopover();
    return;
  }

  const popover = ensureArtistPreviewPopover();
  const card = popover.querySelector('.artist-preview-card');
  const media = popover.querySelector('.artist-preview-media');
  const image = media ? media.querySelector('img') : null;
  const title = popover.querySelector('.artist-preview-title');
  const description = popover.querySelector('.artist-preview-description');

  if (card) {
    card.style.setProperty('--artist-preview-color', artist.color || '#F05E55');
  }
  if (image) {
    if (artist.image) {
      image.src = artist.image;
      image.alt = artist.name;
      media.style.display = '';
      image.onload = function () {
        if (window.__activeArtistPreviewTarget) {
          positionArtistPreviewPopover(popover, window.__activeArtistPreviewTarget);
        }
      };
      image.onerror = function () {
        media.style.display = 'none';
        if (window.__activeArtistPreviewTarget) {
          positionArtistPreviewPopover(popover, window.__activeArtistPreviewTarget);
        }
      };
    } else {
      image.removeAttribute('src');
      image.alt = '';
      media.style.display = 'none';
    }
  }
  if (title) {
    title.textContent = artist.name;
  }
  if (description) {
    description.textContent = artist.description || '';
  }

  window.__activeArtistPreviewTarget = target;
  popover.classList.add('visible');
  popover.setAttribute('aria-hidden', 'false');
  positionArtistPreviewPopover(popover, target);
  requestAnimationFrame(function () {
    if (window.__activeArtistPreviewTarget) {
      positionArtistPreviewPopover(popover, window.__activeArtistPreviewTarget);
    }
  });
}

window.addEventListener('scroll', function () {
  const popover = document.getElementById('artistPreviewPopover');
  const target = window.__activeArtistPreviewTarget;
  if (!popover || !target || !popover.classList.contains('visible')) {
    return;
  }
  positionArtistPreviewPopover(popover, target);
}, { passive: true });

window.addEventListener('resize', function () {
  const popover = document.getElementById('artistPreviewPopover');
  const target = window.__activeArtistPreviewTarget;
  if (!popover || !target || !popover.classList.contains('visible')) {
    return;
  }
  positionArtistPreviewPopover(popover, target);
});

function initializeArtistCreditPreviews(scope) {
  const root = scope && scope.querySelectorAll ? scope : document;
  root.querySelectorAll('[data-artist-preview-id]').forEach((link) => {
    if (link.dataset.artistPreviewInitialized === 'true') {
      return;
    }

    link.dataset.artistPreviewInitialized = 'true';
    link.addEventListener('mouseenter', function () {
      showArtistPreviewPopover(link);
    });
    link.addEventListener('focus', function () {
      showArtistPreviewPopover(link);
    });
    link.addEventListener('mouseleave', hideArtistPreviewPopover);
    link.addEventListener('blur', hideArtistPreviewPopover);
  });
}

window.ensureArtistDirectoryLoaded = ensureArtistDirectoryLoaded;
window.getArtistPreviewEntryById = getArtistPreviewEntryById;
window.getArtistPreviewEntry = getArtistPreviewEntry;
window.getArtistPageEntryBySlug = getArtistPageEntryBySlug;
window.initializeArtistCreditPreviews = initializeArtistCreditPreviews;
window.buildArtistCreditHtml = buildArtistCreditHtml;

function populateAlbumPageCoverCredits() {
  ensureCoverArtistsLoaded().finally(function () {
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
  });
}

let albumsCsvRowsCache = null;
const closeupAvailabilityBySlug = Object.create(null);
const closeupAvailabilityPendingBySlug = Object.create(null);
let albumsCsvLoadingPromise = null;

const albumCsvHeaderAliases = {
  album_id: ['album_id', 'album id'],
  album_title: ['album_title', 'album title', 'title', 'page_title', 'page title'],
  album_art: ['album_art', 'album art', 'cover art', 'album image'],
  artists: ['artists', 'artist'],
  mixing: ['mixing', 'mixed by'],
  mastering: ['mastering', 'mastered by'],
  instrumentals: ['instrumentals', 'instrumental', 'instrumentalists'],
  release_date: ['release_date', 'release date'],
  release_date_enabled: ['release_date_enabled', 'release date enabled'],
  artists_enabled: ['artists_enabled', 'artists enabled'],
  mixing_enabled: ['mixing_enabled', 'mixing enabled'],
  mastering_enabled: ['mastering_enabled', 'mastering enabled'],
  instrumentals_enabled: ['instrumentals_enabled', 'instrumentals enabled', 'instrumental enabled'],
  vocalists: ['vocalists', 'vocalist', 'vocals'],
  vocalists_enabled: ['vocalists_enabled', 'vocalists enabled', 'vocalist enabled'],
  listen_text: ['listen_text', 'listen text'],
  listen_links: ['listen_links', 'listen links'],
  listen: ['listen'],
  listen_enabled: ['listen_enabled', 'listen enabled'],
  theme: ['theme', 'version_theme'],
  music_page_section: ['music_page_section', 'music page section', 'music_files_group', 'group', 'music files group']
};

function splitAlbumDataValues(value) {
  return String(value || '')
    .split(/\s*\|\s*/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function isAlbumSidebarFlagEnabled(value) {
  const normalized = String(value || '').trim().toUpperCase();
  if (!normalized) {
    return true;
  }
  return normalized === 'TRUE' || normalized === 'YES' || normalized === '1';
}

function parseAlbumSidebarLegacyPairs(value) {
  const labels = [];
  const links = [];

  splitAlbumDataValues(value).forEach((entry) => {
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

function createAlbumSidebarBlock(labelText) {
  const block = document.createElement('div');
  block.className = 'song-info-block album-info-block';

  const label = document.createElement('div');
  label.className = 'song-info-label album-info-label';
  label.textContent = labelText;

  const content = document.createElement('div');
  content.className = 'song-info-content album-info-content';

  block.appendChild(label);
  block.appendChild(content);
  return block;
}

function populateAlbumSidebarFromRow(sidebar, row) {
  if (!sidebar || !row) {
    return;
  }

  sidebar.innerHTML = '';

  const releaseDateBlock = createAlbumSidebarBlock('Release Date');
  const releaseDateContent = releaseDateBlock.querySelector('.album-info-content');
  const releaseDates = splitAlbumDataValues((row || {}).release_date || '');
  const releaseDateEnabled = isAlbumSidebarFlagEnabled((row || {}).release_date_enabled);
  if (releaseDateEnabled && releaseDates.length > 0) {
    releaseDateContent.innerHTML = releaseDates.join('<br>');
    sidebar.appendChild(releaseDateBlock);
  }

  const artists = splitAlbumDataValues((row || {}).artists || '');
  const artistsEnabled = isAlbumSidebarFlagEnabled((row || {}).artists_enabled);
  if (artistsEnabled && artists.length > 0) {
    const artistsBlock = createAlbumSidebarBlock(artists.length === 1 ? 'Artist' : 'Artists');
    const artistsContent = artistsBlock.querySelector('.album-info-content');
    artistsContent.innerHTML = buildArtistCreditHtml((row || {}).artists || '');
    sidebar.appendChild(artistsBlock);
    initializeArtistCreditPreviews(artistsBlock);
  }

  const mixing = splitAlbumDataValues((row || {}).mixing || '');
  const mixingEnabled = isAlbumSidebarFlagEnabled((row || {}).mixing_enabled);
  if (mixingEnabled && mixing.length > 0) {
    const mixingBlock = createAlbumSidebarBlock('Mixing');
    const mixingContent = mixingBlock.querySelector('.album-info-content');
    mixingContent.innerHTML = buildArtistCreditHtml((row || {}).mixing || '');
    sidebar.appendChild(mixingBlock);
    initializeArtistCreditPreviews(mixingBlock);
  }

  const mastering = splitAlbumDataValues((row || {}).mastering || '');
  const masteringEnabled = isAlbumSidebarFlagEnabled((row || {}).mastering_enabled);
  if (masteringEnabled && mastering.length > 0) {
    const masteringBlock = createAlbumSidebarBlock('Mastering');
    const masteringContent = masteringBlock.querySelector('.album-info-content');
    masteringContent.innerHTML = buildArtistCreditHtml((row || {}).mastering || '');
    sidebar.appendChild(masteringBlock);
    initializeArtistCreditPreviews(masteringBlock);
  }

  const instrumentals = splitAlbumDataValues((row || {}).instrumentals || '');
  const instrumentalsEnabled = isAlbumSidebarFlagEnabled((row || {}).instrumentals_enabled);
  if (instrumentalsEnabled && instrumentals.length > 0) {
    const instrumentalsBlock = createAlbumSidebarBlock('Instrumentals');
    const instrumentalsContent = instrumentalsBlock.querySelector('.album-info-content');
    instrumentalsContent.innerHTML = buildArtistCreditHtml((row || {}).instrumentals || '');
    sidebar.appendChild(instrumentalsBlock);
    initializeArtistCreditPreviews(instrumentalsBlock);
  }

  const vocalists = splitAlbumDataValues((row || {}).vocalists || '');
  const vocalistsEnabled = isAlbumSidebarFlagEnabled((row || {}).vocalists_enabled);
  if (vocalistsEnabled && vocalists.length > 0) {
    const vocalistsBlock = createAlbumSidebarBlock(vocalists.length === 1 ? 'Vocalist' : 'Vocalists');
    const vocalistsContent = vocalistsBlock.querySelector('.album-info-content');
    vocalistsContent.innerHTML = buildArtistCreditHtml((row || {}).vocalists || '');
    sidebar.appendChild(vocalistsBlock);
    initializeArtistCreditPreviews(vocalistsBlock);
  }

  const listenBlock = createAlbumSidebarBlock('Listen');
  const listenEnabled = isAlbumSidebarFlagEnabled((row || {}).listen_enabled);
  if (listenEnabled) {
    let labels = splitAlbumDataValues((row || {}).listen_text || '');
    let links = splitAlbumDataValues((row || {}).listen_links || '');

    if ((!labels.length && !links.length) && (row || {}).listen) {
      const legacy = parseAlbumSidebarLegacyPairs((row || {}).listen);
      labels = legacy.labels;
      links = legacy.links;
    }

    const hasListenEntries = labels.length > 0 || links.length > 0;
    if (hasListenEntries) {
      const normalizedLabels = labels.length ? labels : links;
      const normalizedLinks = links.length ? links : labels.map(() => '');
      const linksEl = createSongSidebarLinks(normalizedLabels, normalizedLinks);
      linksEl.classList.add('album-info-links');
      listenBlock.querySelector('.album-info-content').replaceWith(linksEl);
      sidebar.appendChild(listenBlock);
    }
  }
}

function normalizeAlbumCsvHeader(header) {
  const key = String(header || '').trim().toLowerCase();
  if (!key) {
    return '';
  }

  for (const canonicalKey of Object.keys(albumCsvHeaderAliases)) {
    const aliases = albumCsvHeaderAliases[canonicalKey] || [];
    if (aliases.includes(key)) {
      return canonicalKey;
    }
  }

  return key;
}

function parseAlbumsCsv(text) {
  const rows = [];
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return rows;
  }

  const headers = splitCsvLine(lines[0]).map((header) => normalizeAlbumCsvHeader(header));
  for (let index = 1; index < lines.length; index += 1) {
    const values = splitCsvLine(lines[index]);
    const row = {};
    headers.forEach((header, headerIndex) => {
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

function ensureAlbumsCsvLoaded(onReady) {
  if (Array.isArray(albumsCsvRowsCache)) {
    if (typeof onReady === 'function') {
      onReady(albumsCsvRowsCache);
    }
    return;
  }

  if (!albumsCsvLoadingPromise) {
    const csvUrl = basePath + '/public/csv/JamiePedia Data - Albums.csv';
    albumsCsvLoadingPromise = fetch(csvUrl, { cache: 'no-store' })
      .then((response) => response.ok ? response.text() : '')
      .then((text) => {
        albumsCsvRowsCache = parseAlbumsCsv(text);
        return albumsCsvRowsCache;
      })
      .catch(() => {
        albumsCsvRowsCache = [];
        return albumsCsvRowsCache;
      });
  }

  albumsCsvLoadingPromise.then((rows) => {
    if (typeof onReady === 'function') {
      onReady(rows);
    }
  });
}

function findAlbumRowForCurrentPage(rows) {
  const albumId = getAlbumIdFromCurrentPage();
  if (!albumId || !Array.isArray(rows) || !rows.length) {
    return null;
  }

  return rows.find((row) => String((row || {}).album_id || '').trim().toLowerCase() === albumId) || null;
}

function isAlbumIndexPage() {
  if (document.querySelector('.song-page-wrapper')) {
    return false;
  }

  const albumId = getAlbumIdFromCurrentPage();
  return !!albumId;
}

function switchAlbumTab(tabName) {
  const normalizedTab = String(tabName || '').trim().toLowerCase();
  if (!normalizedTab) {
    return;
  }

  const buttons = Array.from(document.querySelectorAll('.album-page-tabs .song-tab[data-album-tab]'));
  const contents = Array.from(document.querySelectorAll('.album-tab-content[data-album-tab-content]'));

  if (!buttons.length || !contents.length) {
    return;
  }

  buttons.forEach((button) => {
    const target = String(button.getAttribute('data-album-tab') || '').trim().toLowerCase();
    button.classList.toggle('active', target === normalizedTab);
  });

  contents.forEach((content) => {
    const target = String(content.getAttribute('data-album-tab-content') || '').trim().toLowerCase();
    content.classList.toggle('active', target === normalizedTab);
  });
}

function initializeAlbumTabs() {
  const buttons = Array.from(document.querySelectorAll('.album-page-tabs .song-tab[data-album-tab]'));
  if (!buttons.length) {
    return;
  }

  buttons.forEach((button) => {
    button.addEventListener('click', function () {
      const tabName = String(button.getAttribute('data-album-tab') || '').trim().toLowerCase();
      switchAlbumTab(tabName || 'tracklist');
    });
  });

  switchAlbumTab('tracklist');
}

function splitAlbumDisplayTitleLines(value) {
  const lines = String(value || '')
    .split(/\s*\|\s*/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (lines.length) {
    return lines;
  }

  const plain = String(value || '').trim();
  return plain ? [plain] : [];
}

function setAlbumDisplayTitle(node, value) {
  if (!node) {
    return;
  }

  const lines = splitAlbumDisplayTitleLines(value);
  node.textContent = '';

  if (!lines.length) {
    return;
  }

  lines.forEach((line, index) => {
    if (index > 0) {
      node.appendChild(document.createElement('br'));
    }
    node.appendChild(document.createTextNode(line));
  });
}

function getHardcodedAlbumAltTabs(albumId) {
  const normalizedAlbumId = String(albumId || '').trim().toLowerCase();
  if (normalizedAlbumId !== 'cc' && normalizedAlbumId !== 'ccde') {
    return [];
  }

  return [
    { id: 'cc', label: 'CC' },
    { id: 'ccde', label: 'CCDE' }
  ];
}

function appendHardcodedAlbumAltTabs(tabsEl, albumId) {
  if (!tabsEl) {
    return;
  }

  const variants = getHardcodedAlbumAltTabs(albumId);
  if (!variants.length) {
    return;
  }

  const normalizedAlbumId = String(albumId || '').trim().toLowerCase();
  variants.forEach((variant) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'version-tab' + (variant.id === normalizedAlbumId ? ' active' : '');
    button.textContent = variant.label;
    button.addEventListener('click', function () {
      if (variant.id === normalizedAlbumId) {
        return;
      }

      const targetRoute = '/music/' + variant.id;
      window.location.href = typeof window.toSiteHref === 'function'
        ? window.toSiteHref(targetRoute)
        : withBasePath(targetRoute);
    });

    tabsEl.appendChild(button);
  });
}

window.switchAlbumTab = switchAlbumTab;

function buildAlbumPageFromRow(row) {
  const host = document.querySelector('.bodybar, .album-main-col');
  if (!host || !row) {
    return false;
  }

  const albumId = getAlbumIdFromCurrentPage();
  if (!albumId) {
    return false;
  }

  const title = String((row || {}).album_title || '').trim() || pathToPageName('/music/' + albumId + '.html');
  const artists = String((row || {}).artists || '').trim();
  const releaseDate = String((row || {}).release_date || '').trim();
  const albumArt = String((row || {}).album_art || '').trim();
  const themeId = String((row || {}).theme || '').trim();

  if (themeId) {
    if (typeof window.requestThemeById === 'function') {
      window.requestThemeById(themeId);
    } else if (typeof window.applyThemeById === 'function') {
      window.applyThemeById(themeId);
    } else {
      document.documentElement.setAttribute('data-theme-id', themeId);
    }
  }

  document.title = title;

  host.className = 'album-main-col';
  host.innerHTML = '';

  const tabsContainer = document.createElement('div');
  tabsContainer.className = 'song-tabs-container album-page-tabs-container';

  const tabs = document.createElement('div');
  tabs.className = 'song-tabs album-page-tabs';

  const tracklistTab = document.createElement('button');
  tracklistTab.className = 'song-tab active';
  tracklistTab.type = 'button';
  tracklistTab.setAttribute('data-album-tab', 'tracklist');
  tracklistTab.textContent = 'Tracklist';

  const summaryTab = document.createElement('button');
  summaryTab.className = 'song-tab';
  summaryTab.type = 'button';
  summaryTab.setAttribute('data-album-tab', 'summary');
  summaryTab.textContent = 'Summary';

  const extendedTab = document.createElement('button');
  extendedTab.className = 'song-tab';
  extendedTab.type = 'button';
  extendedTab.setAttribute('data-album-tab', 'extended');
  extendedTab.textContent = 'Extended Info';

  const spacer = document.createElement('div');
  spacer.className = 'tabs-spacer';

  tabs.appendChild(tracklistTab);
  tabs.appendChild(summaryTab);
  tabs.appendChild(extendedTab);
  tabs.appendChild(spacer);
  appendHardcodedAlbumAltTabs(tabs, albumId);
  tabsContainer.appendChild(tabs);

  const header = document.createElement('div');
  header.className = 'album-layout';

  const coverContainer = document.createElement('div');
  coverContainer.className = 'album-cover-container';

  const image = document.createElement('img');
  image.alt = title;
  if (albumArt) {
    image.src = basePath + '/public/images/cover-art/' + albumArt;
  }
  coverContainer.appendChild(image);

  const coverCredit = document.createElement('div');
  coverCredit.className = 'album-cover-credit';
  coverCredit.textContent = 'Artwork by';
  coverContainer.appendChild(coverCredit);

  const info = document.createElement('div');
  info.className = 'album-page-left';

  const infoHeader = document.createElement('div');
  infoHeader.className = 'album-info';

  const titleEl = document.createElement('h1');
  setAlbumDisplayTitle(titleEl, title);
  infoHeader.appendChild(titleEl);

  const meta = document.createElement('div');
  meta.className = 'album-meta';
  if (artists) {
    const byP = document.createElement('p');
    byP.innerHTML = 'By ' + buildArtistCreditHtml(artists) + '.';
    meta.appendChild(byP);
    initializeArtistCreditPreviews(byP);
  }
  if (releaseDate) {
    const releaseP = document.createElement('p');
    releaseP.textContent = 'Released ' + releaseDate + '.';
    meta.appendChild(releaseP);
  }
  infoHeader.appendChild(meta);

  const tracklistContent = document.createElement('div');
  tracklistContent.id = 'album-content-tracklist';
  tracklistContent.className = 'album-tab-content active';
  tracklistContent.setAttribute('data-album-tab-content', 'tracklist');

  const songList = document.createElement('div');
  songList.className = 'song-list';
  tracklistContent.appendChild(songList);

  const summaryContent = document.createElement('div');
  summaryContent.id = 'album-content-summary';
  summaryContent.className = 'album-tab-content';
  summaryContent.setAttribute('data-album-tab-content', 'summary');

  const extendedContent = document.createElement('div');
  extendedContent.id = 'album-content-extended';
  extendedContent.className = 'album-tab-content';
  extendedContent.setAttribute('data-album-tab-content', 'extended');

  info.appendChild(infoHeader);
  info.appendChild(tracklistContent);
  info.appendChild(summaryContent);
  info.appendChild(extendedContent);

  const rightRail = document.createElement('div');
  rightRail.className = 'album-page-right';

  rightRail.appendChild(coverContainer);

  const navButtons = document.createElement('div');
  navButtons.className = 'album-nav-buttons';
  navButtons.innerHTML = '<a href="javascript:void(0);" class="album-nav-link">\u2190 Previous</a><a href="javascript:void(0);" class="album-nav-link">Next \u2192</a>';

  rightRail.appendChild(navButtons);

  const infoSidebar = document.createElement('div');
  infoSidebar.className = 'album-info-sidebar';
  populateAlbumSidebarFromRow(infoSidebar, row);
  rightRail.appendChild(infoSidebar);

  header.appendChild(info);
  header.appendChild(rightRail);

  const bodyContent = document.createElement('div');
  bodyContent.className = 'bodybar album-body-panel';
  bodyContent.appendChild(header);

  host.appendChild(tabsContainer);
  host.appendChild(bodyContent);

  return true;
}

function initializeAlbumPageFromCsv(onReady) {
  const done = typeof onReady === 'function' ? onReady : function () {};
  if (!isAlbumIndexPage()) {
    done();
    return;
  }

  ensureAlbumsCsvLoaded(function (rows) {
    const row = findAlbumRowForCurrentPage(rows || []);
    if (!row) {
      done();
      return;
    }

    ensureArtistDirectoryLoaded().finally(function () {
      buildAlbumPageFromRow(row);
      done();
    });
  });
}

let pageInitializersRan = false;

function runPageInitializers() {
  if (pageInitializersRan) {
    return;
  }
  pageInitializersRan = true;

  const albumPage = isAlbumIndexPage();

  initializeAlbumPageFromCsv(function () {
    initializeAlbumTabs();
    populateAlbumPageCoverCredits();
    initializeAlbumSongListFromCsv();
    initializeAlbumSummary();
    initializeAlbumExtendedInfo();
    initializeDataNavButtons();

    if (albumPage && typeof window.releaseThemeGate === 'function') {
      window.releaseThemeGate();
    }
  });
  initializeSongSidebarData();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', runPageInitializers, { once: true });
} else {
  runPageInitializers();
}

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
  page_path: ['page_path', 'path id', 'path_id', 'path'],
  page_title: ['page_title', 'page title'],
  version_theme: ['version_theme', 'theme'],
  song_length: ['song_length', 'song length'],
  alt_tab: ['alt_tab', 'alt tab status?'],
  tab_name: ['tab_name', 'alt tab name'],
  album_id: ['album_id'],
  album_track: ['album_track', 'track number'],
  album_art_paths: ['album_art_paths', 'album path', 'album art'],
  album_tab_labels: ['album_tab_labels', 'cover art labels'],
  music_page_section: ['music_page_section', 'music page section'],
  appears_on: ['appears_on', 'appears on text'],
  release_date: ['release_date', 'release date'],
  artists: ['artists'],
  mixing: ['mixing', 'mixed by'],
  mastering: ['mastering', 'mastered by'],
  instrumentals: ['instrumentals', 'instrumental', 'instrumentalists'],
  vocalists: ['vocalists'],
  listen_text: ['listen_text', 'listen text'],
  listen_links: ['listen_links', 'listen links'],
  close_up: ['close_up', 'close up']
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

  fetch(basePath + '/public/csv/JamiePedia Data - Songs.csv', { cache: 'no-store' })
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

function ensureSongCloseupAvailabilityLoaded(row, onReady) {
  const slug = getCurrentSongSidebarSlug(row);
  if (!slug) {
    if (typeof onReady === 'function') {
      onReady();
    }
    return;
  }

  if (Object.prototype.hasOwnProperty.call(closeupAvailabilityBySlug, slug)) {
    if (typeof onReady === 'function') {
      onReady();
    }
    return;
  }

  if (!Array.isArray(closeupAvailabilityPendingBySlug[slug])) {
    closeupAvailabilityPendingBySlug[slug] = [];
  }

  if (typeof onReady === 'function') {
    closeupAvailabilityPendingBySlug[slug].push(onReady);
  }

  if (closeupAvailabilityPendingBySlug[slug].length > 1) {
    return;
  }

  const textPath = basePath + '/public/close%20ups/text/' + encodeURIComponent(slug) + '.txt';
  fetch(textPath, { cache: 'no-store' })
    .then((response) => {
      closeupAvailabilityBySlug[slug] = Boolean(response && response.ok);
    })
    .catch(() => {
      closeupAvailabilityBySlug[slug] = false;
    })
    .finally(() => {
      const callbacks = closeupAvailabilityPendingBySlug[slug] || [];
      closeupAvailabilityPendingBySlug[slug] = [];
      callbacks.forEach((callback) => {
        try {
          callback();
        } catch (_error) {
          // Ignore callback errors so sidebar hydration can continue.
        }
      });
    });
}

const songSidebarFieldOrder = [
  { key: 'appears_on', label: 'Appears On', aliases: ['appears on'] },
  { key: 'release_date', label: 'Release Date', aliases: ['release date'] },
  { key: 'artists', label: 'Artists', aliases: ['artist', 'artists'] },
  { key: 'mixing', label: 'Mixing', aliases: ['mixing', 'mixed by'] },
  { key: 'mastering', label: 'Mastering', aliases: ['mastering', 'mastered by'] },
  { key: 'instrumentals', label: 'Instrumentals', aliases: ['instrumentals', 'instrumentalists', 'instrumental'] },
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

function getSongSidebarRowPathValue(row) {
  return String((row || {}).page_path || (row || {}).path_id || (row || {}).path || '').trim();
}

function songSidebarIsSecretSection(value) {
  return String(value || '').trim().toLowerCase().includes('bonus');
}

function getSongSidebarAlbumTitleById(albumId) {
  const target = String(albumId || '').trim().toLowerCase();
  if (!target || !Array.isArray(albumsCsvRowsCache)) {
    return '';
  }

  const match = albumsCsvRowsCache.find((row) => String((row || {}).album_id || '').trim().toLowerCase() === target);
  return String((match || {}).album_title || '').trim();
}

function parseSongSidebarTrackNumber(value) {
  const match = String(value || '').match(/\d+/);
  return match ? Number(match[0]) : NaN;
}

function getSongSidebarPrimaryPathId(row) {
  const normalizedPath = normalizeSongSidebarPathKey(getSongSidebarRowPathValue(row));
  const base = String(normalizedPath || '').split('#')[0];
  return base.split('/').filter(Boolean).pop() || '';
}

function getSongSidebarAlbumTrackTotals(rows) {
  const totals = new Map();
  const seenByAlbum = new Map();

  (rows || []).forEach((row) => {
    const rowPath = getSongSidebarRowPathValue(row);
    if (!rowPath) {
      return;
    }

    if (songSidebarIsSecretSection((row || {}).music_page_section || '')) {
      return;
    }

    const uniquePathKey = normalizeSongSidebarPathKey(rowPath);
    if (!uniquePathKey) {
      return;
    }

    const albumIds = splitSongSidebarValues((row || {}).album_id || '');
    albumIds.forEach((albumIdRaw) => {
      const albumId = String(albumIdRaw || '').trim().toLowerCase();
      if (!albumId || albumId === 'x') {
        return;
      }

      if (!seenByAlbum.has(albumId)) {
        seenByAlbum.set(albumId, new Set());
      }
      seenByAlbum.get(albumId).add(uniquePathKey);
    });
  });

  seenByAlbum.forEach((songs, albumId) => {
    totals.set(albumId, songs.size);
  });

  return totals;
}

function deriveSongSidebarAppearsOnLines(row) {
  const sourceRow = getSongSidebarMainRowForCurrentPage() || row;
  const albumIds = splitSongSidebarValues((sourceRow || {}).album_id || '');
  const trackValues = splitSongSidebarValues((sourceRow || {}).album_track || '');
  const totals = getSongSidebarAlbumTrackTotals(window.__songSidebarCsvRows || []);

  const lines = [];
  albumIds.forEach((albumIdRaw, index) => {
    const albumId = String(albumIdRaw || '').trim();
    if (!albumId || albumId.toLowerCase() === 'x') {
      return;
    }

    const trackNumber = parseSongSidebarTrackNumber(trackValues[index] || trackValues[0] || '');
    const normalizedAlbumId = albumId.toLowerCase();
    const totalTracks = Number(totals.get(normalizedAlbumId) || 0);
    const displayTotal = totalTracks > 0 ? totalTracks : (Number.isFinite(trackNumber) ? trackNumber : 0);
    const albumTitle = getSongSidebarAlbumTitleById(albumId) || albumId;

    if (Number.isFinite(trackNumber) && displayTotal > 0) {
      lines.push(String(trackNumber) + '/' + String(displayTotal) + ' - ' + albumTitle);
      return;
    }

    if (displayTotal > 0) {
      lines.push('?/' + String(displayTotal) + ' - ' + albumTitle);
      return;
    }

    lines.push(albumTitle);
  });

  return lines;
}

function escapeSongSidebarHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildSongSidebarAppearsOnHtml(row) {
  const sourceRow = getSongSidebarMainRowForCurrentPage() || row;
  const albumIds = splitSongSidebarValues((sourceRow || {}).album_id || '');
  const trackValues = splitSongSidebarValues((sourceRow || {}).album_track || '');
  const totals = getSongSidebarAlbumTrackTotals(window.__songSidebarCsvRows || []);

  const lines = [];
  albumIds.forEach((albumIdRaw, index) => {
    const albumId = String(albumIdRaw || '').trim();
    if (!albumId || albumId.toLowerCase() === 'x') {
      return;
    }

    const trackNumber = parseSongSidebarTrackNumber(trackValues[index] || trackValues[0] || '');
    const normalizedAlbumId = albumId.toLowerCase();
    const totalTracks = Number(totals.get(normalizedAlbumId) || 0);
    const displayTotal = totalTracks > 0 ? totalTracks : (Number.isFinite(trackNumber) ? trackNumber : 0);
    const albumTitle = getSongSidebarAlbumTitleById(albumId) || albumId;
    const albumHref = typeof window.toSiteHref === 'function' ? window.toSiteHref('/music/' + normalizedAlbumId) : '/music/' + normalizedAlbumId;

    let label = albumTitle;
    if (Number.isFinite(trackNumber) && displayTotal > 0) {
      label = String(trackNumber) + '/' + String(displayTotal) + ' - ' + albumTitle;
    } else if (displayTotal > 0) {
      label = '?/' + String(displayTotal) + ' - ' + albumTitle;
    }

    lines.push('<a href="' + escapeSongSidebarHtml(albumHref) + '">' + escapeSongSidebarHtml(label) + '</a>');
  });

  return lines.join('<br>');
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

  const csvUrl = basePath + '/public/csv/JamiePedia Data - Songs.csv';
  if (!window.__songSidebarCsvRows) {
    return null;
  }

  const hashToken = normalizeSongSidebarHashToken(window.location.hash);
  const currentCandidate = currentPath.replace(/\/$/, '');
  const currentPathId = currentCandidate.split('/').filter(Boolean).pop() || '';
  const rows = window.__songSidebarCsvRows;

  if (hashToken) {
    const hashCandidate = currentCandidate + '#' + hashToken;
    const hashMatch = rows.find((row) => {
      const pagePath = getSongSidebarRowPathValue(row);
      if (!pagePath) {
        return false;
      }
      const normalized = normalizeSongSidebarPathKey(pagePath);
      if (normalized === hashCandidate) {
        return true;
      }

      const rowPathId = normalized.split('#')[0].split('/').filter(Boolean).pop() || '';
      const rowHashToken = normalizeSongSidebarHashToken(normalized.split('#')[1] || '');
      return rowPathId === currentPathId && rowHashToken === hashToken;
    });

    if (hashMatch) {
      return hashMatch;
    }
  }

  return rows.find((row) => {
    const pagePath = getSongSidebarRowPathValue(row);
    if (!pagePath) {
      return false;
    }

    const normalized = normalizeSongSidebarPathKey(pagePath);
    if (normalized.includes('#')) {
      return false;
    }

    if (normalized === currentCandidate) {
      return true;
    }

    const rowPathId = normalized.split('/').filter(Boolean).pop() || '';
    return rowPathId === currentPathId;
  }) || null;
}

function getSongSidebarMainRowForCurrentPage() {
  const current = getSongSidebarRowForCurrentPage();
  const rows = Array.isArray(window.__songSidebarCsvRows) ? window.__songSidebarCsvRows : [];
  if (!current || !rows.length) {
    return current;
  }

  const currentPathId = normalizeSongSidebarPathKey(getSongSidebarRowPathValue(current)).split('/').filter(Boolean).pop() || '';
  if (!currentPathId) {
    return current;
  }

  const scopedRows = rows.filter((row) => {
    const rowPath = normalizeSongSidebarPathKey(getSongSidebarRowPathValue(row));
    const rowPathId = rowPath.split('/').filter(Boolean).pop() || '';
    return rowPathId === currentPathId;
  });

  return scopedRows.find((row) => {
    const rowPath = getSongSidebarRowPathValue(row);
    if (rowPath.includes('#')) {
      return false;
    }
    return String((row || {}).alt_tab || '').trim().toLowerCase() !== 'alt tab';
  }) || scopedRows.find((row) => !getSongSidebarRowPathValue(row).includes('#')) || current;
}

function getCurrentSongSidebarSlug(row) {
  const sourceRow = getSongSidebarMainRowForCurrentPage() || row || null;
  const fromRow = getSongSidebarPrimaryPathId(sourceRow);
  if (fromRow) {
    return String(fromRow).toLowerCase();
  }

  const currentPath = toExtensionlessPath(window.location.pathname);
  const parts = currentPath.split('/').filter(Boolean);
  if (parts.length >= 2 && parts[0] === 'music') {
    return String(parts[1] || '').toLowerCase();
  }

  return '';
}

function getAutomaticSongCloseupHref(row) {
  const slug = getCurrentSongSidebarSlug(row);
  if (!slug) {
    return '';
  }

  if (!Object.prototype.hasOwnProperty.call(closeupAvailabilityBySlug, slug)) {
    return '';
  }

  if (!closeupAvailabilityBySlug[slug]) {
    return '';
  }

  return '/music/' + slug + '#close-up';
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
  if (fieldKey === 'appears_on') {
    return buildSongSidebarAppearsOnHtml(row);
  }

  if (['artists', 'mixing', 'mastering', 'instrumentals', 'vocalists'].includes(fieldKey)) {
    return buildArtistCreditHtml(value);
  }

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

  return entries.join('<br>');
}

function populateSongSidebarBlock(block, row, key) {
  if (!block) {
    return;
  }

  const labelEl = block.querySelector('.song-info-label');
  const contentEl = block.querySelector('.song-info-content, .song-links');
  let hasContent = false;

  if (key === 'listen') {
    const labels = splitSongSidebarValues(row.listen_text || '');
    const links = splitSongSidebarValues(row.listen_links || '');

    if (labels.length || links.length) {
      hasContent = true;
    } else if (row.listen) {
      const legacy = parseLegacySongSidebarPairs(row.listen);
      hasContent = legacy.labels.length > 0 || legacy.links.some((entry) => String(entry || '').trim());
    }
  } else {
    if (key === 'close_up') {
      hasContent = !!getAutomaticSongCloseupHref(row);
    } else
    if (key === 'appears_on') {
      hasContent = deriveSongSidebarAppearsOnLines(row).length > 0;
    } else {
      hasContent = splitSongSidebarValues(row[key] || '').length > 0;
    }
  }

  if (!hasContent) {
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

  if (key === 'close_up') {
    const closeupHref = getAutomaticSongCloseupHref(row);
    if (!closeupHref) {
      if (contentEl) {
        contentEl.textContent = '';
      }
      return;
    }

    const labels = ['View Close-up'];
    const links = [closeupHref];
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

  const value = key === 'appears_on'
    ? '__computed__'
    : String(row[key] || '').trim();
  if (!value) {
    if (contentEl) {
      contentEl.textContent = '';
    }
    return;
  }

  const outputHtml = buildSongSidebarValueHtml(key, value, row);
  if (contentEl && contentEl.classList && contentEl.classList.contains('song-info-content')) {
    contentEl.innerHTML = outputHtml;
    initializeArtistCreditPreviews(contentEl);
  } else {
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'song-info-content';
    contentWrapper.innerHTML = outputHtml;
    initializeArtistCreditPreviews(contentWrapper);
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

  const sidebarContainer = rightView.querySelector('.song-info-sidebar') || rightView;

  const block = createSongSidebarBlock(field);
  sidebarContainer.appendChild(block);
  return block;
}

function initializeSongSidebarData() {
  if (!document.querySelector('.song-page-wrapper')) {
    return;
  }

  if (!artistDirectoryLoaded) {
    ensureArtistDirectoryLoaded().finally(function () {
      initializeSongSidebarData();
    });
    return;
  }

  if (!isSongSidebarCsvLoaded()) {
    ensureSongSidebarCsvLoaded(function () {
      initializeSongSidebarData();
    });
    return;
  }

  if (!Array.isArray(albumsCsvRowsCache)) {
    ensureAlbumsCsvLoaded(function () {
      initializeSongSidebarData();
    });
    return;
  }

  const row = getSongSidebarRowForCurrentPage();
  if (!row) {
    return;
  }

  const slug = getCurrentSongSidebarSlug(row);
  if (slug && !Object.prototype.hasOwnProperty.call(closeupAvailabilityBySlug, slug)) {
    ensureSongCloseupAvailabilityLoaded(row, function () {
      initializeSongSidebarData();
    });
    return;
  }

  const sidebarScope = getActiveSongSidebarScope();
  songSidebarFieldOrder.forEach((field) => {
    if (field && field.key === 'close_up') {
      return;
    }

    const block = getOrCreateSongSidebarBlock(sidebarScope, field);

    if (block) {
      populateSongSidebarBlock(block, row, field.key);
    }
  });

  if (typeof addSocialMediaIcons === 'function') {
    addSocialMediaIcons();
  }
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
  const raw = getSongSidebarRowPathValue(row);
  if (!raw) {
    return '#';
  }

  const normalized = normalizeSongSidebarPathKey(raw);
  if (!normalized) {
    return '#';
  }

  const parts = normalized.split('#');
  const slug = (parts[0] || '').split('/').filter(Boolean).pop() || '';
  if (!slug) {
    return '#';
  }

  const hash = normalizeSongSidebarHashToken(parts[1] || '');
  return hash ? ('/music/' + slug + '#' + hash) : ('/music/' + slug);
}

function rowToAlbumSongTitle(row) {
  const pageTitle = String((row || {}).page_title || '').trim();
  if (pageTitle) {
    return pageTitle.split(/\s*\|\s*/).filter(Boolean).join(' ');
  }

  const pathPart = String(getSongSidebarRowPathValue(row) || '').split('#')[0];
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
  const songListEl = document.querySelector('#album-content-tracklist .song-list');
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

var TRACKLIST_COLLAPSE_STORAGE_KEY = 'jamiepedia.tracklistSidebarCollapsed';

function isTracklistSidebarCollapsed() {
  try {
    return window.localStorage && window.localStorage.getItem(TRACKLIST_COLLAPSE_STORAGE_KEY) === '1';
  } catch (_error) {
    return false;
  }
}

function setTracklistSidebarCollapsed(collapsed) {
  try {
    if (window.localStorage) {
      window.localStorage.setItem(TRACKLIST_COLLAPSE_STORAGE_KEY, collapsed ? '1' : '0');
    }
  } catch (_error) {
    // Ignore storage errors so UI still works in restrictive browser modes.
  }
}

function applyTracklistSidebarCollapseState(sidebarEl, collapsed) {
  if (!sidebarEl) {
    return;
  }

  sidebarEl.classList.toggle('is-collapsed', Boolean(collapsed));

  var trigger = sidebarEl.querySelector('.tracklist-collapse-trigger');
  if (trigger) {
    trigger.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    trigger.setAttribute('aria-label', collapsed ? 'Expand tracklist' : 'Collapse tracklist');
  }

  var listWrap = sidebarEl.querySelector('.tracklist-list-wrap');
  if (listWrap) {
    if (!collapsed) {
      var listEl = listWrap.querySelector('.tracklist-list');
      var measuredHeight = listEl ? listEl.scrollHeight : 0;
      if (measuredHeight > 0) {
        listWrap.style.setProperty('--tracklist-content-height', measuredHeight + 'px');
      } else {
        listWrap.style.removeProperty('--tracklist-content-height');
      }
    }
  }
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

  var collapseTrigger = document.createElement('button');
  collapseTrigger.type = 'button';
  collapseTrigger.className = 'tracklist-collapse-trigger';
  collapseTrigger.setAttribute('aria-label', 'Collapse tracklist');
  collapseTrigger.setAttribute('aria-expanded', 'true');

  var collapseChevron = document.createElement('span');
  collapseChevron.className = 'tracklist-collapse-chevron';
  collapseChevron.setAttribute('aria-hidden', 'true');
  collapseTrigger.appendChild(collapseChevron);

  collapseTrigger.addEventListener('click', function (event) {
    event.preventDefault();
    event.stopPropagation();
    var nextCollapsed = !el.classList.contains('is-collapsed');
    applyTracklistSidebarCollapseState(el, nextCollapsed);
    setTracklistSidebarCollapsed(nextCollapsed);
  });

  headerDiv.appendChild(collapseTrigger);

  var listEl = document.createElement(useOrderedList ? 'ol' : 'ul');
  listEl.className = 'tracklist-list';

  entries.forEach(function (entry) {
    var li = document.createElement('li');
    li.className = 'tracklist-item';
    var entryPath = String(entry.path || '');
    var entryKey = normalizeSongSidebarPathKey(entryPath);
    if (!entryKey) {
      entryKey = toExtensionlessPath(entryPath);
    }
    var entryPointer = entryKey.split('/').filter(Boolean).pop() || '';
    var currentPointer = String(currentPath || '').split('/').filter(Boolean).pop() || '';
    var currentHasHash = String(currentPath || '').indexOf('#') !== -1;
    if (entryKey === currentPath || (!currentHasHash && entryPointer && currentPointer && entryPointer === currentPointer)) {
      li.classList.add('tracklist-current');
    }
    var a = document.createElement('a');
    a.href = 'javascript:void(0);';
    a.textContent = entry.name || pathToPageName(entry.path);
    a.addEventListener('click', function () {
      window.location.href = typeof window.toSiteHref === 'function'
        ? window.toSiteHref(entryPath)
        : withBasePath(entryPath.startsWith('/') ? entryPath : ('/' + entryPath));
    });
    li.appendChild(a);
    listEl.appendChild(li);
  });

  var listWrap = document.createElement('div');
  listWrap.className = 'tracklist-list-wrap';
  listWrap.appendChild(listEl);

  el.appendChild(headerDiv);
  el.appendChild(listWrap);
  return el;
}

function getPrimaryAlbumIdForSongRow(row) {
  const ids = splitSongSidebarValues((row || {}).album_id || '')
    .map((value) => String(value || '').trim().toLowerCase())
    .filter((value) => value && value !== 'x');
  return ids[0] || '';
}

function applyHardcodedTracklistAlbumOverride(row, albumId) {
  const normalizedAlbumId = String(albumId || '').trim().toLowerCase();
  if (!row || normalizedAlbumId !== 'cc') {
    return normalizedAlbumId;
  }

  const rowAlbumIds = splitSongSidebarValues((row || {}).album_id || '')
    .map((value) => String(value || '').trim().toLowerCase())
    .filter((value) => value && value !== 'x');

  // Shared Constant Companions songs should always use the Deluxe tracklist sidebar.
  if (rowAlbumIds.includes('cc') && rowAlbumIds.includes('ccde')) {
    return 'ccde';
  }

  return normalizedAlbumId;
}

function getAlbumTitleForTracklist(albumId, rows) {
  const normalizedAlbumId = String(albumId || '').trim().toLowerCase();
  if (!normalizedAlbumId) {
    return '';
  }

  const albumRows = Array.isArray(rows) ? rows : [];
  const match = albumRows.find((row) => String((row || {}).album_id || '').trim().toLowerCase() === normalizedAlbumId);
  const title = String((match || {}).album_title || '').trim();
  return title || slugToDisplayName(normalizedAlbumId);
}

function buildTracklistEntriesForAlbum(rows, albumId) {
  const normalizedAlbumId = String(albumId || '').trim().toLowerCase();
  if (!normalizedAlbumId) {
    return [];
  }

  const csvRows = Array.isArray(rows) ? rows : [];
  const entries = csvRows
    .filter((row) => {
      const albumIds = splitSongSidebarValues((row || {}).album_id || '')
        .map((value) => String(value || '').trim().toLowerCase())
        .filter((value) => value && value !== 'x');
      return albumIds.includes(normalizedAlbumId);
    })
    .map((row, index) => {
      const pagePath = getSongSidebarRowPathValue(row);
      const normalizedPath = normalizeSongSidebarPathKey(pagePath);
      const trackLabel = getTrackLabelForAlbum(row, normalizedAlbumId);
      const parsedTrack = parseInt(String(trackLabel || '').trim(), 10);

      return {
        path: normalizedPath,
        name: rowToAlbumSongTitle(row),
        trackNumber: Number.isFinite(parsedTrack) ? parsedTrack : Number.POSITIVE_INFINITY,
        originalIndex: index
      };
    })
    .filter((entry) => String(entry.path || '').trim());

  entries.sort((a, b) => {
    if (a.trackNumber !== b.trackNumber) {
      return a.trackNumber - b.trackNumber;
    }
    return a.originalIndex - b.originalIndex;
  });

  return entries;
}

function initializeTracklistSidebar() {
  var currentPath = toExtensionlessPath(window.location.pathname);
  if (!/^\/music\/[^/]+$/.test(currentPath) && !/^\/music\/[^/]+\/[^/]+$/.test(currentPath)) {
    return;
  }

  var songSidebarCol = document.querySelector('.song-sidebar-col');
  if (!songSidebarCol) {
    return;
  }

  var sidebar1El = songSidebarCol.querySelector('.sidebar1');
  if (!sidebar1El) {
    return;
  }

  var stickyWrapper = songSidebarCol.querySelector('.sidebar-sticky-wrapper');
  if (!stickyWrapper) {
    stickyWrapper = document.createElement('div');
    stickyWrapper.className = 'sidebar-sticky-wrapper';
    songSidebarCol.insertBefore(stickyWrapper, sidebar1El);
    stickyWrapper.appendChild(sidebar1El);
  }

  Array.from(stickyWrapper.querySelectorAll('.sidebar2.tracklist-sidebar')).forEach(function (node) {
    node.remove();
  });

  ensureSongSidebarCsvLoaded(function (rows) {
    ensureAlbumsCsvLoaded(function (albumRows) {
      const albumRow = findAlbumRowForCurrentPage(albumRows || []);
      const row = getSongSidebarMainRowForCurrentPage() || getSongSidebarRowForCurrentPage() || albumRow;
      if (!row) {
        return;
      }

      let mainAlbumId = getPrimaryAlbumIdForSongRow(row);
      if (!mainAlbumId && albumRow) {
        mainAlbumId = String((albumRow || {}).album_id || '').trim().toLowerCase();
      }

      mainAlbumId = applyHardcodedTracklistAlbumOverride(row, mainAlbumId);

      if (!mainAlbumId) {
        return;
      }

      const tracklistEntries = buildTracklistEntriesForAlbum(rows || [], mainAlbumId);
      if (!tracklistEntries.length) {
        return;
      }

      const albumTitle = getAlbumTitleForTracklist(mainAlbumId, albumRows || []);
      const sidebar2El = buildTracklistSidebarEl(
        albumTitle,
        '/music/' + mainAlbumId,
        tracklistEntries,
        getCurrentSongNavKey(),
        true
      );
      stickyWrapper.appendChild(sidebar2El);

      // Apply persisted expanded/collapsed state after insertion so height measurement is accurate.
      applyTracklistSidebarCollapseState(sidebar2El, isTracklistSidebarCollapsed());

      if (typeof addSocialMediaIcons === 'function') {
        addSocialMediaIcons();
      }
    });
  });
}

function albumSummaryEscapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function albumSummarySanitizeUrl(url) {
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

function setAlbumTabEmptyState(container, message) {
  if (!container) {
    return;
  }

  const empty = document.createElement('div');
  empty.className = 'album-summary-content';
  empty.innerHTML = '<div class="song-empty-box">' + albumSummaryEscapeHtml(message || 'This page has no content.') + '</div>';
  container.innerHTML = '';
  container.appendChild(empty);
}

function initializeAlbumSummary() {
  const summaryContent = document.querySelector('#album-content-summary');
  if (!summaryContent || !document.querySelector('.album-info')) {
    return;
  }

  setAlbumTabEmptyState(summaryContent, 'This page has no summary.');

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

  const summaryPath = basePath + '/public/albums/summaries/' + slug + '.txt';

  fetch(summaryPath, { cache: 'no-store' })
    .then(function (res) {
      return res.ok ? res.text() : null;
    })
    .then(function (text) {
      if (!text || !String(text).trim()) {
        return;
      }

      const content = document.createElement('div');
      content.className = 'album-summary-content';
      content.innerHTML = renderAlbumSummaryHtml(text.trim());
      summaryContent.innerHTML = '';
      summaryContent.appendChild(content);

      if (typeof normalizeInternalAnchorTargets === 'function') {
        normalizeInternalAnchorTargets(summaryContent);
      }
    })
    .catch(function () {});
}

function initializeAlbumExtendedInfo() {
  const extendedContent = document.querySelector('#album-content-extended');
  if (!extendedContent || !document.querySelector('.album-info')) {
    return;
  }

  setAlbumTabEmptyState(extendedContent, 'This page has no extended info.');

  const pathParts = window.location.pathname
    .replace(/\/?index\.html$/i, '')
    .replace(/\.html$/i, '')
    .split('/')
    .filter(Boolean);
  const slug = pathParts[pathParts.length - 1];
  if (!slug || slug === 'music') {
    return;
  }

  const extendedPath = basePath + '/public/albums/extended/' + slug + '.txt';

  fetch(extendedPath, { cache: 'no-store' })
    .then(function (res) {
      return res.ok ? res.text() : null;
    })
    .then(function (text) {
      if (!text || !String(text).trim()) {
        return;
      }

      const content = document.createElement('div');
      content.className = 'album-summary-content';
      content.innerHTML = renderAlbumSummaryHtml(text.trim());
      extendedContent.innerHTML = '';
      extendedContent.appendChild(content);

      if (typeof normalizeInternalAnchorTargets === 'function') {
        normalizeInternalAnchorTargets(extendedContent);
      }
    })
    .catch(function () {});
}