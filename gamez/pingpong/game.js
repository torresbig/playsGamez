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
const ballSize = 10;

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
};

/* ============================================================
   POWER-UP
============================================================ */

let powerUpX = null;
let powerUpY = null;
let powerUpSize = 15;
let powerUpActive = false;

let shrinkTimeoutPlayer = null;
let shrinkTimeoutEnemy = null;

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

document.getElementById("restartBtn").addEventListener("click", () => {
    playerScore = 0;
    enemyScore = 0;
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
   MAUS-STEUERUNG
============================================================ */

let mouseDown = false;

canvas.addEventListener("mousedown", () => {
    mouseDown = true;
});

canvas.addEventListener("mouseup", () => {
    mouseDown = false;
});

canvas.addEventListener("mousemove", (e) => {
    if (mouseDown) {
        const rect = canvas.getBoundingClientRect();
        const mouseY = e.clientY - rect.top;
        paddleY = mouseY - paddleHeight / 2;
    }
});

/* ============================================================
   TOUCH-STEUERUNG
============================================================ */

canvas.addEventListener("touchstart", (e) => {
    const rect = canvas.getBoundingClientRect();
    const touchY = e.touches[0].clientY - rect.top;

    if (touchY < paddleY + paddleHeight / 2) {
        upPressed = true;
    } else {
        downPressed = true;
    }
});

canvas.addEventListener("touchend", () => {
    upPressed = false;
    downPressed = false;
});

/* ============================================================
   POWER-UP LOGIK
============================================================ */

function spawnPowerUp() {
    powerUpX = Math.random() * (canvas.width - 100) + 50;
    powerUpY = Math.random() * (canvas.height - 100) + 50;
    powerUpActive = true;

    setTimeout(() => {
        powerUpActive = false;
    }, 15000);
}

function shrinkEnemy() {
    enemyHeight = 50;

    clearTimeout(shrinkTimeoutEnemy);
    shrinkTimeoutEnemy = setTimeout(() => {
        enemyHeight = 100;
    }, 5000);
}

function shrinkPlayer() {
    paddleHeight = 50;

    clearTimeout(shrinkTimeoutPlayer);
    shrinkTimeoutPlayer = setTimeout(() => {
        paddleHeight = 100;
    }, 5000);
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

    // Power-Up Treffer
    if (powerUpActive) {
        if (
            ballX + ballSize > powerUpX &&
            ballX < powerUpX + powerUpSize &&
            ballY + ballSize > powerUpY &&
            ballY < powerUpY + powerUpSize
        ) {
            powerUpActive = false;

            if (lastHit === "player") {
                shrinkEnemy();
            } else {
                shrinkPlayer();
            }
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
        const angle = normalized * (Math.PI / 3.2);

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

    if (enemyCenter < ballY - 10) enemyY += enemySpeed * dt;
    else if (enemyCenter > ballY + 10) enemyY -= enemySpeed * dt;

    // leichtes Rauschen skaliert ebenfalls mit Modus + dt
    enemyY += (Math.random() - 0.5) * enemySpeed * 0.35 * dt;

    if (enemyY < 0) enemyY = 0;
    if (enemyY > canvas.height - enemyHeight) enemyY = canvas.height - enemyHeight;

    // Spieler Bewegung
    if (upPressed) paddleY -= playerSpeed * dt;
    if (downPressed) paddleY += playerSpeed * dt;

    if (paddleY < 0) paddleY = 0;
    if (paddleY > canvas.height - paddleHeight) paddleY = canvas.height - paddleHeight;

    // Ball Bewegung in Sub-Steps (verhindert Durchrutschen)
    const dx = ballSpeedX * dt;
    const dy = ballSpeedY * dt;
    const maxStep = 4; // max. Pixel pro Teil-Schritt
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / maxStep));

    for (let i = 0; i < steps; i++) {
        ballX += dx / steps;
        ballY += dy / steps;

        if (checkCollisions()) return; // Punkt gefallen -> Anstoß
    }
}

/* ============================================================
   DRAW
============================================================ */

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!gameStarted) {
        ctx.fillStyle = "white";
        ctx.font = "60px Arial";
        ctx.fillText(countdown.toString(), canvas.width / 2 - 20, canvas.height / 2);
        return;
    }

    // Spieler
    ctx.fillStyle = "white";
    ctx.fillRect(0, paddleY, paddleWidth, paddleHeight);

    // Gegner
    ctx.fillRect(canvas.width - paddleWidth, enemyY, paddleWidth, enemyHeight);

    // Ball
    ctx.fillRect(ballX, ballY, ballSize, ballSize);

    // Score
    ctx.fillStyle = "var(--main-color)";
    ctx.font = "40px Arial";
    ctx.fillText("Player: " + playerScore, canvas.width / 4 - 50, 60);
    ctx.fillText("Enemy: " + enemyScore, canvas.width / 4 * 3 - 50, 60);

    // Power-Up
    if (powerUpActive) {
        ctx.fillStyle = "yellow";
        ctx.beginPath();
        ctx.arc(powerUpX, powerUpY, powerUpSize, 0, Math.PI * 2);
        ctx.fill();
    }
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

    update(dt);
    draw();
    requestAnimationFrame(gameLoop);
}

/* ============================================================
   START
============================================================ */

applyDifficulty();
setActiveMode("normal");
resetBallWithCountdown();
spawnPowerUp();

setInterval(() => {
    if (!powerUpActive) spawnPowerUp();
}, Math.random() * 5000 + 7000);

gameLoop();
