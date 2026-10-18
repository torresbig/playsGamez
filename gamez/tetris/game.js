const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

/* ============================================================
   GRUNDWERTE

   Spielfeld: 10 x 20 Zellen à 34px (340 x 680).
   Canvas: 560 x 720 – links das Feld, rechts die HUD
   (Hold, Next, Punkte, Bestwert, Zeilen, Level, Steuerung).
============================================================ */

const COLS = 10;
const ROWS = 20;
const CELL = 34;
const BOARD_X = 20;
const BOARD_Y = 20;
const BOARD_W = COLS * CELL; // 340
const BOARD_H = ROWS * CELL; // 680

const HUD_X = 380;

/* Timing (alles in Millisekunden) */
const LOCK_DELAY = 500;      // Standzeit am Boden vor der Fixierung
const MAX_LOCK_RESETS = 15;  // wie oft Bewegung die Standzeit zurücksetzt
const SOFT_DROP_MS = 45;     // Fallintervall beim gedrückten Pfeil nach unten
const DAS_MS = 150;          // Haltezeit bis Auto-Wiederholung (links/rechts)
const ARR_MS = 40;           // Abstand der Auto-Wiederholung
const CLEAR_MS = 280;        // Flash beim Zeilenlöschen
const TOAST_MS = 1400;       // Anzeigezeit für "TETRIS!" etc.

/* Punkte je gelöschter Zeile (× Level) */
const BASE_CLEAR = [0, 100, 300, 500, 800];
const CLEAR_NAMES = ["", "SINGLE", "DOUBLE", "TRIPLE", "TETRIS!"];

/* ============================================================
   STEINE (SHAPES)

   Jeder Eintrag ist eine Matrix aus 0 und 1:
     1 = gefüllte Zelle (gehört zum Stein)
     0 = leere Zelle

   Beispiel T (3×3):
     [[0, 1, 0],
      [1, 1, 1],
      [0, 0, 0]]

   Hinweise:
   - Leere äußere Reihen/Spalten sind für die reine Anzeige nicht nötig,
     werden aber aus Konsistenzgründen stehen gelassen. So bleibt jede
     Matrix gleich groß, was das Rotieren und die Kollisionsprüfung
     einfacher macht.
   - Wird eine Matrix gedreht, tauschen Breite und Höhe die Plätze.
     Deshalb sollte jede Form am besten quadratisch sein (z. B. 3×3
     oder 4×4), damit die Wand-Kicks und der Startplatz stabil bleiben.
   - Jeder Schlüssel hier braucht einen Eintrag in COLORS und (optional)
     in SPAWN_WEIGHTS weiter unten.
============================================================ */

const SHAPES = {
    // Klassische Tetriminos (offizieller 7er-Satz)
    I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
    O: [[1, 1], [1, 1]],
    T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
    S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
    Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
    J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
    L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
    // Ungewöhnliche Zusatz-Steine (alle 3×3, nutzen die gleichen Wand-Kicks wie J/L/S/T/Z)
    X: [[0, 1, 0], [1, 1, 1], [0, 1, 0]],   // Kreuz / X – symmetrisch, sperrig in der Mitte
    W: [[1, 0, 0], [1, 1, 0], [0, 1, 1]],   // Treppe / W – ungleichmäßig, schwer zu stapeln
    H: [[1, 0, 1], [1, 1, 1], [1, 0, 1]],   // H – hohl in der Mitte, braucht gezielte Platzierung
    P: [[1, 1, 0], [1, 1, 1], [0, 0, 0]]    // P – 2×2-Block mit einem Anhängsel unten rechts
};

const COLORS = {
    // Klassische Tetriminos
    I: "#00eaff", // Cyan
    O: "#ffd500", // Gelb
    T: "#a200ff", // Lila
    S: "#00ff88", // Grün
    Z: "#ff0044", // Rot
    J: "#2d6bff", // Blau
    L: "#ff9500", // Orange
    // Ungewöhnliche Zusatz-Steine
    X: "#ff00ff", // Magenta
    W: "#00ff00", // Hellgrün
    H: "#ffff00", // Neon-Gelb
    P: "#ff8800"  // Dunkelorange
};

