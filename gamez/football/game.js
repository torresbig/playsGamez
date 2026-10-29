const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');

const BEST_KEY = 'playsgamez_football_best';
let best = +(localStorage.getItem(BEST_KEY) || 0);
bestEl.textContent = 'Best: ' + best;

let W, H;
let ball = { x: 0, y: 0, r: 10, vx: 0, vy: 0, shot: false, color: '#ffffff' };
let goal = { x: 0, y: 0, w: 0, h: 0 };
let keeper = { x: 0, y: 0, w: 0, h: 0, vx: 0, dir: 1, color: '#ff0044' };
let particles = [];
let aim = { active: false, sx: 0, sy: 0, ex: 0, ey: 0 };
let score = 0, shots = 0, goals = 0, gameOver = false;

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
    resetPos();
}
window.addEventListener('resize', resize);
resize();

function resetPos() {
    ball.x = W * 0.15;
    ball.y = H * 0.85;
    ball.vx = 0; ball.vy = 0; ball.shot = false;
    goal.x = W * 0.75;
    goal.y = H * 0.25;
    goal.w = W * 0.25;
    goal.h = H * 0.35;
    keeper.x = goal.x + goal.w / 2 - 20;
    keeper.y = goal.y + goal.h / 2 - 20;
    keeper.w = 40; keeper.h = 50;
    keeper.vx = 120; keeper.dir = 1;
    aim.active = false;
}
function reset() {
    score = 0; shots = 0; goals = 0; gameOver = false;
    scoreEl.textContent = 'Tore: 0';
    bestEl.textContent = 'Best: ' + best;
    resetPos();
}
reset();

function createParticles(x, y, color, n) {
    for (let i = 0; i < n; i++) {
        particles.push({ x: x, y: y, vx: (Math.random()-0.5)*150, vy: (Math.random()-0.5)*150, life: 0.5, tt: 0, color: color });
    }
}

function shoot(vx, vy) {
    if (ball.shot || gameOver) return;
    ball.shot = true;
    ball.vx = vx; ball.vy = vy;
    shots++;
    aim.active = false;
}

document.addEventListener('keydown', (e) => { if (e.key === 'r' || e.key === 'R') reset(); });
canvas.addEventListener('touchstart', (e) => { e.preventDefault(); if (!ball.shot && !gameOver) { aim.active = true; aim.sx = ball.x; aim.sy = ball.y; aim.ex = e.touches[0].clientX; aim.ey = e.touches[0].clientY; } }, { passive: false });
canvas.addEventListener('touchend', (e) => { e.preventDefault(); if (aim.active && !ball.shot && !gameOver) { const rect = canvas.getBoundingClientRect(); const mx = (e.changedTouches[0].clientX - rect.left)/(rect.width/W); const my = (e.changedTouches[0].clientY - rect.top)/(rect.height/H); const dx = ball.x - mx; const dy = ball.y - my; const p = Math.min(Math.hypot(dx,dy)*1.5, 700); const a = Math.atan2(dy, dx); shoot(-Math.cos(a)*p, -Math.sin(a)*p); } }, { passive: false });
canvas.addEventListener('mousedown', (e) => { if (!ball.shot && !gameOver) { aim.active = true; aim.sx = ball.x; aim.sy = ball.y; aim.ex = e.clientX; aim.ey = e.clientY; } });
canvas.addEventListener('mouseup', (e) => { if (aim.active && !ball.shot && !gameOver) { const rect = canvas.getBoundingClientRect(); const mx = (e.clientX - rect.left)/(rect.width/W); const my = (e.clientY - rect.top)/(rect.height/H); const dx = ball.x - mx; const dy = ball.y - my; const p = Math.min(Math.hypot(dx,dy)*1.5, 700); const a = Math.atan2(dy, dx); shoot(-Math.cos(a)*p, -Math.sin(a)*p); } });
document.getElementById('restartBtn').onclick = reset;

let lastT = 0;
function loop(ts) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.033, (ts - lastT) / 1000 || 0.016);
    lastT = ts;

    ctx.fillStyle = '#050508';
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, H * 0.5, W, H * 0.5);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(goal.x, goal.y); ctx.lineTo(goal.x + goal.w, goal.y);
    ctx.moveTo(goal.x, goal.y + goal.h); ctx.lineTo(goal.x + goal.w, goal.y + goal.h);
    ctx.moveTo(goal.x, goal.y); ctx.lineTo(goal.x, goal.y + goal.h);
    ctx.moveTo(goal.x + goal.w, goal.y); ctx.lineTo(goal.x + goal.w, goal.y + goal.h);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(goal.x + goal.w / 2, goal.y + goal.h / 2, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = keeper.color;
    ctx.shadowColor = keeper.color;
    ctx.shadowBlur = 12;
    ctx.fillRect(keeper.x, keeper.y, keeper.w, keeper.h);
    ctx.shadowBlur = 0;

    keeper.x += keeper.vx * keeper.dir * dt;
    if (keeper.x < goal.x + 10 || keeper.x > goal.x + goal.w - keeper.w - 10) keeper.dir *= -1;

    if (ball.shot && !gameOver) {
        ball.vy += 600 * dt;
        ball.x += ball.vx * dt;
        ball.y += ball.vy * dt;

        if (ball.x > goal.x && ball.x < goal.x + goal.w && ball.y > goal.y && ball.y < goal.y + goal.h) {
            if (ball.x > keeper.x && ball.x < keeper.x + keeper.w && ball.y > keeper.y && ball.y < keeper.y + keeper.h) {
                createParticles(ball.x, ball.y, '#ff0044', 12);
            } else {
                goals++;
                score += 10;
                scoreEl.textContent = 'Tore: ' + goals;
                createParticles(ball.x, ball.y, '#00ff88', 20);
            }
            ball.shot = false;
            setTimeout(() => { ball.x = W * 0.15; ball.y = H * 0.85; ball.vx = 0; ball.vy = 0; }, 700);
        }
        if (ball.y > H + 50 || ball.x < -50 || ball.x > W + 50) {
            ball.shot = false;
            setTimeout(() => { ball.x = W * 0.15; ball.y = H * 0.85; ball.vx = 0; ball.vy = 0; }, 500);
        }
    }

    ctx.fillStyle = ball.color;
    ctx.shadowColor = ball.color;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    if (aim.active && !ball.shot && !gameOver) {
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 4]);
        ctx.beginPath();
        ctx.moveTo(aim.sx, aim.sy);
        ctx.lineTo(aim.ex, aim.ey);
        ctx.stroke();
        ctx.setLineDash([]);
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
    ctx.fillText('Tore: ' + goals + '  (' + goals + '/' + shots + ')', 12, H - 12);
    if (best > 0) { ctx.fillStyle = '#607d8b'; ctx.fillText('Best: ' + best, W - 120, 24); }

    if (gameOver) {
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#00ff88';
        ctx.font = 'bold 40px Arial';
        ctx.textAlign = 'center';
        ctx.shadowColor = '#00ff88';
        ctx.shadowBlur = 20;
        ctx.fillText('GAME OVER', W / 2, H / 2 - 10);
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#fff';
        ctx.font = '18px Arial';
        ctx.fillText('Tore: ' + goals + '/' + shots + '   R = Neustart', W / 2, H / 2 + 30);
    }
}
loop(0);
