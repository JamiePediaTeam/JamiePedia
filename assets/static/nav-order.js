// Centralized navigation order for prev/next buttons.
// Songs, albums, and motifs are all derived from music-files.js ordering.

(function () {
  function getAllMusicFiles() {
    return Array.isArray(window.musicFilePaths)
      ? window.musicFilePaths
      : (typeof musicFilePaths !== 'undefined' && Array.isArray(musicFilePaths) ? musicFilePaths : []);
  }

  function buildNavOrder() {
    const allMusicFiles = getAllMusicFiles();

    const albums = allMusicFiles
      .filter((item) => item && item.album === 'Album' && typeof item.path === 'string')
      .map((item) => item.path);

    const songs = allMusicFiles
      .filter((item) => item && item.album !== 'Album' && item.album !== 'Motifs' && typeof item.path === 'string')
      .map((item) => item.path)
      .filter((path) => /^\/music\/.+\.html$/i.test(path));

    const motifs = allMusicFiles
      .filter((item) => item && item.album === 'Motifs' && typeof item.path === 'string')
      .map((item) => item.path)
      .filter((path) => /^\/motifs\/.+\.html$/i.test(path));

    window.navOrder = {
      songs,
      albums,
      motifs
    };
  }

  buildNavOrder();

  if (typeof window.whenMusicFilePathsReady === 'function') {
    window.whenMusicFilePathsReady().finally(buildNavOrder);
  }

  window.addEventListener('musicFilePathsReady', buildNavOrder);
})();