const fs = require('node:fs/promises');
const path = require('node:path');
const prettier = require('prettier');
const { renderStaticEntity } = require('./render-static-entity');

const projectRoot = path.resolve(__dirname, '..');
const publicRoot = path.join(projectRoot, 'public');
const manifestName = '.jamiepedia-generated-pages.json';
const defaultConcurrency = 3;
const entityShellPaths = {
  song: 'music/song-shell.html',
  album: 'music/album-shell.html',
  artist: 'artists/artist-shell.html',
  motif: 'motifs/motif-shell.html'
};

function normalizeSiteBasePath(value) {
  const raw = String(value || '').trim();
  if (!raw || raw === '/') {
    return '';
  }
  return '/' + raw.split('/').filter(Boolean).join('/');
}

const siteBasePath = normalizeSiteBasePath(process.env.SITE_BASE_PATH || '');

const staticPages = [
  {
    route: '/',
    source: 'index.html',
    title: 'JamiePedia!',
    description: 'JamiePedia is an encyclopedia of musician and songwriter Jamie Paige, a fan-built resource for her songs, collaborators, and recurring motifs.'
  },
  {
    route: '/music',
    source: 'music.html',
    renderType: 'music-index',
    title: 'Music',
    description: 'Browse Jamie Paige songs, albums, lyrics, and related music pages.'
  },
  {
    route: '/artists',
    source: 'artists.html',
    renderType: 'artists-index',
    title: 'Artists',
    description: 'Artist and vocalist pages for collaborators across JamiePedia.'
  },
  {
    route: '/motifs',
    source: 'motifs.html',
    renderType: 'motifs-index',
    title: 'Motifs',
    description: 'Browse motif pages and references across Jamie Paige songs.'
  },
  {
    route: '/motif-map',
    outputPath: 'motif-map.html',
    source: 'motif-map.html',
    renderType: 'motif-map',
    title: 'Motif Map',
    description: 'A visual map of recurring motifs across JamiePedia.'
  },
  {
    route: '/about',
    outputPath: 'about.html',
    source: 'about.html',
    title: 'About JamiePedia',
    description: 'Learn about JamiePedia and the contributors who build it.'
  },
  {
    route: '/contact',
    outputPath: 'contact.html',
    source: 'contact.html',
    title: 'Contact JamiePedia',
    description: 'Contact information for JamiePedia.'
  }
];

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const source = String(text || '').replace(/^\uFEFF/u, '');

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];

    if (quoted) {
      if (character === '"' && next === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"' && field.length === 0) {
      quoted = true;
    } else if (character === ',') {
      row.push(field);
      field = '';
    } else if (character === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (character !== '\r') {
      field += character;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  if (!rows.length) {
    return [];
  }

  const headers = rows[0].map((header) => String(header || '').trim().toLowerCase());
  return rows.slice(1)
    .filter((values) => values.some((value) => String(value || '').trim()))
    .map((values) => {
      const record = Object.create(null);
      headers.forEach((header, index) => {
        if (header) {
          record[header] = String(values[index] || '').trim();
        }
      });
      return record;
    });
}

function field(row, ...names) {
  for (const name of names) {
    const value = String((row || {})[String(name || '').trim().toLowerCase()] || '').trim();
    if (value) {
      return value;
    }
  }
  return '';
}

function splitPipe(value) {
  return String(value || '')
    .split(/\s*\|\s*/u)
    .map((item) => item.trim())
    .filter(Boolean);
}

function isTruthy(value, allowBlank = false) {
  const normalized = String(value || '').trim().toUpperCase();
  return normalized === 'TRUE' || normalized === 'YES' || normalized === '1' || (allowBlank && !normalized);
}

function normalizeSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '');
}

