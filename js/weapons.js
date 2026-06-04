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

    getEffectiveStats(weaponId) {
        const base = CONFIG.WEAPONS[weaponId];
        const loadout = this.loadouts[weaponId];
        const att = CONFIG.ATTACHMENTS;

        const scopeData  = att.scopes[loadout.scope]       || att.scopes['8x'];
        const barrelData = att.barrels[loadout.barrel]      || att.barrels['none'];
        const stockData  = att.stocks[loadout.stock]        || att.stocks['standard'];
        const underData  = att.underbarrels[loadout.under]  || att.underbarrels['none'];

        return {
            damage:    base.damage,
            range:     base.range + barrelData.rangeBonus + scopeData.rangeBonus,
            stability: Math.min(100, base.stability + barrelData.stabilityBonus + stockData.stabilityBonus + underData.stabilityBonus),
            fireRate:  base.fireRate,
            ammo:      base.ammo,
            reloadTime: base.reloadTime,
            muzzleVelocity: base.muzzleVelocity,
            zoom:      scopeData.zoom,
            silent:    barrelData.silent,
            type:      base.type,
        };
    }

    getSkinColor(weaponId) {
        const loadout = this.loadouts[weaponId];
        const skin = CONFIG.SKINS.find(s => s.id === loadout.skinId);
        return skin ? skin.color : 0x4a6741;
    }

    buildWeaponMesh(weaponId, THREE) {
        const stats = this.getEffectiveStats(weaponId);
        const loadout = this.loadouts[weaponId];
        const skinColor = this.getSkinColor(weaponId);
        const group = new THREE.Group();

        const mat = new THREE.MeshLambertMaterial({ color: skinColor });
        const darkMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
        const metalMat = new THREE.MeshLambertMaterial({ color: 0x555555 });
        const scopeMat = new THREE.MeshLambertMaterial({ color: 0x222222 });

        // Receiver body
        const receiverGeo = new THREE.BoxGeometry(0.055, 0.06, 0.32);
        const receiver = new THREE.Mesh(receiverGeo, mat);
        receiver.position.set(0, 0, -0.05);
        group.add(receiver);

        // Barrel
        const barrelLen = (weaponId === 'barrett' || weaponId === 'cheytac' || weaponId === 'tac50') ? 0.82 : 0.68;
        const barrelGeo = new THREE.CylinderGeometry(0.012, 0.014, barrelLen, 8);
        const barrel = new THREE.Mesh(barrelGeo, metalMat);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, 0.005, -(0.05 + barrelLen / 2));
        group.add(barrel);

        // Suppressor
        if (loadout.barrel === 'suppressor') {
            const supGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.18, 8);
            const sup = new THREE.Mesh(supGeo, darkMat);
            sup.rotation.x = Math.PI / 2;
            sup.position.set(0, 0.005, barrel.position.z - barrelLen / 2 - 0.09);
            group.add(sup);
        }

        // Muzzle brake
        if (loadout.barrel === 'muzzle') {
            const mbGeo = new THREE.CylinderGeometry(0.02, 0.016, 0.05, 8);
            const mb = new THREE.Mesh(mbGeo, metalMat);
            mb.rotation.x = Math.PI / 2;
            mb.position.set(0, 0.005, barrel.position.z - barrelLen / 2 - 0.025);
            group.add(mb);
        }

        // Stock
        const stockLen = loadout.stock === 'adjustable' ? 0.30 : 0.26;
        const stockGeo = new THREE.BoxGeometry(0.04, 0.048, stockLen);
        const stock = new THREE.Mesh(stockGeo, mat);
        stock.position.set(0, -0.005, 0.16 + stockLen / 2);
        group.add(stock);

        // Cheekpiece
        const cpGeo = new THREE.BoxGeometry(0.035, 0.04, 0.1);
        const cp = new THREE.Mesh(cpGeo, mat);
        cp.position.set(0, 0.04, 0.22);
        group.add(cp);

        // Pistol grip
        const gripGeo = new THREE.BoxGeometry(0.032, 0.1, 0.045);
        const grip = new THREE.Mesh(gripGeo, darkMat);
        grip.rotation.x = 0.3;
        grip.position.set(0, -0.06, 0.08);
        group.add(grip);

        // Trigger guard
        const tgGeo = new THREE.TorusGeometry(0.022, 0.005, 4, 8, Math.PI);
        const tg = new THREE.Mesh(tgGeo, metalMat);
        tg.rotation.z = Math.PI;
        tg.position.set(0, -0.04, 0.05);
        group.add(tg);

        // Scope base rail
        const railGeo = new THREE.BoxGeometry(0.025, 0.012, 0.24);
        const rail = new THREE.Mesh(railGeo, metalMat);
        rail.position.set(0, 0.038, -0.02);
        group.add(rail);

        // Scope body
        const scopeBodyGeo = new THREE.CylinderGeometry(0.022, 0.022, scopeDataLen(loadout.scope), 12);
        const scopeBody = new THREE.Mesh(scopeBodyGeo, scopeMat);
        scopeBody.rotation.x = Math.PI / 2;
        scopeBody.position.set(0, 0.065, -0.02);
        group.add(scopeBody);

        // Scope objective lens
        const lensGeo = new THREE.CylinderGeometry(0.026, 0.022, 0.04, 12);
        const lens = new THREE.Mesh(lensGeo, darkMat);
        lens.rotation.x = Math.PI / 2;
        lens.position.set(0, 0.065, scopeBody.position.z - scopeDataLen(loadout.scope) / 2 - 0.02);
        group.add(lens);

        // Scope eye piece
        const eyeGeo = new THREE.CylinderGeometry(0.024, 0.026, 0.035, 12);
        const eye = new THREE.Mesh(eyeGeo, darkMat);
        eye.rotation.x = Math.PI / 2;
        eye.position.set(0, 0.065, scopeBody.position.z + scopeDataLen(loadout.scope) / 2 + 0.017);
        group.add(eye);

        // Scope turrets
        const turretGeo = new THREE.CylinderGeometry(0.007, 0.007, 0.022, 6);
        const turret1 = new THREE.Mesh(turretGeo, metalMat);
        turret1.position.set(0, 0.09, -0.02);
        group.add(turret1);
        const turret2 = new THREE.Mesh(turretGeo, metalMat);
        turret2.rotation.z = Math.PI / 2;
        turret2.position.set(0.035, 0.065, -0.02);
        group.add(turret2);

        // Bipod
        if (loadout.under === 'bipod') {
            const legGeo = new THREE.CylinderGeometry(0.005, 0.005, 0.18, 6);
            const l1 = new THREE.Mesh(legGeo, metalMat);
            l1.rotation.z = 0.25;
            l1.position.set(-0.05, -0.1, -0.25);
            group.add(l1);
            const l2 = new THREE.Mesh(legGeo, metalMat);
            l2.rotation.z = -0.25;
            l2.position.set(0.05, -0.1, -0.25);
            group.add(l2);
        }

        // Foregrip
        if (loadout.under === 'foregrip') {
            const fgGeo = new THREE.BoxGeometry(0.028, 0.07, 0.028);
            const fg = new THREE.Mesh(fgGeo, darkMat);
            fg.position.set(0, -0.05, -0.2);
            group.add(fg);
        }

        // Magazine
        const magGeo = new THREE.BoxGeometry(0.038, 0.07, 0.055);
        const mag = new THREE.Mesh(magGeo, darkMat);
        mag.position.set(0, -0.065, -0.02);
        group.add(mag);

        return group;
    }
}

function scopeDataLen(scopeId) {
    const lens = { '4x': 0.16, '8x': 0.19, '12x': 0.21, '20x': 0.24 };
    return lens[scopeId] || 0.19;
}

const weaponSystem = new WeaponSystem();