/* ============================================================
   SPAWN-WAHRscheinlichkeit (Beutel-System)

   Der Beutel enthält jeden Stein so oft wie sein Gewicht angibt.
   Wird er leer, wird er neu gefüllt und per Fisher-Yates gemischt.

   Standard-Tetriminos: Gewicht 10  (alle gleich häufig, wie beim
                        klassischen Tetris-Beutel)
   Zusatz-Steine:       Gewicht 3   (deutlich seltener)
   Ändere die Werte hier, um das Spawn-Verhalten anzupassen.
============================================================ */

const SPAWN_WEIGHTS = {
    // Klassische Tetriminos – alle gleich oft
    I: 10, O: 10, T: 10, S: 10, Z: 10, J: 10, L: 10,
    // Ungewöhnliche Zusatz-Steine – seltener
    X: 3,  W: 3,  H: 3,  P: 3
};

/* ============================================================
   WALL-KICKS (SRS)

   Die Tabellen stehen im SRS-Original (y zeigt nach oben).
   Da unsere Canvas-y-Achse nach unten zeigt, ist jedes y negiert.
   Key = "von > zu" (0 = 0°, 1 = 90°, 2 = 180°, 3 = 270°).
============================================================ */

const KICKS_JLSTZ = {
    "0>1": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    "1>0": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
    "1>2": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
    "2>1": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    "2>3": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
    "3>2": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    "3>0": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    "0>3": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]]
};

