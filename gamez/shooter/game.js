const canvas = document.getElementById("gameCanvas");
const ctx = canvas ? canvas.getContext("2d") : null;

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

const BULLET_VY = -860;       // eigene Schüsse (nach oben)
const EBULLET_VY = 330;       // Gegner-Schüsse
const EBULLET_R = 6;

// Particle system
let particles = [];

function createParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 200,
            vy: (Math.random() - 0.5) * 200,
            life: 0.6 + Math.random() * 0.4,
            tt: 0,
            color: color
        });
    }
}

const INVULN_MS = 1800;       // Unverwundbarkeit nach Treffer
const SPAWN_START = 700;      // Abstand zwischen Gegner-Spawns (ms)
const HUD_H = 64;

const POWERUP_FALL = 130;
// deutlich seltener – vorher 14 % pro Kill, jetzt ~6.5 %
const POWERUP_CHANCE = 0.065;
const POWERUP_MIN_INTERVAL_MS = 3500; // kein Perk-Spam: mindestens 3.5s zwischen Drops

const POWERUP_RAPID_MS = 8000;

const MAX_WEAPON_LEVEL = 5;
const MAX_SATELLITES = 2;
// Chance innerhalb eines Drops (wenn überhaupt ein Perk droppt)
const SATELLITE_CHANCE = 0.07;
const SATELLITE_RAM_DAMAGE_CD = 420; // ms zwischen Ramm-Schaden
const SATELLITE_ORBIT_RADIUS = 62;
const SATELLITE_MISSILE_CD_MIN = 2800;
const SATELLITE_MISSILE_CD_MAX = 4200;
const MISSILE_SPEED = 520;
const MISSILE_HOMING_STRENGTH = 4.2;

const GAME_KEYS = new Set([
    "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown",
    "KeyA", "KeyD", "KeyW", "KeyS",
    "KeyP", "Escape", "KeyR", "Enter"
]);

/* Farben im PlaysGamez-Neon-Look (werden pro Level angepasst) */
let COLOR_PLAYER = "#00eaff";
let COLOR_BULLET = "#00eaff";
let COLOR_EBULLET = "#ff9500";

const ENEMY_TYPES = {
    grunt:   { color: "#00ff88", score: 100, w: 44, h: 44, hp: 2,  armor: 1,  speed: 70 },
    diver:   { color: "#ff0044", score: 150, w: 42, h: 50, hp: 1,  armor: 1,  speed: 110 }, // Rammer
    shooter: { color: "#a200ff", score: 300, w: 56, h: 56, hp: 4,  armor: 2,  speed: 55 },
    swarmer: { color: "#ffaa00", score: 80,  w: 34, h: 34, hp: 1,  armor: 1,  speed: 140 }, // schnell, schwarm
    tanker:  { color: "#ff00aa", score: 500, w: 70, h: 70, hp: 10, armor: 3,  speed: 38 }, // Panzer
    phantom: { color: "#00ffaa", score: 400, w: 48, h: 48, hp: 3,  armor: 1,  speed: 95 }
};

/* Waffendefinitionen – 5 Typen mit eigenen Eigenschaften */
const WEAPON_TYPES = {
    fusion: {
        name: "FUSION",
        color: "#00eaff",
        shotColor: "#00eaff",
        desc: "Schnellfeuer · ab S3 Streuung · ab S5 Abpraller",
        fireMs: 210,
        bulletVy: -860,
        piercing: false,
        spread: 0.0,
        shotSpeed: 150,
        damage: 1
    },
    fire: {
        name: "FEUER",
        color: "#ff3300",
        shotColor: "#ff3300",
        desc: "Hoher Schaden · ab S3 Explosion bei Treffer",
        fireMs: 360,
        bulletVy: -720,
        piercing: false,
        spread: 0.0,
        shotSpeed: 120,
        damage: 2
    },
    laser: {
        name: "LASER",
        color: "#00ff88",
        shotColor: "#00ff88",
        desc: "Durchschlagend · langsames Feuer · hoher Schaden",
        fireMs: 520,
        bulletVy: -1000,
        piercing: true,
        spread: 0.0,
        shotSpeed: 200,
        damage: 2
    },
    plasma: {
        name: "PLASMA",
        color: "#aa00ff",
        shotColor: "#aa00ff",
        desc: "Große Kugeln · ab S3 Streuschuss · langsames Feuer",
        fireMs: 650,
        bulletVy: -600,
        piercing: false,
        spread: 0.15,
        shotSpeed: 100,
        damage: 3
    },
    ion: {
        name: "ION",
        color: "#ffff00",
        shotColor: "#ffff00",
        desc: "Sehr schnell · durchschlagend · geringe Streuung",
        fireMs: 140,
        bulletVy: -1100,
        piercing: true,
        spread: 0.05,
        shotSpeed: 180,
        damage: 1
    }
};

/* Level-Farbpaletten (neonfarben wechseln pro Level) */
const LEVEL_PALETTES = [
    { player: "#00eaff", bullet: "#00eaff", ebullet: "#ff9500", name: "CYAN" },
    { player: "#ff00aa", bullet: "#ff00aa", ebullet: "#00ff88", name: "MAGENTA" },
    { player: "#ffd500", bullet: "#ffd500", ebullet: "#ff3300", name: "GOLD" },
    { player: "#00ff88", bullet: "#00ff88", ebullet: "#a200ff", name: "NEON GREEN" },
    { player: "#a200ff", bullet: "#a200ff", ebullet: "#00eaff", name: "VIOLETT" },
    { player: "#ff6600", bullet: "#ff6600", ebullet: "#ffd500", name: "ORANGE" }
];

