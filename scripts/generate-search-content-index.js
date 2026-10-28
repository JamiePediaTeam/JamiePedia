const fs = require('fs/promises');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const publicRoot = path.join(projectRoot, 'public');

function normalizeKeyFromFileName(fileName) {
  return String(fileName || '')
    .replace(/\.[^.]+$/u, '')
    .trim()
    .toLowerCase();
}

function normalizeSearchContentLineBreaks(source) {
  const sourceLines = String(source || '').split(/\r?\n/u);
  const referencesStart = sourceLines.findIndex((line) => /^\s*#{0,6}\s*references\b\s*:?(?:\s|$)/iu.test(line));
  const searchableLines = referencesStart >= 0 ? sourceLines.slice(0, referencesStart) : sourceLines;
  const lines = searchableLines
    .map((line) => line.replace(/\[([^\]]+)\]\([^)]+\)/gu, '$1'))
    .map((line) => line.replace(/\[(?:verse|pre-chorus|chorus|bridge|outro)(?:\s+[^\]]*)?\]/giu, ''))
    .map((line) => line.replace(/\[\d+\]/gu, ''))
    .map((line) => line.replace(/\[([^\]]+)\]/gu, '$1'))
    .map((line) => line.replace(/[\[\]]/gu, ''))
    .map((line) => line.replace(/<a\b[^>]*>(.*?)<\/a>/giu, '$1'))
    .map((line) => line.replace(/<[^>]*>/gu, ''))
    .map((line) => line.replace(/https?:\/\/\S+/giu, ''))
    .map((line) => String(line || '').trim())
    .filter((line) => line && !/^#{1,6}\s*/u.test(line));

  if (!lines.length) {
    return '';
  }

  return lines
    .map((line) => line.replace(/\s+/gu, ' ').trim())
    .filter(Boolean)
    .join(' ');
}

function parseLrcToSearchText(source) {
  const lines = String(source || '').split(/\r?\n/u);
  const collected = [];

  for (const line of lines) {
    if (!line.includes('[')) {
      continue;
    }

    const hasTimestamp = /\[\d{1,2}:\d{2}(?:[.:]\d{1,3})?\]/u.test(line);
    if (!hasTimestamp) {
      continue;
    }

    const lyric = line.replace(/\[[^\]]+\]/gu, '').replace(/\s+/gu, ' ').trim();
    if (lyric) {
      collected.push(lyric);
    }
  }

  return normalizeSearchContentLineBreaks(collected.join('\n'));
}

async function safeReadDir(dirPath) {
  try {
    return await fs.readdir(dirPath, { withFileTypes: true });
  } catch (_error) {
    return [];
  }
}

async function readTextIfExists(filePath) {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch (_error) {
    return '';
  }
}

async function buildSongContentIndex() {
  const songsRoot = path.join(publicRoot, 'songs');
  const folderMap = {
    summaries: 'summary',
    annotations: 'annotations',
    extended: 'extended',
    lyrics: 'lyrics'
  };

  const bySlug = Object.create(null);

  for (const [folderName, targetKey] of Object.entries(folderMap)) {
    const dirPath = path.join(songsRoot, folderName);
    const entries = await safeReadDir(dirPath);

    for (const entry of entries) {
      if (!entry.isFile()) {
        continue;
      }

      const extension = path.extname(entry.name).toLowerCase();
      if ((folderName === 'lyrics' && extension !== '.lrc') || (folderName !== 'lyrics' && extension !== '.txt')) {
        continue;
      }

      const slugKey = normalizeKeyFromFileName(entry.name);
      if (!slugKey) {
        continue;
      }

      if (!bySlug[slugKey]) {
        bySlug[slugKey] = {
          summary: '',
          annotations: '',
          extended: '',
          lyrics: ''
        };
      }

      const source = await readTextIfExists(path.join(dirPath, entry.name));
      if (!source) {
        continue;
      }

      if (folderName === 'lyrics') {
        bySlug[slugKey][targetKey] = parseLrcToSearchText(source);
      } else {
        bySlug[slugKey][targetKey] = normalizeSearchContentLineBreaks(source);
      }
    }
  }

  return bySlug;
}

async function buildMotifSummaryIndex() {
  const motifSummaryDirs = [
    path.join(publicRoot, 'motif-summaries'),
    path.join(publicRoot, 'motifs', 'motif-summaries')
  ];

  const motifMap = Object.create(null);

  for (const dirPath of motifSummaryDirs) {
    const entries = await safeReadDir(dirPath);
    for (const entry of entries) {
      if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== '.txt') {
        continue;
      }

      const key = normalizeKeyFromFileName(entry.name);
      if (!key || motifMap[key]) {
        continue;
      }

      const text = await readTextIfExists(path.join(dirPath, entry.name));
      if (!text) {
        continue;
      }

      motifMap[key] = normalizeSearchContentLineBreaks(text);
    }
  }

  return motifMap;
}

async function buildAlbumContentIndex() {
  const albumsRoot = path.join(publicRoot, 'albums');
  const folderMap = {
    summaries: 'summary',
    extended: 'extended'
  };

  const bySlug = Object.create(null);

  for (const [folderName, targetKey] of Object.entries(folderMap)) {
    const dirPath = path.join(albumsRoot, folderName);
    const entries = await safeReadDir(dirPath);

    for (const entry of entries) {
      if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== '.txt') {
        continue;
      }

      const slugKey = normalizeKeyFromFileName(entry.name);
      if (!slugKey) {
        continue;
      }

      if (!bySlug[slugKey]) {
        bySlug[slugKey] = {
          summary: '',
          extended: ''
        };
      }

      const source = await readTextIfExists(path.join(dirPath, entry.name));
      if (!source) {
        continue;
      }

      bySlug[slugKey][targetKey] = normalizeSearchContentLineBreaks(source);
    }
  }

  return bySlug;
}

async function buildArtistSummaryIndex() {
  const artistSummaryDir = path.join(publicRoot, 'artists', 'summaries');
  const artistMap = Object.create(null);
  const entries = await safeReadDir(artistSummaryDir);

  for (const entry of entries) {
    if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== '.txt') {
      continue;
    }

    const key = normalizeKeyFromFileName(entry.name);
    if (!key || artistMap[key]) {
      continue;
    }

    const source = await readTextIfExists(path.join(artistSummaryDir, entry.name));
    if (!source) {
      continue;
    }

    artistMap[key] = normalizeSearchContentLineBreaks(source);
  }

  return artistMap;
}

async function generateSearchContentIndex() {
  const outputDir = path.join(publicRoot, 'search');
  const outputPath = path.join(outputDir, 'search-content-index.json');

  const [songs, motifs, albums, artists] = await Promise.all([
    buildSongContentIndex(),
    buildMotifSummaryIndex(),
    buildAlbumContentIndex(),
    buildArtistSummaryIndex()
  ]);

  const output = {
    version: 1,
    generatedAt: new Date().toISOString(),
    songs,
    albums,
    motifs,
    artists
  };

  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(output, null, 2) + '\n', 'utf8');

  const songCount = Object.keys(songs).length;
  const albumCount = Object.keys(albums).length;
  const motifCount = Object.keys(motifs).length;
  const artistCount = Object.keys(artists).length;
  console.log('Generated search content index at', outputPath);
  console.log('Indexed song slugs:', songCount);
  console.log('Indexed album slugs:', albumCount);
  console.log('Indexed motif summaries:', motifCount);
  console.log('Indexed artist summaries:', artistCount);
}

generateSearchContentIndex().catch((error) => {
  console.error('Failed to generate search content index:', error);
  process.exitCode = 1;
});
