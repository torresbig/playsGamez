const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

/* ============================================================
   GRUNDWERTE
============================================================ */

const paddleWidth = 10;
let paddleHeight = 100;
let enemyHeight = 100;

let paddleY = canvas.height / 2 - paddleHeight / 2;
let enemyY = canvas.height / 2 - enemyHeight / 2;

let enemySpeed = 3;
let playerSpeed = 5;

let ballX = canvas.width / 2;
let ballY = canvas.height / 2;
let ballSpeedX = 4;
let ballSpeedY = 4;
let ballSize = 10;

let difficulty = "normal";

/* ============================================================
   SCHWIERIGKEITSMODIS (ZENTRALE BALANCE-TABELLE)

   Alle Geschwindigkeiten kommen aus einer Tabelle, damit die
   Modi wirklich unterscheidbar und ausbalanciert sind:
   - ballSpeed:     Grundgeschwindigkeit beim Anstoß
   - ballSpeedGain: Beschleunigung pro Padeltreffer
   - maxBallSpeed:  harte Obergrenze (verhindert "zu schnell")
   - enemySpeed:    Geschwindigkeit der gegnerischen KI
   Das Verhältnis Ball-Speed : Gegner-Speed ist in allen Modi
   gleich (~1.4), sodass jeder Modus prinzipiell spielbar bleibt.
============================================================ */

const DIFFICULTY = {
    easy: {
        ballSpeed: 3.4,
        ballSpeedGain: 0.15,
        maxBallSpeed: 5.5,
        enemySpeed: 2.4,
        color: "#00ff88" // Grün
    },
    normal: {
        ballSpeed: 4.6,
        ballSpeedGain: 0.22,
        maxBallSpeed: 8.0,
        enemySpeed: 3.3,
        color: "#00eaff" // Blau
    },
    hard: {
        ballSpeed: 6.2,
        ballSpeedGain: 0.3,
        maxBallSpeed: 10.5,
        enemySpeed: 4.4,
        color: "#ff0044" // Rot
    }
    ,
    ultra: {
        ballSpeed: 9,
        ballSpeedGain: 0.3,
        maxBallSpeed: 15,
        enemySpeed: 5.5,
        color: "#a200ff" // Lila
    }
};

/* ============================================================
   POWER-UP SYSTEM

   - Seltenes Spawnen, Timing komplett zufällig
   - 10 Effekte mit eigener Farbe, Glyph und Ziel-Seite
   - Token-Optik: kleiner roter Kern = verkleinern,
     großer grüner Kern = vergrößern, eigene Farben sonst
   - Effekte laufen über activeEffects (Ende-Zeitstempel)
     und werden pro Frame neu berechnet (recomputeEffects)
============================================================ */

const POWERUP_TYPES = [
    // Verkleinern = klein & rot, Vergrößern = groß & grün
    { id: "shrinkEnemy",  label: "GEGNER SCHRUMPFEN",     glyph: "▼", color: "#ff2d55", radius: 11, side: "enemy",  weight: 3,   duration: 6000, positive: false },
    { id: "growPlayer",   label: "DU WIRST RIESIG",       glyph: "▲", color: "#00ff88", radius: 18, side: "player", weight: 3,   duration: 6000, positive: true },
    { id: "shrinkPlayer", label: "DU SCHRUMPST!",         glyph: "▼", color: "#ff2d55", radius: 11, side: "player", weight: 1.5, duration: 6000, positive: false },
    { id: "growEnemy",    label: "GEGNER WIRD RIESIG",    glyph: "▲", color: "#00ff88", radius: 18, side: "enemy",  weight: 1.5, duration: 6000, positive: false },
    // Special Events
    { id: "invertPlayer", label: "STEUERUNG INVERTIERT!", glyph: "⇅", color: "#ff9500", radius: 14, side: "player", weight: 1.5, duration: 5000, positive: false },
    { id: "confuseEnemy", label: "GEGNER IST VERWIRRT!",  glyph: "?",  color: "#ff2dd4", radius: 14, side: "enemy",  weight: 2.5, duration: 6000, positive: false },
    { id: "curve",        label: "KURVENBALL!",           glyph: "~",  color: "#ffe600", radius: 14, side: "ball",   weight: 3,   duration: 6000, positive: true },
    { id: "bigBall",      label: "RIESEN-BALL!",          glyph: "●",  color: "#00eaff", radius: 15, side: "ball",   weight: 2.5, duration: 7000, positive: true },
    { id: "freezeEnemy",  label: "GEGNER EINGEFROREN!",   glyph: "❄",  color: "#7df9ff", radius: 13, side: "enemy",  weight: 2.5, duration: 2500, positive: false },
    { id: "turboPlayer",  label: "TURBO-AKTIV!",          glyph: "⚡", color: "#ff9500", radius: 14, side: "player", weight: 2.5, duration: 6000, positive: true }
];

