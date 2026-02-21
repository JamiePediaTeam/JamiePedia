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

function previousSong() {
  alert('Previous song functionality to be implemented');
}

function nextSong() {
  alert('Next song functionality to be implemented');
}
