function lerp(a, b, t) { return a + (b - a) * t; }
function toHex2(v) { return Math.round(v).toString(16).padStart(2, '0'); }

// ── Random init helpers ──────────────────────────────────────────────────────
function rndRange(lo, hi) { return lo + Math.random() * (hi - lo); }

function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return '#' + [f(0), f(8), f(4)].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
}

function randomAudioFeatures() {
  return {
    tempo:        60  + Math.random() * 120, // 60–180 BPM
    energy:       0.2 + Math.random() * 0.7, // 0.2–0.9
    danceability: 0.2 + Math.random() * 0.7, // 0.2–0.9
    valence:      Math.random(),              // 0–1
  };
}

// Deterministic stand-in for Spotify's deprecated audio-features endpoint:
// the same track ID always yields the same tempo/energy/etc.
function seededAudioFeatures(seed) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  const rand = () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
  return {
    tempo:        60  + rand() * 120,
    energy:       0.2 + rand() * 0.7,
    danceability: 0.2 + rand() * 0.7,
    valence:      rand(),
  };
}

let audioFeatures = randomAudioFeatures();

function randomInitControls() {
  // Random colors (3–5 vibrant, spread-hue colors)
  const count = 3 + Math.floor(Math.random() * 3);
  const colors = [];
  for (let i = 0; i < count; i++) {
    const hue = ((i / count) * 360 + rndRange(-20, 20) + 360) % 360;
    colors.push(hslToHex(hue, 55 + rndRange(0, 45), 40 + rndRange(0, 30)));
  }

  const boxes = document.querySelectorAll('.color-box');
  boxes.forEach((box, i) => {
    if (colors[i]) {
      box.classList.remove('empty');
      box.style.background = colors[i];
      box.querySelector('input[type="color"]').value = colors[i];
    } else {
      box.classList.add('empty');
      box.style.background = 'transparent';
      box.querySelector('input[type="color"]').value = '#333333';
    }
  });

  // Random sliders
  const spread  = Math.round(rndRange(20, 80));
  const opacity = Math.round(rndRange(40, 80));
  const noise   = Math.round(rndRange(0,  30));

  spreadSlider.value  = spread;  spreadVal.textContent  = spread;
  densitySlider.value = opacity; densityVal.textContent = opacity;
  noiseSlider.value   = noise;   noiseVal.textContent   = noise;

  // Random composition
  const comps = ['Full-bleed', 'Shapes', 'Radial'];
  const pick  = comps[Math.floor(Math.random() * comps.length)];
  document.querySelectorAll('.comp-btn').forEach(btn => {
    btn.classList.toggle('active', btn.textContent.trim() === pick);
  });

  // Random audio features
  audioFeatures = randomAudioFeatures();
}

const spreadSlider  = document.getElementById('spread');
const spreadVal     = document.getElementById('spread-val');
const densitySlider = document.getElementById('density');
const densityVal    = document.getElementById('density-val');
const noiseSlider   = document.getElementById('noise');
const noiseVal      = document.getElementById('noise-val');

spreadSlider.addEventListener('input', function() {
  spreadVal.textContent = Math.round(this.value);
  updateGradient();
});

densitySlider.addEventListener('input', function() {
  densityVal.textContent = Math.round(this.value);
  updateGradient();
});

noiseSlider.addEventListener('input', function() {
  noiseVal.textContent = Math.round(this.value);
  updateGradient();
});

// Album art via Spotify oEmbed
const songLink   = document.getElementById('song-link');
const albumArt   = document.getElementById('album-art');
const linkStatus = document.getElementById('link-status');

// --- Color extraction from album art ---
function extractColorsFromImage(img) {
  const size = 80;
  const offscreen = document.createElement('canvas');
  offscreen.width  = size;
  offscreen.height = size;
  const octx = offscreen.getContext('2d');
  octx.drawImage(img, 0, 0, size, size);

  const data = octx.getImageData(0, 0, size, size).data;

  // Build a frequency map with quantization per channel
  const colorMap = {};
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < 128) continue;
    const r = Math.round(data[i]     / 24) * 24;
    const g = Math.round(data[i + 1] / 24) * 24;
    const b = Math.round(data[i + 2] / 24) * 24;
    const brightness = (r + g + b) / 3;
    if (brightness < 20 || brightness > 235) continue;
    const key = `${r},${g},${b}`;
    colorMap[key] = (colorMap[key] || 0) + 1;
  }

  const sorted = Object.entries(colorMap).sort((a, b) => b[1] - a[1]);

  // Retry with progressively smaller distance thresholds until we have 5
  const thresholds = [90, 70, 50, 30, 15];
  let selected = [];

  for (const threshold of thresholds) {
    selected = [];
    for (const [key] of sorted) {
      if (selected.length >= 5) break;
      const [r, g, b] = key.split(',').map(Number);
      const distinct = selected.every(([sr, sg, sb]) =>
        Math.sqrt((r - sr) ** 2 + (g - sg) ** 2 + (b - sb) ** 2) > threshold
      );
      if (distinct) selected.push([r, g, b]);
    }
    if (selected.length >= 5) break;
  }

  return selected.map(([r, g, b]) =>
    '#' + [r, g, b].map(v => Math.min(255, v).toString(16).padStart(2, '0')).join('')
  );
}