/* Formationen: relative Offsets für gegnerische Blöcke */
const FORMATIONS = {
    line: [
        { dx: -60, dy: 0, type: "grunt" },
        { dx: 0, dy: 0, type: "grunt" },
        { dx: 60, dy: 0, type: "grunt" }
    ],
    v: [
        { dx: -50, dy: 20, type: "grunt" },
        { dx: 0, dy: 0, type: "grunt" },
        { dx: 50, dy: 20, type: "grunt" },
        { dx: -30, dy: 45, type: "grunt" },
        { dx: 30, dy: 45, type: "grunt" }
    ],
    block: [
        { dx: -45, dy: -30, type: "grunt" },
        { dx: 0, dy: -30, type: "grunt" },
        { dx: 45, dy: -30, type: "grunt" },
        { dx: -45, dy: 30, type: "grunt" },
        { dx: 0, dy: 30, type: "grunt" },
        { dx: 45, dy: 30, type: "grunt" }
    ],
    diamond: [
        { dx: 0, dy: -40, type: "grunt" },
        { dx: -40, dy: 0, type: "grunt" },
        { dx: 40, dy: 0, type: "grunt" },
        { dx: 0, dy: 40, type: "grunt" }
    ],
    wedge: [
        { dx: -80, dy: -10, type: "grunt" },
        { dx: -40, dy: -10, type: "grunt" },
        { dx: 0, dy: -10, type: "grunt" },
        { dx: 40, dy: -10, type: "grunt" },
        { dx: 80, dy: -10, type: "grunt" }
    ],
    // Level-spezifische Formationen mit stärkeren Gegnern
    elite_v: [
        { dx: -70, dy: 30, type: "diver" },
        { dx: 0, dy: 0, type: "diver" },
        { dx: 70, dy: 30, type: "diver" },
        { dx: -35, dy: 60, type: "shooter" },
        { dx: 35, dy: 60, type: "shooter" }
    ],
    swarm_block: [
        { dx: -40, dy: -20, type: "swarmer" },
        { dx: 0, dy: -20, type: "swarmer" },
        { dx: 40, dy: -20, type: "swarmer" },
        { dx: -40, dy: 20, type: "swarmer" },
        { dx: 0, dy: 20, type: "swarmer" },
        { dx: 40, dy: 20, type: "swarmer" },
        { dx: -20, dy: 0, type: "swarmer" },
        { dx: 20, dy: 0, type: "swarmer" }
    ]
};

const FORMATION_NAMES = Object.keys(FORMATIONS);

/* ============================================================
   SPIELZUSTAND
============================================================ */

let gameState = "run";   // "run" | "pause" | "over"
let score = 0;
let lives = 3;
let wave = 0;
let level = 1;
let wavesPerLevel = 8;
let isNewBest = false;

let px = W / 2;          // Schiff (Mitte)
let py = H - 120;
let invulnMs = 0;
let shield = 0;          // absorbierende Treffer
let fireTimer = 0;
let shakeMs = 0;

let bullets = [];        // eigene Schüsse { x, y, vx, vy, type, level, piercing, bounce, explosive, color }
let eBullets = [];       // Gegner-Schüsse { x, y, vx, vy }
let enemies = [];        // Gegner
let spawnQueue = [];     // noch zu spawnende Typen der Welle
let spawnTimer = 0;
let waveGapMs = 0;       // Pause zwischen den Wellen
let bossGapMs = 0;       // Pause vor Endboss
let powerups = [];       // { kind, x, y }
particles = [];
let stars = [];
let toast = null;        // { text, sub, color, startAt }

/* Waffe: { type: "fusion"|"fire"|"laser"|"plasma"|"ion", level: 1..5 } */
let weapon = { type: "fusion", level: 1 };

/* Endboss am Ende jedes Levels */
let boss = null;         // { x, y, hp, maxHp, phase, t, fireT, pattern }
let bossSpawned = false;

/* Satelliten: { side, angle, radius, orbitSpeed, x, y, fireT, missileT, ramCd } */
let satellites = [];
let missiles = []; // eigene Lenkraketen { x, y, vx, vy, age, life }
let lastPowerupDropAt = 0;

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

/* Wendet die Neon-Farbpalette für ein Level an */
function applyLevelColors(lvl) {
    const pal = LEVEL_PALETTES[(lvl - 1) % LEVEL_PALETTES.length];
    COLOR_PLAYER = pal.player;
    COLOR_BULLET = pal.bullet;
    COLOR_EBULLET = pal.ebullet;
}

/* Gibt die für das aktuelle Level verfügbaren Waffentypen zurück (Fokus 1-2 Typen pro Level) */
function getWeaponPoolForLevel() {
    if (level === 1) return ["fusion"];
    if (level === 2) return ["fusion", "fire"];
    if (level === 3) return ["fusion", "laser"];
    if (level === 4) return ["fire", "laser"];
    return ["fusion", "fire", "laser"];
}

/* ============================================================
   WELLEN & GEGNER
============================================================ */

// Gegnertypen für die kommende Welle – deutlich weniger Spam, gemischt mit Level
function buildWave(n, lvl) {
    const queue = [];
    // Basis: 4-8 Gegner pro Welle, nicht 20+ – fühlt sich sonst wie Spam an
    const base = 4 + Math.floor(lvl * 0.7) + Math.floor(n / 3);
    const grunts = Math.min(8, base);
    for (let i = 0; i < grunts; i++) queue.push("grunt");
    if (n >= 2 || lvl >= 2) {
        const divers = Math.min(3, 1 + Math.floor(lvl / 2));
        for (let i = 0; i < divers; i++) queue.push("diver");
    }
    if (n >= 4 || lvl >= 3) {
        const shooters = Math.min(3, 1 + Math.floor(lvl / 3));
        for (let i = 0; i < shooters; i++) queue.push("shooter");
    }
    if (lvl >= 3) {
        const swarmerCount = Math.min(4, Math.floor((lvl - 2) * 1.2));
        for (let i = 0; i < swarmerCount; i++) queue.push("swarmer");
    }
    if (lvl >= 4) {
        // Phantom taucht ab lvl 4 auf
        const phantomCount = Math.min(2, Math.floor((lvl - 3) / 1.5) + (n % 2));
        for (let i = 0; i < phantomCount - 1; i++) queue.push("phantom");
        if (phantomCount > 0) queue.push("phantom");
    }
    if (lvl >= 5) {
        const tankerCount = Math.min(1, Math.floor(lvl / 5));
        for (let i = 0; i < tankerCount; i++) queue.push("tanker");
    }
    // Queue mischen
    for (let i = queue.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [queue[i], queue[j]] = [queue[j], queue[i]];
    }
    return queue;
}

// Platzhalter: Boss war im Code aufgerufen aber nie definiert -> führte zum Absturz
function spawnBoss(lvl) {
    // TODO: Endboss-Logik implementieren. Vorerst nur Warnung, kein Absturz.
    console.warn("spawnBoss aufgerufen (Level " + lvl + ") – noch nicht implementiert");
}

