const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

/* ============================================================
   GRUNDWERTE

   Großes Spielfeld: 640 x 960 (Hochformat) – möglichst viel
   Fläche für den Kampf, HUD als schmale Leiste oben.
   Steuerung: Pfeile/WASD ODER Finger/Maus auf dem Feld ziehen.
   Das Schiff schießt automatisch (ideal für Touch).
============================================================ */

const W = 640;
const H = 960;

const PLAYER_W = 44;
const PLAYER_H = 52;
const PLAYER_SPEED = 470;     // Tastatur
const POINTER_SPEED = 950;    // wie schnell das Schiff dem Finger folgt

const FIRE_MS = 210;          // Schussintervall
const RAPID_MUL = 0.45;       // Nitro-Dauerfeuer
const BULLET_VY = -860;       // eigene Schüsse (nach oben)
const EBULLET_VY = 330;       // Gegner-Schüsse
const EBULLET_R = 6;

const INVULN_MS = 1800;       // Unverwundbarkeit nach Treffer
const SPAWN_START = 700;      // Abstand zwischen Gegner-Spawns (ms)
const HUD_H = 64;

const POWERUP_RAPID_MS = 8000;
const POWERUP_FALL = 130;
const POWERUP_CHANCE = 0.14;

const GAME_KEYS = new Set([
    "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown",
    "KeyA", "KeyD", "KeyW", "KeyS",
    "KeyP", "Escape", "KeyR", "Enter"
]);

/* Farben im PlaysGamez-Neon-Look */
const COLOR_PLAYER = "#00eaff";
const COLOR_BULLET = "#00eaff";
const COLOR_EBULLET = "#ff9500";
const ENEMY_TYPES = {
    grunt:   { color: "#00ff88", score: 100, w: 44, h: 44, hp: 1 },
    diver:   { color: "#ff0044", score: 150, w: 42, h: 50, hp: 1 },
    shooter: { color: "#a200ff", score: 300, w: 56, h: 56, hp: 3 }
};

/* ============================================================
   SPIELZUSTAND
============================================================ */

let gameState = "run";   // "run" | "pause" | "over"
let score = 0;
let lives = 3;
let wave = 0;
let isNewBest = false;

let px = W / 2;          // Schiff (Mitte)
let py = H - 120;
let invulnMs = 0;
let rapidMs = 0;
let shield = 0;          // absorbierende Treffer
let fireTimer = 0;
let shakeMs = 0;

let bullets = [];        // eigene Schüsse { x, y }
let eBullets = [];       // Gegner-Schüsse { x, y, vx, vy }
let enemies = [];        // { type, x, y, hp, phase, t, fireT, baseX, targetY, diving, vx, vy }
let spawnQueue = [];     // noch zu spawnende Typen der Welle
let spawnTimer = 0;
let waveGapMs = 0;       // Pause zwischen den Wellen
let powerups = [];       // { kind: "rapid" | "shield", x, y }
let particles = [];
let stars = [];
let toast = null;        // { text, sub, color, startAt }

/* Zeiger-Steuerung (Touch ziehen, Maus-Hover) mit Verfallszeit:
   bleibt die Maus stehen oder der Finger weg, steuert wieder die Tastatur */
let targetX = null;
let targetY = null;
let lastPointerAt = -99999;
const POINTER_LIVE_MS = 1200;

/* Tastatur */
let keyLeft = false, keyRight = false, keyUp = false, keyDown = false;

let lastTime = 0;

/* Bestwert – localStorage ist nicht überall erlaubt */
const BEST_KEY = "playsgamez_shooter_best";
let bestScore = loadBest();

function loadBest() {
    try {
        return Number(localStorage.getItem(BEST_KEY)) || 0;
    } catch (err) {
        return 0;
    }
}

function saveBest() {
    try {
        localStorage.setItem(BEST_KEY, String(bestScore));
    } catch (err) {
        /* dann bleibt der Bestwert eben nur für diese Sitzung */
    }
}

