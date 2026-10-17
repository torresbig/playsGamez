const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

/* ============================================================
   GRUNDWERTE

   Canvas: 540 x 760 (Hochformat). Die Straße läuft senkrecht
   durchs Bild, HUD-Leiste liegt halbtransparent darüber.
============================================================ */

const W = 540;
const H = 760;

const ROAD_LEFT = 100;
const ROAD_RIGHT = 440;         // 340px breit
const LANES = 4;
const LANE_W = (ROAD_RIGHT - ROAD_LEFT) / LANES; // 85px

const CAR_W = 50;
const CAR_H = 96;
const PLAYER_Y = H - 150;       // feste Position des Spieler-Autos

/* Tempo (px/s); Stecke ≈ px/40 Meter */
const BASE_SPEED = 320;
const MAX_SPEED = 980;
const SPEED_PER_PX = 1 / 140;    // +1 px/s je 140 gefahrenen px (Max. nach ~2,5 Min)
const BOOST_MUL = 1.55;
const BRAKE_MUL = 0.55;
const KMH_FACTOR = 0.27;         // Anzeigefaktor px/s → km/h

/* Lenkung */
const STEER_ACCEL = 2200;        // px/s² (schneller für die breitere Straße)
const STEER_MAX = 430;           // max. seitliche Geschwindigkeit
const STEER_DAMP = 5.5;          // Ausdämpfen der Seitenbewegung

/* Verkehr */
const SPAWN_START = 520;         // erster Abstand in px
const ONCOMING_CHANCE = 0.25;    // rote Autos aus der Gegenrichtung
const METERS_PER_PX = 1 / 40;

const CLEAR_KEYS = new Set([
    "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown",
    "KeyA", "KeyD", "KeyW", "KeyS",
    "KeyP", "Escape", "KeyR", "Enter"
]);

/* Farben im PlaysGamez-Neon-Look (Gegner ohne Rot – das ist reserviert) */
const TRAFFIC_COLORS = ["#ffd500", "#a200ff", "#00ff88", "#2d6bff", "#ff9500"];
const ONCOMING_COLOR = "#ff0044";
const PLAYER_COLOR = "#00eaff";

/* ============================================================
   SPIELZUSTAND
============================================================ */

let gameState = "run";   // "run" | "pause" | "over"
let scrollPx = 0;        // insgesamt gefahrene Strecke in px
let distPx = 0;          // für Tempo-Steigerung & Spawn-Abstände
let spawnGap = SPAWN_START;

let carX = W / 2;
let carVx = 0;
let tilt = 0;

let enemies = [];        // { x, y, color, factor, oncoming }
let particles = [];
let crashAt = 0;

let keyLeft = false, keyRight = false;
let boostHeld = false, brakeHeld = false;
let touchLeft = false, touchRight = false, touchBoost = false;

let toast = null;        // { text, sub, color, startAt }
let lastTime = 0;

let isNewBest = false;

/* Bestwert – localStorage ist nicht überall erlaubt */
const BEST_KEY = "playsgamez_race_best";
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