function startWave() {
    wave++;
    if (wave % wavesPerLevel === 0) {
        level++;
        wavesPerLevel = 6 + Math.floor(rand(0, 5));
        applyLevelColors(level);
        const palName = LEVEL_PALETTES[(level - 1) % LEVEL_PALETTES.length].name;
        toast = {
            text: "LEVEL " + level,
            sub: palName + " NEON \u00b7 Gegner h\u00e4rter",
            color: COLOR_PLAYER,
            startAt: performance.now()
        };
    } else {
        toast = {
            text: "WELLE " + wave,
            sub: "Level " + level + " \u00b7 Halte durch!",
            color: COLOR_PLAYER,
            startAt: performance.now()
        };
    }
    if (wave % wavesPerLevel === 0 && wave > 1 && typeof spawnBoss === "function") {
        spawnBoss(level);
    }
    spawnQueue = buildWave(wave, level);
    spawnTimer = 300;
}
let _enemyId = 1;
function spawnEnemy(type) {
    const def = ENEMY_TYPES[type];
    const baseX = rand(70, W - 70);

    // HP skaliert mit Level – Tanker & Shooter extra zäh
    const hpBonus = Math.floor(level / 2) + Math.floor(wave / 6);
    const baseHp = def.hp + hpBonus + (type === "tanker" ? Math.floor(level / 2) : 0);
    const armor = def.armor || 1;
    const speed = (def.speed || 60) + level * 3 + (type === "diver" || type === "swarmer" ? wave * 2 : 0);

    const e = {
        _id: _enemyId++,
        type,
        x: baseX,
        y: -def.h,
        hp: baseHp,
        maxHp: baseHp,
        armor,
        speed,
        w: def.w,
        h: def.h,
        color: def.color,
        score: def.score,
        t: 0,
        phase: Math.random() * Math.PI * 2,
        baseX,
        fireT: rand(900, 2200),
        targetY: rand(140, 380),
        diving: false,
        vx: 0,
        vy: 0,
        formationId: null,
        formationActive: false,
        fCx: 0, fCy: 0, fDx: 0, fDy: 0,
        dashCd: rand(800, 1800)
    };
    enemies.push(e);
}

// Spawnt eine gegnerische Formation (Block, der zusammenhält)
function spawnFormation(preferredType) {
    const name = FORMATION_NAMES[Math.floor(Math.random() * FORMATION_NAMES.length)];
    const template = FORMATIONS[name];
    const formationId = Math.floor(Math.random() * 1000000);
    const cx = rand(90, W - 90);
    const cy = -120;

    // Gegnertyp für die Formation bestimmen (skaliert mit Level)
    let fType = preferredType;
    if (level >= 4 && Math.random() < 0.3) fType = "shooter";
    else if (level >= 2 && Math.random() < 0.4) fType = "diver";
    else if (level >= 3 && Math.random() < 0.25) fType = "swarmer";

    for (const slot of template) {
        const eType = slot.type || fType;
        const def = ENEMY_TYPES[eType];
        const hpBonus = Math.floor(level / 2) + Math.floor(wave / 7);
        const baseHp = def.hp + hpBonus + (eType === "tanker" ? Math.floor(level/2) : 0);
        const speed = (def.speed || 60) + level * 3;
        const e = {
            _id: _enemyId++,
            type: eType,
            x: cx + slot.dx,
            y: cy + slot.dy,
            hp: baseHp,
            maxHp: baseHp,
            armor: def.armor || 1,
            speed,
            w: def.w,
            h: def.h,
            color: def.color,
            score: def.score,
            t: 0,
            phase: Math.random() * Math.PI * 2,
            baseX: cx + slot.dx,
            fireT: rand(1200, 2500),
            targetY: rand(140, 380),
            diving: false,
            vx: 0,
            vy: 0,
            formationId: formationId,
            formationActive: true,
            fCx: cx,
            fCy: cy,
            fDx: slot.dx,
            fDy: slot.dy,
            dashCd: rand(700, 1600)
        };
        enemies.push(e);
    }
}

// Ein einzelner Gegner-Schuss in Spieler-Richtung (skaliert mit Level)
function enemyFire(e) {
    const dx = px - e.x;
    const dy = py - e.y;
    const len = Math.hypot(dx, dy) || 1;
    const speed = EBULLET_VY + wave * 6 + level * 8;
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
    // Drossel: mind. 3.5s zwischen Drops, sonst deutlich geringere Chance
    const now = performance.now();
    const sinceLast = now - lastPowerupDropAt;
    let chance = POWERUP_CHANCE;
    if (sinceLast < POWERUP_MIN_INTERVAL_MS) chance *= 0.25;
    // zusätzlich nicht zu viele Powerups gleichzeitig auf dem Feld
    if (powerups.length >= 2) chance *= 0.35;
    if (Math.random() > chance) return;

    const r = Math.random();
    let kind;
    if (r < SATELLITE_CHANCE) {
        kind = "satellite";
    } else if (r < 0.42) {
        kind = "shield";
    } else {
        // 70% aus Level-Pool, 30% zufällige andere Waffe -> Entscheidungsmoment wie gewünscht
        let pool;
        if (Math.random() < 0.7) {
            pool = getWeaponPoolForLevel();
        } else {
            pool = Object.keys(WEAPON_TYPES);
        }
        // wenn Pool nur aktuellen Typ enthält und wir schon >L3 sind, trotzdem mal Fremdwaffe anbieten
        if (pool.length === 1 && pool[0] === weapon.type && weapon.level >= 3 && Math.random() < 0.45) {
            const others = Object.keys(WEAPON_TYPES).filter(k => k !== weapon.type);
            pool = [others[Math.floor(Math.random() * others.length)]];
        }
        kind = "weapon:" + pool[Math.floor(Math.random() * pool.length)];
    }

    powerups.push({ kind, x, y });
    lastPowerupDropAt = now;
}

/* ============================================================
   SPIELER: SCHÜSSE, TREFFER, LEBEN
============================================================ */

function playerFire() {
    const w = WEAPON_TYPES[weapon.type];
    const lvl = weapon.level;

    // Anzahl Schüsse je nach Waffenstufe (1 bis 5)
    let shotCount = 1;
    if (lvl >= 2) shotCount = 2;
    if (lvl >= 3) shotCount = 3;
    if (lvl >= 4) shotCount = 4;
    if (lvl >= 5) shotCount = 5;

    // Streuwinkel je nach Stufe (ab Stufe 2) – pro Waffe leicht anders
    let maxSpread = 0.30 + (w.spread || 0);
    if (w.spread) maxSpread = w.spread + 0.18;
    const spreadStep = shotCount > 1 ? maxSpread / (shotCount - 1) : 0;
    const dmg = w.damage + Math.floor((lvl - 1) / 2);

    for (let i = 0; i < shotCount; i++) {
        // angle = 0 -> gerade nach oben (vy negativ). Spread fächert seitlich via sin/cos.
        const angle = shotCount === 1 ? 0 : -maxSpread / 2 + i * spreadStep;
        const vx = Math.sin(angle) * (w.shotSpeed || 150);
        const vy = Math.cos(angle) * w.bulletVy; // w.bulletVy ist negativ -> nach oben

        bullets.push({
            x: px,
            y: py - PLAYER_H / 2 - 4,
            vx,
            vy,
            type: weapon.type,
            level: lvl,
            damage: dmg,
            piercing: w.piercing,
            bounce: weapon.type === "fusion" && lvl >= 5,
            bouncesLeft: 2,
            explosive: weapon.type === "fire" && lvl >= 3,
            color: w.shotColor
        });
    }
}