// Aktuelles Token auf dem Feld
let powerUpActive = false;
let powerUpType = null;
let powerUpX = 0;
let powerUpY = 0;
let powerUpBornAt = 0;
let powerUpExpiresAt = 0;
let powerUpTimeoutId = null;

// Laufende Effekte
let activeEffects = [];   // { type, endsAt, curveSpin? }
let enemyFrozen = false;
let enemyConfused = false;
let invertActive = false;
let curveActive = false;
let curveSpin = 0;

// Optik-Events (Toast = Ankündigung, Shockwave = Einsammel-Blitz)
let toast = null;         // { type, startAt }
let shockwaves = [];      // { x, y, color, startAt }

let lastHit = "player"; // Wer hat zuletzt den Ball berührt?

/* ============================================================
   SCORE
============================================================ */

let playerScore = 0;
let enemyScore = 0;

/* ============================================================
   INPUT
============================================================ */

let upPressed = false;
let downPressed = false;

/* ============================================================
   GAME STATE
============================================================ */

let gameStarted = false;
let countdown = 3;
let countdownInterval = null; // verhindert gestapelte Countdown-Timer

/* ============================================================
   ORIENTATION (HANDY)

   Erzwingt das Querformat, sofern der Browser das unterstützt.
   Wird einmal beim Spielstart aufgerufen. Ein gescheitertes Lock
   ist nicht kritisch – das Spiel läuft dann einfach weiter.
============================================================ */

function lockLandscape() {
    if (screen.orientation && typeof screen.orientation.lock === 'function') {
        screen.orientation.lock('landscape').catch(() => {
            // Lock nicht verfügbar oder vom Nutzer verweigert – ignorieren
        });
    }
}

/* ============================================================
   MODUSWECHSEL (CLEAN COLOR SWITCH)
============================================================ */

function applyDifficulty() {
    const cfg = DIFFICULTY[difficulty];

    enemySpeed = cfg.enemySpeed;

    // Farbe global setzen
    document.documentElement.style.setProperty("--main-color", cfg.color);
}

/* ============================================================
   BUTTON EVENTS
============================================================ */

function setActiveMode(mode) {
    document.getElementById("easyBtn").classList.remove("activeMode");
    document.getElementById("normalBtn").classList.remove("activeMode");
    document.getElementById("hardBtn").classList.remove("activeMode");
    document.getElementById("ultraBtn").classList.remove("activeMode");
    document.getElementById(mode + "Btn").classList.add("activeMode");
}

document.getElementById("easyBtn").addEventListener("click", () => {
    difficulty = "easy";
    applyDifficulty();
    setActiveMode("easy");
    resetBallWithCountdown();
});

document.getElementById("normalBtn").addEventListener("click", () => {
    difficulty = "normal";
    applyDifficulty();
    setActiveMode("normal");
    resetBallWithCountdown();
});

document.getElementById("hardBtn").addEventListener("click", () => {
    difficulty = "hard";
    applyDifficulty();
    setActiveMode("hard");
    resetBallWithCountdown();
});
document.getElementById("ultraBtn").addEventListener("click", () => {
    difficulty = "ultra";
    applyDifficulty();
    setActiveMode("ultra");
    resetBallWithCountdown();
});

document.getElementById("restartBtn").addEventListener("click", () => {
    playerScore = 0;
    enemyScore = 0;

    // Laufende Power-Up-Effekte / Optik-Events sauber beenden
    activeEffects = [];
    toast = null;
    shockwaves = [];
    recomputeEffects();

    resetBallWithCountdown();
});

/* ============================================================
   TASTATUR
============================================================ */

document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowUp") upPressed = true;
    if (e.key === "ArrowDown") downPressed = true;
});

document.addEventListener("keyup", (e) => {
    if (e.key === "ArrowUp") upPressed = false;
    if (e.key === "ArrowDown") downPressed = false;
});

