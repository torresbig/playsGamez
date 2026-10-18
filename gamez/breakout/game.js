const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const livesEl = document.getElementById('lives');

const BEST_KEY = 'playsgamez_breakout_best';
let best = +(localStorage.getItem(BEST_KEY) || 0);
bestEl.textContent = 'Best: ' + best;

let W, H;
let paddle = { w: 90, h: 12, x: 0, y: 0, dx: 7 };
let ball = { r: 7, x: 0, y: 0, vx: 4, vy: -4, moving: false };
let bricks = [];
let rows = 5, cols = 7;
let brickW = 70, brickH = 20, brickPad = 8, brickOffTop = 40, brickOffLeft = 35;
let score = 0, lives = 3;
let over = false, won = false;

function getSize() {
    const rect = canvas.getBoundingClientRect();
    let w = Math.min(Math.max(rect.width, 300), 600);
    let h = Math.min(Math.max(rect.height, 200), 440);
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
    paddle.x = W / 2 - paddle.w / 2;
    paddle.y = H - 30;
    ball.x = W / 2;
    ball.y = paddle.y - ball.r;
    initBricks();
}
window.addEventListener('resize', resize);
resize();

function initBricks() {
    bricks = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            bricks.push({
                x: brickOffLeft + c * (brickW + brickPad),
                y: brickOffTop + r * (brickH + brickPad),
                w: brickW, h: brickH,
                alive: true,
                color: `hsl(${(r * 40 + c * 20) % 360}, 80%, 55%)`
            });
        }
    }
}

function resetBall() {
    ball.moving = false;
    ball.x = W / 2;
    ball.y = paddle.y - ball.r;
    ball.vx = 4 * (Math.random() > 0.5 ? 1 : -1);
    ball.vy = -4;
}

function reset() {
    score = 0; lives = 3; over = false; won = false;
    scoreEl.textContent = 'Score: 0';
    livesEl.textContent = 'Leben: 3';
    paddle.x = W / 2 - paddle.w / 2;
    initBricks();
    resetBall();
}
reset();

document.addEventListener('keydown', (e) => {
    if (e.key === 'r' || e.key === 'R') { reset(); return; }
    if ((e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') && paddle.x > 0) paddle.x -= paddle.dx;
    if ((e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') && paddle.x < W - paddle.w) paddle.x += paddle.dx;
    if (e.key === ' ' || e.key === 'Spacebar') ball.moving = true;
});

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const mx = (e.clientX - rect.left) / (rect.width / W);
    paddle.x = mx - paddle.w / 2;
    if (paddle.x < 0) paddle.x = 0;
    if (paddle.x > W - paddle.w) paddle.x = W - paddle.w;
    if (!ball.moving) ball.x = paddle.x + paddle.w / 2;
});

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const mx = (e.touches[0].clientX - rect.left) / (rect.width / W);
    paddle.x = mx - paddle.w / 2;
    if (paddle.x < 0) paddle.x = 0;
    if (paddle.x > W - paddle.w) paddle.x = W - paddle.w;
    if (!ball.moving) ball.x = paddle.x + paddle.w / 2;
}, { passive: false });

document.getElementById('restartBtn').onclick = reset;

function update() {
    if (over || won) return;

    if (!ball.moving) {
        ball.x = paddle.x + paddle.w / 2;
        ball.y = paddle.y - ball.r;
        return;
    }

    ball.x += ball.vx;
    ball.y += ball.vy;

    if (ball.x - ball.r < 0) { ball.x = ball.r; ball.vx *= -1; }
    if (ball.x + ball.r > W) { ball.x = W - ball.r; ball.vx *= -1; }
    if (ball.y - ball.r < 0) { ball.y = ball.r; ball.vy *= -1; }

    if (ball.y + ball.r > paddle.y && ball.y - ball.r < paddle.y + paddle.h &&
        ball.x > paddle.x && ball.x < paddle.x + paddle.w) {
        ball.y = paddle.y - ball.r;
        ball.vy = -Math.abs(ball.vy);
        const hit = (ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2);
        ball.vx = hit * 6;
    }

    if (ball.y + ball.r > H) {
        lives--;
        livesEl.textContent = 'Leben: ' + lives;
        if (lives <= 0) { over = true; }
        else resetBall();
    }

    for (const b of bricks) {
        if (!b.alive) continue;
        if (ball.x + ball.r > b.x && ball.x - ball.r < b.x + b.w &&
            ball.y + ball.r > b.y && ball.y - ball.r < b.y + b.h) {
            b.alive = false;
            score += 10;
            scoreEl.textContent = 'Score: ' + score;
            if (score > best) {
                best = score;
                localStorage.setItem(BEST_KEY, best);
                bestEl.textContent = 'Best: ' + best;
            }
            ball.vy *= -1;
            break;
        }
    }
    if (!bricks.some(b => b.alive)) won = true;
}

function draw() {
    ctx.fillStyle = '#050508';
    ctx.fillRect(0, 0, W, H);

    for (const b of bricks) {
        if (!b.alive) continue;
        ctx.fillStyle = b.color;
        ctx.shadowColor = b.color;
        ctx.shadowBlur = 10;
        ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.shadowBlur = 0;
    }

    ctx.fillStyle = '#00eaff';
    ctx.shadowColor = '#00eaff';
    ctx.shadowBlur = 12;
    ctx.fillRect(paddle.x, paddle.y, paddle.w, paddle.h);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#fff';
    ctx.shadowColor = '#fff';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    if (over) {
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#ff3e3e';
        ctx.font = 'bold 40px Arial';
        ctx.textAlign = 'center';
        ctx.shadowColor = '#ff3e3e';
        ctx.shadowBlur = 16;
        ctx.fillText('GAME OVER', W / 2, H / 2 - 10);
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#fff';
        ctx.font = '18px Arial';
        ctx.fillText('Score: ' + score + '   R = Neustart', W / 2, H / 2 + 30);
    } else if (won) {
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#00eaff';
        ctx.font = 'bold 40px Arial';
        ctx.textAlign = 'center';
        ctx.shadowColor = '#00eaff';
        ctx.shadowBlur = 16;
        ctx.fillText('GEWONNEN!', W / 2, H / 2 - 10);
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#fff';
        ctx.font = '18px Arial';
        ctx.fillText('Score: ' + score + '   R = Neustart', W / 2, H / 2 + 30);
    } else if (!ball.moving) {
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Leertaste zum Starten', W / 2, H / 2 - 40);
    }
}

let last = 0;
function loop(ts) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, (ts - last) / 1000 || 0.016);
    last = ts;
    update();
    draw();
}
requestAnimationFrame(loop);