function spawnSatellite(side) {
    if (satellites.length >= MAX_SATELLITES) return;
    const baseAngle = side === "left" ? -Math.PI * 0.75 : -Math.PI * 0.25;
    const s = {
        side,
        angle: baseAngle,
        radius: SATELLITE_ORBIT_RADIUS + satellites.length * 14,
        orbitSpeed: 1.15 + Math.random() * 0.5, // rad/s
        x: px + Math.cos(baseAngle) * SATELLITE_ORBIT_RADIUS,
        y: py + Math.sin(baseAngle) * SATELLITE_ORBIT_RADIUS,
        offsetX: side === "left" ? -55 : 55, // fallback für ersten Frame
        offsetY: -30,
        fireT: rand(700, 1300),
        missileT: rand(SATELLITE_MISSILE_CD_MIN, SATELLITE_MISSILE_CD_MAX),
        ramCd: 0
    };
    satellites.push(s);
}

function fireMissileFrom(x, y) {
    // Ziel: nächster Gegner, sonst gerade nach oben
    let target = null;
    let best = Infinity;
    for (const e of enemies) {
        const d = Math.hypot(e.x - x, e.y - y);
        if (d < best) { best = d; target = e; }
    }
    let vx = 0, vy = -MISSILE_SPEED;
    if (target) {
        const dx = target.x - x, dy = target.y - y;
        const len = Math.hypot(dx, dy) || 1;
        vx = (dx / len) * MISSILE_SPEED;
        vy = (dy / len) * MISSILE_SPEED;
    }
    missiles.push({ x, y, vx, vy, age: 0, life: 3.2, targetId: target ? target._id : null });
}

