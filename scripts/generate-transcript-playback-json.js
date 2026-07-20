const fs = require('fs');
const path = require('path');
const { DOMParser } = require('@xmldom/xmldom');
const { parseScore } = require('musicxml-interfaces');

const ROOT = path.resolve(__dirname, '..');
const MOTIFS_DIR = path.join(ROOT, 'public', 'motifs');
const TONE_SRC = path.join(ROOT, 'node_modules', 'tone', 'build', 'Tone.js');
const TONE_DST = path.join(ROOT, 'assets', 'static', 'vendor', 'Tone.js');

function ensureXmldomChildrenCompat() {
  const sampleDoc = new DOMParser().parseFromString('<root><child/></root>', 'text/xml');
  const elementProto = Object.getPrototypeOf(sampleDoc.documentElement);

  if (!Object.getOwnPropertyDescriptor(elementProto, 'children')) {
    Object.defineProperty(elementProto, 'children', {
      get() {
        const result = [];
        const childNodes = this.childNodes || [];
        for (let i = 0; i < childNodes.length; i += 1) {
          const child = childNodes[i];
          if (child && child.nodeType === 1) {
            result.push(child);
          }
        }
        return result;
      }
    });
  }
}

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function extractTempoFromDirection(direction) {
  if (!direction) {
    return null;
  }

  if (direction.sound && direction.sound.tempo != null) {
    const parsed = toNumber(direction.sound.tempo, NaN);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  if (Array.isArray(direction.directionTypes)) {
    for (const type of direction.directionTypes) {
      if (!type || !type.metronome) {
        continue;
      }
      const perMinute = type.metronome.perMinute;
      const raw = perMinute && typeof perMinute === 'object' ? perMinute.data : perMinute;
      const parsed = toNumber(raw, NaN);
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
    }
  }

  return null;
}

function pitchToMidi(pitch) {
  if (!pitch || !pitch.step || pitch.octave == null) {
    return null;
  }

  const steps = {
    c: 0,
    d: 2,
    e: 4,
    f: 5,
    g: 7,
    a: 9,
    b: 11
  };

  const step = String(pitch.step).toLowerCase();
  if (!(step in steps)) {
    return null;
  }

  const alter = toNumber(pitch.alter, 0);
  const octave = toNumber(pitch.octave, NaN);
  if (!Number.isFinite(octave)) {
    return null;
  }

  return (octave + 1) * 12 + steps[step] + alter;
}

function getGraceDurationSeconds(state) {
  const beatSeconds = 60 / Math.max(1, state.tempo);
  return Math.max(0.08, Math.min(0.18, beatSeconds * 0.22));
}

function normalizeTieType(value) {
  if (typeof value === 'number') {
    if (value === 0) return 'start';
    if (value === 1) return 'stop';
    if (value === 2) return 'continue';
    return '';
  }

  const text = String(value || '').trim().toLowerCase();
  if (!text) {
    return '';
  }

  if (text === 'start' || text === 'stop' || text === 'continue') {
    return text;
  }

  return '';
}

function getTieFlags(note) {
  let hasStart = false;
  let hasStop = false;

  const applyType = (rawType) => {
    const type = normalizeTieType(rawType);
    if (type === 'start') {
      hasStart = true;
      return;
    }
    if (type === 'stop') {
      hasStop = true;
      return;
    }
    if (type === 'continue') {
      hasStart = true;
      hasStop = true;
    }
  };

  const ties = Array.isArray(note && note.ties) ? note.ties : [];
  ties.forEach((tie) => {
    applyType(tie && tie.type);
  });

  const notations = Array.isArray(note && note.notations) ? note.notations : [];
  notations.forEach((notation) => {
    const tieds = Array.isArray(notation && notation.tieds) ? notation.tieds : [];
    tieds.forEach((tied) => {
      applyType(tied && tied.type);
    });
  });

  return {
    hasStart,
    hasStop
  };
}

function buildTieKey(partId, note, midi) {
  const voice = note && note.voice != null ? String(note.voice) : '1';
  const staff = note && note.staff != null ? String(note.staff) : '1';
  return [partId, voice, staff, String(midi)].join('|');
}

function processScoreToPlayback(score, sourceName) {
  const partStates = new Map();
  const notes = [];
  const keyframes = [];
  let globalDurationSeconds = 0;

  const measures = Array.isArray(score && score.measures) ? score.measures : [];

  for (const measure of measures) {
    const parts = measure && measure.parts ? measure.parts : {};
    const partIds = Object.keys(parts);

    for (const partId of partIds) {
      if (!partStates.has(partId)) {
        partStates.set(partId, {
          tempo: 120,
          divisions: 1,
          cursorSeconds: 0,
          lastNoteStartSeconds: 0,
          pendingGraceNotes: [],
          activeTies: new Map()
        });
      }

      const state = partStates.get(partId);
      const events = Array.isArray(parts[partId]) ? parts[partId] : [];

      for (const event of events) {
        if (!event || !event._class) {
          continue;
        }

        if (event._class === 'Attributes' && event.divisions != null) {
          const divisions = toNumber(event.divisions, NaN);
          if (Number.isFinite(divisions) && divisions > 0) {
            state.divisions = divisions;
          }
          continue;
        }

        if (event._class === 'Direction') {
          const tempo = extractTempoFromDirection(event);
          if (tempo) {
            state.tempo = tempo;
          }
          continue;
        }

        if (event._class === 'Backup') {
          const durationDiv = Math.max(0, toNumber(event.duration, 0));
          const deltaSeconds = (durationDiv / Math.max(1, state.divisions)) * (60 / Math.max(1, state.tempo));
          state.cursorSeconds = Math.max(0, state.cursorSeconds - deltaSeconds);
          continue;
        }

        if (event._class === 'Forward') {
          const durationDiv = Math.max(0, toNumber(event.duration, 0));
          const deltaSeconds = (durationDiv / Math.max(1, state.divisions)) * (60 / Math.max(1, state.tempo));
          state.cursorSeconds += deltaSeconds;
          globalDurationSeconds = Math.max(globalDurationSeconds, state.cursorSeconds);
          continue;
        }

        if (event._class !== 'Note') {
          continue;
        }

        const isGrace = Boolean(event.grace);
        const durationDiv = Math.max(0, toNumber(event.duration, 0));
        const durationSeconds = isGrace
          ? getGraceDurationSeconds(state)
          : (durationDiv / Math.max(1, state.divisions)) * (60 / Math.max(1, state.tempo));
        const noteStartSeconds = event.chord ? state.lastNoteStartSeconds : state.cursorSeconds;

        if (!event.chord && !isGrace) {
          state.cursorSeconds += durationSeconds;
          globalDurationSeconds = Math.max(globalDurationSeconds, state.cursorSeconds);
        }

        state.lastNoteStartSeconds = noteStartSeconds;

        if (event.rest || durationSeconds <= 0) {
          continue;
        }

        const midi = pitchToMidi(event.pitch);
        if (midi == null) {
          continue;
        }

        const velocity = Math.max(0.1, Math.min(1, toNumber(event.dynamics, 70) / 127));
        const tieFlags = getTieFlags(event);
        const tieKey = buildTieKey(partId, event, midi);

        if (isGrace) {
          state.pendingGraceNotes.push({
            partId,
            durationSeconds,
            midi,
            velocity: Number(velocity.toFixed(3))
          });
          continue;
        }

        if (state.pendingGraceNotes.length > 0) {
          const totalGraceDuration = state.pendingGraceNotes.reduce((sum, graceNote) => sum + graceNote.durationSeconds, 0);
          let graceStart = Math.max(0, noteStartSeconds - totalGraceDuration);

          state.pendingGraceNotes.forEach((graceNote) => {
            const graceEvent = {
              partId: graceNote.partId,
              time: graceStart,
              duration: graceNote.durationSeconds,
              midi: graceNote.midi,
              velocity: graceNote.velocity,
              grace: true
            };
            notes.push(graceEvent);
            keyframes.push({
              ...graceEvent,
              attack: true,
              tied: false
            });
            graceStart += graceNote.durationSeconds;
          });

          state.pendingGraceNotes = [];
        }

        const tiedNote = state.activeTies.get(tieKey);
        let keyframeAttack = true;
        const tied = tieFlags.hasStart || tieFlags.hasStop;

        if (tieFlags.hasStop && tiedNote) {
          tiedNote.duration += durationSeconds;
          keyframeAttack = false;

          if (!tieFlags.hasStart) {
            state.activeTies.delete(tieKey);
          }
        } else {
          const noteEvent = {
            partId,
            time: noteStartSeconds,
            duration: durationSeconds,
            midi,
            velocity,
            grace: false
          };

          notes.push(noteEvent);

          if (tieFlags.hasStart) {
            state.activeTies.set(tieKey, noteEvent);
          } else {
            state.activeTies.delete(tieKey);
          }
        }

        keyframes.push({
          partId,
          time: noteStartSeconds,
          duration: durationSeconds,
          midi,
          velocity,
          grace: false,
          attack: keyframeAttack,
          tied
        });
      }
    }
  }

  notes.sort((a, b) => a.time - b.time || a.midi - b.midi);
  keyframes.sort((a, b) => a.time - b.time || a.midi - b.midi);

  const outputNotes = notes.map((note) => ({
    partId: note.partId,
    time: Number(note.time.toFixed(5)),
    duration: Number(note.duration.toFixed(5)),
    midi: note.midi,
    velocity: Number(note.velocity.toFixed(3)),
    grace: Boolean(note.grace)
  }));

  const outputKeyframes = keyframes.map((event) => ({
    partId: event.partId,
    time: Number(event.time.toFixed(5)),
    duration: Number(event.duration.toFixed(5)),
    midi: event.midi,
    velocity: Number(event.velocity.toFixed(3)),
    grace: Boolean(event.grace),
    attack: Boolean(event.attack),
    tied: Boolean(event.tied)
  }));

  const tempoValues = Array.from(partStates.values()).map((state) => state.tempo).filter((v) => Number.isFinite(v) && v > 0);
  const estimatedTempo = tempoValues.length > 0 ? tempoValues[0] : 120;

  return {
    version: 1,
    source: sourceName,
    instrument: 'piano',
    bpm: estimatedTempo,
    duration: Number(globalDurationSeconds.toFixed(5)),
    noteCount: outputNotes.length,
    notes: outputNotes,
    keyframeCount: outputKeyframes.length,
    keyframes: outputKeyframes
  };
}

function generatePlaybackJsonForFile(xmlPath) {
  const sourceName = path.basename(xmlPath);
  const slug = sourceName.replace(/\.xml$/i, '');
  const jsonPath = path.join(MOTIFS_DIR, slug + '.playback.json');

  const xml = fs.readFileSync(xmlPath, 'utf8');
  const score = parseScore(xml);
  const playback = processScoreToPlayback(score, sourceName);

  fs.writeFileSync(jsonPath, JSON.stringify(playback, null, 2) + '\n', 'utf8');
  return { slug, jsonPath, noteCount: playback.noteCount, duration: playback.duration };
}

function copyToneBuild() {
  if (!fs.existsSync(TONE_SRC)) {
    throw new Error('Tone.js build not found at ' + TONE_SRC);
  }

  fs.mkdirSync(path.dirname(TONE_DST), { recursive: true });
  fs.copyFileSync(TONE_SRC, TONE_DST);
  return TONE_DST;
}

function main() {
  ensureXmldomChildrenCompat();

  const xmlFiles = fs
    .readdirSync(MOTIFS_DIR)
    .filter((name) => name.toLowerCase().endsWith('.xml'))
    .map((name) => path.join(MOTIFS_DIR, name));

  if (xmlFiles.length === 0) {
    console.log('No MusicXML files found in public/motifs.');
  }

  const results = [];
  for (const xmlPath of xmlFiles) {
    try {
      const generated = generatePlaybackJsonForFile(xmlPath);
      results.push(generated);
      console.log('Generated', path.basename(generated.jsonPath), '- notes:', generated.noteCount, 'duration:', generated.duration, 's');
    } catch (error) {
      console.error('Failed to convert', path.basename(xmlPath) + ':', error.message);
    }
  }

  const tonePath = copyToneBuild();
  console.log('Copied Tone.js build to', path.relative(ROOT, tonePath));

  if (results.length === 0) {
    process.exitCode = 1;
  }
}

main();
