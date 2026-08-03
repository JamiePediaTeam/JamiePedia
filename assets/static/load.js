// Determine base path - detect GitHub Pages subdirectory
const pathname = window.location.pathname;
const basePath = pathname.includes('/JamiePedia/') ? '/JamiePedia' : '';

// Load music file paths first, then search functionality
const musicFilesScript = document.createElement('script');
musicFilesScript.src = basePath + '/assets/static/music-files.js';
musicFilesScript.onload = function() {
  const navOrderScript = document.createElement('script');
  navOrderScript.src = basePath + '/assets/static/nav-order.js';
  navOrderScript.onload = function() {
    if (document.readyState !== 'loading') {
      initializeDataNavButtons();
    }

    const searchScript = document.createElement('script');
    searchScript.src = basePath + '/assets/static/search.js';
    searchScript.onload = function() {
      // Initialize search after navibar loads
      $(function(){
        $("#navi").load(basePath + "/assets/static/navibar.html", function() {
          if (typeof initializeSearch === 'function') {
            initializeSearch();
          }
        });
        $("#sidebar").load(basePath + "/assets/static/sidebar.html");
        $("#linkbox").load(basePath + "/assets/static/linkbox.html", function() {
          // After jQuery loads content, add icons to any new links
          if (typeof addSocialMediaIcons === 'function') {
            addSocialMediaIcons();
          }
        });
      });
    };
    document.head.appendChild(searchScript);
  };
  document.head.appendChild(navOrderScript);
};
document.head.appendChild(musicFilesScript);

// Load social icons stylesheet
const socialIconsLink = document.createElement('link');
socialIconsLink.rel = 'stylesheet';
socialIconsLink.href = basePath + '/css/social-icons.css';
document.head.appendChild(socialIconsLink);

// Load social icons script
const socialIconsScript = document.createElement('script');
socialIconsScript.src = basePath + '/assets/static/social-icons.js';
document.head.appendChild(socialIconsScript);

// Navigate to a song with proper base path
function goToSong(relativePath) {
  window.location.href = basePath + relativePath;
}

function normalizePathForNav(path) {
  if (!path) return '/';

  let normalized = String(path).split('?')[0].split('#')[0];
  if (!normalized.startsWith('/')) {
    normalized = '/' + normalized;
  }

  if (basePath && normalized.startsWith(basePath + '/')) {
    normalized = normalized.slice(basePath.length);
  }

  return normalized;
}

function setNavLinkTarget(element, targetPath) {
  const isAnchor = element.tagName.toLowerCase() === 'a';
  const hasTarget = Boolean(targetPath);

  element.removeAttribute('onclick');

  if (hasTarget) {
    const href = basePath + targetPath;

    if (isAnchor) {
      element.setAttribute('href', href);
    } else {
      element.onclick = function () {
        window.location.href = href;
      };
    }

    element.setAttribute('aria-disabled', 'false');
    element.style.opacity = '';
    element.style.pointerEvents = '';
    return;
  }

  if (isAnchor) {
    element.setAttribute('href', 'javascript:void(0);');
  } else {
    element.onclick = function (event) {
      event.preventDefault();
    };
  }

  element.setAttribute('aria-disabled', 'true');
  element.style.opacity = '0.5';
  element.style.pointerEvents = 'none';
}

function getNavListForPath(currentPath) {
  const navOrder = window.navOrder;
  if (!navOrder) return null;

  if (Array.isArray(navOrder.songs) && navOrder.songs.includes(currentPath)) {
    return navOrder.songs;
  }

  if (Array.isArray(navOrder.albums) && navOrder.albums.includes(currentPath)) {
    return navOrder.albums;
  }

  if (Array.isArray(navOrder.motifs) && navOrder.motifs.includes(currentPath)) {
    return navOrder.motifs;
  }

  return null;
}

function initializeDataNavButtons() {
  const navOrder = window.navOrder;
  if (!navOrder) return;

  const currentPath = normalizePathForNav(window.location.pathname);
  const activeList = getNavListForPath(currentPath);
  if (!activeList) return;

  const currentIndex = activeList.indexOf(currentPath);
  if (currentIndex === -1) return;

  const prevPath = currentIndex > 0 ? activeList[currentIndex - 1] : null;
  const nextPath = currentIndex < activeList.length - 1 ? activeList[currentIndex + 1] : null;

  let containers = Array.from(document.querySelectorAll('.song-nav-buttons, .album-nav-buttons'));

  // Album pages typically do not include nav buttons in HTML.
  // Auto-create a container so album prev/next is centrally data-driven too.
  if (containers.length === 0 && activeList === navOrder.albums) {
    const bodybar = document.querySelector('.bodybar');
    if (bodybar) {
      const container = document.createElement('div');
      container.className = 'album-nav-buttons';
      container.innerHTML =
        '<a href="javascript:void(0);" class="album-nav-link">← Previous</a>' +
        '<a href="javascript:void(0);" class="album-nav-link">Next →</a>';
      bodybar.appendChild(container);
      containers = [container];
    }
  }

  containers.forEach((container) => {
    const links = Array.from(container.querySelectorAll('a.song-nav-link, button.song-nav-link, a.album-nav-link, button.album-nav-link, a, button'));
    if (links.length < 2) return;

    const prevElement = links.find((el) => /previous|←/i.test(el.textContent || '')) || links[0];
    const nextElement = links.find((el) => /next|→/i.test(el.textContent || '')) || links[1];

    setNavLinkTarget(prevElement, prevPath);
    setNavLinkTarget(nextElement, nextPath);
  });
}