/* ============================================================
   HILFSFUNKTIONEN
============================================================ */

function rand(min, max) {
    return min + Math.random() * (max - min);
}

function clamp(v, min, max) {
    return v < min ? min : v > max ? max : v;
}

// AABB mit eingezogenen Rändern (etwas großzügiger fürs Spielergefühl)
function overlaps(ax, ay, aw, ah, bx, by, bw, bh, inset) {
    const i = inset || 0;
    return Math.abs(ax - bx) * 2 < aw + bw - i * 2 &&
           Math.abs(ay - by) * 2 < ah + bh - i * 2;
}

// Kleiner Helfer für abgerundete Rechtecke
function roundRectPath(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

function makeStars() {
    stars = [];
    for (let i = 0; i < 120; i++) {
        const layer = i % 3; // 0 = weit weg, 2 = nah
        stars.push({
            x: Math.random() * W,
            y: Math.random() * H,
            layer,
            speed: [35, 80, 160][layer],
            r: [1, 1.6, 2.4][layer]
        });
    }
}

/* ============================================================
   WELLEN & GEGNER
============================================================ */

// Gegnertypen für die kommende Welle mischen
function buildWave(n) {
    const queue = [];

    const grunts = Math.min(12, 4 + n);
    for (let i = 0; i < grunts; i++) queue.push("grunt");

    if (n >= 2) {
        const divers = Math.min(8, n - 1);
        for (let i = 0; i < divers; i++) queue.push("diver");
    }

    if (n >= 4) {
        const shooters = Math.min(3, Math.floor((n - 1) / 3));
        for (let i = 0; i < shooters; i++) queue.push("shooter");
    }

    // Fisher-Yates, damit die Reihenfolge nicht immer gleich ist
    for (let i = queue.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [queue[i], queue[j]] = [queue[j], queue[i]];
    }

    return queue;
}

function startWave() {
    wave++;
    spawnQueue = buildWave(wave);
    spawnTimer = 400;
    toast = {
        text: "WELLE " + wave,
        sub: "Halte durch!",
        color: "#00eaff",
        startAt: performance.now()
    };
}

function spawnEnemy(type) {
    const def = ENEMY_TYPES[type];
    const baseX = rand(70, W - 70);

    const e = {
        type,
        x: baseX,
        y: -def.h,
        hp: type === "shooter" ? def.hp + Math.floor(wave / 5) : def.hp,
        w: def.w,
        h: def.h,
        color: def.color,
        score: def.score,
        t: 0,
        phase: Math.random() * Math.PI * 2,
        baseX,
        fireT: rand(900, 2000),
        targetY: rand(140, 380),
        diving: false,
        vx: 0,
        vy: 0
    };

    // Schnelle Erkennung: Diver zielen direkt auf die Spieler-X-Position
    if (type === "diver") {
        e.vx = 0;
        e.vy = 0;
    }

    enemies.push(e);
}

// Ein einzelner Gegner-Schuss in Spieler-Richtung
function enemyFire(e) {
    const dx = px - e.x;
    const dy = py - e.y;
    const len = Math.hypot(dx, dy) || 1;
    const speed = EBULLET_VY + wave * 6;
    eBullets.push({
        x: e.x,
        y: e.y + e.h / 2,
        vx: (dx / len) * speed,
        vy: (dy / len) * speed
    });
}

function explosion(x, y, color, count) {
    for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = rand(60, 320);
        particles.push({
            x, y,
            vx: Math.cos(a) * v,
            vy: Math.sin(a) * v,
            age: 0,
            life: rand(0.3, 0.7),
            color,
            size: rand(2, 6)
        });
    }
}

function maybeDropPowerup(x, y) {
    if (Math.random() > POWERUP_CHANCE) return;
    const kind = Math.random() < 0.5 ? "rapid" : "shield";
    powerups.push({ kind, x, y });
}

/* ============================================================
   SPIELER: SCHÜSSE, TREFFER, LEBEN
============================================================ */

