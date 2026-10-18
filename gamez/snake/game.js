const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');

const BEST_KEY = 'playsgamez_snake_best';
let best = +(localStorage.getItem(BEST_KEY) || 0);
bestEl.textContent = 'Best: ' + best;

const CS = 20;
let W, H, cols, rows;
let snake, dir, nextDir, food, score, over, paused, acc, accLimit;

function getSize() {
    const rect = canvas.getBoundingClientRect();
    let w = Math.min(Math.max(rect.width, 200), 500);
    let h = Math.min(Math.max(rect.height, 200), 500);
    w = w - (w % CS);
    h = h - (h % CS);
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
    cols = W / CS;
    rows = H / CS;
}
window.addEventListener('resize', resize);
resize();

function placeFood() {
    food = { x: Math.floor(Math.random() * cols), y: Math.floor(Math.random() * rows) };
    for (const s of snake) {
        if (s.x === food.x && s.y === food.y) placeFood();
    }
}

function reset() {
    snake = [{ x: 5, y: Math.floor(rows / 2) }, { x: 4, y: Math.floor(rows / 2) }, { x: 3, y: Math.floor(rows / 2) }];
    dir = { x: 1, y: 0 };
    nextDir = { x: 1, y: 0 };
    score = 0; over = false; paused = false; acc = 0; accLimit = 120;
    scoreEl.textContent = 'Score: 0';
    placeFood();
}
reset();

document.addEventListener('keydown', (e) => {
    if (e.key === 'r' || e.key === 'R') { reset(); return; }
    if (e.key === 'p' || e.key === 'P') paused = !paused;
    const k = e.key;
    if ((k === 'ArrowUp' || k === 'w' || k === 'W') && dir.y === 0) nextDir = { x: 0, y: -1 };
    if ((k === 'ArrowDown' || k === 's' || k === 'S') && dir.y === 0) nextDir = { x: 0, y: 1 };
    if ((k === 'ArrowLeft' || k === 'a' || k === 'A') && dir.x === 0) nextDir = { x: -1, y: 0 };
    if ((k === 'ArrowRight' || k === 'd' || k === 'D') && dir.x === 0) nextDir = { x: 1, y: 0 };
});

document.getElementById('restartBtn').onclick = reset;

function update() {
    if (over || paused) return;
    dir = nextDir;
    const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

    if (head.x < 0 || head.x >= cols || head.y < 0 || head.y >= rows) { gameOver(); return; }
    for (const s of snake) {
        if (s.x === head.x && s.y === head.y) { gameOver(); return; }
    }

    snake.unshift(head);
    if (head.x === food.x && head.y === food.y) {
        score += 10;
        scoreEl.textContent = 'Score: ' + score;
        if (score > best) {
            best = score;
            localStorage.setItem(BEST_KEY, best);
            bestEl.textContent = 'Best: ' + best;
        }
        placeFood();
        if (accLimit > 50) accLimit -= 4;
    } else {
        snake.pop();
    }
}

function gameOver() { over = true; }

function draw() {
    ctx.fillStyle = '#050508';
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1;
    for (let i = 0; i <= W; i += CS) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, H); ctx.stroke();
    }
    for (let i = 0; i <= H; i += CS) {
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(W, i); ctx.stroke();
    }

    ctx.fillStyle = '#ff3e3e';
    ctx.shadowColor = '#ff3e3e';
    ctx.shadowBlur = 12;
    ctx.fillRect(food.x * CS + 2, food.y * CS + 2, CS - 4, CS - 4);
    ctx.shadowBlur = 0;

    snake.forEach((s, i) => {
        ctx.fillStyle = i === 0 ? '#00eaff' : '#00b894';
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 10;
        ctx.fillRect(s.x * CS + 2, s.y * CS + 2, CS - 4, CS - 4);
        ctx.shadowBlur = 0;
    });

    if (over) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
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
    } else if (paused) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 34px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('PAUSE', W / 2, H / 2);
    }
}

let last = 0;
function loop(ts) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, (ts - last) / 1000 || 0.016);
    last = ts;
    acc += dt * 1000;
    if (acc >= accLimit) { acc = 0; update(); }
    draw();
}
requestAnimationFrame(loop);
