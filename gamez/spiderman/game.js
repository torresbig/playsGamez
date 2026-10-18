// Spider Swing v3.3 - clean rebuild (chunk 1/3)
console.log('[spider] v3.3 loading');
window.addEventListener('error', e => {
  console.error('[spider] global error:', e.message, e.filename + ':' + e.lineno);
  const s = document.getElementById('score');
  if (s) s.textContent = 'ERR: ' + e.message;
});

const canvas = document.getElementById('gameCanvas');
const ctx = canvas ? canvas.getContext('2d') : null;
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const livesEl = document.getElementById('lives');
console.log('[spider] canvas=' + !!canvas + ' ctx=' + !!ctx + ' lives=' + !!livesEl);
if (!canvas || !ctx) { throw new Error('canvas/ctx missing - check index.html'); }

const BEST_KEY = 'playsgamez_spiderman_best';
let best = +(localStorage.getItem(BEST_KEY) || 0);
if (bestEl) bestEl.textContent = best ? 'Best: ' + best + ' m' : 'Best: 0 m';

// --- State ---
let W = 900, H = 600, groundY = 528, camX = 0;
let spidey = { x: 200, y: 300, vx: 0, vy: 0, r: 14 };
let anchor = { x: 0, y: 0, active: false };
let webLen = 0, lastAnchor = { x: 0, y: 0 };
let gravity = 0.62, friction = 0.997, bounce = 0.32;
let score = 0, maxDistX = 0, t = 0, lastT = 0;
let buildings = [], bridges = [], skyObjects = [], anchors = [];
let missFlash = 0, hoverAnchor = null;
let lives = 3, maxLives = 3, invuln = 0, gameOver = false;
let noAuto = null; // anchor the player deliberately let go of (don't auto-catch it)
let debugLines = [];
const DEBUG_ON = typeof location !== 'undefined' && /[?&]debug=1/.test(location.search); // ?debug=1 shows the overlay

function dbg(m) {
  if (!DEBUG_ON) return;
  debugLines.push(m);
  if (debugLines.length > 6) debugLines.shift();
  console.log('[spider] ' + m);
}

function rand(a, b) { return a + Math.random() * (b - a); }

function updateLivesUI() {
  if (!livesEl) return;
  let s = '';
  for (let i = 0; i < maxLives; i++) s += i < lives ? '\u2665' : '\u2661';
  livesEl.textContent = s;
  livesEl.style.color = invuln > 0 ? '#ffd500' : (lives <= 1 ? '#ff3333' : '#ff1a1a');
}

function getSize() {
  const r = canvas.getBoundingClientRect();
  const w = Math.min(Math.max(r.width, 400), 900);
  const h = Math.min(Math.max(r.height, 300), 600);
  return { w, h };
}

function resize() {
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const sz = getSize();
  W = sz.w; H = sz.h;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  groundY = H * 0.88;
  dbg('resize ' + Math.round(W) + 'x' + Math.round(H) + ' gy=' + Math.round(groundY));
}
resize();
window.addEventListener('resize', resize);

// --- World generation ---
function addAnchorsForBuilding(b) {
  const pad = 7;
  anchors.push({ x: b.x + pad, y: b.y, type: 'roof' });
  anchors.push({ x: b.x + b.w - pad, y: b.y, type: 'roof' });
  anchors.push({ x: b.x + b.w / 2, y: b.y - 16, type: 'pole' });
  if (b.w > 115) {
    anchors.push({ x: b.x + b.w * 0.33, y: b.y, type: 'roof' });
    anchors.push({ x: b.x + b.w * 0.66, y: b.y, type: 'roof' });
  }
  if (b.h > 170 && Math.random() < 0.55)
    anchors.push({ x: b.x + rand(10, b.w - 10), y: b.y + rand(18, Math.min(80, b.h * 0.42)), type: 'wall' });
  if (b.h > 300 && Math.random() < 0.45)
    anchors.push({ x: b.x + rand(12, b.w - 12), y: b.y + rand(90, Math.min(190, b.h * 0.55)), type: 'wall' });
}

