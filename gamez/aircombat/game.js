const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');

const BEST_KEY = 'playsgamez_aircombat_best';
let best = +(localStorage.getItem(BEST_KEY) || 0);
bestEl.textContent = 'Best: ' + best;

let W, H;
let player = { x: 0, y: 0, w: 36, h: 24, vx: 0, vy: 0, hp: 100, color: '#00eaff' };
let bullets = [], enemies = [], particles = [];
let score = 0, kills = 0, spawnT = 0, fireT = 0, gameOver = false, shake = 0;
let touchX = 0, touchY = 0, steering = false;

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
    player.x = W * 0.5;
    player.y = H * 0.8;
}
window.addEventListener('resize', resize);
resize();

function spawnEnemy() {
    enemies.push({
        x: Math.random() * W, y: -40,
        w: 34, h: 20, vx: (Math.random()-0.5)*60, vy: 100 + Math.random()*80,
        color: '#ff0044', hp: 2
    });
}

function reset() {
    score = 0; kills = 0; spawnT = 0; fireT = 0; gameOver = false; shake = 0;
    bullets = []; enemies = []; particles = [];
    player.x = W * 0.5; player.y = H * 0.8; player.hp = 100;
    for (let i = 0; i < 3; i++) spawnEnemy();
    scoreEl.textContent = 'Abschüsse: 0';
    bestEl.textContent = 'Best: ' + best;
}
reset();

function createParticles(x, y, color, n) {
    for (let i = 0; i < n; i++) {
        particles.push({ x: x, y: y, vx: (Math.random()-0.5)*160, vy: (Math.random()-0.5)*160, life: 0.5, tt: 0, color: color });
    }
}

function fire() {
    if (gameOver) return;
    fireT += dt * 1000;
    if (fireT > 500) {
        bullets.push({ x: player.x + player.w/2, y: player.y, vx: 0, vy: -450, w: 4, h: 10, color: '#ffd700' });
        fireT = 0;
        createParticles(player.x + player.w/2, player.y, '#ffd700', 4);
    }
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'r' || e.key === 'R') reset();
    if (e.key === 'ArrowLeft') player.vx = -200;
    if (e.key === 'ArrowRight') player.vx = 200;
    if (e.key === 'ArrowUp') player.vy = -200;
    if (e.key === 'ArrowDown') player.vy = 200;
});
document.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') player.vx = 0;
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') player.vy = 0;
});
canvas.addEventListener('touchstart', (e) => { e.preventDefault(); touchX = e.touches[0].clientX; touchY = e.touches[0].clientY; steering = true; }, { passive: false });
canvas.addEventListener('touchmove', (e) => { e.preventDefault(); touchX = e.touches[0].clientX; touchY = e.touches[0].clientY; }, { passive: false });
canvas.addEventListener('touchend', () => { steering = false; });
canvas.addEventListener('mousedown', (e) => { touchX = e.clientX; touchY = e.clientY; steering = true; });
window.addEventListener('mousemove', (e) => { if (steering) { touchX = e.clientX; touchY = e.clientY; } });
window.addEventListener('mouseup', () => { steering = false; });
document.getElementById('restartBtn').onclick = reset;

let lastT = 0;
function loop(ts) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.033, (ts - lastT) / 1000 || 0.016);
    lastT = ts;

    ctx.fillStyle = '#050508';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    for (let i = 0; i < 30; i++) {
        const x = (i * 131 + ts * 0.05) % W;
        const y = (i * 79 + ts * 0.08) % H;
        ctx.fillRect(x, y, 1.5, 1.5);
    }

    if (steering && !gameOver) {
        const rect = canvas.getBoundingClientRect();
        player.x += (touchX - rect.left)/(rect.width/W) - player.x - player.w/2;
        player.x = Math.max(0, Math.min(W - player.w, player.x));
    }
    player.x += player.vx * dt;
    player.y += player.vy * dt;
    player.x = Math.max(0, Math.min(W - player.w, player.x));
    player.y = Math.max(0, Math.min(H - player.h, player.y));

    fire();

    spawnT += dt * 1000;
    if (spawnT > 1400) { spawnEnemy(); spawnT = 0; }

    for (const b of bullets) {
        b.y += b.vy * dt;
    }
    bullets = bullets.filter(b => b.y > -20);

    for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        if (e.y > H + 50) { enemies.splice(i, 1); continue; }
        if (e.x < 0 || e.x > W) e.vx *= -1;

        for (let j = bullets.length - 1; j >= 0; j--) {
            const b = bullets[j];
            if (b.x > e.x && b.x < e.x + e.w && b.y > e.y && b.y < e.y + e.h) {
                e.hp--;
                bullets.splice(j, 1);
                createParticles(e.x + e.w/2, e.y + e.h/2, '#ffd700', 8);
                if (e.hp <= 0) {
                    kills++;
                    score += 100;
                    scoreEl.textContent = 'Abschüsse: ' + score;
                    createParticles(e.x + e.w/2, e.y + e.h/2, '#00eaff', 15);
                    enemies.splice(i, 1);
                    spawnEnemy();
                }
                break;
            }
        }

        if (player.x < e.x + e.w && player.x + player.w > e.x &&
            player.y < e.y + e.h && player.y + player.h > e.y) {
            player.hp -= 10;
            createParticles(player.x + player.w/2, player.y + player.h/2, '#ff0044', 10);
            shake = 10;
            enemies.splice(i, 1);
            spawnEnemy();
            if (player.hp <= 0) gameOver = true;
        }
    }

    ctx.save();
    if (shake > 0) { ctx.translate((Math.random()-0.5)*shake, (Math.random()-0.5)*shake); shake *= 0.9; if (shake < 0.5) shake = 0; }

    ctx.fillStyle = player.color;
    ctx.shadowColor = player.color;
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.moveTo(player.x + player.w/2, player.y);
    ctx.lineTo(player.x, player.y + player.h);
    ctx.lineTo(player.x + player.w, player.y + player.h);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.restore();

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
        ctx.beginPath();
        ctx.moveTo(e.x + e.w/2, e.y);
        ctx.lineTo(e.x, e.y + e.h);
        ctx.lineTo(e.x + e.w, e.y + e.h);
        ctx.closePath();
        ctx.fill();
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
    ctx.fillText('Abschüsse: ' + score + '  (HP: ' + player.hp + ')', 12, H - 12);
    if (best > 0) { ctx.fillStyle = '#607d8b'; ctx.fillText('Best: ' + best, W - 140, 24); }

    if (gameOver) {
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#ff0044';
        ctx.font = 'bold 40px Arial';
        ctx.textAlign = 'center';
        ctx.shadowColor = '#ff0044';
        ctx.shadowBlur = 20;
        ctx.fillText('ABGESCHOSSEN!', W / 2, H / 2 - 10);
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#fff';
        ctx.font = '18px Arial';
        ctx.fillText('Abschüsse: ' + score + '   R = Neustart', W / 2, H / 2 + 30);
    }
}
loop(0);
