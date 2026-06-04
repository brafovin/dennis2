class WeaponSystem {
    constructor() {
        this.selectedWeaponId = 'r700';
        this.loadouts = {};
        this.initLoadouts();
    }

    initLoadouts() {
        for (const id in CONFIG.WEAPONS) {
            const w = CONFIG.WEAPONS[id];
            this.loadouts[id] = {
                scope:    w.defaultScope,
                barrel:   w.defaultBarrel,
                stock:    w.defaultStock,
                under:    w.defaultUnder,
                skinId:   'od_green',
                ammoType: 'fmj',
                ammoLeft: w.ammo,
            };
        }
    }

    getWeapon(id) {
        return CONFIG.WEAPONS[id];
    }

    getLoadout(id) {
        return this.loadouts[id];
    }

    setAttachment(weaponId, slot, value) {
        if (this.loadouts[weaponId]) {
            this.loadouts[weaponId][slot] = value;
        }
    }

    setSkin(weaponId, skinId) {
        if (this.loadouts[weaponId]) {
            this.loadouts[weaponId].skinId = skinId;
        }
    }

    setAmmo(weaponId, ammoId) {
        if (this.loadouts[weaponId] && CONFIG.AMMO[ammoId]) {
            this.loadouts[weaponId].ammoType = ammoId;
        }
    }

    getAmmo(weaponId) {
        const lo = this.loadouts[weaponId];
        return (lo && CONFIG.AMMO[lo.ammoType]) || CONFIG.AMMO.fmj;
    }

    getEffectiveStats(weaponId) {
        const base = CONFIG.WEAPONS[weaponId];
        const loadout = this.loadouts[weaponId];
        const att = CONFIG.ATTACHMENTS;

        const scopeData  = att.scopes[loadout.scope]       || att.scopes['8x'];
        const barrelData = att.barrels[loadout.barrel]      || att.barrels['none'];
        const stockData  = att.stocks[loadout.stock]        || att.stocks['standard'];
        const underData  = att.underbarrels[loadout.under]  || att.underbarrels['none'];
        const ammoData   = CONFIG.AMMO[loadout.ammoType]    || CONFIG.AMMO.fmj;

        return {
            damage:    Math.round(base.damage * ammoData.damageMult),
            range:     base.range + barrelData.rangeBonus + scopeData.rangeBonus,
            stability: Math.min(100, base.stability + barrelData.stabilityBonus + stockData.stabilityBonus + underData.stabilityBonus),
            fireRate:  base.fireRate,
            ammo:      base.ammo,
            reloadTime: base.reloadTime,
            muzzleVelocity: base.muzzleVelocity * ammoData.velocityMult,
            zoom:      scopeData.zoom,
            silent:    barrelData.silent || ammoData.silent,
            type:      base.type,
            // ── Ammo-abhängige Werte ──
            ammoId:      ammoData.id,
            ammoName:    ammoData.name,
            ammoShort:   ammoData.short,
            tracerColor: ammoData.tracer,
            windMult:    ammoData.windMult,
            gravityMult: ammoData.gravityMult,
            swayMult:    ammoData.swayMult,
            pierce:      ammoData.pierce,
            incendiary:  ammoData.incendiary,
        };
    }

    getSkinColor(weaponId) {
        const loadout = this.loadouts[weaponId];
        const skin = CONFIG.SKINS.find(s => s.id === loadout.skinId);
        return skin ? skin.color : 0x4a6741;
    }

    buildWeaponMesh(weaponId, THREE) {
        const loadout = this.loadouts[weaponId];
        const skinColor = this.getSkinColor(weaponId);
        const group = new THREE.Group();

        // ── Materials (PBR) ────────────────────────────────────────────────
        const stockMat   = new THREE.MeshStandardMaterial({ color: skinColor,  metalness: 0.06, roughness: 0.72 });
        const metalDark  = new THREE.MeshStandardMaterial({ color: 0x1e1e1e,   metalness: 0.90, roughness: 0.28 });
        const metalMid   = new THREE.MeshStandardMaterial({ color: 0x2e2e2e,   metalness: 0.88, roughness: 0.32 });
        const metalSilv  = new THREE.MeshStandardMaterial({ color: 0x787878,   metalness: 0.95, roughness: 0.18 });
        const scopeMat   = new THREE.MeshStandardMaterial({ color: 0x0e0e0e,   metalness: 0.85, roughness: 0.22 });
        const lensMat    = new THREE.MeshStandardMaterial({ color: 0x1a2a3a,   metalness: 0.40, roughness: 0.05, transparent: true, opacity: 0.88 });
        const rubberMat  = new THREE.MeshStandardMaterial({ color: 0x141414,   metalness: 0.00, roughness: 0.92 });

        // ── Barrel ─────────────────────────────────────────────────────────
        const bLen = (weaponId === 'barrett' || weaponId === 'cheytac' || weaponId === 'tac50') ? 0.80 : 0.65;
        const bZ   = -(0.04 + bLen / 2);

        // Main barrel cylinder (tapered)
        const barrelGeo = new THREE.CylinderGeometry(0.010, 0.013, bLen, 14);
        const barrel = new THREE.Mesh(barrelGeo, metalDark);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0.008, 0.004, bZ);
        barrel.castShadow = true;
        group.add(barrel);

        // Fluted / stepped section near muzzle
        const stepGeo = new THREE.CylinderGeometry(0.013, 0.013, bLen * 0.18, 14);
        const step = new THREE.Mesh(stepGeo, metalMid);
        step.rotation.x = Math.PI / 2;
        step.position.set(0.008, 0.004, -(0.04 + bLen * 0.09));
        group.add(step);

        // ── Receiver / action ──────────────────────────────────────────────
        const recGeo = new THREE.BoxGeometry(0.048, 0.048, 0.30);
        const receiver = new THREE.Mesh(recGeo, metalDark);
        receiver.position.set(0, 0.004, -0.015);
        receiver.castShadow = true;
        group.add(receiver);

        // Receiver side panels (lighter shade creates visual depth)
        const sidePanelGeo = new THREE.BoxGeometry(0.055, 0.036, 0.26);
        const sidePanel = new THREE.Mesh(sidePanelGeo, metalMid);
        sidePanel.position.set(0, 0.000, -0.015);
        group.add(sidePanel);

        // Top rail (Picatinny)
        const railGeo = new THREE.BoxGeometry(0.022, 0.010, 0.28);
        const rail = new THREE.Mesh(railGeo, metalSilv);
        rail.position.set(0, 0.030, -0.015);
        group.add(rail);
        // Rail serrations (visual)
        for (let i = 0; i < 5; i++) {
            const notchGeo = new THREE.BoxGeometry(0.024, 0.003, 0.004);
            const notch = new THREE.Mesh(notchGeo, metalDark);
            notch.position.set(0, 0.030, -0.10 + i * 0.045);
            group.add(notch);
        }

        // Bolt handle (right side)
        const boltArmGeo = new THREE.CylinderGeometry(0.0045, 0.0045, 0.035, 7);
        const boltArm = new THREE.Mesh(boltArmGeo, metalSilv);
        boltArm.rotation.z = Math.PI / 2;
        boltArm.position.set(-0.042, 0.004, 0.030);
        group.add(boltArm);
        const boltKnobGeo = new THREE.SphereGeometry(0.010, 10, 10);
        const boltKnob = new THREE.Mesh(boltKnobGeo, metalSilv);
        boltKnob.position.set(-0.060, 0.004, 0.030);
        group.add(boltKnob);

        // Ejection port (dark recess)
        const portGeo = new THREE.BoxGeometry(0.006, 0.022, 0.055);
        const port = new THREE.Mesh(portGeo, new THREE.MeshStandardMaterial({ color: 0x080808, roughness: 0.9 }));
        port.position.set(-0.028, 0.004, 0.005);
        group.add(port);

        // ── Scope ──────────────────────────────────────────────────────────
        const sLen = scopeDataLen(loadout.scope);
        const sY   = 0.072;
        const sZ   = -0.02;

        // Main scope tube
        const tubeGeo = new THREE.CylinderGeometry(0.019, 0.019, sLen, 16);
        const scopeTube = new THREE.Mesh(tubeGeo, scopeMat);
        scopeTube.rotation.x = Math.PI / 2;
        scopeTube.position.set(0, sY, sZ);
        group.add(scopeTube);

        // Objective bell (tapered, wider at front)
        const objBellGeo = new THREE.CylinderGeometry(0.025, 0.019, 0.052, 16);
        const objBell = new THREE.Mesh(objBellGeo, scopeMat);
        objBell.rotation.x = Math.PI / 2;
        objBell.position.set(0, sY, sZ - sLen / 2 - 0.026);
        group.add(objBell);

        // Objective lens cap + glass
        const objCapGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.008, 16);
        const objCap = new THREE.Mesh(objCapGeo, metalDark);
        objCap.rotation.x = Math.PI / 2;
        objCap.position.set(0, sY, sZ - sLen / 2 - 0.054);
        group.add(objCap);
        const objGlassGeo = new THREE.CircleGeometry(0.022, 16);
        const objGlass = new THREE.Mesh(objGlassGeo, lensMat);
        objGlass.rotation.y = Math.PI / 2;
        objGlass.position.set(-0.001, sY, sZ - sLen / 2 - 0.059);
        group.add(objGlass);

        // Eyepiece (wider than tube)
        const eyeGeo = new THREE.CylinderGeometry(0.022, 0.019, 0.038, 16);
        const eyepiece = new THREE.Mesh(eyeGeo, scopeMat);
        eyepiece.rotation.x = Math.PI / 2;
        eyepiece.position.set(0, sY, sZ + sLen / 2 + 0.019);
        group.add(eyepiece);
        const eyeRimGeo = new THREE.CylinderGeometry(0.024, 0.022, 0.010, 16);
        const eyeRim = new THREE.Mesh(eyeRimGeo, rubberMat);
        eyeRim.rotation.x = Math.PI / 2;
        eyeRim.position.set(0, sY, sZ + sLen / 2 + 0.042);
        group.add(eyeRim);

        // Elevation turret (top center)
        const elevBodyGeo = new THREE.CylinderGeometry(0.0075, 0.0075, 0.026, 10);
        const elevBody = new THREE.Mesh(elevBodyGeo, metalSilv);
        elevBody.position.set(0, sY + 0.027, sZ);
        group.add(elevBody);
        const elevCapGeo = new THREE.CylinderGeometry(0.0065, 0.0075, 0.008, 10);
        const elevCap = new THREE.Mesh(elevCapGeo, rubberMat);
        elevCap.position.set(0, sY + 0.043, sZ);
        group.add(elevCap);

        // Windage turret (side)
        const windBodyGeo = new THREE.CylinderGeometry(0.0075, 0.0075, 0.026, 10);
        const windBody = new THREE.Mesh(windBodyGeo, metalSilv);
        windBody.rotation.z = Math.PI / 2;
        windBody.position.set(-0.027, sY, sZ);
        group.add(windBody);

        // Scope rings (silver, clearly visible)
        const ringOffsets = [-sLen * 0.30, sLen * 0.30];
        for (const rz of ringOffsets) {
            // Ring body (torus)
            const ringGeo = new THREE.TorusGeometry(0.022, 0.0065, 8, 16);
            const ring = new THREE.Mesh(ringGeo, metalSilv);
            ring.rotation.y = Math.PI / 2;
            ring.position.set(0, sY, sZ + rz);
            group.add(ring);
            // Ring base (connects to rail)
            const rBaseGeo = new THREE.BoxGeometry(0.016, 0.020, 0.020);
            const rBase = new THREE.Mesh(rBaseGeo, metalSilv);
            rBase.position.set(0, sY - 0.028, sZ + rz);
            group.add(rBase);
            // Ring bolt
            const boltGeo = new THREE.CylinderGeometry(0.003, 0.003, 0.012, 6);
            const rbolt = new THREE.Mesh(boltGeo, metalDark);
            rbolt.position.set(-0.013, sY - 0.019, sZ + rz);
            group.add(rbolt);
        }

        // ── Stock ──────────────────────────────────────────────────────────
        const stLen = loadout.stock === 'adjustable' ? 0.29 : 0.25;

        // Main stock body
        const stGeo = new THREE.BoxGeometry(0.038, 0.042, stLen);
        const stockMesh = new THREE.Mesh(stGeo, stockMat);
        stockMesh.position.set(0, -0.002, 0.135 + stLen / 2);
        stockMesh.castShadow = true;
        group.add(stockMesh);

        // Cheekpiece (raised)
        const cpGeo = new THREE.BoxGeometry(0.034, 0.034, 0.11);
        const cp = new THREE.Mesh(cpGeo, stockMat);
        cp.position.set(0, 0.036, 0.175);
        group.add(cp);

        // Recoil pad (rubber)
        const padGeo = new THREE.BoxGeometry(0.040, 0.056, 0.012);
        const pad = new THREE.Mesh(padGeo, rubberMat);
        pad.position.set(0, 0.003, 0.135 + stLen);
        group.add(pad);

        // Adjustable stock hardware
        if (loadout.stock === 'adjustable') {
            const adjRailGeo = new THREE.BoxGeometry(0.016, 0.008, 0.09);
            const adjRail = new THREE.Mesh(adjRailGeo, metalSilv);
            adjRail.position.set(0, -0.024, 0.24);
            group.add(adjRail);
        }

        // ── Pistol Grip ────────────────────────────────────────────────────
        const gripGeo = new THREE.BoxGeometry(0.028, 0.085, 0.038);
        const grip = new THREE.Mesh(gripGeo, rubberMat);
        grip.rotation.x = 0.34;
        grip.position.set(0, -0.054, 0.074);
        grip.castShadow = true;
        group.add(grip);

        // Grip finger grooves (visual detail)
        for (let i = 0; i < 3; i++) {
            const grooveGeo = new THREE.BoxGeometry(0.030, 0.004, 0.008);
            const groove = new THREE.Mesh(grooveGeo, new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.95 }));
            groove.rotation.x = 0.34;
            groove.position.set(0, -0.034 - i * 0.018, 0.068 - i * 0.006);
            group.add(groove);
        }

        // ── Trigger & Guard ────────────────────────────────────────────────
        const tgGeo = new THREE.TorusGeometry(0.019, 0.0038, 5, 12, Math.PI);
        const tg = new THREE.Mesh(tgGeo, metalSilv);
        tg.rotation.z = Math.PI;
        tg.position.set(0, -0.035, 0.044);
        group.add(tg);

        const trigGeo = new THREE.BoxGeometry(0.004, 0.022, 0.006);
        const trig = new THREE.Mesh(trigGeo, metalSilv);
        trig.position.set(0, -0.040, 0.044);
        group.add(trig);

        // ── Forend / Handguard ─────────────────────────────────────────────
        const feGeo = new THREE.BoxGeometry(0.040, 0.028, 0.30);
        const forend = new THREE.Mesh(feGeo, stockMat);
        forend.position.set(0.004, -0.024, -0.165);
        group.add(forend);

        // Forend bottom rail
        const feRailGeo = new THREE.BoxGeometry(0.018, 0.007, 0.26);
        const feRail = new THREE.Mesh(feRailGeo, metalSilv);
        feRail.position.set(0.004, -0.042, -0.165);
        group.add(feRail);

        // ── Magazine ───────────────────────────────────────────────────────
        const magH = weaponId === 'barrett' ? 0.110 : 0.068;
        const magGeo = new THREE.BoxGeometry(0.032, magH, 0.050);
        const mag = new THREE.Mesh(magGeo, metalDark);
        mag.position.set(0, -(0.024 + magH / 2), -0.012);
        group.add(mag);
        // Mag release button
        const mrbGeo = new THREE.BoxGeometry(0.008, 0.010, 0.010);
        const mrb = new THREE.Mesh(mrbGeo, metalSilv);
        mrb.position.set(-0.028, -0.025, 0.010);
        group.add(mrb);

        // ── Barrel Attachments ─────────────────────────────────────────────
        const muzzleZ = -(0.04 + bLen);

        if (loadout.barrel === 'suppressor') {
            const supGeo = new THREE.CylinderGeometry(0.019, 0.019, 0.17, 14);
            const supMat = new THREE.MeshStandardMaterial({ color: 0x141414, metalness: 0.85, roughness: 0.22 });
            const sup = new THREE.Mesh(supGeo, supMat);
            sup.rotation.x = Math.PI / 2;
            sup.position.set(0.008, 0.004, muzzleZ - 0.085);
            group.add(sup);
            // Suppressor end cap
            const scapGeo = new THREE.CylinderGeometry(0.019, 0.017, 0.012, 14);
            const scap = new THREE.Mesh(scapGeo, supMat);
            scap.rotation.x = Math.PI / 2;
            scap.position.set(0.008, 0.004, muzzleZ - 0.176);
            group.add(scap);
            // Suppressor knurl rings
            for (let i = 0; i < 4; i++) {
                const kGeo = new THREE.CylinderGeometry(0.0195, 0.0195, 0.006, 14);
                const k = new THREE.Mesh(kGeo, metalDark);
                k.rotation.x = Math.PI / 2;
                k.position.set(0.008, 0.004, muzzleZ - 0.03 - i * 0.038);
                group.add(k);
            }
        } else if (loadout.barrel === 'muzzle') {
            const mbGeo = new THREE.CylinderGeometry(0.017, 0.011, 0.046, 10);
            const mb = new THREE.Mesh(mbGeo, metalSilv);
            mb.rotation.x = Math.PI / 2;
            mb.position.set(0.008, 0.004, muzzleZ - 0.023);
            group.add(mb);
            // Brake ports
            for (let i = 0; i < 2; i++) {
                const pGeo = new THREE.BoxGeometry(0.038, 0.010, 0.008);
                const pm = new THREE.Mesh(pGeo, metalDark);
                pm.position.set(0.008, 0.008 - i * 0.016, muzzleZ - 0.022 - i * 0.010);
                group.add(pm);
            }
        } else {
            // Crown / muzzle end
            const crownGeo = new THREE.CylinderGeometry(0.013, 0.010, 0.010, 14);
            const crown = new THREE.Mesh(crownGeo, metalSilv);
            crown.rotation.x = Math.PI / 2;
            crown.position.set(0.008, 0.004, muzzleZ - 0.005);
            group.add(crown);
        }

        // ── Underbarrel Attachments ────────────────────────────────────────
        if (loadout.under === 'bipod') {
            const pivotGeo = new THREE.BoxGeometry(0.036, 0.014, 0.022);
            const pivot = new THREE.Mesh(pivotGeo, metalSilv);
            pivot.position.set(0.004, -0.044, -0.22);
            group.add(pivot);
            for (const side of [-1, 1]) {
                const legGeo = new THREE.CylinderGeometry(0.004, 0.004, 0.21, 7);
                const leg = new THREE.Mesh(legGeo, metalMid);
                leg.rotation.z = side * 0.26;
                leg.position.set(side * 0.050, -0.148, -0.22);
                group.add(leg);
                const footGeo = new THREE.BoxGeometry(0.010, 0.006, 0.026);
                const foot = new THREE.Mesh(footGeo, rubberMat);
                foot.position.set(side * 0.064, -0.248, -0.22);
                group.add(foot);
            }
        } else if (loadout.under === 'foregrip') {
            const fgBodyGeo = new THREE.BoxGeometry(0.024, 0.072, 0.026);
            const fg = new THREE.Mesh(fgBodyGeo, rubberMat);
            fg.rotation.x = 0.08;
            fg.position.set(0.004, -0.066, -0.22);
            group.add(fg);
            // Foregrip cap
            const fgCapGeo = new THREE.SphereGeometry(0.014, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2);
            const fgCap = new THREE.Mesh(fgCapGeo, rubberMat);
            fgCap.rotation.x = Math.PI;
            fgCap.position.set(0.004, -0.102, -0.22);
            group.add(fgCap);
        }

        return group;
    }
}

function scopeDataLen(scopeId) {
    const lens = { '4x': 0.16, '8x': 0.19, '12x': 0.21, '20x': 0.24 };
    return lens[scopeId] || 0.19;
}

const weaponSystem = new WeaponSystem();