function applyColorsToPalette(colors) {
  document.querySelectorAll('.color-box').forEach((box, i) => {
    if (colors[i]) {
      box.classList.remove('empty');
      box.style.background = colors[i];
      box.querySelector('input[type="color"]').value = colors[i];
    } else {
      box.classList.add('empty');
      box.style.background = 'transparent';
      box.querySelector('input[type="color"]').value = '#333333';
    }
  });
  updateGradient();
}

// After the image loads, extract its colors
albumArt.addEventListener('load', function() {
  try {
    const colors = extractColorsFromImage(albumArt);
    applyColorsToPalette(colors);
  } catch (e) {
    // CORS blocked — image still shows, palette just won't update
    console.warn('Color extraction blocked (CORS):', e);
  }
});

// ─── Spotify Web API (via proxy; the client secret lives on the Worker) ───
// After deploying the Worker (see worker/README.md), paste its URL here.
const SPOTIFY_PROXY_URL = 'https://softsong-spotify-proxy.aishahsa.workers.dev';

function extractSpotifyTrackId(url) {
  const m = url.match(/spotify\.com\/track\/([a-zA-Z0-9]+)/);
  return m ? m[1] : null;
}

async function fetchSpotifyTrack(spotifyUrl) {
  const trackId = extractSpotifyTrackId(spotifyUrl);
  if (!trackId) return null;
  const res = await fetch(`${SPOTIFY_PROXY_URL}/track/${trackId}`);
  if (!res.ok) throw new Error('Track fetch failed');
  return res.json();
}

async function fetchAudioFeatures(trackId) {
  const res = await fetch(`${SPOTIFY_PROXY_URL}/audio-features/${trackId}`);
  if (!res.ok) throw new Error('Audio features fetch failed');
  return res.json();
}
// ──────────────────────────────────────────────────────────────────────────

let spotifyLoaded = false;
let previewUrl    = '';