function songSlugFromPath(value) {
  const rawPath = String(value || '').trim().split(/[?#]/u)[0].replace(/\.html$/iu, '');
  return String(rawPath.split('/').filter(Boolean).pop() || '').trim().toLowerCase();
}

function parseArtistId(value) {
  const raw = String(value || '').trim();
  const hashIndex = raw.indexOf('#');
  return hashIndex === -1 ? raw : raw.slice(0, hashIndex).trim();
}

function normalizeDescription(value, fallback) {
  const text = String(value || '').replace(/\s+/gu, ' ').trim() || fallback;
  if (text.length <= 160) {
    return text;
  }

  const boundary = text.lastIndexOf(' ', 157);
  return text.slice(0, boundary > 90 ? boundary : 157).trimEnd() + '…';
}

async function readOptionalJson(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch (_error) {
    return null;
  }
}

async function loadSiteData() {
  const csvDir = path.join(publicRoot, 'csv');
  const [songsText, albumsText, motifsText, artistsText, referencesText, themesText, coverArtistsText, searchIndex, closeupEntries] = await Promise.all([
    fs.readFile(path.join(csvDir, 'JamiePedia Data - Songs.csv'), 'utf8'),
    fs.readFile(path.join(csvDir, 'JamiePedia Data - Albums.csv'), 'utf8'),
    fs.readFile(path.join(csvDir, 'JamiePedia Data - Motifs.csv'), 'utf8'),
    fs.readFile(path.join(csvDir, 'JamiePedia Data - Artists.csv'), 'utf8'),
    fs.readFile(path.join(csvDir, 'JamiePedia Data - References.csv'), 'utf8').catch(() => ''),
    fs.readFile(path.join(csvDir, 'JamiePedia Data - Themes.csv'), 'utf8').catch(() => ''),
    fs.readFile(path.join(csvDir, 'JamiePedia Data - Cover Artists.csv'), 'utf8').catch(() => ''),
    readOptionalJson(path.join(publicRoot, 'search', 'search-content-index.json')),
    fs.readdir(path.join(publicRoot, 'close ups', 'text'), { withFileTypes: true }).catch(() => [])
  ]);

  const closeupSlugs = new Set(closeupEntries
    .filter((entry) => entry.isFile() && path.extname(entry.name).toLowerCase() === '.txt')
    .map((entry) => path.basename(entry.name, path.extname(entry.name)).toLowerCase()));
  const songs = parseCsv(songsText);
  const albums = parseCsv(albumsText);
  const motifs = parseCsv(motifsText);
  const artists = parseCsv(artistsText);
  const songRowsBySlug = new Map();
  songs.forEach((row) => {
    const slug = songSlugFromPath(field(row, 'path id', 'path_id', 'page_path', 'path'));
    if (!slug) {
      return;
    }
    if (!songRowsBySlug.has(slug)) {
      songRowsBySlug.set(slug, []);
    }
    songRowsBySlug.get(slug).push(row);
  });
  const albumSlugs = new Set();
  const albumPages = [];
  const collidedSongSlugs = [];

  albums.forEach((row) => {
    splitPipe(field(row, 'album_id', 'album id')).forEach((rawId) => {
      const slug = normalizeSlug(rawId);
      if (songRowsBySlug.has(slug)) {
        collidedSongSlugs.push(slug);
        return;
      }
      if (!slug || albumSlugs.has(slug)) {
        return;
      }
      albumSlugs.add(slug);
      albumPages.push({
        kind: 'album',
        slug,
        route: '/music/' + slug,
        title: field(row, 'album_title', 'album title', 'page_title', 'title') || slug,
        summary: String(((searchIndex || {}).albums || {})[slug]?.summary || ''),
        sections: ['tracklist', 'summary', 'extended']
      });
    });
  });

  const songPages = [];
  songRowsBySlug.forEach((rows, slug) => {
    const primaryRow = rows.find((row) => !String(field(row, 'path id', 'path_id', 'page_path', 'path')).includes('#')) || rows[0];
    const sections = ['connections', 'motifs', 'summary', 'lyrics', 'extended'];
    if (closeupSlugs.has(slug)) {
      sections.push('close-up', 'closeup');
    }
    songPages.push({
      kind: 'song',
      slug,
      route: '/music/' + slug,
      title: field(primaryRow, 'page title', 'page_title', 'title', 'song title') || slug,
      summary: String(((searchIndex || {}).songs || {})[slug]?.summary || ''),
      sections
    });
  });

  const motifPagesBySlug = new Map();
  motifs.forEach((row) => {
    const motifId = field(row, 'motif id', 'motif_id');
    if (!motifId || !isTruthy(field(row, 'has page', 'has_page'))) {
      return;
    }
    const categoryId = field(row, 'category id', 'category_id');
    const slug = normalizeSlug(categoryId || motifId);
    if (!slug || motifPagesBySlug.has(slug)) {
      return;
    }
    motifPagesBySlug.set(slug, {
      kind: 'motif',
      slug,
      route: '/motifs/' + slug,
      title: field(row, 'motif name', 'motif_name') || slug,
      summary: String(((searchIndex || {}).motifs || {})[slug] || '')
    });
  });

  const artistPagesBySlug = new Map();
  artists.forEach((row) => {
    const firstId = splitPipe(field(row, 'artist id', 'artist_id'))[0] || '';
    if (!firstId || !isTruthy(field(row, 'has page?', 'has page', 'has_page'), true)) {
      return;
    }
    const slug = normalizeSlug(parseArtistId(firstId));
    if (!slug || artistPagesBySlug.has(slug)) {
      return;
    }
    const indexedSummary = String(((searchIndex || {}).artists || {})[slug] || '');
    const description = splitPipe(field(row, 'description'))[0] || '';
    artistPagesBySlug.set(slug, {
      kind: 'artist',
      slug,
      route: '/artists/' + slug,
      title: splitPipe(field(row, 'artist name', 'artist_name'))[0] || slug,
      summary: indexedSummary || description,
      sections: ['credits', 'summary']
    });
  });

  return {
    entities: [...songPages, ...albumPages, ...Array.from(artistPagesBySlug.values()), ...Array.from(motifPagesBySlug.values())]
      .sort((left, right) => left.route.localeCompare(right.route)),
    songs,
    albums,
    motifs,
    artists,
    references: parseCsv(referencesText),
    themes: parseCsv(themesText),
    coverArtists: parseCsv(coverArtistsText),
    collidedSongSlugs
  };
}

function readCliOptions(argv) {
  const options = {
    outputDir: projectRoot,
    limit: 0,
    filter: '',
    concurrency: defaultConcurrency
  };

  argv.forEach((argument) => {
    if (argument.startsWith('--output-dir=')) {
      options.outputDir = path.resolve(argument.slice('--output-dir='.length));
    } else if (argument.startsWith('--limit=')) {
      options.limit = Math.max(0, Number(argument.slice('--limit='.length)) || 0);
    } else if (argument.startsWith('--filter=')) {
      options.filter = String(argument.slice('--filter='.length) || '').trim().toLowerCase();
    } else if (argument.startsWith('--concurrency=')) {
      options.concurrency = Math.max(1, Math.min(8, Number(argument.slice('--concurrency='.length)) || defaultConcurrency));
    }
  });

  return options;
}

function resolveSiteOrigin() {
  const configuredOrigin = String(process.env.SITE_ORIGIN || '').trim();
  if (configuredOrigin) {
    return configuredOrigin.replace(/\/+$/u, '');
  }

  try {
    const customDomain = require('node:fs').readFileSync(path.join(projectRoot, 'CNAME'), 'utf8').trim();
    if (customDomain) {
      return /^https?:\/\//i.test(customDomain) ? customDomain.replace(/\/+$/u, '') : ('https://' + customDomain);
    }
  } catch (_error) {
    // Fall back to the known production domain below.
  }

  return 'https://jamiepedia.page';
}

function escapeXml(value) {
  return String(value || '')
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;')
    .replace(/'/gu, '&apos;');
}

function canonicalForRoute(route, siteOrigin) {
  const normalized = '/' + String(route || '').split('/').filter(Boolean).join('/') + '/';
  return siteOrigin + siteBasePath + (normalized === '//' ? '/' : normalized);
}

function routeToOutputPath(route) {
  const parts = String(route || '').split('/').filter(Boolean);
  return parts.length ? path.join(...parts, 'index.html') : 'index.html';
}

function truncateDescription(value, fallback) {
  const text = String(value || '').replace(/\s+/gu, ' ').trim() || fallback;
  if (text.length <= 160) {
    return text;
  }
  const boundary = text.lastIndexOf(' ', 157);
  return text.slice(0, boundary > 90 ? boundary : 157).trimEnd() + '…';
}

function fallbackDescription(entity) {
  if (entity.kind === 'song') {
    return 'Lyrics, connections, versions, and credits for ' + entity.title + ' on JamiePedia.';
  }
  if (entity.kind === 'album') {
    return 'Tracklist, songs, and information for ' + entity.title + ' on JamiePedia.';
  }
  if (entity.kind === 'artist') {
    return 'Credits for ' + entity.title + ' on JamiePedia.';
  }
  return 'Songs and references for the ' + entity.title + ' motif on JamiePedia.';
}

function escapeHtmlAttribute(value) {
  return String(value || '')
    .replace(/&/gu, '&amp;')
    .replace(/"/gu, '&quot;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;');
}

function replaceHeadMeta(html, selector, replacement) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  const expression = new RegExp('<meta\\b(?=[^>]*' + escapedSelector + ')[^>]*>', 'iu');
  return expression.test(html) ? html.replace(expression, replacement) : html;
}

async function buildEntityHtml(shellSource, rendered, entity, description, siteOrigin, extras = {}) {
  let html = String(shellSource || '');
  const title = entity.title || entity.slug;
  const canonicalUrl = canonicalForRoute(entity.route, siteOrigin);
  const safeTitle = escapeHtmlAttribute(title);
  const safeDescription = escapeHtmlAttribute(description);
  const safeCanonical = escapeHtmlAttribute(canonicalUrl);

  html = html.replace(/<script\b(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/giu, '');
  html = html.replace(/<style\b[^>]*>[\s\S]*?<\/style>/giu, '');
  html = html.replace(/<script\b(?=[^>]*\bsrc=["'][^"']*(?:music-files|nav-order|search|social-icons)\.js(?:[?#][^"']*)?)[^>]*>[\s\S]*?<\/script>/giu, '');
  html = html.replace(/<link\b(?=[^>]*href=["'][^"']*\/css\/(?:theme|social-icons)\.css(?:[?#][^"']*)?)[^>]*>/giu, '');
  html = html.replace(/<meta\b(?=[^>]*(?:property="og:[^"]+"|name="twitter:[^"]+"))[^>]*>/giu, '');
  html = html.replace(/<title\b[^>]*>[\s\S]*?<\/title>/iu, '<title>' + safeTitle + '</title>');
  html = replaceHeadMeta(html, 'name="title"', '<meta name="title" content="' + safeTitle + '">');
  html = replaceHeadMeta(html, 'name="description"', '<meta name="description" content="' + safeDescription + '">');
  html = replaceHeadMeta(html, 'name="theme-color"', '<meta name="theme-color" content="' + escapeHtmlAttribute(rendered.themeColor || '#F05E55') + '">');

  html = html.replace(/<html\b([^>]*)>/iu, (_match, rawAttributes) => {
    let attributes = String(rawAttributes || '').replace(/\s+style="[^"]*"/giu, '');
    if (/\bdata-theme-id="[^"]*"/iu.test(attributes)) {
      attributes = attributes.replace(/\bdata-theme-id="[^"]*"/iu, 'data-theme-id="' + escapeHtmlAttribute(rendered.themeId) + '"');
    } else {
      attributes += ' data-theme-id="' + escapeHtmlAttribute(rendered.themeId) + '"';
    }
    return '<html' + attributes + '>';
  });

  const seoTags = [
    '<meta name="robots" content="index,follow">',
    '<meta property="og:type" content="website">',
    '<meta property="og:url" content="' + safeCanonical + '">',
    '<meta property="og:title" content="' + safeTitle + '">',
    '<meta property="og:description" content="' + safeDescription + '">',
    '<meta name="twitter:url" content="' + safeCanonical + '">',
    '<meta name="twitter:title" content="' + safeTitle + '">',
    '<meta name="twitter:description" content="' + safeDescription + '">',
    '<link rel="canonical" href="' + safeCanonical + '">'
  ].join('');
  html = html.replace(/<link\b[^>]*rel="canonical"[^>]*>/giu, '');
  html = html.replace(/<\/head>/iu, String(extras.headTags || '') + seoTags + '</head>');
  const bodyHtml = String(rendered.bodyHtml || '')
    .replace(/\s+style="[^"]*"/giu, '')
    .replace(/\s+on[a-z]+="[^"]*"/giu, '');
  html = html.replace(/<body\b[^>]*>[\s\S]*?<\/body>/iu, '<body>\n' + bodyHtml + '\n</body>');
  html = html.replace(/<\/body>/iu, String(extras.bodyTags || '') + '</body>');

  if (siteBasePath) {
    html = html.replace(/(href|src|poster|action)="\/(?!\/)/giu,
      (_match, attribute) => attribute + '="' + siteBasePath + '/');
    html = html.replace(/url\((['"]?)(\/)(?!\/)/giu,
      (_match, quote) => 'url(' + quote + siteBasePath + '/');
  }

  const documentHtml = '<!DOCTYPE html>\n' + html.replace(/<!doctype\s+html\s*>/giu, '').replace(/<\?xml[^>]*>/giu, '').trim() + '\n';
  return prettier.format(documentHtml, {
    parser: 'html',
    printWidth: 100,
    tabWidth: 2,
    useTabs: false,
    htmlWhitespaceSensitivity: 'strict'
  });
}

async function writeStagedPage(stagingRoot, route, html, generatedFiles, outputPath = routeToOutputPath(route)) {
  const relativePath = outputPath.split('/').join(path.sep);
  const targetPath = path.join(stagingRoot, relativePath);
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, html, 'utf8');
  generatedFiles.add(relativePath.split(path.sep).join('/'));
}

async function writeStagedAsset(stagingRoot, relativePath, content, generatedFiles) {
  const targetPath = path.join(stagingRoot, relativePath.split('/').join(path.sep));
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, content, 'utf8');
  generatedFiles.add(relativePath);
}

async function renderEntity(entity, data, siteOrigin, stagingRoot, generatedFiles) {
  const rendered = await renderStaticEntity(entity, data, siteBasePath);
  const description = truncateDescription(entity.summary, fallbackDescription(entity));
  const shellPath = path.join(projectRoot, entityShellPaths[entity.kind]);
  const shellSource = await fs.readFile(shellPath, 'utf8');
  const html = await buildEntityHtml(shellSource, rendered, entity, description, siteOrigin);
  await writeStagedPage(stagingRoot, entity.route, html, generatedFiles);
}

async function captureStaticAlias(spec, siteOrigin, stagingRoot, generatedFiles) {
  const source = (await fs.readFile(path.join(projectRoot, spec.source), 'utf8'))
    .replace(/<br\s*\/?\s*>\s*<\/br>/giu, '<br>');
  const rendered = {
    bodyHtml: source.match(/<body\b[^>]*>([\s\S]*?)<\/body>/iu)?.[1] || '',
    themeId: source.match(/<html\b[^>]*data-theme-id="([^"]*)"/iu)?.[1] || 'default',
    themeColor: source.match(/<meta\b[^>]*name="theme-color"[^>]*content="([^"]*)"/iu)?.[1] || '#F05E55'
  };
  const extras = { headTags: '', bodyTags: '' };

  if (spec.source === 'motif-map.html') {
    const inlineScript = source.match(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/iu);
    const inlineStyle = source.match(/<style\b[^>]*>([\s\S]*?)<\/style>/iu);
    if (inlineScript && inlineScript[1]) {
      await writeStagedAsset(stagingRoot, 'assets/static/generated/motif-map-page.js', inlineScript[1], generatedFiles);
      extras.bodyTags += '<script src="/assets/static/csv-data.js"></script>'
        + '<script src="/assets/static/generated/motif-map-page.js"></script>';
    }
    if (inlineStyle && inlineStyle[1]) {
      await writeStagedAsset(stagingRoot, 'css/generated/motif-map-page.css', inlineStyle[1], generatedFiles);
      extras.headTags += '<link rel="stylesheet" href="/css/generated/motif-map-page.css">';
    }
  }

  if (spec.route === '/') {
    extras.headTags += '<link rel="stylesheet" href="/css/linkbox.css">';
  }

  const html = await buildEntityHtml(source, rendered, {
    route: spec.route,
    slug: String(spec.route || '').split('/').filter(Boolean).pop() || '',
    title: spec.title || source.match(/<title\b[^>]*>([\s\S]*?)<\/title>/iu)?.[1] || 'JamiePedia'
  }, spec.description, siteOrigin, extras);
  await writeStagedPage(stagingRoot, spec.route, html, generatedFiles, spec.outputPath);
}

