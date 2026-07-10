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

document.addEventListener('DOMContentLoaded', function () {
  initializeDataNavButtons();
});