const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');

const BEST_KEY = 'playsgamez_spaceblaster_best';
let best = +(localStorage.getItem(BEST_KEY) || 0);
bestEl.textContent = 'Best: ' + best;

let W, H;
let player = { x: 0, y: 0, w: 40, h: 40, speed: 500, color: '#00eaff' };
let bullets = [], enemies = [], particles = [], powerups = [];
let score = 0, over = false, started = false;
let spawnTimer = 0, spawnInterval = 1200;
let touchActive = false;
let fireTimer = 0, fireInterval = 200;

function getSize() {
    const rect = canvas.getBoundingClientRect();
    let w = Math.min(Math.max(rect.width, 280), 450);
    let h = Math.min(Math.max(rect.height, 400), 700);
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
    if (!started) {
        player.x = W / 2 - player.w / 2;
        player.y = H - 80;
    }
}
window.addEventListener('resize', resize);
resize();

function reset() {
    bullets = [];
    enemies = [];
    particles = [];
    powerups = [];
    score = 0;
    over = false;
    started = true;
    spawnTimer = 0;
    spawnInterval = 1200;
    fireTimer = 0;
    player.x = W / 2 - player.w / 2;
    player.y = H - 80;
    scoreEl.textContent = 'Score: 0';
    bestEl.textContent = 'Best: ' + best;
}
reset();

function spawnEnemy() {
    const type = Math.random() > 0.7 ? 'fast' : 'normal';
    const w = type === 'fast' ? 26 : 40;
    const h = type === 'fast' ? 26 : 40;
    enemies.push({
        x: Math.random() * Math.max(1, W - w),
        y: -h,
        w: w, h: h,
        vx: type === 'fast' ? (Math.random() > 0.5 ? -150 : 150) : 0,
        vy: type === 'fast' ? 220 + Math.random() * 120 : 150 + Math.random() * 80,
        type: type,
        hp: type === 'fast' ? 1 : 2,
        color: type === 'fast' ? '#ff0044' : '#a200ff'
    });
}

function spawnPowerup(x, y) {
    if (Math.random() > 0.15) return;
    powerups.push({
        x: x, y: y, w: 20, h: 20,
        vy: 100,
        type: Math.random() > 0.5 ? 'rapid' : 'multi',
        color: '#ffd700'
    });
}

function explode(x, y, color, count) {
    for (let i = 0; i < (count || 8); i++) {
        particles.push({
            x: x, y: y,
            vx: (Math.random() - 0.5) * 200,
            vy: (Math.random() - 0.5) * 200,
            life: 0.5, tt: 0,
            color: color || '#00eaff'
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

function handleInput(clientX) {
    if (over) { reset(); return; }
    const rect = canvas.getBoundingClientRect();
    const mx = (clientX - rect.left) / (rect.width / W);
    player.x = mx - player.w / 2;
    if (player.x < 0) player.x = 0;
    if (player.x > W - player.w) player.x = W - player.w;
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'r' || e.key === 'R') { reset(); return; }
    if (e.key === 'ArrowLeft' && player.x > 0) player.x -= 20;
    if (e.key === 'ArrowRight' && player.x < W - player.w) player.x += 20;
});

canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (over) { reset(); return; }
    touchActive = true;
    handleInput(e.touches[0].clientX);
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    handleInput(e.touches[0].clientX);
}, { passive: false });

canvas.addEventListener('touchend', () => { touchActive = false; }, { passive: false });

canvas.addEventListener('mousedown', (e) => {
    if (over) { reset(); return; }
    touchActive = true;
    handleInput(e.clientX);
});

window.addEventListener('mousemove', (e) => {
    if (touchActive) handleInput(e.clientX);
});

window.addEventListener('mouseup', () => { touchActive = false; });

document.getElementById('restartBtn').onclick = reset;

