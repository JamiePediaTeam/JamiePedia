// Centralized navigation order for prev/next buttons.
// Songs and albums are derived from music-files.js ordering.
// Motifs are defined in the same order as motifs.html.

(function () {
  const allMusicFiles = Array.isArray(window.musicFilePaths)
    ? window.musicFilePaths
    : (typeof musicFilePaths !== 'undefined' && Array.isArray(musicFilePaths) ? musicFilePaths : []);

  const albums = allMusicFiles
    .filter((item) => item && item.album === 'Album' && typeof item.path === 'string')
    .map((item) => item.path);

  const songs = allMusicFiles
    .filter((item) => item && item.album !== 'Album' && item.album !== 'Motifs' && typeof item.path === 'string')
    .map((item) => item.path)
    .filter((path) => /^\/music\/.+\/.+\.html$/i.test(path));

  const motifs = [
    '/motifs/bittersweet-kalia-vibte.html',
    '/motifs/gummyworm.html',
    '/motifs/constant-companions.html'
  ];

  window.navOrder = {
    songs,
    albums,
    motifs
  };
})();