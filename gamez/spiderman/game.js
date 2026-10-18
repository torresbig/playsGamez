/**
 * PlaysGamez – Spider Swing
 * Steuerung: Klick = Seil werfen · S = Seil loslassen/neu befestigen · R = Neustart
 */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');

const BEST_KEY = 'playsgamez_spiderman_best';
let best = +(localStorage.getItem(BEST_KEY) || 0);
bestEl.textContent = best ? 'Best: ' + best + ' m' : 'Best: 0 m';

let W, H;
let spidey = { x: 0, y: 0, vx: 0, vy: 0, r: 14 };
let anchor = { x: 0, y: 0, active: false };
let webLen = 0;
let lastAnchor = { x: 0, y: 0 };

let gravity = 0.7;
let friction = 0.996;
let bounce = 0.5;

let score = 0;
let maxDistX = 0;
let t = 0;
let lastT = 0;
let buildings = [];
let groundY;

function getSize() {
    const rect = canvas.getBoundingClientRect();
    let w = Math.min(Math.max(rect.width, 400), 900);
    let h = Math.min(Math.max(rect.height, 300), 600);
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
    if (spidey.x === 0) {
        spidey.x = W * 0.25;
        spidey.y = groundY - 140;
    }
    scoreEl.textContent = 'Distanz: 0 m';
}
window.addEventListener('resize', resize);
resize();

function genBuildings() {
    buildings = [];
    let x = 0;
    while (x < W + 120) {
        const bw = 60 + Math.random() * 110;
        const bh = 100 + Math.random() * 260;
        buildings.push({ x, y: groundY - bh, w: bw, h: bh });
        x += bw + 10 + Math.random() * 40;
    }
}
genBuildings();

function reset() {
    spidey.x = W * 0.25;
    spidey.y = groundY - 140;
    spidey.vx = 0;
    spidey.vy = 0;
    anchor.active = false;
    webLen = 0;
    score = 0;
    maxDistX = spidey.x;
    lastAnchor = { x: spidey.x + 160, y: groundY - 220 };
    scoreEl.textContent = 'Distanz: 0 m';
}

function shootWeb(tx, ty) {
    anchor.x = tx;
    anchor.y = ty;
    anchor.active = true;
    const dx = spidey.x - tx;
    const dy = spidey.y - ty;
    webLen = Math.sqrt(dx * dx + dy * dy) || 60;
    lastAnchor = { x: tx, y: ty };
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    spidey.vx = -(dx / d) * 5;
    spidey.vy = -(dy / d) * 5;
}

function getMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const cx = (e.clientX - rect.left) / (rect.width / W);
    const cy = (e.clientY - rect.top) / (rect.height / H);
    return { x: cx, y: cy };
}

canvas.addEventListener('mousedown', (e) => {
    const p = getMousePos(e);
    shootWeb(p.x, p.y);
});

canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const p = getMousePos(e.touches[0]);
    shootWeb(p.x, p.y);
}, { passive: false });

