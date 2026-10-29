const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');

const BEST_KEY = 'playsgamez_flappy_best';
let best = +(localStorage.getItem(BEST_KEY) || 0);
bestEl.textContent = 'Best: ' + best;

let W, H;
let bird = { x: 60, y: 0, r: 11, vy: 0, gravity: 0.45, jump: -7, rot: 0 };
let pipes = [];
let pipeW = 60, pipeGap = 140, pipeSpeed = 2.5, pipeSpawn = 150;
let frame = 0, score = 0, over = false, started = false;

function getSize() {
    const rect = canvas.getBoundingClientRect();
    let w = Math.min(Math.max(rect.width, 200), 400);
    let h = Math.min(Math.max(rect.height, 300), 600);
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
        bird.y = H / 2;
        bird.x = W * 0.2;
    }
}
window.addEventListener('resize', resize);
resize();

function spawnPipe() {
    const minY = 80;
    const maxY = H - pipeGap - minY;
    const topH = minY + Math.random() * (maxY - minY);
    pipes.push({
        x: W,
        topH: topH,
        bottomY: topH + pipeGap,
        passed: false
    });
}

function jump() {
    if (over) { reset(); return; }
    started = true;
    bird.vy = bird.jump;
}

function reset() {
    bird.y = H / 2;
    bird.vy = 0;
    bird.rot = 0;
    pipes = [];
    frame = 0;
    score = 0;
    over = false;
    started = false;
    scoreEl.textContent = 'Score: 0';
}
reset();

document.addEventListener('keydown', (e) => {
    if (e.key === 'r' || e.key === 'R') { reset(); return; }
    if (e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); jump(); }
});

canvas.addEventListener('mousedown', jump);

canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    jump();
}, { passive: false });

document.getElementById('restartBtn').onclick = reset;

function update() {
    if (!started || over) return;

    bird.vy += bird.gravity;
    bird.y += bird.vy;
    bird.rot = Math.min(Math.PI / 4, Math.max(-Math.PI / 4, bird.vy * 0.15));

    frame++;
    if (frame % pipeSpawn === 0) spawnPipe();

    for (let i = pipes.length - 1; i >= 0; i--) {
        const p = pipes[i];
        p.x -= pipeSpeed;

        if (!p.passed && p.x + pipeW < bird.x) {
            p.passed = true;
            score++;
            scoreEl.textContent = 'Score: ' + score;
            if (score > best) {
                best = score;
                localStorage.setItem(BEST_KEY, best);
                bestEl.textContent = 'Best: ' + best;
            }
        }
        if (p.x + pipeW < 0) pipes.splice(i, 1);

        if (bird.x + bird.r > p.x && bird.x - bird.r < p.x + pipeW) {
            if (bird.y - bird.r < p.topH || bird.y + bird.r > p.bottomY) { over = true; }
        }
    }

    if (bird.y + bird.r > H || bird.y - bird.r < 0) over = true;
}

function draw() {
    ctx.fillStyle = '#0b1320';
    ctx.fillRect(0, 0, W, H);
    
    // Add subtle background animation
    ctx.fillStyle = 'rgba(0, 234, 255, 0.03)';
    for (let i = 0; i < 30; i++) {
        ctx.fillRect((frame * 0.3 + i * 27) % W, (i * 53) % H, 1, 1);
    }
    
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    for (let i = 0; i < 40; i++) {
        ctx.fillRect((frame + i * 51) % W, (i * 73) % H, 1.2, 1.2);
    }

    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    for (let i = 0; i < 40; i++) {
        ctx.fillRect((frame + i * 51) % W, (i * 73) % H, 1.2, 1.2);
    }

    ctx.fillStyle = '#00eaff';
    for (const p of pipes) {
        ctx.shadowColor = '#00eaff';
        ctx.shadowBlur = 10;
        ctx.fillRect(p.x, 0, pipeW, p.topH);
        ctx.fillRect(p.x, p.bottomY, pipeW, H - p.bottomY);
        ctx.shadowBlur = 0;
    }

    ctx.save();
    ctx.translate(bird.x, bird.y);
    ctx.rotate(bird.rot);
    ctx.fillStyle = '#ffd700';
    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(0, 0, bird.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(4, -3, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.shadowBlur = 0;

    // Particle effect on game over
    const particles = [];
    for (let i = 0; i < 20; i++) {
        particles.push({
            x: bird.x,
            y: bird.y,
            vx: (Math.random() - 0.5) * 100,
            vy: (Math.random() - 0.5) * 100,
            life: 0.8,
            tt: 0,
            color: i > 10 ? '#ffd700' : '#00eaff'
        });
    }
    
    if (over) {
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 42px Arial';
        ctx.textAlign = 'center';
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = 16;
        ctx.fillText('GAME OVER', W / 2, H / 2 - 20);
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#fff';
        ctx.font = '18px Arial';
        ctx.fillText('Score: ' + score + '   R = Neustart', W / 2, H / 2 + 22);
        
        // Animate particles
        ctx.save();
        for (const p of particles) {
            p.tt += 0.016;
            ctx.globalAlpha = 1 - p.tt / p.life;
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x - 3, p.y - 3, 6, 6);
            p.x += p.vx * 0.016;
            p.y += p.vy * 0.016;
        }
        ctx.globalAlpha = 1;
        ctx.restore();
    } else if (!started) {
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.font = '17px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Leertaste / Klick zum Starten', W / 2, H / 2 + 10);
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