function playerFire() {
    bullets.push({ x: px, y: py - PLAYER_H / 2 - 4 });
    // Doppel-Schuss im Rapid-Modus
    if (rapidMs > 0) {
        bullets.push({ x: px - 12, y: py - PLAYER_H / 2 + 4 });
        bullets.push({ x: px + 12, y: py - PLAYER_H / 2 + 4 });
    }
}

function playerHit() {
    if (invulnMs > 0) return;

    if (shield > 0) {
        shield--;
        invulnMs = 900;          // kurze Schonzeit nach Schild-Treffer
        explosion(px, py, "#00ff88", 14);
        return;
    }

    lives--;
    invulnMs = INVULN_MS;
    shakeMs = 350;
    explosion(px, py, COLOR_PLAYER, 30);

    if (lives <= 0) {
        gameOver();
    }
}

function collectPowerup(p) {
    if (p.kind === "rapid") {
        rapidMs = POWERUP_RAPID_MS;
        toast = { text: "Dauerfeuer!", sub: "8s · dreifacher Schuss", color: "#ffd500", startAt: performance.now() };
    } else {
        shield = Math.min(3, shield + 1);
        toast = { text: "Schild +1", sub: "absorbiert einen Treffer", color: "#00ff88", startAt: performance.now() };
    }
    explosion(p.x, p.y, p.kind === "rapid" ? "#ffd500" : "#00ff88", 12);
}

function gameOver() {
    gameState = "over";
    targetX = null;
    if (score > bestScore) {
        bestScore = score;
        isNewBest = true;
        saveBest();
    }
}

/* ============================================================
   GAME-FLOW: START / PAUSE
============================================================ */

function startGame() {
    gameState = "run";
    score = 0;
    lives = 3;
    wave = 0;
    isNewBest = false;

    px = W / 2;
    py = H - 120;
    invulnMs = 900;
    rapidMs = 0;
    shield = 0;
    fireTimer = 0;
    shakeMs = 0;

    bullets = [];
    eBullets = [];
    enemies = [];
    powerups = [];
    particles = [];
    spawnQueue = [];
    waveGapMs = 600; // kurzer Moment Luft, dann startet Welle 1
    toast = null;

    targetX = null;
    targetY = null;
    lastPointerAt = -99999;
    keyLeft = keyRight = keyUp = keyDown = false;

    pauseBtn.textContent = "Pause";
    makeStars();
}

function togglePause() {
    if (gameState === "over") return;
    gameState = gameState === "pause" ? "run" : "pause";
    targetX = null;
    keyLeft = keyRight = keyUp = keyDown = false;
    pauseBtn.textContent = gameState === "pause" ? "Weiter" : "Pause";
}

/* ============================================================
   UPDATE (pro Frame)
============================================================ */

function updatePlayer(dt) {
    // Tastatur
    let ix = (keyRight ? 1 : 0) - (keyLeft ? 1 : 0);
    let iy = (keyDown ? 1 : 0) - (keyUp ? 1 : 0);
    if (ix !== 0 || iy !== 0) {
        const len = Math.hypot(ix, iy);
        px += (ix / len) * PLAYER_SPEED * dt;
        py += (iy / len) * PLAYER_SPEED * dt;
    } else if (targetX !== null && performance.now() - lastPointerAt < POINTER_LIVE_MS) {
        // Zeiger folgen (Touch-Drag oder Maus-Hover)
        const dx = targetX - px;
        const dy = targetY - py;
        const dist = Math.hypot(dx, dy);
        if (dist > 2) {
            const step = Math.min(dist, POINTER_SPEED * dt);
            px += (dx / dist) * step;
            py += (dy / dist) * step;
        }
    }

    px = clamp(px, PLAYER_W / 2 + 6, W - PLAYER_W / 2 - 6);
    py = clamp(py, H * 0.42, H - PLAYER_H / 2 - 10);

    // Auto-Feuer
    fireTimer -= dt * 1000;
    if (fireTimer <= 0) {
        playerFire();
        fireTimer = rapidMs > 0 ? FIRE_MS * RAPID_MUL : FIRE_MS;
    }

    if (invulnMs > 0) invulnMs -= dt * 1000;
    if (rapidMs > 0) rapidMs -= dt * 1000;
    if (shakeMs > 0) shakeMs -= dt * 1000;
}