function rollHeight() {
  const r = Math.random();
  if (r < 0.20) return rand(370, Math.min(545, groundY - 18)); // skyscraper
  if (r < 0.58) return rand(225, 375);                          // mid
  return rand(115, 215);                                        // low
}

function addBuilding(x) {
  const bh = rollHeight();
  const bw = 62 + Math.random() * 125;
  const b = { x, y: groundY - bh, w: bw, h: bh };
  buildings.push(b);
  addAnchorsForBuilding(b);
  return b;
}

function maybeBridge(a, b) {
  if (Math.random() > 0.34) return;
  if (a.h <= 140 && b.h <= 140) return;
  const by = Math.min(a.y, b.y) - rand(14, 38);
  const gap = b.x - (a.x + a.w);
  if (gap <= 16) return;
  const br = { x: a.x + a.w - 6, y: by, w: gap + 12, h: 9 };
  bridges.push(br);
  anchors.push({ x: br.x + 6, y: br.y, type: 'bridge' });
  anchors.push({ x: br.x + br.w - 6, y: br.y, type: 'bridge' });
  anchors.push({ x: br.x + br.w / 2, y: br.y, type: 'bridge' });
}

function spawnSkyAhead(baseX) {
  if (Math.random() < 0.62) return; // rare
  const r = Math.random();
  let kind = 'zeppelin';
  if (r < 0.33) kind = 'plane';
  else if (r < 0.66) kind = 'zeppelin';
  else kind = 'ufo';
  const y = rand(28, Math.max(40, Math.min(groundY - 260, H * 0.52)));
  const w = kind === 'plane' ? 70 : (kind === 'zeppelin' ? 96 : 58);
  const h = kind === 'plane' ? 20 : (kind === 'zeppelin' ? 28 : 20);
  const speed = kind === 'plane' ? rand(38, 66) : (kind === 'zeppelin' ? rand(18, 30) : rand(28, 48));
  const x = baseX + rand(-60, 80);
  const o = { x, y, w, h, kind, speed, anchorOffY: 10 };
  skyObjects.push(o);
  anchors.push({ x: o.x + o.w / 2, y: o.y + o.anchorOffY, type: 'sky', obj: o });
}

function genBuildings() {
  buildings = []; bridges = []; skyObjects = []; anchors = [];
  let x = 0;
  while (x < W + 900) {
    const b = addBuilding(x);
    if (buildings.length > 1) maybeBridge(buildings[buildings.length - 2], b);
    x += b.w + 12 + Math.random() * 34;
  }
  for (let i = 0; i < 3; i++) spawnSkyAhead(W * 0.3 + i * 260);
  dbg('gen b=' + buildings.length + ' a=' + anchors.length);
}
function ensureBuildings() {
  let farX = buildings.length ? buildings[buildings.length - 1].x + buildings[buildings.length - 1].w : 0;
  const need = camX + W + 800;
  let guard = 0;
  while (farX < need && guard++ < 200) {
    farX += 11 + Math.random() * 30;
    const b = addBuilding(farX);
    if (buildings.length > 1) maybeBridge(buildings[buildings.length - 2], b);
    farX += b.w;
    if (Math.random() < 0.10) spawnSkyAhead(farX + rand(20, 90));
  }
  while (buildings.length > 44 && buildings[0].x + buildings[0].w < camX - 950) buildings.shift();
  bridges = bridges.filter(br => br.x + br.w > camX - 950);
  anchors = anchors.filter(a => {
    if (a.type === 'sky') return a.obj && skyObjects.includes(a.obj);
    return a.x > camX - 950;
  });
}

// nearest usable anchor for auto-save / start (ahead of and above spidey)
function bestSaveAnchor(minDist, maxDist, aheadOnly, ignoreNoAuto) {
  let nb = null, nd = 0, best = -Infinity;
  for (const a of anchors) {
    const dxA = a.x - spidey.x;
    if (aheadOnly && dxA < 10) continue;              // strictly ahead -> saves push forward
    if (a.y > spidey.y - 30) continue;                // must be above
    if (!ignoreNoAuto && noAuto && a.x === noAuto.x && a.y === noAuto.y) continue; // not the one just released
    const d = Math.hypot(dxA, a.y - spidey.y);
    if (d < minDist || d > maxDist) continue;
    // prefer anchors that carry you forward (not the nearest one straight overhead)
    const score = dxA - Math.abs(d - 230) * 0.35;
    if (score > best) { best = score; nb = a; nd = d; }
  }
  return nb ? { a: nb, d: nd } : null;
}