function playerHit() {
    if (invulnMs > 0) return;

    if (shield > 0) {
        shield--;
        invulnMs = 900;
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
    if (p.kind === "shield") {
        shield = Math.min(3, shield + 1);
        toast = { text: "SCHILD +1", sub: "absorbiert einen Treffer", color: "#00ff88", startAt: performance.now() };
    } else if (p.kind === "rapid") {
        rapidMs = POWERUP_RAPID_MS;   // Dauerfeuer für 8 Sekunden
        shakeMs = 180;                 // leichtes Flackern
        explosion(p.x, p.y, "#00eaff", 14);
        toast = { text: "DAUERFEUER!", sub: "8 Sekunden", color: "#00eaff", startAt: performance.now() };
    } else if (p.kind === "satellite") {
        // Bevorzugt freie Seite, andernfalls andere Seite
        const hasLeft = satellites.some(s => s.side === "left");
        const hasRight = satellites.some(s => s.side === "right");
        let side = "left";
        if (hasLeft && !hasRight) side = "right";
        else if (!hasLeft && hasRight) side = "left";
        else if (hasLeft && hasRight) { /* beide besetzt, nichts tun */ return; }
        spawnSatellite(side);
        toast = { text: "BEGLEITFLUGZEUG", sub: "Satellit " + (side === "left" ? "links" : "rechts"), color: COLOR_PLAYER, startAt: performance.now() };
    } else if (p.kind.startsWith("weapon:")) {
        const newType = p.kind.split(":")[1];
        const w = WEAPON_TYPES[newType];
        if (weapon.type === newType) {
            // Gleiche Waffe → Stufe erhöhen (max 5)
            weapon.level = Math.min(MAX_WEAPON_LEVEL, weapon.level + 1);
            toast = { text: w.name + " +" + weapon.level, sub: "Waffe ausgebaut (" + weapon.level + "/5)", color: w.color, startAt: performance.now() };
        } else {
            // Andere Waffe → wechseln, Stufe reset auf 1
            weapon = { type: newType, level: 1 };
            toast = { text: w.name + " ERHALTEN", sub: "Neue Waffe: Stufe 1", color: w.color, startAt: performance.now() };
        }
        explosion(p.x, p.y, w.color, 14);
    }
}

function gameOver() {
    gameState = "over";
    targetX = null;
    satellites = [];
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
    level = 1;
    wavesPerLevel = 6 + Math.floor(rand(0, 5)); // 6-10
    isNewBest = false;

    px = W / 2;
    py = H - 120;
    invulnMs = 900;
    shield = 0;
    rapidMs = 0;
    fireTimer = 0;
    shakeMs = 0;

    // Perks zurücksetzen: Waffe FUSION L1, Satelliten, Dauerfeuer
    weapon = { type: "fusion", level: 1 };
    satellites = [];
    missiles = [];
    _enemyId = 1;
    lastPowerupDropAt = 0;
    rapidMs = 0;

    bullets = [];
    eBullets = [];
    enemies = [];
    powerups = [];
    particles = [];
    spawnQueue = [];
    waveGapMs = 600;
    toast = null;

    applyLevelColors(level);

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

    // Auto-Feuer mit Waffen-Feuerrate (höhere Stufe = schneller)
    const w = WEAPON_TYPES[weapon.type];
    let effectiveFireMs = w.fireMs;
    effectiveFireMs = Math.max(80, effectiveFireMs - (weapon.level - 1) * 25);

    fireTimer -= dt * 1000;
    if (fireTimer <= 0) {
        playerFire();
        fireTimer = effectiveFireMs;
    }

    if (invulnMs > 0) invulnMs -= dt * 1000;
    if (shakeMs > 0) shakeMs -= dt * 1000;
}

function updateSatellites(dt) {
    for (const s of satellites) {
        // Orbit um das Spielerschiff – sieht lebendig aus und rammt Gegner in der Nähe
        s.angle += s.orbitSpeed * dt;
        const r = s.radius + Math.sin(performance.now() / 380 + s.angle * 2) * 5;
        s.x = px + Math.cos(s.angle) * r;
        s.y = py + Math.sin(s.angle) * r * 0.72;
        // etwas clamp damit Satellit nicht aus dem Bild fliegt
        s.x = clamp(s.x, 12, W - 12);
        s.y = clamp(s.y, HUD_H + 12, H - 26);

        if (s.ramCd > 0) s.ramCd -= dt * 1000;

        s.fireT -= dt * 1000;
        if (s.fireT <= 0) {
            // Satellit feuert mit leichter Streuung, Schaden skaliert mit Waffenlevel
            const lvl = Math.max(1, weapon.level - 1);
            const w = WEAPON_TYPES[weapon.type];
            const dmg = (w.damage || 1) + Math.floor(lvl / 3);
            const spread = (Math.random() - 0.5) * 0.12;
            bullets.push({
                x: s.x,
                y: s.y - 10,
                vx: Math.sin(spread) * 90,
                vy: Math.cos(spread) * BULLET_VY * 0.85,
                type: weapon.type,
                level: lvl,
                damage: dmg,
                piercing: false,
                bounce: false,
                explosive: false,
                color: COLOR_BULLET
            });
            s.fireT = rand(820, 1600) - lvl * 40;
        }

        // Rakete – stärker, homing, je nach Satelliten-Stufe seltener/häufiger
        s.missileT -= dt * 1000;
        const missileCdScale = Math.max(0.65, 1 - (weapon.level - 1) * 0.07);
        if (s.missileT <= 0 && enemies.length > 0) {
            fireMissileFrom(s.x, s.y);
            s.missileT = rand(SATELLITE_MISSILE_CD_MIN, SATELLITE_MISSILE_CD_MAX) * missileCdScale;
            // leichter Partikeleffekt beim Start
            explosion(s.x, s.y - 6, COLOR_PLAYER, 6);
        }

        // Rammen: Gegner in Orbit-Nähe kriegen Schaden (mit Capped Cooldown)
        if (s.ramCd <= 0) {
            for (const e of enemies) {
                if (e.hp <= 0) continue;
                const d = Math.hypot(e.x - s.x, e.y - s.y);
                const hitR = (e.w + e.h) / 4 + 14;
                if (d < hitR) {
                    const ramDmg = 2 + Math.floor(weapon.level / 2) + (satellites.length > 1 ? 1 : 0);
                    e.hp -= ramDmg;
                    explosion(e.x, e.y, COLOR_PLAYER, 9);
                    // kleiner Rückstoß
                    e.x += Math.sign(e.x - s.x) * 10;
                    s.ramCd = SATELLITE_RAM_DAMAGE_CD;
                    if (e.hp <= 0) {
                        score += e.score;
                        explosion(e.x, e.y, e.color, 18);
                        maybeDropPowerup(e.x, e.y);
                    }
                    break; // nur ein Treffer pro Cd
                }
            }
        }
    }
    // sofort aufräumen wenn Gegner tot (verhindert Geister)
    enemies = enemies.filter(e => e.hp > 0);
}

function updateMissiles(dt) {
    for (const m of missiles) {
        m.age += dt;
        // Homing: nächstes Ziel suchen wenn altes tot
        let target = null;
        if (m.targetId) target = enemies.find(e => e._id === m.targetId && e.hp > 0);
        if (!target) {
            let best = Infinity;
            for (const e of enemies) {
                const d = Math.hypot(e.x - m.x, e.y - m.y);
                if (d < best) { best = d; target = e; }
            }
            if (target) m.targetId = target._id;
        }
        if (target) {
            const dx = target.x - m.x;
            const dy = target.y - m.y;
            const len = Math.hypot(dx, dy) || 1;
            const desiredVx = (dx / len) * MISSILE_SPEED;
            const desiredVy = (dy / len) * MISSILE_SPEED;
            m.vx += (desiredVx - m.vx) * MISSILE_HOMING_STRENGTH * dt;
            m.vy += (desiredVy - m.vy) * MISSILE_HOMING_STRENGTH * dt;
            const sp = Math.hypot(m.vx, m.vy);
            const maxSp = MISSILE_SPEED * 1.18;
            if (sp > maxSp) { m.vx *= maxSp / sp; m.vy *= maxSp / sp; }
        }
        m.x += m.vx * dt;
        m.y += m.vy * dt;
        // Schweif
        if (Math.random() < 0.55) {
            particles.push({
                x: m.x, y: m.y + 4,
                vx: (Math.random() - 0.5) * 30,
                vy: 40 + Math.random() * 40,
                age: 0, life: 0.35,
                color: COLOR_PLAYER,
                size: rand(2, 4)
            });
        }
    }
    missiles = missiles.filter(m => m.age < m.life && m.x > -20 && m.x < W + 20 && m.y > -30 && m.y < H + 30);
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
            const type = spawnQueue.shift();

            if ((wave >= 3 || level >= 2) && Math.random() < 0.35) {
                spawnFormation(type);
            } else {
                spawnEnemy(type);
            }

            spawnTimer = Math.max(280, SPAWN_START - wave * 20 - level * 30);
        }
        return;
    }

    // Welle geschafft → kurze Pause + Bonus
    if (enemies.length === 0) {
        const bonus = 200 * wave * level;
        score += bonus;
        toast = {
            text: "WELLE GESCHAFFT",
            sub: "+" + bonus + " Punkte",
            color: "#ffd500",
            startAt: performance.now()
        };
        waveGapMs = 1600;
    }
}

