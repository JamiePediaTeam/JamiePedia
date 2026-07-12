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

function normalizeJamiePediaText(value) {
  return String(value || '').trim();
}

function normalizeJamiePediaBool(value) {
  const text = normalizeJamiePediaText(value).toUpperCase();
  return text === 'TRUE' || text === '1' || text === 'YES';
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
  constructor(motifId, startTime = '', endTime = '', isVariation = false, isDefinition = false, variationId = '') {
    this.motifId = motifId;
    this.startTime = startTime;
    this.endTime = endTime;
    this.isVariation = isVariation;
    this.isDefinition = isDefinition;
    this.variationId = variationId;
  }
}

class Song {
  constructor(title, path = '', youtubeId = '', color = '#351854', motifRefs = [], songId = '') {
    this.title = title;
    this.path = path;
    this.youtubeId = youtubeId;
    this.color = color;
    this.motifRefs = motifRefs;
    this.songId = songId;
  }
}

class Motif {
  constructor(id, name, image = null, aliases = [], color = '#ef8a85', options = {}) {
    this.id = id;
    this.name = name;
    this.image = image;
    this.aliases = aliases;
    this.color = color;
    this.pageSlug = options.pageSlug || id;
    this.variationGroup = options.variationGroup || null;
    this.variationLabel = options.variationLabel || null;
    this.iconText = options.iconText || null;
    this.iconColor = options.iconColor || color;
    this.variations = Array.isArray(options.variations) ? options.variations : [];
  }
}

function createJamiePediaData() {
  const csvRows = parseJamiePediaCsv(loadJamiePediaCsvText());
  const dataRows = csvRows.slice(1).filter((row) => row.some((cell) => normalizeJamiePediaText(cell) !== ''));

  const motifRecords = new Map();
  const songRecords = new Map();
  const refsBySongId = new Map();

  dataRows.forEach((row) => {
    const motifId = normalizeJamiePediaText(row[1]);
    const motifName = normalizeJamiePediaText(row[0]);
    const motifImage = normalizeJamiePediaText(row[2]);
    const motifIsVariation = normalizeJamiePediaBool(row[3]);
    const motifColor = normalizeJamiePediaColor(row[4], '#ef8a85');
    const motifVariationLetter = normalizeJamiePediaText(row[5]);

    if (motifId) {
      if (!motifRecords.has(motifId)) {
        motifRecords.set(motifId, {
          id: motifId,
          name: motifName || motifId,
          image: motifImage || null,
          color: motifColor || null,
          isVariation: motifIsVariation,
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
      if (motifVariationLetter) {
        motifRecord.variationLetters.add(motifVariationLetter);
        if (motifColor) motifRecord.variationColors.set(motifVariationLetter, motifColor);
      }
    }

    const songName = normalizeJamiePediaText(row[7]);
    const songId = normalizeJamiePediaText(row[8]);
    const songFile = normalizeJamiePediaText(row[9]);
    const songEmbedType = normalizeJamiePediaText(row[10]);
    const songEmbedLink = normalizeJamiePediaText(row[11]);
    const songColor = normalizeJamiePediaColor(row[12], '#351854');

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

    const refSongId = normalizeJamiePediaText(row[14]);
    const refMotifId = normalizeJamiePediaText(row[15]);
    const startTime = normalizeJamiePediaText(row[16]);
    const endTime = normalizeJamiePediaText(row[17]);
    const isDefinition = normalizeJamiePediaBool(row[18]);
    const variationId = normalizeJamiePediaText(row[20]);

    if (refSongId && refMotifId && startTime && endTime) {
      if (!refsBySongId.has(refSongId)) {
        refsBySongId.set(refSongId, []);
      }

      refsBySongId.get(refSongId).push(new MotifReference(
        refMotifId,
        startTime,
        endTime,
        false,
        isDefinition,
        variationId
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
            pageSlug: record.id === 'kalia-vibte' ? 'bittersweet-kalia-vibte' : record.id,
            variationGroup: record.id,
            iconText: record.name,
            iconColor: record.color,
            variations
          }
        : {
            pageSlug: record.id === 'kalia-vibte' ? 'bittersweet-kalia-vibte' : record.id
          }
    );

    allMotifs.push(motif);
  });

  const allSongs = [];
  songRecords.forEach((record) => {
    const song = new Song(record.title, record.path, record.embedLink, record.color, refsBySongId.get(record.id) || [], record.id);
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