// Kleiner Helfer für abgerundete Rechtecke (Cars, Panels)
function roundRectPath(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

function laneCenter(lane) {
    return ROAD_LEFT + LANE_W * lane + LANE_W / 2;
}

function meters() {
    return Math.floor(distPx * METERS_PER_PX);
}

function kmh() {
    return Math.round(currentSpeed() * KMH_FACTOR);
}

// Momentanes Tempo: Grundtempo wächst mit der Strecke,
// Boost beschleunigt, Bremsen bremst.
function currentSpeed() {
    let s = Math.min(MAX_SPEED, BASE_SPEED + distPx * SPEED_PER_PX);
    if (boostHeld || touchBoost) s *= BOOST_MUL;
    if (brakeHeld) s *= BRAKE_MUL;
    return s;
}

function speedColor() {
    const v = kmh();
    if (v >= 230) return "#ff0044";
    if (v >= 150) return "#ff9500";
    return "#00ff88";
}

/* ============================================================
   VERKEHR: SPAWN, KOLLISION, CRASH
============================================================ */

// Neue Verkehrswelle: 1–2 Autos auf verschiedenen Spuren.
// Mindestens zwei Spuren bleiben immer frei.
function spawnWave() {
    const twoCars = Math.random() < 0.35;
    const lanes = [0, 1, 2, 3];

    // Fisher-Yates, dann die vorderen Plätze nehmen
    for (let i = lanes.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [lanes[i], lanes[j]] = [lanes[j], lanes[i]];
    }

    const count = twoCars ? 2 : 1;
    for (let i = 0; i < count; i++) {
        const oncoming = Math.random() < ONCOMING_CHANCE;
        enemies.push({
            x: laneCenter(lanes[i]),
            y: -CAR_H - Math.random() * 60,
            color: oncoming ? ONCOMING_COLOR : TRAFFIC_COLORS[Math.floor(Math.random() * TRAFFIC_COLORS.length)],
            // factor = Anteil am eigenen Tempo, mit dem das Auto näherkommt
            factor: oncoming ? 1.5 + Math.random() * 0.4 : 0.7 + Math.random() * 0.3,
            oncoming: oncoming
        });
    }

    // Abstände werden mit steigender Strecke etwas dichter
    const tighten = Math.min(140, distPx / 3000);
    spawnGap = 380 - tighten + Math.random() * 160;
}

// Treffer-Test Spieler ↔ Verkehrsfahrzeug (leicht eingezogene Rechtecke)
function hitsPlayer(e) {
    const dx = Math.abs(carX - e.x);
    const dy = Math.abs(PLAYER_Y - e.y);
    return dx < CAR_W - 12 && dy < CAR_H - 14;
}

function crash() {
    gameState = "over";
    boostHeld = false;
    brakeHeld = false;
    touchBoost = false;
    crashAt = performance.now();

    // Funkenflug
    for (let i = 0; i < 26; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = 80 + Math.random() * 260;
        particles.push({
            x: carX,
            y: PLAYER_Y,
            vx: Math.cos(a) * v,
            vy: Math.sin(a) * v - 60,
            life: 0.5 + Math.random() * 0.6,
            age: 0,
            color: Math.random() < 0.5 ? "#ffd500" : "#ff0044"
        });
    }

    if (meters() > bestScore) {
        bestScore = meters();
        isNewBest = true;
        saveBest();
    }
}

function updateParticles(dt) {
    for (const p of particles) {
        p.age += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 420 * dt; // Schwerkraft
    }
    particles = particles.filter((p) => p.age < p.life);
}

/* ============================================================
   GAME-FLOW: START / PAUSE
============================================================ */

function startGame() {
    gameState = "run";
    scrollPx = 0;
    distPx = 0;
    spawnGap = SPAWN_START;

    carX = W / 2;
    carVx = 0;
    tilt = 0;

    enemies = [];
    particles = [];
    isNewBest = false;

    keyLeft = false;
    keyRight = false;
    boostHeld = false;
    brakeHeld = false;
    touchLeft = false;
    touchRight = false;
    touchBoost = false;

    toast = { text: "LOS!", sub: "Viel Erfolg auf der Strecke", color: "#00ff88", startAt: performance.now() };
    pauseBtn.textContent = "Pause";
}

function togglePause() {
    if (gameState === "over") return;
    gameState = gameState === "pause" ? "run" : "pause";
    touchLeft = false;
    touchRight = false;
    touchBoost = false;
    boostHeld = false;
    brakeHeld = false;
    pauseBtn.textContent = gameState === "pause" ? "Weiter" : "Pause";
}

/* ============================================================
   UPDATE (pro Frame)
============================================================ */

// Lenkung: Beschleunigung in Fahrtrichtung + natürliches Ausdämpfen
function updateSteering(dt) {
    const input = (keyRight || touchRight ? 1 : 0) - (keyLeft || touchLeft ? 1 : 0);
    carVx += input * STEER_ACCEL * dt;
    carVx *= Math.exp(-STEER_DAMP * dt);
    carVx = Math.max(-STEER_MAX, Math.min(STEER_MAX, carVx));

    carX += carVx * dt;

    // Straße begrenzen
    const minX = ROAD_LEFT + CAR_W / 2;
    const maxX = ROAD_RIGHT - CAR_W / 2;
    if (carX < minX) { carX = minX; carVx = 0; }
    if (carX > maxX) { carX = maxX; carVx = 0; }

    // Karosserie kippt leicht in die Fahrtrichtung
    tilt = (carVx / STEER_MAX) * 0.22;
}

function update(dt) {
    if (gameState === "over") return;

    if (gameState === "pause") return;

    const speed = currentSpeed();

    scrollPx += speed * dt;
    distPx += speed * dt;

    updateSteering(dt);

    // Verkehrsfahrzeuge: näherkommen und aus dem Bild entfernen
    for (const e of enemies) {
        e.y += speed * e.factor * dt;
    }
    enemies = enemies.filter((e) => e.y < H + CAR_H + 40);

    // Nächste Welle anstoßen
    spawnGap -= speed * dt;
    if (spawnGap <= 0) spawnWave();

    // Zusammenstoß
    for (const e of enemies) {
        if (hitsPlayer(e)) {
            crash();
            break;
        }
    }
}

/* ============================================================
   TASTATUR
============================================================ */

document.addEventListener("keydown", (e) => {
    if (CLEAR_KEYS.has(e.code)) e.preventDefault();
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
        case "KeyW": boostHeld = true; break;
        case "ArrowDown":
        case "KeyS": brakeHeld = true; break;
    }
});