const KICKS_I = {
    "0>1": [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
    "1>0": [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
    "1>2": [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
    "2>1": [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
    "2>3": [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
    "3>2": [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
    "3>0": [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
    "0>3": [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]]
};

/* ============================================================
   SPIELZUSTAND
============================================================ */

let board;              // ROWS x COLS, Zellen: null oder Stein-Typ
let bag = [];           // 7-Bag: Beutel aus allen sieben Steinen
let current = null;     // aktiver Stein { type, matrix, rot, x, y }
let nextType = null;    // Stein für die NEXT-Vorschau
let holdType = null;    // zurückgelegter Stein
let holdUsed = false;   // Hold bereits in dieser Runde benutzt?

let score = 0;
let lines = 0;
let level = 1;
let combo = -1;         // aufeinander folgende Zeilen-Löschungen
let backToBack = false;
let isNewBest = false;

let gameState = "run";  // "run" | "pause" | "over"
let dropTimer = 0;      // kumulierte Fallzeit
let lockTimer = 0;      // kumulierte Standzeit am Boden
let lockResets = 0;     // wie oft die Standzeit zurückgesetzt wurde

let clearingRows = null;// Zeilen-Indizes im Lösch-Flash
let clearTimer = 0;
let toast = null;       // { text, sub, color, startAt }

/* Tastatur-Auto-Wiederholung (DAS/ARR) */
let moveDir = 0;        // -1 = links, 1 = rechts, 0 = nichts
let dasTimer = 0;
let arrTimer = 0;
let softHeld = false;

let lastTime = 0;

/* Bestwert – localStorage ist nicht überall erlaubt */
const BEST_KEY = "playsgamez_tetris_best";
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
   HILFSFUNKTIONEN: MATRIX & KOLLISION
============================================================ */

function createBoard() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function copyMatrix(m) {
    return m.map((row) => row.slice());
}

// 90° im Uhrzeigersinn: transponieren, danach jede Spalte umkehren
function rotateCW(m) {
    const size = m.length;
    const out = [];
    for (let c = 0; c < size; c++) {
        out.push([]);
        for (let r = size - 1; r >= 0; r--) out[c].push(m[r][c]);
    }
    return out;
}

// 90° gegen den Uhrzeigersinn = dreimal im Uhrzeigersinn
function rotateCCW(m) {
    return rotateCW(rotateCW(rotateCW(m)));
}

function forEachCell(piece, fn) {
    piece.matrix.forEach((row, r) => {
        row.forEach((v, c) => {
            if (v) fn(r, c);
        });
    });
}

function collides(matrix, px, py) {
    for (let r = 0; r < matrix.length; r++) {
        for (let c = 0; c < matrix[r].length; c++) {
            if (!matrix[r][c]) continue;
            const x = px + c;
            const y = py + r;
            if (x < 0 || x >= COLS || y >= ROWS) return true;
            if (y >= 0 && board[y][x]) return true;
        }
    }
    return false;
}

// Kleiner Helfer für abgerundete Rechtecke (HUD-Panels)
function roundRectPath(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

/* ============================================================
   STEINE ERZEUGEN / BEWEGEN / DREHEN
============================================================ */

function takeFromBag() {
    if (bag.length === 0) {
        bag = [];
        // Beutel füllen: jeder Stein so oft wie sein Gewicht vorsieht
        for (const type of Object.keys(SHAPES)) {
            const weight = SPAWN_WEIGHTS[type] || 1;
            for (let i = 0; i < weight; i++) {
                bag.push(type);
            }
        }
        // Fisher-Yates-Mischung, damit die Reihenfolge zufällig ist
        for (let i = bag.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [bag[i], bag[j]] = [bag[j], bag[i]];
        }
    }
    return bag.pop();
}

function makePiece(type) {
    const matrix = copyMatrix(SHAPES[type]);
    return {
        type,
        matrix,
        rot: 0,
        x: Math.floor((COLS - matrix[0].length) / 2),
        y: 0
    };
}

// Nächsten Stein aus NEXT holen und NEXT neu auffüllen
function pullPiece() {
    const type = nextType;
    nextType = takeFromBag();
    return makePiece(type);
}

function resetDropAndLock() {
    dropTimer = 0;
    lockTimer = 0;
    lockResets = 0;
}

function spawnNext() {
    current = pullPiece();
    resetDropAndLock();
    holdUsed = false;
    if (collides(current.matrix, current.x, current.y)) {
        gameOver();
    }
}

function resetLockIfGrounded() {
    if (!collides(current.matrix, current.x, current.y + 1)) return;
    if (lockResets >= MAX_LOCK_RESETS) return;
    lockTimer = 0;
    lockResets++;
}

// Bewegung; seitliche Moves setzen die Lock-Delay-Uhr zurück
function tryMove(dx, dy) {
    if (collides(current.matrix, current.x + dx, current.y + dy)) return false;
    current.x += dx;
    current.y += dy;
    if (dx !== 0) resetLockIfGrounded();
    return true;
}

function tryRotate(dir) {
    if (current.type === "O") return true; // O sieht in jeder Richtung gleich aus

    const newRot = (current.rot + dir + 4) % 4;
    const newMatrix = dir > 0 ? rotateCW(current.matrix) : rotateCCW(current.matrix);
    const table = current.type === "I" ? KICKS_I : KICKS_JLSTZ;
    const kicks = table[`${current.rot}>${newRot}`] || [[0, 0]];

    // SRS-Versuche: erst ohne Versatz, dann mit den Kick-Versätzen
    for (const [kx, ky] of kicks) {
        if (!collides(newMatrix, current.x + kx, current.y + ky)) {
            current.matrix = newMatrix;
            current.rot = newRot;
            current.x += kx;
            current.y += ky;
            resetLockIfGrounded();
            return true;
        }
    }
    return false;
}

// Zeile, auf der der Stein liegen würde (Ghost-Vorschau)
function ghostRow() {
    let y = current.y;
    while (!collides(current.matrix, current.x, y + 1)) y++;
    return y;
}

function hardDrop() {
    let distance = 0;
    while (tryMove(0, 1)) distance++;
    score += distance * 2; // +2 Punkte pro Zeile
    lockPiece();
}

function hold() {
    if (holdUsed || clearingRows || !current) return;

    const outgoing = current.type;
    if (holdType === null) {
        holdType = outgoing;
        current = pullPiece();
    } else {
        const swap = holdType;
        holdType = outgoing;
        current = makePiece(swap);
    }

    holdUsed = true;
    resetDropAndLock();
    if (collides(current.matrix, current.x, current.y)) gameOver();
}

/* ============================================================
   FIXIEREN, ZEILEN LÖSCHEN, PUNKTE
============================================================ */

function lockPiece() {
    let toppedOut = false;

    forEachCell(current, (r, c) => {
        const y = current.y + r;
        if (y < 0) {
            toppedOut = true; // Stein steckt über dem Feld → Game Over
        } else {
            board[y][current.x + c] = current.type;
        }
    });

    if (toppedOut) {
        gameOver();
        return;
    }

    const full = [];
    for (let r = 0; r < ROWS; r++) {
        if (board[r].every((cell) => cell)) full.push(r);
    }

    if (full.length > 0) {
        clearingRows = full;
        clearTimer = 0;
    } else {
        combo = -1;
        spawnNext();
    }
}

function finishClear() {
    const count = clearingRows.length;

    board = board.filter((row, idx) => !clearingRows.includes(idx));
    while (board.length < ROWS) board.unshift(Array(COLS).fill(null));

    // Punkte: Basis × Level, Back-to-Back-Tetris ×1.5, Combo-Bonus
    combo++;
    let gained = BASE_CLEAR[count] * level;
    let b2bBonus = false;

    if (count === 4) {
        if (backToBack) {
            gained = Math.round(gained * 1.5);
            b2bBonus = true;
        }
        backToBack = true;
    } else {
        backToBack = false;
    }

    if (combo > 0) gained += 50 * combo * level;
    score += gained;

    lines += count;
    // Alle 8 gelöschten Zeilen = ein Level mehr (früher: alle 10)
    level = Math.min(20, Math.floor(lines / 8) + 1);

    toast = {
        text: CLEAR_NAMES[count],
        sub: (b2bBonus ? "BACK-TO-BACK  " : "") + "+" + gained,
        color: count === 4 ? "#ffd500" : "#00eaff",
        startAt: performance.now()
    };

    clearingRows = null;
    spawnNext();
}

function dropInterval() {
    // Fall-Intervall in Millisekunden.
    // Level 1 ≈ 1000 ms, Level 5 ≈ 452 ms, Level 10 ≈ 170 ms, ab Level 15 feste 70 ms-Decke.
    // Je höher das Level, desto kleiner das Intervall → desto schneller fällt der Stein.
    return Math.max(70, Math.round(1000 * Math.pow(0.82, level - 1)));
}

function gameOver() {
    gameState = "over";
    moveDir = 0;
    softHeld = false;

    if (score > bestScore) {
        bestScore = score;
        isNewBest = true;
        saveBest();
    }
}

function togglePause() {
    if (gameState === "over") return;
    gameState = gameState === "pause" ? "run" : "pause";
    moveDir = 0;
    softHeld = false;
    pauseBtn.textContent = gameState === "pause" ? "Weiter" : "Pause";
}

function startGame() {
    board = createBoard();
    bag = [];
    holdType = null;
    holdUsed = false;

    score = 0;
    lines = 0;
    level = 1;
    combo = -1;
    backToBack = false;
    isNewBest = false;

    clearingRows = null;
    clearTimer = 0;
    toast = null;

    moveDir = 0;
    dasTimer = 0;
    arrTimer = 0;
    softHeld = false;

    gameState = "run";
    pauseBtn.textContent = "Pause";

    nextType = takeFromBag();
    spawnNext();
}

/* ============================================================
   UPDATE (pro Frame)
============================================================ */

function handleAutoShift(dt) {
    if (moveDir === 0) return;

    dasTimer += dt;
    if (dasTimer < DAS_MS) return;

    arrTimer += dt;
    while (arrTimer >= ARR_MS) {
        arrTimer -= ARR_MS;
        if (!tryMove(moveDir, 0)) {
            arrTimer = 0;
            break;
        }
    }
}

function update(dt) {
    if (gameState !== "run") return;

    if (clearingRows) {
        clearTimer += dt;
        if (clearTimer >= CLEAR_MS) finishClear();
        return;
    }

    handleAutoShift(dt);

    // Fallen; Soft Drop ist immer die schnellere der zwei Varianten
    const interval = softHeld ? Math.min(SOFT_DROP_MS, dropInterval()) : dropInterval();
    dropTimer += dt;
    while (dropTimer >= interval) {
        dropTimer -= interval;
        if (tryMove(0, 1)) {
            if (softHeld) score += 1; // +1 Punkt pro Soft-Drop-Zeile
        } else {
            dropTimer = 0;
            break;
        }
    }

    // Lock Delay: am Boden liegend nach LOCK_DELAY fixieren
    if (collides(current.matrix, current.x, current.y + 1)) {
        lockTimer += dt;
        if (lockTimer >= LOCK_DELAY) lockPiece();
    } else {
        lockTimer = 0;
    }
}

/* ============================================================
   TASTATUR
============================================================ */

const GAME_KEYS = new Set([
    "ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp",
    "Space", "KeyZ", "KeyX", "KeyC",
    "ShiftLeft", "ShiftRight", "ControlLeft",
    "KeyP", "Escape", "KeyR", "Enter"
]);

function startShift(dir) {
    if (clearingRows || !current) return;
    moveDir = dir;
    dasTimer = 0;
    arrTimer = 0;
    tryMove(dir, 0); // sofortiger erster Schritt
}

document.addEventListener("keydown", (e) => {
    if (GAME_KEYS.has(e.code)) e.preventDefault(); // kein Scrollen etc.
    if (e.repeat) return; // Auto-Repeat machen wir selbst (DAS/ARR)

    if (e.code === "KeyR" || (e.code === "Enter" && gameState === "over")) {
        startGame();
        return;
    }
    if (e.code === "KeyP" || e.code === "Escape") {
        togglePause();
        return;
    }
    if (gameState !== "run" || clearingRows) return;

    switch (e.code) {
        case "ArrowLeft": startShift(-1); break;
        case "ArrowRight": startShift(1); break;
        case "ArrowUp":
        case "KeyX": tryRotate(1); break;
        case "KeyZ":
        case "ControlLeft": tryRotate(-1); break;
        case "ArrowDown": softHeld = true; break;
        case "Space": hardDrop(); break;
        case "KeyC":
        case "ShiftLeft":
        case "ShiftRight": hold(); break;
    }
});

document.addEventListener("keyup", (e) => {
    if (e.code === "ArrowLeft" && moveDir === -1) moveDir = 0;
    if (e.code === "ArrowRight" && moveDir === 1) moveDir = 0;
    if (e.code === "ArrowDown") softHeld = false;
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
        if (gameState !== "run" || clearingRows) return;

        if (action === "left") startShift(-1);
        else if (action === "right") startShift(1);
        else if (action === "rotate") tryRotate(1);
        else if (action === "down") softHeld = true;
        else if (action === "drop") hardDrop();
        else if (action === "hold") hold();
    });

    // Finger/Button losgelassen → Bewegung/Fall stoppen
    const release = () => {
        if (action === "down") softHeld = false;
        if (action === "left" && moveDir === -1) moveDir = 0;
        if (action === "right" && moveDir === 1) moveDir = 0;
    };

    btn.addEventListener("pointerup", release);
    btn.addEventListener("pointercancel", release);
    btn.addEventListener("pointerleave", release);
});

/* ============================================================
   RENDERING: FELD & STEINE
============================================================ */

function drawBlock(px, py, size, color, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha === undefined ? 1 : alpha;

    // Neon-Glow
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.fillStyle = color;
    ctx.fillRect(px + 1, py + 1, size - 2, size - 2);
    ctx.shadowBlur = 0;

    // 3D-Licht: Decke hell, Boden dunkel
    const band = Math.max(2, Math.round(size * 0.18));
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    ctx.fillRect(px + 1, py + 1, size - 2, band);
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.fillRect(px + 1, py + size - 1 - band, size - 2, band);

    // Kante
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 1.5, py + 1.5, size - 3, size - 3);

    ctx.restore();
}

function drawField() {
    // Feldhintergrund
    ctx.fillStyle = "#08080d";
    ctx.fillRect(BOARD_X, BOARD_Y, BOARD_W, BOARD_H);

    // Gitter
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let c = 1; c < COLS; c++) {
        ctx.moveTo(BOARD_X + c * CELL + 0.5, BOARD_Y);
        ctx.lineTo(BOARD_X + c * CELL + 0.5, BOARD_Y + BOARD_H);
    }
    for (let r = 1; r < ROWS; r++) {
        ctx.moveTo(BOARD_X, BOARD_Y + r * CELL + 0.5);
        ctx.lineTo(BOARD_X + BOARD_W, BOARD_Y + r * CELL + 0.5);
    }
    ctx.stroke();

    // Neon-Rahmen wie beim Pong-Feld
    ctx.save();
    ctx.strokeStyle = "#00eaff";
    ctx.shadowColor = "#00eaff";
    ctx.shadowBlur = 18;
    ctx.lineWidth = 2;
    ctx.strokeRect(BOARD_X - 1, BOARD_Y - 1, BOARD_W + 2, BOARD_H + 2);
    ctx.restore();
}

function drawLocked() {
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const type = board[r][c];
            if (!type) continue;
            drawBlock(BOARD_X + c * CELL, BOARD_Y + r * CELL, CELL, COLORS[type]);
        }
    }
}

function drawGhost() {
    const y = ghostRow();
    ctx.save();
    ctx.strokeStyle = COLORS[current.type];
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    forEachCell(current, (r, c) => {
        const gy = y + r;
        if (gy < 0) return;
        ctx.strokeRect(
            BOARD_X + (current.x + c) * CELL + 3,
            BOARD_Y + gy * CELL + 3,
            CELL - 6,
            CELL - 6
        );
    });
    ctx.restore();
}

function drawCurrent() {
    const color = COLORS[current.type];
    forEachCell(current, (r, c) => {
        const y = current.y + r;
        if (y < 0) return; // über dem Feld verstecken
        drawBlock(BOARD_X + (current.x + c) * CELL, BOARD_Y + y * CELL, CELL, color);
    });
}

function drawClearFlash() {
    if (!clearingRows) return;
    const alpha = 0.25 + 0.65 * (clearTimer / CLEAR_MS);
    ctx.save();
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    for (const r of clearingRows) {
        ctx.fillRect(BOARD_X, BOARD_Y + r * CELL, BOARD_W, CELL);
    }
    ctx.restore();
}

/* ============================================================
   RENDERING: HUD, TOAST, OVERLAYS
============================================================ */

// Stein-Vorschau (Hold/Next), auf die gefüllten Zellen zentriert
function drawMiniPiece(type, cx, cy, size) {
    const m = SHAPES[type];
    let minR = 99, maxR = -1, minC = 99, maxC = -1;

    m.forEach((row, r) => row.forEach((v, c) => {
        if (!v) return;
        minR = Math.min(minR, r); maxR = Math.max(maxR, r);
        minC = Math.min(minC, c); maxC = Math.max(maxC, c);
    }));

    const w = (maxC - minC + 1) * size;
    const h = (maxR - minR + 1) * size;
    const ox = cx - w / 2 - minC * size;
    const oy = cy - h / 2 - minR * size;

    m.forEach((row, r) => row.forEach((v, c) => {
        if (v) drawBlock(ox + c * size, oy + r * size, size, COLORS[type]);
    }));
}

function levelColor() {
    if (level >= 15) return "#ff0044";
    if (level >= 10) return "#ff9500";
    if (level >= 5) return "#00ff88";
    return "#00eaff";
}

function hudLabel(text, x, y) {
    ctx.save();
    ctx.font = "bold 13px Arial";
    ctx.fillStyle = "#9fd9e2";
    ctx.textAlign = "left";
    ctx.fillText(text, x, y);
    ctx.restore();
}

function hudValue(text, x, y, size, color, glow) {
    ctx.save();
    ctx.font = "bold " + size + "px Arial";
    ctx.fillStyle = color;
    if (glow) {
        ctx.shadowColor = color;
        ctx.shadowBlur = 12;
    }
    ctx.textAlign = "left";
    ctx.fillText(text, x, y);
    ctx.restore();
}

function drawHudPanel(x, y, w, h) {
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.03)";
    ctx.strokeStyle = "rgba(0,234,255,0.35)";
    ctx.lineWidth = 1.5;
    roundRectPath(x, y, w, h, 8);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
}

