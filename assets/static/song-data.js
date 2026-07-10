const allSongs = [];

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
  constructor(title, path = '', youtubeId = '', color = '#351854', motifRefs = []) {
    this.title = title;
    this.path = path;
    this.youtubeId = youtubeId;
    this.color = color;
    this.motifRefs = motifRefs;
    allSongs.push(this);
  }
}

const Songs = {
  // Gummyworm motif occurrences
  GUMMYWORM: new Song('Gummyworm', '../music/bs/gummyworm.html', '1SLftouEUL4', '#66BDE6', [
    new MotifReference('gummyworm', '2:02', '2:14'),
    new MotifReference('gummyworm', '2:14', '2:26'),
    new MotifReference('gummyworm', '3:39', '3:51'),
    new MotifReference('gummyworm', '3:51', '4:03'),
    new MotifReference('gummyworm', '4:05', '4:17'),
    new MotifReference('gummyworm', '4:17', '4:29')
  ]),

  NOT_QUITE_THERE: new Song('Not Quite There', '../music/cc/not-quite-there.html', 'r0sXI02NJ5M', '#66BDE6', [
    new MotifReference('gummyworm', '1:33', '1:43'),
    new MotifReference('gummyworm', '3:15', '3:26'),
    new MotifReference('gummyworm', '3:26', '3:42'),
    new MotifReference('bittersweet-kalia-vibte', '2:11', '2:16'),
    new MotifReference('constant-companions', '4:04', '4:16')
  ]),

  DANCE_DELIGHTFUL: new Song('Dance Delightful', '../music/cc/dance-delightful.html', 'sxO1RG9q30I', '#DE7F46', [
    new MotifReference('gummyworm', '3:33', '3:38')
  ]),

  SPACE_CENTER: new Song('Space Center', '../music/aa/space-center.html', '3QtK39spo7A', '#9EC7CD', [
    new MotifReference('space-center', '0:18', '0:32', false, true, 'A'),
    new MotifReference('space-center', '0:33', '0:49', false, true, 'B'),
    new MotifReference('space-center', '1:10', '1:24', false, false, 'A'),
    new MotifReference('space-center', '1:25', '1:42', false, false, 'B')
  ]),

  SPACE_CENTER_PT2: new Song('Space Center [pt. 2]', '../music/aa/space-center-pt-2.html', 'cw41RXs2vJ4', '#A2E9CF', [
    new MotifReference('space-center', '0:40', '0:42', false, false, 'B'),
    new MotifReference('space-center', '1:02', '1:20', false, false, 'A'),
    new MotifReference('space-center', '1:18', '1:42', false, false, 'B')
  ])
};

function getSongsWithMotifId(motifId) {
  return allSongs.filter((song) =>
    song.motifRefs.some((ref) => ref.motifId === motifId)
  );
}

window.SongData = {
  allSongs,
  Song,
  Songs,
  MotifReference,
  getSongsWithMotifId
};