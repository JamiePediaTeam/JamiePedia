(function () {
  const pathname = window.location.pathname || '/';
  const basePath = pathname.includes('/JamiePedia/') ? '/JamiePedia' : '';

  function toRelativePath(path) {
    let normalized = String(path || '/');
    if (!normalized.startsWith('/')) {
      normalized = '/' + normalized;
    }

    if (basePath && normalized === basePath) {
      return '/';
    }

    if (basePath && normalized.startsWith(basePath + '/')) {
      return normalized.slice(basePath.length) || '/';
    }

    return normalized;
  }

  function withBasePath(path) {
    let normalized = String(path || '/');
    if (!normalized.startsWith('/')) {
      normalized = '/' + normalized;
    }

    if (!basePath) {
      return normalized;
    }

    if (normalized === '/') {
      return basePath + '/';
    }

    if (normalized === basePath || normalized.startsWith(basePath + '/')) {
      return normalized;
    }

    return basePath + normalized;
  }

  function getSongSlugFromRoute() {
    const relativePath = toRelativePath(window.location.pathname || '/');
    const normalized = relativePath.split('?')[0].split('#')[0].replace(/\.html$/i, '').replace(/\/index$/i, '');
    const match = normalized.match(/^\/music\/([^/]+)\/close-up\/?$/i);
    return match ? String(match[1] || '').trim().toLowerCase() : '';
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function slugToTitle(slug) {
    return String(slug || '')
      .split('-')
      .filter(Boolean)
      .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
      .join(' ');
  }

  async function fetchText(path) {
    try {
      const response = await fetch(path, { cache: 'no-store' });
      if (!response.ok) {
        return '';
      }
      return await response.text();
    } catch (_error) {
      return '';
    }
  }

  function parseMediaToken(value) {
    const token = String(value || '').trim();
    if (!token.startsWith('[') || !token.endsWith(']')) {
      return null;
    }

    const inner = token.slice(1, -1).trim();
    if (!inner) {
      return null;
    }

    if (/^https?:\/\//i.test(inner) && /(youtube\.com\/watch\?|youtu\.be\/)/i.test(inner)) {
      return { kind: 'youtube', url: inner };
    }

    if (/^https?:\/\//i.test(inner) && /\.bandcamp\.com\/(track|album)\//i.test(inner)) {
      return { kind: 'bandcamp', url: inner };
    }

    const fileName = inner;
    const lowerName = fileName.toLowerCase();
    if (/\.(mp3|wav|ogg|m4a|flac)$/i.test(lowerName)) {
      return { kind: 'audio', fileName };
    }

    if (/\.(mp4|webm|ogg)$/i.test(lowerName)) {
      return { kind: 'video', fileName };
    }

    if (/\.(png|jpg|jpeg|gif|webp)$/i.test(lowerName)) {
      return { kind: 'image', fileName };
    }

    return null;
  }

  function isDividerLine(value) {
    return /^[-_—]{3,}$/.test(String(value || '').trim());
  }

  function parseMarkdownHeading(value) {
    const match = String(value || '').match(/^(#{1,6})\s+(.+)$/);
    if (!match) {
      return null;
    }

    return {
      level: match[1].length,
      text: String(match[2] || '').trim()
    };
  }

  function parseMarkdownSubtext(value) {
    const match = String(value || '').match(/^-(#{1,6})\s+(.+)$/);
    if (!match) {
      return null;
    }

    return {
      level: match[1].length,
      text: String(match[2] || '').trim()
    };
  }

  function parseInlineMediaFileNames(value) {
    const tokens = String(value || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (tokens.length === 0) {
      return [];
    }

    const cleanedTokens = tokens.map((token) => {
      let cleaned = String(token || '').trim().replace(/[),.;:!?]+$/g, '');
      while (cleaned.startsWith('(') || cleaned.startsWith('[') || cleaned.startsWith('{')) {
        cleaned = cleaned.slice(1);
      }
      while (cleaned.endsWith(')') || cleaned.endsWith(']') || cleaned.endsWith('}')) {
        cleaned = cleaned.slice(0, -1);
      }
      return cleaned;
    }).filter(Boolean);

    const matches = cleanedTokens.filter((cleaned) => {
      return /\.(png|jpg|jpeg|gif|webp|mp4|webm|mp3|wav|m4a|flac|ogg)$/i.test(cleaned);
    });

    if (matches.length === 0) {
      return [];
    }

    if (matches.length !== cleanedTokens.length) {
      return [];
    }

    return matches;
  }

  function normalizeLooseText(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  }

  function getSongImageQueue(slug, manifest) {
    const entries = manifest && manifest.assets && Array.isArray(manifest.assets.images)
      ? manifest.assets.images
      : [];

    if (!slug || entries.length === 0) {
      return [];
    }

    const slugTokens = String(slug)
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= 4);
    const normalizedSlug = normalizeLooseText(slug);

    const scored = entries.map((entry, index) => {
      const name = String((entry || {}).name || '');
      const normalizedName = normalizeLooseText(name);
      let score = 0;

      if (normalizedSlug && normalizedName.includes(normalizedSlug)) {
        score += 100;
      }

      slugTokens.forEach((token) => {
        if (normalizedName.includes(token)) {
          score += 20;
        }
      });

      if (/^c+colors\d*/i.test(name)) {
        score += 10;
      }

      return { entry, index, score };
    });

    const positive = scored.filter((item) => item.score > 0);
    const target = positive.length > 0 ? positive : scored;
    return target
      .sort((a, b) => (b.score - a.score) || (a.index - b.index))
      .map((item) => item.entry);
  }

  function resolveMediaPath(fileName, kind, manifest) {
    const section = kind === 'video' ? 'videos' : (kind === 'audio' ? 'audio' : 'images');
    const entries = manifest && manifest.assets && Array.isArray(manifest.assets[section])
      ? manifest.assets[section]
      : [];

    const direct = entries.find((entry) => String((entry || {}).name || '') === fileName);
    if (direct && direct.path) {
      return withBasePath(direct.path);
    }

    const candidates = [
      kind === 'video' ? '/public/close ups/videos/' : (kind === 'audio' ? '/public/close ups/audio/' : '/public/close ups/images/'),
      kind === 'video' ? '/public/videos/' : (kind === 'audio' ? '/public/audio/' : '/public/images/')
    ];

    return withBasePath(candidates[0] + fileName);
  }

  function hasManifestMediaEntry(fileName, kind, manifest) {
    if (!manifest || !manifest.assets || !manifest.assets[sectionForKind(kind)]) {
      return true;
    }

    const section = sectionForKind(kind);
    const entries = Array.isArray(manifest.assets[section]) ? manifest.assets[section] : [];

    if (entries.length === 0) {
      return true;
    }

    return entries.some((entry) => String((entry || {}).name || '') === String(fileName || ''));
  }

  function sectionForKind(kind) {
    if (kind === 'video') {
      return 'videos';
    }
    if (kind === 'audio') {
      return 'audio';
    }
    return 'images';
  }

  function toYouTubeEmbedUrl(rawUrl) {
    const source = String(rawUrl || '').trim();
    if (!source) {
      return '';
    }

    try {
      const parsed = new URL(source);
      if (parsed.hostname.includes('youtu.be')) {
        const id = parsed.pathname.replace(/^\/+/, '').split('/')[0] || '';
        return id ? 'https://www.youtube.com/embed/' + id : '';
      }

      if (parsed.hostname.includes('youtube.com')) {
        if (parsed.pathname === '/watch') {
          const id = parsed.searchParams.get('v') || '';
          return id ? 'https://www.youtube.com/embed/' + id : '';
        }
        const parts = parsed.pathname.split('/').filter(Boolean);
        const embedIndex = parts.indexOf('embed');
        if (embedIndex !== -1 && parts[embedIndex + 1]) {
          return 'https://www.youtube.com/embed/' + parts[embedIndex + 1];
        }
      }
    } catch (_error) {
      return '';
    }

    return '';
  }

  function smartJoinWrappedLines(lines) {
    const parts = (Array.isArray(lines) ? lines : [])
      .map((line) => String(line || '').trim())
      .filter(Boolean);

    if (parts.length === 0) {
      return '';
    }

    let combined = parts[0];
    for (let index = 1; index < parts.length; index += 1) {
      const next = parts[index];

      if (combined.endsWith('-') && /^[a-z]/.test(next)) {
        combined = combined.slice(0, -1) + next;
        continue;
      }

      if (/^[,.;:!?)]/.test(next)) {
        combined += next;
        continue;
      }

      combined += ' ' + next;
    }

    return combined.replace(/\s+/g, ' ').trim();
  }

  function isLikelyBareLinkLine(value) {
    const text = String(value || '').trim();
    if (!text) {
      return false;
    }

    if (/^https?:\/\//i.test(text)) {
      return true;
    }

    return /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+(?:\/[\w\-./?%&=+#~:]*)?$/i.test(text);
  }

  function shouldMergeWrappedLine(previousLine, currentLine) {
    const prev = String(previousLine || '').trim();
    const next = String(currentLine || '').trim();
    if (!prev || !next) {
      return false;
    }

    const prevLength = prev.length;

    if (prevLength >= 58) {
      return true;
    }

    if (/[,:;\-]$/.test(prev)) {
      return true;
    }

    if (!/[.!?"')\]]$/.test(prev)) {
      return true;
    }

    if (/^[a-z0-9'"(\[]/.test(next)) {
      return true;
    }

    return false;
  }

  function isShortStandaloneLine(value, previousLine) {
    const text = String(value || '').trim();
    const prev = String(previousLine || '').trim();
    if (!text) {
      return false;
    }

    if (text.length > 34) {
      return false;
    }

    // Only keep short lines as standalone when they follow a dramatic lead-in,
    // so hard-wrapped fragments like "break shit" stay in the paragraph.
    if (!/(\.{3,}|[!?])$/.test(prev)) {
      return false;
    }

    if (/[.!?]$/.test(text)) {
      return true;
    }

    return text.split(/\s+/).length <= 5;
  }

  function convertInlineFormatting(text) {
    let html = escapeHtml(String(text || ''));

    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, function (_match, label, url) {
      return '<a href="' + url.replace(/"/g, '%22') + '" target="_blank" rel="noopener noreferrer">' + label + '</a>';
    });

    html = html.replace(/(^|\s)(https?:\/\/[^\s<]+)/g, function (_match, prefix, url) {
      return prefix + '<a href="' + url.replace(/"/g, '%22') + '" target="_blank" rel="noopener noreferrer">' + url + '</a>';
    });

    html = html.replace(/(^|\s)([a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+(?:\/[\w\-./?%&=+#~:]*)?)/gi, function (match, prefix, domain) {
      const normalizedDomain = String(domain || '').trim();
      if (/^https?:\/\//i.test(normalizedDomain)) {
        return match;
      }

      if (!normalizedDomain.includes('.')) {
        return match;
      }

      const href = 'https://' + normalizedDomain;
      return prefix + '<a href="' + href.replace(/"/g, '%22') + '" target="_blank" rel="noopener noreferrer">' + normalizedDomain + '</a>';
    });

    return html;
  }

  function extractThemeTag(text) {
    const lines = String(text || '').split(/\r?\n/);
    let firstNonEmptyIndex = -1;

    for (let index = 0; index < lines.length; index += 1) {
      if (String(lines[index] || '').trim()) {
        firstNonEmptyIndex = index;
        break;
      }
    }

    if (firstNonEmptyIndex === -1) {
      return { text: String(text || ''), themeId: '' };
    }

    const firstLine = String(lines[firstNonEmptyIndex] || '').trim();
    const match = firstLine.match(/^\[\s*theme\s*:\s*([^\]]+)\]$/i);
    if (!match) {
      return { text: String(text || ''), themeId: '' };
    }

    const themeId = String(match[1] || '').trim().toLowerCase();
    lines.splice(firstNonEmptyIndex, 1);
    return {
      text: lines.join('\n'),
      themeId
    };
  }

  function applyThemeOverride(themeId) {
    const normalizedThemeId = String(themeId || '').trim();
    if (!normalizedThemeId) {
      return;
    }

    const root = document.documentElement;
    root.setAttribute('data-theme-id', normalizedThemeId);

    let attempts = 0;
    const maxAttempts = 20;

    function tryApply() {
      attempts += 1;

      if (typeof window.applyThemeById === 'function') {
        const didApply = window.applyThemeById(normalizedThemeId);
        if (didApply) {
          return;
        }
      }

      if (attempts >= maxAttempts) {
        return;
      }

      window.setTimeout(tryApply, 120);
    }

    tryApply();
  }

  function renderCloseupBody(text, manifest, slug) {
    const lines = String(text || '').split(/\r?\n/);
    const blocks = [];
    let paragraphBuffer = [];
    let leadingHeadingText = '';
    const imageQueue = getSongImageQueue(slug, manifest);
    let imageQueueIndex = 0;

    let startIndex = 0;
    while (startIndex < lines.length && !String(lines[startIndex] || '').trim()) {
      startIndex += 1;
    }

    function flushParagraph() {
      if (paragraphBuffer.length === 0) {
        return;
      }
      blocks.push({ kind: 'paragraph', text: smartJoinWrappedLines(paragraphBuffer) });
      paragraphBuffer = [];
    }

    function pushStandaloneParagraph(value) {
      const text = String(value || '').trim();
      if (!text) {
        return;
      }
      blocks.push({ kind: 'paragraph', text });
    }

    for (let index = startIndex; index < lines.length; index += 1) {
      const trimmed = String(lines[index] || '').trim();

      if (!trimmed) {
        flushParagraph();
        continue;
      }

      const heading = parseMarkdownHeading(trimmed);
      if (heading) {
        flushParagraph();
        blocks.push({ kind: 'heading', level: heading.level, text: heading.text, isFromMarkdown: true });
        continue;
      }

      const subtext = parseMarkdownSubtext(trimmed);
      if (subtext) {
        flushParagraph();
        blocks.push({ kind: 'subtext', text: subtext.text, level: subtext.level });
        continue;
      }

      const media = parseMediaToken(trimmed);
      if (media) {
        flushParagraph();
        blocks.push({ kind: 'media', media });
        continue;
      }

      if (/^<iframe\b/i.test(trimmed) || /^<video\b/i.test(trimmed) || /^<audio\b/i.test(trimmed)) {
        flushParagraph();
        blocks.push({ kind: 'rawHtml', html: trimmed });
        continue;
      }

      if (/^image$/i.test(trimmed)) {
        flushParagraph();
        const queued = imageQueue[imageQueueIndex] || null;
        if (queued && queued.name) {
          imageQueueIndex += 1;
          blocks.push({ kind: 'media', media: { kind: 'image', fileName: queued.name } });
        }
        continue;
      }

      const inlineMediaFiles = parseInlineMediaFileNames(trimmed);
      if (inlineMediaFiles.length > 0) {
        flushParagraph();
        const inlineMedia = inlineMediaFiles.map((fileName) => {
          const lower = fileName.toLowerCase();
          const kind = /\.(mp4|webm|ogg)$/i.test(lower)
            ? 'video'
            : (/\.(mp3|wav|m4a|flac|ogg)$/i.test(lower) ? 'audio' : 'image');
          return { kind, fileName };
        });

        if (inlineMedia.length > 1 && inlineMedia.every((item) => item.kind === 'image')) {
          blocks.push({ kind: 'mediaRow', media: inlineMedia });
          continue;
        }

        inlineMedia.forEach((mediaItem) => {
          blocks.push({ kind: 'media', media: mediaItem });
        });
        continue;
      }

      if (isDividerLine(trimmed)) {
        flushParagraph();
        blocks.push({ kind: 'divider' });
        continue;
      }

      if (isLikelyBareLinkLine(trimmed)) {
        flushParagraph();
        pushStandaloneParagraph(trimmed);
        continue;
      }

      if (/^(source:|thread:)/i.test(trimmed)) {
        flushParagraph();
        pushStandaloneParagraph(trimmed);
        continue;
      }

      // Plain close-up files often use unprefixed section lines instead of markdown headings.
      if (
        paragraphBuffer.length === 0
        && !/[.!?]$/.test(trimmed)
        && trimmed.length <= 80
        && /\([^)]+\)/.test(trimmed)
        && !(trimmed.startsWith('(') && trimmed.endsWith(')'))
      ) {
        flushParagraph();
        blocks.push({ kind: 'heading', level: 2, text: trimmed, isFromMarkdown: false });
        continue;
      }

      if (/^lets talk about\b/i.test(trimmed)) {
        flushParagraph();
        blocks.push({ kind: 'heading', level: 2, text: trimmed, isFromMarkdown: false });
        continue;
      }

      if (isShortStandaloneLine(trimmed, paragraphBuffer[paragraphBuffer.length - 1] || '')) {
        flushParagraph();
        pushStandaloneParagraph(trimmed);
        continue;
      }

      if (paragraphBuffer.length === 0) {
        paragraphBuffer.push(trimmed);
        continue;
      }

      const previousLine = paragraphBuffer[paragraphBuffer.length - 1];
      if (shouldMergeWrappedLine(previousLine, trimmed)) {
        paragraphBuffer.push(trimmed);
      } else {
        flushParagraph();
        paragraphBuffer.push(trimmed);
      }
    }

    flushParagraph();

    const renderedHtml = blocks.map((block, blockIndex) => {
      if (block.kind === 'heading') {
        const headingLevel = Math.min(6, Math.max(1, Number(block.level) || 2));
        const inline = convertInlineFormatting(block.text);

        if (blockIndex === 0 && headingLevel <= 2 && block.isFromMarkdown) {
          leadingHeadingText = block.text.replace(/\*/g, '').trim();
          return '';
        }

        if (headingLevel <= 2) {
          return '<h2 class="closeup-heading closeup-heading-major">' + inline + '</h2>';
        }

        return '<h3 class="closeup-heading closeup-heading-minor">' + inline + '</h3>';
      }

      if (block.kind === 'divider') {
        return '<hr class="closeup-divider">';
      }

      if (block.kind === 'rawHtml') {
        return String(block.html || '');
      }

      if (block.kind === 'subtext') {
        return '<p class="closeup-subtext">' + convertInlineFormatting(block.text) + '</p>';
      }

      if (block.kind === 'media') {
        const media = block.media;
        if (media.kind === 'youtube') {
          const embedUrl = toYouTubeEmbedUrl(media.url);
          if (!embedUrl) {
            return '';
          }
          return (
            '<figure class="closeup-media closeup-youtube">' +
              '<div class="closeup-youtube-frame-wrap">' +
                '<iframe src="' + embedUrl.replace(/"/g, '%22') + '" title="YouTube video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen loading="lazy"></iframe>' +
              '</div>' +
            '</figure>'
          );
        }

        const mediaPath = resolveMediaPath(media.fileName, media.kind, manifest);
        if (media.kind === 'audio') {
          if (!hasManifestMediaEntry(media.fileName, 'audio', manifest)) {
            return '';
          }

          return (
            '<figure class="closeup-media closeup-audio">' +
              '<audio controls preload="metadata" src="' + mediaPath.replace(/"/g, '%22') + '"></audio>' +
            '</figure>'
          );
        }

        if (media.kind === 'video') {
          if (!hasManifestMediaEntry(media.fileName, 'video', manifest)) {
            return '';
          }

          return (
            '<figure class="closeup-media closeup-video">' +
              '<video controls preload="metadata" src="' + mediaPath.replace(/"/g, '%22') + '"></video>' +
            '</figure>'
          );
        }

        return (
          '<figure class="closeup-media closeup-image">' +
            '<img src="' + mediaPath.replace(/"/g, '%22') + '" alt="' + escapeHtml(media.fileName) + '">' +
          '</figure>'
        );
      }

      if (block.kind === 'mediaRow') {
        const items = Array.isArray(block.media) ? block.media : [];
        if (items.length === 0) {
          return '';
        }

        const cells = items.map((item) => {
          const mediaPath = resolveMediaPath(item.fileName, item.kind, manifest);
          return (
            '<div class="closeup-media-row-cell">' +
              '<img src="' + mediaPath.replace(/"/g, '%22') + '" alt="' + escapeHtml(item.fileName) + '">' +
            '</div>'
          );
        }).join('');

        return '<figure class="closeup-media closeup-media-row closeup-media-row-' + items.length + '">' + cells + '</figure>';
      }

      const textHtml = convertInlineFormatting(block.text);
      return '<p class="closeup-paragraph">' + textHtml + '</p>';
    }).join('');

    return {
      html: renderedHtml,
      leadingHeadingText
    };
  }

  function applyInlineStyles() {
    const style = document.createElement('style');
    style.textContent = [
      '#closeupContent { max-width: none; margin-left: -13px; margin-top: 20px; margin-bottom: 20px; }',
      '.closeup-article { max-width: none; margin: 0; padding: 6px 8px 8px; }',
      '.closeup-header { margin-bottom: 14px; }',
      '.closeup-header h1 { margin: 0; font-size: 1.95rem; line-height: 1.12; letter-spacing: 0.005em; font-weight: 800; }',
      '.closeup-content { font-size: 1.03rem; line-height: 1.6; color: var(--theme-page-text); }',
      '.closeup-heading { margin: 0; }',
      '.closeup-heading-major { margin: 1.1em 0 0.45em; font-size: 1.95rem; line-height: 1.18; }',
      '.closeup-heading-minor { margin: 1.0em 0 0.45em; font-size: 1.8rem; line-height: 1.18; font-weight: 700; }',
      '.closeup-paragraph { margin: 0 0 1.05em 0; }',
      '.closeup-subtext { margin: 0 0 0.75em 0; font-size: 0.88em; line-height: 1.45; color: #4a4a4a; font-style: normal; }',
      '.closeup-divider { border: 0; border-top: 1px solid var(--theme-color-border_segment); margin: 1.6em 0 1.25em; opacity: 0.8; }',
      '.closeup-media { margin: 0.95em 0 1.1em; }',
      '.closeup-bandcamp { width: min(560px, 100%); }',
      '.closeup-media img, .closeup-media video { width: min(680px, 100%); max-width: 100%; border-radius: 0; border: 1px solid var(--theme-color-border_pill); display: block; background: var(--theme-color-background_base); }',
      '.closeup-video video { width: min(560px, 100%); aspect-ratio: 16 / 9; height: auto; }',
      '.closeup-audio audio { width: min(560px, 100%); display: block; }',
      '.closeup-youtube-frame-wrap { width: min(560px, 100%); aspect-ratio: 16 / 9; border-radius: 0; overflow: hidden; border: 1px solid var(--theme-color-border_pill); background: var(--theme-color-background_base); }',
      '.closeup-youtube-frame-wrap iframe { width: 100%; height: 100%; border: 0; display: block; }',
      '.closeup-bandcamp-frame-wrap { width: min(560px, 100%); height: 148px; border-radius: 0; overflow: hidden; border: 0; background: transparent; display: block; padding: 0; box-sizing: border-box; line-height: 0; }',
      '.closeup-bandcamp-frame-wrap iframe { width: 100%; height: 100%; border: 0; display: block; }',
      '.closeup-media-row { width: min(680px, 100%); display: grid; gap: 0; grid-template-columns: repeat(2, minmax(0, 1fr)); }',
      '.closeup-media-row-cell img { width: 100%; border-radius: 0; }',
      '.closeup-media-row-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }',
      '.closeup-media-row-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }',
      '.closeup-content a { color: var(--theme-color-link_default); text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 2px; }',
      '.closeup-content a:hover { color: var(--theme-color-accent_hover); }',
      '.closeup-back-wrap { display: flex; justify-content: flex-start; margin-top: 2.2em; }',
      '.closeup-back-link { display: inline-flex; align-items: center; justify-content: center; padding: 5px 12px; background-color: var(--theme-color-background_base); color: var(--theme-color-link_default); border: 3px solid var(--theme-color-brand_frame); border-radius: 5px; cursor: pointer; font-weight: bold; text-decoration: none; transition: all 0.3s ease; box-sizing: border-box; min-width: 140px; }',
      '.closeup-back-link:hover { color: var(--theme-color-accent_hover); }',
      '@media (max-width: 760px) { .closeup-article { padding: 6px 6px 10px; } .closeup-header h1 { font-size: 1.78rem; } .closeup-heading-major { font-size: 1.55rem; } .closeup-heading-minor { font-size: 1.38rem; } .closeup-media-row { grid-template-columns: 1fr; } .closeup-back-wrap { justify-content: flex-start; } .closeup-back-link { width: auto; text-align: center; } }'
    ].join('');
    document.head.appendChild(style);
  }

  function renderNotFound(container, slug) {
    const title = slugToTitle(slug) || 'Close-up';
    document.title = title + ' Close-up';
    container.innerHTML = '<div class="closeup-header"><h1>' + escapeHtml(title) + ' Close-up</h1><p>No close-up text file was found for this song.</p></div>';
  }

  async function initializeCloseupPage() {
    const container = document.getElementById('closeupContent');
    if (!container) {
      return;
    }

    applyInlineStyles();

    const slug = getSongSlugFromRoute();
    if (!slug) {
      renderNotFound(container, '');
      return;
    }

    const manifest = null;
    const textPath = withBasePath('/public/close ups/text/' + slug + '.txt');
    const closeupText = await fetchText(textPath);

    if (!closeupText) {
      renderNotFound(container, slug);
      return;
    }

    const tagged = extractThemeTag(closeupText);
    applyThemeOverride(tagged.themeId);

    const renderResult = renderCloseupBody(tagged.text, manifest || { assets: { images: [], videos: [], audio: [] } }, slug);
    const headingText = String(renderResult.leadingHeadingText || '').trim();
    document.title = headingText || (slugToTitle(slug) + ' Close-up');

    const pageHref = withBasePath('/music/' + slug);
    container.innerHTML =
      '<article class="closeup-article">' +
        (headingText ? '<div class="closeup-header"><h1>' + convertInlineFormatting(headingText) + '</h1></div>' : '') +
        '<div class="closeup-content">' + renderResult.html + '</div>' +
        '<div class="closeup-back-wrap"><a class="closeup-back-link" href="' + pageHref.replace(/"/g, '%22') + '">Back to page</a></div>' +
      '</article>';

    if (typeof window.normalizeInternalAnchorTargets === 'function') {
      window.normalizeInternalAnchorTargets(container);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeCloseupPage, { once: true });
  } else {
    initializeCloseupPage();
  }
})();
