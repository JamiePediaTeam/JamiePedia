const allSongs = [];

class MotifReference {
  constructor(motifId, startTime = '', endTime = '', isVariation = false) {
    this.motifId = motifId;
    this.startTime = startTime;
    this.endTime = endTime;
    this.isVariation = isVariation;
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