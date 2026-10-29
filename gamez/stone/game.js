const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');

const BEST_KEY = 'playsgamez_stone_best';
let best = +(localStorage.getItem(BEST_KEY) || 0);
bestEl.textContent = 'Best: ' + best;

let W, H;
let rocks = [], parts = [], score = 0, t = 0, spawnT = 0.4, over = false, paused = false;

function getSize() {
    const rect = canvas.getBoundingClientRect();
    let w = Math.min(Math.max(rect.width, 250), 500);
    let h = Math.min(Math.max(rect.height, 350), 700);
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
    if (rocks.length === 0) reset();
}
window.addEventListener('resize', resize);
resize();

function reset() {
    rocks = [];
    parts = [];
    score = 0;
    t = 0;
    spawnT = 0.3;
    over = false;
    paused = false;
    scoreEl.textContent = 'Score: 0';
}
reset();

function spawn() {
    const s = 12 + Math.random() * 26;
    rocks.push({
        x: 20 + Math.random() * Math.max(1, W - 40),
        y: -20,
        s: s,
        rot: Math.random() * 6,
        vr: 1 + Math.random() * 3,
        speed: 1.5 + Math.random() * 2.5 + score * 0.02
    });
}

function explode(x, y, color) {
    for (let i = 0; i < 12; i++) {
        parts.push({
            x: x, y: y,
            vx: (Math.random() - 0.5) * 180,
            vy: (Math.random() - 0.5) * 180,
            life: 0.5, tt: 0,
            color: color || '#ff0044'
        });
    }
}

function gameOver() {
    over = true;
    if (score > best) {
        best = score;
        localStorage.setItem(BEST_KEY, best);
        bestEl.textContent = 'Best: ' + best;
    }
}

function handleTap(clientX, clientY) {
    if (over) { reset(); return; }
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const mx = (clientX - rect.left) / (rect.width / W);
    const my = (clientY - rect.top) / (rect.height / H);

    let hit = false;
    for (let i = rocks.length - 1; i >= 0; i--) {
        const r = rocks[i];
        if (Math.abs(mx - r.x) < r.s / 2 + 8 && Math.abs(my - r.y) < r.s / 2 + 8) {
            explode(r.x, r.y, '#ff0044');
            score += 10;
            scoreEl.textContent = 'Score: ' + score;
            rocks.splice(i, 1);
            hit = true;
            break;
        }
    }
    if (!hit) {
        explode(mx, my, '#607d8b');
    }
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'r' || e.key === 'R') { reset(); return; }
    if (e.key === 'p' || e.key === 'P') paused = !paused;
});

canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    handleTap(e.touches[0].clientX, e.touches[0].clientY);
}, { passive: false });

canvas.addEventListener('mousedown', (e) => {
    handleTap(e.clientX, e.clientY);
});

document.getElementById('restartBtn').onclick = reset;

let lastT = 0;
function loop(ts) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.033, (ts - lastT) / 1000 || 0.016);
    lastT = ts;

    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, W, H);

    if (over) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
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
        ctx.fillText('Score: ' + score + '   R = Neustart', W / 2, H / 2 + 30);
        drawParts();
        return;
    }

    if (paused) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 34px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('PAUSE', W / 2, H / 2);
        drawParts();
        return;
    }

    t += dt;
    spawnT -= dt;
    if (spawnT <= 0) {
        spawnT = Math.max(0.08, 0.4 - t * 0.004);
        spawn();
    }

    for (const r of rocks) {
        r.y += r.speed * dt * 60;
        r.rot += r.vr * dt;
        r.x += Math.sin(t + r.rot) * 0.5;
        if (r.y + r.s / 2 > H) {
            gameOver();
            break;
        }
    }
    rocks = rocks.filter(r => r.y < H + 30);

    for (const p of parts) {
        p.tt += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
    }
    parts = parts.filter(p => p.tt < p.life);

    for (const r of rocks) {
        ctx.save();
        ctx.translate(r.x, r.y);
        ctx.rotate(r.rot);
        ctx.shadowColor = '#ff0044';
        ctx.shadowBlur = 9;
        ctx.fillStyle = '#ff0044';
        ctx.fillRect(-r.s / 2, -r.s / 2, r.s, r.s);
        ctx.fillStyle = '#330000';
        ctx.fillRect(-r.s / 4, -r.s / 4, r.s / 2, r.s / 2);
        ctx.restore();
    }

    drawParts();

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Score: ' + score, 12, H - 12);
    if (best > 0) {
        ctx.fillStyle = '#607d8b';
        ctx.fillText('Best: ' + best, W - 100, 24);
    }
    if (!over && !paused) {
        ctx.fillStyle = '#607d8b';
        ctx.font = '13px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('👆 Steine antippen zum Zerstören', W / 2, 30);
    }
}

function drawParts() {
    for (const p of parts) {
        ctx.globalAlpha = 1 - p.tt / p.life;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, 4, 4);
    }
    ctx.globalAlpha = 1;
}

loop(0);