async function runWithConcurrency(items, count, worker) {
  let nextIndex = 0;
  const results = [];
  const workers = Array.from({ length: Math.min(count, items.length) }, async (_unused, workerIndex) => {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) {
        return;
      }
      results[index] = await worker(items[index], index, workerIndex);
    }
  });
  await Promise.all(workers);
  return results;
}

function validateGeneratedFiles(generatedFiles) {
  for (const relativePath of generatedFiles) {
    const normalized = path.normalize(relativePath);
    if (path.isAbsolute(normalized) || normalized.startsWith('..' + path.sep) || normalized === '..') {
      throw new Error('Refusing to write an unsafe generated path: ' + relativePath);
    }
  }
}

async function commitStagedPages(outputRoot, stagingRoot, generatedFiles) {
  validateGeneratedFiles(generatedFiles);
  const manifestPath = path.join(outputRoot, manifestName);
  let previousFiles = [];
  try {
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
    previousFiles = Array.isArray(manifest.files) ? manifest.files : [];
  } catch (_error) {
    previousFiles = [];
  }

  const nextFiles = new Set(generatedFiles);
  for (const relativePath of previousFiles) {
    const normalized = path.normalize(String(relativePath || ''));
    if (nextFiles.has(normalized.split(path.sep).join('/'))
      || path.isAbsolute(normalized)
      || normalized === '..'
      || normalized.startsWith('..' + path.sep)) {
      continue;
    }

    const oldPath = path.join(outputRoot, normalized);
    await fs.rm(oldPath, { force: true });
    let parent = path.dirname(oldPath);
    while (parent !== outputRoot && parent.startsWith(outputRoot + path.sep)) {
      try {
        await fs.rmdir(parent);
      } catch (_error) {
        break;
      }
      parent = path.dirname(parent);
    }
  }

  for (const relativePath of generatedFiles) {
    const normalized = relativePath.split('/').join(path.sep);
    const sourcePath = path.join(stagingRoot, normalized);
    const destinationPath = path.join(outputRoot, normalized);
    await fs.mkdir(path.dirname(destinationPath), { recursive: true });
    await fs.copyFile(sourcePath, destinationPath);
  }

  const manifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    files: Array.from(generatedFiles).sort()
  };
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
}

