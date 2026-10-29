const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');

const BEST_KEY = 'playsgamez_basketball_best';
let best = +(localStorage.getItem(BEST_KEY) || 0);
bestEl.textContent = 'Best: ' + best;

let W, H;
let ball = { x: 0, y: 0, r: 14, vx: 0, vy: 0, ax: 0, ay: 0, grounded: false, color: '#ff8c00' };
let hoop = { x: 0, y: 0, w: 50, h: 8, rimY: 0, netY: 0 };
let backboard = { x: 0, y: 0, w: 10, h: 80 };
let particles = [];
let aimLine = { active: false, startX: 0, startY: 0, endX: 0, endY: 0 };
let shot = false;
let score = 0, shots = 0, made = 0;
let gameOver = false;

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
    initPositions();
}
window.addEventListener('resize', resize);
resize();

function initPositions() {
    ball.x = W * 0.25;
    ball.y = H * 0.85;
    ball.vx = 0; ball.vy = 0; ball.grounded = true;
    hoop.x = W * 0.75;
    hoop.y = H * 0.35;
    hoop.w = 52; hoop.h = 8;
    hoop.rimY = hoop.y + 4;
    hoop.netY = hoop.y + 40;
    backboard.x = hoop.x - 12;
    backboard.y = hoop.y - 60;
    backboard.w = 10; backboard.h = 70;
    shot = false;
    aimLine.active = false;
}

function reset() {
    score = 0; shots = 0; made = 0;
    gameOver = false;
    scoreEl.textContent = 'Score: 0';
    bestEl.textContent = 'Best: ' + best;
    initPositions();
}
reset();

function shoot(vx, vy) {
    if (shot || gameOver) return;
    shot = true;
    ball.vx = vx;
    ball.vy = vy;
    ball.grounded = false;
    shots++;
    aimLine.active = false;
    createParticles(ball.x, ball.y, '#ffffff', 6);
}

function createParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x: x, y: y,
            vx: (Math.random() - 0.5) * 120,
            vy: (Math.random() - 0.5) * 120,
            life: 0.5, tt: 0,
            color: color
        });
    }
}

function handleInput(clientX, clientY, isStart) {
    if (gameOver) { reset(); return; }
    const rect = canvas.getBoundingClientRect();
    const mx = (clientX - rect.left) / (rect.width / W);
    const my = (clientY - rect.top) / (rect.height / H);

    if (isStart && !shot && ball.grounded) {
        aimLine.active = true;
        aimLine.startX = ball.x;
        aimLine.startY = ball.y;
        aimLine.endX = mx;
        aimLine.endY = my;
    } else if (!isStart && aimLine.active && !shot) {
        aimLine.active = false;
        const dx = ball.x - mx;
        const dy = ball.y - my;
        const power = Math.min(Math.hypot(dx, dy) * 1.2, 900);
        const angle = Math.atan2(dy, dx);
        shoot(-Math.cos(angle) * power, -Math.sin(angle) * power);
    }
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'r' || e.key === 'R') { reset(); return; }
});

canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    handleInput(e.touches[0].clientX, e.touches[0].clientY, true);
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    handleInput(e.touches[0].clientX, e.touches[0].clientY, false);
}, { passive: false });

canvas.addEventListener('mousedown', (e) => {
    handleInput(e.clientX, e.clientY, true);
});

canvas.addEventListener('mouseup', (e) => {
    handleInput(e.clientX, e.clientY, false);
});

document.getElementById('restartBtn').onclick = reset;

