const fs = require('fs');
const path = require('path');

const root = process.cwd();
const songsCsvPath = path.join(root, 'public/csv/JamiePedia Data - Songs.csv');
const albumsCsvPath = path.join(root, 'public/csv/JamiePedia Data - Albums.csv');
const motifsCsvPath = path.join(root, 'public/csv/JamiePedia Data - Motifs.csv');

function parseCsvText(text) {
  const rows = [];
  const source = String(text || '');
  let currentRow = [];
  let currentCell = '';
  let inQuotes = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const nextCharacter = source[index + 1];

    if (inQuotes) {
      if (character === '"' && nextCharacter === '"') {
        currentCell += '"';
        index += 1;
      } else if (character === '"') {
        inQuotes = false;
      } else {
        currentCell += character;
      }
      continue;
    }

    if (character === '"') {
      inQuotes = true;
      continue;
    }

    if (character === ',') {
      currentRow.push(currentCell);
      currentCell = '';
      continue;
    }

    if (character === '\n') {
      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = '';
      continue;
    }

    if (character === '\r') {
      continue;
    }

    currentCell += character;
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }

  return rows;
}

function toCsvCell(value) {
  const text = String(value == null ? '' : value);
  if (/[",\n\r]/.test(text)) {
    return '"' + text.replace(/"/g, '""') + '"';
  }
  return text;
}

function rowsToCsv(rows) {
  return rows.map((row) => row.map((cell) => toCsvCell(cell)).join(',')).join('\n') + '\n';
}

function normalizeHeader(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function splitPipeValues(value) {
  return String(value || '')
    .split(/\s*\|\s*/)
    .map((item) => item.trim());
}

function normalizeBoolText(value) {
  const text = String(value || '').trim().toUpperCase();
  return text === 'TRUE' || text === 'YES' || text === '1';
}

function boolText(value) {
  return value ? 'TRUE' : 'FALSE';
}

function normalizeReferenceType(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) {
    return '';
  }
  if (raw === 'rhythmic' || raw === 'rhythm' || raw === 'rhymic') {
    return 'rhythmic';
  }
  if (raw === 'lyrical' || raw === 'lyric' || raw === 'lyrics') {
    return 'lyrical';
  }
  if (raw === 'sample' || raw === 'sampling') {
    return 'sample';
  }
  return '';
}

function normalizePathId(rawPathValue) {
  const raw = String(rawPathValue || '').trim();
  if (!raw) {
    return '';
  }

  const hashIndex = raw.indexOf('#');
  const pathPart = hashIndex === -1 ? raw : raw.slice(0, hashIndex);
  const hashPart = hashIndex === -1 ? '' : raw.slice(hashIndex + 1).trim();

  const cleanPath = pathPart.split('?')[0].trim();
  const baseSegment = cleanPath.split('/').filter(Boolean).pop() || '';
  const slug = baseSegment.replace(/\.html$/i, '').trim();

  if (!slug) {
    return '';
  }

  return hashPart ? (slug + '#' + hashPart) : slug;
}

function deriveSongId(pathId, title) {
  const fromPath = String(pathId || '').trim().split('#')[0].trim();
  const seed = fromPath || String(title || '').trim();
  if (!seed) {
    return '';
  }

  return seed
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/__+/g, '_');
}

function readCsvObjects(csvPath) {
  const text = fs.readFileSync(csvPath, 'utf8');
  const rows = parseCsvText(text).map((row) => row.map((cell) => String(cell || '').trim()));
  if (rows.length < 2) {
    return { headers: [], objects: [], rows };
  }

  const headers = rows[0];
  const normalizedHeaders = headers.map((header) => normalizeHeader(header));
  const objects = rows.slice(1).map((values) => {
    const row = {};
    normalizedHeaders.forEach((header, index) => {
      row[header] = String(values[index] || '').trim();
    });
    return row;
  });

  return { headers, objects, rows };
}

function getField(row, aliases) {
  for (const alias of aliases) {
    const value = String((row || {})[alias] || '').trim();
    if (value) {
      return value;
    }
  }
  return '';
}

function normalizeAlbumPathId(rawPathValue) {
  const raw = String(rawPathValue || '').trim();
  if (!raw) {
    return '';
  }

  const hashless = raw.split('#')[0].split('?')[0].trim();
  const fileName = hashless.split('/').filter(Boolean).pop() || '';
  return fileName.replace(/\.html$/i, '').trim();
}

function reformatAlbumsCsv() {
  const { objects: rows } = readCsvObjects(albumsCsvPath);
  if (!rows.length) {
    return 0;
  }

  const headers = [
    'album_id',
    'Album Title',
    'Album Art',
    'Artists',
    'Release Date',
    'Theme',
    'music_page_section',
    'Vocalists',
    'Listen Text',
    'Listen Links'
  ];

  const outputRows = [headers];

  rows.forEach((row) => {
    const albumId = getField(row, ['album_id']) || normalizeAlbumPathId(getField(row, ['path', 'page_path', 'path_id']));

    outputRows.push([
      albumId,
      getField(row, ['album_title', 'page_title', 'title']),
      getField(row, ['album_art', 'album_art_paths']),
      getField(row, ['artists']),
      getField(row, ['release_date']),
      getField(row, ['theme', 'version_theme']),
      getField(row, ['music_page_section']),
      getField(row, ['vocalists']),
      getField(row, ['listen_text', 'listen']),
      getField(row, ['listen_links'])
    ]);
  });

  fs.writeFileSync(albumsCsvPath, rowsToCsv(outputRows), 'utf8');
  return outputRows.length - 1;
}

function parseMotifsTables(rows) {
  const motifHeaderIndex = 0;
  const motifHeader = rows[motifHeaderIndex] || [];

  let referenceHeaderIndex = -1;
  for (let index = 1; index < rows.length; index += 1) {
    const normalized = (rows[index] || []).map((cell) => normalizeHeader(cell));
    if (normalized[0] === 'song_id' && normalized.includes('motif_id') && normalized.includes('start_time') && normalized.includes('end_time')) {
      referenceHeaderIndex = index;
      break;
    }
  }

  const motifRows = [];
  const refRows = [];
  const refHeader = referenceHeaderIndex >= 0 ? rows[referenceHeaderIndex] : [];

  const motifEnd = referenceHeaderIndex >= 0 ? referenceHeaderIndex : rows.length;
  for (let index = motifHeaderIndex + 1; index < motifEnd; index += 1) {
    const row = rows[index] || [];
    if (row.every((cell) => !String(cell || '').trim())) {
      continue;
    }
    motifRows.push(row);
  }

  if (referenceHeaderIndex >= 0) {
    for (let index = referenceHeaderIndex + 1; index < rows.length; index += 1) {
      const row = rows[index] || [];
      if (row.every((cell) => !String(cell || '').trim())) {
        continue;
      }
      refRows.push(row);
    }
  }

  return { motifHeader, motifRows, refHeader, refRows };
}

function reformatSongsAndExtractLegacyRefs() {
  const { objects: rows } = readCsvObjects(songsCsvPath);

  const headers = [
    'album_id',
    'path id',
    'song id',
    'Page Title',
    'Embed Link',
    'Song Color',
    'music_page_section',
    'Song Length',
    'Alt Tab Status?',
    'Alt Tab Name',
    'Theme',
    'Album Art',
    'Cover Art Labels',
    'track number',
    'Release Date',
    'Artists',
    'Vocalists',
    'Listen Text',
    'Listen Links',
    'Close Up'
  ];

  const outputRows = [headers];
  const extractedReferences = [];

  rows.forEach((row) => {
    const pathId = normalizePathId(getField(row, ['path_id', 'path', 'page_path']));
    const pageTitle = getField(row, ['page_title']);
    const songId = getField(row, ['song_id']) || deriveSongId(pathId, pageTitle);

    const refTargets = splitPipeValues(getField(row, ['ref_motif_song_id']));
    const refStarts = splitPipeValues(getField(row, ['ref_start_time']));
    const refEnds = splitPipeValues(getField(row, ['ref_end_time']));
    const refDefinitions = splitPipeValues(getField(row, ['ref_definition']));
    const refVariations = splitPipeValues(getField(row, ['ref_variation']));
    const refVariationLetters = splitPipeValues(getField(row, ['ref_variation_letter']));
    const rhythmicCount = Math.max(refTargets.length, refStarts.length, refEnds.length);

    for (let index = 0; index < rhythmicCount; index += 1) {
      const motifTarget = String(refTargets[index] || '').trim();
      const startTime = String(refStarts[index] || '').trim();
      const endTime = String(refEnds[index] || '').trim();
      if (!songId || !motifTarget || !startTime || !endTime) {
        continue;
      }

      extractedReferences.push({
        songId,
        motifId: motifTarget,
        startTime,
        endTime,
        definition: String(refDefinitions[index] || '').trim(),
        type: 'rhythmic',
        lyrics: '',
        legacyVariation: normalizeBoolText(refVariations[index]),
        legacyVariationLetter: String(refVariationLetters[index] || '').trim()
      });
    }

    const lyricalTargets = splitPipeValues(getField(row, ['lyrical_motif_song_id']));
    const lyricalStarts = splitPipeValues(getField(row, ['lyrical_start_time']));
    const lyricalEnds = splitPipeValues(getField(row, ['lyrical_end_time']));
    const lyricalLyrics = splitPipeValues(getField(row, ['lyrical_lyrics']));
    const lyricalCount = Math.max(lyricalTargets.length, lyricalStarts.length, lyricalEnds.length);

    for (let index = 0; index < lyricalCount; index += 1) {
      const motifTarget = String(lyricalTargets[index] || '').trim();
      const startTime = String(lyricalStarts[index] || '').trim();
      const endTime = String(lyricalEnds[index] || '').trim();
      if (!songId || !motifTarget || !startTime || !endTime) {
        continue;
      }

      extractedReferences.push({
        songId,
        motifId: motifTarget,
        startTime,
        endTime,
        definition: '',
        type: 'lyrical',
        lyrics: String(lyricalLyrics[index] || '').trim(),
        legacyVariation: false,
        legacyVariationLetter: ''
      });
    }

    const sampleTargets = splitPipeValues(getField(row, ['sample_motif_song_id']));
    const sampleStarts = splitPipeValues(getField(row, ['sample_start_time']));
    const sampleEnds = splitPipeValues(getField(row, ['sample_end_time']));
    const sampleCount = Math.max(sampleTargets.length, sampleStarts.length, sampleEnds.length);

    for (let index = 0; index < sampleCount; index += 1) {
      const motifTarget = String(sampleTargets[index] || '').trim();
      const startTime = String(sampleStarts[index] || '').trim();
      const endTime = String(sampleEnds[index] || '').trim();
      if (!songId || !motifTarget || !startTime || !endTime) {
        continue;
      }

      extractedReferences.push({
        songId,
        motifId: motifTarget,
        startTime,
        endTime,
        definition: '',
        type: 'sample',
        lyrics: '',
        legacyVariation: false,
        legacyVariationLetter: ''
      });
    }

    outputRows.push([
      getField(row, ['album_id', 'album_id_']),
      pathId,
      songId,
      pageTitle,
      getField(row, ['embed_link']),
      getField(row, ['song_color']),
      getField(row, ['music_page_section']),
      getField(row, ['song_length']),
      getField(row, ['alt_tab_status', 'alt_tab']),
      getField(row, ['alt_tab_name', 'tab_name']),
      getField(row, ['theme', 'version_theme']),
      getField(row, ['album_art', 'album_art_paths']),
      getField(row, ['cover_art_labels', 'album_tab_labels']),
      getField(row, ['track_number', 'album_track']),
      getField(row, ['release_date']),
      getField(row, ['artists']),
      getField(row, ['vocalists']),
      getField(row, ['listen_text', 'listen']),
      getField(row, ['listen_links']),
      getField(row, ['close_up'])
    ]);
  });

  fs.writeFileSync(songsCsvPath, rowsToCsv(outputRows), 'utf8');
  return { songCount: outputRows.length - 1, extractedReferences };
}

function buildMotifIdMapper(motifRows, motifColumns) {
  const usedIds = new Set();
  const categoryToIds = new Map();
  const categoryLetterToId = new Map();
  const legacyIdToPrimary = new Map();
  const outputRows = [];

  motifRows.forEach((row) => {
    const name = String(row[motifColumns.name] || '').trim();
    const oldMotifId = String(row[motifColumns.id] || '').trim().toLowerCase();
    if (!oldMotifId) {
      return;
    }

    const explicitCategory = motifColumns.category >= 0 ? String(row[motifColumns.category] || '').trim().toLowerCase() : '';
    const categoryId = explicitCategory || oldMotifId;
    const legacyVariationLetter = motifColumns.variationLetter >= 0
      ? String(row[motifColumns.variationLetter] || '').trim().toLowerCase()
      : '';

    let newMotifId = oldMotifId;
    if (legacyVariationLetter) {
      newMotifId = categoryId + '-' + legacyVariationLetter;
    }

    if (usedIds.has(newMotifId)) {
      let suffix = 2;
      while (usedIds.has(newMotifId + '-' + suffix)) {
        suffix += 1;
      }
      newMotifId = newMotifId + '-' + suffix;
    }

    usedIds.add(newMotifId);

    if (!legacyIdToPrimary.has(oldMotifId)) {
      legacyIdToPrimary.set(oldMotifId, newMotifId);
    }

    if (!categoryToIds.has(categoryId)) {
      categoryToIds.set(categoryId, []);
    }
    categoryToIds.get(categoryId).push(newMotifId);

    if (legacyVariationLetter) {
      categoryLetterToId.set(categoryId + '|' + legacyVariationLetter, newMotifId);
    }

    outputRows.push([
      name,
      newMotifId,
      categoryId,
      String(row[motifColumns.image] || '').trim(),
      String(row[motifColumns.isVariation] || '').trim(),
      String(row[motifColumns.type] || '').trim(),
      String(row[motifColumns.hasPage] || '').trim(),
      String(row[motifColumns.referenceLink] || '').trim(),
      String(row[motifColumns.color] || '').trim()
    ]);
  });

  function remapMotifReferenceId(rawTarget, legacyVariationLetter = '') {
    const target = String(rawTarget || '').trim();
    if (!target) {
      return '';
    }

    // Song IDs are upper snake case; motif IDs are lowercase/kebab.
    if (target !== target.toLowerCase()) {
      return target;
    }

    const normalizedTarget = target.toLowerCase();
    const letter = String(legacyVariationLetter || '').trim().toLowerCase();

    if (letter) {
      const byCategoryLetter = categoryLetterToId.get(normalizedTarget + '|' + letter);
      if (byCategoryLetter) {
        return byCategoryLetter;
      }
    }

    if (usedIds.has(normalizedTarget)) {
      return normalizedTarget;
    }

    if (legacyIdToPrimary.has(normalizedTarget)) {
      return legacyIdToPrimary.get(normalizedTarget);
    }

    return target;
  }

  return {
    motifMetadataRows: outputRows,
    remapMotifReferenceId
  };
}

function parseUnifiedReferenceRows(refRows, refColumns) {
  const references = [];
  refRows.forEach((row) => {
    const songId = String(row[refColumns.songId] || '').trim();
    const motifId = String(row[refColumns.motifId] || '').trim();
    const startTime = String(row[refColumns.startTime] || '').trim();
    const endTime = String(row[refColumns.endTime] || '').trim();
    if (!songId || !motifId || !startTime || !endTime) {
      return;
    }

    const typeFromColumn = refColumns.type >= 0 ? normalizeReferenceType(row[refColumns.type]) : '';
    const rhythmic = refColumns.rhythmic >= 0 ? normalizeBoolText(row[refColumns.rhythmic]) : typeFromColumn === 'rhythmic';
    const lyrical = refColumns.lyrical >= 0 ? normalizeBoolText(row[refColumns.lyrical]) : typeFromColumn === 'lyrical';
    const sample = refColumns.sample >= 0 ? normalizeBoolText(row[refColumns.sample]) : typeFromColumn === 'sample';
    const resolvedType = typeFromColumn || (lyrical ? 'lyrical' : (sample ? 'sample' : 'rhythmic'));

    references.push({
      songId,
      motifId,
      startTime,
      endTime,
      definition: String(row[refColumns.definition] || '').trim(),
      type: resolvedType,
      lyrics: String(row[refColumns.lyrics] || '').trim(),
      legacyVariation: false,
      legacyVariationLetter: ''
    });
  });
  return references;
}

function reformatMotifsCsv(extractedReferences) {
  const text = fs.readFileSync(motifsCsvPath, 'utf8');
  const rawRows = parseCsvText(text).map((row) => row.map((cell) => String(cell || '').trim()));
  if (rawRows.length < 2) {
    return { motifCount: 0, referenceCount: 0 };
  }

  const { motifHeader, motifRows, refHeader, refRows } = parseMotifsTables(rawRows);
  const normalizedMotifHeader = motifHeader.map((header) => normalizeHeader(header));

  const motifColumns = {
    name: normalizedMotifHeader.indexOf('motif_name'),
    id: normalizedMotifHeader.indexOf('motif_id'),
    category: normalizedMotifHeader.indexOf('category_id'),
    image: normalizedMotifHeader.indexOf('motif_image_page_and_map'),
    isVariation: normalizedMotifHeader.indexOf('is_variation'),
    type: normalizedMotifHeader.indexOf('type'),
    hasPage: normalizedMotifHeader.indexOf('has_page'),
    referenceLink: normalizedMotifHeader.indexOf('reference_link'),
    color: normalizedMotifHeader.indexOf('motif_color'),
    variationLetter: normalizedMotifHeader.indexOf('variation_letter')
  };

  const mapper = buildMotifIdMapper(motifRows, motifColumns);

  let unifiedReferences = Array.isArray(extractedReferences) ? extractedReferences.slice() : [];

  if (!unifiedReferences.length && refHeader.length) {
    const normalizedRefHeader = refHeader.map((header) => normalizeHeader(header));
    const refColumns = {
      songId: normalizedRefHeader.indexOf('song_id'),
      motifId: normalizedRefHeader.indexOf('motif_id'),
      startTime: normalizedRefHeader.indexOf('start_time'),
      endTime: normalizedRefHeader.indexOf('end_time'),
      definition: normalizedRefHeader.indexOf('definition'),
      type: normalizedRefHeader.indexOf('type'),
      rhythmic: normalizedRefHeader.indexOf('rhythmic'),
      lyrical: normalizedRefHeader.indexOf('lyrical'),
      sample: normalizedRefHeader.indexOf('sample'),
      lyrics: normalizedRefHeader.indexOf('lyrics')
    };

    if (refColumns.songId !== -1 && refColumns.motifId !== -1) {
      unifiedReferences = parseUnifiedReferenceRows(refRows, refColumns);
    }
  }

  const normalizedReferenceRows = [];
  const seen = new Set();

  unifiedReferences.forEach((ref) => {
    const songId = String(ref.songId || '').trim().toUpperCase();
    const mappedMotifId = mapper.remapMotifReferenceId(ref.motifId, ref.legacyVariation ? ref.legacyVariationLetter : '');
    const startTime = String(ref.startTime || '').trim();
    const endTime = String(ref.endTime || '').trim();
    if (!songId || !mappedMotifId || !startTime || !endTime) {
      return;
    }

    const row = [
      songId,
      mappedMotifId,
      startTime,
      endTime,
      String(ref.definition || '').trim(),
      normalizeReferenceType(ref.type) || 'rhythmic',
      String(ref.lyrics || '').trim()
    ];

    const dedupeKey = row.join('\u001F');
    if (seen.has(dedupeKey)) {
      return;
    }

    seen.add(dedupeKey);
    normalizedReferenceRows.push(row);
  });

  const motifHeaderOut = [
    'Motif Name',
    'Motif ID',
    'Category ID',
    'Motif Image (Page and Map)',
    'is variation',
    'Type?',
    'Has Page',
    'reference link',
    'motif color'
  ];

  const referenceHeaderOut = [
    'Song ID',
    'Motif ID',
    'Start Time',
    'End Time',
    'Definition',
    'Type',
    'Lyrics'
  ];

  const outputRows = [
    motifHeaderOut,
    ...mapper.motifMetadataRows,
    [],
    referenceHeaderOut,
    ...normalizedReferenceRows
  ];

  fs.writeFileSync(motifsCsvPath, rowsToCsv(outputRows), 'utf8');

  return {
    motifCount: mapper.motifMetadataRows.length,
    referenceCount: normalizedReferenceRows.length
  };
}

const songResult = reformatSongsAndExtractLegacyRefs();
const motifResult = reformatMotifsCsv(songResult.extractedReferences);
const albumCount = reformatAlbumsCsv();

console.log('Reformatted songs:', songResult.songCount);
console.log('Reformatted motifs:', motifResult.motifCount);
console.log('Reformatted motif references:', motifResult.referenceCount);
console.log('Reformatted albums:', albumCount);
