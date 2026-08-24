// Store full search results for filtering
let fullSearchResults = [];
let currentSearchQuery = '';

function searchEscapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function parseSearchLrcRawLines(text) {
  const lines = String(text || '').split(/\r?\n/);
  const timedEntries = [];

  lines.forEach((line) => {
    const timestamps = [];
    const timestampPattern = /\[(\d{1,2}:\d{2}(?:\.\d{1,3})?)\]/g;
    let match;

    while ((match = timestampPattern.exec(line)) !== null) {
      timestamps.push(match[1]);
    }

    if (timestamps.length === 0) {
      return;
    }

    const lyric = line.replace(/\[[^\]]+\]/g, '').trim();
    timestamps.forEach((stamp) => {
      timedEntries.push({ stamp, text: lyric });
    });
  });

  const seen = new Set();
  return timedEntries
    .filter((entry) => {
      const key = entry.stamp + '|' + entry.text;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .map((entry) => entry.text);
}

function resolveSearchPath(basePath, filePath) {
  if (!filePath) {
    return '';
  }
  return (basePath || '') + filePath;
}

function resolveSearchImageSrc(basePath, pagePath, rawSrc) {
  const source = String(rawSrc || '').trim();
  if (!source) {
    return '';
  }

  if (/^(https?:|data:|blob:)/i.test(source)) {
    return source;
  }

  let normalized = source;
  if (normalized.startsWith('/') && basePath && !normalized.startsWith(basePath + '/')) {
    normalized = basePath + normalized;
  }

  try {
    const pageUrl = new URL((basePath || '') + pagePath, window.location.origin);
    const resolved = new URL(normalized, pageUrl.href);
    if (resolved.origin === window.location.origin) {
      return resolved.pathname + resolved.search + resolved.hash;
    }
    return resolved.href;
  } catch (_error) {
    return normalized;
  }
}

async function fetchSearchText(path) {
  if (!path) {
    return null;
  }

  try {
    const response = await fetch(path);
    if (!response.ok) {
      return null;
    }
    const text = await response.text();
    return String(text || '').trim() ? text : null;
  } catch (_error) {
    return null;
  }
}

function getSearchSongVariantSlugs(doc, fileEntry) {
  const fileName = String(fileEntry.path || '').split('/').pop() || '';
  const baseSlug = fileName.replace(/\.html$/i, '').toLowerCase();
  const slugs = [baseSlug];

  const htmlElement = doc && doc.documentElement;
  const versionsAttr = htmlElement ? htmlElement.getAttribute('data-versions') : '';
  if (!versionsAttr) {
    return slugs;
  }

  try {
    const versions = JSON.parse(versionsAttr);
    Object.keys(versions || {}).forEach((versionName) => {
      const normalized = String(versionName || '').trim().toLowerCase();
      if (!normalized || normalized === 'original') {
        return;
      }

      const nextSlug = baseSlug + normalized;
      if (!slugs.includes(nextSlug)) {
        slugs.push(nextSlug);
      }
    });
  } catch (_error) {
    // Ignore invalid version metadata during search indexing.
  }

  return slugs;
}

function buildSearchSnippet(text, query) {
  const sourceText = String(text || '').replace(/\s+/g, ' ').trim();
  const normalizedQuery = String(query || '').toLowerCase();
  if (!sourceText || !normalizedQuery) {
    return {
      snippet: '',
      hasContentBefore: false,
      hasContentAfter: false
    };
  }

  const lowerSource = sourceText.toLowerCase();
  const index = lowerSource.indexOf(normalizedQuery);
  if (index < 0) {
    return {
      snippet: sourceText.slice(0, 120).trim(),
      hasContentBefore: false,
      hasContentAfter: sourceText.length > 120
    };
  }

  const start = Math.max(0, index - 60);
  const end = Math.min(sourceText.length, index + normalizedQuery.length + 60);
  return {
    snippet: sourceText.substring(start, end).trim(),
    hasContentBefore: start > 0,
    hasContentAfter: end < sourceText.length
  };
}

async function getSearchSongExternalContent(basePath, doc, fileEntry) {
  const slugs = getSearchSongVariantSlugs(doc, fileEntry);
  const content = {
    summary: '',
    lyrics: '',
    extended: ''
  };

  await Promise.all(slugs.map(async (slug) => {
    const [summaryText, annotatedText, extendedText, lrcText] = await Promise.all([
      fetchSearchText(resolveSearchPath(basePath, '/public/summaries/' + slug + '.txt')),
      fetchSearchText(resolveSearchPath(basePath, '/public/annotations/' + slug + '.txt')),
      fetchSearchText(resolveSearchPath(basePath, '/public/extended/' + slug + '.txt')),
      fetchSearchText(resolveSearchPath(basePath, '/public/lyrics/' + slug + '.lrc'))
    ]);

    if (summaryText) {
      content.summary += ' ' + summaryText;
    }
    if (annotatedText) {
      content.lyrics += ' ' + annotatedText;
    }
    if (extendedText) {
      content.extended += ' ' + extendedText;
    }
    if (lrcText) {
      content.lyrics += ' ' + parseSearchLrcRawLines(lrcText).join(' ');
    }
  }));

  content.summary = content.summary.trim();
  content.lyrics = content.lyrics.trim();
  content.extended = content.extended.trim();
  return content;
}

// Fetch and search a single file
async function searchFile(fileEntry, query) {
  try {
    const basePath = window.location.pathname.includes('/JamiePedia/') ? '/JamiePedia' : '';
    const response = await fetch(basePath + fileEntry.path);
    if (!response.ok) return null;
    
    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Classes to exclude from search
    const excludeClasses = [
      'song-tabs-container',
      'song-length',
      'lyrics-subtab',
      'album-tab',
      'song-tabs',
      'version-tab',
      'album-tabs-container',
      'album-tabs',
      'song-nav-buttons',
      'back-button',
      'references-section',
      'song-info-label',
      'cover-art-footer'
    ];
    
    // Exclude in-page annotated lyrics placeholders; real text is loaded from public files below.
    const excludeIds = ['lyrics-annotated'];
    excludeIds.forEach(id => {
      const element = doc.getElementById(id);
      if (element) {
        element.remove();
      }
    });
    
    // Remove excluded elements
    excludeClasses.forEach(className => {
      doc.querySelectorAll('.' + className).forEach(el => {
        el.remove();
      });
    });
    
    // Extract text with <br> replaced by visual space bar
    let textWithBrMarkers = '';
    if (doc.body) {
      const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, null);
      let node;
      while (node = walker.nextNode()) {
        if (node.nodeType === Node.TEXT_NODE) {
          textWithBrMarkers += node.textContent;
        } else if (node.nodeName === 'BR') {
          textWithBrMarkers += ' ';
        }
      }
      textWithBrMarkers = textWithBrMarkers.replace(/\s+/g, ' ').trim();
    }
    
    const pathParts = fileEntry.path.split('/').filter(p => p);
    const isAlbumPage = pathParts.length === 2; // /music/aa.html
    const isSongPage = pathParts.length === 3; // /music/aa/song.html

    const externalContent = isSongPage
      ? await getSearchSongExternalContent(basePath, doc, fileEntry)
      : { summary: '', lyrics: '', extended: '' };

    const combinedSearchText = [
      textWithBrMarkers,
      externalContent.summary,
      externalContent.lyrics,
      externalContent.extended
    ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();

    const lowerTextWithBr = combinedSearchText.toLowerCase();
    const lowerQuery = query.toLowerCase();
    
    if (lowerTextWithBr.includes(lowerQuery)) {
      // Extract cover art image
      let coverSrc = basePath + '/public/images/cover-art/as.png'; // default fallback
      
      // Try to find cover image from songs (album-art-image ID)
      const coverImg = doc.getElementById('album-art-image');
      if (coverImg && coverImg.getAttribute('src')) {
        const imagePath = coverImg.getAttribute('src');
        const resolvedCoverSrc = resolveSearchImageSrc(basePath, fileEntry.path, imagePath);
        if (resolvedCoverSrc) {
          coverSrc = resolvedCoverSrc;
        }
      } else {
        // Try to find cover image from album pages (album-cover-container class)
        const albumCoverContainer = doc.querySelector('.album-cover-container img');
        if (albumCoverContainer && albumCoverContainer.getAttribute('src')) {
          const imagePath = albumCoverContainer.getAttribute('src');
          const resolvedCoverSrc = resolveSearchImageSrc(basePath, fileEntry.path, imagePath);
          if (resolvedCoverSrc) {
            coverSrc = resolvedCoverSrc;
          }
        }
      }
      
      // Extract title from page content (song-title or h1)
      let title = '';
      const songTitle = doc.querySelector('.song-title');
      if (songTitle) {
        title = songTitle.textContent.trim();
      } else {
        const h1 = doc.querySelector('h1');
        if (h1) {
          title = h1.textContent.trim();
        }
      }
      
      // Fallback to filename-derived title if no title found
      if (!title) {
        title = fileEntry.path.split('/').pop().replace('.html', '').replace(/-/g, ' ');
      }
      
      // Detect which content types contain the search query
      const contentTypes = [];
      
      if (isSongPage) {
        const summaryDiv = doc.querySelector('#content-summary');
        const lyricsDiv = doc.querySelector('#content-lyrics');
        const motifsDiv = doc.querySelector('#content-motifs');
        const extendedDiv = doc.querySelector('#content-extended');
        const rightView = doc.querySelector('.song-rightview');
        
        // Check each content area
        const summaryText = ((summaryDiv && summaryDiv.textContent) || '') + ' ' + (externalContent.summary || '');
        if (summaryText.toLowerCase().includes(lowerQuery)) {
          contentTypes.push('summary');
        }
        const lyricsText = ((lyricsDiv && lyricsDiv.textContent) || '') + ' ' + (externalContent.lyrics || '');
        if (lyricsText.toLowerCase().includes(lowerQuery)) {
          contentTypes.push('lyrics');
        }
        if (motifsDiv && motifsDiv.textContent.toLowerCase().includes(lowerQuery)) {
          contentTypes.push('connections');
        }
        const extendedText = ((extendedDiv && extendedDiv.textContent) || '') + ' ' + (externalContent.extended || '');
        if (extendedText.toLowerCase().includes(lowerQuery)) {
          contentTypes.push('extended');
        }
        if (rightView && rightView.textContent.toLowerCase().includes(lowerQuery)) {
          contentTypes.push('metadata');
        }
      }
      
      // Check for page titles (directly check if songTitle contains the query)
      if (songTitle && songTitle.textContent.toLowerCase().includes(lowerQuery)) {
        contentTypes.push('page-titles');
      }
      
      // Check for page titles in other headings (h1-h6) that aren't the songTitle
      const headings = doc.querySelectorAll('h1, h2, h3, h4, h5, h6');
      for (const heading of headings) {
        if (heading !== songTitle && heading.textContent.toLowerCase().includes(lowerQuery)) {
          contentTypes.push('page-titles');
          break;
        }
      }
      
      // If no specific content type detected, mark as general
      if (contentTypes.length === 0) {
        contentTypes.push('other');
      }

      const snippetCandidates = [
        externalContent.summary,
        externalContent.lyrics,
        externalContent.extended,
        textWithBrMarkers
      ].filter(Boolean);

      let snippetSource = combinedSearchText;
      for (const candidate of snippetCandidates) {
        if (String(candidate).toLowerCase().includes(lowerQuery)) {
          snippetSource = candidate;
          break;
        }
      }

      const snippetData = buildSearchSnippet(snippetSource, query);
      
      return {
        album: fileEntry.album,
        title: title,
        url: fileEntry.path,
        content: snippetData.snippet,
        coverSrc: coverSrc,
        hasContentBefore: snippetData.hasContentBefore,
        hasContentAfter: snippetData.hasContentAfter,
        pageType: isAlbumPage ? 'album' : 'song',
        contentTypes: contentTypes
      };
    }
  } catch (e) {
    // File fetch failed, skip
  }
  return null;
}

// Perform search across all site files
async function performSearch(query) {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return;
  }
  
  const resultsContainer = document.getElementById('searchResults');
  resultsContainer.innerHTML = '<p style="color: var(--theme-color-text_muted); text-align: center;">Searching...</p>';
  
  const modal = document.getElementById('searchModal');
  modal.style.display = 'block';
  
  const results = [];
  const searchPromises = musicFilePaths.map(fileEntry => searchFile(fileEntry, trimmedQuery));
  const searchResults = await Promise.all(searchPromises);
  
  searchResults.forEach(result => {
    if (result) {
      results.push(result);
    }
  });
  
  displaySearchResults(results, query);
  
  // Store results and query for filtering
  fullSearchResults = results;
  currentSearchQuery = query;
}

