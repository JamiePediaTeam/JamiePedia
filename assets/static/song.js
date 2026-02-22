function switchTab(tabName) {
  // Hide all content
  document.querySelectorAll('.song-content').forEach(el => {
    el.classList.remove('active');
  });
  // Remove active state from all tabs
  document.querySelectorAll('.song-tab').forEach(el => {
    el.classList.remove('active');
  });
  // Show selected content
  document.getElementById('content-' + tabName).classList.add('active');
  // Add active state to clicked tab
  event.target.classList.add('active');
}

function switchAlbumArt(filename) {
  // Update the image source
  document.getElementById('album-art-image').src = '../../public/images/cover-art/' + filename;
  // Remove active state from all album art tabs
  document.querySelectorAll('.album-tab').forEach(el => {
    el.classList.remove('active');
  });
  // Add active state to clicked tab
  event.target.classList.add('active');
  
  // Update cover artist based on selected album art
  const coverArtists = {
    'ml.png': 'ReverieQue',
    'cc.png': 'ReverieQue',
    'ccde.png': 'ReverieQue',
    'ddoll.jpg': 'Crispy6usiness',
    'bdkt26.png': 'Kurumitsu'
  };
  document.getElementById('cover-artist-display').textContent = coverArtists[filename] || 'Jamie Paige';
}

function previousSong() {
  alert('Previous song functionality to be implemented');
}

function nextSong() {
  alert('Next song functionality to be implemented');
}
