const fs = require('node:fs/promises');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const publicRoot = path.join(projectRoot, 'public');
const textCache = new Map();

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function splitPipe(value) {
  return String(value || '').split(/\s*\|\s*/u).map((part) => part.trim()).filter(Boolean);
}

function field(row, ...names) {
  for (const name of names) {
    const value = String((row || {})[String(name || '').toLowerCase()] || '').trim();
    if (value) return value;
  }
  return '';
}

function normalizeSlug(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/^-+|-+$/gu, '');
}

function toSiteHref(href, basePath) {
  const source = String(href || '').trim();
  if (!source || /^(https?:|mailto:|tel:|#|javascript:|data:|blob:)/iu.test(source)) return source;
  const withSlash = source.startsWith('/') ? source : '/' + source;
  const noHtml = withSlash.replace(/\.html(?=([?#]|$))/iu, '').replace(/\/index(?=([?#]|$))/iu, '');
  const closeup = noHtml.match(/^\/music\/([^/]+)\/close-up\/?$/iu);
  const canonical = closeup ? '/music/' + closeup[1] + '/close-up' : noHtml.replace(/\/$/u, '');
  return (basePath || '') + (canonical || '/');
}

function createHrefResolver(data, basePath) {
  const songs = new Set((data.songs || []).map((row) => normalizeSlug(field(row, 'path id', 'path_id', 'page_path', 'path'))));
  const albums = new Set((data.albums || []).flatMap((row) => splitPipe(field(row, 'album_id', 'album id')).map(normalizeSlug)));
  const motifPages = new Map();
  const artistsByName = new Map();
  (data.artists || []).forEach((row) => {
    const ids = splitPipe(field(row, 'artist id'));
    const names = splitPipe(field(row, 'artist name'));
    ids.forEach((id, index) => {
      const slug = normalizeSlug(id.split('#')[0]);
      if (!slug) return;
      const hasPage = !/^(false|no|0)$/iu.test(field(row, 'has page?', 'has page', 'has_page'));
      const external = splitPipe(field(row, 'artist links'))[0] || '';
      const entry = { href: hasPage ? '/artists/' + slug + (id.includes('#') ? '#' + id.split('#')[1] : '') : external };
      [id, names[index] || '', ...names].filter(Boolean).forEach((name) => {
        const key = name.trim().toLowerCase();
        if (key && !artistsByName.has(key)) artistsByName.set(key, entry);
      });
    });
  });
  (data.motifs || []).forEach((row) => {
    if (String(field(row, 'has page', 'has_page')).trim() && !/^(true|yes|1)$/iu.test(field(row, 'has page', 'has_page'))) return;
    const id = normalizeSlug(field(row, 'motif id', 'motif_id'));
    const category = normalizeSlug(field(row, 'category id', 'category_id'));
    const page = category || id;
    if (id && page) motifPages.set(id, page);
    if (category && page) motifPages.set(category, page);
  });

  return (raw) => {
    const source = String(raw || '').trim();
    if (!source) return '#';
    if (/^(javascript:|data:|blob:)/iu.test(source)) return '#';
    if (/^(https?:|mailto:|tel:|#|\/|\.\/|\.\.\/)/iu.test(source)) return toSiteHref(source, basePath).replace(/"/gu, '%22');
    const typed = source.match(/^(album|path|song|motif|category|artist)\s*:\s*(.+)$/iu);
    const type = typed ? typed[1].toLowerCase() : '';
    const token = String(typed ? typed[2] : source).trim().toLowerCase().replace(/^\/+|\/+$/gu, '').replace(/\.html$/iu, '');
    if (!token) return '#';
    if (token.startsWith('music/') || token.startsWith('motifs/') || token.includes('/')) return toSiteHref('/' + token, basePath).replace(/"/gu, '%22');
    if (type === 'motif' || type === 'category') return (basePath || '') + '/motifs/' + (motifPages.get(token) || token);
    if (type === 'artist') return (artistsByName.get(token) || {}).href || '#';
    if (type === 'song' || type === 'album' || type === 'path' || songs.has(token) || albums.has(token)) return (basePath || '') + '/music/' + token;
    return (basePath || '') + '/music/' + token;
  };
}

function renderInline(text, resolveHref) {
  const literals = [];
  const codes = [];
  const links = [];
  let html = escapeHtml(text);
  html = html.replace(/\\([\\`*_{}\[\]()#+\-.!>])/gu, (_match, char) => {
    const key = '@@LIT' + literals.length + '@@'; literals.push(char); return key;
  });
  html = html.replace(/`([^`]+)`/gu, (_match, code) => {
    const key = '@@CODE' + codes.length + '@@'; codes.push('<code>' + code + '</code>'); return key;
  });
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/gu, (_match, label, href) => {
    const target = resolveHref(href);
    const external = /^https?:\/\//iu.test(target);
    const token = '@@LINK' + links.length + '@@';
    links.push('<a href="' + escapeHtml(target) + '"' + (external ? ' class="txt-external-link" target="_blank" rel="noopener noreferrer"' : '') + '>' + label + (external ? '<span class="txt-external-link-glyph" aria-hidden="true">↗</span>' : '') + '</a>');
    return token;
  });
  html = html.replace(/\*\*([^*]+)\*\*/gu, '<strong>$1</strong>').replace(/__([^_]+)__/gu, '<strong>$1</strong>')
    .replace(/(?<!\*)\*([^*<]+)\*(?!\*)/gu, '<em>$1</em>').replace(/(?<!_)_([^_<]+)_(?!_)/gu, '<em>$1</em>');
  html = html.replace(/@@LIT(\d+)@@/gu, (_match, index) => escapeHtml(literals[Number(index)] || ''));
  html = html.replace(/@@CODE(\d+)@@/gu, (_match, index) => codes[Number(index)] || '');
  html = html.replace(/@@LINK(\d+)@@/gu, (_match, index) => links[Number(index)] || '');
  return html;
}

function renderMarkdown(text, resolveHref, options = {}) {
  const normalized = String(text || '').replace(/\r\n/gu, '\n').trim();
  if (!normalized) return '';
  const lines = normalized.split('\n');
  const blocks = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();
    if (!trimmed) { index += 1; continue; }
    if (/^```/u.test(trimmed)) {
      const code = [];
      index += 1;
      while (index < lines.length && !/^```/u.test(lines[index].trim())) code.push(lines[index++]);
      if (index < lines.length) index += 1;
      blocks.push('<pre class="song-markdown-code"><code>' + escapeHtml(code.join('\n')) + '</code></pre>');
      continue;
    }
    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/u);
    if (heading) {
      const level = heading[1].length;
      blocks.push('<h' + level + ' class="song-markdown-h' + level + '">' + renderInline(heading[2], resolveHref) + '</h' + level + '>');
      index += 1; continue;
    }
    if (/^(-{3,}|\*{3,}|_{3,})$/u.test(trimmed)) { blocks.push('<hr class="song-markdown-hr">'); index += 1; continue; }
    if (/^[-*+]\s+/u.test(trimmed) || /^\d+\.\s+/u.test(trimmed)) {
      const ordered = /^\d+\.\s+/u.test(trimmed);
      const matcher = ordered ? /^\d+\.\s+/u : /^[-*+]\s+/u;
      const items = [];
      while (index < lines.length && matcher.test(lines[index].trim())) items.push('<li>' + renderInline(lines[index++].trim().replace(matcher, ''), resolveHref) + '</li>');
      blocks.push('<' + (ordered ? 'ol' : 'ul') + '>' + items.join('') + '</' + (ordered ? 'ol' : 'ul') + '>');
      continue;
    }
    if (/^>\s?/u.test(trimmed)) {
      const quoted = [];
      while (index < lines.length && /^>\s?/u.test(lines[index].trim())) quoted.push(renderInline(lines[index++].trim().replace(/^>\s?/u, ''), resolveHref));
      blocks.push('<blockquote>' + quoted.join('<br>') + '</blockquote>');
      continue;
    }
    const paragraph = [];
    while (index < lines.length && lines[index].trim() && !/^(#{1,6}\s+|```|[-*+]\s+|\d+\.\s+|>\s?|(-{3,}|\*{3,}|_{3,})$)/u.test(lines[index].trim())) {
      paragraph.push(lines[index++].trim());
    }
    if (paragraph.length) {
      const indent = options.preserveIndent ? '&nbsp;'.repeat((line.match(/^[ \t]*/u) || [''])[0].replace(/\t/gu, '    ').length) : '';
      blocks.push('<p>' + indent + paragraph.map((part) => renderInline(part, resolveHref)).join('<br>') + '</p>');
    } else index += 1;
  }
  return blocks.join('');
}

function renderAnnotation(text, resolveHref, id = 'lyrics-annotated') {
  const lines = String(text || '').replace(/\r\n/gu, '\n').split('\n');
  const refsAt = lines.findIndex((line) => line.trim().toLowerCase() === 'references');
  const body = (refsAt < 0 ? lines : lines.slice(0, refsAt)).join('\n').trim();
  const refsText = refsAt < 0 ? '' : lines.slice(refsAt + 1).join('\n');
  const refs = [];
  let current = null;
  refsText.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const match = trimmed.match(/^(\d+)(?:[\).:-]|\s)\s*(.+)$/u);
    if (match) { current = { number: match[1], text: match[2] }; refs.push(current); }
    else if (current) current.text += ' ' + trimmed;
  });
  const scope = id.replace(/[^a-z0-9_-]/giu, '-');
  const counts = Object.create(null);
  const first = Object.create(null);
  const bodyHtml = renderMarkdown(body, resolveHref).replace(/\[(\d+)\]/gu, (_match, number) => {
    counts[number] = (counts[number] || 0) + 1;
    const marker = 'ref-marker-' + number + '-' + scope + '-' + counts[number];
    if (!first[number]) first[number] = marker;
    const target = 'ref-' + number + '-' + scope;
    return '<a href="#' + target + '" class="ref-tag" id="' + marker + '" data-ref="' + number + '" data-ref-target="' + target + '">[' + number + ']</a>';
  });
  const references = refs.length ? '<div class="references-section"><h3>References</h3><ol class="references-list">' + refs.map((ref) => {
    const target = 'ref-' + ref.number + '-' + scope;
    const back = first[ref.number] ? '<span class="ref-back-link"><a href="#' + first[ref.number] + '">↑</a></span>' : '';
    return '<li id="' + target + '">' + back + renderInline(ref.text, resolveHref) + '</li>';
  }).join('') + '</ol></div>' : '';
  return bodyHtml + references;
}

async function readText(relativePath) {
  const safe = String(relativePath || '').split('/').filter((part) => part && part !== '..').join(path.sep);
  const target = path.join(publicRoot, safe);
  if (!textCache.has(target)) {
    textCache.set(target, fs.readFile(target, 'utf8').catch(() => ''));
  }
  return textCache.get(target);
}

function empty(label) { return '<div class="song-empty-box">This song has no ' + escapeHtml(label) + '.</div>'; }
function link(href, text, basePath, extra = '') {
  return '<a href="' + escapeHtml(toSiteHref(href, basePath)) + '"' + extra + '>' + escapeHtml(text) + '</a>';
}
function infoBlock(label, content) {
  return content ? '<div class="song-info-block"><div class="song-info-label">' + escapeHtml(label) + '</div><div class="song-info-content">' + content + '</div></div>' : '';
}

function songPathSlug(row) { return normalizeSlug(field(row, 'path id', 'path_id', 'page_path', 'path').split('#')[0]); }
function songId(row) { return String(field(row, 'song id', 'song_id')).trim().toLowerCase(); }
function songRowsForPage(data, slug) {
  return (data.songs || []).filter((row) => songPathSlug(row) === slug);
}
function mapById(rows, ...keys) {
  const map = new Map();
  (rows || []).forEach((row) => { const key = field(row, ...keys).toLowerCase(); if (key && !map.has(key)) map.set(key, row); });
  return map;
}

function themeColorFor(data, themeId) {
  const theme = (data.themes || []).find((row) => field(row, 'theme id').toLowerCase() === String(themeId || '').toLowerCase());
  return field(theme, 'meta_theme_color') || '#F05E55';
}

function renderSongConnections(rows, data, basePath, resolveHref) {
  const motifById = mapById(data.motifs, 'motif id', 'motif_id');
  const refs = (data.references || []).filter((ref) => rows.some((row) => songId(row) === field(ref, 'song id', 'song_id').toLowerCase()));
  if (!refs.length) return '<div class="song-motif-empty">This song has no connections.</div>';
  const entries = new Map();
  refs.forEach((ref) => {
    const id = field(ref, 'motif id', 'motif_id').toLowerCase();
    const motif = motifById.get(id) || {};
    const name = field(motif, 'motif name', 'motif_name') || id;
    const type = String(field(ref, 'type')).toLowerCase();
    const group = type === 'sample' ? 'Samples' : (type === 'lyrical' ? 'Lyrical References' : 'Motifs');
    if (!entries.has(group)) entries.set(group, []);
    const variation = field(ref, 'variation', 'variation letter');
    const title = name + (variation ? ' (' + variation + ')' : '');
    const pageSlug = normalizeSlug(field(motif, 'category id', 'category_id') || id);
    const hasPage = !field(motif, 'has page', 'has_page') || /^(true|yes|1)$/iu.test(field(motif, 'has page', 'has_page'));
    const time = [field(ref, 'start time'), field(ref, 'end time')].filter(Boolean).join('–');
    const href = hasPage ? '/motifs/' + pageSlug : resolveHref('motif:' + id);
    const item = (href ? link(href, title, basePath) : escapeHtml(title)) + (time ? ' <span class="song-motif-reference-time">' + escapeHtml(time) + '</span>' : '');
    if (!entries.get(group).includes(item)) entries.get(group).push(item);
  });
  return '<section class="song-motifs-shell song-motifs-static"><h2 class="song-motif-list-title">Connections</h2>' + Array.from(entries.entries()).map(([group, items]) => '<div class="song-motif-row"><h3 class="song-motif-label-text">' + escapeHtml(group) + '</h3><ul class="song-motif-legend">' + items.map((item) => '<li class="song-motif-legend-entry">' + item + '</li>').join('') + '</ul></div>').join('') + '</section>';
}

async function renderSong(entity, data, basePath, resolveHref) {
  const rows = songRowsForPage(data, entity.slug);
  const primary = rows.find((row) => !field(row, 'path id', 'path_id', 'page_path', 'path').includes('#')) || rows[0] || {};
  const title = field(primary, 'page title', 'page_title', 'title') || entity.title;
  const titleHtml = splitPipe(title).map(escapeHtml).join('<br>');
  const coverArts = splitPipe(field(primary, 'album art', 'album_art', 'album_art_paths'));
  const coverLabels = splitPipe(field(primary, 'cover art labels', 'cover_art_labels', 'album_tab_labels'));
  const cover = coverArts[0] || '';
  const summaryText = await readText('songs/summaries/' + entity.slug + '.txt');
  const annotationText = await readText('songs/annotations/' + entity.slug + '.txt');
  const extendedText = await readText('songs/extended/' + entity.slug + '.txt');
  const lrcText = annotationText ? '' : await readText('songs/lyrics/' + entity.slug + '.lrc');
  const closeupText = await readText('close ups/text/' + entity.slug + '.txt');
  const summaryHtml = renderMarkdown(summaryText, resolveHref, { preserveIndent: true }) || empty('summary');
  const lyricsHtml = annotationText
    ? (renderAnnotation(annotationText, resolveHref) || empty('annotated lyrics'))
    : lrcText ? '<p>' + escapeHtml(lrcText.split(/\r?\n/u).map((line) => line.replace(/\[[^\]]+\]/gu, '').replace(/\{[^}]*\}/gu, '').trim()).filter(Boolean).join('<br>')) + '</p>' : empty('annotated lyrics');
  const extendedHtml = renderMarkdown(extendedText, resolveHref) || empty('extended info');
  const versionRows = rows.filter((row, index) => index === 0 || !field(row, 'alt tab status?', 'alt tab status', 'alt_tab').toLowerCase().includes('alt') || field(row, 'path id', 'path_id').includes('#'));
  const tabButtons = ['motifs|Connections', 'summary|Summary', 'lyrics|Lyrics', 'extended|Extended Info'].map((entry) => {
    const [key, label] = entry.split('|');
    return '<button class="song-tab' + (key === 'motifs' ? ' active' : '') + '" type="button" data-song-tab="' + key + '" data-static-tab="' + key + '">' + label + '</button>';
  }).join('');
  const closeupTab = closeupText.trim() ? '<button class="song-tab" type="button" data-song-tab="closeup">Close-Up</button>' : '';
  const artTabs = coverArts.length > 1 ? '<div class="album-tabs-container"><div class="album-tabs">' + coverArts.map((art, index) => '<button class="album-tab' + (index === 0 ? ' active' : '') + '" type="button" data-art="' + escapeHtml(art) + '">' + escapeHtml(coverLabels[index] || coverLabels[0] || 'Cover') + '</button>').join('') + '</div></div>' : '';
  const image = cover ? '<img src="' + escapeHtml((basePath || '') + '/public/images/cover-art/' + cover) + '" alt="' + escapeHtml(title.replace(/\s*\|\s*/gu, ' ')) + ' Cover" style="width:100%;height:100%;object-fit:cover;border-radius:4px">' : '';
  const artists = splitPipe(field(primary, 'artists'));
  const listenLabels = splitPipe(field(primary, 'listen text', 'listen_text'));
  const listenUrls = splitPipe(field(primary, 'listen links', 'listen_links'));
  const linkItems = listenLabels.map((label, index) => {
    const href = listenUrls[index];
    return href ? link(href, label, basePath, /^https?:/iu.test(href) ? ' target="_blank" rel="noopener noreferrer"' : '') : escapeHtml(label);
  });
  const sidebar = [
    infoBlock('Appears On', splitPipe(field(primary, 'album id')).map((id, index) => {
      if (!id || id.toLowerCase() === 'x') return '';
      const album = (data.albums || []).find((row) => field(row, 'album id').toLowerCase() === id.toLowerCase());
      const track = splitPipe(field(primary, 'track number'))[index] || field(primary, 'track number');
      const label = (track ? track + ' - ' : '') + (field(album, 'album title') || id);
      return link('/music/' + normalizeSlug(id), label, basePath);
    }).filter(Boolean).join('<br>')),
    infoBlock('Release Date', escapeHtml(splitPipe(field(primary, 'release date'))[0] || '')),
    infoBlock('Artists', artists.map((artist) => link(resolveHref('artist:' + artist), artist, basePath, ' class="artist-credit-link"')).join('<br>')),
    infoBlock('Vocalists', splitPipe(field(primary, 'vocalists')).map(escapeHtml).join('<br>')),
    infoBlock('Mixing', splitPipe(field(primary, 'mixing')).map(escapeHtml).join('<br>')),
    infoBlock('Mastering', splitPipe(field(primary, 'mastering')).map(escapeHtml).join('<br>')),
    infoBlock('Instrumentals', splitPipe(field(primary, 'instrumentals')).map(escapeHtml).join('<br>')),
    infoBlock('Listen', linkItems.join('<br>'))
  ].join('');
  const closeupHtml = closeupText.trim() ? '<div id="content-closeup" class="song-content song-closeup-content"><article class="closeup-article"><h2>' + escapeHtml(title.replace(/\s*\|\s*/gu, ' ')) + ' Close-Up</h2>' + renderMarkdown(closeupText, resolveHref) + '</article></div>' : '';
  const themeId = field(primary, 'theme', 'version theme') || 'default';
  return {
    themeId,
    themeColor: themeColorFor(data, themeId),
    bodyHtml: '<a href="' + (basePath || '') + '/"><div class="head"></div></a><div class="navi"><span id="navi"></span></div><div class="song-page-wrapper"><div class="song-sidebar-col"><div class="sidebar1"><span id="sidebar"></span></div></div><div class="song-main-col"><div class="song-tabs-container"><div class="song-tabs">' + tabButtons + closeupTab + '<div class="tabs-spacer"></div></div></div><div class="bodybar"><div class="version-wrapper"><div id="version-original" class="song-container"><div class="song-leftview"><h1 class="song-title">' + titleHtml + '</h1><div id="content-motifs" class="song-content active"><div id="songMotifsContent-original" class="song-motifs-content">' + renderSongConnections(rows, data, basePath, resolveHref) + '</div></div><div id="content-summary" class="song-content">' + summaryHtml + '</div><div id="content-lyrics" class="song-content"><div id="lyrics-annotated" class="lyrics-content active">' + lyricsHtml + '</div></div><div id="content-extended" class="song-content">' + extendedHtml + '</div></div><div class="song-rightview">' + artTabs + '<div class="song-cover">' + image + '</div><div class="cover-art-footer"><div class="cover-art-credit">Cover art by: <span id="cover-artist-display"></span></div></div><div class="song-nav-buttons"></div><div class="song-info-sidebar">' + sidebar + '</div></div>' + closeupHtml + '</div></div></div></div></div>'
  };
}

function artistPageRows(data, slug) {
  return (data.artists || []).filter((row) => {
    const first = splitPipe(field(row, 'artist id'))[0] || '';
    const pageId = first.split('#')[0];
    return normalizeSlug(pageId) === slug && !/^(false|no|0)$/iu.test(field(row, 'has page?', 'has page', 'has_page'));
  });
}
function artistTokens(rows) {
  const tokens = new Set();
  rows.forEach((row) => {
    splitPipe(field(row, 'artist id')).forEach((value) => tokens.add(value.toLowerCase()));
    splitPipe(field(row, 'artist name')).forEach((value) => tokens.add(value.toLowerCase()));
  });
  return tokens;
}
function containsToken(value, tokens) {
  const source = String(value || '').toLowerCase();
  return Array.from(tokens).some((token) => {
    let index = source.indexOf(token);
    while (index !== -1) {
      if (!/[a-z0-9]/iu.test(source[index - 1] || '') && !/[a-z0-9]/iu.test(source[index + token.length] || '')) return true;
      index = source.indexOf(token, index + 1);
    }
    return false;
  });
}
async function renderArtist(entity, data, basePath, resolveHref) {
  const rows = artistPageRows(data, entity.slug);
  const primary = rows[0] || {};
  const aliases = rows.flatMap((row) => splitPipe(field(row, 'artist name')));
  const uniqueNames = Array.from(new Map(aliases.map((name) => [name.toLowerCase(), name])).values());
  const title = uniqueNames[0] || entity.title;
  const desc = splitPipe(field(primary, 'description'))[0] || '';
  const summaryText = await readText('artists/summaries/' + entity.slug + '.txt') || await readText('artists/' + entity.slug + '.txt') || await readText('summaries/' + entity.slug + '.txt');
  const tokens = artistTokens(rows);
  const roleFields = [['artists', 'Artist'], ['vocalists', 'Vocalist'], ['mixing', 'Mixing'], ['mastering', 'Mastering'], ['instrumentals', 'Instrumentals']];
  const songItems = new Map();
  (data.songs || []).forEach((row) => {
    const roles = roleFields.filter(([key]) => splitPipe(field(row, key)).some((value) => containsToken(value, tokens))).map(([, label]) => label);
    if (!roles.length) return;
    const slug = songPathSlug(row);
    if (!slug) return;
    const href = '/music/' + slug + (field(row, 'path id').includes('#') ? '#' + field(row, 'path id').split('#')[1] : '');
    if (!songItems.has(href)) songItems.set(href, { title: field(row, 'page title') || slug, roles: new Set() });
    roles.forEach((role) => songItems.get(href).roles.add(role));
  });
  const albumItems = new Map();
  (data.albums || []).forEach((row) => {
    const id = field(row, 'album id').toLowerCase();
    if (!id || !containsToken(field(row, 'artists'), tokens)) return;
    albumItems.set(id, { title: field(row, 'album title') || id, roles: 'Artist' });
  });
  const related = (items) => Array.from(items, ([href, item]) => '<article class="artist-related-item">' + link(href, item.title, basePath) + (item.roles ? '<div class="artist-related-meta">' + escapeHtml(item.roles instanceof Set ? Array.from(item.roles).join(', ') : item.roles) + '</div>' : '') + '</article>').join('');
  const images = splitPipe(field(primary, 'artist image'));
  const imageLabels = splitPipe(field(primary, 'image label'));
  const tabs = rows.length > 1 ? rows.map((row, index) => {
    const token = field(row, 'artist id').split('#')[1] || '';
    const label = field(row, 'tab name') || (token ? token.replace(/-/gu, ' ').replace(/\b\w/gu, (char) => char.toUpperCase()) : 'Original');
    return '<button type="button" class="version-tab artist-version-tab' + (!index ? ' active' : '') + '" data-artist-variant="' + escapeHtml(token) + '">' + escapeHtml(label) + '</button>';
  }).join('') : '';
  const links = splitPipe(field(primary, 'link text')).map((label, index) => {
    const href = splitPipe(field(primary, 'artist links'))[index];
    return href ? '<a href="' + escapeHtml(href) + '"' + (/^https?:/iu.test(href) ? ' target="_blank" rel="noopener noreferrer"' : '') + '>' + escapeHtml(label) + '</a>' : '';
  }).filter(Boolean).join('');
  return {
    themeId: field(primary, 'theme') || 'default',
    bodyHtml: '<a href="' + (basePath || '') + '/"><div class="head"></div></a><div class="navi"><span id="navi"></span></div><table class="table"><tr><td><div class="sidebar1"><span id="sidebar"></span></div></td><td><div class="artist-main-col"><div class="song-tabs-container artist-tabs-container"><div class="song-tabs artist-tabs"><button type="button" class="song-tab artist-tab active" data-artist-tab="credits">Credits</button><button type="button" class="song-tab artist-tab" data-artist-tab="summary">Summary</button><div class="tabs-spacer"></div>' + tabs + '</div></div><div class="bodybar artist-bodybar"><section class="song-container artist-page-shell"><div class="song-leftview artist-leftview"><h1 id="artistPageName" class="song-title artist-page-name">' + escapeHtml(title) + '</h1><p id="artistPageType" class="song-length artist-page-type">' + (uniqueNames.length > 1 ? 'Also known as: ' + escapeHtml(uniqueNames.slice(1).join(' / ')) : '') + '</p><section class="song-content artist-content" data-artist-panel="summary"><div id="artistSummaryContent" class="artist-summary-content">' + renderMarkdown(summaryText || desc, resolveHref) + '</div></section><section class="song-content artist-content artist-content-active" data-artist-panel="credits"><div class="artist-credits-grid"><section id="artistSongsSection" class="artist-section artist-credits-section"><h2 class="song-markdown-h2 artist-section-title">Songs</h2><div id="artistSongsList" class="artist-related-list artist-related-list-compact">' + related(songItems) + '</div></section><section id="artistAlbumsSection" class="artist-section artist-credits-section"><h2 class="song-markdown-h2 artist-section-title">Albums</h2><div id="artistAlbumsList" class="artist-related-list artist-related-list-compact">' + related(albumItems) + '</div></section><div id="artistCreditsEmpty" class="artist-empty-box artist-credits-empty"' + (songItems.size || albumItems.size ? ' hidden' : '') + '>There are no credits for this artist yet.</div></div></section></div><div class="song-rightview artist-rightview"><div id="artistImageTabsContainer" class="album-tabs-container artist-image-tabs-container"' + (images.length > 1 ? '' : ' style="display:none"') + '><div id="artistImageTabs" class="album-tabs artist-image-tabs">' + images.map((image, index) => '<button class="album-tab' + (!index ? ' active' : '') + '" type="button">' + escapeHtml(imageLabels[index] || imageLabels[0] || 'Image') + '</button>').join('') + '</div></div><div class="song-cover artist-song-cover"><img id="artistPageImage" class="artist-page-image" src="' + escapeHtml(images[0] ? (basePath + '/' + images[0].replace(/^\/+/, '')) : '') + '" alt="' + escapeHtml(title + (imageLabels[0] ? ' - ' + imageLabels[0] : '')) + '"></div><div class="song-nav-buttons"></div><div class="song-info-sidebar artist-info-sidebar"><div class="song-info-block artist-description-block"><div class="song-info-content"><p id="artistPageAliases" class="artist-page-aliases">' + escapeHtml(uniqueNames.slice(1).join(' / ')) + '</p><p id="artistPageDescription" class="artist-page-description">' + escapeHtml(desc) + '</p></div></div><div class="song-info-block"><div class="song-info-label">Links</div><div id="artistPageLinks" class="song-links artist-page-links">' + links + '</div></div></div></div></section></div></div></td></tr></table>'
  };
}

function getMotifPageData(data, slug) {
  const motifRows = (data.motifs || []).filter((row) => normalizeSlug(field(row, 'category id', 'category_id') || field(row, 'motif id', 'motif_id')) === slug);
  const primary = motifRows.find((row) => !field(row, 'motif id', 'motif_id').startsWith(slug + '-')) || motifRows[0] || {};
  const motifIds = new Set(motifRows.map((row) => field(row, 'motif id', 'motif_id').toLowerCase()));
  const refs = (data.references || []).filter((ref) => motifIds.has(field(ref, 'motif id', 'motif_id').toLowerCase()));
  return { motifRows, primary, refs, motifIds };
}
async function renderMotif(entity, data, basePath, resolveHref) {
  const motifData = getMotifPageData(data, entity.slug);
  const { primary, motifRows, refs } = motifData;
  const title = field(primary, 'motif name', 'motif_name') || entity.title;
  const imagePath = field(primary, 'motif image (page and map)', 'motif image', 'image').replace(/^\.\.\//u, '/');
  const summaryText = await readText('motifs/summaries/' + entity.slug + '.txt') || await readText('motifs/motif-summaries/' + entity.slug + '.txt') || await readText('motif-summaries/' + entity.slug + '.txt') || await readText('summaries/' + entity.slug + '.txt');
  const songById = mapById(data.songs, 'song id', 'song_id');
  const motifById = mapById(data.motifs, 'motif id', 'motif_id');
  const songMap = new Map();
  refs.forEach((ref) => {
    const song = songById.get(field(ref, 'song id', 'song_id').toLowerCase());
    if (!song) return;
    const slug = songPathSlug(song);
    if (!slug) return;
    if (!songMap.has(slug)) songMap.set(slug, { row: song, refs: [] });
    songMap.get(slug).refs.push(ref);
  });
  const first = Array.from(songMap.values()).flatMap((entry) => entry.refs.map((ref) => ({ entry, time: timeToSeconds(field(ref, 'start time')) }))).sort((a, b) => a.time - b.time)[0];
  const variationSections = motifRows.length > 1 ? motifRows.map((variant) => {
    const variantId = field(variant, 'motif id', 'motif_id').toLowerCase();
    const label = variantId.startsWith(entity.slug + '-') ? variantId.slice(entity.slug.length + 1).toUpperCase() : field(variant, 'motif name', 'motif_name');
    const items = Array.from(songMap.values()).filter((entry) => entry.refs.some((ref) => field(ref, 'motif id', 'motif_id').toLowerCase() === variantId)).map((entry) => {
      const song = entry.row;
      const relatedRefs = entry.refs.filter((ref) => field(ref, 'motif id', 'motif_id').toLowerCase() === variantId);
      const times = relatedRefs.map((ref) => field(ref, 'start time') + (field(ref, 'end time') ? '–' + field(ref, 'end time') : '')).filter(Boolean).join(', ');
      return '<article class="motif-player-row"><a class="motif-song-pill" href="' + escapeHtml(toSiteHref('/music/' + songPathSlug(song), basePath)) + '">' + splitPipe(field(song, 'page title')).map(escapeHtml).join('<br>') + '</a><div class="motif-label">' + escapeHtml(title + (label ? ' (' + label + ')' : '')) + (times ? ' — ' + escapeHtml(times) : '') + '</div></article>';
    }).join('');
    return '<section class="motif-variation-section" data-variation-id="' + escapeHtml(variantId) + '"><h3>' + escapeHtml(title + (label ? ' (' + label + ')' : '')) + '</h3><div class="motif-song-list">' + (items || '<div class="motif-empty">No songs for this variation.</div>') + '</div></section>';
  }).join('') : Array.from(songMap.values()).map((entry) => {
    const song = entry.row;
    const times = entry.refs.map((ref) => field(ref, 'start time') + (field(ref, 'end time') ? '–' + field(ref, 'end time') : '')).filter(Boolean).join(', ');
    return '<article class="motif-player-row"><a class="motif-song-pill" href="' + escapeHtml(toSiteHref('/music/' + songPathSlug(song), basePath)) + '">' + splitPipe(field(song, 'page title')).map(escapeHtml).join('<br>') + '</a><div class="motif-label">' + escapeHtml(title) + (times ? ' — ' + escapeHtml(times) : '') + '</div></article>';
  }).join('');
  return {
    themeId: 'default',
    bodyHtml: '<a href="' + (basePath || '') + '/"><div class="head"></div></a><div class="navi"><span id="navi"></span></div><table class="table"><tr><td><div class="sidebar1"><span id="sidebar"></span></div></td><td><div class="bodybar"><div class="motif-layout"><section class="motif-main"><section id="motifOverview" class="motif-overview"><div class="motif-overview-summary"><h1 id="motifName">' + escapeHtml(title) + '</h1><div id="motifSummaryBox" class="motif-summary-box"><h2 class="motif-summary-title">Summary</h2><div id="motifSummaryContent" class="motif-summary-content">' + (summaryText ? renderMarkdown(summaryText, resolveHref) : '<div class="motif-empty-box">This motif has no summary.</div>') + '</div></div></div><aside class="motif-overview-meta"><div id="motifMetaPanel" class="motif-meta-panel"><div class="motif-image-wrap"><img id="motifImage" class="motif-image" src="' + escapeHtml(toSiteHref(imagePath || '/public/images/cover-art/bs.png', basePath)) + '" alt="' + escapeHtml(title + ' motif image') + '"></div><div id="motifFirstAppearsWrap" class="motif-first-appears"><h3 class="motif-first-appears-title">First Appears In</h3><div id="motifFirstAppearsValue" class="motif-first-appears-value">' + (first ? link('/music/' + songPathSlug(first.entry.row), field(first.entry.row, 'page title'), basePath) : 'Unknown') + '</div></div><div class="motif-volume-wrap"><label class="motif-volume-label" for="motifVolumeSlider">Volume</label><input id="motifVolumeSlider" class="motif-volume-slider" type="range" min="0" max="100" step="1" aria-label="Motif player volume"></div><div id="motifTranscriptControlDock" class="motif-transcript-control-dock"><div class="motif-transcript-control-label">Play Transcript</div></div></div></aside></section><h2 id="motifSongsHeading" class="motif-section-title">Songs with ' + escapeHtml(title) + '</h2><div id="motifSongList" class="motif-song-list">' + (variationSections || '<div class="motif-empty">No songs for the ' + escapeHtml(title) + ' motif.</div>') + '</div></section></div></div></td></tr></table>'
  };
}

function timeToSeconds(value) {
  const parts = String(value || '').split(':').map(Number);
  return parts.length === 2 ? parts[0] * 60 + parts[1] : parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : Number(value) || 0;
}

function renderTrack(row, basePath) {
  const slug = songPathSlug(row);
  const title = splitPipe(field(row, 'page title')).join(' ') || slug;
  return '<div class="song-item">' + link('/music/' + slug, title, basePath) + '</div>';
}
function isAlbumFieldEnabled(row, name) {
  const value = field(row, name + ' enabled', name.replace(/s$/u, '') + ' enabled');
  return !value || /^(true|yes|1)$/iu.test(value);
}
function albumCreditLinks(value, resolveHref) {
  return splitPipe(value).map((name) => {
    const href = resolveHref('artist:' + name);
    return href && href !== '#' ? '<a class="artist-credit-link" href="' + escapeHtml(href) + '">' + escapeHtml(name) + '</a>' : escapeHtml(name);
  }).join('<br>');
}
function albumSidebarBlock(label, content) {
  if (!content) return '';
  return '<div class="song-info-block album-info-block"><div class="song-info-label album-info-label">' + escapeHtml(label) + '</div><div class="song-info-content album-info-content">' + content + '</div></div>';
}
function albumListenContent(row, resolveHref) {
  if (!isAlbumFieldEnabled(row, 'listen')) return '';
  let labels = splitPipe(field(row, 'listen text'));
  let hrefs = splitPipe(field(row, 'listen links'));
  const legacy = splitPipe(field(row, 'listen'));
  if (!labels.length && !hrefs.length && legacy.length) {
    legacy.forEach((entry) => {
      const equals = entry.indexOf('=');
      labels.push(equals < 0 ? entry : entry.slice(0, equals).trim());
      hrefs.push(equals < 0 ? '' : entry.slice(equals + 1).trim());
    });
  }
  const count = Math.max(labels.length, hrefs.length);
  return Array.from({ length: count }, (_unused, index) => {
    const label = labels[index] || hrefs[index] || '';
    const rawHref = hrefs[index] || '';
    if (!rawHref) return escapeHtml(label);
    const href = resolveHref(rawHref);
    const external = /^https?:\/\//iu.test(href);
    return '<a href="' + escapeHtml(href) + '"' + (external ? ' target="_blank" rel="noopener noreferrer"' : '') + '>' + escapeHtml(label) + '</a>';
  }).filter(Boolean).join('<br>');
}
function albumSidebar(row, resolveHref) {
  const fields = [
    ['release date', 'Release Date', (value) => splitPipe(value).map(escapeHtml).join('<br>')],
    ['artists', 'Artist', (value) => albumCreditLinks(value, resolveHref)],
    ['mixing', 'Mixing', (value) => albumCreditLinks(value, resolveHref)],
    ['mastering', 'Mastering', (value) => albumCreditLinks(value, resolveHref)],
    ['instrumentals', 'Instrumentals', (value) => albumCreditLinks(value, resolveHref)],
    ['vocalists', 'Vocalist', (value) => albumCreditLinks(value, resolveHref)]
  ];
  const blocks = fields.map(([key, label, render]) => {
    const value = field(row, key, key === 'vocalists' ? 'vocalistss' : key);
    if (!value || !isAlbumFieldEnabled(row, key)) return '';
    const names = splitPipe(value);
    const blockLabel = key === 'artists' || key === 'vocalists'
      ? (names.length === 1 ? label : label + 's')
      : label;
    return albumSidebarBlock(blockLabel, render(value));
  }).join('');
  return '<div class="album-info-sidebar">' + blocks + albumSidebarBlock('Listen', albumListenContent(row, resolveHref)) + '</div>';
}
async function renderAlbum(entity, data, basePath, resolveHref) {
  const row = (data.albums || []).find((entry) => splitPipe(field(entry, 'album_id', 'album id')).some((id) => normalizeSlug(id) === entity.slug)) || {};
  const title = field(row, 'album title', 'page title') || entity.title;
  const songs = (data.songs || []).filter((song) => splitPipe(field(song, 'album_id', 'album id')).some((id) => normalizeSlug(id) === entity.slug) && !field(song, 'path id').includes('#'));
  const trackNumber = (song) => {
    const albumIds = splitPipe(field(song, 'album_id', 'album id')).map((id) => normalizeSlug(id));
    const albumIndex = albumIds.indexOf(entity.slug);
    const value = splitPipe(field(song, 'track number'))[albumIndex] || '';
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
  };
  songs.sort((left, right) => {
    const a = trackNumber(left);
    const b = trackNumber(right);
    return a - b;
  });
  const summary = await readText('albums/summaries/' + entity.slug + '.txt');
  const extended = await readText('albums/extended/' + entity.slug + '.txt');
  const art = splitPipe(field(row, 'album art'))[0] || '';
  const artists = albumCreditLinks(field(row, 'artists'), resolveHref).replace(/<br>/gu, ', ');
  const release = field(row, 'release date');
  const albumId = field(row, 'album_id', 'album id').toLowerCase();
  const altTabs = ['cc', 'ccde'].includes(albumId)
    ? ['cc', 'ccde'].map((variant) => '<a class="version-tab' + (variant === albumId ? ' active' : '') + '" href="' + escapeHtml(toSiteHref('/music/' + variant, basePath)) + '">' + (variant === 'cc' ? 'CC' : 'CCDE') + '</a>').join('')
    : '';
  const tabs = '<div class="song-tabs-container album-page-tabs-container"><div class="song-tabs album-page-tabs"><button type="button" class="song-tab active" data-album-tab="tracklist">Tracklist</button><button type="button" class="song-tab" data-album-tab="summary">Summary</button><button type="button" class="song-tab" data-album-tab="extended">Extended Info</button><div class="tabs-spacer"></div>' + altTabs + '</div></div>';
  const theme = field(row, 'theme') || 'default';
  const coverFilename = art.split('/').pop().toLowerCase();
  const coverCredit = (data.coverArtists || []).find((entry) => field(entry, 'filename').toLowerCase() === coverFilename);
  const rawCredit = field(coverCredit, 'credit');
  const creditHref = rawCredit ? resolveHref('artist:' + rawCredit) : '';
  const creditHtml = rawCredit && creditHref && creditHref !== '#'
    ? '<a class="artist-credit-link" href="' + escapeHtml(creditHref) + '">' + escapeHtml(rawCredit) + '</a>'
    : escapeHtml(rawCredit);
  return {
    themeId: theme,
    themeColor: themeColorFor(data, theme),
    bodyHtml: '<a href="' + (basePath || '') + '/"><div class="head"></div></a><div class="navi"><span id="navi"></span></div><table class="table"><tr><td><div class="sidebar1"><span id="sidebar"></span></div></td><td><div class="album-main-col" data-static-album="true">' + tabs + '<div class="bodybar album-body-panel"><div class="album-layout"><div class="album-page-left"><div class="album-info"><h1>' + escapeHtml(title).replace(/\s*\|\s*/gu, '<br>') + '</h1><div class="album-meta">' + (artists ? '<p>By ' + artists + '.</p>' : '') + (release ? '<p>Released ' + escapeHtml(release) + '.</p>' : '') + '</div></div><div id="album-content-tracklist" class="album-tab-content active" data-album-tab-content="tracklist"><div class="song-list">' + songs.map((song) => renderTrack(song, basePath)).join('') + '</div></div><div id="album-content-summary" class="album-tab-content" data-album-tab-content="summary"><div class="album-summary-content">' + (summary ? renderMarkdown(summary, resolveHref) : '<div class="song-empty-box">This page has no summary.</div>') + '</div></div><div id="album-content-extended" class="album-tab-content" data-album-tab-content="extended"><div class="album-summary-content">' + (extended ? renderMarkdown(extended, resolveHref) : '<div class="song-empty-box">This page has no extended info.</div>') + '</div></div></div><div class="album-page-right"><div class="album-cover-container"><img alt="' + escapeHtml(title) + '"' + (art ? ' src="' + escapeHtml((basePath || '') + '/public/images/cover-art/' + art) + '"' : '') + '><div class="album-cover-credit">Cover art by: ' + creditHtml + '</div></div><div class="album-nav-buttons"><a href="javascript:void(0);" class="album-nav-link">← Previous</a><a href="javascript:void(0);" class="album-nav-link">Next →</a></div>' + albumSidebar(row, resolveHref) + '</div></div></div></div></td></tr></table>'
  };
}

async function renderStaticEntity(entity, data, basePath) {
  const resolveHref = createHrefResolver(data, basePath);
  if (entity.kind === 'song') return renderSong(entity, data, basePath, resolveHref);
  if (entity.kind === 'album') return renderAlbum(entity, data, basePath, resolveHref);
  if (entity.kind === 'artist') return renderArtist(entity, data, basePath, resolveHref);
  if (entity.kind === 'motif') return renderMotif(entity, data, basePath, resolveHref);
  throw new Error('Unsupported entity kind: ' + entity.kind);
}

module.exports = { renderStaticEntity, toSiteHref };
