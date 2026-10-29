const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');

const BEST_KEY = 'playsgamez_boxing_best';
let best = +(localStorage.getItem(BEST_KEY) || 0);
bestEl.textContent = 'Best: ' + best;

let W, H;
let player = { x: 0, y: 0, w: 34, h: 70, hp: 100, color: '#00eaff' };
let enemy = { x: 0, y: 0, w: 34, h: 70, hp: 100, vx: 0, dir: 1, color: '#ff0044' };
let particles = [];
let score = 0, punches = 0, hits = 0, gameOver = false, shake = 0;

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
    player.x = W * 0.25;
    player.y = H * 0.75 - player.h;
    enemy.x = W * 0.75 - enemy.w;
    enemy.y = H * 0.75 - enemy.h;
}
window.addEventListener('resize', resize);
resize();

function createParticles(x, y, color, n) {
    for (let i = 0; i < n; i++) {
        particles.push({ x: x, y: y, vx: (Math.random()-0.5)*180, vy: (Math.random()-0.5)*180, life: 0.5, tt: 0, color: color });
    }
}

document.addEventListener('keydown', (e) => { if (e.key === 'r' || e.key === 'R') { reset(); } });
canvas.addEventListener('touchstart', (e) => { e.preventDefault(); punch(e.touches[0].clientX, e.touches[0].clientY); }, { passive: false });
canvas.addEventListener('mousedown', (e) => { punch(e.clientX, e.clientY); });
document.getElementById('restartBtn').onclick = () => { reset(); };

function reset() {
    player.hp = 100; enemy.hp = 100; score = 0; punches = 0; hits = 0;
    gameOver = false; shake = 0; particles = [];
    scoreEl.textContent = 'Schläge: 0';
    bestEl.textContent = 'Best: ' + best;
    player.x = W * 0.25; enemy.x = W * 0.75 - enemy.w;
}

function punch(mx, my) {
    if (gameOver) { reset(); return; }
    const rect = canvas.getBoundingClientRect();
    const cx = (mx - rect.left) / (rect.width / W);
    const cy = (my - rect.top) / (rect.height / H);
    punches++;
    if (cx > enemy.x && cx < enemy.x + enemy.w && cy > enemy.y && cy < enemy.y + enemy.h) {
        hits++;
        enemy.hp -= 15;
        score += 10;
        scoreEl.textContent = 'Schläge: ' + score;
        createParticles(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, '#ffd700', 15);
        shake = 15;
        if (enemy.hp <= 0) { enemy.hp = 0; gameOver = true; }
    }
    if (enemy.hp > 0 && Math.random() < 0.3) {
        player.hp -= 10;
        createParticles(player.x + player.w / 2, player.y + player.h / 2, '#ff0044', 10);
        shake = 10;
        if (player.hp <= 0) { player.hp = 0; gameOver = true; }
    }
}

let lastT = 0;
function loop(ts) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.033, (ts - lastT) / 1000 || 0.016);
    lastT = ts;

    ctx.fillStyle = '#050508';
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    if (shake > 0) { ctx.translate((Math.random()-0.5)*shake, (Math.random()-0.5)*shake); shake *= 0.9; if (shake < 0.5) shake = 0; }

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, H * 0.6, W, H * 0.4);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(W * 0.1, H * 0.6); ctx.lineTo(W * 0.9, H * 0.6);
    ctx.stroke();

    ctx.fillStyle = player.color;
    ctx.shadowColor = player.color;
    ctx.shadowBlur = 15;
    ctx.fillRect(player.x, player.y, player.w, player.h);
    ctx.shadowBlur = 0;

    ctx.fillStyle = enemy.color;
    ctx.shadowColor = enemy.color;
    ctx.shadowBlur = 15;
    ctx.fillRect(enemy.x, enemy.y, enemy.w, enemy.h);
    ctx.shadowBlur = 0;

    enemy.x += enemy.vx * dt;
    enemy.vx *= 0.95;
    if (Math.abs(enemy.vx) > 5 && Math.random() < 0.02) {
        enemy.vx = (Math.random() > 0.5 ? 150 : -150);
    }
    if (enemy.x < W * 0.55) enemy.x = W * 0.55;
    if (enemy.x > W * 0.95 - enemy.w) enemy.x = W * 0.95 - enemy.w;

    ctx.fillStyle = '#ff3e3e';
    ctx.fillRect(10, 30, 200, 12);
    ctx.fillStyle = '#00eaff';
    ctx.fillRect(10, 30, player.hp * 2, 12);
    ctx.fillStyle = '#ff0044';
    ctx.fillRect(W - 210, 30, 200, 12);
    ctx.fillStyle = '#ffd700';
    ctx.fillRect(W - 210, 30, enemy.hp * 2, 12);

    ctx.restore();

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
    ctx.fillText('Schläge: ' + score + '  Treffer: ' + hits + '/' + punches, 12, H - 12);
    if (best > 0) { ctx.fillStyle = '#607d8b'; ctx.fillText('Best: ' + best, W - 140, 24); }

    if (gameOver) {
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = enemy.hp <= 0 ? '#00eaff' : '#ff0044';
        ctx.font = 'bold 40px Arial';
        ctx.textAlign = 'center';
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 20;
        ctx.fillText(enemy.hp <= 0 ? 'K.O. GEWONNEN!' : 'K.O. VERLOREN!', W / 2, H / 2 - 10);
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#fff';
        ctx.font = '18px Arial';
        ctx.fillText('Schläge: ' + score + '   R = Neustart', W / 2, H / 2 + 30);
    }
}
loop(0);