function attachTo(a, d) {
  anchor.x = a.x; anchor.y = a.y; anchor.active = true;
  webLen = Math.max(70, Math.min(430, d));
  lastAnchor = { x: a.x, y: a.y };
  noAuto = null;
}

// rescue anchor: always prefer one AHEAD so saves push you forward, never pull back
function saveAnchor(ignoreNoAuto) {
  return bestSaveAnchor(60, 440, true, ignoreNoAuto) || bestSaveAnchor(60, 440, false, ignoreNoAuto);
}

// guarantees the game always starts on a rope (synthesises a pole if needed)
function ensureStartAnchor() {
  // a usable anchor: reachable AND its swing arc stays clear of the ground
  const usable = s => s && (s.a.y + Math.min(430, s.d) < groundY - 55);
  let s = bestSaveAnchor(130, 430, true, true);
  if (!usable(s)) s = bestSaveAnchor(60, 430, false, true);
  if (usable(s)) { attachTo(s.a, Math.min(s.d, groundY - 60 - s.a.y)); return; }
  // nothing usable -> build a launch pole high enough to swing safely
  const pa = { x: spidey.x + 175, y: groundY - Math.min(360, H * 0.66), type: 'pole', mast: true };
  anchors.push(pa);
  attachTo(pa, Math.min(220, groundY - 70 - pa.y));
}

function reset() {
  spidey.x = W * 0.25; spidey.y = groundY - 140;
  spidey.vx = 3.5; spidey.vy = 0;
  anchor.active = false; webLen = 0;
  score = 0; maxDistX = spidey.x; camX = 0;
  missFlash = 0; hoverAnchor = null;
  lives = maxLives; invuln = 0; gameOver = false; noAuto = null;
  lastAnchor = { x: spidey.x + 150, y: groundY - 230 };
  if (scoreEl) scoreEl.textContent = 'Distanz: 0 m';
  updateLivesUI();
  genBuildings();
  ensureStartAnchor();
  dbg('reset ok x=' + Math.round(spidey.x) + ' rope=' + Math.round(webLen));
}

// --- Anchoring (only real objects, never "air") ---
function findBestAnchor(sx, sy) {
  let bestA = null, bestD = Infinity;
  const MAX_CLICK = 82, MIN_ROPE = 34, MAX_ROPE = 440;
  for (const a of anchors) {
    const dClick = Math.hypot((a.x - camX) - sx, a.y - sy);
    if (dClick > MAX_CLICK) continue;
    const rope = Math.hypot(spidey.x - a.x, spidey.y - a.y);
    if (rope < MIN_ROPE || rope > MAX_ROPE) continue;
    if (a.x < spidey.x - 120) continue; // no backwards shots
    if (dClick < bestD) { bestD = dClick; bestA = a; }
  }
  return bestA;
}

function shootWeb(tx, ty) {
  if (gameOver) return;
  const target = findBestAnchor(tx, ty);
  if (!target) {
    missFlash = 0.5;
    dbg('miss ' + Math.round(tx) + ',' + Math.round(ty) + ' anchors=' + anchors.length);
    return;
  }
  anchor.x = target.x; anchor.y = target.y; anchor.active = true;
  const dx = spidey.x - target.x, dy = spidey.y - target.y;
  webLen = Math.hypot(dx, dy);
  if (webLen < 34) webLen = 34;
  if (webLen > 440) webLen = 440;
  lastAnchor = { x: target.x, y: target.y };
  // tangential launch kick: pick the tangent that drives FORWARD (+x)
  const d = webLen || 1;
  const nx = dx / d, ny = dy / d;
  let kx = -ny, ky = nx;                 // one of the two tangents
  if (kx < 0) { kx = -kx; ky = -ky; }    // flip so the kick points right
  if (Math.abs(kx) < 0.2) {              // anchor almost overhead -> follow momentum
    const sgn = spidey.vx >= 0 ? 1 : -1;
    kx *= sgn; ky *= sgn;
  }
  const push = 6.2;
  spidey.vx += kx * push;
  spidey.vy += ky * push - 1.0;          // slight lift out of the swing
  dbg('shoot ' + target.type + ' len=' + Math.round(webLen));
}

