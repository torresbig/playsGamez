const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');

const BEST_KEY = 'playsgamez_reaction_best';
let best = +(localStorage.getItem(BEST_KEY) || 0);
bestEl.textContent = best > 0 ? 'Best: ' + best + ' ms' : 'Best: - ms';

let W, H;
let state = 'waiting';
let target = { x: 0, y: 0, r: 26, active: false, color: '#00ff88' };
let startTime = 0, reaction = 0;
let attempts = 0;
let particles = [];
let msg = 'Warte auf das Ziel...';
let msgColor = '#00eaff';

function getSize() {
    const rect = canvas.getBoundingClientRect();
    let w = Math.min(Math.max(rect.width, 250), 450);
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
}
window.addEventListener('resize', resize);
resize();

function reset() {
    state = 'waiting';
    attempts = 0;
    reaction = 0;
    target.active = false;
    particles = [];
    msg = 'Warte auf das Ziel...';
    msgColor = '#00eaff';
    scoreEl.textContent = 'Versuche: 0';
    bestEl.textContent = best > 0 ? 'Best: ' + best + ' ms' : 'Best: - ms';
}
reset();

function spawnTarget() {
    const margin = 40;
    target.x = margin + Math.random() * Math.max(1, W - 2 * margin);
    target.y = margin + Math.random() * Math.max(1, H - 2 * margin);
    target.r = 22 + Math.random() * 14;
    target.color = Math.random() > 0.5 ? '#00ff88' : '#ffd700';
    target.active = true;
    state = 'ready';
    startTime = performance.now() + (1000 + Math.random() * 2000);
    msg = 'Bereit...';
    msgColor = '#ffd700';
}

function handleTap(clientX, clientY) {
    if (state === 'waiting') {
        spawnTarget();
        return;
    }
    if (state === 'result') {
        reset();
        spawnTarget();
        return;
    }

    const rect = canvas.getBoundingClientRect();
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const mx = (clientX - rect.left) / (rect.width / W);
    const my = (clientY - rect.top) / (rect.height / H);

    if (!target.active) {
        attempts++;
        scoreEl.textContent = 'Versuche: ' + attempts;
        msg = 'Zu fr\u00fcher! Warte auf das Ziel.';
        msgColor = '#ff0044';
        particles = [];
        for (let i = 0; i < 20; i++) {
            particles.push({ x: mx, y: my, vx: (Math.random() - 0.5) * 200, vy: (Math.random() - 0.5) * 200, life: 0.5, tt: 0, color: '#ff0044' });
        }
        target.active = false;
        state = 'waiting';
        return;
    }

    const dx = mx - target.x;
    const dy = my - target.y;
    const dist = Math.hypot(dx, dy);

    if (dist < target.r + 12) {
        const endTime = performance.now();
        reaction = Math.round(endTime - startTime);
        attempts++;
        scoreEl.textContent = 'Versuche: ' + attempts;

        if (best === 0 || reaction < best) {
            best = reaction;
            localStorage.setItem(BEST_KEY, best);
            bestEl.textContent = 'Best: ' + best + ' ms';
            msg = '\u{1F3AF} Neuer Bestwert: ' + reaction + ' ms!';
            msgColor = '#00ff88';
        } else {
            msg = 'Reaktionszeit: ' + reaction + ' ms';
            msgColor = '#00eaff';
        }

        explode(target.x, target.y, target.color);
        target.active = false;
        state = 'result';
    } else {
        attempts++;
        scoreEl.textContent = 'Versuche: ' + attempts;
        msg = 'Nebenbei! Versuche es nochmal.';
        msgColor = '#ff0044';
        explode(mx, my, '#ff0044');
    }
}

function explode(x, y, color) {
    particles = [];
    for (let i = 0; i < 14; i++) {
        particles.push({
            x: x, y: y,
            vx: (Math.random() - 0.5) * 160,
            vy: (Math.random() - 0.5) * 160,
            life: 0.5, tt: 0,
            color: color || '#00eaff'
        });
    }
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'r' || e.key === 'R') { reset(); return; }
});

canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    handleTap(e.touches[0].clientX, e.touches[0].clientY);
}, { passive: false });

canvas.addEventListener('mousedown', (e) => {
    handleTap(e.clientX, e.clientY);
});

document.getElementById('restartBtn').onclick = reset;

let lastT = 0;
function loop(ts) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.033, (ts - lastT) / 1000 || 0.016);
    lastT = ts;

    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    for (let i = 0; i < 30; i++) {
        const x = (i * 137 + ts * 0.02) % W;
        const y = (i * 73 + ts * 0.03) % H;
        ctx.fillRect(x, y, 1.5, 1.5);
    }

    if (state === 'waiting') {
        ctx.fillStyle = '#607d8b';
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(msg, W / 2, H / 2 - 20);
        ctx.font = '15px Arial';
        ctx.fillStyle = '#cfd8dc';
        ctx.fillText('Tippe hier zum Starten', W / 2, H / 2 + 20);
    }
    else if (state === 'ready') {
        const now = performance.now();
        if (now >= startTime) {
            state = 'showing';
            msg = 'JETZT!';
            msgColor = '#00ff88';
        } else {
            ctx.fillStyle = '#ffd700';
            ctx.font = 'bold 30px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(msg, W / 2, H / 2);
            const remain = Math.ceil((startTime - now) / 1000);
            if (remain > 0) {
                ctx.font = '16px Arial';
                ctx.fillStyle = '#cfd8dc';
                ctx.fillText('in ' + remain + 's...', W / 2, H / 2 + 40);
            }
        }
    }
    else if (state === 'showing' || state === 'result') {
        if (target.active && state === 'showing') {
            ctx.fillStyle = target.color;
            ctx.shadowColor = target.color;
            ctx.shadowBlur = 16;
            ctx.beginPath();
            ctx.arc(target.x, target.y, target.r, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;

            const pulse = Math.sin(ts * 0.01) * 4;
            ctx.strokeStyle = target.color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(target.x, target.y, target.r + pulse, 0, Math.PI * 2);
            ctx.stroke();

            ctx.fillStyle = '#fff';
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('TIPPEN', target.x, target.y + 5);
        }
        ctx.fillStyle = msgColor;
        ctx.font = 'bold 22px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(msg, W / 2, H / 2 - 60);

        if (state === 'result' && reaction > 0) {
            ctx.fillStyle = '#cfd8dc';
            ctx.font = '16px Arial';
            ctx.fillText('Deine Zeit: ' + reaction + ' ms', W / 2, H / 2 - 15);
            ctx.fillStyle = '#9fd9e2';
            ctx.fillText('Tippe f\u00fcr n\u00e4chsten Versuch', W / 2, H / 2 + 20);
        }
    }

    for (const p of particles) {
        p.tt += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        ctx.globalAlpha = 1 - p.tt / p.life;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, 4, 4);
    }
    ctx.globalAlpha = 1;
    particles = particles.filter(p => p.tt < p.life);
}

spawnTarget();
loop(0);