/* ============================================================
   STEUERUNG (gemeinsame Logik)

   Das Canvas wird per CSS skaliert (Desktop groß, Handy klein),
   die interne Auflösung bleibt 800x500. Deshalb müssen alle
   Eingabe-Koordinaten von CSS-Pixeln in Canvas-Pixel umgerechnet
   werden – sonst erreicht das Paddle den unteren/oberen Rand
   nie (das war der alte Bug).

   Maus UND Finger positionieren das Paddle direkt 1:1:
   - Maus: sofortige Reaktion beim Hovern (kein Klick nötig)
   - Touch: Paddle folgt dem Finger pixelgenau und sofort,
     liegt aber mit PADDLE_TOUCH_OFFSET oberhalb des Fingers,
     damit der Finger das Paddle nicht verdeckt.
============================================================ */

// Beim Touch sitzt das Paddle so viele Canvas-Pixel über dem Finger,
// sodass der eigene Finger das Paddle nicht mehr verdeckt.
const PADDLE_TOUCH_OFFSET = 45;

function movePaddleToClientY(clientY, isTouch = false) {
    const rect = canvas.getBoundingClientRect();
    if (rect.height === 0) return;

    const scaleY = canvas.height / rect.height;
    let canvasY = (clientY - rect.top) * scaleY;

    if (isTouch) {
        // Paddle oberhalb des Fingers platzieren (Finger bleibt sichtbar)
        canvasY -= PADDLE_TOUCH_OFFSET;
    }

    // Steuerung invertiert (Power-Up): Position spiegeln
    if (invertActive) canvasY = canvas.height - canvasY;

    paddleY = canvasY - paddleHeight / 2;

    if (paddleY < 0) paddleY = 0;
    if (paddleY > canvas.height - paddleHeight) paddleY = canvas.height - paddleHeight;
}

canvas.addEventListener("mousemove", (e) => {
    movePaddleToClientY(e.clientY);
});

/* ============================================================
   TOUCH-STEUERUNG
   Das Paddle folgt dem Finger 1:1 und SOFORT (kein trödelndes
   +/- pro Frame). Wichtig: touch-action: none im CSS +
   preventDefault, damit die Seite beim Spielen nicht scrollt.
============================================================ */

function handleTouches(e) {
    const touch = e.touches[0];
    if (!touch) return;

    movePaddleToClientY(touch.clientY, true);
}

canvas.addEventListener("touchstart", (e) => {
    e.preventDefault();
    handleTouches(e);
}, { passive: false });

canvas.addEventListener("touchmove", (e) => {
    e.preventDefault();
    handleTouches(e);
}, { passive: false });

canvas.addEventListener("touchend", (e) => {
    e.preventDefault();
}, { passive: false });

/* ============================================================
   POWER-UP LOGIK
============================================================ */

function pickRandomPowerUp() {
    const total = POWERUP_TYPES.reduce((sum, t) => sum + t.weight, 0);
    let roll = Math.random() * total;

    for (const t of POWERUP_TYPES) {
        roll -= t.weight;
        if (roll <= 0) return t;
    }
    return POWERUP_TYPES[0];
}

function spawnPowerUp() {
    if (powerUpTimeoutId !== null) clearTimeout(powerUpTimeoutId);

    powerUpType = pickRandomPowerUp();
    // Mittleres Drittel horizontal, nicht an den Kanten vertikal
    powerUpX = canvas.width * 0.3 + Math.random() * canvas.width * 0.4;
    powerUpY = 70 + Math.random() * (canvas.height - 140);
    powerUpBornAt = performance.now();

    // Wie lange das Token liegen bleibt: ebenfalls zufällig
    const life = 10000 + Math.random() * 5000;
    powerUpExpiresAt = powerUpBornAt + life;
    powerUpActive = true;

    powerUpTimeoutId = setTimeout(() => {
        powerUpActive = false;
        powerUpType = null;
        powerUpTimeoutId = null;
    }, life);
}

// Spawn-Rhythmus: alles zufällig und deutlich seltener als vorher
// (erstes Token nach 12-25 s, danach alle 24-42 s)
function scheduleNextPowerUp(first) {
    const delay = first
        ? 12000 + Math.random() * 13000
        : 24000 + Math.random() * 18000;

    setTimeout(() => {
        if (!powerUpActive) spawnPowerUp();
        scheduleNextPowerUp(false);
    }, delay);
}