function updateEnemies(dt) {
    // --- Formationen: Center zieht definierte Pfade über den Bildschirm ---
    const groups = {};
    for (const e of enemies) {
        if (e.formationId != null) {
            if (!groups[e.formationId]) groups[e.formationId] = [];
            groups[e.formationId].push(e);
        }
    }

    for (const fid in groups) {
        const group = groups[fid];
        const leader = group[0];
        if (!leader.formationActive) continue;
        leader.fCy += (72 + level * 10) * dt;
        leader.fCx += Math.sin(leader.t * 0.9) * 44 * dt + Math.cos(leader.fCy * 0.006) * 18 * dt;
        leader.fCx = clamp(leader.fCx, 70, W - 70);
        leader.t = (leader.t || 0) + dt;
        for (const e of group) {
            e.x = leader.fCx + e.fDx + Math.sin(e.t * 1.4 + e.phase) * 6;
            e.y = leader.fCy + e.fDy + Math.cos(e.t * 1.1) * 5;
            e.x = clamp(e.x, e.w / 2, W - e.w / 2);
            e.t += dt;
        }
        if (leader.fCy > 280) {
            for (const e of group) {
                e.formationActive = false;
                e.baseX = e.x;
                e.targetY = e.y;
                e.phase = Math.random() * Math.PI * 2;
            }
        }
    }

    // --- Einzel-KI (nicht in aktiver Formation) ---
    for (const e of enemies) {
        if (e.formationId != null && e.formationActive) continue;

        e.t += dt;
        if (e.dashCd > 0) e.dashCd -= dt * 1000;
        const s = e.speed || 60;

        if (e.type === "grunt") {
            e.y += s * 0.95 * dt;
            e.x = e.baseX + Math.sin(e.t * 1.5 + e.phase) * 72;
            e.x = clamp(e.x, e.w / 2, W - e.w / 2);
            if ((wave >= 3 || level >= 2) && e.y > 50) {
                e.fireT -= dt * 1000;
                if (e.fireT <= 0) {
                    if (Math.random() < 0.55) enemyFire(e);
                    e.fireT = Math.max(650, 1800 - level * 140 - wave * 20);
                }
            }
            if (e.dashCd <= 0 && Math.abs(e.x - px) < 38 && e.y > 110 && e.y < H * 0.62) {
                e.baseX = clamp(e.baseX + Math.sign(e.x - px) * rand(26, 54), 36, W - 36);
                e.dashCd = rand(1200, 1900);
            }
        } else if (e.type === "swarmer") {
            const dx = px - e.x;
            e.x += Math.sign(dx) * Math.min(Math.abs(dx) * 0.9, s * dt * 0.68) + Math.sin(e.t * 3.2 + e.phase) * 18 * dt;
            e.y += s * dt;
            e.x = clamp(e.x, e.w / 2, W - e.w / 2);
            if (!e.diving && Math.abs(e.x - px) < 42 && e.y > 130) { e.diving = true; e.vy = s * 1.85; }
            if (e.diving) { e.y += e.vy * dt; e.vy = Math.min(e.vy + 420 * dt, 540); }
        } else if (e.type === "diver") {
            if (!e.diving) {
                e.y += (s * 0.95) * dt;
                e.x = e.baseX + Math.sin(e.t * 2.1 + e.phase) * 44;
                if (e.y > 95 && Math.abs(e.x - px) < 110) {
                    e.diving = true;
                    const dx = px - e.x;
                    const len = Math.hypot(dx, 320) || 1;
                    e.vx = (dx / len) * (220 + level * 14);
                    e.vy = 420 + wave * 10 + level * 18;
                }
                e.fireT -= dt * 1000;
                if (e.fireT <= 0 && e.y > 80 && Math.random() < 0.32) {
                    enemyFire(e);
                    e.fireT = rand(1100, 1900);
                }
            } else {
                e.x += e.vx * dt;
                e.y += e.vy * dt;
                e.vx += (px - e.x) * 0.55 * dt;
            }
        } else if (e.type === "shooter") {
            if (e.y < e.targetY) {
                e.y += 78 * dt;
            } else {
                e.x += (px - e.x) * 0.18 * dt + Math.sin(e.t * 0.95 + e.phase) * 42 * dt;
                e.x = clamp(e.x, e.w / 2, W - e.w / 2);
                e.y += Math.sin(e.t * 1.05) * 22 * dt;
                e.fireT -= dt * 1000;
                if (e.fireT <= 0) {
                    if (level >= 4 && Math.random() < 0.45) {
                        enemyFire(e);
                        const _e = e;
                        setTimeout(function(){ if (_e.hp > 0) enemyFire(_e); }, 120);
                    } else { enemyFire(e); }
                    e.fireT = Math.max(480, 1750 - wave * 55 - level * 75);
                }
            }
        } else if (e.type === "tanker") {
            e.y += s * dt;
            e.x = e.baseX + Math.sin(e.t * 0.55 + e.phase) * 36;
            e.x = clamp(e.x, e.w / 2, W - e.w / 2);
            e.fireT -= dt * 1000;
            if (e.fireT <= 0 && e.y > 60) {
                for (let k = -1; k <= 1; k++) {
                    const dx = px - e.x + k * 30;
                    const dy = py - e.y;
                    const len = Math.hypot(dx, dy) || 1;
                    const sp = EBULLET_VY + level * 6;
                    eBullets.push({ x: e.x, y: e.y + e.h/2, vx: (dx/len)*sp, vy: (dy/len)*sp });
                }
                e.fireT = rand(1400, 2200);
            }
        } else if (e.type === "phantom") {
            if (e.y < e.targetY) { e.y += s * dt; }
            else {
                e.x = e.baseX + Math.sin(e.t * 1.25 + e.phase) * 92;
                e.x = clamp(e.x, e.w / 2, W - e.w / 2);
                e.fireT -= dt * 1000;
                if (e.fireT <= 0) { enemyFire(e); e.fireT = Math.max(520, 1500 - level * 90); }
                if (e.dashCd <= 0 && Math.random() < 0.014) {
                    e.baseX = clamp(rand(48, W - 48), 36, W - 36);
                    e.dashCd = rand(900, 1500);
                }
            }
        } else {
            e.y += s * 0.9 * dt;
        }
    }

    // Runtergeflogen oder aus dem Bild
    enemies = enemies.filter((e) => e.y < H + e.h + 24 && e.x > -80 && e.x < W + 80);
}