// Display search results in modal
function displaySearchResults(results, originalQuery) {
  const resultsContainer = document.getElementById('searchResults');
  const searchTitle = document.getElementById('searchTitle');
  const basePath = window.location.pathname.includes('/JamiePedia/') ? '/JamiePedia' : '';
  
  // Escape special regex characters
  const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedQuery = escapeRegex(originalQuery);
  const queryRegex = new RegExp(`(${escapedQuery})`, 'gi');
  
  resultsContainer.innerHTML = '';
  
  if (results.length === 0) {
    resultsContainer.innerHTML = '<p style="color: var(--theme-color-text_muted);">No results found for "' + originalQuery + '"</p>';
    searchTitle.textContent = 'Search Results (0)';
  } else {
    searchTitle.textContent = 'Search Results (' + results.length + ')';
    results.forEach(item => {
      const resultDiv = document.createElement('div');
      resultDiv.style.cssText = 'margin-bottom: 15px; padding: 10px; border: 3px solid var(--theme-color-brand_frame); background: var(--theme-color-background_base); display: flex; gap: 15px; align-items: flex-start; border-radius: 5px;';
      
      const coverImg = document.createElement('img');
      // Ensure absolute paths have basePath prepended for GitHub Pages
      let imgSrc = item.coverSrc;
      if (imgSrc.startsWith('/') && !imgSrc.startsWith(basePath)) {
        imgSrc = basePath + imgSrc;
      }
      coverImg.src = imgSrc;
      coverImg.onerror = function () {
        this.onerror = null;
        this.src = basePath + '/public/images/cover-art/as.png';
      };
      coverImg.alt = item.title;
      coverImg.style.cssText = 'width: 80px; height: auto; flex-shrink: 0; border: 1px solid var(--theme-color-border_pill); border-radius: 2px;';
      
      const contentDiv = document.createElement('div');
      contentDiv.style.cssText = 'flex: 1;';
      const highlightedContent = item.content.replace(queryRegex, '<strong style="background-color: var(--theme-color-surface_highlight); color: var(--theme-color-text_base_black); font-weight: bold;">$1</strong>');
      const beforeEllipsis = item.hasContentBefore ? '...' : '';
      const afterEllipsis = item.hasContentAfter ? '...' : '';
      contentDiv.innerHTML = '<div style="font-size: 12px; color: var(--theme-color-text_muted); font-weight: bold;">' + item.album + '</div>' +
        '<a href="' + basePath + item.url + '" style="color: var(--theme-color-link_default); text-decoration: none; font-size: 16px; font-weight: bold;">' + 
        item.title + '</a>' +
        '<p style="margin: 5px 0 0 0; color: var(--theme-page-text); font-size: 13px;">' + beforeEllipsis + highlightedContent + afterEllipsis + '</p>';
      
      resultDiv.appendChild(coverImg);
      resultDiv.appendChild(contentDiv);
      resultsContainer.appendChild(resultDiv);
    });
  }
}

