// Version configuration loaded from HTML data-versions attribute
let versionConfig = {};

// Ordered list of version keys for tab navigation
let versionOrder = [];

// Load configuration from HTML data attributes
function loadVersionConfig() {
  const htmlElement = document.documentElement;
  
  // Parse JSON from data-versions attribute
  if (htmlElement.hasAttribute('data-versions')) {
    try {
      const versionsJSON = JSON.parse(htmlElement.getAttribute('data-versions'));
      versionConfig = versionsJSON;
      versionOrder = Object.keys(versionsJSON);
    } catch (e) {
      console.error('Failed to parse data-versions JSON from HTML:', e);
      console.error('The data-versions attribute must contain valid JSON configuration for all versions.');
    }
  } else {
    console.error('No data-versions attribute found on HTML element. Version functionality requires this configuration.');
  }
}

function switchVersion(versionName) {
  // Hide all version content
  versionOrder.forEach(version => {
    const versionElement = document.getElementById('version-' + version);
    if (versionElement) {
      versionElement.style.display = 'none';
    }
  });
  
  // Remove active state from all version tabs
  document.querySelectorAll('.version-tab').forEach(el => {
    el.classList.remove('active');
  });
  
  // Check if this version exists in config
  if (!versionConfig[versionName]) {
    console.warn('Version not found:', versionName);
    return;
  }
  
  const config = versionConfig[versionName];
  const versionElement = document.getElementById('version-' + versionName);
  
  if (versionElement) {
    versionElement.style.display = 'flex';
    
    // Switch background
    const bgPath = '../../public/images/backgrounds/' + config.background;
    document.documentElement.style.backgroundImage = 'url(' + bgPath + ')';
    
    // Reset album art tabs and image
    versionElement.querySelectorAll('.album-tab').forEach(el => {
      el.classList.remove('active');
    });
    
    const firstAlbumTab = versionElement.querySelector('.album-tab');
    if (firstAlbumTab) {
      firstAlbumTab.classList.add('active');
      const albumArtElement = document.getElementById(config.albumArtImageId);
      if (albumArtElement) {
        albumArtElement.src = '../../public/images/cover-art/' + config.defaultAlbumArt;
      }
    }
  }
  
  // Activate the version tab
  event.target.classList.add('active');
  
  // Reset tab view to Summary
  switchTab('summary');
}


function switchTab(tabName) {
  // Hide all content in all versions
  document.querySelectorAll('.song-content').forEach(el => {
    el.classList.remove('active');
  });
  
  // Remove active state from all main tabs (globally, not just in active version)
  document.querySelectorAll('.song-tab').forEach(el => {
    el.classList.remove('active');
  });
  
  // Check if version system is in use
  let contentId;
  let lyricsSubtabsContainerId;
  let activeVersion;
  
  if (versionOrder && versionOrder.length > 0) {
    // Version-based logic
    let activeVersionName = 'original';
    for (const versionName of versionOrder) {
      const versionElement = document.getElementById('version-' + versionName);
      if (versionElement && versionElement.style.display === 'flex') {
        activeVersionName = versionName;
        break;
      }
    }
    
    // Show selected content with version-appropriate ID
    contentId = activeVersionName === 'original' ? ('content-' + tabName) : ('content-' + tabName + '-' + activeVersionName);
    lyricsSubtabsContainerId = activeVersionName === 'original' ? 'lyrics-subtabs-container' : ('lyrics-subtabs-container-' + activeVersionName);
    activeVersion = document.getElementById('version-' + activeVersionName);
  } else {
    // Simple logic for pages without version system
    contentId = 'content-' + tabName;
    lyricsSubtabsContainerId = 'lyrics-subtabs-container';
    activeVersion = document.querySelector('.song-container') || document.body;
  }
  
  const contentElement = document.getElementById(contentId);
  if (contentElement) {
    contentElement.classList.add('active');
  }
  
  // Find and activate the correct tab button by mapping tabName to index
  const tabNameToIndex = {
    'summary': 0,
    'lyrics': 1,
    'motifs': 2,
    'extended': 3
  };
  const tabIndex = tabNameToIndex[tabName];
  if (tabIndex !== undefined) {
    const allSongTabs = document.querySelectorAll('.song-tab');
    const tabButton = allSongTabs[tabIndex];
    if (tabButton) {
      tabButton.classList.add('active');
    }
  }
  
  // Show/hide lyrics subtabs based on selected tab
  const lyricsSubtabsContainer = document.getElementById(lyricsSubtabsContainerId);
  const songLength = activeVersion ? activeVersion.querySelector('.song-length') : null;
  
  if (lyricsSubtabsContainer) {
    if (tabName === 'lyrics') {
      lyricsSubtabsContainer.classList.add('active');
      if (songLength) songLength.classList.add('hide-border');
    } else {
      lyricsSubtabsContainer.classList.remove('active');
      if (songLength) songLength.classList.remove('hide-border');
    }
  }
}