document.addEventListener("keyup", (e) => {
    switch (e.code) {
        case "ArrowLeft":
        case "KeyA": keyLeft = false; break;
        case "ArrowRight":
        case "KeyD": keyRight = false; break;
        case "ArrowUp":
        case "KeyW": boostHeld = false; break;
        case "ArrowDown":
        case "KeyS": brakeHeld = false; break;
    }
});

// Fenster verloren (Tab-Wechsel) → automatisch pausieren
window.addEventListener("blur", () => {
    if (gameState === "run") togglePause();
});

/* ============================================================
   BUTTONS + TOUCH-STEUERUNG
============================================================ */

const pauseBtn = document.getElementById("pauseBtn");
const restartBtn = document.getElementById("restartBtn");

pauseBtn.addEventListener("click", togglePause);
restartBtn.addEventListener("click", startGame);

document.querySelectorAll("#touchControls button").forEach((btn) => {
    const action = btn.dataset.action;

    btn.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        if (gameState !== "run") return;

        if (action === "left") touchLeft = true;
        else if (action === "right") touchRight = true;
        else if (action === "boost") touchBoost = true;
    });

    // Finger/Button losgelassen → Bewegung/Nitro stoppen
    const release = () => {
        if (action === "left") touchLeft = false;
        if (action === "right") touchRight = false;
        if (action === "boost") touchBoost = false;
    };

    btn.addEventListener("pointerup", release);
    btn.addEventListener("pointercancel", release);
    btn.addEventListener("pointerleave", release);
});

/* ============================================================
   RENDERING: STRASSE & FAHRZEUGE
============================================================ */

function drawScenery() {
    // Wiese/Seitenstreifen mit laufenden Querstreifen (Tempo-Gefühl)
    ctx.fillStyle = "#0a140e";
    ctx.fillRect(0, 0, ROAD_LEFT, H);
    ctx.fillRect(ROAD_RIGHT, 0, W - ROAD_RIGHT, H);

    ctx.fillStyle = "rgba(0,255,136,0.07)";
    const stripeH = 90;
    const off = scrollPx % (stripeH * 2);
    for (let y = -stripeH * 2 + off; y < H + stripeH; y += stripeH * 2) {
        ctx.fillRect(0, y, ROAD_LEFT, stripeH);
        ctx.fillRect(ROAD_RIGHT, y, W - ROAD_RIGHT, stripeH);
    }

    // Fahrbahn
    ctx.fillStyle = "#17171d";
    ctx.fillRect(ROAD_LEFT, 0, ROAD_RIGHT - ROAD_LEFT, H);

    // Mittellinien (gestrichelt, laufend)
    ctx.fillStyle = "rgba(159,217,226,0.5)";
    const dash = 56;
    const dashOff = scrollPx % (dash * 2);
    for (let lane = 1; lane < LANES; lane++) {
        const x = ROAD_LEFT + lane * LANE_W - 2;
        for (let y = -dash * 2 + dashOff; y < H + dash; y += dash * 2) {
            ctx.fillRect(x, y, 4, dash);
        }
    }

    // Neon-Randlinien
    ctx.save();
    ctx.strokeStyle = "#00eaff";
    ctx.shadowColor = "#00eaff";
    ctx.shadowBlur = 14;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(ROAD_LEFT - 1, 0);
    ctx.lineTo(ROAD_LEFT - 1, H);
    ctx.moveTo(ROAD_RIGHT + 1, 0);
    ctx.lineTo(ROAD_RIGHT + 1, H);
    ctx.stroke();
    ctx.restore();
}

