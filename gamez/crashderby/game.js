const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');

const BEST_KEY = 'playsgamez_crashderby_best';
let best = +(localStorage.getItem(BEST_KEY) || 0);
bestEl.textContent = 'Best: ' + best;

let W, H;
let player = { x: 0, y: 0, w: 40, h: 24, vx: 0, vy: 0, angle: 0, speed: 0, hp: 100, color: '#00eaff' };
let enemies = [];
let particles = [];
let score = 0, crashes = 0, gameOver = false, shake = 0;
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
    player.x = W * 0.3;
    player.y = H * 0.5;
    player.angle = 0;
    player.speed = 0;
}
window.addEventListener('resize', resize);
resize();

function spawnEnemy() {
    enemies.push({
        x: Math.random() * W, y: Math.random() * H,
        w: 36, h: 22, vx: (Math.random()-0.5)*100, vy: (Math.random()-0.5)*100,
        angle: Math.random()*Math.PI*2, hp: 100,
        color: `hsl(${Math.random()*360}, 80%, 60%)`
    });
}
for (let i = 0; i < 4; i++) spawnEnemy();

function reset() {
    score = 0; crashes = 0; gameOver = false; shake = 0; particles = [];
    enemies = [];
    for (let i = 0; i < 4; i++) spawnEnemy();
    player.x = W * 0.3; player.y = H * 0.5; player.hp = 100; player.speed = 0; player.angle = 0; player.vx = 0; player.vy = 0;
    scoreEl.textContent = 'Destruktion: 0';
    bestEl.textContent = 'Best: ' + best;
}

function createParticles(x, y, color, n) {
    for (let i = 0; i < n; i++) {
        particles.push({ x: x, y: y, vx: (Math.random()-0.5)*200, vy: (Math.random()-0.5)*200, life: 0.6, tt: 0, color: color });
    }
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'r' || e.key === 'R') reset();
    if (e.key === 'ArrowUp') player.speed = Math.min(player.speed + 20, 200);
    if (e.key === 'ArrowDown') player.speed = Math.max(player.speed - 20, -80);
    if (e.key === 'ArrowLeft') player.angle -= 0.1;
    if (e.key === 'ArrowRight') player.angle += 0.1;
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

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, H * 0.3); ctx.lineTo(W, H * 0.3);
    ctx.moveTo(0, H * 0.7); ctx.lineTo(W, H * 0.7);
    ctx.moveTo(W * 0.3, 0); ctx.lineTo(W * 0.3, H);
    ctx.moveTo(W * 0.7, 0); ctx.lineTo(W * 0.7, H);
    ctx.stroke();

    if (steering && !gameOver) {
        const rect = canvas.getBoundingClientRect();
        const mx = (touchX - rect.left) / (rect.width / W);
        const my = (touchY - rect.top) / (rect.height / H);
        const dx = mx - player.x;
        const dy = my - player.y;
        player.angle = Math.atan2(dy, dx);
        player.speed = Math.min(player.speed + 5, 180);
    } else {
        player.speed *= 0.96;
    }

    player.vx = Math.cos(player.angle) * player.speed;
    player.vy = Math.sin(player.angle) * player.speed;
    player.x += player.vx * dt;
    player.y += player.vy * dt;

    if (player.x < 0) { player.x = 0; player.angle = Math.PI - player.angle; player.speed *= 0.4; createParticles(player.x, player.y, '#ff0044', 6); }
    if (player.x > W) { player.x = W; player.angle = Math.PI - player.angle; player.speed *= 0.4; createParticles(player.x, player.y, '#ff0044', 6); }
    if (player.y < 0) { player.y = 0; player.angle = -player.angle; player.speed *= 0.4; createParticles(player.x, player.y, '#ff0044', 6); }
    if (player.y > H) { player.y = H; player.angle = -player.angle; player.speed *= 0.4; createParticles(player.x, player.y, '#ff0044', 6); }

    ctx.save();
    if (shake > 0) { ctx.translate((Math.random()-0.5)*shake, (Math.random()-0.5)*shake); shake *= 0.9; if (shake < 0.5) shake = 0; }

    ctx.translate(player.x + player.w/2, player.y + player.h/2);
    ctx.rotate(player.angle);
    ctx.fillStyle = player.color;
    ctx.shadowColor = player.color;
    ctx.shadowBlur = 15;
    ctx.fillRect(-player.w/2, -player.h/2, player.w, player.h);
    ctx.shadowBlur = 0;
    ctx.restore();

    for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        if (e.x < 0 || e.x > W) e.vx *= -1;
        if (e.y < 0 || e.y > H) e.vy *= -1;

        ctx.save();
        ctx.translate(e.x + e.w/2, e.y + e.h/2);
        ctx.rotate(e.angle);
        ctx.fillStyle = e.color;
        ctx.shadowColor = e.color;
        ctx.shadowBlur = 12;
        ctx.fillRect(-e.w/2, -e.h/2, e.w, e.h);
        ctx.shadowBlur = 0;
        ctx.restore();

        const dx = player.x - e.x;
        const dy = player.y - e.y;
        const dist = Math.hypot(dx, dy);
        if (dist < (player.w + e.w) / 2 + 8) {
            const force = 300;
            player.vx += (dx / dist) * force * dt;
            player.vy += (dy / dist) * force * dt;
            e.vx -= (dx / dist) * force * dt;
            e.vy -= (dy / dist) * force * dt;
            player.hp -= 2;
            e.hp -= 2;
            crashes++;
            score += 5;
            scoreEl.textContent = 'Destruktion: ' + score;
            createParticles((player.x + e.x) / 2, (player.y + e.y) / 2, '#ffd700', 12);
            shake = 10;
            if (e.hp <= 0) { enemies.splice(i, 1); spawnEnemy(); }
            if (player.hp <= 0) { gameOver = true; }
        }
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
    ctx.fillText('Destruktion: ' + score + '  Crashes: ' + crashes, 12, H - 12);
    if (best > 0) { ctx.fillStyle = '#607d8b'; ctx.fillText('Best: ' + best, W - 140, 24); }

    ctx.fillStyle = '#ff3e3e';
    ctx.fillRect(10, 30, 200, 10);
    ctx.fillStyle = '#00eaff';
    ctx.fillRect(10, 30, player.hp * 2, 10);

    if (gameOver) {
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#ff0044';
        ctx.font = 'bold 40px Arial';
        ctx.textAlign = 'center';
        ctx.shadowColor = '#ff0044';
        ctx.shadowBlur = 20;
        ctx.fillText('ZERSTÖRT!', W / 2, H / 2 - 10);
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#fff';
        ctx.font = '18px Arial';
        ctx.fillText('Destruktion: ' + score + '   R = Neustart', W / 2, H / 2 + 30);
    }
}
loop(0);