function collectPowerUp() {
    if (!powerUpType) return;
    const type = powerUpType;

    if (powerUpTimeoutId !== null) {
        clearTimeout(powerUpTimeoutId);
        powerUpTimeoutId = null;
    }
    powerUpActive = false;
    powerUpType = null;

    // Wer hat den Ball zuletzt berührt? Das ist der Sammler.
    const hitter = lastHit || "player";

    // Zielseite bestimmen:
    // - positive Effekte  -> treffen den Sammler
    // - negative Effekte  -> treffen den Gegner
    // - Ball-Effekte (kurve, großer Ball) sind neutral
    let target;
    if (type.side === "ball") {
        target = "ball";
    } else if (type.positive) {
        target = hitter;
    } else {
        target = hitter === "player" ? "enemy" : "player";
    }

    // Effekt aktivieren (kein Stapeln desselben Typs)
    activeEffects = activeEffects.filter((e) => e.type.id !== type.id);
    const effect = { type, endsAt: performance.now() + type.duration, target };
    if (type.id === "curve") effect.curveSpin = Math.random() > 0.5 ? 1 : -1;
    activeEffects.push(effect);

    // Blitz-Welle am Einsammel-Punkt
    shockwaves.push({ x: powerUpX, y: powerUpY, color: type.color, startAt: performance.now() });

    recomputeEffects();

    // Anzeige: was passiert + betroffene Seite
    toast = { type, target, startAt: performance.now() };
}

function hasEffect(id) {
    return activeEffects.some((e) => e.type.id === id);
}

// Alle Effekte -> Ist-Zustand (pro Frame neu berechnet,
// damit Ablauf und sich überlagernde Effekte immer stimmen)
function recomputeEffects() {
    const now = performance.now();
    activeEffects = activeEffects.filter((e) => e.endsAt > now);

    // Basiswerte zurücksetzen
    paddleHeight = 100;
    enemyHeight = 100;
    playerSpeed = 5;
    enemySpeed = DIFFICULTY[difficulty].enemySpeed;
    ballSize = 10;
    enemyFrozen = false;
    enemyConfused = false;
    invertActive = false;
    curveActive = false;
    curveSpin = 0;

    // Aus Effekten ableiten – e.target legt fest, welcher Paddle / KI betroffen ist
    for (const e of activeEffects) {
        const isPlayer = e.target === "player";
        const isEnemy = e.target === "enemy";

        if (e.type.id === "growPlayer" || e.type.id === "growEnemy") {
            if (isPlayer) paddleHeight = 150;
            if (isEnemy) enemyHeight = 150;
        }
        if (e.type.id === "shrinkPlayer" || e.type.id === "shrinkEnemy") {
            if (isPlayer) paddleHeight = 55;
            if (isEnemy) enemyHeight = 55;
        }
        if (e.type.id === "turboPlayer") {
            if (isPlayer) playerSpeed = 8.5;
            if (isEnemy) enemySpeed = 8.5;
        }
        if (e.type.id === "bigBall") ballSize = 22;

        if (e.type.id === "freezeEnemy" && isEnemy) enemyFrozen = true;
        if (e.type.id === "confuseEnemy" && isEnemy) enemyConfused = true;
        if (e.type.id === "invertPlayer" && isPlayer) invertActive = true;
    }

    const curveFx = activeEffects.find((e) => e.type.id === "curve");
    if (curveFx) {
        curveActive = true;
        curveSpin = curveFx.curveSpin || 1;
    }

    // Nach Größenwechsel wieder sauber ins Feld ziehen
    if (paddleY < 0) paddleY = 0;
    if (paddleY > canvas.height - paddleHeight) paddleY = canvas.height - paddleHeight;
    if (enemyY < 0) enemyY = 0;
    if (enemyY > canvas.height - enemyHeight) enemyY = canvas.height - enemyHeight;
}

/* ============================================================
   BALL RESET / ANSTOSS

   resetBall() = neuer Anstoß vom Mittelpunkt, sofort weiterspielen.
   Wird nach jedem Punkt und nach einem Moduswechsel verwendet.
============================================================ */

function resetBall() {
    const cfg = DIFFICULTY[difficulty];

    ballX = canvas.width / 2;
    ballY = canvas.height / 2;

    // Zufällige Startrichtung (leichter Winkel, damit kein
    // flacher Dauer-Pass über das ganze Feld entsteht)
    const angle = (Math.random() * 2 - 1) * (Math.PI / 5); // ±36°
    const dirX = Math.random() > 0.5 ? 1 : -1;

    ballSpeedX = Math.cos(angle) * cfg.ballSpeed * dirX;
    ballSpeedY = Math.sin(angle) * cfg.ballSpeed;

    lastHit = dirX === 1 ? "player" : "enemy"; // wer den Ball zum Gegner schickt, hat angestoßen
}

/* ============================================================
   COUNTDOWN (nur für Spielstart, Moduswechsel & Neustart)
============================================================ */

