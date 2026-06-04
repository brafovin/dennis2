class UIManager {
    constructor() {
        this.scopeCtx = null;
        this.scopeCanvas = null;
        this.killTimer = null;
        this.sniperWarnTimer = null;
        this.selectedWeaponId = 'r700';
    }

    // ── Rang-Hilfsfunktionen ───────────────────────────────────────────────
    _rankData() {
        try { return JSON.parse(localStorage.getItem('sniperRank') || '{}'); } catch(_) { return {}; }
    }

    _rankAt(xp) {
        let idx = 0;
        for (let i = 0; i < CONFIG.RANKS.length; i++) {
            if (xp >= CONFIG.RANKS[i].xp) idx = i; else break;
        }
        return CONFIG.RANKS[idx];
    }

    _rankProgress(xp) {
        const cur  = this._rankAt(xp);
        const idx  = CONFIG.RANKS.indexOf(cur);
        const next = CONFIG.RANKS[idx + 1];
        if (!next) return { pct: 100, curXP: xp - cur.xp, needed: 0, next: null };
        const curXP  = xp - cur.xp;
        const needed = next.xp - cur.xp;
        return { pct: Math.round(curXP / needed * 100), curXP, needed, next };
    }

    updateRankWidget() {
        const d    = this._rankData();
        const xp   = d.totalXP || 0;
        const rank = this._rankAt(xp);
        const prog = this._rankProgress(xp);

        const widget = document.getElementById('rank-widget');
        widget.className = `rank-tier-${rank.tier}`;

        document.getElementById('rank-badge-display').textContent = rank.badge;
        document.getElementById('rank-name-display').textContent  = rank.name;
        document.getElementById('rank-xp-fill').style.width       = prog.pct + '%';
        document.getElementById('rank-xp-fill').style.background  = '';   // let tier class handle it

        if (prog.next) {
            document.getElementById('rank-xp-label').textContent =
                `${xp.toLocaleString()} XP  ·  noch ${(prog.needed - prog.curXP).toLocaleString()} XP bis ${prog.next.name}`;
        } else {
            document.getElementById('rank-xp-label').textContent = `${xp.toLocaleString()} XP · MAX RANG`;
        }
    }

    showRankUp(rank) {
        const overlay = document.getElementById('rankup-overlay');
        overlay.className = `rank-tier-${rank.tier}`;
        overlay.classList.remove('hidden');

        document.getElementById('rankup-badge').textContent = rank.badge;
        document.getElementById('rankup-name').textContent  = rank.name;
        document.getElementById('rankup-sub').textContent   = 'Tippe irgendwo um fortzufahren';

        const close = () => {
            overlay.classList.add('hidden');
            overlay.removeEventListener('click', close);
        };
        setTimeout(() => overlay.addEventListener('click', close), 400);
        setTimeout(() => overlay.classList.add('hidden'), 5000);
    }

    init() {
        this.bindMenuButtons();
        this.populateWeaponList();
        this.populateMissionList();
        this.populateAttachments('r700');
        this.populateAmmo('r700');
        this.populateSkins('r700');
        this.updateWeaponStats('r700');

        document.getElementById('loading-progress').style.width = '100%';
        setTimeout(() => {
            document.getElementById('loading-screen').style.display = 'none';
            document.getElementById('main-menu').classList.remove('hidden');
            this.updateRankWidget();
        }, 800);

        game.init();
    }

    bindMenuButtons() {
        document.getElementById('btn-stats').addEventListener('click', () => {
            document.getElementById('main-menu').classList.add('hidden');
            this.showStatsScreen();
            document.getElementById('stats-screen').classList.remove('hidden');
        });

        document.getElementById('btn-stats-close').addEventListener('click', () => {
            document.getElementById('stats-screen').classList.add('hidden');
            document.getElementById('main-menu').classList.remove('hidden');
        });

        document.getElementById('btn-missions').addEventListener('click', () => {
            document.getElementById('main-menu').classList.add('hidden');
            this.populateMissionList();
            document.getElementById('mission-select').classList.remove('hidden');
        });

        document.getElementById('btn-weapons').addEventListener('click', () => {
            document.getElementById('main-menu').classList.add('hidden');
            document.getElementById('weapon-menu').classList.remove('hidden');
        });

        document.getElementById('btn-settings').addEventListener('click', () => {
            alert('Einstellungen kommen bald!');
        });

        document.getElementById('btn-back-missions').addEventListener('click', () => {
            document.getElementById('mission-select').classList.add('hidden');
            document.getElementById('main-menu').classList.remove('hidden');
        });

        document.getElementById('btn-back-weapons').addEventListener('click', () => {
            document.getElementById('weapon-menu').classList.add('hidden');
            document.getElementById('main-menu').classList.remove('hidden');
        });

        document.getElementById('btn-resume').addEventListener('click', () => {
            document.getElementById('pause-menu').classList.add('hidden');
            game.resume();
        });

        document.getElementById('btn-customize').addEventListener('click', () => {
            document.getElementById('pause-menu').classList.add('hidden');
            document.getElementById('hud').classList.add('hidden');
            document.getElementById('weapon-menu').classList.remove('hidden');
            game.state = 'menu';
        });

        document.getElementById('btn-quit').addEventListener('click', () => {
            document.getElementById('pause-menu').classList.add('hidden');
            document.getElementById('hud').classList.add('hidden');
            document.getElementById('main-menu').classList.remove('hidden');
            game.state = 'menu';
            game.player.isAiming = false;
            document.getElementById('scope-overlay').classList.add('hidden');
        });

        document.getElementById('btn-next-mission').addEventListener('click', () => {
            document.getElementById('mission-complete').classList.add('hidden');
            document.getElementById('hud').classList.add('hidden');
            this.populateMissionList();
            document.getElementById('mission-select').classList.remove('hidden');
        });

        document.getElementById('btn-retry').addEventListener('click', () => {
            document.getElementById('mission-complete').classList.add('hidden');
            game.startMission(game.mission.id);
        });

        document.getElementById('btn-main-menu-complete').addEventListener('click', () => {
            document.getElementById('mission-complete').classList.add('hidden');
            document.getElementById('hud').classList.add('hidden');
            document.getElementById('main-menu').classList.remove('hidden');
            game.state = 'menu';
            this.updateRankWidget();
        });
    }

    populateMissionList() {
        const container = document.getElementById('mission-list');
        container.innerHTML = '';

        for (const m of MISSIONS) {
            const div = document.createElement('div');
            div.className = 'mission-card' + (m.unlocked ? '' : ' locked');

            const stars = '★'.repeat(m.difficulty) + '☆'.repeat(6 - m.difficulty);
            div.innerHTML = `
                <div>
                    <div class="mission-difficulty">${stars}</div>
                    <div class="mission-card-name">${m.name}</div>
                    <div class="mission-card-desc">${m.desc}</div>
                </div>
                <div class="mission-reward">${m.unlocked ? (m.reward?.score || 0) + ' P' : '🔒 GESPERRT'}</div>
            `;

            if (m.unlocked) {
                div.addEventListener('click', () => {
                    this.showBriefing(m);
                });
            }
            container.appendChild(div);
        }
    }

    showBriefing(mission) {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position:fixed;top:0;left:0;width:100%;height:100%;
            background:rgba(0,0,0,0.92);z-index:200;
            display:flex;align-items:center;justify-content:center;
        `;
        overlay.innerHTML = `
            <div style="max-width:600px;width:90%;text-align:center;padding:40px;border:1px solid #c8a000;">
                <div style="color:#c8a000;letter-spacing:0.3em;font-size:0.75rem;margin-bottom:8px;">EINSATZ-BRIEFING</div>
                <h2 style="font-size:1.8rem;margin-bottom:16px;">${mission.name}</h2>
                <p style="color:#aaa;line-height:1.7;margin-bottom:24px;">${mission.briefing}</p>
                <div style="text-align:left;margin-bottom:24px;">
                    <div style="color:#888;font-size:0.75rem;letter-spacing:0.2em;margin-bottom:8px;">ZIELE</div>
                    ${mission.objectives.map(o => `<div style="color:#ddd;margin:4px 0;padding-left:12px;border-left:2px solid #c8a000;">${o.desc}</div>`).join('')}
                </div>
                <div style="display:flex;gap:12px;justify-content:center;">
                    <button id="start-mission-btn" style="padding:12px 32px;background:transparent;border:2px solid #c8a000;color:#c8a000;font-family:monospace;font-size:1rem;letter-spacing:0.2em;cursor:pointer;">EINSATZ STARTEN</button>
                    <button id="cancel-briefing-btn" style="padding:12px 32px;background:transparent;border:2px solid #555;color:#888;font-family:monospace;font-size:1rem;letter-spacing:0.2em;cursor:pointer;">ABBRECHEN</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        overlay.querySelector('#start-mission-btn').addEventListener('click', () => {
            document.body.removeChild(overlay);
            document.getElementById('mission-select').classList.add('hidden');
            game.weaponId = this.selectedWeaponId;
            game.startMission(mission.id);
        });
        overlay.querySelector('#cancel-briefing-btn').addEventListener('click', () => {
            document.body.removeChild(overlay);
        });
    }

    populateWeaponList() {
        const container = document.getElementById('weapon-list');
        container.innerHTML = '';

        for (const id in CONFIG.WEAPONS) {
            const w = CONFIG.WEAPONS[id];
            const div = document.createElement('div');
            div.className = 'weapon-item' + (id === this.selectedWeaponId ? ' active' : '');
            div.textContent = w.name;
            div.addEventListener('click', () => {
                this.selectedWeaponId = id;
                game.weaponId = id;
                document.querySelectorAll('.weapon-item').forEach(el => el.classList.remove('active'));
                div.classList.add('active');
                this.populateAttachments(id);
                this.populateAmmo(id);
                this.populateSkins(id);
                this.updateWeaponStats(id);
            });
            container.appendChild(div);
        }
    }

    updateWeaponStats(weaponId) {
        const stats = weaponSystem.getEffectiveStats(weaponId);
        document.getElementById('stat-damage').style.width = Math.min(100, stats.damage) + '%';
        document.getElementById('stat-range').style.width = Math.min(100, stats.range / 20) + '%';
        document.getElementById('stat-stability').style.width = stats.stability + '%';
        document.getElementById('stat-firerate').style.width = stats.fireRate + '%';
    }

    populateAttachments(weaponId) {
        const loadout = weaponSystem.getLoadout(weaponId);

        const makeButtons = (containerId, attGroup, slot, loadoutKey) => {
            const container = document.getElementById(containerId);
            container.innerHTML = `<div style="color:#666;font-size:0.7rem;letter-spacing:0.2em;width:100%;margin-bottom:4px;">${slot.toUpperCase()}</div>`;
            for (const key in attGroup) {
                const att = attGroup[key];
                const btn = document.createElement('button');
                btn.className = 'attachment-btn' + (loadout[loadoutKey] === key ? ' active' : '');
                btn.textContent = att.name;
                btn.addEventListener('click', () => {
                    weaponSystem.setAttachment(weaponId, loadoutKey, key);
                    container.querySelectorAll('.attachment-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    this.updateWeaponStats(weaponId);
                    if (game.state === 'playing' || game.state === 'paused') {
                        game.buildWeaponVisual();
                    }
                });
                container.appendChild(btn);
            }
        };

        makeButtons('scope-options',      CONFIG.ATTACHMENTS.scopes,         'Zielfernrohr', 'scope');
        makeButtons('barrel-options',     CONFIG.ATTACHMENTS.barrels,        'Lauf',         'barrel');
        makeButtons('stock-options',      CONFIG.ATTACHMENTS.stocks,         'Schaft',       'stock');
        makeButtons('underbarrel-options',CONFIG.ATTACHMENTS.underbarrels,   'Unterlauf',    'under');
    }

    populateSkins(weaponId) {
        const container = document.getElementById('skin-options');
        container.innerHTML = '';
        const loadout = weaponSystem.getLoadout(weaponId);

        for (const skin of CONFIG.SKINS) {
            const btn = document.createElement('div');
            btn.className = 'skin-btn' + (loadout.skinId === skin.id ? ' active' : '');
            btn.style.background = '#' + skin.color.toString(16).padStart(6, '0');
            btn.title = skin.name;
            btn.addEventListener('click', () => {
                weaponSystem.setSkin(weaponId, skin.id);
                container.querySelectorAll('.skin-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                if (game.state === 'playing' || game.state === 'paused') {
                    game.buildWeaponVisual();
                }
            });
            container.appendChild(btn);
        }
    }

    populateAmmo(weaponId) {
        const container = document.getElementById('ammo-options');
        if (!container) return;
        const loadout = weaponSystem.getLoadout(weaponId);
        container.innerHTML = `<div style="color:#666;font-size:0.7rem;letter-spacing:0.2em;width:100%;margin-bottom:4px;">MUNITION</div>`;

        for (const key in CONFIG.AMMO) {
            const a = CONFIG.AMMO[key];
            const hex = '#' + a.tracer.toString(16).padStart(6, '0');
            const btn = document.createElement('button');
            btn.className = 'attachment-btn ammo-btn' + (loadout.ammoType === key ? ' active' : '');
            btn.innerHTML = `<span class="ammo-dot" style="background:${hex};color:${hex}"></span>${a.short} · ${a.name}`;
            btn.title = a.desc;
            btn.addEventListener('click', () => {
                weaponSystem.setAmmo(weaponId, key);
                container.querySelectorAll('.ammo-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.showAmmoDesc(a);
                this.updateWeaponStats(weaponId);
                if (game.state === 'playing' || game.state === 'paused') {
                    this.updateAmmoType(a);
                }
            });
            container.appendChild(btn);
        }
        this.showAmmoDesc(CONFIG.AMMO[loadout.ammoType] || CONFIG.AMMO.fmj);
    }

    showAmmoDesc(a) {
        const el = document.getElementById('ammo-desc');
        if (el && a) el.textContent = a.desc;
    }

    showStatsScreen() {
        // ── Rang-Karte oben ───────────────────────────────────────────────
        const d    = this._rankData();
        const xp   = d.totalXP || 0;
        const rank = this._rankAt(xp);
        const prog = this._rankProgress(xp);

        const tierColor = ['#888', '#c8b060', '#c8a000', '#f0a820', '#ff6600'][rank.tier];

        const xpCats = [
            { lbl: 'Kills',       key: 'killXP',      c: '#aaa'     },
            { lbl: 'Kopfschüsse', key: 'headshotXP',  c: '#ff8888'  },
            { lbl: 'Weitschüsse', key: 'distanceXP',  c: '#88aaff'  },
            { lbl: 'Stealth',     key: 'stealthXP',   c: '#88ffcc'  },
            { lbl: 'Missionen',   key: 'missionXP',   c: '#ffcc44'  },
        ];
        const maxCatXP = Math.max(1, ...xpCats.map(c => d[c.key] || 0));

        const rankCardHtml = `
        <div style="border:1px solid ${tierColor};padding:18px 20px;margin-bottom:20px;display:flex;gap:24px;align-items:flex-start;flex-wrap:wrap">
            <!-- Badge + Name -->
            <div style="text-align:center;min-width:90px">
                <div style="font-size:3rem;color:${tierColor};filter:drop-shadow(0 0 8px ${tierColor}40)">${rank.badge}</div>
                <div style="color:${tierColor};font-size:0.78rem;letter-spacing:0.2em;margin-top:4px">${rank.name}</div>
                <div style="color:#444;font-size:0.66rem;margin-top:2px">${xp.toLocaleString()} XP</div>
            </div>

            <!-- Progress + XP breakdown -->
            <div style="flex:1;min-width:200px">
                <div style="display:flex;justify-content:space-between;font-size:0.7rem;color:#666;margin-bottom:4px">
                    <span>Fortschritt</span>
                    <span>${prog.next ? 'bis ' + prog.next.name : 'MAX RANG'}</span>
                </div>
                <div style="height:5px;background:rgba(255,255,255,0.06);border-radius:2px;margin-bottom:14px;overflow:hidden">
                    <div style="height:100%;width:${prog.pct}%;background:linear-gradient(90deg,${tierColor}88,${tierColor});border-radius:2px"></div>
                </div>
                <div style="color:#444;font-size:0.66rem;letter-spacing:0.15em;margin-bottom:8px">XP-AUFSCHLÜSSELUNG</div>
                ${xpCats.map(cat => {
                    const val = d[cat.key] || 0;
                    const pct = Math.round(val / Math.max(1, xp) * 100);
                    const barW = Math.round(val / maxCatXP * 100);
                    return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;font-size:0.7rem">
                        <span style="width:90px;color:#555;text-align:right">${cat.lbl}</span>
                        <div style="flex:1;height:6px;background:rgba(255,255,255,0.05);border-radius:2px;overflow:hidden">
                            <div style="height:100%;width:${barW}%;background:${cat.c};border-radius:2px"></div>
                        </div>
                        <span style="width:60px;color:${cat.c};text-align:right">${val.toLocaleString()} XP</span>
                    </div>`;
                }).join('')}
            </div>

            <!-- Rang-Tabelle Miniatur -->
            <div style="min-width:160px">
                <div style="color:#333;font-size:0.66rem;letter-spacing:0.2em;margin-bottom:8px">ALLE RÄNGE</div>
                ${CONFIG.RANKS.map(r => {
                    const isCur = r.id === rank.id;
                    const tc    = ['#555','#a09040','#a08000','#d09010','#dd5500'][r.tier];
                    return `<div style="display:flex;gap:8px;align-items:center;margin-bottom:3px;
                                        ${isCur ? 'background:rgba(200,160,0,0.08);padding:1px 4px;margin-left:-4px;' : ''}">
                        <span style="width:28px;text-align:center;color:${tc};font-size:0.85rem">${r.badge}</span>
                        <span style="font-size:0.68rem;color:${isCur ? tierColor : '#333'};${isCur ? 'font-weight:bold' : ''}">${r.name}</span>
                        ${isCur ? '<span style="color:#c8a000;font-size:0.6rem;margin-left:auto">◄</span>' : ''}
                    </div>`;
                }).join('')}
            </div>
        </div>`;

        // Insert rank card (replace if already present)
        const existingCard = document.getElementById('stats-rank-card');
        if (existingCard) existingCard.remove();
        const cardEl = document.createElement('div');
        cardEl.id = 'stats-rank-card';
        cardEl.innerHTML = rankCardHtml;
        document.getElementById('stats-session-label').insertAdjacentElement('afterend', cardEl);

        const kills = game.killLog || [];

        // ── Summary chips ─────────────────────────────────────────────────
        const totalKills = kills.length;
        const headshots  = kills.filter(k => k.zone === 'KOPF').length;
        const bestDist   = kills.length ? Math.max(...kills.map(k => k.dist)) : 0;
        const bestTime   = kills.length ? Math.min(...kills.map(k => k.time)) : 0;
        const avgDist    = kills.length ? kills.reduce((s, k) => s + k.dist, 0) / kills.length : 0;
        const avgTime    = kills.length ? kills.reduce((s, k) => s + k.time, 0) / kills.length : 0;

        document.getElementById('stats-summary').innerHTML = [
            { val: totalKills,                    lbl: 'Kills Session' },
            { val: headshots,                     lbl: 'Kopfschüsse' },
            { val: bestDist  ? bestDist + 'm'  : '—', lbl: 'Weitester Kill' },
            { val: bestTime  ? bestTime + 's'  : '—', lbl: 'Schnellster Kill' },
            { val: avgDist   ? Math.round(avgDist) + 'm' : '—', lbl: 'Ø Entfernung' },
            { val: avgTime   ? avgTime.toFixed(1) + 's' : '—', lbl: 'Ø Zeit bis Kill' },
        ].map(c => `<div class="stat-chip">
            <span class="chip-val">${c.val}</span>
            <span class="chip-lbl">${c.lbl}</span>
        </div>`).join('');

        // ── Distribution bar chart ────────────────────────────────────────
        const ranges = [
            { lbl: '0–100m',    min: 0,   max: 100  },
            { lbl: '100–300m',  min: 100, max: 300  },
            { lbl: '300–600m',  min: 300, max: 600  },
            { lbl: '600–900m',  min: 600, max: 900  },
            { lbl: '900m+',     min: 900, max: 99999 },
        ];
        const buckets = ranges.map(r => ({
            ...r,
            count: kills.filter(k => k.dist >= r.min && k.dist < r.max).length,
        }));
        const maxCount = Math.max(1, ...buckets.map(b => b.count));

        document.getElementById('stats-chart').innerHTML = buckets.map(b => `
            <div class="chart-row">
                <div class="chart-label">${b.lbl}</div>
                <div class="chart-bar-track">
                    <div class="chart-bar-fill" style="width:${Math.round(b.count / maxCount * 100)}%"></div>
                </div>
                <div class="chart-count">${b.count}</div>
            </div>
        `).join('');

        // ── Kill table with average marker ────────────────────────────────
        const sorted = [...kills].sort((a, b) => b.dist - a.dist);   // longest first
        let avgInserted = false;
        let rows = '';

        if (!sorted.length) {
            rows = `<tr><td colspan="7" style="text-align:center;color:#333;padding:24px;">
                Noch keine Kills in dieser Session
            </td></tr>`;
        } else {
            sorted.forEach((k, i) => {
                // Insert average marker before first kill that is BELOW average distance
                if (!avgInserted && k.dist < avgDist) {
                    avgInserted = true;
                    rows += `<tr class="row-avg">
                        <td colspan="3">── Ø DURCHSCHNITT: ${Math.round(avgDist)}m</td>
                        <td>${avgTime.toFixed(1)}s</td>
                        <td>—</td>
                        <td>—</td>
                        <td>—</td>
                    </tr>`;
                }

                const cls = [
                    k.dist >= avgDist    ? 'row-above' : 'row-below',
                    k.zone === 'KOPF'    ? 'row-head'  : '',
                    k.silent             ? 'row-silent' : '',
                ].filter(Boolean).join(' ');

                rows += `<tr class="${cls}">
                    <td>${k.n}</td>
                    <td style="color:#666;font-size:0.73rem">${k.mission}</td>
                    <td><strong>${k.dist}m</strong></td>
                    <td>${k.time}s</td>
                    <td>${k.zone}</td>
                    <td style="font-size:0.73rem">${k.weapon}</td>
                    <td style="color:#c8a000">${k.pts}</td>
                </tr>`;
            });

            // If every kill was above average (avg marker not yet inserted)
            if (!avgInserted) {
                rows += `<tr class="row-avg">
                    <td colspan="3">── Ø DURCHSCHNITT: ${Math.round(avgDist)}m</td>
                    <td>${avgTime.toFixed(1)}s</td>
                    <td>—</td><td>—</td><td>—</td>
                </tr>`;
            }
        }
        document.getElementById('stats-tbody').innerHTML = rows;

        // ── Best mission times (localStorage) ─────────────────────────────
        let best = {};
        try { best = JSON.parse(localStorage.getItem('sniperBest') || '{}'); } catch(_) {}

        document.getElementById('stats-besttimes').innerHTML = MISSIONS.map(m => {
            const rec = best[m.id];
            return `<div class="best-card">
                <div class="best-card-name">${m.name}</div>
                ${rec
                    ? `<div class="best-card-time">${rec.time}s</div>
                       <div class="best-card-sub">Kills: ${rec.kills} · Score: ${rec.score}</div>`
                    : `<div class="best-card-time unset">Noch nicht abgeschlossen</div>`
                }
            </div>`;
        }).join('');
    }

    updateAmmo(current, max) {
        document.getElementById('ammo-display').textContent = current + ' / ' + max;
    }

    updateWeaponName(name) {
        document.getElementById('weapon-name-hud').textContent = name;
    }

    updateAmmoType(ammo) {
        const el = document.getElementById('ammo-type-hud');
        if (!el || !ammo) return;
        el.textContent = ammo.short + ' · ' + ammo.name;
        el.style.color = '#' + ammo.tracer.toString(16).padStart(6, '0');
    }

    flashAmmoType() {
        const el = document.getElementById('ammo-type-hud');
        if (!el) return;
        el.style.transition = 'none';
        el.style.transform = 'scale(1.45)';
        requestAnimationFrame(() => {
            el.style.transition = 'transform 0.3s ease';
            el.style.transform = 'scale(1)';
        });
    }

    showHitMarker(isKill) {
        const hm = document.getElementById('hit-marker');
        if (!hm) return;
        hm.classList.remove('show', 'kill');
        void hm.offsetWidth;   // Animation neu starten
        hm.classList.add('show');
        if (isKill) hm.classList.add('kill');
    }

    updateWind(wind) {
        const speed = Math.round(wind.length() * 10) / 10;
        const angle = Math.atan2(wind.y, wind.x) * 180 / Math.PI;
        const dirs = ['→','↗','↑','↖','←','↙','↓','↘'];
        const dirIdx = Math.round(((angle + 360) % 360) / 45) % 8;
        const dir = dirs[dirIdx];
        document.getElementById('wind-value').textContent = `${dir} ${speed} m/s`;
    }

    updateMissionHUD(mission) {
        document.getElementById('mission-name').textContent = mission.name;
        document.getElementById('mission-objective').textContent = mission.objectives[0]?.desc || '';
        document.getElementById('mission-progress').textContent = '';
    }

    updateMissionProgress(mission, kills) {
        const obj = mission.objectives[0];
        if (!obj) return;
        const needed = obj.count || 1;
        const have   = obj._count || 0;
        document.getElementById('mission-progress').textContent = `${have} / ${needed}`;
    }

    updateMissionTimer(secs) {
        const s = Math.ceil(secs);
        const color = s < 10 ? '#ff4444' : '#ffcc44';
        document.getElementById('mission-progress').style.color = color;
        document.getElementById('mission-progress').textContent = `Zeit: ${s}s`;
    }

    showKillNotification(isHeadshot, dist, pts) {
        clearTimeout(this.killTimer);
        const el = document.getElementById('kill-notification');
        const text = document.getElementById('kill-text');

        let msg = isHeadshot ? 'KOPFSCHUSS!' : 'ELIMINIERT!';
        if (dist > 800) msg = 'EXTREME REICHWEITE!\n' + msg;
        else if (dist > 500) msg = 'WEITSCHUSS!\n' + msg;

        text.innerHTML = `<div style="color:${isHeadshot?'#ff4444':'#ffcc00'};font-size:${isHeadshot?'2.2':'1.8'}rem">${msg.replace('\n','<br>')}</div>
                          <div style="font-size:1rem;color:#aaa;margin-top:4px;">${dist}m · +${pts}</div>`;
        el.classList.remove('hidden');

        // Flash
        const flash = document.createElement('div');
        flash.className = 'impact-flash';
        document.body.appendChild(flash);
        setTimeout(() => document.body.removeChild(flash), 400);

        this.killTimer = setTimeout(() => el.classList.add('hidden'), CONFIG.GAME.KILL_NOTIFY_DURATION);
    }

    showSniperWarning() {
        clearTimeout(this.sniperWarnTimer);
        const existing = document.getElementById('sniper-warning');
        if (existing) document.body.removeChild(existing);

        const div = document.createElement('div');
        div.id = 'sniper-warning';
        div.style.cssText = `
            position:fixed;top:35%;left:50%;transform:translateX(-50%);
            color:#ff4444;font-size:1.3rem;letter-spacing:0.2em;
            text-shadow:0 0 15px rgba(255,68,68,0.9);
            pointer-events:none;z-index:80;
            animation:blink 0.4s infinite;
        `;
        div.textContent = '⚠ EINGEHENDER BESCHUSS ⚠';
        document.body.appendChild(div);
        this.sniperWarnTimer = setTimeout(() => {
            if (div.parentNode) div.parentNode.removeChild(div);
        }, 2500);
    }

    showMissionComplete(mission, score, kills, headshots) {
        const el = document.getElementById('mission-complete');
        document.getElementById('mission-result-title').textContent = 'MISSION ERFÜLLT';
        document.getElementById('mission-result-title').style.color = '#c8a000';

        // XP breakdown
        const xpBreak = game.sessionXPBreak;
        const totalSessionXP = game.sessionXP;
        const d = this._rankData();
        const xpBefore = (d.totalXP || 0) - totalSessionXP;
        const xpAfter  = d.totalXP || 0;
        const rankBefore = this._rankAt(xpBefore);
        const rankAfter  = this._rankAt(xpAfter);
        const progAfter  = this._rankProgress(xpAfter);

        const xpRows = [
            { lbl: 'Kills',        val: xpBreak.killXP     || 0, col: '#aaa' },
            { lbl: 'Kopfschüsse',  val: xpBreak.headshotXP || 0, col: '#ff8888' },
            { lbl: 'Weitschüsse',  val: xpBreak.distanceXP || 0, col: '#88aaff' },
            { lbl: 'Stealth',      val: xpBreak.stealthXP  || 0, col: '#88ffcc' },
            { lbl: 'Mission',      val: xpBreak.missionXP  || 0, col: '#ffcc44' },
        ].filter(r => r.val > 0)
         .map(r => `<div style="display:flex;justify-content:space-between;color:${r.col};margin:2px 0">
                        <span>${r.lbl}</span><span>+${r.val} XP</span>
                    </div>`).join('');

        const rankUpHtml = rankAfter.id !== rankBefore.id
            ? `<div style="margin-top:10px;padding:8px 14px;border:1px solid ${['#888','#c8b060','#c8a000','#f0a820','#ff6600'][rankAfter.tier]};
                           color:${['#888','#c8b060','#c8a000','#f0a820','#ff6600'][rankAfter.tier]};font-size:0.85rem;letter-spacing:0.2em;">
                   ↑ BEFÖRDERUNG: ${rankAfter.badge} ${rankAfter.name}
               </div>`
            : '';

        document.getElementById('mission-result-stats').innerHTML = `
            <div style="margin:16px 0;display:flex;gap:24px;justify-content:center;flex-wrap:wrap">
                <div style="text-align:center">
                    <div style="color:#fff;font-size:1.6rem;font-weight:bold">${kills}</div>
                    <div style="color:#666;font-size:0.7rem;letter-spacing:0.15em">KILLS</div>
                </div>
                <div style="text-align:center">
                    <div style="color:#ff6666;font-size:1.6rem;font-weight:bold">${headshots}</div>
                    <div style="color:#666;font-size:0.7rem;letter-spacing:0.15em">KOPFSCHÜSSE</div>
                </div>
                <div style="text-align:center">
                    <div style="color:#c8a000;font-size:1.6rem;font-weight:bold">${score}</div>
                    <div style="color:#666;font-size:0.7rem;letter-spacing:0.15em">PUNKTE</div>
                </div>
            </div>

            <!-- XP earned -->
            <div style="border:1px solid #222;padding:12px 16px;margin:12px 0;text-align:left">
                <div style="color:#555;font-size:0.68rem;letter-spacing:0.25em;margin-bottom:8px">XP VERDIENT</div>
                ${xpRows}
                <div style="border-top:1px solid #222;margin-top:6px;padding-top:6px;
                            display:flex;justify-content:space-between;color:#c8a000;font-weight:bold">
                    <span>GESAMT</span><span>+${totalSessionXP} XP</span>
                </div>
            </div>

            <!-- Rank progress bar -->
            <div style="text-align:left">
                <div style="display:flex;justify-content:space-between;font-size:0.72rem;
                            color:${['#888','#c8b060','#c8a000','#f0a820','#ff6600'][rankAfter.tier]};margin-bottom:4px">
                    <span>${rankAfter.badge} ${rankAfter.name}</span>
                    <span>${progAfter.next ? progAfter.next.name + ' in ' + (progAfter.needed - progAfter.curXP).toLocaleString() + ' XP' : 'MAX RANG'}</span>
                </div>
                <div style="height:5px;background:rgba(255,255,255,0.06);border-radius:2px;overflow:hidden">
                    <div style="height:100%;width:${progAfter.pct}%;background:linear-gradient(90deg,#8a6800,#c8a000);
                                border-radius:2px;transition:width 1s"></div>
                </div>
                ${rankUpHtml}
            </div>
        `;

        el.classList.remove('hidden');
        document.getElementById('hud').classList.add('hidden');
        this.updateRankWidget();
    }

    showMissionFailed(reason) {
        const el = document.getElementById('mission-complete');
        document.getElementById('mission-result-title').textContent = 'MISSION GESCHEITERT';
        document.getElementById('mission-result-title').style.color = '#ff4444';
        document.getElementById('mission-result-stats').innerHTML = `
            <div style="margin:20px 0;color:#888">${reason}</div>
        `;
        el.classList.remove('hidden');
        document.getElementById('hud').classList.add('hidden');
    }
}

const uiManager = new UIManager();

window.addEventListener('DOMContentLoaded', () => {
    uiManager.init();
});
