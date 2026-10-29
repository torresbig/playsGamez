const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');

const BEST_KEY = 'playsgamez_archery_best';
let best = +(localStorage.getItem(BEST_KEY) || 0);
bestEl.textContent = 'Best: ' + best;

let W, H;
let bow = { x: 0, y: 0, w: 10, h: 60, color: '#a200ff' };
let arrow = { x: 0, y: 0, vx: 0, vy: 0, flying: false, r: 3, color: '#ffd700' };
let target = { x: 0, y: 0, r: 0, rings: [50, 30, 15, 5], colors: ['#ff0044', '#ffd700', '#00eaff', '#a200ff'] };
let particles = [];
let aim = { active: false, sx: 0, sy: 0, ex: 0, ey: 0 };
let score = 0, shots = 0, gameOver = false;

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
    bow.x = W * 0.15;
    bow.y = H * 0.55;
    arrow.x = bow.x + bow.w;
    arrow.y = bow.y + bow.h / 2;
    target.x = W * 0.8;
    target.y = H * 0.35;
    target.r = 40;
}
window.addEventListener('resize', resize);
resize();

function reset() {
    score = 0; shots = 0; gameOver = false; particles = [];
    scoreEl.textContent = 'Punkte: 0';
    bestEl.textContent = 'Best: ' + best;
    arrow.flying = false;
    arrow.x = bow.x + bow.w;
    arrow.y = bow.y + bow.h / 2;
}
reset();

function createParticles(x, y, color, n) {
    for (let i = 0; i < n; i++) {
        particles.push({ x: x, y: y, vx: (Math.random()-0.5)*120, vy: (Math.random()-0.5)*120, life: 0.5, tt: 0, color: color });
    }
}

function shoot(vx, vy) {
    if (arrow.flying || gameOver) return;
    arrow.flying = true;
    arrow.vx = vx;
    arrow.vy = vy;
    shots++;
    aim.active = false;
    createParticles(arrow.x, arrow.y, '#ffffff', 6);
}

document.addEventListener('keydown', (e) => { if (e.key === 'r' || e.key === 'R') reset(); });
canvas.addEventListener('touchstart', (e) => { e.preventDefault(); if (!arrow.flying && !gameOver) { aim.active = true; aim.sx = bow.x + bow.w; aim.sy = bow.y + bow.h / 2; aim.ex = e.touches[0].clientX; aim.ey = e.touches[0].clientY; } }, { passive: false });
canvas.addEventListener('touchend', (e) => { e.preventDefault(); if (aim.active && !arrow.flying && !gameOver) { const rect = canvas.getBoundingClientRect(); const mx = (e.changedTouches[0].clientX - rect.left)/(rect.width/W); const my = (e.changedTouches[0].clientY - rect.top)/(rect.height/H); const dx = bow.x + bow.w - mx; const dy = bow.y + bow.h/2 - my; const p = Math.min(Math.hypot(dx,dy)*2, 900); const a = Math.atan2(dy, dx); shoot(-Math.cos(a)*p, -Math.sin(a)*p); } }, { passive: false });
canvas.addEventListener('mousedown', (e) => { if (!arrow.flying && !gameOver) { aim.active = true; aim.sx = bow.x + bow.w; aim.sy = bow.y + bow.h / 2; aim.ex = e.clientX; aim.ey = e.clientY; } });
canvas.addEventListener('mouseup', (e) => { if (aim.active && !arrow.flying && !gameOver) { const rect = canvas.getBoundingClientRect(); const mx = (e.clientX - rect.left)/(rect.width/W); const my = (e.clientY - rect.top)/(rect.height/H); const dx = bow.x + bow.w - mx; const dy = bow.y + bow.h/2 - my; const p = Math.min(Math.hypot(dx,dy)*2, 900); const a = Math.atan2(dy, dx); shoot(-Math.cos(a)*p, -Math.sin(a)*p); } });
document.getElementById('restartBtn').onclick = reset;