function resetBallWithCountdown() {
    resetBall();
    countdown = 3;
    gameStarted = false;

    // Alten Timer stoppen, sonst stapeln sich die Intervalle
    if (countdownInterval !== null) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }

    countdownInterval = setInterval(() => {
        countdown--;
        if (countdown <= 0) {
            clearInterval(countdownInterval);
            countdownInterval = null;
            gameStarted = true;
        }
    }, 1000);
}

/* ============================================================
   KOLLISION (ausgelagert, damit der Ball in Sub-Steps laufen
   kann und auch bei hohen FPS nichts durch das Padel rutscht)
============================================================ */

function checkCollisions() {
    const cfg = DIFFICULTY[difficulty];

    if (ballY <= 0 || ballY >= canvas.height - ballSize) {
        ballSpeedY *= -1;
        // Ball wieder ins Feld ziehen (Safety gegen Ausstecken)
        if (ballY <= 0) ballY = 0;
        if (ballY >= canvas.height - ballSize) ballY = canvas.height - ballSize;
    }

    // Punkte -> neuer Anstoß OHNE Countdown
    if (ballX < 0) {
        enemyScore++;
        resetBall();
        return true;
    }

    if (ballX > canvas.width) {
        playerScore++;
        resetBall();
        return true;
    }

    // Power-Up Treffer (Kreis-gegen-Ball, altes powerUpSize-Box-Problem raus)
    if (powerUpActive && powerUpType) {
        const dx = (ballX + ballSize / 2) - powerUpX;
        const dy = (ballY + ballSize / 2) - powerUpY;
        const reach = powerUpType.radius + ballSize / 2;

        if (dx * dx + dy * dy <= reach * reach) {
            collectPowerUp();
        }
    }

    // Spieler-Paddle Kollision
    if (
        ballSpeedX < 0 &&
        ballX <= paddleWidth &&
        ballY + ballSize >= paddleY &&
        ballY <= paddleY + paddleHeight
    ) {
        lastHit = "player";

        let relativeIntersectY = (ballY + ballSize / 2) - (paddleY + paddleHeight / 2);
        let normalized = Math.max(-1, Math.min(1, relativeIntersectY / (paddleHeight / 2)));

        // Winkel je nach Trefferposition, Geschwindigkeit aus der
        // Balance-Tabelle (modus-abhängig, mit Obergrenze)
        const speed = Math.min(Math.abs(ballSpeedX) + cfg.ballSpeedGain, cfg.maxBallSpeed);

        // Abprallwinkel begrenzen: Bei Kanten-Treffern wurde der Ball
        // früher zu steil abgeschossen (bis ca. 56°). Die X-Geschwindigkeit
        // brach dann stark ein und der Ball "verlangsamte" das Feld entlang.
        // Jetzt wird der Winkel auf maximal 45° gekappt, sodass X immerhin
        // noch ~70 % der Gesamtgeschwindigkeit behält.
        const MAX_BOUNCE_ANGLE = Math.PI / 4;
        let angle = normalized * (Math.PI / 3.2);
        if (Math.abs(angle) > MAX_BOUNCE_ANGLE) {
            angle = Math.sign(angle) * MAX_BOUNCE_ANGLE;
        }

        ballSpeedX = Math.cos(angle) * speed;
        ballSpeedY = Math.sin(angle) * speed;
        ballX = paddleWidth + 1;
    }

    // Gegner-Paddle Kollision
    if (
        ballSpeedX > 0 &&
        ballX + ballSize >= canvas.width - paddleWidth &&
        ballY >= enemyY &&
        ballY <= enemyY + enemyHeight
    ) {
        lastHit = "enemy";

        const speed = Math.min(Math.abs(ballSpeedX) + cfg.ballSpeedGain, cfg.maxBallSpeed);

        ballSpeedX = -speed;
        ballX = canvas.width - paddleWidth - ballSize - 1;
    }

    return false;
}

/* ============================================================
   UPDATE (frame-rate-unabhängig über Delta-Zeit)
============================================================ */

