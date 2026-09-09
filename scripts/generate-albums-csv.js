const fs = require('fs');
const path = require('path');

const root = process.cwd();
const musicDir = path.join(root, 'music');
const outputPath = path.join(root, 'public/csv/JamiePedia Data - Albums.csv');

const preferredAlbumOrder = [
  'aa.html',
  'aed.html',
  'bs.html',
  'cc.html',
  'ccde.html',
  'cs.html',
  'contentcompanion.html',
  'destiny.html',
  'PPPP.html',
  'dnh.html',
  'video-hunting-specimen.html',
  'aod.html',
  'bc.html',
  'jpjp3.html',
  'jpjp4.html',
  'jpjp5.html',
  'jpjp6.html',
  'ccii.html',
  'ccontrepoint.html',
  'ff2.html',
  'ds2021.html',
  'ds2024.html',
  'vvff.html',
  'vvjp.html',
  'bdkt26.html',
  'meff.html',
  'birdapp.html',
  'butterfly.html',
  'paisleyAcc.html',
  'tumble.html',
  'sound.html',
  'pamiejaige.html'
];

const musicPageSectionByAlbumPath = {
  'aa.html': 'Jamie Paige Albums',
  'aed.html': 'Jamie Paige Albums',
  'bs.html': 'Jamie Paige Albums',
  'cc.html': 'Jamie Paige Albums',
  'ccde.html': 'Jamie Paige Albums',
  'cs.html': 'Jamie Paige Albums',
  'contentcompanion.html': 'Jamie Paige Albums',
  'destiny.html': 'Singles',
  'PPPP.html': 'Singles',
  'dnh.html': 'Singles',
  'video-hunting-specimen.html': 'Features and Collaborations',
  'aod.html': 'Bandcamp Subscriber Exclusive Albums',
  'bc.html': 'Bandcamp Subscriber Exclusive Albums',
  'jpjp3.html': 'Bandcamp Subscriber Exclusive Albums',
  'jpjp4.html': 'Bandcamp Subscriber Exclusive Albums',
  'jpjp5.html': 'Bandcamp Subscriber Exclusive Albums',
  'jpjp6.html': 'Bandcamp Subscriber Exclusive Albums',
  'ccii.html': 'Bandcamp Subscriber Exclusive Albums',
  'ccontrepoint.html': 'FLAVOR FOLEY',
  'ff2.html': 'FLAVOR FOLEY',
  'ds2021.html': 'Live Shows',
  'ds2024.html': 'Live Shows',
  'vvff.html': 'Live Shows',
  'vvjp.html': 'Live Shows',
  'bdkt26.html': 'Live Shows',
  'meff.html': 'Live Shows',
  'sound.html': 'Miscellaneous',
  'pamiejaige.html': 'Miscellaneous',
  'social.html': 'Miscellaneous'
};

function stripHtml(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toCsvCell(value) {
  const text = String(value == null ? '' : value);
  if (/[",\n\r]/.test(text)) {
    return '"' + text.replace(/"/g, '""') + '"';
  }
  return text;
}

function extractThemeId(html) {
  const match = String(html || '').match(/\sdata-theme-id=["']([^"']+)["']/i);
  return stripHtml(match ? match[1] : '');
}

function extractAlbumTitle(html) {
  const h1Match = String(html || '').match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1Match && h1Match[1]) {
    const h1 = stripHtml(h1Match[1]);
    if (h1) {
      return h1;
    }
  }

  const titleMatch = String(html || '').match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return stripHtml(titleMatch ? titleMatch[1] : '');
}

function extractFilenameFromPath(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    return '';
  }

  const withoutQuery = raw.split('?')[0].split('#')[0];
  const file = withoutQuery.split('/').pop() || '';
  return file.trim();
}

function extractAlbumImage(html) {
  const source = String(html || '');

  const coverContainerMatch = source.match(/<div\s+class=["'][^"']*album-cover-container[^"']*["'][^>]*>[\s\S]*?<img\s+[^>]*src=["']([^"']+)["']/i);
  if (coverContainerMatch && coverContainerMatch[1]) {
    const fromCover = extractFilenameFromPath(coverContainerMatch[1]);
    if (fromCover) {
      return fromCover;
    }
  }

  const ogImageMatch = source.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i)
    || source.match(/<meta\s+content=["']([^"']+)["']\s+property=["']og:image["']/i);
  if (ogImageMatch && ogImageMatch[1]) {
    return extractFilenameFromPath(ogImageMatch[1]);
  }

  return '';
}

function extractAlbumMetaParagraphs(html) {
  const sectionMatch = String(html || '').match(/<div\s+class=["'][^"']*album-meta[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
  if (!sectionMatch || !sectionMatch[1]) {
    return [];
  }

  const inner = sectionMatch[1];
  const paragraphs = [];
  const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let match;
  while ((match = pRegex.exec(inner)) !== null) {
    paragraphs.push(stripHtml(match[1]));
  }
  return paragraphs;
}

function extractArtistAndReleaseDate(html) {
  const paragraphs = extractAlbumMetaParagraphs(html);
  let artist = '';
  let releaseDate = '';

  paragraphs.forEach((paragraph) => {
    const text = String(paragraph || '').trim();
    if (!text) {
      return;
    }

    if (!artist && /^by\s+/i.test(text)) {
      artist = text.replace(/^by\s+/i, '').replace(/\.$/, '').trim();
      return;
    }

    if (!releaseDate && /^released\s+/i.test(text)) {
      releaseDate = text.replace(/^released\s+/i, '').replace(/\.$/, '').trim();
    }
  });

  return { artist, releaseDate };
}

function isAlbumIndexPage(html) {
  const source = String(html || '');
  if (/song-page-wrapper/i.test(source)) {
    return false;
  }
  return /class=["'][^"']*album-header[^"']*["']/i.test(source);
}

function buildAlbumRows() {
  const discovered = fs.readdirSync(musicDir)
    .filter((name) => name.toLowerCase().endsWith('.html'));

  const discoveredSet = new Set(discovered);
  const names = preferredAlbumOrder.filter((name) => discoveredSet.has(name));

  discovered
    .filter((name) => !names.includes(name))
    .sort((a, b) => a.localeCompare(b))
    .forEach((name) => names.push(name));

  const rows = [];

  names.forEach((name) => {
    const filePath = path.join(musicDir, name);
    const html = fs.readFileSync(filePath, 'utf8');
    if (!isAlbumIndexPage(html)) {
      return;
    }

    const albumId = name.replace(/\.html$/i, '').trim();
    const title = extractAlbumTitle(html);
    const albumArt = extractAlbumImage(html);
    const theme = extractThemeId(html);
    const meta = extractArtistAndReleaseDate(html);
    const section = String(musicPageSectionByAlbumPath[name] || '');

    rows.push([
      albumId,
      albumId,
      title,
      albumArt,
      meta.artist,
      meta.releaseDate,
      theme,
      section,
      '',
      '',
      ''
    ]);
  });

  return rows;
}

const rows = [
  ['Path', 'album_id', 'Album Title', 'Album Art', 'Artists', 'Release Date', 'Theme', 'music_page_section', 'Vocalists', 'Listen Text', 'Listen Links'],
  ...buildAlbumRows()
];

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
const csv = rows.map((row) => row.map(toCsvCell).join(',')).join('\n') + '\n';
fs.writeFileSync(outputPath, csv, 'utf8');

console.log('Wrote', rows.length - 1, 'album rows to', outputPath);
