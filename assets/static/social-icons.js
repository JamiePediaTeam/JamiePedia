// Add icons to social media links
function addSocialMediaIcons() {
  const siteBase = window.location.pathname.includes('/JamiePedia/') ? '/JamiePedia' : '';
  const resolveLocalIconUrl = (path) => siteBase + '/' + String(path || '').replace(/^\/+/, '');

  const iconMap = {
    youtube: { url: 'https://youtube.com/favicon.ico', label: 'YouTube' },
    youtu: { url: 'https://youtube.com/favicon.ico', label: 'YouTube' },
    bandcamp: { url: 'https://s4.bcbits.com/client-bundle/1/PageLayout_1/favicon-78ff127104384a042453aca8d73be7dc.static/favicon/favicon-16x16.png', label: 'Bandcamp' },
    bluesky: { url: 'https://bsky.app/favicon.ico', label: 'Bluesky' },
    'x.com': { url: resolveLocalIconUrl('public/images/x.png'), label: 'X' },
    twitter: { url: resolveLocalIconUrl('public/images/x.png'), label: 'X' },
    soundcloud: { url: resolveLocalIconUrl('public/images/sc.ico'), label: 'SoundCloud' },
    tumblr: { url: 'https://tumblr.com/favicon.ico', label: 'Tumblr' },
    spotify: { url: 'https://open.spotify.com/favicon.ico', label: 'Spotify' },
    'music.apple.com': { url: 'https://music.apple.com/favicon.ico', label: 'Apple Music' },
    'jamies.page': { url: 'https://jamies.page/images/favicon.ico', label: 'Jamie\'s Page' }
  };

  document.querySelectorAll('a').forEach(link => {
    const href = link.getAttribute('href') || '';
    
    // Check if link already has an icon
    if (link.querySelector('.social-icon')) {
      return;
    }
    
    // Find matching service
    for (const [service, data] of Object.entries(iconMap)) {
      if (href.toLowerCase().includes(service)) {
        const iconSpan = document.createElement('span');
        iconSpan.className = 'social-icon';
        iconSpan.setAttribute('data-service', service);
        
        // Create image element for the icon
        const img = document.createElement('img');
        img.src = data.url;
        img.alt = data.label;
        img.title = data.label;
        img.className = 'social-icon-img';
        
        iconSpan.appendChild(img);
        link.insertBefore(iconSpan, link.firstChild);
        break;
      }
    }
  });
}

// Run immediately if DOM is ready, otherwise wait for DOMContentLoaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    addSocialMediaIcons();
  });
} else {
  // DOM is already ready
  addSocialMediaIcons();
}