let lastT = 0;
function loop(ts) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.033, (ts - lastT) / 1000 || 0.016);
    lastT = ts;

    ctx.fillStyle = '#050508';
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(W * 0.2, H * 0.2); ctx.lineTo(W * 0.8, H * 0.2);
    ctx.moveTo(W * 0.2, H * 0.8); ctx.lineTo(W * 0.8, H * 0.8);
    ctx.moveTo(W * 0.2, H * 0.2); ctx.lineTo(W * 0.2, H * 0.8);
    ctx.moveTo(W * 0.8, H * 0.2); ctx.lineTo(W * 0.8, H * 0.8);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 15;
    ctx.fillRect(backboard.x, backboard.y, backboard.w, backboard.h);
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(backboard.x + 2, backboard.y + 5, backboard.w - 4, backboard.h - 10);

    ctx.fillStyle = '#ffd700';
    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur = 12;
    ctx.fillRect(hoop.x, hoop.rimY, hoop.w, hoop.h);
    ctx.shadowBlur = 0;

    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= 5; i++) {
        const nx = hoop.x + (i / 5) * hoop.w;
        ctx.moveTo(nx, hoop.rimY + hoop.h);
        ctx.lineTo(nx, hoop.netY);
    }
    for (let i = 0; i <= 3; i++) {
        const ny = hoop.rimY + hoop.h + (i / 3) * 25;
        ctx.moveTo(hoop.x, ny);
        ctx.lineTo(hoop.x + hoop.w, ny);
    }
    ctx.stroke();

    if (!shot && !gameOver) {
        ctx.strokeStyle = 'rgba(255,215,0,0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(hoop.x + hoop.w / 2, hoop.rimY + hoop.h / 2, 14, 0, Math.PI * 2);
        ctx.stroke();
    }

    if (shot && !gameOver) {
        ball.vy += 700 * dt;
        ball.x += ball.vx * dt;
        ball.y += ball.vy * dt;

        if (ball.y + ball.r > H - 40) {
            ball.y = H - 40 - ball.r;
            ball.vy = -ball.vy * 0.4;
            ball.vx *= 0.7;
            if (Math.abs(ball.vy) < 10) { ball.vy = 0; ball.grounded = true; shot = false; }
            createParticles(ball.x, ball.y + ball.r, '#ff8c00', 4);
        }
        if (ball.x - ball.r < 0) { ball.x = ball.r; ball.vx = -ball.vx * 0.5; }
        if (ball.x + ball.r > W) { ball.x = W - ball.r; ball.vx = -ball.vx * 0.5; }
        if (ball.y - ball.r < 0) { ball.y = ball.r; ball.vy = -ball.vy * 0.5; }

        if (ball.x > hoop.x && ball.x < hoop.x + hoop.w &&
            ball.y > hoop.rimY && ball.y < hoop.rimY + hoop.h + 5 && ball.vy > 0) {
            made++;
            score += 10;
            scoreEl.textContent = 'Score: ' + score;
            createParticles(hoop.x + hoop.w / 2, hoop.rimY, '#00ff88', 20);
            shot = false; ball.grounded = true;
            setTimeout(() => {
                ball.x = W * 0.25; ball.y = H * 0.85;
                ball.vx = 0; ball.vy = 0;
            }, 600);
        }

        if (ball.x > backboard.x && ball.x < backboard.x + backboard.w &&
            ball.y > backboard.y && ball.y < backboard.y + backboard.h) {
            ball.vx = -ball.vx * 0.6;
            ball.vy = -ball.vy * 0.4;
            createParticles(ball.x, ball.y, '#ffffff', 8);
        }

        if (ball.y > H + 50 && !ball.grounded) {
            shot = false; ball.grounded = true;
            setTimeout(() => {
                ball.x = W * 0.25; ball.y = H * 0.85;
                ball.vx = 0; ball.vy = 0;
            }, 400);
        }
    }

    ctx.fillStyle = ball.color;
    ctx.shadowColor = ball.color;
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.stroke();

    if (aimLine.active && !shot) {
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 4]);
        ctx.beginPath();
        ctx.moveTo(aimLine.startX, aimLine.startY);
        ctx.lineTo(aimLine.endX, aimLine.endY);
        ctx.stroke();
        ctx.setLineDash([]);
        const dx = aimLine.endX - aimLine.startX;
        const dy = aimLine.endY - aimLine.startY;
        const angle = Math.atan2(dy, dx);
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.beginPath();
        ctx.moveTo(aimLine.endX, aimLine.endY);
        ctx.lineTo(aimLine.endX - 10 * Math.cos(angle - 0.5), aimLine.endY - 10 * Math.sin(angle - 0.5));
        ctx.lineTo(aimLine.endX - 10 * Math.cos(angle + 0.5), aimLine.endY - 10 * Math.sin(angle + 0.5));
        ctx.fill();
    }

    for (const p of particles) {
        p.tt += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        ctx.globalAlpha = 1 - p.tt / p.life;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, 3, 3);
    }
    ctx.globalAlpha = 1;
    particles = particles.filter(p => p.tt < p.life);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Score: ' + score + '  (' + made + '/' + shots + ')', 12, H - 12);
    if (best > 0) {
        ctx.fillStyle = '#607d8b';
        ctx.fillText('Best: ' + best, W - 120, 24);
    }

    if (gameOver) {
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 40px Arial';
        ctx.textAlign = 'center';
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = 20;
        ctx.fillText('GAME OVER', W / 2, H / 2 - 10);
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#fff';
        ctx.font = '18px Arial';
        ctx.fillText('Treffer: ' + made + '/' + shots + '   R = Neustart', W / 2, H / 2 + 30);
    }
}

loop(0);