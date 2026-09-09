const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'public/csv/JamiePedia Data - References.csv');

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

const rows = parseCsv(fs.readFileSync(filePath, 'utf8'));
if (!rows.length) {
  throw new Error('No rows found in references CSV');
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

for (const row of rows.slice(1)) {
  if (!row.length) {
    continue;
  }

  if (row.length >= 9) {
    const songId = String(row[0] || '').trim();
    const motifId = String(row[1] || '').trim();
    const startTime = String(row[2] || '').trim();
    const endTime = String(row[3] || '').trim();
    const definition = String(row[4] || '').trim();
    const explicitType = normalizeType(row[5]);
    const rhythmic = isTruthy(row[5]);
    const lyrical = isTruthy(row[6]);
    const sample = isTruthy(row[7]);
    const lyrics = String(row[8] || '').trim();

    if (!songId || !motifId || !startTime || !endTime) {
      continue;
    }

    let type = explicitType;
    if (!type) {
      if (lyrical) {
        type = 'lyrical';
      } else if (sample) {
        type = 'sample';
      } else if (rhythmic) {
        type = 'rhythmic';
      } else {
        type = 'rhythmic';
      }
    }

    outRows.push([songId, motifId, startTime, endTime, definition, type, lyrics]);
    continue;
  }

  const songId = String(row[0] || '').trim();
  const motifId = String(row[1] || '').trim();
  const startTime = String(row[2] || '').trim();
  const endTime = String(row[3] || '').trim();
  const definition = String(row[4] || '').trim();
  const type = normalizeType(row[5]) || 'rhythmic';
  const lyrics = String(row[6] || '').trim();

  if (!songId || !motifId || !startTime || !endTime) {
    continue;
  }

  outRows.push([songId, motifId, startTime, endTime, definition, type, lyrics]);
}

fs.writeFileSync(filePath, toCsv(outRows), 'utf8');
console.log('Rewrote rows:', outRows.length - 1);
