function parseJamiePediaCsv(text) {
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

function normalizeJamiePediaHeader(value) {
  return normalizeJamiePediaText(value).toLowerCase();
}

function normalizeJamiePediaText(value) {
  return String(value || '').trim();
}

function stripJamiePediaInsertedLyricGaps(value) {
  return String(value || '')
    .replace(/<[^<>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitJamiePediaLyricLines(value) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .split(/\s*\|\s*/)
    .map((item) => stripJamiePediaInsertedLyricGaps(item))
    .filter(Boolean);
}

function normalizeJamiePediaBool(value) {
  const text = normalizeJamiePediaText(value).toUpperCase();
  return text === 'TRUE' || text === '1' || text === 'YES';
}

function normalizeJamiePediaMotifType(value) {
  const text = normalizeJamiePediaText(value).toLowerCase();
  if (text === 'melodic' || text === 'melody') {
    return 'melodic';
  }
  if (text === 'lyrical') {
    return 'lyrical';
  }
  if (text === 'sample') {
    return 'sample';
  }
  return 'motif';
}

function normalizeJamiePediaColor(value, fallback = '#351854') {
  const text = normalizeJamiePediaText(value);
  if (!text) {
    return fallback;
  }

  return text.startsWith('#') ? text : '#' + text;
}

function normalizeJamiePediaHexColor(value, fallback = '#351854') {
  const text = normalizeJamiePediaColor(value, fallback).replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(text)) {
    return fallback;
  }

  return '#' + text.toUpperCase();
}

function hexToRgb(hex) {
  const normalized = normalizeJamiePediaHexColor(hex).replace('#', '');
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16)
  };
}

function rgbToHex(red, green, blue) {
  return '#' + [red, green, blue].map((value) => {
    const clamped = Math.max(0, Math.min(255, Math.round(value)));
    return clamped.toString(16).padStart(2, '0');
  }).join('').toUpperCase();
}

function rgbToHsl(red, green, blue) {
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let hue = 0;
  let saturation = 0;
  const lightness = (max + min) / 2;

  if (delta !== 0) {
    saturation = delta / (1 - Math.abs(2 * lightness - 1));

    switch (max) {
      case r:
        hue = ((g - b) / delta) % 6;
        break;
      case g:
        hue = (b - r) / delta + 2;
        break;
      default:
        hue = (r - g) / delta + 4;
        break;
    }

    hue *= 60;
    if (hue < 0) {
      hue += 360;
    }
  }

  return { h: hue, s: saturation, l: lightness };
}

function hslToRgb(hue, saturation, lightness) {
  const c = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const hueSection = hue / 60;
  const x = c * (1 - Math.abs((hueSection % 2) - 1));
  let r1 = 0;
  let g1 = 0;
  let b1 = 0;

  if (hueSection >= 0 && hueSection < 1) {
    r1 = c;
    g1 = x;
  } else if (hueSection < 2) {
    r1 = x;
    g1 = c;
  } else if (hueSection < 3) {
    g1 = c;
    b1 = x;
  } else if (hueSection < 4) {
    g1 = x;
    b1 = c;
  } else if (hueSection < 5) {
    r1 = x;
    b1 = c;
  } else {
    r1 = c;
    b1 = x;
  }

  const match = lightness - (c / 2);
  return {
    r: (r1 + match) * 255,
    g: (g1 + match) * 255,
    b: (b1 + match) * 255
  };
}

function buildVariationColors(baseColor, count) {
  if (count <= 0) {
    return [];
  }

  const base = normalizeJamiePediaHexColor(baseColor, '#351854');
  const rgb = hexToRgb(base);
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const colors = [base];

  for (let index = 1; index < count; index += 1) {
    const nextHue = (hsl.h + (index * 10)) % 360;
    const nextSaturation = Math.max(0.22, hsl.s - (index * 0.08));
    const nextLightness = Math.min(0.92, hsl.l + (index * 0.12));
    const nextRgb = hslToRgb(nextHue, nextSaturation, nextLightness);
    colors.push(rgbToHex(nextRgb.r, nextRgb.g, nextRgb.b));
  }

  return colors;
}

function currentScriptBaseUrl() {
  const script = document.currentScript;
  return script && script.src ? script.src : window.location.href;
}

function loadJamiePediaCsvText(csvRelativePath, errorLabel) {
  const csvPath = encodeURI(csvRelativePath);
  const csvUrl = new URL(csvPath, currentScriptBaseUrl());
  const request = new XMLHttpRequest();
  request.open('GET', csvUrl.href, false);
  request.send(null);

  if (request.status >= 200 && request.status < 300) {
    return request.responseText || '';
  }

  throw new Error('Unable to load JamiePedia ' + errorLabel + ' CSV');
}