document.addEventListener('keydown', (e) => {
    if (e.key === 'r' || e.key === 'R') { reset(); return; }
// --- Physik-Update ---
function update(dt) {
    t += dt;
    spidey.vy += gravity * dt;

    if (anchor.active) {
        const dx = spidey.x - anchor.x;
        const dy = spidey.y - anchor.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 0.001;
        const ux = dx / d;
        const uy = dy / d;

        spidey.x = anchor.x + ux * webLen;
        spidey.y = anchor.y + uy * webLen;

        const radial = spidey.vx * ux + spidey.vy * uy;
        spidey.vx -= radial * ux;
        spidey.vy -= radial * uy;

        spidey.vx *= friction;
        spidey.vy *= friction;
    } else {
        spidey.x += spidey.vx * dt * 60;
        spidey.y += spidey.vy * dt * 60;
        spidey.vx *= friction;
        spidey.vy *= friction;
    }

    if (spidey.y + spidey.r > groundY) {
        spidey.y = groundY - spidey.r;
        spidey.vy *= -bounce;
        spidey.vx *= 0.7;
        if (Math.abs(spidey.vy) < 0.3) spidey.vy = 0;
    }
    if (spidey.x < spidey.r) { spidey.x = spidey.r; spidey.vx *= -0.5; }
    if (spidey.x > W - spidey.r) { spidey.x = W - spidey.r; spidey.vx *= -0.5; }
    if (spidey.y < spidey.r) { spidey.y = spidey.r; spidey.vy *= -0.5; }

    if (spidey.x > maxDistX) maxDistX = spidey.x;
    score = Math.floor(maxDistX - W * 0.25);
    if (score < 0) score = 0;
    scoreEl.textContent = 'Distanz: ' + score + ' m';
    if (score > best) {
        best = score;
        localStorage.setItem(BEST_KEY, best);
        bestEl.textContent = 'Best: ' + best + ' m';
    }
}

function draw() {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#0a0a16');
    grad.addColorStop(1, '#020205');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    for (let i = 0; i < 60; i++) {
        const sx = (t * 5 + i * 37) % W;
        const sy = (i * 91) % H;
        ctx.fillRect(sx, sy, 1.2, 1.2);
    }

    ctx.fillStyle = '#fdfbd3';
    ctx.beginPath();
    ctx.arc(W * 0.85, H * 0.18, 40, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#08080b';
    for (const b of buildings) {
        ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.fillStyle = 'rgba(255,255,220,0.15)';
        const cols = Math.floor(b.w / 16);
        const rows = Math.floor(b.h / 20);
        for (let c = 0; c < cols; c++) {
            for (let r = 0; r < rows; r++) {
                if (Math.random() > 0.72) {
                    ctx.fillRect(b.x + 6 + c * 16, b.y + 6 + r * 20, 10, 10);
                }
            }
        }
        ctx.fillStyle = '#08080b';
    }

    ctx.fillStyle = '#111';
    ctx.fillRect(0, groundY, W, H - groundY);
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(W, groundY);
    ctx.stroke();

    if (anchor.active) {
        ctx.strokeStyle = 'rgba(0, 234, 255, 0.55)';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(spidey.x, spidey.y);
        ctx.lineTo(anchor.x, anchor.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#00eaff';
        ctx.shadowColor = '#00eaff';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(anchor.x, anchor.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    ctx.fillStyle = '#d00';
    ctx.shadowColor = '#d00';
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(spidey.x, spidey.y, spidey.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#0033a0';
    ctx.beginPath();
    ctx.arc(spidey.x - 5, spidey.y - 4, 7, 0, Math.PI * 2);
    ctx.arc(spidey.x + 5, spidey.y - 4, 7, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(spidey.x - 5, spidey.y - 4, 3.2, 0, Math.PI * 2);
    ctx.arc(spidey.x + 5, spidey.y - 4, 3.2, 0, Math.PI * 2);
    ctx.fill();

    if (!anchor.active) {
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Klicke zum Seilwerfen · S = Schwingen', spidey.x, spidey.y - 30);
        ctx.textAlign = 'start';
    }

    if (anchor.active) {
        ctx.fillStyle = 'rgba(0,234,255,0.5)';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('S = Seil loslassen', W / 2, 40);
        ctx.textAlign = 'start';
    }
}

function frame(ts) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.033, (ts - lastT) / 1000 || 0.016);
    lastT = ts;
    update(dt);
    draw();
}

reset();
requestAnimationFrame(frame);

    if (e.key === 's' || e.key === 'S') {
        if (anchor.active) {
            anchor.active = false;
        } else {
            anchor.x = lastAnchor.x;
            anchor.y = lastAnchor.y;
            anchor.active = true;
            const dx = spidey.x - anchor.x;
            const dy = spidey.y - anchor.y;
            webLen = Math.sqrt(dx * dx + dy * dy) || 80;
        }
    }
});

document.getElementById('restartBtn').onclick = reset;

// --- Physik-Update ---
function update(dt) {
    t += dt;
    spidey.vy += gravity * dt;

    if (anchor.active) {
        const dx = spidey.x - anchor.x;
        const dy = spidey.y - anchor.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 0.001;
        const ux = dx / d;
        const uy = dy / d;

        spidey.x = anchor.x + ux * webLen;
        spidey.y = anchor.y + uy * webLen;

        const radial = spidey.vx * ux + spidey.vy * uy;
        spidey.vx -= radial * ux;
        spidey.vy -= radial * uy;

        spidey.vx *= friction;
        spidey.vy *= friction;
    } else {
        spidey.x += spidey.vx * dt * 60;
        spidey.y += spidey.vy * dt * 60;
        spidey.vx *= friction;
        spidey.vy *= friction;
    }

    if (spidey.y + spidey.r > groundY) {
        spidey.y = groundY - spidey.r;
        spidey.vy *= -bounce;
        spidey.vx *= 0.7;
        if (Math.abs(spidey.vy) < 0.3) spidey.vy = 0;
    }
    if (spidey.x < spidey.r) { spidey.x = spidey.r; spidey.vx *= -0.5; }
    if (spidey.x > W - spidey.r) { spidey.x = W - spidey.r; spidey.vx *= -0.5; }
    if (spidey.y < spidey.r) { spidey.y = spidey.r; spidey.vy *= -0.5; }

    if (spidey.x > maxDistX) maxDistX = spidey.x;
    score = Math.floor(maxDistX - W * 0.25);
    if (score < 0) score = 0;
    scoreEl.textContent = 'Distanz: ' + score + ' m';
    if (score > best) {
        best = score;
        localStorage.setItem(BEST_KEY, best);
        bestEl.textContent = 'Best: ' + best + ' m';
    }
}

function draw() {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#0a0a16');
    grad.addColorStop(1, '#020205');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    for (let i = 0; i < 60; i++) {
        const sx = (t * 5 + i * 37) % W;
        const sy = (i * 91) % H;
        ctx.fillRect(sx, sy, 1.2, 1.2);
    }

    ctx.fillStyle = '#fdfbd3';
    ctx.beginPath();
    ctx.arc(W * 0.85, H * 0.18, 40, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#08080b';
    for (const b of buildings) {
        ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.fillStyle = 'rgba(255,255,220,0.15)';
        const cols = Math.floor(b.w / 16);
        const rows = Math.floor(b.h / 20);
        for (let c = 0; c < cols; c++) {
            for (let r = 0; r < rows; r++) {
                if (Math.random() > 0.72) {
                    ctx.fillRect(b.x + 6 + c * 16, b.y + 6 + r * 20, 10, 10);
                }
            }
        }
        ctx.fillStyle = '#08080b';
    }

    ctx.fillStyle = '#111';
    ctx.fillRect(0, groundY, W, H - groundY);
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(W, groundY);
    ctx.stroke();

    if (anchor.active) {
        ctx.strokeStyle = 'rgba(0, 234, 255, 0.55)';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(spidey.x, spidey.y);
        ctx.lineTo(anchor.x, anchor.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#00eaff';
        ctx.shadowColor = '#00eaff';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(anchor.x, anchor.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    ctx.fillStyle = '#d00';
    ctx.shadowColor = '#d00';
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(spidey.x, spidey.y, spidey.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#0033a0';
    ctx.beginPath();
    ctx.arc(spidey.x - 5, spidey.y - 4, 7, 0, Math.PI * 2);
    ctx.arc(spidey.x + 5, spidey.y - 4, 7, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(spidey.x - 5, spidey.y - 4, 3.2, 0, Math.PI * 2);
    ctx.arc(spidey.x + 5, spidey.y - 4, 3.2, 0, Math.PI * 2);
    ctx.fill();

    if (!anchor.active) {
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Klicke zum Seilwerfen · S = Schwingen', spidey.x, spidey.y - 30);
        ctx.textAlign = 'start';
    }

    if (anchor.active) {
        ctx.fillStyle = 'rgba(0,234,255,0.5)';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('S = Seil loslassen', W / 2, 40);
        ctx.textAlign = 'start';
    }
}

function frame(ts) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.033, (ts - lastT) / 1000 || 0.016);
    lastT = ts;
    update(dt);
    draw();
}

reset();
requestAnimationFrame(frame);

