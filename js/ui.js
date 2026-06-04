class UIManager {
    constructor() {
        this.scopeCtx = null;
        this.scopeCanvas = null;
        this.killTimer = null;
        this.sniperWarnTimer = null;
        this.selectedWeaponId = 'r700';
    }

    init() {
        this.bindMenuButtons();
        this.populateWeaponList();
        this.populateMissionList();
        this.populateAttachments('r700');
        this.populateSkins('r700');
        this.updateWeaponStats('r700');

        document.getElementById('loading-progress').style.width = '100%';
        setTimeout(() => {
            document.getElementById('loading-screen').style.display = 'none';
            document.getElementById('main-menu').classList.remove('hidden');
        }, 800);

        game.init();
    }

    bindMenuButtons() {
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
                this.populateSkins(id);
                this.updateWeaponStats(id);
            });
            container.appendChild(div);
        }
    }

    updateWeaponStats(weaponId) {
        const stats = weaponSystem.getEffectiveStats(weaponId);
        document.getElementById('stat-damage').style.width = stats.damage + '%';
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

    updateAmmo(current, max) {
        document.getElementById('ammo-display').textContent = current + ' / ' + max;
    }

    updateWeaponName(name) {
        document.getElementById('weapon-name-hud').textContent = name;
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

        document.getElementById('mission-result-stats').innerHTML = `
            <div style="margin:20px 0;font-size:1rem;color:#aaa;line-height:2">
                <div>Kills: <span style="color:#fff">${kills}</span></div>
                <div>Kopfschüsse: <span style="color:#ff4444">${headshots}</span></div>
                <div>Punkte: <span style="color:#c8a000;font-size:1.4rem">${score}</span></div>
            </div>
        `;
        el.classList.remove('hidden');
        document.getElementById('hud').classList.add('hidden');
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
