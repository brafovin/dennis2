const MISSIONS = [
    {
        id: 'tutorial',
        name: 'Erstes Blut',
        desc: 'Eliminiere ein Ziel auf 100m',
        difficulty: 1,
        unlocked: true,
        objectives: [
            { type: 'kill', count: 1, distance: [0, 150], desc: '1 Ziel eliminieren (50-150m)' }
        ],
        targetLayout: [
            { id: 't1', x: 0, z: -100, type: 'soldier', moving: false, speed: 0, headTarget: false },
            { id: 't2', x: 15, z: -110, type: 'soldier', moving: false, speed: 0, headTarget: false },
            { id: 't3', x: -20, z: -90, type: 'soldier', moving: true,  speed: 1.5, headTarget: false },
        ],
        timeLimit: 0,
        briefing: 'Dein erstes Einsatz. Eliminiere mindestens ein Ziel auf 100 Meter. Nimm dir Zeit und achte auf den Wind.',
        reward: { score: 1000, unlock: 'veteran' },
    },
    {
        id: 'veteran',
        name: 'Der Veteran',
        desc: 'Kopfschuss auf einen Veteranen',
        difficulty: 2,
        unlocked: false,
        objectives: [
            { type: 'headshot', targetType: 'veteran', count: 1, distance: [0, 300], desc: 'Veteran mit Kopfschuss eliminieren' }
        ],
        targetLayout: [
            { id: 'v1', x: 0,   z: -250, type: 'veteran', moving: false, speed: 0,   headTarget: true  },
            { id: 'v2', x: 30,  z: -200, type: 'soldier', moving: true,  speed: 2,   headTarget: false },
            { id: 'v3', x: -30, z: -220, type: 'soldier', moving: true,  speed: 2,   headTarget: false },
            { id: 'v4', x: 10,  z: -280, type: 'soldier', moving: false, speed: 0,   headTarget: false },
        ],
        timeLimit: 0,
        briefing: 'Ein erfahrener Veteran führt eine Patrouille an. Nur ein Kopfschuss gilt als saubere Eliminierung. Er wird von Soldaten eskortiert.',
        reward: { score: 2500, unlock: 'silencer' },
    },
    {
        id: 'silencer',
        name: 'Stille Gefahr',
        desc: 'Eliminiere 2 Ziele unentdeckt mit Schalldämpfer',
        difficulty: 3,
        unlocked: false,
        objectives: [
            { type: 'stealth_kill', count: 2, requireSilent: true, desc: '2 Ziele unentdeckt eliminieren' }
        ],
        targetLayout: [
            { id: 's1', x: -20,  z: -150, type: 'soldier', moving: true,  speed: 2,  headTarget: false, patrolRadius: 20 },
            { id: 's2', x: 20,   z: -200, type: 'soldier', moving: true,  speed: 2,  headTarget: false, patrolRadius: 15 },
            { id: 's3', x: 0,    z: -300, type: 'soldier', moving: false, speed: 0,  headTarget: false },
            { id: 's4', x: -40,  z: -250, type: 'soldier', moving: false, speed: 0,  headTarget: false },
        ],
        timeLimit: 0,
        briefing: 'Lautlosigkeit ist entscheidend. Montiere den Schalldämpfer und eliminiere 2 Wachen, ohne Alarm auszulösen.',
        reward: { score: 3500, unlock: 'longshot' },
    },
    {
        id: 'longshot',
        name: 'Weitschuss',
        desc: 'Ziel auf 500m eliminieren',
        difficulty: 3,
        unlocked: false,
        objectives: [
            { type: 'kill', count: 1, distance: [450, 600], desc: '1 Ziel auf 500m+ eliminieren' }
        ],
        targetLayout: [
            { id: 'l1', x: 0,   z: -500, type: 'soldier', moving: false, speed: 0, headTarget: false },
            { id: 'l2', x: 20,  z: -480, type: 'soldier', moving: true,  speed: 1, headTarget: false },
            { id: 'l3', x: -15, z: -520, type: 'soldier', moving: true,  speed: 1, headTarget: false },
            { id: 'l4', x: 0,   z: -100, type: 'soldier', moving: true,  speed: 2, headTarget: false },
        ],
        timeLimit: 0,
        briefing: 'Dein Ziel befindet sich 500 Meter entfernt. Beachte Wind und Schwerkraft bei einem Schuss auf diese Distanz.',
        reward: { score: 4000, unlock: 'triplekill' },
    },
    {
        id: 'triplekill',
        name: 'Dreifachkill',
        desc: 'Eliminiere 3 Ziele in 30 Sekunden',
        difficulty: 4,
        unlocked: false,
        objectives: [
            { type: 'timed_kill', count: 3, timeLimit: 30, desc: '3 Ziele in 30s eliminieren' }
        ],
        targetLayout: [
            { id: 'tk1', x: -20,  z: -120, type: 'soldier', moving: true,  speed: 3, headTarget: false },
            { id: 'tk2', x: 10,   z: -150, type: 'soldier', moving: true,  speed: 3, headTarget: false },
            { id: 'tk3', x: 30,   z: -100, type: 'soldier', moving: true,  speed: 3, headTarget: false },
            { id: 'tk4', x: -40,  z: -200, type: 'soldier', moving: true,  speed: 2, headTarget: false },
        ],
        timeLimit: 30,
        briefing: 'Keine Zeit zum Zögern. 3 Ziele müssen innerhalb von 30 Sekunden eliminiert werden. Lad nach, wenn nötig.',
        reward: { score: 5000, unlock: 'extreme' },
    },
    {
        id: 'extreme',
        name: 'Extreme Reichweite',
        desc: 'Kill auf 800m',
        difficulty: 5,
        unlocked: false,
        objectives: [
            { type: 'kill', count: 1, distance: [750, 950], desc: 'Ziel auf 800m+ eliminieren' }
        ],
        targetLayout: [
            { id: 'e1', x: 0,   z: -800, type: 'soldier', moving: false, speed: 0, headTarget: false },
            { id: 'e2', x: 15,  z: -820, type: 'soldier', moving: true,  speed: 0.5, headTarget: false },
            { id: 'e3', x: 0,   z: -200, type: 'soldier', moving: true,  speed: 2, headTarget: false },
        ],
        timeLimit: 0,
        briefing: 'Extremer Weitschuss: 800 Meter. Nur mit Barrett M82 oder CheyTac M200 durchführbar. Beobachte Windfahnen.',
        reward: { score: 7000, unlock: 'sniperduel' },
    },
    {
        id: 'sniperduel',
        name: 'Scharfschützen-Duell',
        desc: 'Eliminiere den feindlichen Scharfschützen',
        difficulty: 5,
        unlocked: false,
        objectives: [
            { type: 'kill', targetType: 'sniper', count: 1, distance: [0, 600], desc: 'Feindlichen Scharfschützen eliminieren' }
        ],
        targetLayout: [
            { id: 'sd1', x: 5,   z: -400, type: 'sniper',   moving: false, speed: 0, headTarget: false, isEnemy: true },
            { id: 'sd2', x: -20, z: -200, type: 'soldier',  moving: true,  speed: 2, headTarget: false },
            { id: 'sd3', x: 20,  z: -250, type: 'soldier',  moving: true,  speed: 2, headTarget: false },
        ],
        timeLimit: 0,
        shootBack: true,
        briefing: 'Ein feindlicher Scharfschütze hat Stellung bezogen. Er wird zurückschießen. Bewege dich nicht zu viel und bleib gedeckt.',
        reward: { score: 8000, unlock: 'perfectionist' },
    },
    {
        id: 'perfectionist',
        name: 'Der Perfektionist',
        desc: '3 Kopfschüsse hintereinander',
        difficulty: 5,
        unlocked: false,
        objectives: [
            { type: 'headshot_streak', count: 3, desc: '3 Kopfschüsse nacheinander ohne Fehlschuss' }
        ],
        targetLayout: [
            { id: 'p1', x: 0,   z: -150, type: 'soldier', moving: true,  speed: 2, headTarget: true },
            { id: 'p2', x: 30,  z: -200, type: 'soldier', moving: true,  speed: 2, headTarget: true },
            { id: 'p3', x: -30, z: -180, type: 'soldier', moving: true,  speed: 2, headTarget: true },
            { id: 'p4', x: 10,  z: -130, type: 'soldier', moving: true,  speed: 3, headTarget: true },
        ],
        timeLimit: 0,
        briefing: 'Nur Präzision zählt. 3 Kopfschüsse in Folge ohne Fehlschuss oder Miss. Jeder Fehlschuss setzt den Zähler zurück.',
        reward: { score: 10000, unlock: 'kilometer' },
    },
    {
        id: 'kilometer',
        name: 'Die Tausend Meter',
        desc: 'Kill aus 1000m Entfernung',
        difficulty: 6,
        unlocked: false,
        objectives: [
            { type: 'kill', count: 1, distance: [950, 1100], desc: 'Ziel auf 1000m eliminieren' }
        ],
        targetLayout: [
            { id: 'km1', x: 0,  z: -1000, type: 'veteran', moving: false, speed: 0, headTarget: false },
            { id: 'km2', x: 20, z: -980,  type: 'soldier', moving: false, speed: 0, headTarget: false },
        ],
        timeLimit: 0,
        briefing: 'Das ultimative Ziel: 1 Kilometer. Nur die besten Scharfschützen schaffen diesen Schuss. Wind, Schwerkraft und Atmung müssen perfekt kontrolliert werden.',
        reward: { score: 15000, unlock: null },
    },
];

function getMission(id) {
    return MISSIONS.find(m => m.id === id);
}

function unlockMission(id) {
    const m = getMission(id);
    if (m) m.unlocked = true;
}
