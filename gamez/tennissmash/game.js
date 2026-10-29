const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');

const BEST_KEY = 'playsgamez_tennissmash_best';
let best = +(localStorage.getItem(BEST_KEY) || 0);
bestEl.textContent = 'Best: ' + best;

let W, H;
let player = { x: 0, y: 0, w: 24, h: 70, vx: 0, vy: 0, color: '#00eaff' };
let enemy = { x: 0, y: 0, w: 24, h: 70, vx: 0, vy: 0, color: '#ff0044' };
let ball = { x: 0, y: 0, vx: 0, vy: 0, r: 8, color: '#ffffff', active: false };
let netY = 0;
let particles = [];
let score = 0, rallies = 0, gameOver = false, shake = 0;
let touchX = 0, steering = false;

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
    player.x = W * 0.2;
    player.y = H * 0.75 - player.h;
    enemy.x = W * 0.8 - enemy.w;
    enemy.y = H * 0.25;
    netY = H * 0.5;
    resetBall();
}
window.addEventListener('resize', resize);
resize();

function resetBall() {
    ball.x = W * 0.5;
    ball.y = H * 0.5;
    ball.vx = 0;
    ball.vy = 0;
    ball.active = false;
    ballSpawned = false;  // Reset the spawn flag so ball can be spawned again
}

function reset() {
    score = 0; rallies = 0; gameOver = false; shake = 0; particles = [];
    player.y = H * 0.75 - player.h;
    enemy.y = H * 0.25;
    resetBall();
    scoreEl.textContent = 'Punkte: 0';
    bestEl.textContent = 'Best: ' + best;
}

function createParticles(x, y, color, n) {
    for (let i = 0; i < n; i++) {
        particles.push({ x: x, y: y, vx: (Math.random()-0.5)*140, vy: (Math.random()-0.5)*140, life: 0.5, tt: 0, color: color });
    }
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'r' || e.key === 'R') reset();
    if (e.key === 'ArrowLeft') player.vx = -220;
    if (e.key === 'ArrowRight') player.vx = 220;
    if (e.key === 'ArrowUp') player.vy = -220;
    if (e.key === 'ArrowDown') player.vy = 220;
});
document.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') player.vx = 0;
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') player.vy = 0;
});
canvas.addEventListener('touchstart', (e) => { e.preventDefault(); touchX = e.touches[0].clientX; steering = true; }, { passive: false });
canvas.addEventListener('touchmove', (e) => { e.preventDefault(); touchX = e.touches[0].clientX; }, { passive: false });
canvas.addEventListener('touchend', () => { steering = false; });
canvas.addEventListener('mousedown', (e) => { touchX = e.clientX; steering = true; });
window.addEventListener('mousemove', (e) => { if (steering) touchX = e.clientX; });
window.addEventListener('mouseup', () => { steering = false; });
document.getElementById('restartBtn').onclick = reset;

let lastT = 0;
let ballSpawned = false;
function loop(ts) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.033, (ts - lastT) / 1000 || 0.016);
    lastT = ts;

    ctx.fillStyle = '#050508';
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, netY); ctx.lineTo(W, netY);
    ctx.setLineDash([12, 12]);
    ctx.stroke();
    ctx.setLineDash([]);

    if (steering && !gameOver) {
        const rect = canvas.getBoundingClientRect();
        const tx = (touchX - rect.left) / (rect.width / W);
        player.x = Math.max(W * 0.05, Math.min(W * 0.45 - player.w, tx - player.w / 2));
    }
    player.x += player.vx * dt;
    player.y += player.vy * dt;
    player.x = Math.max(W * 0.05, Math.min(W * 0.45 - player.w, player.x));
    player.y = Math.max(H * 0.55, Math.min(H - 40 - player.h, player.y));

    enemy.x = Math.max(W * 0.55, Math.min(W - 30 - enemy.w, ball.x - enemy.w / 2));
    enemy.y += (H * 0.3 + Math.sin(ts * 0.002) * 30 - enemy.y) * 0.1;

    if (!ball.active && !gameOver) {
        ball.x = player.x + player.w / 2;
        ball.y = player.y - ball.r;
        ball.vx = 0; ball.vy = 0;
    }

    if (ball.active && !gameOver) {
        ball.vy += 650 * dt;
        ball.x += ball.vx * dt;
        ball.y += ball.vy * dt;

        if (ball.y - ball.r < netY && ball.x > W * 0.45 && ball.x < W * 0.55) {
            ball.vy = -Math.abs(ball.vy) * 0.7;
            createParticles(W * 0.5, netY, '#ffffff', 6);
        }

        const hitPaddle = (p) => ball.x + ball.r > p.x && ball.x - ball.r < p.x + p.w &&
            ball.y + ball.r > p.y && ball.y - ball.r < p.y + p.h;

        if (hitPaddle(player)) {
            ball.vx = Math.abs(ball.vx) * 1.1 + 80;
            ball.vy = (ball.y - (player.y + player.h / 2)) * 0.8;
            rallies++;
            score += 10;
            scoreEl.textContent = 'Punkte: ' + score;
            createParticles(ball.x, ball.y, '#00eaff', 10);
            shake = 8;
        } else if (hitPaddle(enemy)) {
            ball.vx = -Math.abs(ball.vx) * 1.1 - 80;
            ball.vy = (ball.y - (enemy.y + enemy.h / 2)) * 0.8;
            createParticles(ball.x, ball.y, '#ff0044', 10);
            shake = 8;
        }

        if (ball.x < 0 || ball.x > W) {
            if (ball.x < 0) {
                score += 5;
                scoreEl.textContent = 'Punkte: ' + score;
            }
            ball.active = false;
            setTimeout(resetBall, 700);
        }
        if (ball.y > H + 50 || ball.y < -50) {
            ball.active = false;
            setTimeout(resetBall, 700);
        }
    }

    // Ball auto-spawn with cooldown – only if not already active and game not over
    if (!ball.active && !gameOver && !ballSpawned) {
        ballSpawned = true;
        setTimeout(() => {
            ball.active = true;
            ball.vx = 200 + Math.random() * 100;
            ball.vy = -300 - Math.random() * 100;
            ballSpawned = false;
        }, 500);
    }

    ctx.save();
    if (shake > 0) { ctx.translate((Math.random()-0.5)*shake, (Math.random()-0.5)*shake); shake *= 0.9; if (shake < 0.5) shake = 0; }

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

    ctx.restore();

    ctx.fillStyle = ball.color;
    ctx.shadowColor = ball.color;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
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
    ctx.fillText('Punkte: ' + score + '  Rallyes: ' + rallies, 12, H - 12);
    if (best > 0) { ctx.fillStyle = '#607d8b'; ctx.fillText('Best: ' + best, W - 140, 24); }

    if (gameOver) {
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#ff9500';
        ctx.font = 'bold 40px Arial';
        ctx.textAlign = 'center';
        ctx.shadowColor = '#ff9500';
        ctx.shadowBlur = 20;
        ctx.fillText('GAME OVER', W / 2, H / 2 - 10);
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#fff';
        ctx.font = '18px Arial';
        ctx.fillText('Punkte: ' + score + '   R = Neustart', W / 2, H / 2 + 30);
    }
}
loop(0);
