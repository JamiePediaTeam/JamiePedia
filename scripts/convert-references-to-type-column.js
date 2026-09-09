const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'public/csv/JamiePedia Data - References.csv');
const motifsPath = path.join(process.cwd(), 'public/csv/JamiePedia Data - Motifs.csv');
const text = fs.readFileSync(filePath, 'utf8');

function parseCsv(input) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let index = 0; index < input.length; index += 1) {
    const ch = input[index];
    const next = input[index + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        index += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    if (ch === ',') {
      row.push(cell);
      cell = '';
      continue;
    }

    if (ch === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      continue;
    }

    if (ch === '\r') {
      continue;
    }

    cell += ch;
  }

  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

function encodeCell(value) {
  const str = String(value == null ? '' : value);
  if (/[",\n\r]/.test(str)) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function toCsv(rows) {
  return rows.map((row) => row.map((cell) => encodeCell(cell)).join(',')).join('\n') + '\n';
}

function normalizeHeaderCell(value) {
  return String(value || '').trim().toLowerCase();
}

function buildLookup(headerCells) {
  const lookup = new Map();
  headerCells.forEach((cell, index) => {
    const key = normalizeHeaderCell(cell);
    if (!lookup.has(key)) {
      lookup.set(key, []);
    }
    lookup.get(key).push(index);
  });

  return function getColumn(name, occurrence = 0) {
    const values = lookup.get(normalizeHeaderCell(name)) || [];
    return values[occurrence] ?? -1;
  };
}

function loadMotifCategoryLetterMap() {
  if (!fs.existsSync(motifsPath)) {
    return new Map();
  }

  const motifsRows = parseCsv(fs.readFileSync(motifsPath, 'utf8'));
  if (!motifsRows.length) {
    return new Map();
  }

  const motifHeader = motifsRows[0] || [];
  const getMotifColumn = buildLookup(motifHeader);
  const motifIdColumn = getMotifColumn('Motif ID');
  const categoryIdColumn = getMotifColumn('Category ID');
  if (motifIdColumn < 0 || categoryIdColumn < 0) {
    return new Map();
  }

  const map = new Map();
  motifsRows.slice(1).forEach((row) => {
    const motifId = String(row[motifIdColumn] || '').trim().toLowerCase();
    const categoryId = String(row[categoryIdColumn] || '').trim().toLowerCase();
    if (!motifId || !categoryId) {
      return;
    }
    if (!motifId.startsWith(categoryId + '-')) {
      return;
    }
    const suffix = motifId.slice(categoryId.length + 1).trim();
    if (!suffix) {
      return;
    }
    map.set(categoryId + '|' + suffix.toLowerCase(), motifId);
  });

  return map;
}

function resolveVariationMotifId(motifId, variationEnabled, variationLetter, categoryLetterMap) {
  const base = String(motifId || '').trim();
  if (!base) {
    return '';
  }

  if (!variationEnabled) {
    return base;
  }

  const letter = String(variationLetter || '').trim().toLowerCase();
  if (!letter) {
    return base;
  }

  const key = String(base).trim().toLowerCase() + '|' + letter;
  return categoryLetterMap.get(key) || (String(base).trim() + '-' + letter);
}

const rows = parseCsv(text);
if (!rows.length) {
  console.log('No rows found.');
  process.exit(0);
}

const header = rows[0] || [];
const getColumn = buildLookup(header);
const categoryLetterMap = loadMotifCategoryLetterMap();

function isTruthy(value) {
  return /^\s*(true|yes|1)\s*$/i.test(String(value || ''));
}

function normalizeType(value) {
  const raw = String(value || '').trim().toLowerCase();
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

function isTruthy(value) {
  return /^\s*(true|yes|1)\s*$/i.test(String(value || ''));
}

function readValue(row, columnIndex) {
  if (columnIndex < 0 || columnIndex >= row.length) {
    return '';
  }
  return String(row[columnIndex] || '').trim();
}

const outRows = [[
  'Song ID',
  'Motif ID',
  'Start Time',
  'End Time',
  'Definition',
  'Type',
  'Lyrics'
]];

function pushRow(songId, motifId, startTime, endTime, definition, type, lyrics) {
  if (!songId || !motifId || !startTime || !endTime) {
    return;
  }
  outRows.push([
    songId,
    motifId,
    startTime,
    endTime,
    definition,
    type,
    lyrics
  ]);
}

const hasLegacyCombinedShape = getColumn('Song ID', 1) >= 0 && getColumn('Motif/Song ID', 0) >= 0;

if (hasLegacyCombinedShape) {
  const rhythmicColumns = {
    songId: getColumn('Song ID', 0),
    motifId: getColumn('Motif ID', 0),
    startTime: getColumn('Start Time', 0),
    endTime: getColumn('End Time', 0),
    definition: getColumn('Definition', 0),
    variation: getColumn('Variation', 0),
    variationLetter: getColumn('Variation Letter', 0)
  };

  const lyricalColumns = {
    songId: getColumn('Song ID', 1),
    motifId: getColumn('Motif/Song ID', 0),
    startTime: getColumn('Start Time', 1),
    endTime: getColumn('End Time', 1),
    lyrics: getColumn('Lyrics', 0)
  };

  const sampleColumns = {
    songId: getColumn('Song ID', 2),
    motifId: getColumn('Motif/Song ID', 1),
    startTime: getColumn('Start Time', 2),
    endTime: getColumn('End Time', 2)
  };

  rows.slice(1).forEach((row) => {
    const rhythmicSongId = readValue(row, rhythmicColumns.songId);
    const rhythmicMotifId = readValue(row, rhythmicColumns.motifId);
    const rhythmicStartTime = readValue(row, rhythmicColumns.startTime);
    const rhythmicEndTime = readValue(row, rhythmicColumns.endTime);
    const rhythmicDefinition = readValue(row, rhythmicColumns.definition);
    const rhythmicVariation = isTruthy(readValue(row, rhythmicColumns.variation));
    const rhythmicVariationLetter = readValue(row, rhythmicColumns.variationLetter);
    const resolvedRhythmicMotifId = resolveVariationMotifId(
      rhythmicMotifId,
      rhythmicVariation,
      rhythmicVariationLetter,
      categoryLetterMap
    );

    pushRow(
      rhythmicSongId,
      resolvedRhythmicMotifId,
      rhythmicStartTime,
      rhythmicEndTime,
      rhythmicDefinition,
      'rhythmic',
      ''
    );

    const lyricalSongId = readValue(row, lyricalColumns.songId);
    const lyricalMotifId = readValue(row, lyricalColumns.motifId);
    const lyricalStartTime = readValue(row, lyricalColumns.startTime);
    const lyricalEndTime = readValue(row, lyricalColumns.endTime);
    const lyricalText = readValue(row, lyricalColumns.lyrics);

    pushRow(
      lyricalSongId,
      lyricalMotifId,
      lyricalStartTime,
      lyricalEndTime,
      '',
      'lyrical',
      lyricalText
    );

    const sampleSongId = readValue(row, sampleColumns.songId);
    const sampleMotifId = readValue(row, sampleColumns.motifId);
    const sampleStartTime = readValue(row, sampleColumns.startTime);
    const sampleEndTime = readValue(row, sampleColumns.endTime);

    pushRow(
      sampleSongId,
      sampleMotifId,
      sampleStartTime,
      sampleEndTime,
      '',
      'sample',
      ''
    );
  });
} else {
  const columns = {
    songId: getColumn('Song ID', 0),
    motifId: getColumn('Motif ID', 0),
    startTime: getColumn('Start Time', 0),
    endTime: getColumn('End Time', 0),
    definition: getColumn('Definition', 0),
    type: getColumn('Type', 0),
    rhythmic: getColumn('Rhythmic', 0),
    lyrical: getColumn('Lyrical', 0),
    sample: getColumn('Sample', 0),
    lyrics: getColumn('Lyrics', 0)
  };
  const hasLegacyBooleanLayout =
    columns.rhythmic < 0 &&
    columns.lyrical < 0 &&
    columns.sample < 0 &&
    rows.some((row) => row.length >= 9);

  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    const songId = hasLegacyBooleanLayout ? readValue(row, 0) : readValue(row, columns.songId);
    const motifId = hasLegacyBooleanLayout ? readValue(row, 1) : readValue(row, columns.motifId);
    const startTime = hasLegacyBooleanLayout ? readValue(row, 2) : readValue(row, columns.startTime);
    const endTime = hasLegacyBooleanLayout ? readValue(row, 3) : readValue(row, columns.endTime);

    if (!songId || !motifId || !startTime || !endTime) {
      continue;
    }

    const definition = hasLegacyBooleanLayout ? readValue(row, 4) : readValue(row, columns.definition);
    const lyrics = hasLegacyBooleanLayout ? readValue(row, 8) : readValue(row, columns.lyrics);

    const explicitType = hasLegacyBooleanLayout
      ? normalizeType(readValue(row, 5))
      : (columns.type >= 0 ? normalizeType(readValue(row, columns.type)) : '');
    const rhythmic = hasLegacyBooleanLayout
      ? isTruthy(readValue(row, 5))
      : (columns.rhythmic >= 0 ? isTruthy(readValue(row, columns.rhythmic)) : false);
    const lyrical = hasLegacyBooleanLayout
      ? isTruthy(readValue(row, 6))
      : (columns.lyrical >= 0 ? isTruthy(readValue(row, columns.lyrical)) : false);
    const sample = hasLegacyBooleanLayout
      ? isTruthy(readValue(row, 7))
      : (columns.sample >= 0 ? isTruthy(readValue(row, columns.sample)) : false);

    let type = explicitType;
    if (!type) {
      if (lyrical) {
        type = 'lyrical';
      } else if (sample) {
        type = 'sample';
      } else {
        type = 'rhythmic';
      }
    }

    pushRow(songId, motifId, startTime, endTime, definition, type, lyrics);
  }
}

fs.writeFileSync(filePath, toCsv(outRows), 'utf8');
console.log('Converted rows:', outRows.length - 1);