function update(dt) {
    if (!gameStarted) return;

    // Gegner KI
    let enemyCenter = enemyY + enemyHeight / 2;

    if (enemyFrozen) {
        // Gegner eingefroren: keine Bewegung
    } else if (enemyConfused) {
        // Gegner verwirrt: läuft in die Gegenrichtung
        if (enemyCenter < ballY - 10) enemyY -= enemySpeed * dt;
        else if (enemyCenter > ballY + 10) enemyY += enemySpeed * dt;
    } else {
        if (enemyCenter < ballY - 10) enemyY += enemySpeed * dt;
        else if (enemyCenter > ballY + 10) enemyY -= enemySpeed * dt;
    }

    // leichtes Rauschen skaliert ebenfalls mit Modus + dt
    if (!enemyFrozen) {
        enemyY += (Math.random() - 0.5) * enemySpeed * 0.35 * dt;
    }

    if (enemyY < 0) enemyY = 0;
    if (enemyY > canvas.height - enemyHeight) enemyY = canvas.height - enemyHeight;

    // Spieler Bewegung (ggf. invertiert: Tasten vertauscht)
    const moveUp = invertActive ? downPressed : upPressed;
    const moveDown = invertActive ? upPressed : downPressed;

    if (moveUp) paddleY -= playerSpeed * dt;
    if (moveDown) paddleY += playerSpeed * dt;

    if (paddleY < 0) paddleY = 0;
    if (paddleY > canvas.height - paddleHeight) paddleY = canvas.height - paddleHeight;

    // Kurvenball: Y-Komponente sanft in Spin-Richtung ziehen,
    // dadurch entsteht eine echte Bahn-Kurve
    if (curveActive) {
        const cfg = DIFFICULTY[difficulty];
        ballSpeedY += curveSpin * 0.25 * dt;

        const cap = cfg.maxBallSpeed;
        if (ballSpeedY > cap) ballSpeedY = cap;
        if (ballSpeedY < -cap) ballSpeedY = -cap;
    }

    // Ball Bewegung in Sub-Steps (verhindert Durchrutschen)
    // Geschwindigkeit wird pro Teil-Schritt neu ausgelesen, damit eine Wand-Kollision
    // (ballSpeedY *= -1) sofort greift und der Ball nicht am oberen/unteren Rand
    // "kleben" bleiben kann.
    const maxStep = 4; // max. Pixel pro Teil-Schritt
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(ballSpeedX), Math.abs(ballSpeedY)) * dt / maxStep));

    for (let i = 0; i < steps; i++) {
        ballX += ballSpeedX * dt / steps;
        ballY += ballSpeedY * dt / steps;

        if (checkCollisions()) return; // Punkt gefallen -> Anstoß
    }
}

/* ============================================================
   DRAW
============================================================ */

// Kleiner Helfer für abgerundete Rechtecke (Chips/Toast)
function roundRectPath(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

// Glow-Wrapper, damit shadowBlur sauber zurückgesetzt wird
function withGlow(color, blur, fn) {
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
    fn();
    ctx.restore();
}

function sideLabelOf(side) {
    if (side === "player") return "ZIEL: DU";
    if (side === "enemy") return "ZIEL: GEGNER";
    return "ZIEL: BEIDE"; // Ball = neutrales Ereignis
}

function hexToRgba(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;
    return "rgba(" + r + "," + g + "," + b + "," + a + ")";
}

function draw() {
    const now = performance.now();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!gameStarted) {
        ctx.fillStyle = "white";
        ctx.font = "60px Arial";
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
        ctx.fillText(countdown.toString(), canvas.width / 2 - 20, canvas.height / 2);
        return;
    }

    const cfg = DIFFICULTY[difficulty];

    // Effekt-Glows: welches Objekt wird gerade beeinflusst?
    const playerFx = activeEffects.find((e) => e.type.side === "player");
    const enemyFx = activeEffects.find((e) => e.type.side === "enemy");
    const ballFx = activeEffects.find((e) => e.type.side === "ball");

    // Spieler (Glow in der Effektfarbe, sonst neutral weiß)
    withGlow(playerFx ? playerFx.type.color : "rgba(255,255,255,0.4)", playerFx ? 25 : 8, () => {
        ctx.fillStyle = playerFx ? playerFx.type.color : "white";
        ctx.fillRect(0, paddleY, paddleWidth, paddleHeight);
    });

    // Gegner
    withGlow(enemyFx ? enemyFx.type.color : "rgba(255,255,255,0.4)", enemyFx ? 25 : 8, () => {
        ctx.fillStyle = enemyFx ? enemyFx.type.color : "white";
        ctx.fillRect(canvas.width - paddleWidth, enemyY, paddleWidth, enemyHeight);
    });

    // Ball (großer Ball bekommt Rundung + Glow)
    withGlow(ballFx ? ballFx.type.color : "rgba(255,255,255,0.35)", ballFx ? 22 : 6, () => {
        ctx.fillStyle = ballFx ? ballFx.type.color : "white";
        if (ballSize > 14) {
            roundRectPath(ballX, ballY, ballSize, ballSize, ballSize / 2);
            ctx.fill();
        } else {
            ctx.fillRect(ballX, ballY, ballSize, ballSize);
        }
    });

    // Score
    ctx.shadowBlur = 0;
    ctx.fillStyle = cfg.color;
    ctx.font = "40px Arial";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("Player: " + playerScore, canvas.width / 4 - 50, 60);
    ctx.fillText("Enemy: " + enemyScore, canvas.width / 4 * 3 - 50, 60);

    // Power-Up-Token
    if (powerUpActive && powerUpType) {
        drawPowerUp(now);
    }

    drawShockwaves(now);      // Einsammel-Blitz
    drawEffectChips(now);     // aktive Effekte, nach Seite gruppiert
    drawToast(now);           // Ankündigung: was passiert + Ziel
}