let fetchTimeout;
songLink.addEventListener('input', function() {
  clearTimeout(fetchTimeout);
  const url = this.value.trim();

  if (!url.includes('open.spotify.com')) {
    spotifyLoaded = false;
    previewUrl    = '';
    albumArt.src = 'placeholder.png';
    albumArt.classList.add('visible');
    document.getElementById('track-title').textContent = 'the blue got here before the song did';
    document.getElementById('track-artist').style.display = 'none';
    document.getElementById('track-meta').classList.add('visible');
    linkStatus.textContent = 'Spotify URL';
    linkStatus.classList.remove('error');
    return;
  }

  linkStatus.textContent = 'Fetching…';
  linkStatus.classList.remove('error');

  fetchTimeout = setTimeout(async () => {
    try {
      let title = '', albumName = '', artistName = '', artistUrl = '#', thumbnailUrl = '';

      if (!SPOTIFY_PROXY_URL.includes('YOUR-SUBDOMAIN')) {
        // ── Web API path (full metadata) ──
        const trackId = extractSpotifyTrackId(url);
        const track   = await fetchSpotifyTrack(url);
        if (!track) throw new Error('Could not extract track ID from URL');
        title        = track.name;
        albumName    = track.album?.name || '';
        artistName   = track.artists.map(a => a.name).join(', ');
        artistUrl    = track.artists[0]?.external_urls?.spotify || '#';
        thumbnailUrl = track.album?.images?.[0]?.url || '';
        previewUrl   = track.preview_url             || '';

        // Fetch audio features (tempo, energy, danceability, valence)
        try {
          const af = await fetchAudioFeatures(trackId);
          audioFeatures = {
            tempo:        af.tempo,
            energy:       af.energy,
            danceability: af.danceability,
            valence:      af.valence,
          };
        } catch (e) {
          console.warn('Audio features unavailable, using seeded values:', e);
          audioFeatures = seededAudioFeatures(trackId);
        }
      } else {
        // ── oEmbed fallback (no credentials set yet) ──
        const res  = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`);
        if (!res.ok) throw new Error('oEmbed failed');
        const data = await res.json();
        title        = data.title        || '';
        thumbnailUrl = data.thumbnail_url || '';
        artistName   = data.author_name  || '';
        artistUrl    = data.author_url   || '#';
      }

      const trackTitle  = document.getElementById('track-title');
      const trackArtist = document.getElementById('track-artist');
      const trackMeta   = document.getElementById('track-meta');

      trackTitle.textContent = albumName ? `${title} – ${albumName}` : title;
      if (artistName) {
        trackArtist.textContent   = artistName;
        trackArtist.href          = artistUrl;
        trackArtist.style.display = '';
      } else {
        trackArtist.style.display = 'none';
      }
      trackMeta.classList.add('visible');

      if (thumbnailUrl) {
        albumArt.crossOrigin = 'anonymous';
        albumArt.src = thumbnailUrl;
        albumArt.classList.add('visible');
      }
      linkStatus.textContent = 'Spotify URL';
      spotifyLoaded = true;

    } catch (e) {
      console.error('Spotify fetch error:', e);
      spotifyLoaded = false;
      albumArt.src = 'placeholder.png';
      albumArt.classList.add('visible');
      document.getElementById('track-title').textContent = 'the blue got here before the song did';
      document.getElementById('track-artist').style.display = 'none';
      document.getElementById('track-meta').classList.add('visible');
      linkStatus.textContent = 'Could not load — check the link';
      linkStatus.classList.add('error');
    }
  }, 600);
});

function selectComposition(btn) {
  btn.parentElement.querySelectorAll('button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  updateGradient();
}

const canvas = document.getElementById('gradient-canvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  canvas.width  = rect.width  * window.devicePixelRatio;
  canvas.height = rect.height * window.devicePixelRatio;
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
  updateGradient();
}

function getColors() {
  return Array.from(document.querySelectorAll('.color-box'))
    .filter(box => !box.classList.contains('empty'))
    .map(box => {
      const rgb = window.getComputedStyle(box).backgroundColor;
      const match = rgb.match(/\d+/g);
      if (!match) return null;
      return '#' + match.map(x => parseInt(x).toString(16).padStart(2, '0')).join('');
    })
    .filter(Boolean);
}

// ── Shapes composition ───────────────────────────────────────────────────────
function generateShapes(colors, w, h, spread) {
  const count   = 300 + Math.floor(Math.random() * 151); // 300–450
  const minDim  = Math.min(w, h);
  const minSize = minDim * lerp(0.008, 0.015, spread);
  const maxSize = minDim * lerp(0.04,  0.10,  spread);
  const shapes  = [];
  for (let i = 0; i < count; i++) {
    shapes.push({
      ci:       Math.floor(Math.random() * colors.length),
      x:        Math.random() * w,
      y:        Math.random() * h,
      size:     minSize + Math.random() * (maxSize - minSize),
      sides:    3 + Math.floor(Math.random() * 28), // 3–30 sides
      rotation: Math.random() * Math.PI * 2,
    });
  }
  return shapes;
}

function drawShapesOnCanvas(ctx, shapes, colors, opacity) {
  const alphaHex = toHex2(lerp(0x18, 0xBB, opacity));
  // One Path2D per color — single fill call per color
  const groups = colors.map(() => new Path2D());
  shapes.forEach(({ ci, x, y, size, sides, rotation }) => {
    const p = groups[ci];
    for (let i = 0; i <= sides; i++) {
      const a = (i / sides) * Math.PI * 2 + rotation;
      i === 0 ? p.moveTo(x + Math.cos(a) * size, y + Math.sin(a) * size)
              : p.lineTo(x + Math.cos(a) * size, y + Math.sin(a) * size);
    }
    p.closePath();
  });
  ctx.globalCompositeOperation = 'source-over';
  groups.forEach((path, i) => {
    ctx.fillStyle = colors[i] + alphaHex;
    ctx.fill(path);
  });
}

function buildDrawPoints(composition, colors, w, h, spread) {
  const cx = w * 0.5;
  const cy = h * 0.5;
  const n  = colors.length;

  if (composition === 'grid') {
    const cellSize = w * 0.12;
    const padding  = cellSize * 0.75;
    const usableW  = w - padding * 2;
    const usableH  = h - padding * 2;
    const cols = Math.max(1, Math.round(usableW / cellSize));
    const rows = Math.max(1, Math.round(usableH / cellSize));
    const total = cols * rows;

    const pool = Array.from({ length: total }, (_, i) => colors[i % n]);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    const pts = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        pts.push({
          color:  pool[r * cols + c],
          x:      padding + (cols > 1 ? (c / (cols - 1)) * usableW : usableW / 2),
          y:      padding + (rows > 1 ? (r / (rows - 1)) * usableH : usableH / 2),
          radius: cellSize * lerp(0.55, 0.18, spread)
        });
      }
    }
    return pts;
  }

  if (composition === 'radial') {
    return colors.map((color, i) => {
      if (i === 0) {
        return { color, x: cx, y: cy, radius: Math.min(w, h) * lerp(0.65, 0.4, spread) };
      }
      const angle  = ((i - 1) / Math.max(n - 1, 1)) * Math.PI * 2;
      const orbit  = Math.min(w, h) * lerp(0.02, 0.4, spread);
      const radius = Math.min(w, h) * lerp(0.6, 0.32, spread);
      return { color, x: cx + Math.cos(angle) * orbit, y: cy + Math.sin(angle) * orbit, radius };
    });
  }

  if (composition === 'full-bleed') {
    const pts = [];
    const cols = 4, rows = 4;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        pts.push({
          color:  colors[(r * cols + c) % n],
          x:      ((c + 0.5) / cols) * w,
          y:      ((r + 0.5) / rows) * h,
          radius: Math.min(w, h) * lerp(0.65, 0.38, spread)
        });
      }
    }
    return pts;
  }

  return [];
}

function updateGradient() {
  const spread      = parseInt(spreadSlider.value)  / 100;
  const density     = parseInt(densitySlider.value) / 100;
  const activeBtn   = document.querySelector('.comp-btn.active');
  const composition = activeBtn ? activeBtn.textContent.toLowerCase().trim() : 'full-bleed';

  const colors = getColors();
  const rect   = canvas.getBoundingClientRect();
  const w = rect.width;
  const h = rect.height;

  ctx.clearRect(0, 0, w, h);

  if (composition === 'shapes') {
    drawShapesOnCanvas(ctx, generateShapes(colors, w, h, spread), colors, density);
  } else {
    ctx.globalCompositeOperation = 'lighter';
    const innerHex = toHex2(lerp(0x08, 0x99, density));
    const midHex   = toHex2(lerp(0x04, 0x44, density));
    buildDrawPoints(composition, colors, w, h, spread).forEach(({ color, x, y, radius }) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
      g.addColorStop(0,   color + innerHex);
      g.addColorStop(0.5, color + midHex);
      g.addColorStop(1,   color + '00');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    });
    ctx.globalCompositeOperation = 'source-over';
  }

  const noise = parseInt(noiseSlider.value) / 100;
  if (noise > 0) applyNoise(noise, w, h);
}

function applyNoise(level, w, h) {
  const pw = Math.floor(w * window.devicePixelRatio);
  const ph = Math.floor(h * window.devicePixelRatio);
  const imageData = ctx.getImageData(0, 0, pw, ph);
  const data      = imageData.data;
  const strength  = level * 120;
  for (let i = 0; i < data.length; i += 4) {
    const n = (Math.random() - 0.5) * strength;
    data[i]     = Math.max(0, Math.min(255, data[i]     + n));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + n));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + n));
  }
  ctx.putImageData(imageData, 0, 0);
}

window.addEventListener('resize', resizeCanvas);

// Randomize controls on every dashboard load (when no Spotify link is present)
randomInitControls();
resizeCanvas();

document.querySelector('.generate-btn').addEventListener('click', function () {
  const activeBtn   = document.querySelector('.comp-btn.active');
  const composition = activeBtn ? activeBtn.textContent.toLowerCase().trim() : 'full-bleed';

  const albumArtEl    = document.getElementById('album-art');
  const trackTitleEl  = document.getElementById('track-title');
  const trackArtistEl = document.getElementById('track-artist');

  const state = {
    colors:        getColors(),
    spread:        parseInt(spreadSlider.value),
    opacity:       parseInt(densitySlider.value),
    noise:         parseInt(noiseSlider.value),
    composition,
    spotifyLoaded,
    audioFeatures,
    previewUrl,
    track: {
      title:     trackTitleEl.textContent  || '',
      artist:    trackArtistEl.textContent || '',
      artistUrl: trackArtistEl.href        || '#',
      albumArt:  albumArtEl.src            || ''
    }
  };

  console.log('Dashboard state:', state);
  localStorage.setItem('dashboardState', JSON.stringify(state));
  window.location.href = 'viewer.html';
});