function updateSpawning(dt) {
    if (waveGapMs > 0) {
        waveGapMs -= dt * 1000;
        if (waveGapMs <= 0) startWave();
        return;
    }

    // Noch offene Gegner der Welle ausspucken
    if (spawnQueue.length > 0) {
        spawnTimer -= dt * 1000;
        if (spawnTimer <= 0) {
            spawnEnemy(spawnQueue.shift());
            spawnTimer = Math.max(320, SPAWN_START - wave * 25);
        }
        return;
    }

    // Welle geschafft → kurze Pause + Bonus
    if (enemies.length === 0) {
        const bonus = 200 * wave;
        score += bonus;
        toast = {
            text: "WELLE GESCHAFFT",
            sub: "+" + bonus + " Punkte",
            color: "#ffd500",
            startAt: performance.now()
        };
        waveGapMs = 1800;
    }
}

function updateEnemies(dt) {
    for (const e of enemies) {
        e.t += dt;

        if (e.type === "grunt") {
            // Sanft nach unten + Seitwärts-Schlingern
            e.y += (60 + wave * 5) * dt;
            e.x = e.baseX + Math.sin(e.t * 1.6 + e.phase) * 70;
            e.x = clamp(e.x, e.w / 2, W - e.w / 2);
            if (wave >= 3) {
                e.fireT -= dt * 1000;
                if (e.fireT <= 0 && e.y > 40) {
                    enemyFire(e);
                    e.fireT = rand(1600, 3200);
                }
            }
        } else if (e.type === "diver") {
            if (!e.diving) {
                // Erst kurz einpendeln, dann stürzen
                e.y += 90 * dt;
                e.x = e.baseX + Math.sin(e.t * 2 + e.phase) * 40;
                if (e.y > 90 && Math.abs(e.x - px) < 90) {
                    e.diving = true;
                    const dx = px - e.x;
                    const len = Math.hypot(dx, 300) || 1;
                    e.vx = (dx / len) * 260;
                    e.vy = 400 + wave * 12;
                }
            } else {
                e.x += e.vx * dt;
                e.y += e.vy * dt;
            }
        } else if (e.type === "shooter") {
            if (e.y < e.targetY) {
                e.y += 80 * dt; // langsam auf Stationärhöhe sinken
            } else {
                // Leichter Schwips + gezielte Schüsse
                e.x = e.baseX + Math.sin(e.t * 0.9 + e.phase) * 55;
                e.x = clamp(e.x, e.w / 2, W - e.w / 2);
                e.fireT -= dt * 1000;
                if (e.fireT <= 0) {
                    enemyFire(e);
                    e.fireT = Math.max(700, 1900 - wave * 70);
                }
            }
        }
    }

    // Runtergeflogen oder aus dem Bild
    enemies = enemies.filter((e) => e.y < H + e.h + 20);
}

function updateBullets(dt) {
    for (const b of bullets) b.y += BULLET_VY * dt;
    bullets = bullets.filter((b) => b.y > -20);

    for (const b of eBullets) {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
    }
    eBullets = eBullets.filter((b) => b.y < H + 20 && b.y > -20 && b.x > -20 && b.x < W + 20);
}

function updateParticles(dt) {
    for (const p of particles) {
        p.age += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.96;
        p.vy *= 0.96;
    }
    particles = particles.filter((p) => p.age < p.life);
}

function updateStars(dt) {
    for (const s of stars) {
        s.y += s.speed * dt;
        if (s.y > H) {
            s.y = -4;
            s.x = Math.random() * W;
        }
    }
}