// Auto von oben gesehen: Spieler & Verkehr schauen "nach oben",
// Gegenrichtung kommt entgegen (Scheinwerfer unten).
function drawCar(x, y, color, carTilt, mode) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(carTilt);

    // Schatten
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    roundRectPath(-CAR_W / 2 + 3, -CAR_H / 2 + 6, CAR_W, CAR_H, 10);
    ctx.fill();

    // Räder
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(-CAR_W / 2 - 4, -CAR_H / 2 + 12, 6, 18);
    ctx.fillRect(CAR_W / 2 - 2, -CAR_H / 2 + 12, 6, 18);
    ctx.fillRect(-CAR_W / 2 - 4, CAR_H / 2 - 30, 6, 18);
    ctx.fillRect(CAR_W / 2 - 2, CAR_H / 2 - 30, 6, 18);

    // Karosserie mit Neon-Glow
    ctx.shadowColor = color;
    ctx.shadowBlur = 16;
    ctx.fillStyle = color;
    roundRectPath(-CAR_W / 2, -CAR_H / 2, CAR_W, CAR_H, 10);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Windschutzscheibe + Dach
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    roundRectPath(-CAR_W / 2 + 7, -CAR_H / 2 + 22, CAR_W - 14, 22, 6);
    ctx.fill();
    // Heckscheibe
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    roundRectPath(-CAR_W / 2 + 8, CAR_H / 2 - 26, CAR_W - 16, 12, 4);
    ctx.fill();

    if (mode === "player") {
        // Scheinwerfer vorn (oben), Bremsleuchten hinten
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(-CAR_W / 2 + 6, -CAR_H / 2 + 2, 8, 4);
        ctx.fillRect(CAR_W / 2 - 14, -CAR_H / 2 + 2, 8, 4);
        ctx.fillStyle = "#ff0044";
        ctx.fillRect(-CAR_W / 2 + 6, CAR_H / 2 - 6, 8, 4);
        ctx.fillRect(CAR_W / 2 - 14, CAR_H / 2 - 6, 8, 4);
    } else if (mode === "oncoming") {
        // Gegenverkehr: Scheinwerfer unten (zeigen auf uns)
        ctx.fillStyle = "#ffffff";
        ctx.shadowColor = "#ffffff";
        ctx.shadowBlur = 12;
        ctx.fillRect(-CAR_W / 2 + 6, CAR_H / 2 - 6, 8, 4);
        ctx.fillRect(CAR_W / 2 - 14, CAR_H / 2 - 6, 8, 4);
        ctx.shadowBlur = 0;
    } else {
        // langsamer Verkehr: Bremsleuchten oben (wir sehen von hinten)
        ctx.fillStyle = "#ff2d55";
        ctx.fillRect(-CAR_W / 2 + 6, -CAR_H / 2 + 2, 8, 4);
        ctx.fillRect(CAR_W / 2 - 14, -CAR_H / 2 + 2, 8, 4);
    }

    ctx.restore();
}

function drawParticles() {
    ctx.save();
    for (const p of particles) {
        const alpha = 1 - p.age / p.life;
        ctx.globalAlpha = Math.max(0, alpha);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.fillRect(p.x - 3, p.y - 3, 6, 6);
    }
    ctx.restore();
}

/* ============================================================
   RENDERING: HUD, TOASTS, OVERLAYS, LOOP
============================================================ */