function tryLoadJamiePediaCsvText(csvRelativePath, errorLabel) {
  try {
    return loadJamiePediaCsvText(csvRelativePath, errorLabel);
  } catch (_error) {
    return '';
  }
}

function normalizeSongPathId(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    return '';
  }

  const hashIndex = raw.indexOf('#');
  const pathPart = hashIndex === -1 ? raw : raw.slice(0, hashIndex);
  const hashPart = hashIndex === -1 ? '' : raw.slice(hashIndex + 1).trim();

  const cleanedPath = pathPart
    .replace(/^\.{1,2}\//, '')
    .replace(/^\/?music\//i, '')
    .replace(/\.html$/i, '')
    .replace(/\/+$/, '')
    .trim();

  if (!cleanedPath) {
    return '';
  }

  return hashPart ? (cleanedPath + '#' + hashPart) : cleanedPath;
}

function buildSongPathFromPathId(pathId) {
  const normalized = normalizeSongPathId(pathId);
  if (!normalized) {
    return '';
  }

  const hashIndex = normalized.indexOf('#');
  const pathPart = hashIndex === -1 ? normalized : normalized.slice(0, hashIndex);
  const hashPart = hashIndex === -1 ? '' : normalized.slice(hashIndex + 1).trim();

  const href = '/music/' + pathPart;
  return hashPart ? (href + '#' + hashPart) : href;
}

function deriveSongId(pathId, title) {
  const source = String(pathId || '').split('#')[0].trim() || String(title || '').trim();
  if (!source) {
    return '';
  }

  return source
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/__+/g, '_');
}

function splitJamiePediaPipeValues(value) {
  return String(value || '')
    .split(/\s*\|\s*/)
    .map((item) => item.trim());
}

class MotifReference {
  constructor(motifId, startTime = '', endTime = '', isVariation = false, isDefinition = false, variationId = '', options = {}) {
    this.motifId = motifId;
    this.startTime = startTime;
    this.endTime = endTime;
    this.isVariation = isVariation;
    this.isDefinition = isDefinition;
    this.variationId = variationId;
    this.isLyrical = !!options.isLyrical;
    this.isSample = !!options.isSample;
    this.lyrics = options.lyrics || '';
    this.lyricsLines = Array.isArray(options.lyricsLines) ? options.lyricsLines : [];
  }
}

class Song {
  constructor(title, path = '', youtubeId = '', color = '#351854', motifRefs = [], songId = '', sampleRefs = [], lyricalRefs = []) {
    this.title = title;
    this.path = path;
    this.youtubeId = youtubeId;
    this.color = color;
    this.motifRefs = motifRefs;
    this.songId = songId;
    this.sampleRefs = sampleRefs;
    this.lyricalRefs = lyricalRefs;
  }
}

class Motif {
  constructor(id, name, image = null, aliases = [], color = '#ef8a85', options = {}) {
    this.id = id;
    this.name = name;
    this.image = image;
    this.categoryId = options.categoryId || id;
    this.groupId = options.groupId || '';
    this.groupName = options.groupName || '';
    this.groupType = options.groupType || '';
    this.pageHashToken = options.pageHashToken || '';
    this.aliases = aliases;
    this.color = color;
    this.hasPage = options.hasPage !== false;
    this.pageSlug = this.hasPage ? (options.pageSlug || id) : '';
    this.referenceLink = options.referenceLink || '';
    this.motifType = normalizeJamiePediaMotifType(options.motifType);
    this.isLyrical = !!options.isLyrical;
    this.variationGroup = options.variationGroup || null;
    this.variationLabel = options.variationLabel || null;
    this.iconText = options.iconText || null;
    this.iconColor = options.iconColor || color;
    this.variations = Array.isArray(options.variations) ? options.variations : [];
  }
}

function buildJamiePediaColumnLookup(headerRow) {
  const lookup = new Map();

  headerRow.forEach((cell, index) => {
    const key = normalizeJamiePediaHeader(cell);
    if (!key) {
      return;
    }

    if (!lookup.has(key)) {
      lookup.set(key, []);
    }

    lookup.get(key).push(index);
  });

  return function getColumnIndex(headerName, occurrence = 0) {
    const matches = lookup.get(normalizeJamiePediaHeader(headerName)) || [];
    return matches[occurrence] ?? -1;
  };
}

function readJamiePediaRowValue(row, index) {
  if (index < 0 || index >= row.length) {
    return '';
  }

  return row[index];
}