let lastT = 0;
function loop(ts) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.033, (ts - lastT) / 1000 || 0.016);
    lastT = ts;

    ctx.fillStyle = '#050508';
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, H * 0.4, W, H * 0.6);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, H * 0.4); ctx.lineTo(W, H * 0.4);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < target.rings.length; i++) {
        ctx.beginPath();
        ctx.arc(target.x, target.y, target.rings[i], 0, Math.PI * 2);
        ctx.stroke();
    }

    ctx.fillStyle = bow.color;
    ctx.shadowColor = bow.color;
    ctx.shadowBlur = 12;
    ctx.fillRect(bow.x, bow.y, bow.w, bow.h);
    ctx.shadowBlur = 0;

    if (aim.active && !arrow.flying && !gameOver) {
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(aim.sx, aim.sy);
        ctx.lineTo(aim.ex, aim.ey);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    if (arrow.flying && !gameOver) {
        arrow.vy += 500 * dt;
        arrow.x += arrow.vx * dt;
        arrow.y += arrow.vy * dt;

        const dx = arrow.x - target.x;
        const dy = arrow.y - target.y;
        const dist = Math.hypot(dx, dy);

        if (arrow.x < 0 || arrow.x > W || arrow.y < 0 || arrow.y > H + 50) {
            arrow.flying = false;
            setTimeout(() => {
                arrow.x = bow.x + bow.w;
                arrow.y = bow.y + bow.h / 2;
                arrow.vx = 0; arrow.vy = 0;
            }, 600);
        } else if (dist < target.rings[3]) {
            score += 100;
            scoreEl.textContent = 'Punkte: ' + score;
            createParticles(arrow.x, arrow.y, '#00eaff', 20);
            arrow.flying = false;
            setTimeout(() => {
                arrow.x = bow.x + bow.w;
                arrow.y = bow.y + bow.h / 2;
                arrow.vx = 0; arrow.vy = 0;
            }, 600);
        } else if (dist < target.rings[2]) {
            score += 70;
            scoreEl.textContent = 'Punkte: ' + score;
            createParticles(arrow.x, arrow.y, '#00eaff', 15);
            arrow.flying = false;
            setTimeout(() => {
                arrow.x = bow.x + bow.w;
                arrow.y = bow.y + bow.h / 2;
                arrow.vx = 0; arrow.vy = 0;
            }, 600);
        } else if (dist < target.rings[1]) {
            score += 50;
            scoreEl.textContent = 'Punkte: ' + score;
            createParticles(arrow.x, arrow.y, '#ffd700', 12);
            arrow.flying = false;
            setTimeout(() => {
                arrow.x = bow.x + bow.w;
                arrow.y = bow.y + bow.h / 2;
                arrow.vx = 0; arrow.vy = 0;
            }, 600);
        } else if (dist < target.rings[0]) {
            score += 30;
            scoreEl.textContent = 'Punkte: ' + score;
            createParticles(arrow.x, arrow.y, '#ff0044', 10);
            arrow.flying = false;
            setTimeout(() => {
                arrow.x = bow.x + bow.w;
                arrow.y = bow.y + bow.h / 2;
                arrow.vx = 0; arrow.vy = 0;
            }, 600);
        }
    }

    ctx.fillStyle = arrow.color;
    ctx.shadowColor = arrow.color;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(arrow.x, arrow.y, arrow.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

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
    ctx.fillText('Punkte: ' + score + '  (' + shots + ' Schüsse)', 12, H - 12);
    if (best > 0) { ctx.fillStyle = '#607d8b'; ctx.fillText('Best: ' + best, W - 140, 24); }

    if (gameOver) {
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#a200ff';
        ctx.font = 'bold 40px Arial';
        ctx.textAlign = 'center';
        ctx.shadowColor = '#a200ff';
        ctx.shadowBlur = 20;
        ctx.fillText('ENDE', W / 2, H / 2 - 10);
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#fff';
        ctx.font = '18px Arial';
        ctx.fillText('Punkte: ' + score + '   R = Neustart', W / 2, H / 2 + 30);
    }
}
loop(0);