function updatePowerups(dt) {
    for (const p of powerups) p.y += POWERUP_FALL * dt;
    powerups = powerups.filter((p) => p.y < H + 30);
}

/* ============================================================
   KOLLISIONEN
============================================================ */

function handleCollisions() {
    // Eigene Schüsse ↔ Gegner
    for (const b of bullets) {
        for (const e of enemies) {
            if (e.hp <= 0) continue;
            if (!overlaps(b.x, b.y, 4, 14, e.x, e.y, e.w, e.h, 6)) continue;

            e.hp--;
            b.hit = true;
            explosion(b.x, b.y, e.color, 5);

            if (e.hp <= 0) {
                score += e.score;
                explosion(e.x, e.y, e.color, 22);
                maybeDropPowerup(e.x, e.y);
            }
            break;
        }
    }
    bullets = bullets.filter((b) => !b.hit);
    enemies = enemies.filter((e) => e.hp > 0);

    // Gegner-Schüsse ↔ Spieler
    for (const b of eBullets) {
        if (b.hit) continue;
        if (!overlaps(b.x, b.y, EBULLET_R * 2, EBULLET_R * 2, px, py, PLAYER_W, PLAYER_H, 12)) continue;
        b.hit = true;
        playerHit();
    }
    eBullets = eBullets.filter((b) => !b.hit);

    // Gegner-Körper ↔ Spieler
    for (const e of enemies) {
        if (overlaps(e.x, e.y, e.w, e.h, px, py, PLAYER_W, PLAYER_H, 14)) {
            e.hp = 0;
            explosion(e.x, e.y, e.color, 18);
            playerHit();
        }
    }
    enemies = enemies.filter((e) => e.hp > 0);

    // Power-ups einsammeln
    for (const p of powerups) {
        if (overlaps(p.x, p.y, 30, 30, px, py, PLAYER_W, PLAYER_H, 4)) {
            p.hit = true;
            collectPowerup(p);
        }
    }
    powerups = powerups.filter((p) => !p.hit);
}

function update(dtMs) {
    if (gameState !== "run") return;

    const dt = dtMs / 1000;

    updatePlayer(dt);
    updateSpawning(dt);
    updateEnemies(dt);
    updateBullets(dt);
    updatePowerups(dt);
    updateParticles(dt);
    updateStars(dt);
    handleCollisions();
}

/* ============================================================
   TASTATUR
============================================================ */

document.addEventListener("keydown", (e) => {
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    if (e.repeat) return;

    if (e.code === "KeyR" || (e.code === "Enter" && gameState === "over")) {
        startGame();
        return;
    }
    if (e.code === "KeyP" || e.code === "Escape") {
        togglePause();
        return;
    }
    if (gameState !== "run") return;

    switch (e.code) {
        case "ArrowLeft":
        case "KeyA": keyLeft = true; break;
        case "ArrowRight":
        case "KeyD": keyRight = true; break;
        case "ArrowUp":
        case "KeyW": keyUp = true; break;
        case "ArrowDown":
        case "KeyS": keyDown = true; break;
    }
});

document.addEventListener("keyup", (e) => {
    switch (e.code) {
        case "ArrowLeft":
        case "KeyA": keyLeft = false; break;
        case "ArrowRight":
        case "KeyD": keyRight = false; break;
        case "ArrowUp":
        case "KeyW": keyUp = false; break;
        case "ArrowDown":
        case "KeyS": keyDown = false; break;
    }
});

// Fenster verloren (Tab-Wechsel) → automatisch pausieren
window.addEventListener("blur", () => {
    if (gameState === "run") togglePause();
});

/* ============================================================
   ZEIGER-STEUERUNG (Touch & Maus auf dem Spielfeld ziehen)
============================================================ */

function pointerToCanvas(e) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: (e.clientX - rect.left) * (W / rect.width),
        y: (e.clientY - rect.top) * (H / rect.height)
    };
}

function moveTarget(e) {
    const pos = pointerToCanvas(e);
    targetX = pos.x;
    targetY = pos.y;
    lastPointerAt = performance.now();
}