let lastT = 0;
function loop(ts) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.033, (ts - lastT) / 1000 || 0.016);
    lastT = ts;

    ctx.fillStyle = '#050508';
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    for (let i = 0; i < 40; i++) {
        const x = (i * 153 + ts * 0.03) % W;
        const y = (i * 97 + ts * 0.05) % H;
        ctx.fillRect(x, y, 1.5, 1.5);
    }

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
        ctx.fillText('Score: ' + score + '   Tippe für Neustart', W / 2, H / 2 + 30);
        drawParticles();
        return;
    }

    if (!started) {
        ctx.fillStyle = '#fff';
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Ziehe zum Bewegen – Feuer automatisch', W / 2, H / 2);
        drawParticles();
        return;
    }

    spawnTimer += dt * 1000;
    if (spawnTimer >= spawnInterval) {
        spawnEnemy();
        spawnTimer = 0;
        if (spawnInterval > 500) spawnInterval -= 10;
    }

    fireTimer += dt * 1000;
    if (fireTimer >= fireInterval) {
        bullets.push({ x: player.x + player.w / 2 - 2, y: player.y, w: 4, h: 14, vy: -550, color: '#00eaff' });
        fireTimer = 0;
    }

    for (const b of bullets) b.y += b.vy * dt;
    bullets = bullets.filter(b => b.y > -20);

    for (const e of enemies) {
        e.y += e.vy * dt;
        e.x += e.vx * dt;
        if (e.x < 0 || e.x > W - e.w) e.vx *= -1;
        if (e.y > H + 40) gameOver();
    }
    enemies = enemies.filter(e => e.y < H + 60);

    for (const p of powerups) p.y += p.vy * dt;
    powerups = powerups.filter(p => p.y < H + 40);

    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        for (let j = enemies.length - 1; j >= 0; j--) {
            const e = enemies[j];
            if (b.x + b.w > e.x && b.x < e.x + e.w && b.y + b.h > e.y && b.y < e.y + e.h) {
                e.hp--;
                bullets.splice(i, 1);
                if (e.hp <= 0) {
                    explode(e.x + e.w / 2, e.y + e.h / 2, e.color, 10);
                    spawnPowerup(e.x + e.w / 2, e.y + e.h / 2);
                    score += 100;
                    scoreEl.textContent = 'Score: ' + score;
                    enemies.splice(j, 1);
                }
                break;
            }
        }
    }

    for (const e of enemies) {
        if (player.x < e.x + e.w && player.x + player.w > e.x &&
            player.y < e.y + e.h && player.y + player.h > e.y) {
            gameOver();
            break;
        }
    }

    for (let i = powerups.length - 1; i >= 0; i--) {
        const p = powerups[i];
        if (player.x < p.x + p.w && player.x + player.w > p.x &&
            player.y < p.y + p.h && player.y + player.h > p.y) {
            fireInterval = Math.max(80, fireInterval - 40);
            explode(p.x + p.w / 2, p.y + p.h / 2, '#ffd700', 6);
            powerups.splice(i, 1);
        }
    }

    ctx.fillStyle = player.color;
    ctx.shadowColor = player.color;
    ctx.shadowBlur = 15;
    ctx.fillRect(player.x, player.y, player.w, player.h);
    ctx.shadowBlur = 0;

    for (const b of bullets) {
        ctx.fillStyle = b.color;
        ctx.shadowColor = b.color;
        ctx.shadowBlur = 10;
        ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.shadowBlur = 0;
    }

    for (const e of enemies) {
        ctx.fillStyle = e.color;
        ctx.shadowColor = e.color;
        ctx.shadowBlur = 12;
        ctx.fillRect(e.x, e.y, e.w, e.h);
        ctx.shadowBlur = 0;
    }

    for (const p of powerups) {
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(p.x + p.w / 2, p.y + p.h / 2, p.w / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    drawParticles();

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Score: ' + score, 12, H - 12);
    if (best > 0) {
        ctx.fillStyle = '#607d8b';
        ctx.fillText('Best: ' + best, W - 120, 24);
    }
}

function drawParticles() {
    for (const p of particles) {
        p.tt += (1 / 60);
        p.x += p.vx * (1 / 60);
        p.y += p.vy * (1 / 60);
        ctx.globalAlpha = 1 - p.tt / p.life;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, 4, 4);
    }
    ctx.globalAlpha = 1;
    particles = particles.filter(p => p.tt < p.life);
}

loop(0);