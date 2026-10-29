const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');

const BEST_KEY = 'playsgamez_ninjarush_best';
let best = +(localStorage.getItem(BEST_KEY) || 0);
bestEl.textContent = 'Best: ' + best + ' m';

let W, H;
let ninja = { x: 80, y: 0, w: 30, h: 40, vy: 0, onGround: false, jumps: 0, maxJumps: 2, color: '#ffd700' };
let obstacles = [], particles = [];
let score = 0, dist = 0, over = false, started = false;
let spawnTimer = 0, spawnInterval = 1400;
let speed = 260;
let jumpPressed = false;

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
    ninja.y = H - 120;
}
window.addEventListener('resize', resize);
resize();

function reset() {
    obstacles = [];
    particles = [];
    score = 0;
    dist = 0;
    over = false;
    started = true;
    spawnTimer = 0;
    spawnInterval = 1400;
    speed = 260;
    ninja.x = 80;
    ninja.y = H - 120;
    ninja.vy = 0;
    ninja.onGround = true;
    ninja.jumps = 0;
    scoreEl.textContent = 'Distanz: 0 m';
    bestEl.textContent = 'Best: ' + best + ' m';
}
reset();

function spawnObstacle() {
    const type = Math.random() > 0.4 ? 'low' : 'high';
    const w = type === 'low' ? 50 : 30;
    const h = type === 'low' ? 20 : 60;
    obstacles.push({
        x: W + 40,
        y: H - 120 - h,
        w: w, h: h,
        type: type,
        color: '#ff0044'
    });
}

function jump() {
    if (over) { reset(); return; }
    if (!started) { started = true; return; }
    if (ninja.jumps < ninja.maxJumps) {
        ninja.vy = -620;
        ninja.onGround = false;
        ninja.jumps++;
        started = true;
    }
}

function explode(x, y, color) {
    for (let i = 0; i < 10; i++) {
        particles.push({
            x: x, y: y,
            vx: (Math.random() - 0.5) * 180,
            vy: (Math.random() - 0.5) * 180,
            life: 0.5, tt: 0,
            color: color || '#ffd700'
        });
    }
}

function gameOver() {
    over = true;
    const m = Math.floor(dist);
    if (m > best) {
        best = m;
        localStorage.setItem(BEST_KEY, best);
        bestEl.textContent = 'Best: ' + best + ' m';
    }
}

canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    jump();
}, { passive: false });

canvas.addEventListener('mousedown', (e) => {
    jump();
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'r' || e.key === 'R') { reset(); return; }
    if (e.key === ' ' || e.key === 'Spacebar' || e.key === 'ArrowUp') { e.preventDefault(); jump(); }
});

document.getElementById('restartBtn').onclick = reset;

let lastT = 0;
function loop(ts) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.033, (ts - lastT) / 1000 || 0.016);
    lastT = ts;

    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, H - 100, W, 100);
    ctx.fillStyle = '#0f0f1a';
    ctx.fillRect(0, H - 120, W, 20);

    if (over) {
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#ff0044';
        ctx.font = 'bold 40px Arial';
        ctx.textAlign = 'center';
        ctx.shadowColor = '#ff0044';
        ctx.shadowBlur = 16;
        ctx.fillText('GAME OVER', W / 2, H / 2 - 10);
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#fff';
        ctx.font = '18px Arial';
        ctx.fillText('Distanz: ' + Math.floor(dist) + ' m   Tippe für Neustart', W / 2, H / 2 + 30);
        drawParticles(dt);
        return;
    }

    if (!started) {
        ctx.fillStyle = '#fff';
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Tippe zum Springen', W / 2, H / 2 - 20);
        ctx.font = '15px Arial';
        ctx.fillStyle = '#9fd9e2';
        ctx.fillText('Vermeide die Hindernisse!', W / 2, H / 2 + 10);
        drawParticles(dt);
        return;
    }

    ninja.vy += 1100 * dt;
    ninja.y += ninja.vy * dt;
    const groundY = H - 120;
    if (ninja.y + ninja.h > groundY) {
        ninja.y = groundY - ninja.h;
        ninja.vy = 0;
        ninja.onGround = true;
        ninja.jumps = 0;
    }

    speed += 8 * dt;
    dist += speed * dt * 0.001;
    scoreEl.textContent = 'Distanz: ' + Math.floor(dist) + ' m';

    spawnTimer += dt * 1000;
    if (spawnTimer >= spawnInterval) {
        spawnObstacle();
        spawnTimer = 0;
        if (spawnInterval > 700) spawnInterval -= 20;
    }

    for (const o of obstacles) {
        o.x -= speed * dt;
        if (ninja.x < o.x + o.w && ninja.x + ninja.w > o.x &&
            ninja.y < o.y + o.h && ninja.y + ninja.h > o.y) {
            gameOver();
        }
    }
    obstacles = obstacles.filter(o => o.x + o.w > -50);

    drawParticles(dt);

    ctx.fillStyle = ninja.color;
    ctx.shadowColor = ninja.color;
    ctx.shadowBlur = 15;
    ctx.fillRect(ninja.x, ninja.y, ninja.w, ninja.h);
    ctx.shadowBlur = 0;

    for (const o of obstacles) {
        ctx.fillStyle = o.color;
        ctx.shadowColor = o.color;
        ctx.shadowBlur = 12;
        ctx.fillRect(o.x, o.y, o.w, o.h);
        ctx.shadowBlur = 0;
    }

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Distanz: ' + Math.floor(dist) + ' m', 12, H - 12);
    if (best > 0) {
        ctx.fillStyle = '#607d8b';
        ctx.fillText('Best: ' + best + ' m', W - 140, 24);
    }
}

function drawParticles(dt) {
    for (const p of particles) {
        p.tt += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        ctx.globalAlpha = 1 - p.tt / p.life;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, 4, 4);
    }
    ctx.globalAlpha = 1;
    particles = particles.filter(p => p.tt < p.life);
}

loop(0);