/* ============================================================
   GAME LOOP (Delta-Zeit, normiert auf 60 FPS)

   So läuft das Spiel auf 60-, 120- oder 144-Hz-Monitoren
   exakt gleich schnell. "dt" = 1.0 bei 60 FPS.
============================================================ */

const BASE_FRAME_TIME = 1000 / 60;
let lastFrameTime = performance.now();

function gameLoop(now) {
    if (now === undefined) now = performance.now();

    let dt = (now - lastFrameTime) / BASE_FRAME_TIME;
    lastFrameTime = now;

    // Sprünge nach Tab-Wechsel etc. begrenzen
    dt = Math.max(0, Math.min(dt, 2.5));

    recomputeEffects(); // Power-Up-Effekte laufen auch ab, wenn Stillstand ist
    update(dt);
    draw();
    requestAnimationFrame(gameLoop);
}

/* ============================================================
   POWER-UP OPTIK (Token + Einsammel-Blitz)
============================================================ */

function drawPowerUp(now) {
    const type = powerUpType;
    const cx = powerUpX;
    const cy = powerUpY;

    // Spawn-Pop + leichtes Pulsieren
    const age = now - powerUpBornAt;
    const spawn = Math.min(1, age / 350);
    const pop = 1 + Math.sin(now / 220) * 0.07;
    const r = type.radius * (0.3 + 0.7 * spawn) * pop;

    // Restzeit-Ring
    const lifeFrac = Math.max(0, (powerUpExpiresAt - now) / (powerUpExpiresAt - powerUpBornAt));

    ctx.save();
    ctx.translate(cx, cy);

    // Äußerer Halo
    const halo = ctx.createRadialGradient(0, 0, r * 0.5, 0, 0, r * 2.4);
    halo.addColorStop(0, hexToRgba(type.color, 0.35));
    halo.addColorStop(1, hexToRgba(type.color, 0));
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, r * 2.4, 0, Math.PI * 2);
    ctx.fill();

    // Kern mit Farbverlauf (weißer Glanz -> Farbe -> dunkel)
    const core = ctx.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.1, 0, 0, r);
    core.addColorStop(0, "#ffffff");
    core.addColorStop(0.35, type.color);
    core.addColorStop(1, hexToRgba(type.color, 0.55));

    withGlow(type.color, 30, () => {
        ctx.fillStyle = core;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
    });

    // Heller Rand
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();

    // Rotierender gestrichelter Ring
    ctx.save();
    ctx.rotate((now / 1000) * 1.6);
    ctx.strokeStyle = hexToRgba(type.color, 0.9);
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.arc(0, 0, r + 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Restzeit-Bogen (weiß, schrumpft mit der Zeit)
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, r + 11, -Math.PI / 2, -Math.PI / 2 + lifeFrac * Math.PI * 2);
    ctx.stroke();

    // Glyph in der Mitte
    ctx.fillStyle = "#0a0a0a";
    ctx.font = "bold " + Math.round(r * 1.25) + "px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(type.glyph, 0, 1);

    ctx.restore();
}

function drawShockwaves(now) {
    shockwaves = shockwaves.filter((s) => now - s.startAt < 600);

    for (const s of shockwaves) {
        const t = (now - s.startAt) / 600;
        const r = 8 + t * 90;

        ctx.save();
        ctx.globalAlpha = 1 - t;
        ctx.strokeStyle = s.color;
        ctx.lineWidth = 4 * (1 - t) + 1;
        withGlow(s.color, 20, () => {
            ctx.beginPath();
            ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
            ctx.stroke();
        });
        ctx.restore();
    }
}

/* ============================================================
   EFFEKT-CHIPS: aktive Effekte mit Restzeit –
   links = Spieler, Mitte = Ball, rechts = Gegner
============================================================ */