// Handle search input changes in modal
function handleModalSearchChange(e) {
  const query = e.target.value.trim();
  if (query) {
    performSearch(query);
  }
}

// Open search modal
function openSearchModal() {
  const query = document.getElementById('searchInput').value.trim();
  const resultFilterInput = document.getElementById('resultFilterInput');
  
  // Pre-populate the modal search input with main search bar value
  if (resultFilterInput) {
    resultFilterInput.value = query;
  }
  
  // Hide filters box by default
  const filterBox = document.getElementById('filterBox');
  if (filterBox) {
    filterBox.style.display = 'none';
  }
  
  // Reset all exclusion checkboxes
  document.getElementById('excludeAlbums').checked = false;
  document.getElementById('excludeSongs').checked = false;
  document.getElementById('excludeTitles').checked = false;
  document.getElementById('excludeSummary').checked = false;
  document.getElementById('excludeLyrics').checked = false;
  document.getElementById('excludeConnections').checked = false;
  document.getElementById('excludeExtended').checked = false;
  document.getElementById('excludeMetadata').checked = false;
  
  performSearch(query);
}

// Apply filters based on checkboxes
function applyResultsFilter() {
  // Get selected content exclusions (checkboxes)
  const excludedContentTypes = [];
  
  // Page type filters (new checkboxes)
  if (document.getElementById('excludeAlbums') && document.getElementById('excludeAlbums').checked) {
    excludedContentTypes.push('album');
  }
  if (document.getElementById('excludeSongs') && document.getElementById('excludeSongs').checked) {
    excludedContentTypes.push('song');
  }
  
  // Content type filters
  if (document.getElementById('excludeTitles') && document.getElementById('excludeTitles').checked) {
    excludedContentTypes.push('page-titles');
  }
  if (document.getElementById('excludeSummary') && document.getElementById('excludeSummary').checked) {
    excludedContentTypes.push('summary');
  }
  if (document.getElementById('excludeLyrics') && document.getElementById('excludeLyrics').checked) {
    excludedContentTypes.push('lyrics');
  }
  if (document.getElementById('excludeConnections') && document.getElementById('excludeConnections').checked) {
    excludedContentTypes.push('connections');
  }
  if (document.getElementById('excludeExtended') && document.getElementById('excludeExtended').checked) {
    excludedContentTypes.push('extended');
  }
  if (document.getElementById('excludeMetadata') && document.getElementById('excludeMetadata').checked) {
    excludedContentTypes.push('metadata');
  }
  
  // Filter results
  let filteredResults = fullSearchResults;
  
  // Filter by excluded page types
  if (excludedContentTypes.includes('album') || excludedContentTypes.includes('song')) {
    filteredResults = filteredResults.filter(result => {
      return !(
        (excludedContentTypes.includes('album') && result.pageType === 'album') ||
        (excludedContentTypes.includes('song') && result.pageType === 'song')
      );
    });
  }
  
  // Filter by excluded content types
  const contentExclusions = excludedContentTypes.filter(type => 
    !['album', 'song'].includes(type)
  );
  
  if (contentExclusions.length > 0) {
    filteredResults = filteredResults.filter(result => {
      // Keep result only if it has at least one content type that is NOT excluded
      return result.contentTypes.some(contentType => !contentExclusions.includes(contentType));
    });
  }
  
  displaySearchResults(filteredResults, currentSearchQuery);
}

