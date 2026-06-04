const CONFIG = {
    PLAYER: {
        HEIGHT: 1.7,
        MOVE_SPEED: 2.5,
        SENSITIVITY: 0.0015,
        MAX_PITCH: Math.PI / 2.2,
        BREATH_HOLD_MAX: 6000,
        BREATH_RECOVER_RATE: 0.4,
        BREATH_USE_RATE: 1.0,
    },
    GAME: {
        BULLET_CAM_DURATION: 3500,
        BULLET_CAM_SLOW: 0.08,
        KILL_NOTIFY_DURATION: 2500,
        WIND_UPDATE: 12000,
    },
    LEVEL: {
        SIZE: 2000,
        FOG_NEAR: 200,
        FOG_FAR: 1400,
    },
    WEAPONS: {
        r700: {
            id: 'r700', name: 'Remington M700', type: 'bolt',
            damage: 78, range: 850, stability: 72, fireRate: 35,
            ammo: 5, reloadTime: 2800,
            muzzleVelocity: 900,
            defaultScope: '8x', defaultBarrel: 'none',
            defaultStock: 'standard', defaultUnder: 'none',
            color: 0x4a6741,
        },
        awp: {
            id: 'awp', name: 'L96A1 AWP', type: 'bolt',
            damage: 92, range: 1000, stability: 65, fireRate: 28,
            ammo: 5, reloadTime: 3200,
            muzzleVelocity: 920,
            defaultScope: '12x', defaultBarrel: 'none',
            defaultStock: 'standard', defaultUnder: 'none',
            color: 0x3a3a3a,
        },
        barrett: {
            id: 'barrett', name: 'Barrett M82', type: 'semi',
            damage: 99, range: 1200, stability: 45, fireRate: 72,
            ammo: 10, reloadTime: 3500,
            muzzleVelocity: 853,
            defaultScope: '12x', defaultBarrel: 'none',
            defaultStock: 'standard', defaultUnder: 'bipod',
            color: 0x222222,
        },
        cheytac: {
            id: 'cheytac', name: 'CheyTac M200', type: 'bolt',
            damage: 96, range: 2000, stability: 82, fireRate: 20,
            ammo: 7, reloadTime: 3800,
            muzzleVelocity: 945,
            defaultScope: '20x', defaultBarrel: 'none',
            defaultStock: 'adjustable', defaultUnder: 'bipod',
            color: 0x5c5040,
        },
        tac50: {
            id: 'tac50', name: 'McMillan TAC-50', type: 'bolt',
            damage: 100, range: 2000, stability: 78, fireRate: 18,
            ammo: 5, reloadTime: 4000,
            muzzleVelocity: 945,
            defaultScope: '20x', defaultBarrel: 'none',
            defaultStock: 'adjustable', defaultUnder: 'bipod',
            color: 0x6e5a3a,
        },
    },
    ATTACHMENTS: {
        scopes: {
            '4x':  { name: '4× Scope',  zoom: 4,  stabilityBonus: 0,   rangeBonus: 0 },
            '8x':  { name: '8× Scope',  zoom: 8,  stabilityBonus: 5,   rangeBonus: 50 },
            '12x': { name: '12× Scope', zoom: 12, stabilityBonus: 8,   rangeBonus: 100 },
            '20x': { name: '20× Scope', zoom: 20, stabilityBonus: 10,  rangeBonus: 200 },
        },
        barrels: {
            none:        { name: 'Standard',     rangeBonus: 0,   stabilityBonus: 0,  silent: false },
            suppressor:  { name: 'Schalldämpfer', rangeBonus: -50, stabilityBonus: 5,  silent: true  },
            muzzle:      { name: 'Mündungsbremse', rangeBonus: 30, stabilityBonus: 10, silent: false },
        },
        stocks: {
            standard:   { name: 'Standard',          stabilityBonus: 0  },
            adjustable: { name: 'Verstell-Schaft',    stabilityBonus: 12 },
            monopod:    { name: 'Monopod',            stabilityBonus: 8  },
        },
        underbarrels: {
            none:    { name: 'Keiner',      stabilityBonus: 0  },
            bipod:   { name: 'Zweibein',    stabilityBonus: 18 },
            foregrip:{ name: 'Vordergriff', stabilityBonus: 8  },
        },
    },
    SKINS: [
        { id: 'od_green',  name: 'OD Grün',        color: 0x4a6741 },
        { id: 'desert',    name: 'Wüsten-Tan',      color: 0xc8a87a },
        { id: 'arctic',    name: 'Arktis-Weiß',     color: 0xeeeef0 },
        { id: 'black',     name: 'Jet Black',        color: 0x1a1a1a },
        { id: 'tiger',     name: 'Tiger-Camo',       color: 0x8b6914 },
        { id: 'gold',      name: 'Gold-Plated',      color: 0xd4af37 },
    ],

    // ── Munitionsarten ────────────────────────────────────────────────────
    // tracer  = Farbe der Leuchtspur
    // *Mult   = Multiplikatoren auf Schaden / Mündungsgeschwindigkeit / Wind / Schwerkraft / Streuung
    // pierce  = Anzahl Ziele, die ein Schuss durchschlagen kann
    AMMO: {
        fmj: {
            id: 'fmj', name: 'Vollmantel', short: 'FMJ', tracer: 0xffd27a,
            damageMult: 1.00, velocityMult: 1.00, windMult: 1.00, gravityMult: 1.00, swayMult: 1.00,
            pierce: 1, silent: false, incendiary: false,
            desc: 'Ausgewogene Standardmunition.',
        },
        ap: {
            id: 'ap', name: 'Panzerbrechend', short: 'AP', tracer: 0x66ccff,
            damageMult: 0.92, velocityMult: 1.18, windMult: 0.70, gravityMult: 0.80, swayMult: 1.00,
            pierce: 3, silent: false, incendiary: false,
            desc: 'Flache Flugbahn, durchschlägt bis zu 3 Ziele. Etwas weniger Schaden.',
        },
        hp: {
            id: 'hp', name: 'Hohlspitz', short: 'HP', tracer: 0xff5544,
            damageMult: 1.35, velocityMult: 0.92, windMult: 1.25, gravityMult: 1.15, swayMult: 1.00,
            pierce: 1, silent: false, incendiary: false,
            desc: 'Massiver Schaden, aber stärkerer Abfall und Windabdrift.',
        },
        match: {
            id: 'match', name: 'Subsonisch Match', short: 'SUB', tracer: 0x88ff99,
            damageMult: 0.85, velocityMult: 0.72, windMult: 0.55, gravityMult: 1.40, swayMult: 0.55,
            pierce: 1, silent: true, incendiary: false,
            desc: 'Leise & extrem ruhig. Langsam mit starkem Abfall – ideal für Stealth.',
        },
        incendiary: {
            id: 'incendiary', name: 'Brandmunition', short: 'INC', tracer: 0xff9020,
            damageMult: 1.10, velocityMult: 0.95, windMult: 1.10, gravityMult: 1.05, swayMult: 1.00,
            pierce: 1, silent: false, incendiary: true,
            desc: 'Entzündet getroffene Ziele. Heller Leuchtspur-Effekt.',
        },
    },

    // ── Rang-System ───────────────────────────────────────────────────────
    RANKS: [
        { id: 'recruit',  name: 'Rekrut',                    xp:      0, badge: 'I',       tier: 0 },
        { id: 'private',  name: 'Schütze',                   xp:    400, badge: 'II',      tier: 0 },
        { id: 'corporal', name: 'Gefreiter',                 xp:   1000, badge: 'III',     tier: 0 },
        { id: 'sergeant', name: 'Unteroffizier',             xp:   2200, badge: '◆',       tier: 1 },
        { id: 'ssgt',     name: 'Feldwebel',                 xp:   4500, badge: '◆◆',      tier: 1 },
        { id: 'msgt',     name: 'Oberfeldwebel',             xp:   8000, badge: '◆◆◆',     tier: 1 },
        { id: 'lt',       name: 'Leutnant',                  xp:  13000, badge: '★',       tier: 2 },
        { id: 'lt2',      name: 'Oberleutnant',              xp:  20000, badge: '★★',      tier: 2 },
        { id: 'captain',  name: 'Hauptmann',                 xp:  32000, badge: '★★★',     tier: 2 },
        { id: 'major',    name: 'Major',                     xp:  50000, badge: '✦',       tier: 3 },
        { id: 'ltcol',    name: 'Oberstleutnant',            xp:  75000, badge: '✦✦',      tier: 3 },
        { id: 'colonel',  name: 'Oberst',                    xp: 110000, badge: '✦✦✦',     tier: 3 },
        { id: 'general',  name: 'General',                   xp: 160000, badge: '⬡',       tier: 4 },
        { id: 'legend',   name: 'Scharfschützen-Legende',    xp: 250000, badge: '⬡⬡',      tier: 4 },
    ],

    // XP pro Aktion
    XP: {
        KILL:          10,
        HEADSHOT:      28,
        DIST_100:       5,
        DIST_300:      15,
        DIST_600:      40,
        DIST_900:      90,
        DIST_1000:    150,
        SILENT:        18,
        MISSION_DONE: 220,
        FIRST_CLEAR:  120,   // erste Missionsabschluss-Bonus
    },
};