function chipText(e, now) {
    const secs = Math.max(1, Math.ceil((e.endsAt - now) / 1000));
    return e.type.glyph + " " + secs + "s";
}

function measureChip(e, now) {
    ctx.font = "bold 11px Arial";
    return ctx.measureText(chipText(e, now)).width + 16;
}

function drawChip(x, y, h, e, now) {
    const w = measureChip(e, now);
    const text = chipText(e, now);

    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.strokeStyle = e.type.color;
    ctx.lineWidth = 1.5;
    roundRectPath(x, y, w, h, h / 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = e.type.color;
    ctx.textAlign = "left";
    ctx.fillText(text, x + 8, y + h / 2 + 1);

    return x + w + 8;
}

function drawEffectChips(now) {
    const groups = { player: [], ball: [], enemy: [] };
    for (const e of activeEffects) {
        if (groups[e.target]) groups[e.target].push(e);
    }

    ctx.save();
    ctx.font = "bold 11px Arial";
    ctx.textBaseline = "middle";

    const y = 76;
    const h = 20;

    // Spieler: linksbündig ab 14px
    let x = 14;
    for (const e of groups.player) x = drawChip(x, y, h, e, now);

    // Gegner: rechtsbündig bis canvas.width - 14
    let xr = canvas.width - 14;
    for (const e of groups.enemy) {
        const w = measureChip(e, now);
        xr = drawChip(xr - w, y, h, e, now) - w - 8;
    }

    // Ball: mittig
    const ballWidths = groups.ball.map((e) => measureChip(e, now));
    const totalW = ballWidths.reduce((a, b) => a + b + 8, -8);
    let bx = (canvas.width - totalW) / 2;
    for (const e of groups.ball) bx = drawChip(bx, y, h, e, now);

    ctx.restore();
}

/* ============================================================
   TOAST: große Ankündigung – WAS passiert + WEN es trifft
============================================================ */

function drawToast(now) {
    if (!toast) return;

    const t = (now - toast.startAt) / 2800;
    if (t >= 1) {
        toast = null;
        return;
    }

    const type = toast.type;

    // Pop-In am Anfang, Ausblenden am Ende
    let scale = 1;
    let alpha = 1;
    if (t < 0.15) {
        const k = t / 0.15;
        scale = 0.6 + 0.4 * (1 + 2.7 * Math.pow(k - 1, 3) + 1.7 * Math.pow(k - 1, 2));
        alpha = k;
    } else if (t > 0.75) {
        alpha = 1 - (t - 0.75) / 0.25;
    }

    const secs = (type.duration / 1000).toFixed(1).replace(".0", "");

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(canvas.width / 2, canvas.height * 0.32);
    ctx.scale(scale, scale);
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";

    // Plakette
    ctx.font = "bold 30px Arial";
    const line1 = type.label;
    const w1 = ctx.measureText(line1).width + 50;

    ctx.font = "bold 15px Arial";
    const line2 = sideLabelOf(toast.target) + " · " + secs + "s";
    const w2 = ctx.measureText(line2).width + 30;

    const plaqueW = Math.max(w1, w2);
    const plaqueH = 88;

    withGlow(type.color, 35, () => {
        ctx.fillStyle = "rgba(0,0,0,0.8)";
        ctx.strokeStyle = type.color;
        ctx.lineWidth = 2.5;
        roundRectPath(-plaqueW / 2, -plaqueH / 2, plaqueW, plaqueH, 14);
        ctx.fill();
        ctx.stroke();
    });

    // Effekt-Name
    ctx.font = "bold 30px Arial";
    ctx.fillStyle = type.color;
    ctx.shadowColor = type.color;
    ctx.shadowBlur = 18;
    ctx.fillText(line1, 0, -6);
    ctx.shadowBlur = 0;

    // Ziel-Seite + Dauer
    ctx.font = "bold 15px Arial";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(line2, 0, 26);

    // Glyph links in der Plakette
    ctx.font = "22px Arial";
    ctx.fillStyle = type.color;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillText(type.glyph, -plaqueW / 2 + 18, 0);

    ctx.restore();
}

/* ============================================================
   START
============================================================ */

applyDifficulty();
setActiveMode("normal");
resetBallWithCountdown();

// Auf Handy ins Querformat drehen, damit das Spielfeld gut sichtbar ist
lockLandscape();

// Erstes Power-Up nach 12-25 s, danach alle 24-42 s
scheduleNextPowerUp(true);

gameLoop();