function splitMotifCsvTables(csvRows) {
  const motifHeaderRow = csvRows[0] || [];
  let referenceHeaderIndex = -1;

  for (let index = 1; index < csvRows.length; index += 1) {
    const normalized = (csvRows[index] || []).map((cell) => normalizeJamiePediaHeader(cell));
    if (normalized[0] === 'song id' && normalized.includes('motif id') && normalized.includes('start time') && normalized.includes('end time')) {
      referenceHeaderIndex = index;
      break;
    }
  }

  const motifDataRows = [];
  const motifRowsEnd = referenceHeaderIndex >= 0 ? referenceHeaderIndex : csvRows.length;
  for (let index = 1; index < motifRowsEnd; index += 1) {
    const row = csvRows[index] || [];
    if (row.some((cell) => normalizeJamiePediaText(cell) !== '')) {
      motifDataRows.push(row);
    }
  }

  const referenceHeaderRow = referenceHeaderIndex >= 0 ? (csvRows[referenceHeaderIndex] || []) : [];
  const referenceDataRows = [];

  if (referenceHeaderIndex >= 0) {
    for (let index = referenceHeaderIndex + 1; index < csvRows.length; index += 1) {
      const row = csvRows[index] || [];
      if (row.some((cell) => normalizeJamiePediaText(cell) !== '')) {
        referenceDataRows.push(row);
      }
    }
  }

  return {
    motifHeaderRow,
    motifDataRows,
    referenceHeaderRow,
    referenceDataRows
  };
}