function isProgressiveArtPath(pathname) {
  return pathname.includes('/public/images/cover-art/') || pathname.includes('/public/images/motif-art/');
}

function replaceExtensionWithWebp(pathname) {
  return pathname.replace(/\.[a-z0-9]+$/i, '.webp');
}

function toPreviewPathname(pathname) {
  if (pathname.includes('/public/images/cover-art/')) {
    return replaceExtensionWithWebp(pathname.replace('/public/images/cover-art/', '/public/images/previews/cover-art/'));
  }

  if (pathname.includes('/public/images/motif-art/')) {
    return replaceExtensionWithWebp(pathname.replace('/public/images/motif-art/', '/public/images/previews/motif-art/'));
  }

  return '';
}

function toPreviewUrl(originalSrc) {
  if (!originalSrc) {
    return '';
  }

  try {
    const absolute = new URL(originalSrc, window.location.href);
    if (!isProgressiveArtPath(absolute.pathname)) {
      return '';
    }

    const previewPathname = toPreviewPathname(absolute.pathname);
    if (!previewPathname) {
      return '';
    }

    absolute.pathname = previewPathname;
    absolute.search = '';
    absolute.hash = '';
    return absolute.href;
  } catch (_error) {
    return '';
  }
}

function applyProgressiveArtPreviewToImage(image) {
  if (!image || image.nodeType !== 1 || image.tagName !== 'IMG') {
    return;
  }

  const currentSrc = image.getAttribute('src') || '';
  const managedHqSrc = image.dataset.previewManagedHqSrc || '';
  const managedPreviewSrc = image.dataset.previewManagedPreviewSrc || '';

  if (managedHqSrc) {
    if (currentSrc === managedHqSrc || currentSrc === managedPreviewSrc) {
      return;
    }

    image.dataset.previewManagedHqSrc = '';
    image.dataset.previewManagedPreviewSrc = '';
  }

  const originalSrc = currentSrc;
  const previewSrc = toPreviewUrl(originalSrc);
  if (!previewSrc) {
    return;
  }

  image.dataset.previewManagedHqSrc = originalSrc;
  image.dataset.previewManagedPreviewSrc = previewSrc;

  const previewProbe = new Image();
  previewProbe.onload = function () {
    if (image.dataset.previewManagedHqSrc !== originalSrc) {
      return;
    }

    image.src = previewSrc;

    const highQualityProbe = new Image();
    highQualityProbe.onload = function () {
      if (image.dataset.previewManagedHqSrc !== originalSrc) {
        return;
      }

      image.src = originalSrc;
    };
    highQualityProbe.src = originalSrc;
  };
  previewProbe.src = previewSrc;
}

function applyProgressiveArtPreviews(rootNode) {
  const root = rootNode && rootNode.nodeType === 1 ? rootNode : document;

  if (root.tagName === 'IMG') {
    applyProgressiveArtPreviewToImage(root);
    return;
  }

  const images = root.querySelectorAll ? root.querySelectorAll('img') : [];
  images.forEach((image) => {
    applyProgressiveArtPreviewToImage(image);
  });
}

function installProgressiveArtObserver() {
  if (window.__jamiePediaProgressiveArtObserverInstalled) {
    return;
  }

  window.__jamiePediaProgressiveArtObserverInstalled = true;
  applyProgressiveArtPreviews(document);

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          applyProgressiveArtPreviews(node);
        });
      }

      if (mutation.type === 'attributes' && mutation.target && mutation.target.tagName === 'IMG') {
        applyProgressiveArtPreviewToImage(mutation.target);
      }
    });
  });

  const observeRoot = document.body || document.documentElement;
  if (!observeRoot) {
    document.addEventListener('DOMContentLoaded', installProgressiveArtObserver, { once: true });
    return;
  }

  observer.observe(observeRoot, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src']
  });
}

installProgressiveArtObserver();

document.addEventListener('DOMContentLoaded', function () {
  initializeDataNavButtons();
});