// Close search modal
function closeSearchModal() {
  document.getElementById('searchModal').style.display = 'none';
}

// Handle search button click
function handleSearchClick(e) {
  e.preventDefault();
  openSearchModal();
}

// Initialize search handlers
function initializeSearch() {
  const searchBtn = document.getElementById('searchBtn');
  const closeBtn = document.getElementById('closeSearchModal');
  const modal = document.getElementById('searchModal');
  const searchInput = document.getElementById('searchInput');
  const resultFilterInput = document.getElementById('resultFilterInput');
  const filtersToggleBtn = document.getElementById('filtersToggleBtn');
  const filterBox = document.getElementById('filterBox');
  
  if (searchBtn) {
    searchBtn.addEventListener('click', handleSearchClick);
  }
  
  if (closeBtn) {
    closeBtn.addEventListener('click', closeSearchModal);
  }
  
  if (modal) {
    // Close modal when clicking outside the modal content
    modal.addEventListener('click', function(e) {
      if (e.target === modal) {
        closeSearchModal();
      }
    });
  }
  
  // Allow Enter key to search
  if (searchInput) {
    searchInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        handleSearchClick(e);
      }
    });
  }
  
  // Add event listener for modal search input changes
  if (resultFilterInput) {
    let searchTimeout;
    resultFilterInput.addEventListener('input', function(e) {
      clearTimeout(searchTimeout);
      // Debounce search to avoid excessive searches while typing
      searchTimeout = setTimeout(function() {
        handleModalSearchChange(e);
      }, 300);
    });
  }
  
  // Add event listener for filters toggle button
  if (filtersToggleBtn && filterBox) {
    filtersToggleBtn.addEventListener('click', function(e) {
      e.preventDefault();
      filterBox.style.display = filterBox.style.display === 'none' ? 'block' : 'none';
    });
  }
  
  // Add event listeners for all filter checkboxes
  const checkboxes = [
    'excludeAlbums',
    'excludeSongs',
    'excludeTitles',
    'excludeSummary',
    'excludeLyrics',
    'excludeConnections',
    'excludeExtended',
    'excludeMetadata'
  ];
  
  checkboxes.forEach(checkboxId => {
    const checkbox = document.getElementById(checkboxId);
    if (checkbox) {
      checkbox.addEventListener('change', applyResultsFilter);
    }
  });
}
