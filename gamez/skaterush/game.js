const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');

const BEST_KEY = 'playsgamez_skaterush_best';
let best = +(localStorage.getItem(BEST_KEY) || 0);
bestEl.textContent = 'Best: ' + best + ' m';

let W, H;
let skater = { x: 80, y: 0, w: 24, h: 30, vy: 0, jumps: 0, maxJumps: 2, onGround: false, color: '#ffd700' };
let obstacles = [];
let particles = [];
let dist = 0, score = 0, speed = 240, spawnT = 0, gameOver = false;

function getSize() {
    const rect = canvas.getBoundingClientRect();
    let w = Math.min(Math.max(rect.width, 280), 450);
    let h = Math.min(Math.max(rect.height, 350), 600);
    w = Math.floor(w / 10) * 10;
    h = Math.floor(h / 10) * 10;
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
    skater.y = H - 120;
}
window.addEventListener('resize', resize);
resize();

function reset() {
    skater.y = H - 120; skater.vy = 0; skater.jumps = 0; skater.onGround = false;
    obstacles = []; particles = []; dist = 0; score = 0; speed = 240; spawnT = 0;
    gameOver = false;
    scoreEl.textContent = 'Distanz: 0 m';
    bestEl.textContent = 'Best: ' + best + ' m';
}
reset();

function spawnObs() {
    const type = Math.random() > 0.5 ? 'low' : 'high';
    obstacles.push({
        x: W + 40, y: H - 120 - (type === 'low' ? 16 : 40),
        w: type === 'low' ? 40 : 24, h: type === 'low' ? 16 : 40,
        color: '#ff0044'
    });
}

function jump() {
    if (gameOver) { reset(); return; }
    if (skater.jumps < skater.maxJumps) {
        skater.vy = -580;
        skater.jumps++;
        skater.onGround = false;
    }
}

function createParticles(x, y, color, n) {
    for (let i = 0; i < n; i++) {
        particles.push({ x: x, y: y, vx: (Math.random()-0.5)*160, vy: (Math.random()-0.5)*160, life: 0.5, tt: 0, color: color });
    }
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'r' || e.key === 'R') reset();
    if (e.key === ' ' || e.key === 'ArrowUp') jump();
});
canvas.addEventListener('touchstart', (e) => { e.preventDefault(); jump(); }, { passive: false });
canvas.addEventListener('mousedown', jump);
document.getElementById('restartBtn').onclick = reset;

let lastT = 0;
function loop(ts) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.033, (ts - lastT) / 1000 || 0.016);
    lastT = ts;

    ctx.fillStyle = '#050508';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, H - 100, W, 100);
    ctx.fillStyle = '#0f0f1a';
    ctx.fillRect(0, H - 120, W, 20);

    if (gameOver) {
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#ff0044';
        ctx.font = 'bold 40px Arial';
        ctx.textAlign = 'center';
        ctx.shadowColor = '#ff0044';
        ctx.shadowBlur = 16;
        ctx.fillText('CRASH!', W / 2, H / 2 - 10);
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#fff';
        ctx.font = '18px Arial';
        ctx.fillText('Distanz: ' + Math.floor(dist) + ' m   R = Neustart', W / 2, H / 2 + 30);
        for (const p of particles) {
            p.tt += dt; p.x += p.vx * dt; p.y += p.vy * dt;
            ctx.globalAlpha = 1 - p.tt / p.life;
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x, p.y, 3, 3);
        }
        ctx.globalAlpha = 1;
        particles = particles.filter(p => p.tt < p.life);
        return;
    }

    skater.vy += 1200 * dt;
    skater.y += skater.vy * dt;
    const groundY = H - 120;
    if (skater.y + skater.h > groundY) {
        skater.y = groundY - skater.h;
        skater.vy = 0;
        skater.jumps = 0;
        skater.onGround = true;
    }

    speed += 4 * dt;
    dist += speed * dt * 0.001;
    scoreEl.textContent = 'Distanz: ' + Math.floor(dist) + ' m';

    spawnT += dt * 1000;
    if (spawnT > 1200 - speed * 0.1) {
        spawnObs();
        spawnT = 0;
    }

    for (let i = obstacles.length - 1; i >= 0; i--) {
        const o = obstacles[i];
        o.x -= speed * dt;
        if (skater.x < o.x + o.w && skater.x + skater.w > o.x &&
            skater.y < o.y + o.h && skater.y + skater.h > o.y) {
            gameOver = true;
            createParticles(skater.x + skater.w / 2, skater.y + skater.h / 2, '#ff0044', 20);
        }
    }
    obstacles = obstacles.filter(o => o.x + o.w > -50);

    ctx.fillStyle = skater.color;
    ctx.shadowColor = skater.color;
    ctx.shadowBlur = 15;
    ctx.fillRect(skater.x, skater.y, skater.w, skater.h);
    ctx.shadowBlur = 0;

    for (const o of obstacles) {
        ctx.fillStyle = o.color;
        ctx.shadowColor = o.color;
        ctx.shadowBlur = 12;
        ctx.fillRect(o.x, o.y, o.w, o.h);
        ctx.shadowBlur = 0;
    }

    for (const p of particles) {
        p.tt += dt; p.x += p.vx * dt; p.y += p.vy * dt;
        ctx.globalAlpha = 1 - p.tt / p.life;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, 3, 3);
    }
    ctx.globalAlpha = 1;
    particles = particles.filter(p => p.tt < p.life);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Distanz: ' + Math.floor(dist) + ' m', 12, H - 12);
    if (best > 0) { ctx.fillStyle = '#607d8b'; ctx.fillText('Best: ' + best + ' m', W - 140, 24); }
}
loop(0);