function createJamiePediaData() {
  const motifsRows = parseJamiePediaCsv(loadJamiePediaCsvText('../../public/csv/JamiePedia Data - Motifs.csv', 'motifs'));
  const motifTables = splitMotifCsvTables(motifsRows);
  const getMotifColumnIndex = buildJamiePediaColumnLookup(motifTables.motifHeaderRow);
  let referenceHeaderRow = motifTables.referenceHeaderRow || [];
  let referenceDataRows = motifTables.referenceDataRows || [];

  const referencesCsvText = tryLoadJamiePediaCsvText('../../public/csv/JamiePedia Data - References.csv', 'references');
  if (String(referencesCsvText || '').trim()) {
    const parsedReferencesRows = parseJamiePediaCsv(referencesCsvText);
    const parsedReferenceHeaderRow = parsedReferencesRows[0] || [];
    const parsedReferenceDataRows = parsedReferencesRows
      .slice(1)
      .filter((row) => row.some((cell) => normalizeJamiePediaText(cell) !== ''));

    const testLookup = buildJamiePediaColumnLookup(parsedReferenceHeaderRow);
    const hasCoreReferenceColumns = testLookup('Song ID') >= 0
      && testLookup('Motif ID') >= 0
      && testLookup('Start Time') >= 0
      && testLookup('End Time') >= 0;

    if (hasCoreReferenceColumns) {
      referenceHeaderRow = parsedReferenceHeaderRow;
      referenceDataRows = parsedReferenceDataRows;
    }
  }

  const getReferenceColumnIndex = buildJamiePediaColumnLookup(referenceHeaderRow);

  const songsRows = parseJamiePediaCsv(loadJamiePediaCsvText('../../public/csv/JamiePedia Data - Songs.csv', 'songs'));
  const songsHeaderRow = songsRows[0] || [];
  const getSongColumnIndex = buildJamiePediaColumnLookup(songsHeaderRow);
  const songDataRows = songsRows.slice(1).filter((row) => row.some((cell) => normalizeJamiePediaText(cell) !== ''));

  const motifColumns = {
    groupId: getMotifColumnIndex('Group ID'),
    groupMetadataId: getMotifColumnIndex('Group ID', 1),
    motifName: getMotifColumnIndex('Motif Name'),
    motifId: getMotifColumnIndex('Motif ID', 0),
    altId: getMotifColumnIndex('Alt-ID'),
    groupName: getMotifColumnIndex('Group Name'),
    groupImage: getMotifColumnIndex('Group Image'),
    groupType: getMotifColumnIndex('Group Type?'),
    motifImage: getMotifColumnIndex('Motif Image (Page and Map)'),
    motifIsVariation: getMotifColumnIndex('is variation'),
    motifType: getMotifColumnIndex('Type?'),
    motifIsLyrical: getMotifColumnIndex('Is Lyrical'),
    motifHasPage: getMotifColumnIndex('Has Page'),
    motifReferenceLink: getMotifColumnIndex('reference link'),
    motifColor: getMotifColumnIndex('motif color')
  };

  const referenceColumns = {
    songId: getReferenceColumnIndex('Song ID'),
    motifId: getReferenceColumnIndex('Motif ID'),
    startTime: getReferenceColumnIndex('Start Time'),
    endTime: getReferenceColumnIndex('End Time'),
    definition: getReferenceColumnIndex('Definition'),
    type: getReferenceColumnIndex('Type'),
    variation: getReferenceColumnIndex('Variation'),
    variationLetter: getReferenceColumnIndex('Variation Letter'),
    melodic: getReferenceColumnIndex('Melodic'),
    lyrical: getReferenceColumnIndex('Lyrical'),
    sample: getReferenceColumnIndex('Sample'),
    lyrics: getReferenceColumnIndex('Lyrics')
  };

  const legacyReferenceColumns = {
    melodicSongId: getReferenceColumnIndex('Song ID', 0),
    melodicMotifId: getReferenceColumnIndex('Motif ID', 0),
    melodicStart: getReferenceColumnIndex('Start Time', 0),
    melodicEnd: getReferenceColumnIndex('End Time', 0),
    melodicDefinition: getReferenceColumnIndex('Definition', 0),
    melodicVariation: getReferenceColumnIndex('Variation', 0),
    melodicVariationLetter: getReferenceColumnIndex('Variation Letter', 0),

    lyricalSongId: getReferenceColumnIndex('Song ID', 1),
    lyricalMotifId: getReferenceColumnIndex('Motif/Song ID', 0),
    lyricalStart: getReferenceColumnIndex('Start Time', 1),
    lyricalEnd: getReferenceColumnIndex('End Time', 1),
    lyricalLyrics: getReferenceColumnIndex('Lyrics', 0),

    sampleSongId: getReferenceColumnIndex('Song ID', 2),
    sampleMotifId: getReferenceColumnIndex('Motif/Song ID', 1),
    sampleStart: getReferenceColumnIndex('Start Time', 2),
    sampleEnd: getReferenceColumnIndex('End Time', 2)
  };

  const songColumns = {
    title: getSongColumnIndex('Page Title'),
    pathId: getSongColumnIndex('path id'),
    songId: getSongColumnIndex('song id'),
    embedLink: getSongColumnIndex('Embed Link'),
    songColor: getSongColumnIndex('Song Color')
  };

  const motifRecords = new Map();
  const motifAliases = new Map();
  const motifGroupRecords = new Map();
  const songRecords = new Map();
  const refsBySongId = new Map();
  const sampleRefsBySongId = new Map();
  const lyricalRefsBySongId = new Map();

  songDataRows.forEach((row) => {
    const title = normalizeJamiePediaText(readJamiePediaRowValue(row, songColumns.title));
    const pathId = normalizeSongPathId(readJamiePediaRowValue(row, songColumns.pathId));
    const songId = normalizeJamiePediaText(readJamiePediaRowValue(row, songColumns.songId)) || deriveSongId(pathId, title);
    const embedLink = normalizeJamiePediaText(readJamiePediaRowValue(row, songColumns.embedLink));
    const color = normalizeJamiePediaColor(readJamiePediaRowValue(row, songColumns.songColor), '#351854');
    const path = buildSongPathFromPathId(pathId);

    if (!songId && !title && !pathId) {
      return;
    }

    const recordId = songId || deriveSongId(pathId, title);
    if (!recordId) {
      return;
    }

    if (!songRecords.has(recordId)) {
      songRecords.set(recordId, {
        id: recordId,
        title: title || recordId,
        path: path || '',
        embedLink: embedLink || '',
        color
      });
      return;
    }

    const songRecord = songRecords.get(recordId);
    if (title) songRecord.title = title;
    if (path) songRecord.path = path;
    if (embedLink) songRecord.embedLink = embedLink;
    if (color) songRecord.color = color;
  });

  motifTables.motifDataRows.forEach((row) => {
    const groupId = normalizeJamiePediaText(readJamiePediaRowValue(row, motifColumns.groupId)).toLowerCase();
    const motifId = normalizeJamiePediaText(readJamiePediaRowValue(row, motifColumns.motifId));
    const motifName = normalizeJamiePediaText(readJamiePediaRowValue(row, motifColumns.motifName));
    const altId = normalizeJamiePediaText(readJamiePediaRowValue(row, motifColumns.altId)).toLowerCase();
    const motifCategoryId = normalizeJamiePediaText(readJamiePediaRowValue(row, motifColumns.motifCategoryId)).toLowerCase() || groupId || motifId.toLowerCase();
    const groupName = normalizeJamiePediaText(readJamiePediaRowValue(row, motifColumns.groupName));
    const groupType = normalizeJamiePediaText(readJamiePediaRowValue(row, motifColumns.groupType));
    const motifImage = normalizeJamiePediaText(readJamiePediaRowValue(row, motifColumns.motifImage));
    const motifIsVariation = normalizeJamiePediaBool(readJamiePediaRowValue(row, motifColumns.motifIsVariation));
    const motifType = normalizeJamiePediaMotifType(readJamiePediaRowValue(row, motifColumns.motifType));
    const legacyIsLyrical = normalizeJamiePediaBool(readJamiePediaRowValue(row, motifColumns.motifIsLyrical));
    const motifIsLyrical = motifType === 'lyrical' || legacyIsLyrical;
    const motifHasPage = motifColumns.motifHasPage >= 0
      ? normalizeJamiePediaBool(readJamiePediaRowValue(row, motifColumns.motifHasPage))
      : true;
    const motifReferenceLink = normalizeJamiePediaText(readJamiePediaRowValue(row, motifColumns.motifReferenceLink));
    const motifColor = normalizeJamiePediaColor(readJamiePediaRowValue(row, motifColumns.motifColor), '#ef8a85');

    if (!motifId) {
      return;
    }

    const normalizedMotifId = motifId.toLowerCase();
    let record = motifRecords.get(normalizedMotifId);
    if (!record) {
      record = {
        id: normalizedMotifId,
        categoryId: motifCategoryId,
        groupId,
        groupName,
        groupType,
        name: motifName || motifId,
        image: motifImage || null,
        color: motifColor || '#ef8a85',
        motifType,
        isLyrical: motifIsLyrical,
        hasPage: motifHasPage,
        referenceLink: motifReferenceLink,
        variations: [],
        aliases: []
      };
      motifRecords.set(normalizedMotifId, record);
    } else {
      record.image = record.image || motifImage || null;
      record.hasPage = record.hasPage || motifHasPage;
      record.referenceLink = record.referenceLink || motifReferenceLink;
    }

    if (altId) {
      const variation = {
        id: altId,
        label: /(?:^|[-_])([a-z])$/i.exec(altId)?.[1]?.toUpperCase() || motifName.match(/\b([A-Z])$/)?.[1] || String(record.variations.length + 1),
        name: motifName || record.name,
        image: motifImage || record.image,
        color: motifColor || record.color
      };
      if (!record.variations.some((item) => item.id === altId)) {
        record.variations.push(variation);
      }
      record.aliases.push(altId);
      motifAliases.set(altId, { motifId: normalizedMotifId, variationId: altId });
    }

    if (groupId) {
      if (!motifGroupRecords.has(groupId)) {
        motifGroupRecords.set(groupId, { id: groupId, name: groupName || groupId, type: groupType || motifType, image: '', members: [] });
      }
      const group = motifGroupRecords.get(groupId);
      if (groupName) group.name = groupName;
      if (groupType) group.type = groupType;
      if (!group.members.includes(normalizedMotifId)) group.members.push(normalizedMotifId);
    }
  });

  const groupMetadataRows = motifTables.motifDataRows;
  groupMetadataRows.forEach((row) => {
    const groupId = normalizeJamiePediaText(readJamiePediaRowValue(row, motifColumns.groupMetadataId)).toLowerCase();
    const groupName = normalizeJamiePediaText(readJamiePediaRowValue(row, motifColumns.groupName));
    const groupType = normalizeJamiePediaText(readJamiePediaRowValue(row, motifColumns.groupType));
    const groupImage = normalizeJamiePediaText(readJamiePediaRowValue(row, motifColumns.groupImage));
    if (!groupId) return;
    if (!motifGroupRecords.has(groupId)) {
      motifGroupRecords.set(groupId, { id: groupId, name: groupName || groupId, type: groupType, image: groupImage, members: [] });
    } else {
      const group = motifGroupRecords.get(groupId);
      if (groupName) group.name = groupName;
      group.type = groupType || group.type;
      group.image = groupImage || group.image || '';
    }
  });

  motifRecords.forEach((record) => {
    if (!record.groupId) return;
    const group = motifGroupRecords.get(record.groupId);
    if (group && group.members.length > 1) record.pageHashToken = record.id;
  });

  function resolveVariationMotifId(targetId, isVariation, variationLetter) {
    const rawTarget = normalizeJamiePediaText(targetId);
    if (!rawTarget) {
      return '';
    }

    const normalizedRawTarget = rawTarget.toLowerCase();
    if (motifAliases.has(normalizedRawTarget)) {
      return motifAliases.get(normalizedRawTarget).motifId;
    }
    if (motifRecords.has(normalizedRawTarget)) return normalizedRawTarget;

    const normalizedTarget = normalizedRawTarget;
    const normalizedLetter = normalizeJamiePediaText(variationLetter).toLowerCase();
    const variationEnabled = !!isVariation;

    if (!variationEnabled || !normalizedLetter) {
      return rawTarget;
    }

    const exactMatch = normalizedTarget + '-' + normalizedLetter;
    if (motifRecords.has(exactMatch)) {
      return exactMatch;
    }

    const candidate = Array.from(motifRecords.values()).find((record) => {
      const categoryId = String(record.categoryId || '').toLowerCase();
      const motifId = String(record.id || '').toLowerCase();
      if (!categoryId || !motifId) {
        return false;
      }

      if (categoryId !== normalizedTarget) {
        return false;
      }

      return motifId.endsWith('-' + normalizedLetter);
    });

    return candidate ? candidate.id : rawTarget;
  }

  function resolveMotifVariationId(targetId, isVariation, variationLetter) {
    const raw = normalizeJamiePediaText(targetId).toLowerCase();
    const alias = motifAliases.get(raw);
    if (alias) return alias.variationId;
    if (!isVariation) return '';
    const motifId = resolveVariationMotifId(raw, isVariation, variationLetter);
    const record = motifRecords.get(String(motifId || '').toLowerCase());
    if (!record) return '';
    const letter = normalizeJamiePediaText(variationLetter).toLowerCase();
    const variation = record.variations.find((item) => item.id === raw || item.label.toLowerCase() === letter || item.id.endsWith('-' + letter));
    return variation ? variation.id : '';
  }

  function ensureSongRef(songId) {
    const normalizedSongId = String(songId || '').trim();
    if (!normalizedSongId) {
      return '';
    }

    if (!songRecords.has(normalizedSongId)) {
      songRecords.set(normalizedSongId, {
        id: normalizedSongId,
        title: normalizedSongId,
        path: '',
        embedLink: '',
        color: '#351854'
      });
    }

    return normalizedSongId;
  }

  function pushMelodicReference(songId, targetId, startTime, endTime, isDefinition, variationId = '') {
    if (!songId || !targetId || !startTime || !endTime) {
      return;
    }

    if (!refsBySongId.has(songId)) {
      refsBySongId.set(songId, []);
    }

    refsBySongId.get(songId).push(new MotifReference(
      targetId,
      startTime,
      endTime,
      false,
      !!isDefinition,
      variationId,
      { isVariation: Boolean(variationId) }
    ));
  }

  function pushLyricalReference(songId, targetId, startTime, endTime, lyricText, variationId = '') {
    if (!songId || !targetId || !startTime || !endTime) {
      return;
    }

    if (!lyricalRefsBySongId.has(songId)) {
      lyricalRefsBySongId.set(songId, []);
    }

    lyricalRefsBySongId.get(songId).push(new MotifReference(
      targetId,
      startTime,
      endTime,
      false,
      false,
      variationId,
      {
        isVariation: Boolean(variationId),
        isLyrical: true,
        lyrics: lyricText,
        lyricsLines: splitJamiePediaLyricLines(lyricText)
      }
    ));
  }

  function pushSampleReference(songId, targetId, startTime, endTime, variationId = '') {
    if (!songId || !targetId || !startTime || !endTime) {
      return;
    }

    if (!sampleRefsBySongId.has(songId)) {
      sampleRefsBySongId.set(songId, []);
    }

    sampleRefsBySongId.get(songId).push(new MotifReference(
      targetId,
      startTime,
      endTime,
      false,
      false,
      variationId,
      {
        isVariation: Boolean(variationId),
        isSample: true
      }
    ));
  }

  function normalizeReferenceType(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) {
      return '';
    }

    if (raw === 'melodic' || raw === 'melody' || raw === 'me') {
      return 'melodic';
    }
    if (raw === 'lyrical' || raw === 'lyrics' || raw === 'lyric') {
      return 'lyrical';
    }
    if (raw === 'sample' || raw === 'sampling') {
      return 'sample';
    }

    return '';
  }

  const hasUnifiedReferenceTypeColumn = referenceColumns.type >= 0;
  const hasUnifiedReferenceToggles = referenceColumns.melodic >= 0
    || referenceColumns.lyrical >= 0
    || referenceColumns.sample >= 0;

  referenceDataRows.forEach((row) => {
    if (hasUnifiedReferenceTypeColumn || hasUnifiedReferenceToggles) {
      const songId = ensureSongRef(readJamiePediaRowValue(row, referenceColumns.songId));
      const rawTargetId = normalizeJamiePediaText(readJamiePediaRowValue(row, referenceColumns.motifId));
      const startTime = normalizeJamiePediaText(readJamiePediaRowValue(row, referenceColumns.startTime));
      const endTime = normalizeJamiePediaText(readJamiePediaRowValue(row, referenceColumns.endTime));
      if (!songId || !rawTargetId || !startTime || !endTime) {
        return;
      }

      const isVariation = referenceColumns.variation >= 0
        ? normalizeJamiePediaBool(readJamiePediaRowValue(row, referenceColumns.variation))
        : false;
      const variationLetter = referenceColumns.variationLetter >= 0
        ? readJamiePediaRowValue(row, referenceColumns.variationLetter)
        : '';
      const targetId = resolveVariationMotifId(rawTargetId, isVariation, variationLetter);
      const targetVariationId = resolveMotifVariationId(rawTargetId, isVariation, variationLetter);

      const normalizedType = normalizeReferenceType(readJamiePediaRowValue(row, referenceColumns.type));
      const isMelodic = referenceColumns.melodic >= 0
        ? normalizeJamiePediaBool(readJamiePediaRowValue(row, referenceColumns.melodic))
        : (normalizedType ? normalizedType === 'melodic' : true);
      const isLyrical = referenceColumns.lyrical >= 0
        ? normalizeJamiePediaBool(readJamiePediaRowValue(row, referenceColumns.lyrical))
        : normalizedType === 'lyrical';
      const isSample = referenceColumns.sample >= 0
        ? normalizeJamiePediaBool(readJamiePediaRowValue(row, referenceColumns.sample))
        : normalizedType === 'sample';
      const isDefinition = normalizeJamiePediaBool(readJamiePediaRowValue(row, referenceColumns.definition));
      const lyricText = normalizeJamiePediaText(readJamiePediaRowValue(row, referenceColumns.lyrics));

      if (isMelodic || (!isLyrical && !isSample)) {
        pushMelodicReference(songId, targetId, startTime, endTime, isDefinition, targetVariationId);
      }
      if (isLyrical) {
        pushLyricalReference(songId, targetId, startTime, endTime, lyricText, targetVariationId);
      }
      if (isSample) {
        pushSampleReference(songId, targetId, startTime, endTime, targetVariationId);
      }
      return;
    }

    const melodicSongId = ensureSongRef(readJamiePediaRowValue(row, legacyReferenceColumns.melodicSongId));
    const melodicTargetRaw = normalizeJamiePediaText(readJamiePediaRowValue(row, legacyReferenceColumns.melodicMotifId));
    const melodicStart = normalizeJamiePediaText(readJamiePediaRowValue(row, legacyReferenceColumns.melodicStart));
    const melodicEnd = normalizeJamiePediaText(readJamiePediaRowValue(row, legacyReferenceColumns.melodicEnd));
    const melodicIsDefinition = normalizeJamiePediaBool(readJamiePediaRowValue(row, legacyReferenceColumns.melodicDefinition));
    const melodicIsVariation = normalizeJamiePediaBool(readJamiePediaRowValue(row, legacyReferenceColumns.melodicVariation));
    const melodicVariationLetter = readJamiePediaRowValue(row, legacyReferenceColumns.melodicVariationLetter);
    const melodicTarget = resolveVariationMotifId(melodicTargetRaw, melodicIsVariation, melodicVariationLetter);
    const melodicVariationId = resolveMotifVariationId(melodicTargetRaw, melodicIsVariation, melodicVariationLetter);
    pushMelodicReference(melodicSongId, melodicTarget, melodicStart, melodicEnd, melodicIsDefinition, melodicVariationId);

    const lyricalSongId = ensureSongRef(readJamiePediaRowValue(row, legacyReferenceColumns.lyricalSongId));
    const lyricalTargetRaw = normalizeJamiePediaText(readJamiePediaRowValue(row, legacyReferenceColumns.lyricalMotifId));
    const lyricalStart = normalizeJamiePediaText(readJamiePediaRowValue(row, legacyReferenceColumns.lyricalStart));
    const lyricalEnd = normalizeJamiePediaText(readJamiePediaRowValue(row, legacyReferenceColumns.lyricalEnd));
    const lyricalText = normalizeJamiePediaText(readJamiePediaRowValue(row, legacyReferenceColumns.lyricalLyrics));
    const lyricalTarget = resolveVariationMotifId(lyricalTargetRaw, false, '');
    const lyricalVariationId = resolveMotifVariationId(lyricalTargetRaw, false, '');
    pushLyricalReference(lyricalSongId, lyricalTarget, lyricalStart, lyricalEnd, lyricalText, lyricalVariationId);

    const sampleSongId = ensureSongRef(readJamiePediaRowValue(row, legacyReferenceColumns.sampleSongId));
    const sampleTargetRaw = normalizeJamiePediaText(readJamiePediaRowValue(row, legacyReferenceColumns.sampleMotifId));
    const sampleStart = normalizeJamiePediaText(readJamiePediaRowValue(row, legacyReferenceColumns.sampleStart));
    const sampleEnd = normalizeJamiePediaText(readJamiePediaRowValue(row, legacyReferenceColumns.sampleEnd));
    const sampleTarget = resolveVariationMotifId(sampleTargetRaw, false, '');
    const sampleVariationId = resolveMotifVariationId(sampleTargetRaw, false, '');
    pushSampleReference(sampleSongId, sampleTarget, sampleStart, sampleEnd, sampleVariationId);
  });

  const allMotifs = Array.from(motifRecords.values()).map((record) => {
    const aliases = Array.from(new Set(record.aliases.filter((alias) => alias !== record.id)));
    const pageSlug = record.groupId || record.id;
    const group = record.groupId ? motifGroupRecords.get(record.groupId) : null;
    const variationPalette = buildVariationColors(record.color || '#ef8a85', record.variations.length);
    const variations = record.variations.map((variation, index) => ({
      ...variation,
      color: variation.color || variationPalette[index] || record.color || '#ef8a85'
    }));

    return new Motif(record.id, record.name, record.image, aliases, record.color, {
      categoryId: record.categoryId || record.id,
      groupId: record.groupId,
      groupName: record.groupName || (group && group.name) || '',
      groupType: record.groupType || (group && group.type) || '',
      pageHashToken: record.pageHashToken || '',
      hasPage: record.hasPage,
      referenceLink: record.referenceLink,
      motifType: record.motifType,
      isLyrical: record.isLyrical,
      pageSlug,
      variationGroup: record.id,
      variations
    });
  });

  const motifById = new Map(allMotifs.map((motif) => [motif.id, motif]));
  const allMotifGroups = [];
  const assignedMotifs = new Set();
  motifGroupRecords.forEach((group) => {
    const members = group.members.map((id) => motifById.get(id)).filter(Boolean);
    if (!members.length) return;
    members.forEach((motif) => {
      motif.groupId = group.id;
      motif.groupName = group.name;
      motif.groupType = group.type;
      motif.pageSlug = group.id;
      motif.pageHashToken = members.length > 1 ? motif.id : '';
      assignedMotifs.add(motif.id);
    });
    allMotifGroups.push({
      id: group.id,
      name: group.name || members[0].name,
      type: normalizeJamiePediaMotifType(group.type || members[0].motifType),
      image: group.image || '',
      pageSlug: group.id,
      hasPage: members.some((motif) => motif.hasPage),
      members
    });
  });

  allMotifs.forEach((motif) => {
    if (assignedMotifs.has(motif.id)) return;
    allMotifGroups.push({
      id: motif.id,
      name: motif.name,
      type: motif.motifType,
      pageSlug: motif.pageSlug,
      hasPage: motif.hasPage,
      members: [motif]
    });
  });

  const allSongs = [];
  songRecords.forEach((record) => {
    allSongs.push(new Song(
      record.title,
      record.path,
      record.embedLink,
      record.color,
      refsBySongId.get(record.id) || [],
      record.id,
      sampleRefsBySongId.get(record.id) || [],
      lyricalRefsBySongId.get(record.id) || []
    ));
  });

  return {
    allMotifs,
    allMotifGroups,
    allSongs,
    Motif,
    Song,
    MotifReference,
    getMotifById(id) {
      const target = String(id || '').trim().toLowerCase();
      return allMotifs.find((motif) => motif.id === target || motif.aliases.includes(target));
    },
    getMotifByPage(pageSlug, hashToken = '') {
      const slug = String(pageSlug || '').trim().toLowerCase();
      const hash = String(hashToken || '').trim().replace(/^#/, '').toLowerCase();
      const members = allMotifs.filter((motif) => motif.pageSlug === slug && motif.hasPage !== false);
      return members.find((motif) => motif.pageHashToken && (motif.pageHashToken.toLowerCase() === hash || motif.id === hash || motif.aliases.includes(hash)))
        || members[0]
        || this.getMotifById(slug);
    },
    getSongsWithMotifId(motifId) {
      const target = String(motifId || '').trim();
      if (!target) {
        return [];
      }

      const motif = allMotifs.find((item) => item.id === target || item.aliases.includes(target));
      const acceptedIds = new Set([target]);
      if (motif) {
        acceptedIds.add(motif.id);
        (motif.aliases || []).forEach((alias) => acceptedIds.add(alias));
      }

      return allSongs.filter((song) =>
        song.motifRefs.some((ref) => acceptedIds.has(ref.motifId))
        || song.sampleRefs.some((ref) => acceptedIds.has(ref.motifId))
        || song.lyricalRefs.some((ref) => acceptedIds.has(ref.motifId))
      );
    }
  };
}

if (!window.__JamiePediaCsvData) {
  window.__JamiePediaCsvData = createJamiePediaData();
}

window.MotifData = {
  Motifs: Object.fromEntries(window.__JamiePediaCsvData.allMotifs.map((motif) => [motif.id.toUpperCase().replace(/-/g, '_'), motif])),
  allMotifs: window.__JamiePediaCsvData.allMotifs,
  allMotifGroups: window.__JamiePediaCsvData.allMotifGroups,
  Motif,
  getMotifById: window.__JamiePediaCsvData.getMotifById,
  getMotifByPage: window.__JamiePediaCsvData.getMotifByPage
};

window.SongData = {
  allSongs: window.__JamiePediaCsvData.allSongs,
  Song,
  Songs: Object.fromEntries(window.__JamiePediaCsvData.allSongs.map((song) => [song.songId || song.title.toUpperCase().replace(/\s+/g, '_'), song])),
  MotifReference,
  getSongsWithMotifId: window.__JamiePediaCsvData.getSongsWithMotifId
};