function drawHud() {
    // HOLD
    hudLabel("HOLD", HUD_X, 44);
    drawHudPanel(HUD_X, 54, 160, 86);
    if (holdType) {
        ctx.save();
        if (holdUsed) ctx.globalAlpha = 0.35; // schon benutzt → ausgegraut
        drawMiniPiece(holdType, HUD_X + 80, 97, 16);
        ctx.restore();
    }

    // NEXT
    hudLabel("NEXT", HUD_X, 168);
    drawHudPanel(HUD_X, 178, 160, 86);
    if (nextType) drawMiniPiece(nextType, HUD_X + 80, 221, 16);

    // PUNKTE + BESTWERT
    hudLabel("PUNKTE", HUD_X, 306);
    hudValue(String(score).padStart(7, "0"), HUD_X, 336, 26, "#ffffff", true);
    hudLabel("BESTWERT", HUD_X, 364);
    hudValue(String(Math.max(bestScore, score)).padStart(7, "0"), HUD_X, 388, 18, "#ffd500", false);

    // ZEILEN + LEVEL
    hudLabel("ZEILEN", HUD_X, 418);
    hudValue(String(lines).padStart(3, "0"), HUD_X, 442, 18, "#ffffff", false);
    hudLabel("LEVEL", HUD_X, 472);
    hudValue(String(level).padStart(2, "0"), HUD_X, 498, 22, levelColor(), true);

    // Steuerungshilfe
    const help = [
        "← →    Bewegen",
        "↑ / X    Drehen",
        "Z    gegen den Uhrzeigersinn",
        "↓    Soft Drop",
        "Leertaste    Hard Drop",
        "C    Hold",
        "P    Pause · R    Neustart"
    ];
    ctx.save();
    ctx.font = "11px Arial";
    ctx.fillStyle = "#9fd9e2";
    ctx.textAlign = "left";
    help.forEach((line, i) => ctx.fillText(line, HUD_X, 532 + i * 15));
    ctx.restore();
}