function switchLyricsTab(lyricsType) {
  // Check if version system is in use
  if (versionOrder && versionOrder.length > 0) {
    // Version-based logic
    let activeVersionName = 'original';
    for (const versionName of versionOrder) {
      const versionElement = document.getElementById('version-' + versionName);
      if (versionElement && versionElement.style.display === 'flex') {
        activeVersionName = versionName;
        break;
      }
    }
    
    const activeVersion = document.getElementById('version-' + activeVersionName);
    if (!activeVersion) return;
    
    // Hide all lyrics content in the active version
    activeVersion.querySelectorAll('.lyrics-content').forEach(el => {
      el.classList.remove('active');
    });
    
    // Remove active state from all lyrics subtabs
    activeVersion.querySelectorAll('.lyrics-subtab').forEach(el => {
      el.classList.remove('active');
    });
    
    // Show selected lyrics content with version-appropriate ID
    const suffixId = activeVersionName === 'original' ? ('lyrics-' + lyricsType) : ('lyrics-' + lyricsType + '-' + activeVersionName);
    const selectedContent = document.getElementById(suffixId);
    if (selectedContent) {
      selectedContent.classList.add('active');
    }
    
    // Add active state to clicked lyrics subtab
    if (event && event.target) {
      event.target.classList.add('active');
    }
  } else {
    // Simple logic for pages without version system
    document.querySelectorAll('.lyrics-content').forEach(el => {
      el.classList.remove('active');
    });
    
    document.querySelectorAll('.lyrics-subtab').forEach(el => {
      el.classList.remove('active');
    });
    
    const selectedContent = document.getElementById('lyrics-' + lyricsType);
    if (selectedContent) {
      selectedContent.classList.add('active');
    }
    
    if (event && event.target) {
      event.target.classList.add('active');
    }
  }
}

// Initialize lyrics subtabs visibility on page load
function loadScriptOnce(src) {
  return new Promise((resolve) => {
    const existing = document.querySelector('script[src="' + src + '"]');
    if (existing) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => resolve();
    document.head.appendChild(script);
  });
}

function initializeSongConnectionsFeature() {
  const prefix = '../../';

  loadScriptOnce('https://www.youtube.com/iframe_api')
    .then(() => loadScriptOnce(prefix + 'assets/static/motif-data.js'))
    .then(() => loadScriptOnce(prefix + 'assets/static/song-data.js'))
    .then(() => loadScriptOnce(prefix + 'assets/static/song-lyrics.js'))
    .then(() => loadScriptOnce(prefix + 'assets/static/song-motifs.js'));
}

document.addEventListener('DOMContentLoaded', function() {
  loadVersionConfig();
  
  // Load summary as default tab
  switchTab('summary');
  
  const originalVersion = document.getElementById('version-original');
  const lyricsSubtabsContainer = document.getElementById('lyrics-subtabs-container');
  const contentLyrics = document.getElementById('content-lyrics');
  const songLength = originalVersion ? originalVersion.querySelector('.song-length') : null;
  
  if (lyricsSubtabsContainer && contentLyrics && contentLyrics.classList.contains('active')) {
    lyricsSubtabsContainer.classList.add('active');
    if (songLength) songLength.classList.add('hide-border');
  }
  
  initializeReferences();
  initializeSongConnectionsFeature();
});