function drawHud() {
    ctx.save();

    // Halbtransparente Leiste oben
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, 0, W, 64);
    ctx.strokeStyle = "rgba(0,234,255,0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 64);
    ctx.lineTo(W, 64);
    ctx.stroke();

    // STRECKE links
    ctx.textAlign = "left";
    ctx.font = "bold 12px Arial";
    ctx.fillStyle = "#9fd9e2";
    ctx.fillText("STRECKE", 16, 22);
    ctx.font = "bold 24px Arial";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(String(meters()).padStart(6, "0") + " m", 16, 48);

    // TEMPO Mitte (farbig nach Tempo)
    ctx.textAlign = "center";
    ctx.font = "bold 12px Arial";
    ctx.fillStyle = "#9fd9e2";
    ctx.fillText("TEMPO", W / 2, 22);
    ctx.font = "bold 24px Arial";
    ctx.fillStyle = speedColor();
    ctx.shadowColor = speedColor();
    ctx.shadowBlur = 10;
    ctx.fillText(kmh() + " km/h", W / 2, 48);
    ctx.shadowBlur = 0;

    // BESTWERT rechts
    ctx.textAlign = "right";
    ctx.font = "bold 12px Arial";
    ctx.fillStyle = "#9fd9e2";
    ctx.fillText("BESTWERT", W - 16, 22);
    ctx.font = "bold 20px Arial";
    ctx.fillStyle = "#ffd500";
    ctx.fillText(String(Math.max(bestScore, meters())).padStart(6, "0") + " m", W - 16, 48);

    ctx.restore();
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
    ctx.translate(W / 2, H * 0.3);

    ctx.font = "bold 40px Arial";
    ctx.fillStyle = toast.color;
    ctx.shadowColor = toast.color;
    ctx.shadowBlur = 24;
    ctx.fillText(toast.text, 0, 0);

    ctx.shadowBlur = 0;
    ctx.font = "bold 15px Arial";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(toast.sub, 0, 26);

    ctx.restore();
}

function drawOverlay(title, subtitle, hint, color) {
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.78)";
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = "center";

    ctx.font = "bold 44px Arial";
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 28;
    ctx.fillText(title, W / 2, H / 2 - 30);

    ctx.shadowBlur = 0;
    ctx.font = "bold 20px Arial";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(subtitle, W / 2, H / 2 + 8);

    ctx.font = "14px Arial";
    ctx.fillStyle = "#9fd9e2";
    ctx.fillText(hint, W / 2, H / 2 + 42);

    ctx.restore();
}

function draw(now) {
    ctx.clearRect(0, 0, W, H);

    // Seitenhintergrund
    ctx.fillStyle = "#0d0d12";
    ctx.fillRect(0, 0, W, H);

    drawScenery();

    // Verkehr (Gegenverkehr zuletzt, damit er sichtbar bleibt)
    for (const e of enemies) {
        if (!e.oncoming) drawCar(e.x, e.y, e.color, 0, "traffic");
    }
    for (const e of enemies) {
        if (e.oncoming) drawCar(e.x, e.y, e.color, 0, "oncoming");
    }

    // Spieler
    if (gameState !== "over") {
        drawCar(carX, PLAYER_Y, PLAYER_COLOR, tilt, "player");
    }

    drawParticles();
    drawHud();
    drawToast(now);

    if (gameState === "pause") {
        drawOverlay(
            "PAUSE",
            meters() + " m · " + kmh() + " km/h",
            "P = Weiter · R = Neustart",
            "#00eaff"
        );
    } else if (gameState === "over") {
        // Kurzes Ruckeln nach dem Crash
        const since = now - crashAt;
        if (since < 400 && since >= 0) {
            const k = 1 - since / 400;
            ctx.save();
            ctx.translate((Math.random() - 0.5) * 10 * k, (Math.random() - 0.5) * 10 * k);
            ctx.fillStyle = "rgba(255,0,68," + (0.25 * k) + ")";
            ctx.fillRect(0, 0, W, H);
            ctx.restore();
        }

        drawOverlay(
            "CRASH!",
            isNewBest ? "★ NEUER BESTWERT: " + meters() + " m" : "Strecke: " + meters() + " m",
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
    const dt = Math.min(0.05, (time - lastTime) / 1000);
    lastTime = time;

    update(dt);
    updateParticles(dt);
    draw(time);

    requestAnimationFrame(gameLoop);
}

startGame();
requestAnimationFrame(gameLoop);