// Kurze Einblendung "TETRIS! +800" etc.
function drawToast(now) {
    if (!toast) return;

    const t = (now - toast.startAt) / TOAST_MS;
    if (t >= 1) {
        toast = null;
        return;
    }

    let alpha = 1;
    let scale = 1;
    if (t < 0.12) {
        const k = t / 0.12;
        alpha = k;
        scale = 0.7 + 0.3 * k;
    } else if (t > 0.7) {
        alpha = 1 - (t - 0.7) / 0.3;
    }

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(BOARD_X + BOARD_W / 2, BOARD_Y + BOARD_H * 0.35);
    ctx.scale(scale, scale);
    ctx.textAlign = "center";

    ctx.font = "bold 34px Arial";
    ctx.fillStyle = toast.color;
    ctx.shadowColor = toast.color;
    ctx.shadowBlur = 22;
    ctx.fillText(toast.text, 0, 0);

    ctx.shadowBlur = 0;
    ctx.font = "bold 16px Arial";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(toast.sub, 0, 26);

    ctx.restore();
}

function drawOverlay(title, subtitle, hint, color) {
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.78)";
    ctx.fillRect(BOARD_X, BOARD_Y, BOARD_W, BOARD_H);

    ctx.textAlign = "center";
    const cx = BOARD_X + BOARD_W / 2;
    const cy = BOARD_Y + BOARD_H / 2;

    ctx.font = "bold 40px Arial";
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 28;
    ctx.fillText(title, cx, cy - 30);

    ctx.shadowBlur = 0;
    ctx.font = "bold 20px Arial";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(subtitle, cx, cy + 8);

    ctx.font = "14px Arial";
    ctx.fillStyle = "#9fd9e2";
    ctx.fillText(hint, cx, cy + 40);

    ctx.restore();
}

function draw(now) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Seitenhintergrund (etwas heller als das Spielfeld)
    ctx.fillStyle = "#0d0d12";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawField();
    drawLocked();

    if (current && !clearingRows && gameState !== "over") {
        drawGhost();
        drawCurrent();
    }

    drawClearFlash();
    drawHud();
    drawToast(now);

    if (gameState === "pause") {
        drawOverlay(
            "PAUSE",
            "Level " + level + " · " + score + " Punkte",
            "P = Weiter · R = Neustart",
            "#00eaff"
        );
    } else if (gameState === "over") {
        drawOverlay(
            "GAME OVER",
            isNewBest ? "★ NEUER BESTWERT: " + score : "Punkte: " + score,
            "R / Enter = Neustart",
            "#ff0044"
        );
    }
}

/* ============================================================
   START
============================================================ */

function gameLoop(time) {
    // Zeit-Sprünge deckeln (z.B. nach Tab-Wechsel)
    const dt = Math.min(50, time - lastTime);
    lastTime = time;

    update(dt);
    draw(time);

    requestAnimationFrame(gameLoop);
}

startGame();
requestAnimationFrame(gameLoop);