function switchAlbumArt(filename) {
  let albumArtImageId;
  let coverArtistDisplayId;
  let activeVersionElement;
  
  // Check if version system is in use
  if (versionOrder && versionOrder.length > 0) {
    // Version-based logic
    let activeVersionName = 'original';
    for (const versionName of versionOrder) {
      const versionElement = document.getElementById('version-' + versionName);
      if (versionElement && versionElement.style.display === 'flex') {
        activeVersionName = versionName;
        break;
      }
    }
    
    // Get the config for the active version
    const config = versionConfig[activeVersionName];
    if (!config) return;
    
    albumArtImageId = config.albumArtImageId;
    coverArtistDisplayId = config.coverArtistDisplayId;
    activeVersionElement = document.getElementById('version-' + activeVersionName);
  } else {
    // Simple logic for pages without version system
    albumArtImageId = 'album-art-image';
    coverArtistDisplayId = 'cover-artist-display';
    activeVersionElement = document.querySelector('.song-container') || document.body;
  }
  
  // Update the image source
  const albumArtElement = document.getElementById(albumArtImageId);
  if (albumArtElement) {
    albumArtElement.src = '../../public/images/cover-art/' + filename;
  }
  
  // Remove active state from all album art tabs in the active version
  if (activeVersionElement) {
    activeVersionElement.querySelectorAll('.album-tab').forEach(el => {
      el.classList.remove('active');
    });
  }
  
  // Add active state to clicked tab
  if (event && event.target) {
    event.target.classList.add('active');
  }
  
  // Update cover artist based on selected album art
  const coverArtistDisplay = document.getElementById(coverArtistDisplayId);
  const coverArtists = {
    'aa.png': 'RJ Lake',
    'acs.png': 'angelwinter',
    'aed.png': 'Valerie Halla',
    'aisr.png': 'Braz_OS',
    'aod.png': 'divvydots',
    'as.png': 'REVERIEQUE',
    'atm.jpg': 'Avi Roberts',
    'aw.jpg': 'Remy Boydell',
    'bb.png': 'Sidoopa',
    'bc.jpg': 'REVERIEQUE',
    'bdkt26.png': 'Kurumitsu',
    'bs.png': 'REVERIEQUE',
    'bv.png': 'ricedeity',
    'bvcc.png': 'ajihaew',
    'bvi.png': 'ricedeity',
    'cb.jpg': 'ODDEEO',
    'cc.png': 'REVERIEQUE',
    'ccde.png': 'REVERIEQUE',
    'ccii.png': 'REVERIEQUE',
    'ccolors.png': 'REVERIEQUE',
    'ccommune.jpg': 'Louie Zong',
    'ccontrepoint.png': 'ajihaew',
    'closer.jpg': 'Jamie Paige',
    'cs.png': 'Catherine G. Erhlhell',
    'ddoll.jpg': 'Crispy6usiness',
    'destiny.jpg': 'Bluffy',
    'dnh.png': 'Skaði Kaos',
    'ds2021.jpg': 'REVERIEQUE',
    'dsc2021.jpg': 'Nou',
    'dsc2025.jpg': 'lack',
    'ebi.jpg': 'Jamie Paige',
    'encore.jpg': 'REVERIEQUE',
    'erb.png': 'Arusechika',
    'ewz.jpg': 'REVERIEQUE, ricedeity',
    'fire.png': 'angelfaise',
    'ghf.jpg': 'Unknown',
    'gr.jpg': 'kalrot',
    'hc.jpg': 'citruslucy',
    'hmt.jpg': 'pipiskulle',
    'human.png': 'insertdisc5',
    'iwticf.png': 'BEARVAMPS',
    'jpjp3.png': 'Jamie Paige',
    'jpjp4.png': 'Jamie Paige',
    'jpjp5.png': 'Jamie Paige',
    'jpjp6.png': 'Jamie Paige',
    'loll.jpg': 'worm-suggestion',
    'lr.jpg': 'REVERIEQUE',
    'lt.jpg': 'haru / oomr005',
    'martyoshka.png': 'milkbean',
    'ml.png': 'REVERIEQUE',
    'mm.png': 'Luciel Ellis',
    'nqtsc.jpg': 'Ryoko Kui',
    'of.jpg': 'Fourth Strike Records',
    'otw.jpg': 'nika37',
    'pjscpfp.jpg': 'REVERIEQUE',
    'pmprr.jpg': 'monolarkey',
    'ppiiharaylyhssltl.jpg': 'REVERIEQUE',
    'pppp.png': 'REVERIEQUE',
    'ptpt.jpg': 'Enid, friendxp',
    'qov.jpg': 'sferics32',
    'qovcc.png': 'ajihaew',
    'r4c.png': 'ricedeity',
    'rd.jpg': 'pierrotsdoll',
    'rdcc.jpg': 'ajihaew',
    'ride.jpg': 'LulunaRina',
    'rotjpa.jpg': 'ODDEEO',
    'rr.jpeg': 'vippori',
    'sd.png': 'Cochet',
    'sf.png': 'hoshizorelone',
    'sfrr.jpg': 'ajihaew',
    'smots.png': 'SoftySapphie',
    'srid.png': 'nika37',
    'static.jpg': 'ricedeity',
    'su.png': 'Jamie Lee',
    'tia.jpg': 'TheRyDesign',
    'tpoc.jpg': 'Unknown',
    'ts26.jpg': 'Kurumitsu',
    'vhs.png': 'BEARVAMPS',
    'virtue.jpg': 'Cochet V.',
    'vvff.png': 'retrotenn',
    'vvjp.png': 'retrotenn',
    'wg.jpg': 'ippo.tsk',
    'wgcc.jpg': 'ajihaew',
    'wscrr.jpg': 'REVERIEQUE',
    'wtr.jpg': 'Edlinklover',
    'wtrcc.jpg': 'ajihaew',
    'ww.jpg': 'BEARVAMPS',
    'wwr.jpg': 'kheechuu',
    'wwrcc.jpg': 'ajihaew',
  };
  if (coverArtistDisplay) {
    coverArtistDisplay.textContent = coverArtists[filename] || '';
  }
}

// Initialize reference tooltips
function initializeReferences() {
  document.querySelectorAll('.ref-tag').forEach(refTag => {
    const refNum = refTag.getAttribute('data-ref');
    const refElement = document.getElementById('ref-' + refNum);
    
    if (refElement) {
      // Get the text content of the reference (without the back link)
      const refText = refElement.textContent.replace('↑', '').trim();
      // Set the tooltip text
      refTag.setAttribute('data-ref-text', refText);
      
      // Add click handler to scroll to reference
      refTag.addEventListener('click', function(e) {
        e.preventDefault();
        refElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // Highlight the reference briefly
        refElement.style.backgroundColor = 'rgba(240, 94, 85, 0.1)';
        setTimeout(() => {
          refElement.style.backgroundColor = '';
        }, 2000);
      });
    }
  });
}