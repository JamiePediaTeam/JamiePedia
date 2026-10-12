(function () {
  const ARTIST_CREDIT_FIELDS = [
    { key: 'artists', label: 'Artist' },
    { key: 'vocalists', label: 'Vocalist' },
    { key: 'mixing', label: 'Mixing' },
    { key: 'mastering', label: 'Mastering' },
    { key: 'instrumentals', label: 'Instrumentals' }
  ];

  function splitValues(value) {
    return String(value || '')
      .split(/\s*\|\s*/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function getArtistSlugFromLocation() {
    const parts = String(window.location.pathname || '').split('/').filter(Boolean);
    return String(parts[parts.length - 1] || '').replace(/\.html$/i, '').trim().toLowerCase();
  }

  function getArtistHashTokenFromLocation() {
    return String(window.location.hash || '')
      .trim()
      .replace(/^#/, '')
      .toLowerCase();
  }

  function normalizeArtistVariantToken(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/^#/, '')
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
  }

  function formatArtistVariantLabel(token) {
    const normalized = normalizeArtistVariantToken(token);
    if (!normalized) {
      return 'Original';
    }

    return normalized
      .split('-')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  function buildArtistVariantEntries(directory, page) {
    const pages = directory && Array.isArray(directory.pages) ? directory.pages : [];
    const slug = String((page && page.slug) || '').trim().toLowerCase();
    if (!slug) {
      return [];
    }

    const byToken = new Map();
    pages.forEach((entry) => {
      if (!entry || entry.hasPage === false) {
        return;
      }

      const entrySlug = String(entry.slug || '').trim().toLowerCase();
      if (!entrySlug || entrySlug !== slug) {
        return;
      }

      const token = normalizeArtistVariantToken(entry.pageHashToken || '');
      if (!byToken.has(token)) {
        byToken.set(token, entry);
      }
    });

    return Array.from(byToken.entries()).map(([token, entry]) => ({ token, page: entry }));
  }

  function getArtistVariantPagesForSlug(directory, slug) {
    const pages = directory && Array.isArray(directory.pages) ? directory.pages : [];
    const normalizedSlug = String(slug || '').trim().toLowerCase();
    if (!normalizedSlug) {
      return [];
    }

    return pages.filter((entry) => {
      if (!entry || entry.hasPage === false) {
        return false;
      }

      return String(entry.slug || '').trim().toLowerCase() === normalizedSlug;
    });
  }

  function buildArtistDisplayProfile(directory, page) {
    const variants = getArtistVariantPagesForSlug(directory, page && page.slug);
    const hasMultipleVariants = variants.length > 1;
    const isFirstVariant = hasMultipleVariants && variants[0] === page;

    const names = (Array.isArray(page && page.names) ? page.names : [])
      .map((name) => String(name || '').trim())
      .filter(Boolean);

    const uniqueNames = [];
    const seen = new Set();
    names.forEach((name) => {
      const key = name.toLowerCase();
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      uniqueNames.push(name);
    });

    const fallbackName = String(page && page.primaryName ? page.primaryName : '').trim() || 'Artist';
    const promotedName = isFirstVariant && uniqueNames.length > 1 ? uniqueNames[1] : '';
    const titleName = promotedName || uniqueNames[0] || fallbackName;

    const aliasStartIndex = isFirstVariant && uniqueNames.length > 1 ? 2 : 1;
    const aliasNames = uniqueNames.slice(aliasStartIndex);

    return {
      titleName,
      aliasNames
    };
  }

  function renderArtistVariantTabs(directory, page, activeHashToken) {
    const tabsContainer = document.querySelector('.artist-tabs');
    if (!tabsContainer) {
      return;
    }

    tabsContainer.querySelectorAll('.artist-version-tab').forEach((node) => node.remove());

    const entries = buildArtistVariantEntries(directory, page);
    if (entries.length <= 1) {
      return;
    }

    const spacer = tabsContainer.querySelector('.tabs-spacer');
    const insertBeforeNode = spacer ? spacer.nextSibling : null;
    const activeToken = normalizeArtistVariantToken(activeHashToken || page.pageHashToken || '');

    entries.forEach((entry) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'version-tab artist-version-tab' + (entry.token === activeToken ? ' active' : '');
      button.textContent = formatArtistVariantLabel(entry.token);

      button.addEventListener('click', function () {
        if (entry.token === activeToken) {
          return;
        }

        const targetRoute = '/artists/' + page.slug + (entry.token ? ('#' + entry.token) : '');
        const targetHref = typeof window.toSiteHref === 'function'
          ? window.toSiteHref(targetRoute)
          : targetRoute;

        if (window.history && typeof window.history.pushState === 'function') {
          window.history.pushState({}, '', targetHref);
          renderArtistPage();
        } else {
          window.location.href = targetHref;
        }
      });

      if (insertBeforeNode) {
        tabsContainer.insertBefore(button, insertBeforeNode);
      } else {
        tabsContainer.appendChild(button);
      }
    });
  }

  function pathIdToSongHref(rawPath) {
    const source = String(rawPath || '').trim();
    if (!source) {
      return '';
    }

    const base = source.split('#')[0].split('?')[0].trim();
    const slug = base.split('/').filter(Boolean).pop() || '';
    return slug ? '/music/' + slug.replace(/\.html$/i, '') : '';
  }

  function buildAcceptedArtistTokens(page) {
    const accepted = new Set();

    (page && Array.isArray(page.ids) ? page.ids : []).forEach((value) => {
      const normalized = String(value || '').trim().toLowerCase();
      if (normalized) {
        accepted.add(normalized);
      }
    });

    (page && Array.isArray(page.names) ? page.names : []).forEach((value) => {
      const normalized = String(value || '').trim().toLowerCase();
      if (normalized) {
        accepted.add(normalized);
      }
    });

    (page && Array.isArray(page.aliases) ? page.aliases : []).forEach((alias) => {
      const normalizedName = String(alias && alias.name ? alias.name : '').trim().toLowerCase();
      if (normalizedName) {
        accepted.add(normalizedName);
      }
      const normalizedId = String(alias && alias.id ? alias.id : '').trim().toLowerCase();
      if (normalizedId) {
        accepted.add(normalizedId);
      }
    });

    const primaryName = String(page && page.primaryName ? page.primaryName : '').trim().toLowerCase();
    if (primaryName) {
      accepted.add(primaryName);
    }

    return accepted;
  }

  function rolesForRow(row, page) {
    const acceptedIds = buildAcceptedArtistTokens(page);
    const roles = [];

    const hasAcceptedMention = (value) => {
      const source = String(value || '');
      const normalizedSource = source.toLowerCase();
      if (!normalizedSource) {
        return false;
      }

      const isBoundary = (char) => !char || !/[A-Za-z0-9]/.test(char);
      for (const token of acceptedIds) {
        if (!token) {
          continue;
        }

        let index = normalizedSource.indexOf(token);
        while (index !== -1) {
          const end = index + token.length;
          if (isBoundary(source[index - 1] || '') && isBoundary(source[end] || '')) {
            return true;
          }
          index = normalizedSource.indexOf(token, index + 1);
        }
      }

      return false;
    };

    ARTIST_CREDIT_FIELDS.forEach((field) => {
      const values = splitValues((row || {})[field.key] || '');
      if (values.some((value) => hasAcceptedMention(value))) {
        roles.push(field.label);
      }
    });

    return roles;
  }

  function renderSummaryParagraphs(text) {
    const blocks = String(text || '')
      .trim()
      .split(/\n\s*\n/)
      .map((block) => block.trim())
      .filter(Boolean);

    if (!blocks.length) {
      return '';
    }

    return blocks.map((block) => {
      const lines = block.split(/\n/).map((line) => escapeHtml(line.trim())).join('<br>');
      return '<p>' + lines + '</p>';
    }).join('');
  }

  function renderArtistLinks(container, links) {
    if (!container) {
      return;
    }

    container.innerHTML = '';
    (Array.isArray(links) ? links : []).forEach((entry) => {
      if (!entry || !entry.label || !entry.href) {
        return;
      }

      const anchor = document.createElement('a');
      anchor.textContent = entry.label;
      anchor.href = entry.href;
      if (/^https?:/i.test(entry.href)) {
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
      }
      container.appendChild(anchor);
    });
  }

  function createInfoBlock(label, html) {
    if (!html) {
      return null;
    }

    const block = document.createElement('div');
    block.className = 'song-info-block';

    const labelNode = document.createElement('div');
    labelNode.className = 'song-info-label';
    labelNode.textContent = label;

    const contentNode = document.createElement('div');
    contentNode.className = 'song-info-content';
    contentNode.innerHTML = html;

    block.appendChild(labelNode);
    block.appendChild(contentNode);
    return block;
  }

  function populateArtistInfoSidebar(page, primaryAlias, displayProfile) {
    const sidebar = document.querySelector('.artist-info-sidebar');
    if (!sidebar) {
      return;
    }

    const descriptionBlock = sidebar.querySelector('.artist-description-block');
    const aliases = Array.isArray(displayProfile && displayProfile.aliasNames)
      ? displayProfile.aliasNames.filter(Boolean)
      : [];

    if (descriptionBlock) {
      descriptionBlock.style.display = aliases.length ? '' : 'none';
    }

    const summaryBits = [];
    if (aliases.length > 1) {
      summaryBits.push('<p id="artistPageAliases" class="artist-page-aliases">Also credited as: ' + escapeHtml(aliases.join(' / ')) + '</p>');
    } else if (aliases.length === 1) {
      summaryBits.push('<p id="artistPageAliases" class="artist-page-aliases">Also credited as: ' + escapeHtml(aliases[0]) + '</p>');
    }

    if (descriptionBlock) {
      const descriptionContent = descriptionBlock.querySelector('.song-info-content');
      if (descriptionContent) {
        descriptionContent.innerHTML = summaryBits.join('');
      }
    }

    const linksNode = document.getElementById('artistPageLinks');
    renderArtistLinks(linksNode, page.links || []);
  }

  function getArtistTabStateKey(page) {
    const slug = String((page && page.slug) || getArtistSlugFromLocation() || '').trim().toLowerCase();
    return slug || 'artist';
  }

  function getStoredArtistTab(page) {
    const key = getArtistTabStateKey(page);
    const state = window.__artistTabState || (window.__artistTabState = Object.create(null));
    const stored = String(state[key] || '').trim().toLowerCase();
    return stored === 'summary' || stored === 'credits' ? stored : null;
  }

  function setStoredArtistTab(page, tabName) {
    const key = getArtistTabStateKey(page);
    const state = window.__artistTabState || (window.__artistTabState = Object.create(null));
    const safeName = tabName === 'summary' || tabName === 'credits' ? tabName : 'credits';
    state[key] = safeName;
  }

  function ensureArtistSummaryTabState(page, summaryText, primaryDescription) {
    const tabsContainer = document.querySelector('.artist-tabs');
    const leftView = document.querySelector('.artist-leftview');
    const hasSummary = Boolean(String(summaryText || primaryDescription || '').trim());

    if (!hasSummary) {
      const summaryTab = tabsContainer ? tabsContainer.querySelector('.artist-tab[data-artist-tab="summary"]') : null;
      const summaryPanel = leftView ? leftView.querySelector('[data-artist-panel="summary"]') : null;
      if (summaryTab) {
        summaryTab.remove();
      }
      if (summaryPanel) {
        summaryPanel.remove();
      }
      setStoredArtistTab(page, 'credits');
      return false;
    }

    const creditsTab = tabsContainer ? tabsContainer.querySelector('.artist-tab[data-artist-tab="credits"]') : null;
    let summaryTab = tabsContainer ? tabsContainer.querySelector('.artist-tab[data-artist-tab="summary"]') : null;
    const creditsPanel = leftView ? leftView.querySelector('[data-artist-panel="credits"]') : null;
    let summaryPanel = leftView ? leftView.querySelector('[data-artist-panel="summary"]') : null;

    if (!summaryTab && tabsContainer) {
      summaryTab = document.createElement('button');
      summaryTab.type = 'button';
      summaryTab.className = 'song-tab artist-tab';
      summaryTab.setAttribute('data-artist-tab', 'summary');
      summaryTab.textContent = 'Summary';
      if (creditsTab && creditsTab.parentNode === tabsContainer) {
        tabsContainer.insertBefore(summaryTab, creditsTab.nextSibling);
      } else {
        tabsContainer.appendChild(summaryTab);
      }
    }

    if (!summaryPanel && leftView) {
      summaryPanel = document.createElement('section');
      summaryPanel.className = 'song-content artist-content';
      summaryPanel.setAttribute('data-artist-panel', 'summary');
      const content = document.createElement('div');
      content.id = 'artistSummaryContent';
      content.className = 'artist-summary-content';
      summaryPanel.appendChild(content);
      if (creditsPanel && creditsPanel.parentNode === leftView) {
        leftView.insertBefore(summaryPanel, creditsPanel.nextSibling);
      } else {
        leftView.appendChild(summaryPanel);
      }
    }

    return true;
  }

  function initializeArtistTabs(page) {
    const tabs = Array.from(document.querySelectorAll('.artist-tab'));
    const panels = Array.from(document.querySelectorAll('[data-artist-panel]'));
    if (!tabs.length || !panels.length) {
      return;
    }

    const setActiveTab = (tabName) => {
      const safeTabName = tabName === 'summary' || tabName === 'credits' ? tabName : 'credits';
      tabs.forEach((tab) => {
        tab.classList.toggle('active', tab.getAttribute('data-artist-tab') === safeTabName);
      });
      panels.forEach((panel) => {
        panel.classList.toggle('artist-content-active', panel.getAttribute('data-artist-panel') === safeTabName);
      });
      if (page) {
        setStoredArtistTab(page, safeTabName);
      }
    };

    tabs.forEach((tab) => {
      if (tab.dataset.artistTabBound === 'true') {
        return;
      }
      tab.dataset.artistTabBound = 'true';
      tab.addEventListener('click', function () {
        const nextTab = tab.getAttribute('data-artist-tab') || 'credits';
        setActiveTab(nextTab);
      });
    });

    const storedTab = page ? getStoredArtistTab(page) : null;
    const preferredTab = storedTab || (tabs[0] && tabs[0].getAttribute('data-artist-tab')) || 'credits';
    const usableTab = tabs.some((tab) => tab.getAttribute('data-artist-tab') === preferredTab)
      ? preferredTab
      : (tabs[0] && tabs[0].getAttribute('data-artist-tab')) || 'credits';
    setActiveTab(usableTab);
  }

  function buildArtistImageOptions(page, primaryAlias) {
    const imagePaths = Array.isArray(page && page.imagePaths) ? page.imagePaths.filter(Boolean) : [];
    const labels = Array.isArray(page && page.imageLabels) ? page.imageLabels : [];
    const options = [];

    imagePaths.forEach((imagePath, index) => {
      const label = String(labels[index] || labels[0] || ('Image ' + String(index + 1))).trim();
      if (!imagePath) {
        return;
      }
      options.push({
        src: imagePath,
        label: label || ('Image ' + String(index + 1))
      });
    });

    if (!options.length && primaryAlias && primaryAlias.image) {
      options.push({
        src: primaryAlias.image,
        label: String(primaryAlias.imageLabel || 'Image').trim() || 'Image'
      });
    }

    return options;
  }

  function applyArtistPageImage(imageNode, options, index, tabsRoot, titleText) {
    if (!imageNode || !Array.isArray(options) || !options.length) {
      return;
    }

    const safeIndex = Math.max(0, Math.min(index, options.length - 1));
    const active = options[safeIndex];

    imageNode.style.display = '';
    imageNode.src = active.src;
    imageNode.alt = titleText ? (titleText + ' - ' + active.label) : active.label;

    if (tabsRoot) {
      tabsRoot.querySelectorAll('.album-tab').forEach((tab, tabIndex) => {
        tab.classList.toggle('active', tabIndex === safeIndex);
      });
    }
  }

  function renderArtistImageTabs(page, primaryAlias, titleOverride) {
    const imageNode = document.getElementById('artistPageImage');
    if (!imageNode) {
      return;
    }

    const tabsContainer = document.getElementById('artistImageTabsContainer');
    const tabsRoot = document.getElementById('artistImageTabs');
    const options = buildArtistImageOptions(page, primaryAlias);
    const titleText = String(titleOverride || (primaryAlias && primaryAlias.name) || (page && page.primaryName) || 'Artist').trim();

    if (!options.length) {
      imageNode.style.display = 'none';
      if (tabsRoot) {
        tabsRoot.innerHTML = '';
      }
      if (tabsContainer) {
        tabsContainer.style.display = 'none';
      }
      return;
    }

    applyArtistPageImage(imageNode, options, 0, tabsRoot, titleText);

    if (!tabsRoot || !tabsContainer) {
      return;
    }

    tabsRoot.innerHTML = '';
    if (options.length <= 1) {
      tabsContainer.style.display = 'none';
      return;
    }

    tabsContainer.style.display = '';
    options.forEach((option, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'album-tab' + (index === 0 ? ' active' : '');
      button.textContent = option.label;
      button.addEventListener('click', function () {
        applyArtistPageImage(imageNode, options, index, tabsRoot, titleText);
      });
      tabsRoot.appendChild(button);
    });
  }

  function renderRelatedList(container, items) {
    if (!container) {
      return false;
    }

    container.innerHTML = '';
    if (!Array.isArray(items) || items.length === 0) {
      return false;
    }

    items.forEach((item) => {
      const article = document.createElement('article');
      article.className = 'artist-related-item';

      const link = document.createElement('a');
      link.href = item.href;
      link.textContent = item.title;
      article.appendChild(link);

      if (item.meta) {
        const meta = document.createElement('div');
        meta.className = 'artist-related-meta';
        meta.textContent = item.meta;
        article.appendChild(meta);
      }

      container.appendChild(article);
    });

    return true;
  }

  function loadArtistSummaryText(slug) {
    const candidates = [
      '../../public/artists/summaries/' + slug + '.txt',
      '../../public/artists/' + slug + '.txt',
      '../../public/summaries/' + slug + '.txt'
    ];

    return candidates.reduce((promise, path) => {
      return promise.then((result) => {
        if (result) {
          return result;
        }

        return fetch(path, { cache: 'no-store' })
          .then((response) => response.ok ? response.text() : '')
          .then((text) => String(text || '').trim())
          .catch(() => '');
      });
    }, Promise.resolve(''));
  }

  function ensureSongRows() {
    return new Promise((resolve) => {
      if (Array.isArray(window.__songSidebarCsvRows) && window.__songSidebarCsvRows.length > 0) {
        resolve(window.__songSidebarCsvRows);
        return;
      }

      ensureSongSidebarCsvLoaded(function (rows) {
        resolve(Array.isArray(rows) ? rows : []);
      });
    });
  }

  function ensureAlbumRows() {
    return new Promise((resolve) => {
      if (typeof ensureAlbumsCsvLoaded !== 'function') {
        resolve([]);
        return;
      }

      ensureAlbumsCsvLoaded(function (rows) {
        resolve(Array.isArray(rows) ? rows : []);
      });
    });
  }

  function splitCoverArtistCsvLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      const nextChar = line[index + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"';
          index += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (char === ',' && !inQuotes) {
        values.push(current);
        current = '';
        continue;
      }

      current += char;
    }

    values.push(current);
    return values.map((value) => String(value || '').trim());
  }

  function parseCoverArtistCsv(text) {
    const map = Object.create(null);
    const lines = String(text || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length < 2) {
      return map;
    }

    const headers = splitCoverArtistCsvLine(lines[0]).map((header) => header.toLowerCase());
    const filenameIndex = headers.indexOf('filename');
    const creditIndex = headers.indexOf('credit');
    if (filenameIndex === -1 || creditIndex === -1) {
      return map;
    }

    for (let index = 1; index < lines.length; index += 1) {
      const values = splitCoverArtistCsvLine(lines[index]);
      const filename = String(values[filenameIndex] || '').trim().toLowerCase();
      const credit = String(values[creditIndex] || '').trim();
      if (!filename || !credit) {
        continue;
      }
      map[filename] = credit;
    }

    return map;
  }

  function ensureCoverArtistMap() {
    return fetch('../../public/csv/JamiePedia Data - Cover Artists.csv', { cache: 'no-store' })
      .then((response) => response.ok ? response.text() : '')
      .then((text) => parseCoverArtistCsv(text))
      .catch(() => Object.create(null));
  }

  function getSongCoverArtistRoles(row, page, coverArtistMap) {
    const acceptedTokens = buildAcceptedArtistTokens(page);
    const seenCredits = new Set();
    const artPaths = splitValues((row && (row.album_art_paths || row.album_art)) || '');

    for (const artPath of artPaths) {
      const filename = String(artPath || '').split('/').pop().trim().toLowerCase();
      if (!filename || seenCredits.has(filename)) {
        continue;
      }
      seenCredits.add(filename);

      const credit = String((coverArtistMap || Object.create(null))[filename] || '').trim();
      if (!credit) {
        continue;
      }

      const creditTokens = credit
        .split(/\s*,\s*/)
        .map((value) => String(value || '').trim().toLowerCase())
        .filter(Boolean);

      if (creditTokens.some((token) => acceptedTokens.has(token))) {
        return ['Cover Artist'];
      }
    }

    return [];
  }

  function buildSongItems(page, rows, coverArtistMap) {
    const itemsByHref = new Map();
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      const href = pathIdToSongHref(row.page_path || row.path_id || row.path || '');
      const title = String((row || {}).page_title || '').trim();
      if (!href || !title) {
        return;
      }

      const roles = rolesForRow(row, page).concat(getSongCoverArtistRoles(row, page, coverArtistMap));
      if (!roles.length) {
        return;
      }

      if (!itemsByHref.has(href)) {
        itemsByHref.set(href, {
          href,
          title,
          roles: new Set()
        });
      }

      roles.forEach((role) => itemsByHref.get(href).roles.add(role));
    });

    return Array.from(itemsByHref.values()).map((item) => ({
      href: item.href,
      title: item.title,
      meta: Array.from(item.roles).join(', ')
    }));
  }

  function buildAlbumItems(page, rows) {
    const items = [];
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      const albumId = String((row || {}).album_id || '').trim().toLowerCase();
      const title = String((row || {}).album_title || '').trim();
      if (!albumId || !title) {
        return;
      }

      const roles = rolesForRow(row, page);
      if (!roles.length) {
        return;
      }

      items.push({
        href: '/music/' + albumId,
        title,
        meta: Array.from(new Set(roles)).join(', ')
      });
    });
    return items;
  }

  function applyArtistDocumentState(page, description, titleOverride) {
    const title = String(titleOverride || (page && page.primaryName ? page.primaryName : 'Artist')).trim() || 'Artist';
    document.title = title;

    const titleMeta = document.querySelector('meta[name="title"]');
    if (titleMeta) {
      titleMeta.setAttribute('content', title);
    }

    const descriptionText = String(description || '').trim() || 'Artist and vocalist page for JamiePedia collaborators.';
    const descriptionMeta = document.querySelector('meta[name="description"]');
    if (descriptionMeta) {
      descriptionMeta.setAttribute('content', descriptionText);
    }

    if (page && page.theme && typeof window.requestThemeById === 'function') {
      window.requestThemeById(page.theme);
    } else if (page && page.theme && typeof window.applyThemeById === 'function') {
      window.applyThemeById(page.theme);
    }
  }

  function buildAlsoKnownAsText(aliasNames) {
    const aliases = Array.isArray(aliasNames)
      ? aliasNames
        .map((name) => String(name || '').trim())
        .filter(Boolean)
      : [];

    if (!aliases.length) {
      return '';
    }

    return 'Also known as: ' + aliases.join(' / ');
  }

  function renderArtistPage() {
    if (typeof ensureArtistDirectoryLoaded !== 'function') {
      return;
    }

    const slug = getArtistSlugFromLocation();
    const hashToken = getArtistHashTokenFromLocation();
    ensureArtistDirectoryLoaded().then(function (directory) {
      const page = getArtistPageEntryBySlug(slug, hashToken);
      if (!page) {
        return;
      }

      const displayProfile = buildArtistDisplayProfile(directory, page);

      renderArtistVariantTabs(directory, page, hashToken);

      const primaryAlias = (page.aliases || [])[0] || null;
      const primaryDescription = primaryAlias && primaryAlias.description ? primaryAlias.description : '';

      initializeArtistTabs(page);

      applyArtistDocumentState(page, primaryDescription, displayProfile.titleName);
      document.documentElement.style.setProperty('--artist-accent', primaryAlias && primaryAlias.color ? primaryAlias.color : '#F05E55');

      const nameNode = document.getElementById('artistPageName');
      const typeNode = document.getElementById('artistPageType');

      if (nameNode) {
        nameNode.textContent = displayProfile.titleName || page.primaryName || 'Artist';
      }
      if (typeNode) {
        const aliasText = buildAlsoKnownAsText(displayProfile.aliasNames);
        typeNode.textContent = aliasText;
        typeNode.style.display = aliasText ? '' : 'none';
      }
      renderArtistImageTabs(page, primaryAlias, displayProfile.titleName);

      populateArtistInfoSidebar(page, primaryAlias, displayProfile);
      if (typeof window.initializeDataNavButtons === 'function') {
        window.initializeDataNavButtons();
      }

      if (typeof window.releaseThemeGate === 'function') {
        window.releaseThemeGate();
      }

      Promise.all([
        loadArtistSummaryText(page.slug),
        ensureSongRows(),
        ensureAlbumRows(),
        ensureCoverArtistMap()
      ]).then(function (results) {
        const summaryText = results[0];
        const songRows = results[1];
        const albumRows = results[2];
        const coverArtistMap = results[3];

        const hasSummaryContent = ensureArtistSummaryTabState(page, summaryText, primaryDescription);
        const summaryNode = document.getElementById('artistSummaryContent');
        if (summaryNode) {
          const summaryHtml = renderSummaryParagraphs(summaryText || primaryDescription);
          summaryNode.innerHTML = summaryHtml || '<div class="artist-empty-box">This artist has no summary yet.</div>';
        }

        if (!hasSummaryContent) {
          initializeArtistTabs(page);
        }

        const songItems = buildSongItems(page, songRows, coverArtistMap);
        const albumItems = buildAlbumItems(page, albumRows);
        const hasSongCredits = renderRelatedList(document.getElementById('artistSongsList'), songItems);
        const hasAlbumCredits = renderRelatedList(document.getElementById('artistAlbumsList'), albumItems);
        const hasAnyCredits = hasSongCredits || hasAlbumCredits;

        const songsSection = document.getElementById('artistSongsSection');
        if (songsSection) {
          songsSection.hidden = !hasSongCredits;
        }

        const albumsSection = document.getElementById('artistAlbumsSection');
        if (albumsSection) {
          albumsSection.hidden = !hasAlbumCredits;
        }

        const emptyCreditsNode = document.getElementById('artistCreditsEmpty');
        if (emptyCreditsNode) {
          emptyCreditsNode.hidden = hasAnyCredits;
        }
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderArtistPage, { once: true });
  } else {
    renderArtistPage();
  }

  window.addEventListener('hashchange', renderArtistPage);
}());