function updateBullets(dt) {
    for (const b of bullets) {
        b.x += (b.vx || 0) * dt;
        b.y += (b.vy || BULLET_VY) * dt;

        // Abpraller an Seitenwänden (Fusion Stufe 5)
        if (b.bounce && b.bouncesLeft > 0) {
            if (b.x <= 0) {
                b.x = 0;
                b.vx = Math.abs(b.vx);
                b.bouncesLeft--;
            } else if (b.x >= W) {
                b.x = W;
                b.vx = -Math.abs(b.vx);
                b.bouncesLeft--;
            }
        }
    }
    bullets = bullets.filter((b) => b.y > -20 && b.x > -40 && b.x < W + 40);

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
    // Eigene Schüsse ↔ Gegner – mit Panzerung (armor verringert Schaden)
    for (const b of bullets) {
        if (b.hit && !b.piercing) continue;

        for (const e of enemies) {
            if (e.hp <= 0) continue;
            if (!overlaps(b.x, b.y, 4, 14, e.x, e.y, e.w, e.h, 6)) continue;

            const raw = (b.damage != null ? b.damage : 1);
            const armor = e.armor || 1;
            // leichter Diminishing-Effekt: hoher Armor reduziert nicht auf 0
            const dmg = Math.max(1, Math.round(raw * (1.6 / (0.6 + armor * 0.55))));
            e.hp -= dmg;
            explosion(b.x, b.y, e.color, 3 + dmg);
            // Treffer-Feedback: kurz aufleuchten
            e.hitFlash = 0.12;

            // Explosiver Treffer (Feuerwaffe ab Stufe 3) → kleiner Area-Schaden
            if (b.explosive && e.hp <= 0) {
                const ex = e.x, ey = e.y;
                explosion(ex, ey, "#ff3300", 14);
                for (const e2 of enemies) {
                    if (e2 === e || e2.hp <= 0) continue;
                    if (Math.hypot(e2.x - ex, e2.y - ey) < 78) {
                        e2.hp = Math.max(0, e2.hp - Math.max(1, Math.round(dmg * 0.6)));
                        explosion(e2.x, e2.y, e2.color, 7);
                        e2.hitFlash = 0.12;
                    }
                }
            }

            if (e.hp <= 0) {
                score += e.score * level;
                explosion(e.x, e.y, e.color, 24);
                maybeDropPowerup(e.x, e.y);
            }

            if (!b.piercing) {
                b.hit = true;
                break;
            }
        }
    }
    bullets = bullets.filter((b) => !b.hit);
    // Raketen ↔ Gegner (3-4 Schaden + kleine Explosion)
    for (const m of missiles) {
        if (m.hit) continue;
        for (const e of enemies) {
            if (e.hp <= 0) continue;
            if (!overlaps(m.x, m.y, 10, 10, e.x, e.y, e.w, e.h, 8)) continue;
            m.hit = true;
            const rDmg = 4 + Math.floor(weapon.level / 2);
            e.hp -= rDmg;
            explosion(m.x, m.y, "#ffd500", 18);
            explosion(e.x, e.y, e.color, 10);
            e.hitFlash = 0.16;
            // Splash
            for (const e2 of enemies) {
                if (e2 === e || e2.hp <= 0) continue;
                if (Math.hypot(e2.x - e.x, e2.y - e.y) < 64) {
                    e2.hp = Math.max(0, e2.hp - 2);
                    e2.hitFlash = 0.12;
                }
            }
            if (e.hp <= 0) { score += e.score * level; explosion(e.x, e.y, e.color, 26); maybeDropPowerup(e.x, e.y); }
            break;
        }
    }
    missiles = missiles.filter(function(m){ return !m.hit; });
    enemies = enemies.filter((e) => e.hp > 0);

    // Gegner-Schüsse ↔ Spieler
    for (const b of eBullets) {
        if (b.hit) continue;
        if (!overlaps(b.x, b.y, EBULLET_R * 2, EBULLET_R * 2, px, py, PLAYER_W, PLAYER_H, 12)) continue;
        b.hit = true;
        createParticles(px, py, '#ff0044', 15);  // Particle effect on player hit
        playerHit();
    }
    eBullets = eBullets.filter((b) => !b.hit);

    // Gegner-Körper ↔ Spieler
    for (const e of enemies) {
        if (overlaps(e.x, e.y, e.w, e.h, px, py, PLAYER_W, PLAYER_H, 14)) {
            e.hp = 0;
            explosion(e.x, e.y, e.color, 18);
            createParticles(e.x, e.y, e.color, 25);  // Particle effect on player collision
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
    updateSatellites(dt);
    updateSpawning(dt);
    updateEnemies(dt);
    updateBullets(dt);
    updateMissiles(dt);
    updatePowerups(dt);
    updateParticles(dt);
    updateStars(dt);
    // hitFlash ausblenden
    for (const e of enemies) if (e.hitFlash > 0) e.hitFlash = Math.max(0, e.hitFlash - dt);
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
    const pal = LEVEL_PALETTES[(level - 1) % LEVEL_PALETTES.length];
    const mid = pal.bullet; // hex #RRGGBB
    const r = parseInt(mid.substr(1, 2), 16);
    const g = parseInt(mid.substr(3, 2), 16);
    const b = parseInt(mid.substr(5, 2), 16);
    const midrgba = `rgba(${r},${g},${b},0.55)`;
    for (const s of stars) {
        ctx.fillStyle = ["rgba(255,255,255,0.35)", midrgba, "rgba(255,255,255,0.9)"][s.layer];
        ctx.fillRect(s.x, s.y, s.r, s.r * 2.2);
    }
}

function drawPlayer() {
    // Unverwundbarkeit → blinken
    if (invulnMs > 0 && Math.floor(invulnMs / 120) % 2 === 0) return;

    const w = WEAPON_TYPES[weapon.type];

    ctx.save();
    ctx.translate(px, py);

    // Antriebsflamme in Waffenfarbe
    const flame = 12 + Math.sin(performance.now() / 60) * 5;
    ctx.fillStyle = w.shotColor;
    ctx.shadowColor = w.shotColor;
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

function drawSatellites() {
    for (const s of satellites) {
        // echte Orbit-Position nutzen (updateSatellites setzt s.x/s.y)
        const sx = (s.x != null ? s.x : px + (s.offsetX || 0));
        const sy = (s.y != null ? s.y : py + (s.offsetY || 0));
        ctx.save();
        ctx.translate(sx, sy);
        // leichter Schweif wenn ramCd aktiv (Cooldown sichtbar)
        ctx.shadowColor = COLOR_PLAYER;
        ctx.shadowBlur = s.ramCd > 0 ? 6 : 12;
        ctx.fillStyle = COLOR_PLAYER;
        ctx.beginPath();
        ctx.moveTo(0, -10);
        ctx.lineTo(6, 10);
        ctx.lineTo(2, 6);
        ctx.lineTo(-2, 6);
        ctx.lineTo(-6, 10);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(-2, 0, 4, 4);
        // kleine Raketen-Indicator wenn bald ready
        if (s.missileT < 500) {
            ctx.fillStyle = "#ffd500";
            ctx.beginPath(); ctx.arc(0, -14, 2.2, 0, Math.PI*2); ctx.fill();
        }
        ctx.restore();
    }
}

function drawMissiles() {
    for (const m of missiles) {
        ctx.save();
        ctx.translate(m.x, m.y);
        const ang = Math.atan2(m.vy, m.vx);
        ctx.rotate(ang + Math.PI/2);
        ctx.shadowColor = "#ffd500";
        ctx.shadowBlur = 10;
        ctx.fillStyle = "#ffd500";
        ctx.beginPath();
        ctx.moveTo(0, -8);
        ctx.lineTo(4, 6);
        ctx.lineTo(0, 9);
        ctx.lineTo(-4, 6);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(-1.5, -2, 3, 6);
        ctx.restore();
    }
}

function drawEnemy(e) {
    ctx.save();
    ctx.translate(e.x, e.y);
    // Hit-Flash überblenden
    const isHit = e.hitFlash > 0;
    ctx.shadowColor = isHit ? "#ffffff" : e.color;
    ctx.shadowBlur = isHit ? 20 : 14;
    ctx.fillStyle = isHit ? "#ffffff" : e.color;
    // HP-Bar für Tanker/Shooter/Phantom (ab >3 HP)
    const needsBar = (e.maxHp || e.hp) >= 4;

    if (e.type === "grunt") {
        ctx.beginPath();
        ctx.moveTo(0, -e.h / 2);
        ctx.lineTo(e.w / 2, 0);
        ctx.lineTo(0, e.h / 2);
        ctx.lineTo(-e.w / 2, 0);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = isHit ? "#ffffff" : "#0a0a0a";
        ctx.fillRect(-11, -4, 7, 7);
        ctx.fillRect(4, -4, 7, 7);
    } else if (e.type === "swarmer") {
        // kleiner schneller Brummer
        ctx.beginPath();
        ctx.moveTo(0, -e.h/2);
        ctx.lineTo(e.w/2, e.h/4);
        ctx.lineTo(0, e.h/2);
        ctx.lineTo(-e.w/2, e.h/4);
        ctx.closePath();
        ctx.fill();
        // Flügel-Strich
        ctx.shadowBlur = 0;
        ctx.strokeStyle = isHit ? "#ffffff" : "#1a1a1a";
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(-11, -3); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(11, -3); ctx.stroke();
    } else if (e.type === "diver") {
        ctx.beginPath();
        ctx.moveTo(-e.w / 2, -e.h / 2);
        ctx.lineTo(e.w / 2, -e.h / 2);
        ctx.lineTo(0, e.h / 2);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(-3, -e.h / 2 + 8, 6, 10);
    } else if (e.type === "tanker") {
        // großer Panzer – doppelter Glow
        ctx.shadowBlur = isHit ? 22 : 18;
        ctx.beginPath();
        ctx.moveTo(-e.w/2 + 8, -e.h/2);
        ctx.lineTo(e.w/2 - 8, -e.h/2);
        ctx.lineTo(e.w/2, -e.h/2 + 12);
        ctx.lineTo(e.w/2, e.h/2 - 8);
        ctx.lineTo(e.w/2 - 8, e.h/2);
        ctx.lineTo(-e.w/2 + 8, e.h/2);
        ctx.lineTo(-e.w/2, e.h/2 - 8);
        ctx.lineTo(-e.w/2, -e.h/2 + 12);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#111"; ctx.fillRect(-16, -6, 32, 12);
        ctx.fillStyle = isHit ? "#ffffff" : "#ffaa00"; ctx.fillRect(-10, -2, 20, 4);
    } else if (e.type === "phantom") {
        // Phantom – Sechseck mit pulsierendem Kern
        ctx.beginPath();
        for (let i=0;i<6;i++){ const a=i*Math.PI/3 - Math.PI/6; const rx=e.w/2, ry=e.h/2; const x=Math.cos(a)*rx, y=Math.sin(a)*ry; if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y); }
        ctx.closePath(); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#0a1a12";
        ctx.beginPath(); ctx.arc(0,2,9,0,Math.PI*2); ctx.fill();
        ctx.fillStyle = isHit ? "#ffffff" : "#00ffaa";
        ctx.beginPath(); ctx.arc(0,2,5+Math.sin(e.t*7)*1.2,0,Math.PI*2); ctx.fill();
    } else {
        // Shooter
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
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#0a0a0a";
        ctx.beginPath();
        ctx.arc(0, 6, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = isHit ? "#ffffff" : "#ffffff";
        ctx.beginPath();
        ctx.arc(0, 6, 4 + Math.sin(e.t * 6) * 1.5, 0, Math.PI * 2);
        ctx.fill();
    }

    // kleine HP-Leiste
    if (needsBar) {
        const w = e.w * 0.85, h = 4;
        const pct = Math.max(0, e.hp / (e.maxHp || e.hp || 1));
        ctx.shadowBlur = 0;
        ctx.fillStyle = "rgba(0,0,0,0.65)";
        ctx.fillRect(-w/2, -e.h/2 - 10, w, h);
        ctx.fillStyle = pct > 0.5 ? "#00ff88" : pct > 0.25 ? "#ffd500" : "#ff0044";
        ctx.fillRect(-w/2, -e.h/2 - 10, w * pct, h);
        ctx.strokeStyle = "rgba(255,255,255,0.18)"; ctx.lineWidth = 1; ctx.strokeRect(-w/2, -e.h/2 - 10, w, h);
    }

    ctx.restore();
}

function drawBullets() {
    ctx.save();
    ctx.shadowBlur = 10;
    // eigene Schüsse (je nach Waffentyp farbig)
    for (const b of bullets) {
        ctx.fillStyle = b.color || COLOR_BULLET;
        ctx.shadowColor = b.color || COLOR_BULLET;
        ctx.fillRect(b.x - 2, b.y - 7, 4, 14);
    }

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
        let color, text;
        if (p.kind === "shield") { color = "#00ff88"; text = "S"; }
        else if (p.kind === "satellite") { color = COLOR_PLAYER; text = "O"; }
        else if (p.kind.startsWith("weapon:")) {
            const wt = WEAPON_TYPES[p.kind.split(":")[1]];
            color = wt.color; text = wt.name[0];
        } else { color = "#ffd500"; text = "?"; }

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
        ctx.font = "bold 13px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(text, 0, 1);
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
    ctx.fillText("WELLE", W / 2 - 90, 22);
    ctx.font = "bold 24px Arial";
    ctx.fillStyle = COLOR_PLAYER;
    ctx.shadowColor = COLOR_PLAYER;
    ctx.shadowBlur = 10;
    ctx.fillText(String(wave).padStart(2, "0"), W / 2 - 90, 48);
    ctx.shadowBlur = 0;

    // LEVEL rechts von Welle
    ctx.textAlign = "center";
    ctx.font = "bold 12px Arial";
    ctx.fillStyle = "#9fd9e2";
    ctx.fillText("LEVEL", W / 2 + 90, 22);
    ctx.font = "bold 24px Arial";
    ctx.fillStyle = COLOR_PLAYER;
    ctx.shadowColor = COLOR_PLAYER;
    ctx.shadowBlur = 10;
    ctx.fillText(String(level).padStart(2, "0"), W / 2 + 90, 48);
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

    // Waffe anzeigen
    const w = WEAPON_TYPES[weapon.type];
    chipX = drawChip(chipX, w.color, w.name + " L" + weapon.level);

    // Satelliten anzeigen
    for (const s of satellites) {
        chipX = drawChip(chipX, COLOR_PLAYER, "SAT " + (s.side === "left" ? "L" : "R"));
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
    drawMissiles();
    if (gameState !== "over") {
        drawPlayer();
        drawSatellites();
    }
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