function getMousePos(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) / (rect.width / W),
    y: (e.clientY - rect.top) / (rect.height / H)
  };
}

canvas.addEventListener('mousedown', e => {
  if (gameOver) { reset(); return; }
  const p = getMousePos(e);
  shootWeb(p.x, p.y);
});
canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  if (gameOver) { reset(); return; }
  const p = getMousePos(e.touches[0]);
  shootWeb(p.x, p.y);
}, { passive: false });
canvas.addEventListener('mousemove', e => {
  const p = getMousePos(e);
  hoverAnchor = findBestAnchor(p.x, p.y);
});
canvas.addEventListener('mouseleave', () => { hoverAnchor = null; });

document.addEventListener('keydown', e => {
  if (e.key === 'r' || e.key === 'R') { reset(); return; }
  if (gameOver) return;
  if (e.key === 's' || e.key === 'S') {
    if (anchor.active) { anchor.active = false; noAuto = { x: lastAnchor.x, y: lastAnchor.y }; dbg('release'); }
    else {
      const r = Math.hypot(spidey.x - lastAnchor.x, spidey.y - lastAnchor.y);
      if (r > 34 && r < 440) {
        anchor.x = lastAnchor.x; anchor.y = lastAnchor.y;
        anchor.active = true; webLen = r;
        dbg('re-swing');
      }
    }
  }
  if (e.key === ' ' || e.key === 'w' || e.key === 'W') {
    if (anchor.active && webLen > 56) webLen = Math.max(50, webLen - 20);
  }
  if (e.key === 'ArrowUp') {
    if (anchor.active && webLen > 56) webLen = Math.max(50, webLen - 16);
  }
  if (e.key === 'ArrowDown') {
    if (anchor.active) webLen = Math.min(440, webLen + 18);
  }
});