canvas.addEventListener("pointerdown", (e) => {
    if (gameState !== "run") return;
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    moveTarget(e);
});

// Touch meldet pointermove nur beim Berühren – die Maus darf auch hoovern
canvas.addEventListener("pointermove", (e) => {
    if (gameState !== "run") return;
    e.preventDefault();
    moveTarget(e);
});

// Maus verlässt das Spielfeld → kein Nachziehen mehr
canvas.addEventListener("pointerleave", (e) => {
    if (e.pointerType === "mouse") targetX = null;
});

/* ============================================================
   BUTTONS
============================================================ */

const pauseBtn = document.getElementById("pauseBtn");
const restartBtn = document.getElementById("restartBtn");

pauseBtn.addEventListener("click", togglePause);
restartBtn.addEventListener("click", startGame);

/* ============================================================
   RENDERING
============================================================ */

function drawStars() {
    for (const s of stars) {
        ctx.fillStyle = ["rgba(255,255,255,0.35)", "rgba(0,234,255,0.55)", "rgba(255,255,255,0.9)"][s.layer];
        ctx.fillRect(s.x, s.y, s.r, s.r * 2.2);
    }
}

function drawPlayer() {
    // Unverwundbarkeit → blinken
    if (invulnMs > 0 && Math.floor(invulnMs / 120) % 2 === 0) return;

    ctx.save();
    ctx.translate(px, py);

    // Antriebsflamme
    const flame = 12 + Math.sin(performance.now() / 60) * 5;
    ctx.fillStyle = "#ffd500";
    ctx.shadowColor = "#ffd500";
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(-7, PLAYER_H / 2 - 2);
    ctx.lineTo(7, PLAYER_H / 2 - 2);
    ctx.lineTo(0, PLAYER_H / 2 + flame);
    ctx.closePath();
    ctx.fill();

    // Rumpf (Pfeil nach oben)
    ctx.shadowColor = COLOR_PLAYER;
    ctx.shadowBlur = 16;
    ctx.fillStyle = COLOR_PLAYER;
    ctx.beginPath();
    ctx.moveTo(0, -PLAYER_H / 2);
    ctx.lineTo(PLAYER_W / 2, PLAYER_H / 2);
    ctx.lineTo(10, PLAYER_H / 2 - 8);
    ctx.lineTo(-10, PLAYER_H / 2 - 8);
    ctx.lineTo(-PLAYER_W / 2, PLAYER_H / 2);
    ctx.closePath();
    ctx.fill();

    // Cockpit
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#062028";
    ctx.beginPath();
    ctx.ellipse(0, -4, 6, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    // Schild-Ring
    if (shield > 0) {
        ctx.strokeStyle = "#00ff88";
        ctx.shadowColor = "#00ff88";
        ctx.shadowBlur = 14;
        ctx.lineWidth = 2.5;
        ctx.globalAlpha = 0.75;
        ctx.beginPath();
        ctx.ellipse(0, 0, PLAYER_W / 2 + 12, PLAYER_H / 2 + 12, 0, 0, Math.PI * 2);
        ctx.stroke();
    }

    ctx.restore();
}

function drawEnemy(e) {
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.shadowColor = e.color;
    ctx.shadowBlur = 14;
    ctx.fillStyle = e.color;

    if (e.type === "grunt") {
        // Raute mit Augen
        ctx.beginPath();
        ctx.moveTo(0, -e.h / 2);
        ctx.lineTo(e.w / 2, 0);
        ctx.lineTo(0, e.h / 2);
        ctx.lineTo(-e.w / 2, 0);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#0a0a0a";
        ctx.fillRect(-11, -4, 7, 7);
        ctx.fillRect(4, -4, 7, 7);
    } else if (e.type === "diver") {
        // Spitzer Abfangjäger nach unten
        ctx.beginPath();
        ctx.moveTo(-e.w / 2, -e.h / 2);
        ctx.lineTo(e.w / 2, -e.h / 2);
        ctx.lineTo(0, e.h / 2);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(-3, -e.h / 2 + 8, 6, 10);
    } else {
        // Shooter: Boss-artiger Block mit Kern
        ctx.beginPath();
        ctx.moveTo(-e.w / 2, -e.h / 2 + 10);
        ctx.lineTo(-e.w / 2 + 10, -e.h / 2);
        ctx.lineTo(e.w / 2 - 10, -e.h / 2);
        ctx.lineTo(e.w / 2, -e.h / 2 + 10);
        ctx.lineTo(e.w / 2, e.h / 2 - 10);
        ctx.lineTo(e.w / 2 - 10, e.h / 2);
        ctx.lineTo(-e.w / 2 + 10, e.h / 2);
        ctx.lineTo(-e.w / 2, e.h / 2 - 10);
        ctx.closePath();
        ctx.fill();
        // Kern (zeigt nach unten, von wo die Schüsse kommen)
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#0a0a0a";
        ctx.beginPath();
        ctx.arc(0, 6, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(0, 6, 4 + Math.sin(e.t * 6) * 1.5, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();
}

function drawBullets() {
    ctx.save();
    // eigene Schüsse
    ctx.fillStyle = COLOR_BULLET;
    ctx.shadowColor = COLOR_BULLET;
    ctx.shadowBlur = 10;
    for (const b of bullets) ctx.fillRect(b.x - 2, b.y - 7, 4, 14);

    // Gegner-Schüsse
    ctx.fillStyle = COLOR_EBULLET;
    ctx.shadowColor = COLOR_EBULLET;
    for (const b of eBullets) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, EBULLET_R, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
}

function drawPowerups() {
    for (const p of powerups) {
        const color = p.kind === "rapid" ? "#ffd500" : "#00ff88";
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(performance.now() / 600);
        ctx.shadowColor = color;
        ctx.shadowBlur = 14;
        ctx.strokeStyle = color;
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.lineWidth = 2.5;
        roundRectPath(-15, -15, 30, 30, 6);
        ctx.fill();
        ctx.stroke();
        ctx.rotate(-performance.now() / 600);
        ctx.fillStyle = color;
        ctx.font = "bold 15px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(p.kind === "rapid" ? "R" : "S", 0, 1);
        ctx.restore();
    }
}

function drawParticles() {
    ctx.save();
    for (const p of particles) {
        ctx.globalAlpha = Math.max(0, 1 - p.age / p.life);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.restore();
}

function drawHud() {
    ctx.save();

    // Leiste oben
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, 0, W, HUD_H);
    ctx.strokeStyle = "rgba(0,234,255,0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, HUD_H);
    ctx.lineTo(W, HUD_H);
    ctx.stroke();

    // PUNKTE links
    ctx.textAlign = "left";
    ctx.font = "bold 12px Arial";
    ctx.fillStyle = "#9fd9e2";
    ctx.fillText("PUNKTE", 16, 22);
    ctx.font = "bold 24px Arial";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(String(score).padStart(7, "0"), 16, 48);

    // WELLE Mitte
    ctx.textAlign = "center";
    ctx.font = "bold 12px Arial";
    ctx.fillStyle = "#9fd9e2";
    ctx.fillText("WELLE", W / 2, 22);
    ctx.font = "bold 24px Arial";
    ctx.fillStyle = "#00eaff";
    ctx.shadowColor = "#00eaff";
    ctx.shadowBlur = 10;
    ctx.fillText(String(wave).padStart(2, "0"), W / 2, 48);
    ctx.shadowBlur = 0;

    // LEBEN rechts (Schiff-Icons)
    ctx.textAlign = "right";
    ctx.font = "bold 12px Arial";
    ctx.fillStyle = "#9fd9e2";
    ctx.fillText("LEBEN", W - 16, 22);
    for (let i = 0; i < lives; i++) {
        const x = W - 24 - i * 26;
        ctx.fillStyle = COLOR_PLAYER;
        ctx.shadowColor = COLOR_PLAYER;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(x, 32);
        ctx.lineTo(x + 9, 50);
        ctx.lineTo(x - 9, 50);
        ctx.closePath();
        ctx.fill();
    }
    ctx.shadowBlur = 0;

    // Aktive Power-ups unter der Leiste
    let chipX = 16;
    if (rapidMs > 0) {
        chipX = drawChip(chipX, "#ffd500", "DAUERFEUER " + (rapidMs / 1000).toFixed(1) + "s");
    }
    if (shield > 0) {
        drawChip(chipX, "#00ff88", "SCHILD x" + shield);
    }

    // Bestwert klein rechts unter der Leiste
    ctx.textAlign = "right";
    ctx.font = "bold 12px Arial";
    ctx.fillStyle = "#ffd500";
    ctx.fillText("BEST " + String(Math.max(bestScore, score)).padStart(7, "0"), W - 16, 84);

    ctx.restore();
}

function drawChip(x, color, text) {
    ctx.font = "bold 12px Arial";
    const w = ctx.measureText(text).width + 18;
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    roundRectPath(x, 74, w, 22, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x + 9, 86);
    ctx.textBaseline = "alphabetic";
    return x + w + 8;
}

function drawToast(now) {
    if (!toast) return;

    const t = (now - toast.startAt) / 1600;
    if (t >= 1) {
        toast = null;
        return;
    }

    let alpha = 1;
    if (t < 0.12) alpha = t / 0.12;
    else if (t > 0.7) alpha = 1 - (t - 0.7) / 0.3;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = "center";
    ctx.translate(W / 2, H * 0.32);

    ctx.font = "bold 42px Arial";
    ctx.fillStyle = toast.color;
    ctx.shadowColor = toast.color;
    ctx.shadowBlur = 24;
    ctx.fillText(toast.text, 0, 0);

    ctx.shadowBlur = 0;
    ctx.font = "bold 16px Arial";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(toast.sub, 0, 28);

    ctx.restore();
}

function drawOverlay(title, subtitle, hint, color) {
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.78)";
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = "center";

    ctx.font = "bold 52px Arial";
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 28;
    ctx.fillText(title, W / 2, H / 2 - 40);

    ctx.shadowBlur = 0;
    ctx.font = "bold 22px Arial";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(subtitle, W / 2, H / 2 + 4);

    ctx.font = "15px Arial";
    ctx.fillStyle = "#9fd9e2";
    ctx.fillText(hint, W / 2, H / 2 + 44);

    ctx.restore();
}

function draw(now) {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#06060c";
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    // Screen-Shake nach Treffern
    if (shakeMs > 0) {
        const k = shakeMs / 350;
        ctx.translate((Math.random() - 0.5) * 12 * k, (Math.random() - 0.5) * 12 * k);
    }

    drawStars();
    drawPowerups();
    for (const e of enemies) drawEnemy(e);
    drawBullets();
    if (gameState !== "over") drawPlayer();
    drawParticles();
    ctx.restore();

    drawHud();
    drawToast(now);

    if (gameState === "pause") {
        drawOverlay(
            "PAUSE",
            "Welle " + wave + " · " + score + " Punkte",
            "P = Weiter · R = Neustart",
            "#00eaff"
        );
    } else if (gameState === "over") {
        drawOverlay(
            "GAME OVER",
            isNewBest ? "★ NEUER BESTWERT: " + score : "Punkte: " + score + " · Welle " + wave,
            "R / Enter = Nochmal",
            "#ff0044"
        );
    }
}

/* ============================================================
   START
============================================================ */

function gameLoop(time) {
    // Zeit-Sprünge deckeln (z.B. nach Tab-Wechsel)
    const dtMs = Math.min(50, time - lastTime);
    lastTime = time;

    update(dtMs);
    draw(time);

    requestAnimationFrame(gameLoop);
}

startGame();
requestAnimationFrame(gameLoop);





