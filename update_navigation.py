#!/usr/bin/env python3
import os
import re
from pathlib import Path

# Define the song list in sequence (index 0-55)
songs = [
    # Anew, Again (aa) - indices 0-8
    ('aa', 'decree'),
    ('aa', 'space-center'),
    ('aa', 'skygirl'),
    ('aa', 'imaginary-effervescent'),
    ('aa', 'adelaide-delays'),
    ('aa', 'song-for-jijo'),
    ('aa', 'grand-restore'),
    ('aa', 'space-center-pt-2'),
    ('aa', 'good-time-lead-line'),
    
    # Autumn Every Day (aed) - indices 9-21
    ('aed', 'automated-answering-service'),
    ('aed', 'a-repetition'),
    ('aed', 'to-atlantis'),
    ('aed', 'its-2013-again'),
    ('aed', 'too-much-autotune'),
    ('aed', 'special-days'),
    ('aed', 'amelie'),
    ('aed', 'secret-girlfriend'),
    ('aed', 'bizarre-love-triangle'),
    ('aed', 'pass'),
    ('aed', 'honor-majesty'),
    ('aed', 'autumn-every-day'),
    ('aed', 'hold-me-tightly'),
    
    # Bittersweet (bs) - indices 23-34
    ('bs', 'second-hello'),
    ('bs', 'gentle-heart'),
    ('bs', 'asemic-speech'),
    ('bs', 'nothing-with-you'),
    ('bs', 'paisley-patterns'),
    ('bs', 'gummyworm'),
    ('bs', 'greatsword-love-as-fire'),
    ('bs', 'ally'),
    ('bs', 'ballroom'),
    ('bs', 'bittersweet'),
    ('bs', 'close'),
    ('bs', 'fiction'),
    
    # Constant Companions (cc) - indices 35-50
    ('cc', 'dyad'),
    ('cc', 'not-quite-there'),
    ('cc', 'rot-for-clout'),
    ('cc', 'i-wish-that-i-could-fall'),
    ('cc', 'cadmium-colors'),
    ('cc', 'breeze-blows'),
    ('cc', 'aggrandicize'),
    ('cc', 'liaison'),
    ('cc', 'object-of-affection'),
    ('cc', 'clouddrop'),
    ('cc', 'my-darling-my-companion'),
    ('cc', 'machine-love'),
    ('cc', 'birdbrain'),
    ('cc', 'shiny-chariot'),
    ('cc', 'strawberry'),
    ('cc', 'manifesto'),
    ('cc', 'dance-delightful'),
    
    # c-sides (cs) - indices 51-55
    ('cs', 'papergirl'),
    ('cs', 'little-anger'),
    ('cs', 'ringtone'),
    ('cs', 'one-small-moment-of-silence'),
    ('cs', 'some-more-of-that-song'),
]

# Base path
base_path = r'c:\Users\tjcom\Downloads\jamiepaigefansite\JamiePedia\music'

# Track updates for summary
updates = []

# Process each song
for current_idx, (album, filename) in enumerate(songs):
    # Calculate prev and next indices (with wraparound)
    prev_idx = (current_idx - 1) % len(songs)
    next_idx = (current_idx + 1) % len(songs)
    
    prev_album, prev_filename = songs[prev_idx]
    next_album, next_filename = songs[next_idx]
    
    # Build file path
    file_path = os.path.join(base_path, album, f'{filename}.html')
    
    if not os.path.exists(file_path):
        print(f"WARNING: File not found: {file_path}")
        continue
    
    # Read the file
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Pattern to find the navigation buttons section
    # This matches the current pattern with optional whitespace
    old_pattern = r'<!-- Navigation Buttons -->\s*<div class="song-nav-buttons">\s*<button onclick="previousSong\(\)">← Previous</button>\s*<button onclick="nextSong\(\)">Next →</button>\s*</div>'
    
    # Create the new navigation HTML
    new_nav = f'''<!-- Navigation Buttons -->
<div class="song-nav-buttons">
  <a href="/music/{prev_album}/{prev_filename}.html" class="song-nav-link">← Previous</a>
  <a href="/music/{next_album}/{next_filename}.html" class="song-nav-link">Next →</a>
</div>'''
    
    # Replace if pattern found
    if re.search(old_pattern, content):
        new_content = re.sub(old_pattern, new_nav, content)
        
        # Write back to file
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        
        # Record the update
        updates.append({
            'index': current_idx + 1,
            'filename': f'{album}/{filename}.html',
            'prev': f'{prev_album}/{prev_filename}.html',
            'next': f'{next_album}/{next_filename}.html'
        })
        print(f"[OK] Updated: {album}/{filename}.html")
    else:
        print(f"[FAIL] Navigation pattern not found in: {file_path}")

# Print summary
print("\n" + "="*80)
print("SUMMARY OF ALL 56 SONG NAVIGATION UPDATES")
print("="*80 + "\n")

for update in updates:
    print(f"{update['index']:2d}. {update['filename']:40s} | prev -> {update['prev']:35s} | next -> {update['next']}")

print("\n" + "="*80)
print(f"Total files updated: {len(updates)}/{len(songs)}")
print("="*80)