const _rb = document.getElementById('restartBtn');
if (_rb) _rb.onclick = reset;
// --- Physics ---
function update(dt) {
  t += dt;
  const s = dt * 60; // ~1.0 at 60fps
  if (missFlash > 0) missFlash = Math.max(0, missFlash - dt);
  if (invuln > 0) invuln = Math.max(0, invuln - dt);

  // sky objects drift + follow with their anchors
  for (const o of skyObjects) o.x += o.speed * dt;
  for (const a of anchors) {
    if (a.type === 'sky' && a.obj) { a.x = a.obj.x + a.obj.w / 2; a.y = a.obj.y + a.obj.anchorOffY; }
  }
  skyObjects = skyObjects.filter(o => o.x < camX + W + 700);
  anchors = anchors.filter(a => a.type !== 'sky' || (a.obj && skyObjects.includes(a.obj)));

  if (gameOver) return;

  // gravity always on
  spidey.vy += gravity * s;

  if (anchor.active) {
    // auto reel: shorten rope so the swing keeps lifting you
    const reel = 55 * dt + Math.min(26, Math.abs(spidey.vx) * 0.06 * s);
    webLen = Math.max(50, webLen - reel);

    // integrate
    spidey.x += spidey.vx * s;
    spidey.y += spidey.vy * s;

    // rope constraint (taut -> pull onto circle, kill outward radial velocity)
    const dx = spidey.x - anchor.x, dy = spidey.y - anchor.y;
    const d = Math.hypot(dx, dy) || 0.0001;
    if (d > webLen) {
      const nx = dx / d, ny = dy / d;
      spidey.x = anchor.x + nx * webLen;
      spidey.y = anchor.y + ny * webLen;
      const vd = spidey.vx * nx + spidey.vy * ny;
      if (vd > 0) { spidey.vx -= vd * nx; spidey.vy -= vd * ny; }
    }
    spidey.vx *= friction;
    spidey.vy *= friction;
  } else {
    spidey.x += spidey.vx * s;
    spidey.y += spidey.vy * s;
    spidey.vx *= friction;
    spidey.vy *= friction;
  }

  // auto web: falling without a rope -> catch a different anchor (never the one you released)
  if (!anchor.active && spidey.vy > 2 && spidey.y > groundY - 260) {
    const sv = saveAnchor(false);
    if (sv) { attachTo(sv.a, Math.max(85, sv.d * 0.85)); dbg('auto-web'); }
  }

  // ground -> costs a life, but Spidey catches himself with a web
  if (spidey.y + spidey.r > groundY) {
    spidey.y = groundY - spidey.r;
    if (invuln <= 0 && !gameOver) {
      lives--;
      updateLivesUI();
      invuln = 2.2;
      if (lives <= 0) {
        gameOver = true;
        anchor.active = false;
        dbg('GAME OVER');
      } else {
        spidey.vy = -14 - Math.random() * 1.5;
        if (Math.abs(spidey.vx) < 3.5) spidey.vx = 3.8;
        const sv = saveAnchor(true);
        if (sv) {
          attachTo(sv.a, Math.min(sv.d * 0.7, 230)); // short rope = strong pull up
          spidey.y = groundY - spidey.r - 34;
          dbg('web-save lives=' + lives);
        } else dbg('hit ground lives=' + lives);
      }
    } else {
      spidey.vy *= -bounce;
      spidey.vx *= 0.7;
      if (Math.abs(spidey.vy) < 0.6) spidey.vy = 0;
      if (!anchor.active) {
        const sv = saveAnchor(true);
        if (sv) { attachTo(sv.a, Math.min(sv.d * 0.7, 230)); spidey.y = groundY - spidey.r - 34; }
      }
    }
  }
  if (spidey.x < camX + spidey.r) { spidey.x = camX + spidey.r; spidey.vx *= -0.5; }
  if (spidey.y < spidey.r) { spidey.y = spidey.r; spidey.vy *= -0.5; }

  // camera + endless city
  const targetCam = Math.max(0, spidey.x - W * 0.35);
  camX += (targetCam - camX) * Math.min(1, 6 * dt);
  ensureBuildings();

  // score
  if (spidey.x > maxDistX) maxDistX = spidey.x;
  score = Math.floor(maxDistX - W * 0.25);
  if (score < 0) score = 0;
  if (scoreEl) scoreEl.textContent = 'Distanz: ' + score + ' m';
  if (score > best) {
    best = score;
    try { localStorage.setItem(BEST_KEY, best); } catch (e) {}
    if (bestEl) bestEl.textContent = 'Best: ' + best + ' m';
  }
}
// --- Render ---
function draw() {
  // sky
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0a0a16'); g.addColorStop(1, '#020205');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  // stars
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  for (let i = 0; i < 60; i++) {
    const sx = ((t * 5 + i * 37) % (W + 40)) - 20;
    const sy = (i * 91) % H;
    ctx.fillRect(sx, sy, 1.2, 1.2);
  }

  // moon
  ctx.fillStyle = '#fdfbd3';
  ctx.beginPath(); ctx.arc(W * 0.85, H * 0.18, 40, 0, Math.PI * 2); ctx.fill();

  // buildings
  for (const b of buildings) {
    const sx = b.x - camX;
    if (sx + b.w < -80 || sx > W + 80) continue;
    ctx.fillStyle = '#08080b';
    ctx.fillRect(sx, b.y, b.w, b.h);
    // windows (deterministic)
    ctx.fillStyle = 'rgba(255,255,220,0.15)';
    const cols = Math.floor(b.w / 16), rows = Math.floor(b.h / 20);
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const hsh = ((c * 73856093) ^ (r * 19349663) ^ ((b.x | 0) * 83492791)) >>> 0;
        if ((hsh % 100) > 72) ctx.fillRect(sx + 6 + c * 16, b.y + 6 + r * 20, 10, 10);
      }
    }
    // skyscraper antenna
    if (b.h > 360) {
      ctx.fillStyle = '#1a1a2a';
      ctx.fillRect(sx + b.w / 2 - 3, b.y - 18, 6, 18);
      ctx.fillStyle = '#ff1a1a';
      ctx.fillRect(sx + b.w / 2 - 1, b.y - 22, 2, 5);
    }
  }

  // bridges
  for (const br of bridges) {
    const sx = br.x - camX;
    if (sx + br.w < -40 || sx > W + 40) continue;
    ctx.fillStyle = '#2a2a34'; ctx.fillRect(sx, br.y, br.w, br.h);
    ctx.fillStyle = '#3a3a4a'; ctx.fillRect(sx, br.y - 2, br.w, 2);
    ctx.strokeStyle = 'rgba(180,180,200,0.35)'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
      const px = sx + br.w * (0.25 + i * 0.25);
      ctx.beginPath(); ctx.moveTo(px, br.y); ctx.lineTo(px, br.y + 22); ctx.stroke();
    }
  }

  // sky objects (plane / zeppelin / ufo)
  for (const o of skyObjects) {
    const sx = o.x - camX, sy = o.y;
    if (sx < -120 || sx > W + 120) continue;
    if (o.kind === 'plane') {
      ctx.fillStyle = '#dde3ea';
      ctx.beginPath();
      ctx.moveTo(sx, sy + 8); ctx.lineTo(sx + 44, sy + 8); ctx.lineTo(sx + 70, sy + 6);
      ctx.lineTo(sx + 62, sy + 12); ctx.lineTo(sx + 10, sy + 14);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#8aa0b8'; ctx.fillRect(sx + 18, sy + 4, 22, 8);
    } else if (o.kind === 'zeppelin') {
      ctx.fillStyle = '#c8d0dc';
      ctx.beginPath(); ctx.ellipse(sx + 48, sy + 14, 46, 13, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#5b6a7a'; ctx.fillRect(sx + 32, sy + 22, 32, 6);
    } else {
      ctx.fillStyle = '#6a7a8a';
      ctx.beginPath(); ctx.ellipse(sx + 29, sy + 14, 26, 9, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#aef0ff';
      ctx.beginPath(); ctx.ellipse(sx + 29, sy + 8, 14, 8, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#00eaff'; ctx.shadowColor = '#00eaff'; ctx.shadowBlur = 5;
    ctx.beginPath(); ctx.arc(sx + o.w / 2, sy + o.anchorOffY, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
  }

  // ground
  ctx.fillStyle = '#111'; ctx.fillRect(0, groundY, W, H - groundY);
  ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, groundY); ctx.lineTo(W, groundY); ctx.stroke();

  // anchors
  for (const a of anchors) {
    const sx = a.x - camX, sy = a.y;
    if (sx < -20 || sx > W + 20 || sy < -20 || sy > H + 20) continue;
    const isHover = hoverAnchor === a;
    const isActive = anchor.active && Math.abs(anchor.x - a.x) < 0.5 && Math.abs(anchor.y - a.y) < 0.5;
    if (isActive) {
      ctx.fillStyle = '#00eaff'; ctx.shadowColor = '#00eaff'; ctx.shadowBlur = 14;
      ctx.beginPath(); ctx.arc(sx, sy, 6, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    } else if (a.type === 'sky') {
      ctx.fillStyle = isHover ? '#ffd500' : '#00eaff';
      ctx.beginPath(); ctx.arc(sx, sy, 4.5, 0, Math.PI * 2); ctx.fill();
    } else if (a.type === 'bridge') {
      ctx.fillStyle = isHover ? '#ffd500' : '#6a6a7a';
      ctx.beginPath(); ctx.arc(sx, sy, 4.5, 0, Math.PI * 2); ctx.fill();
    } else if (a.type === 'pole') {
      if (a.mast) { // launch mast standing on the ground
        ctx.strokeStyle = 'rgba(120,120,140,0.5)'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx, groundY); ctx.stroke();
      }
      ctx.fillStyle = isHover ? '#ffd500' : '#cc3300';
      ctx.beginPath(); ctx.arc(sx, sy, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#333'; ctx.fillRect(sx - 1, sy, 2, 14);
    } else if (a.type === 'wall') {
      ctx.fillStyle = isHover ? '#ffd500' : '#00ff88';
      ctx.beginPath(); ctx.arc(sx, sy, 3.5, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = isHover ? '#ffd500' : '#00eaff';
      ctx.beginPath(); ctx.arc(sx, sy, 4, 0, Math.PI * 2); ctx.fill();
    }
  }
  // miss flash
  if (missFlash > 0) {
    ctx.fillStyle = 'rgba(255,60,60,' + (missFlash * 0.9) + ')';
    ctx.font = 'bold 20px Arial'; ctx.textAlign = 'center';
    ctx.fillText('Kein Halt! Nur auf Dach/Bruecke/Himmel-Objekt zielen', W / 2, 46);
    ctx.textAlign = 'start';
  }

  // rope
  if (anchor.active) {
    ctx.strokeStyle = 'rgba(0,234,255,0.72)'; ctx.lineWidth = 2.8;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(spidey.x - camX, spidey.y);
    ctx.lineTo(anchor.x - camX, anchor.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // spidey
  const sx = spidey.x - camX, sy = spidey.y;
  if (invuln > 0 && Math.floor(t * 12) % 2 === 0) ctx.globalAlpha = 0.45;
  ctx.fillStyle = '#d00'; ctx.shadowColor = '#d00'; ctx.shadowBlur = 14;
  ctx.beginPath(); ctx.arc(sx, sy, spidey.r, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0; ctx.globalAlpha = 1;
  ctx.fillStyle = '#0033a0';
  ctx.beginPath();
  ctx.arc(sx - 5, sy - 4, 7, 0, Math.PI * 2);
  ctx.arc(sx + 5, sy - 4, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(sx - 5, sy - 4, 3.2, 0, Math.PI * 2);
  ctx.arc(sx + 5, sy - 4, 3.2, 0, Math.PI * 2);
  ctx.fill();

  // hints
  if (!anchor.active && !gameOver) {
    ctx.fillStyle = hoverAnchor ? 'rgba(255,213,0,0.95)' : 'rgba(255,255,255,0.5)';
    ctx.font = 'bold 15px Arial'; ctx.textAlign = 'center';
    ctx.fillText(hoverAnchor ? 'Klick: schwingen!' : 'Ziele auf leuchtenden Punkt', sx, sy - 30);
    ctx.textAlign = 'start';
  }
  if (anchor.active) {
    ctx.fillStyle = 'rgba(0,234,255,0.55)'; ctx.font = '13px Arial'; ctx.textAlign = 'center';
    ctx.fillText('S/Klick=los  W/Space/Up=kuerzen  Down=laenger', W / 2, H - 14);
    ctx.textAlign = 'start';
  }

  // game over
  if (gameOver) {
    ctx.fillStyle = 'rgba(0,0,0,0.62)'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ff3333'; ctx.font = 'bold 36px Arial'; ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', W / 2, H / 2 - 10);
    ctx.fillStyle = '#fff'; ctx.font = '18px Arial';
    ctx.fillText('Distanz: ' + score + ' m  (Best: ' + best + ' m)', W / 2, H / 2 + 18);
    ctx.fillStyle = '#9fd9e2'; ctx.font = '15px Arial';
    ctx.fillText('Klick oder R = Neustart', W / 2, H / 2 + 42);
    ctx.textAlign = 'start';
  }

  // debug overlay
  if (DEBUG_ON && debugLines.length) {
    ctx.fillStyle = 'rgba(0,0,0,0.58)';
    ctx.fillRect(4, 4, 180, 14 + debugLines.length * 12);
    ctx.fillStyle = '#0f0'; ctx.font = '10px monospace'; ctx.textAlign = 'left';
    for (let i = 0; i < debugLines.length; i++) ctx.fillText(debugLines[i], 8, 16 + i * 12);
  }

}

// --- Loop ---
function frame(ts) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.033, (ts - lastT) / 1000 || 0.016);
  lastT = ts;
  try {
    update(dt);
    draw();
  } catch (err) {
    console.error('[spider] loop error:', err);
    if (ctx) {
      ctx.fillStyle = '#300'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#fff'; ctx.font = '13px monospace'; ctx.textAlign = 'left';
      ctx.fillText('ERR: ' + err.message, 12, 30);
    }
  }
}

console.log('[spider] init');
reset();
requestAnimationFrame(frame);
console.log('[spider] running');



