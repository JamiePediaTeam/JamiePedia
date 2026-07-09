// Music file paths for search indexing
const musicFilePaths = [
  // Motif Pages
  { album: 'Motifs', path: '/motifs.html' },
  { album: 'Motifs', path: '/motifs/bittersweet-kalia-vibte.html' },
  { album: 'Motifs', path: '/motifs/gummyworm.html' },
  { album: 'Motifs', path: '/motifs/constant-companions.html' },

  // Album Pages
  { album: 'Album', path: '/music/aa.html' },
  { album: 'Album', path: '/music/aed.html' },
  { album: 'Album', path: '/music/bs.html' },
  { album: 'Album', path: '/music/cc.html' },
  { album: 'Album', path: '/music/ccde.html' },
  { album: 'Album', path: '/music/ccontrepoint.html' },
  { album: 'Album', path: '/music/cs.html' },
  { album: 'Album', path: '/music/jpjp3.html' },
  
  // Anew Again
  { album: 'Anew Again', path: '/music/aa/decree.html' },
  { album: 'Anew Again', path: '/music/aa/space-center.html' },
  { album: 'Anew Again', path: '/music/aa/skygirl.html' },
  { album: 'Anew Again', path: '/music/aa/imaginary-effervescent.html' },
  { album: 'Anew Again', path: '/music/aa/adelaide-delays.html' },
  { album: 'Anew Again', path: '/music/aa/song-for-jijo.html' },
  { album: 'Anew Again', path: '/music/aa/grand-restore.html' },
  { album: 'Anew Again', path: '/music/aa/space-center-pt-2.html' },
  { album: 'Anew Again', path: '/music/aa/good-time-lead-line.html' },
  
  // Autumn Every Day
  { album: 'Autumn Every Day', path: '/music/aed/automated-answering-service.html' },
  { album: 'Autumn Every Day', path: '/music/aed/a-repetition.html' },
  { album: 'Autumn Every Day', path: '/music/aed/to-atlantis.html' },
  { album: 'Autumn Every Day', path: '/music/aed/its-2013-again.html' },
  { album: 'Autumn Every Day', path: '/music/aed/too-much-autotune.html' },
  { album: 'Autumn Every Day', path: '/music/aed/special-days.html' },
  { album: 'Autumn Every Day', path: '/music/aed/amelie.html' },
  { album: 'Autumn Every Day', path: '/music/aed/secret-girlfriend.html' },
  { album: 'Autumn Every Day', path: '/music/aed/bizarre-love-triangle.html' },
  { album: 'Autumn Every Day', path: '/music/aed/pass.html' },
  { album: 'Autumn Every Day', path: '/music/aed/honor-majesty.html' },
  { album: 'Autumn Every Day', path: '/music/aed/autumn-every-day.html' },
  { album: 'Autumn Every Day', path: '/music/aed/hold-me-tightly.html' },
  
  // Bittersweet
  { album: 'Bittersweet', path: '/music/bs/second-hello.html' },
  { album: 'Bittersweet', path: '/music/bs/gentle-heart.html' },
  { album: 'Bittersweet', path: '/music/bs/asemic-speech.html' },
  { album: 'Bittersweet', path: '/music/bs/nothing-with-you.html' },
  { album: 'Bittersweet', path: '/music/bs/paisley-patterns.html' },
  { album: 'Bittersweet', path: '/music/bs/gummyworm.html' },
  { album: 'Bittersweet', path: '/music/bs/greatsword-love-as-fire.html' },
  { album: 'Bittersweet', path: '/music/bs/ally.html' },
  { album: 'Bittersweet', path: '/music/bs/ballroom.html' },
  { album: 'Bittersweet', path: '/music/bs/bittersweet.html' },
  { album: 'Bittersweet', path: '/music/bs/close.html' },
  { album: 'Bittersweet', path: '/music/bs/fiction.html' },
  
  // Constant Companions
  { album: 'Constant Companions', path: '/music/cc/dyad.html' },
  { album: 'Constant Companions', path: '/music/cc/not-quite-there.html' },
  { album: 'Constant Companions', path: '/music/cc/rot-for-clout.html' },
  { album: 'Constant Companions', path: '/music/cc/i-wish-that-i-could-fall.html' },
  { album: 'Constant Companions', path: '/music/cc/cadmium-colors.html' },
  { album: 'Constant Companions', path: '/music/cc/breeze-blows.html' },
  { album: 'Constant Companions', path: '/music/cc/aggrandicize.html' },
  { album: 'Constant Companions', path: '/music/cc/liaison.html' },
  { album: 'Constant Companions', path: '/music/cc/object-of-affection.html' },
  { album: 'Constant Companions (Deluxe Edition)', path: '/music/cc/clouddrop.html' },
  { album: 'Constant Companions', path: '/music/cc/my-darling-my-companion.html' },
  { album: 'Constant Companions', path: '/music/cc/machine-love.html' },
  { album: 'Constant Companions (Deluxe Edition)', path: '/music/cc/birdbrain.html' },
  { album: 'Constant Companions (Deluxe Edition)', path: '/music/cc/shiny-chariot.html' },
  { album: 'Constant Companions (Deluxe Edition)', path: '/music/cc/strawberry.html' },
  { album: 'Constant Companions (Deluxe Edition)', path: '/music/cc/manifesto.html' },
  { album: 'Constant Companions (Deluxe Edition)', path: '/music/cc/dance-delightful.html' },
  
  // c-sides
  { album: 'c-sides', path: '/music/cs/papergirl.html' },
  { album: 'c-sides', path: '/music/cs/little-anger.html' },
  { album: 'c-sides', path: '/music/cs/ringtone.html' },
  { album: 'c-sides', path: '/music/cs/one-small-moment-of-silence.html' },
  { album: 'c-sides', path: '/music/cs/some-more-of-that-song.html' },
  
  // Cardiac Contrepoint
  { album: 'Cardiac Contrepoint', path: '/music/ccontrepoint/butcher-vanity.html' },
  
  // Jamie Paige Jam Pack - March 2024
  { album: 'Jamie Paige Jam Pack - March 2024', path: '/music/jpjp3/funtown-usa.html' },
  { album: 'Jamie Paige Jam Pack - March 2024', path: '/music/jpjp3/paisley-pudge-airship.html' }
];