function createSitemap(routes, siteOrigin) {
  const lastmod = new Date().toISOString().slice(0, 10);
  const urls = Array.from(new Set(routes))
    .map((route) => canonicalForRoute(route, siteOrigin))
    .sort()
    .map((url) => '  <url><loc>' + escapeXml(url) + '</loc><lastmod>' + lastmod + '</lastmod></url>')
    .join('\n');

  return '<?xml version="1.0" encoding="UTF-8"?>\n'
    + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + urls + '\n'
    + '</urlset>\n';
}

function createRobotsTxt(siteOrigin) {
  return 'User-agent: *\n'
    + 'Allow: /\n'
    + 'Sitemap: ' + siteOrigin + siteBasePath + '/sitemap.xml\n';
}

async function createStaticPages() {
  const options = readCliOptions(process.argv.slice(2));
  const isFullBuild = options.limit === 0 && !options.filter;
  if (!isFullBuild && options.outputDir === projectRoot) {
    throw new Error('Filtered or limited builds must use --output-dir outside the project root so they cannot replace the full site or its manifest.');
  }
  const siteOrigin = resolveSiteOrigin();
  const data = await loadSiteData();
  let entities = data.entities;
  if (options.filter) {
    entities = entities.filter((entity) => entity.route.toLowerCase().includes(options.filter));
  }
  if (options.limit > 0) {
    entities = entities.slice(0, options.limit);
  }
  if (entities.length === 0) {
    throw new Error('No CSV-defined routes matched the requested build filter.');
  }

  if (data.collidedSongSlugs.length) {
    console.warn('Album routes take precedence over song routes for:', data.collidedSongSlugs.join(', '));
  }

  const stagingRoot = path.join(options.outputDir, '.static-pages-build-' + process.pid);
  const generatedFiles = new Set();
  const sitemapRoutes = isFullBuild ? ['/'] : [];

  try {
    await fs.rm(stagingRoot, { recursive: true, force: true });
    await fs.mkdir(stagingRoot, { recursive: true });

    const workerErrors = [];
    const renderTasks = entities.map((entity) => entity);
    await runWithConcurrency(renderTasks, options.concurrency, async (entity) => {
      try {
        await renderEntity(entity, data, siteOrigin, stagingRoot, generatedFiles);
        sitemapRoutes.push(entity.route);
        console.log('Generated ' + entity.kind + ': ' + entity.route);
      } catch (error) {
        workerErrors.push({ route: entity.route, error });
      }
    });

    if (workerErrors.length) {
      throw new AggregateError(workerErrors.map((entry) => entry.error),
        'Failed to render ' + workerErrors.length + ' CSV-defined pages: ' + workerErrors.map((entry) => entry.route).join(', '));
    }

    if (isFullBuild) {
      for (const spec of staticPages) {
        try {
          await captureStaticAlias(spec, siteOrigin, stagingRoot, generatedFiles);
          sitemapRoutes.push(spec.route);
        } catch (error) {
          throw new Error('Failed to build ' + spec.route + ' from ' + spec.source + ': ' + error.message);
        }
      }
    }

    await fs.writeFile(path.join(stagingRoot, 'sitemap.xml'), createSitemap(sitemapRoutes, siteOrigin), 'utf8');
    await fs.writeFile(path.join(stagingRoot, 'robots.txt'), createRobotsTxt(siteOrigin), 'utf8');
    await fs.writeFile(path.join(stagingRoot, '.nojekyll'), '', 'utf8');
    generatedFiles.add('sitemap.xml');
    generatedFiles.add('robots.txt');
    generatedFiles.add('.nojekyll');

    await commitStagedPages(options.outputDir, stagingRoot, generatedFiles);
    console.log('Generated ' + generatedFiles.size + ' files for ' + entities.length + ' CSV-defined pages.');
    console.log('Sitemap URLs:', new Set(sitemapRoutes).size);
    console.log('Output:', options.outputDir);
  } finally {
    await fs.rm(stagingRoot, { recursive: true, force: true });
  }
}

createStaticPages().catch((error) => {
  console.error('Failed to generate static pages:', error);
  process.exitCode = 1;
});