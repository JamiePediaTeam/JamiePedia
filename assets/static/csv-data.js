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

function normalizeJamiePediaBool(value) {
  const text = normalizeJamiePediaText(value).toUpperCase();
  return text === 'TRUE' || text === '1' || text === 'YES';
}

function normalizeJamiePediaMotifType(value) {
  const text = normalizeJamiePediaText(value).toLowerCase();
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

function loadJamiePediaCsvText() {
  const csvPath = encodeURI('../../public/motifs/JamiePedia Motifs spreadsheet - Sheet1.csv');
  const csvUrl = new URL(csvPath, currentScriptBaseUrl());
  const request = new XMLHttpRequest();
  request.open('GET', csvUrl.href, false);
  request.send(null);

  if (request.status >= 200 && request.status < 300) {
    return request.responseText || '';
  }

  throw new Error('Unable to load JamiePedia motifs CSV');
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

function createJamiePediaData() {
  const csvRows = parseJamiePediaCsv(loadJamiePediaCsvText());
  const headerRow = csvRows[0] || [];
  const getColumnIndex = buildJamiePediaColumnLookup(headerRow);
  const dataRows = csvRows.slice(1).filter((row) => row.some((cell) => normalizeJamiePediaText(cell) !== ''));

  const columns = {
    motifName: getColumnIndex('Motif Name'),
    motifId: getColumnIndex('Motif ID', 0),
    motifImage: getColumnIndex('Motif Image (Page and Map)'),
    motifIsVariation: getColumnIndex('is variation'),
    motifType: getColumnIndex('Type?'),
    motifIsLyrical: getColumnIndex('Is Lyrical'),
    motifHasPage: getColumnIndex('Has Page'),
    motifReferenceLink: getColumnIndex('reference link'),
    motifColor: getColumnIndex('motif color'),
    motifVariationLetter: getColumnIndex('variation letter', 0),
    songName: getColumnIndex('Song Name'),
    songId: getColumnIndex('Song ID', 0),
    songFile: getColumnIndex('Song File'),
    songEmbedType: getColumnIndex('Embed Type'),
    songEmbedLink: getColumnIndex('Embed Link'),
    songColor: getColumnIndex('Song Color'),
    refSongId: getColumnIndex('Song ID', 1),
    refMotifId: getColumnIndex('Motif ID', 1),
    refStartTime: getColumnIndex('Start Time', 0),
    refEndTime: getColumnIndex('End Time', 0),
    refDefinition: getColumnIndex('Definition'),
    refVariation: getColumnIndex('Variation'),
    refVariationLetter: getColumnIndex('Variation Letter', 1),
    lyricalSongId: getColumnIndex('Song ID', 2),
    lyricalMotifId: getColumnIndex('Motif Id', 2),
    lyricalStartTime: getColumnIndex('Start Time', 1),
    lyricalEndTime: getColumnIndex('End Time', 1),
    lyricalLyrics: getColumnIndex('Lyrics'),
    sampleSongId: getColumnIndex('Song ID', 3),
    sampleMotifId: getColumnIndex('Motif Id', 3),
    sampleStartTime: getColumnIndex('Start Time', 2),
    sampleEndTime: getColumnIndex('End Time', 2)
  };

  const motifRecords = new Map();
  const songRecords = new Map();
  const refsBySongId = new Map();
  const sampleRefsBySongId = new Map();
  const lyricalRefsBySongId = new Map();

  dataRows.forEach((row) => {
    const motifId = normalizeJamiePediaText(readJamiePediaRowValue(row, columns.motifId));
    const motifName = normalizeJamiePediaText(readJamiePediaRowValue(row, columns.motifName));
    const motifImage = normalizeJamiePediaText(readJamiePediaRowValue(row, columns.motifImage));
    const motifIsVariation = normalizeJamiePediaBool(readJamiePediaRowValue(row, columns.motifIsVariation));
    const motifType = normalizeJamiePediaMotifType(readJamiePediaRowValue(row, columns.motifType));
    const legacyIsLyrical = normalizeJamiePediaBool(readJamiePediaRowValue(row, columns.motifIsLyrical));
    const motifIsLyrical = motifType === 'lyrical' || legacyIsLyrical;
    const motifHasPage = columns.motifHasPage >= 0
      ? normalizeJamiePediaBool(readJamiePediaRowValue(row, columns.motifHasPage))
      : true;
    const motifReferenceLink = normalizeJamiePediaText(readJamiePediaRowValue(row, columns.motifReferenceLink));
    const motifColor = normalizeJamiePediaColor(readJamiePediaRowValue(row, columns.motifColor), '#ef8a85');
    const motifVariationLetter = normalizeJamiePediaText(readJamiePediaRowValue(row, columns.motifVariationLetter));

    if (motifId) {
      if (!motifRecords.has(motifId)) {
        motifRecords.set(motifId, {
          id: motifId,
          name: motifName || motifId,
          image: motifImage || null,
          color: motifColor || null,
          isVariation: motifIsVariation,
          motifType,
          isLyrical: motifIsLyrical,
          hasPage: motifHasPage,
          referenceLink: motifReferenceLink,
          variationLetters: new Set(),
          variationColors: new Map(),
          rowCount: 0
        });
      }

      const motifRecord = motifRecords.get(motifId);
      motifRecord.rowCount += 1;
      if (motifName) motifRecord.name = motifName;
      if (motifImage) motifRecord.image = motifImage;
      if (motifColor && !motifRecord.color) motifRecord.color = motifColor;
      if (motifIsVariation) motifRecord.isVariation = true;
      if (motifType) motifRecord.motifType = motifType;
      motifRecord.isLyrical = motifRecord.motifType === 'lyrical' || motifRecord.isLyrical || motifIsLyrical;
      if (columns.motifHasPage >= 0) motifRecord.hasPage = motifHasPage;
      if (motifReferenceLink) motifRecord.referenceLink = motifReferenceLink;
      if (motifVariationLetter) {
        motifRecord.variationLetters.add(motifVariationLetter);
        if (motifColor) motifRecord.variationColors.set(motifVariationLetter, motifColor);
      }
    }

    const songName = normalizeJamiePediaText(readJamiePediaRowValue(row, columns.songName));
    const songId = normalizeJamiePediaText(readJamiePediaRowValue(row, columns.songId));
    const songFile = normalizeJamiePediaText(readJamiePediaRowValue(row, columns.songFile));
    const songEmbedType = normalizeJamiePediaText(readJamiePediaRowValue(row, columns.songEmbedType));
    const songEmbedLink = normalizeJamiePediaText(readJamiePediaRowValue(row, columns.songEmbedLink));
    const songColor = normalizeJamiePediaColor(readJamiePediaRowValue(row, columns.songColor), '#351854');

    if (songId) {
      if (!songRecords.has(songId)) {
        songRecords.set(songId, {
          id: songId,
          title: songName || songId,
          path: songFile || '',
          embedType: songEmbedType || '',
          embedLink: songEmbedLink || '',
          color: songColor,
          motifRefs: []
        });
      }

      const songRecord = songRecords.get(songId);
      if (songName) songRecord.title = songName;
      if (songFile) songRecord.path = songFile;
      if (songEmbedType) songRecord.embedType = songEmbedType;
      if (songEmbedLink) songRecord.embedLink = songEmbedLink;
      if (songColor) songRecord.color = songColor;
    }

    const refSongId = normalizeJamiePediaText(readJamiePediaRowValue(row, columns.refSongId));
    const refMotifId = normalizeJamiePediaText(readJamiePediaRowValue(row, columns.refMotifId));
    const startTime = normalizeJamiePediaText(readJamiePediaRowValue(row, columns.refStartTime));
    const endTime = normalizeJamiePediaText(readJamiePediaRowValue(row, columns.refEndTime));
    const isDefinition = normalizeJamiePediaBool(readJamiePediaRowValue(row, columns.refDefinition));
    const isVariation = normalizeJamiePediaBool(readJamiePediaRowValue(row, columns.refVariation));
    const variationId = normalizeJamiePediaText(readJamiePediaRowValue(row, columns.refVariationLetter));

    if (refSongId && refMotifId && startTime && endTime) {
      if (!refsBySongId.has(refSongId)) {
        refsBySongId.set(refSongId, []);
      }

      refsBySongId.get(refSongId).push(new MotifReference(
        refMotifId,
        startTime,
        endTime,
        isVariation,
        isDefinition,
        variationId
      ));
    }

    const lyricalSongId = normalizeJamiePediaText(readJamiePediaRowValue(row, columns.lyricalSongId));
    const lyricalMotifId = normalizeJamiePediaText(readJamiePediaRowValue(row, columns.lyricalMotifId));
    const lyricalStartTime = normalizeJamiePediaText(readJamiePediaRowValue(row, columns.lyricalStartTime));
    const lyricalEndTime = normalizeJamiePediaText(readJamiePediaRowValue(row, columns.lyricalEndTime));
    const lyricalLyrics = normalizeJamiePediaText(readJamiePediaRowValue(row, columns.lyricalLyrics));

    if (lyricalSongId && lyricalMotifId && lyricalStartTime && lyricalEndTime) {
      if (!lyricalRefsBySongId.has(lyricalSongId)) {
        lyricalRefsBySongId.set(lyricalSongId, []);
      }

      lyricalRefsBySongId.get(lyricalSongId).push(new MotifReference(
        lyricalMotifId,
        lyricalStartTime,
        lyricalEndTime,
        false,
        false,
        '',
        {
          isLyrical: true,
          lyrics: lyricalLyrics
        }
      ));
    }

    const sampleSongId = normalizeJamiePediaText(readJamiePediaRowValue(row, columns.sampleSongId));
    const sampleMotifId = normalizeJamiePediaText(readJamiePediaRowValue(row, columns.sampleMotifId));
    const sampleStartTime = normalizeJamiePediaText(readJamiePediaRowValue(row, columns.sampleStartTime));
    const sampleEndTime = normalizeJamiePediaText(readJamiePediaRowValue(row, columns.sampleEndTime));

    if (sampleSongId && sampleMotifId && sampleStartTime && sampleEndTime) {
      if (!sampleRefsBySongId.has(sampleSongId)) {
        sampleRefsBySongId.set(sampleSongId, []);
      }

      sampleRefsBySongId.get(sampleSongId).push(new MotifReference(
        sampleMotifId,
        sampleStartTime,
        sampleEndTime,
        false,
        false,
        '',
        {
          isSample: true
        }
      ));
    }
  });

  const allMotifs = [];
  const motifAliasMap = new Map([
    ['kalia-vibte', ['bittersweet-kalia-vibte']],
    ['space-center', ['space-center-a', 'space-center-b']]
  ]);

  motifRecords.forEach((record) => {
    const variationLetters = Array.from(record.variationLetters);
    const shouldBuildVariations = variationLetters.length > 0;
    const variationColors = buildVariationColors(record.color, variationLetters.length);
    const variations = shouldBuildVariations
      ? variationLetters.map((letter, index) => ({
          id: letter,
          label: letter,
          color: record.variationColors.get(letter) || variationColors[index] || record.color
        }))
      : [];

    const motif = new Motif(
      record.id,
      record.name,
      record.image,
      motifAliasMap.get(record.id) || [],
      record.color,
      shouldBuildVariations
        ? {
            hasPage: record.hasPage,
          referenceLink: record.referenceLink,
            motifType: record.motifType,
            isLyrical: record.isLyrical,
            pageSlug: record.id === 'kalia-vibte' ? 'bittersweet-kalia-vibte' : record.id,
            variationGroup: record.id,
            iconText: record.name,
            iconColor: record.color,
            variations
          }
        : {
            hasPage: record.hasPage,
            referenceLink: record.referenceLink,
            motifType: record.motifType,
            isLyrical: record.isLyrical,
            pageSlug: record.id === 'kalia-vibte' ? 'bittersweet-kalia-vibte' : record.id
          }
    );

    allMotifs.push(motif);
  });

  const allSongs = [];
  songRecords.forEach((record) => {
    const song = new Song(
      record.title,
      record.path,
      record.embedLink,
      record.color,
      refsBySongId.get(record.id) || [],
      record.id,
      sampleRefsBySongId.get(record.id) || [],
      lyricalRefsBySongId.get(record.id) || []
    );
    allSongs.push(song);
  });

  return {
    allMotifs,
    allSongs,
    Motif,
    Song,
    MotifReference,
    getMotifById(id) {
      return allMotifs.find((motif) => motif.id === id || motif.aliases.includes(id));
    },
    getSongsWithMotifId(motifId) {
      return allSongs.filter((song) =>
        song.motifRefs.some((ref) => ref.motifId === motifId)
        || song.sampleRefs.some((ref) => ref.motifId === motifId)
        || song.lyricalRefs.some((ref) => ref.motifId === motifId)
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
  Motif,
  getMotifById: window.__JamiePediaCsvData.getMotifById
};

window.SongData = {
  allSongs: window.__JamiePediaCsvData.allSongs,
  Song,
  Songs: Object.fromEntries(window.__JamiePediaCsvData.allSongs.map((song) => [song.songId || song.title.toUpperCase().replace(/\s+/g, '_'), song])),
  MotifReference,
  getSongsWithMotifId: window.__JamiePediaCsvData.getSongsWithMotifId
};
