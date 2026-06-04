class SniperGame {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.renderer = null;
        this.scene = null;
        this.mainCamera = null;
        this.bulletCamObj = null;
        this.renderTarget = null;

        this.player = {
            yaw: 0,
            pitch: 0,
            pos: new THREE.Vector3(0, 6, 80),
            isAiming: false,
            breathHeld: false,
            breathEnergy: 1.0,
            sway: new THREE.Vector2(0, 0),
            swayVel: new THREE.Vector2(0, 0),
        };

        this.weaponGroup = null;
        this.weaponId = 'r700';
        this.ammo = 5;
        this.isReloading = false;
        this.reloadTimer = 0;
        this.timeSinceFire = 999;
        this.boltTimer = 0;
        this.boltOpen = false;

        this.targets = [];
        this.targetMeshes = [];

        this.bullets = [];
        this.bulletCamActive = false;
        this.bulletCamBullet = null;
        this.bulletCamTimer = 0;
        this.bulletCamFollowPos = new THREE.Vector3();
        this.bulletCamFollowDir = new THREE.Vector3();

        this.wind = new THREE.Vector2(0, 0);
        this.windTimer = 0;

        this.mission = null;
        this.missionActive = false;
        this.missionTimer = 0;
        this.killCount = 0;
        this.headshotStreak = 0;
        this.stealthKills = 0;
        this.missionFailed = false;
        this.timedKillTimer = 0;

        this.state = 'menu';
        this.clock = new THREE.Clock();
        this.keys = {};
        this.mouse = { dx: 0, dy: 0, right: false };
        this.pointerLocked = false;
        this.animFrame = null;

        this.environmentMeshes = [];
        this.muzzleFlash = null;
        this.muzzleFlashTimer = 0;

        this.score = 0;
        this.totalScore = 0;
    }

    init() {
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.setSize(window.innerWidth, window.innerHeight);

        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.Fog(0x8ab4cc, CONFIG.LEVEL.FOG_NEAR, CONFIG.LEVEL.FOG_FAR);
        this.scene.background = new THREE.Color(0x7ab0cc);

        this.mainCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.05, 2000);
        this.mainCamera.position.copy(this.player.pos);

        this.bulletCamObj = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.01, 2000);

        // Lighting
        const ambient = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(ambient);

        const sun = new THREE.DirectionalLight(0xfff5e0, 1.1);
        sun.position.set(300, 400, -200);
        sun.castShadow = true;
        sun.shadow.mapSize.width = 2048;
        sun.shadow.mapSize.height = 2048;
        sun.shadow.camera.near = 1;
        sun.shadow.camera.far = 2000;
        sun.shadow.camera.left = -600;
        sun.shadow.camera.right = 600;
        sun.shadow.camera.top = 600;
        sun.shadow.camera.bottom = -600;
        this.scene.add(sun);

        const hemi = new THREE.HemisphereLight(0x6699ff, 0x44aa44, 0.3);
        this.scene.add(hemi);

        this.buildEnvironment();
        this.bindInput();

        window.addEventListener('resize', () => this.onResize());

        this.randomizeWind();
        this.loop();
    }

    buildEnvironment() {
        // Ground
        const groundGeo = new THREE.PlaneGeometry(CONFIG.LEVEL.SIZE, CONFIG.LEVEL.SIZE, 30, 30);
        const groundMat = new THREE.MeshLambertMaterial({ color: 0x5a7a42 });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);

        // Road / dirt path going forward (Z-axis)
        const roadGeo = new THREE.PlaneGeometry(6, 1200);
        const roadMat = new THREE.MeshLambertMaterial({ color: 0x888878 });
        const road = new THREE.Mesh(roadGeo, roadMat);
        road.rotation.x = -Math.PI / 2;
        road.position.set(0, 0.01, -500);
        this.scene.add(road);

        // Sniper nest platform
        const nestGeo = new THREE.BoxGeometry(10, 6, 8);
        const nestMat = new THREE.MeshLambertMaterial({ color: 0x7a6a50 });
        const nest = new THREE.Mesh(nestGeo, nestMat);
        nest.position.set(0, 0, 80);
        nest.castShadow = true;
        nest.receiveShadow = true;
        this.scene.add(nest);

        // Sandbags in front
        this.addSandbag(0, 3.05, 76);
        this.addSandbag(1.4, 3.05, 76);
        this.addSandbag(-1.4, 3.05, 76);

        // Buildings at various distances
        const buildingDefs = [
            { x: 35,  z: -100, w: 12, h: 18, d: 10, c: 0x9a8878 },
            { x: -40, z: -120, w: 10, h: 14, d: 10, c: 0x8a9878 },
            { x: 50,  z: -200, w: 14, h: 20, d: 12, c: 0xa09080 },
            { x: -55, z: -220, w: 16, h: 16, d: 12, c: 0x9a8870 },
            { x: 60,  z: -350, w: 12, h: 22, d: 10, c: 0x88887a },
            { x: -60, z: -380, w: 18, h: 18, d: 14, c: 0x909888 },
            { x: 80,  z: -500, w: 16, h: 24, d: 14, c: 0x807870 },
            { x: -80, z: -520, w: 14, h: 20, d: 12, c: 0x908878 },
            { x: 100, z: -700, w: 20, h: 28, d: 16, c: 0x706a60 },
            { x:-100, z: -750, w: 18, h: 22, d: 14, c: 0x787868 },
            { x: 120, z: -900, w: 16, h: 20, d: 14, c: 0x706860 },
        ];

        for (const def of buildingDefs) {
            this.addBuilding(def.x, def.z, def.w, def.h, def.d, def.c);
        }

        // Trees
        const treePositions = [
            [-15, -80], [18, -90], [-25, -160], [22, -170],
            [-30, -300], [35, -310], [-45, -450], [40, -460],
            [-50, -600], [55, -590], [-60, -750], [65, -760],
            [-70, -870], [70, -880], [-80, -950], [80, -960],
        ];
        for (const [tx, tz] of treePositions) {
            this.addTree(tx, tz);
        }

        // Rocks
        const rockPositions = [
            [-10, -130], [12, -145], [-18, -290], [20, -280],
            [-25, -420], [28, -410], [-35, -560], [38, -570],
        ];
        for (const [rx, rz] of rockPositions) {
            this.addRock(rx, rz);
        }

        // Wooden walls/barriers at various points
        this.addWall(0, -100, 8, 2, 0.3);
        this.addWall(-15, -200, 6, 1.8, 0.3);
        this.addWall(15, -300, 8, 1.5, 0.3);

        // Muzzle flash light (hidden by default)
        const flashLight = new THREE.PointLight(0xffcc44, 5, 3);
        flashLight.visible = false;
        this.scene.add(flashLight);
        this.muzzleFlashLight = flashLight;
    }

    addBuilding(x, z, w, h, d, color) {
        const mat = new THREE.MeshLambertMaterial({ color });
        const geo = new THREE.BoxGeometry(w, h, d);
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, h / 2, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.scene.add(mesh);
        this.environmentMeshes.push(mesh);

        // Windows
        const winMat = new THREE.MeshLambertMaterial({ color: 0x223344 });
        const winGeo = new THREE.BoxGeometry(1.2, 1.4, 0.1);
        const rows = Math.floor(h / 3.5);
        const cols = Math.floor(w / 3.5);
        for (let r = 1; r <= rows - 1; r++) {
            for (let c = 0; c < cols; c++) {
                const win = new THREE.Mesh(winGeo, winMat);
                win.position.set(x - w / 2 + 1.8 + c * 3.5, r * 3.5 - 0.5, z + d / 2 + 0.05);
                this.scene.add(win);
            }
        }
    }

    addSandbag(x, y, z) {
        const geo = new THREE.BoxGeometry(1.2, 0.55, 0.55);
        const mat = new THREE.MeshLambertMaterial({ color: 0xb8a070 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, y, z);
        this.scene.add(mesh);
    }

    addTree(x, z) {
        const trunkGeo = new THREE.CylinderGeometry(0.2, 0.28, 2.5, 6);
        const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5a3e28 });
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.set(x, 1.25, z);
        this.scene.add(trunk);

        const fGeo = new THREE.ConeGeometry(1.8, 3.5, 7);
        const fMat = new THREE.MeshLambertMaterial({ color: 0x2d5a1f });
        const foliage = new THREE.Mesh(fGeo, fMat);
        foliage.position.set(x, 4.2, z);
        this.scene.add(foliage);
    }

    addRock(x, z) {
        const geo = new THREE.DodecahedronGeometry(1.0 + Math.random() * 0.5, 0);
        const mat = new THREE.MeshLambertMaterial({ color: 0x888880 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, 0.5, z);
        mesh.rotation.y = Math.random() * Math.PI;
        this.scene.add(mesh);
    }

    addWall(x, z, width, height, depth) {
        const geo = new THREE.BoxGeometry(width, height, depth);
        const mat = new THREE.MeshLambertMaterial({ color: 0xa09070 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, height / 2, z);
        this.scene.add(mesh);
    }

    spawnTargets(missionDef) {
        // Remove old targets
        for (const t of this.targets) {
            this.scene.remove(t.group);
        }
        this.targets = [];

        for (const def of missionDef.targetLayout) {
            const target = this.createTarget(def);
            this.targets.push(target);
            this.scene.add(target.group);
        }
    }

    createTarget(def) {
        const group = new THREE.Group();
        group.position.set(def.x, 0, def.z);

        const isVeteran = def.type === 'veteran';
        const isSniper  = def.type === 'sniper';

        const bodyColor  = isVeteran ? 0x8a6030 : isSniper ? 0x2a2a2a : 0x3a6040;
        const headColor  = 0xdba080;
        const gearColor  = isVeteran ? 0x604020 : 0x2a3a2a;

        // Legs
        const legGeo = new THREE.BoxGeometry(0.24, 0.72, 0.22);
        const legMat = new THREE.MeshLambertMaterial({ color: bodyColor });
        const lLeg = new THREE.Mesh(legGeo, legMat);
        lLeg.position.set(-0.13, 0.36, 0);
        lLeg.castShadow = true;
        group.add(lLeg);
        const rLeg = new THREE.Mesh(legGeo, legMat);
        rLeg.position.set(0.13, 0.36, 0);
        rLeg.castShadow = true;
        group.add(rLeg);

        // Torso
        const torsoGeo = new THREE.BoxGeometry(0.5, 0.64, 0.28);
        const torsoMat = new THREE.MeshLambertMaterial({ color: bodyColor });
        const torso = new THREE.Mesh(torsoGeo, torsoMat);
        torso.position.set(0, 1.1, 0);
        torso.castShadow = true;
        torso.userData.hitzone = 'body';
        group.add(torso);

        // Gear/vest
        const gearGeo = new THREE.BoxGeometry(0.52, 0.28, 0.3);
        const gearMat = new THREE.MeshLambertMaterial({ color: gearColor });
        const gear = new THREE.Mesh(gearGeo, gearMat);
        gear.position.set(0, 1.06, 0.01);
        group.add(gear);

        // Arms
        const armGeo = new THREE.BoxGeometry(0.2, 0.58, 0.2);
        const armMat = new THREE.MeshLambertMaterial({ color: bodyColor });
        const lArm = new THREE.Mesh(armGeo, armMat);
        lArm.position.set(-0.36, 1.0, 0);
        lArm.rotation.z = 0.15;
        group.add(lArm);
        const rArm = new THREE.Mesh(armGeo, armMat);
        rArm.position.set(0.36, 1.0, 0);
        rArm.rotation.z = -0.15;
        group.add(rArm);

        // Neck
        const neckGeo = new THREE.CylinderGeometry(0.09, 0.1, 0.14, 6);
        const neckMat = new THREE.MeshLambertMaterial({ color: headColor });
        const neck = new THREE.Mesh(neckGeo, neckMat);
        neck.position.set(0, 1.49, 0);
        group.add(neck);

        // Head
        const headGeo = new THREE.BoxGeometry(0.28, 0.28, 0.28);
        const headMat = new THREE.MeshLambertMaterial({ color: headColor });
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.set(0, 1.7, 0);
        head.castShadow = true;
        head.userData.hitzone = 'head';
        group.add(head);

        // Helmet
        const helmetGeo = new THREE.SphereGeometry(0.17, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.6);
        const helmetMat = new THREE.MeshLambertMaterial({ color: isVeteran ? 0x4a3010 : 0x2a3a2a });
        const helmet = new THREE.Mesh(helmetGeo, helmetMat);
        helmet.position.set(0, 1.76, 0);
        group.add(helmet);

        // Veteran decoration
        if (isVeteran) {
            const stripGeo = new THREE.BoxGeometry(0.54, 0.04, 0.31);
            const stripMat = new THREE.MeshLambertMaterial({ color: 0xc8a000 });
            const strip = new THREE.Mesh(stripGeo, stripMat);
            strip.position.set(0, 1.28, 0);
            group.add(strip);
        }

        // Sniper has a rifle
        if (isSniper) {
            const rifleGeo = new THREE.BoxGeometry(0.04, 0.04, 0.8);
            const rifleMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
            const rifle = new THREE.Mesh(rifleGeo, rifleMat);
            rifle.position.set(0.25, 1.1, -0.3);
            group.add(rifle);
        }

        // Hitbox spheres (invisible, used for raycasting)
        const headHitGeo = new THREE.SphereGeometry(0.16, 6, 6);
        const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, side: THREE.DoubleSide });
        const headHit = new THREE.Mesh(headHitGeo, hitMat.clone());
        headHit.position.set(0, 1.7, 0);
        headHit.userData.hitzone = 'head';
        headHit.userData.targetId = def.id;
        group.add(headHit);

        const bodyHitGeo = new THREE.BoxGeometry(0.52, 0.72, 0.32);
        const bodyHit = new THREE.Mesh(bodyHitGeo, hitMat.clone());
        bodyHit.position.set(0, 1.1, 0);
        bodyHit.userData.hitzone = 'body';
        bodyHit.userData.targetId = def.id;
        group.add(bodyHit);

        const legHitGeo = new THREE.BoxGeometry(0.52, 0.78, 0.26);
        const legHit = new THREE.Mesh(legHitGeo, hitMat.clone());
        legHit.position.set(0, 0.39, 0);
        legHit.userData.hitzone = 'leg';
        legHit.userData.targetId = def.id;
        group.add(legHit);

        const patrolAngle = Math.random() * Math.PI * 2;

        return {
            id: def.id,
            group,
            type: def.type,
            alive: true,
            moving: def.moving,
            speed: def.speed || 1.5,
            patrolAngle,
            patrolRadius: def.patrolRadius || 12,
            patrolCenter: new THREE.Vector3(def.x, 0, def.z),
            headTarget: def.headTarget || false,
            isEnemy: def.isEnemy || false,
            hitParts: { head: headHit, body: bodyHit, leg: legHit },
            allMeshes: [headHit, bodyHit, legHit, torso, head],
            shootTimer: isSniper ? 4000 + Math.random() * 3000 : 0,
        };
    }

    buildWeaponVisual() {
        if (this.weaponGroup) {
            this.mainCamera.remove(this.weaponGroup);
        }
        this.weaponGroup = weaponSystem.buildWeaponMesh(this.weaponId, THREE);

        // Position weapon in lower right of camera view
        this.weaponGroup.position.set(0.18, -0.14, -0.38);
        this.weaponGroup.rotation.y = Math.PI;

        this.mainCamera.add(this.weaponGroup);
        this.scene.add(this.mainCamera);

        // Muzzle flash mesh
        if (this.muzzleFlash) {
            this.mainCamera.remove(this.muzzleFlash);
        }
        const flashGeo = new THREE.SphereGeometry(0.02, 5, 5);
        const flashMat = new THREE.MeshBasicMaterial({ color: 0xffcc44 });
        this.muzzleFlash = new THREE.Mesh(flashGeo, flashMat);
        this.muzzleFlash.position.set(0.18, -0.13, -0.9);
        this.muzzleFlash.visible = false;
        this.mainCamera.add(this.muzzleFlash);
    }

    bindInput() {
        document.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            if (e.code === 'Escape' && this.state === 'playing') this.pause();
            if (e.code === 'Escape' && this.state === 'paused') this.resume();
            if (e.code === 'KeyR' && this.state === 'playing' && !this.isReloading) this.startReload();
            if (e.code === 'ShiftLeft' && this.state === 'playing') {
                this.player.breathHeld = true;
            }
        });

        document.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
            if (e.code === 'ShiftLeft') {
                this.player.breathHeld = false;
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (this.pointerLocked) {
                this.mouse.dx += e.movementX;
                this.mouse.dy += e.movementY;
            }
        });

        document.addEventListener('mousedown', (e) => {
            if (e.button === 2) {
                this.mouse.right = true;
                if (this.state === 'playing') this.startAim();
            }
            if (e.button === 0 && this.state === 'playing' && this.pointerLocked) {
                this.tryFire();
            }
        });

        document.addEventListener('mouseup', (e) => {
            if (e.button === 2) {
                this.mouse.right = false;
                if (this.state === 'playing') this.stopAim();
            }
        });

        document.addEventListener('contextmenu', (e) => e.preventDefault());

        this.canvas.addEventListener('click', () => {
            if (this.state === 'playing') {
                this.canvas.requestPointerLock();
            }
        });

        document.addEventListener('pointerlockchange', () => {
            this.pointerLocked = document.pointerLockElement === this.canvas;
            if (!this.pointerLocked && this.state === 'playing') {
                this.pause();
            }
        });
    }

    startAim() {
        this.player.isAiming = true;
        const stats = weaponSystem.getEffectiveStats(this.weaponId);
        this.mainCamera.fov = 75 / stats.zoom;
        this.mainCamera.updateProjectionMatrix();
        document.getElementById('crosshair').style.display = 'none';
        document.getElementById('scope-overlay').classList.remove('hidden');
    }

    stopAim() {
        this.player.isAiming = false;
        this.mainCamera.fov = 75;
        this.mainCamera.updateProjectionMatrix();
        document.getElementById('crosshair').style.display = '';
        document.getElementById('scope-overlay').classList.add('hidden');
    }

    tryFire() {
        if (this.bulletCamActive) return;
        if (this.isReloading) return;
        if (this.boltOpen) return;

        const stats = weaponSystem.getEffectiveStats(this.weaponId);
        if (this.ammo <= 0) {
            this.startReload();
            return;
        }

        this.ammo--;
        uiManager.updateAmmo(this.ammo, stats.ammo);

        // Camera direction as bullet direction (with sway)
        const dir = new THREE.Vector3(0, 0, -1);
        const swayOffset = new THREE.Vector3(
            (Math.random() - 0.5) * 0.003 + this.player.sway.x * 0.8,
            (Math.random() - 0.5) * 0.003 + this.player.sway.y * 0.8,
            0
        );

        if (!this.player.breathHeld) {
            swayOffset.x += (Math.random() - 0.5) * 0.008;
            swayOffset.y += (Math.random() - 0.5) * 0.008;
        }

        dir.add(swayOffset).normalize();
        dir.applyQuaternion(this.mainCamera.quaternion);

        const origin = this.mainCamera.position.clone();
        origin.y -= 0.05;

        const bullet = {
            pos: origin.clone(),
            vel: dir.clone().multiplyScalar(stats.muzzleVelocity),
            alive: true,
            traveled: 0,
            maxRange: stats.range,
            weaponStats: stats,
            silent: stats.silent,
            hitRegistered: false,
        };
        this.bullets.push(bullet);

        // Muzzle flash
        this.muzzleFlash.visible = true;
        this.muzzleFlashTimer = 0.06;
        this.muzzleFlashLight.visible = true;
        this.muzzleFlashLight.position.copy(origin);

        // Bolt animation for bolt-action
        if (stats.type === 'bolt') {
            this.boltOpen = true;
            this.boltTimer = 0.45;
        }

        this.timeSinceFire = 0;

        // Recoil
        this.player.pitch -= 0.008 + Math.random() * 0.004;
        this.player.yaw   += (Math.random() - 0.5) * 0.004;

        if (this.ammo === 0) {
            setTimeout(() => this.startReload(), 300);
        }
    }

    startReload() {
        if (this.isReloading) return;
        const stats = weaponSystem.getEffectiveStats(this.weaponId);
        this.isReloading = true;
        this.reloadTimer = stats.reloadTime / 1000;
        document.getElementById('reload-indicator').classList.remove('hidden');
    }

    startAiming() {}

    randomizeWind() {
        const angle = Math.random() * Math.PI * 2;
        const strength = Math.random() * 4;
        this.wind.set(
            Math.cos(angle) * strength,
            Math.sin(angle) * strength
        );
        uiManager.updateWind(this.wind);
    }

    loop() {
        this.animFrame = requestAnimationFrame(() => this.loop());
        const dt = Math.min(this.clock.getDelta(), 0.05);

        if (this.state === 'playing') {
            this.update(dt);
        }

        if (this.bulletCamActive) {
            this.renderer.render(this.scene, this.bulletCamObj);
        } else {
            this.renderer.render(this.scene, this.mainCamera);
        }
    }

    update(dt) {
        this.updatePlayerLook(dt);
        this.updatePlayerMovement(dt);
        this.updateBullets(dt);
        this.updateTargets(dt);
        this.updateTimers(dt);
        this.updateWeaponSway(dt);
        this.updateMuzzleFlash(dt);
        if (this.bulletCamActive) {
            this.updateBulletCam(dt);
        }
        if (this.mission && this.mission.timeLimit > 0 && this.missionActive) {
            this.missionTimer -= dt;
            if (this.missionTimer <= 0) {
                this.missionTimer = 0;
                this.failMission('Zeit abgelaufen!');
            }
            uiManager.updateMissionTimer(this.missionTimer);
        }
    }

    updatePlayerLook(dt) {
        const sens = CONFIG.PLAYER.SENSITIVITY;
        this.player.yaw   -= this.mouse.dx * sens;
        this.player.pitch -= this.mouse.dy * sens;
        this.mouse.dx = 0;
        this.mouse.dy = 0;

        const maxPitch = CONFIG.PLAYER.MAX_PITCH;
        this.player.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.player.pitch));

        this.mainCamera.rotation.order = 'YXZ';
        this.mainCamera.rotation.y = this.player.yaw;
        this.mainCamera.rotation.x = this.player.pitch;
    }

    updatePlayerMovement(dt) {
        const speed = CONFIG.PLAYER.MOVE_SPEED;
        const forward = new THREE.Vector3(-Math.sin(this.player.yaw), 0, -Math.cos(this.player.yaw));
        const right = new THREE.Vector3(Math.cos(this.player.yaw), 0, -Math.sin(this.player.yaw));

        if (this.keys['KeyW']) this.player.pos.addScaledVector(forward, speed * dt);
        if (this.keys['KeyS']) this.player.pos.addScaledVector(forward, -speed * dt);
        if (this.keys['KeyA']) this.player.pos.addScaledVector(right, -speed * dt);
        if (this.keys['KeyD']) this.player.pos.addScaledVector(right, speed * dt);

        this.mainCamera.position.copy(this.player.pos);
    }

    updateWeaponSway(dt) {
        const cfg = CONFIG.PLAYER;
        if (this.player.breathHeld) {
            this.player.breathEnergy -= cfg.BREATH_USE_RATE * dt;
            if (this.player.breathEnergy < 0) {
                this.player.breathEnergy = 0;
                this.player.breathHeld = false;
            }
        } else {
            this.player.breathEnergy = Math.min(1, this.player.breathEnergy + cfg.BREATH_RECOVER_RATE * dt);
        }

        document.getElementById('breath-fill').style.width = (this.player.breathEnergy * 100) + '%';

        const stats = weaponSystem.getEffectiveStats(this.weaponId);
        const swayMult = this.player.breathHeld ? 0.02 : 1.0;
        const stabMult = 1 - stats.stability / 100;
        const aimMult  = this.player.isAiming ? 0.3 : 1.0;

        const swayAmt = 0.0006 * stabMult * swayMult * aimMult;
        const t = performance.now() * 0.001;

        this.player.swayVel.x += (Math.sin(t * 1.3) * swayAmt - this.player.sway.x * 0.05) * dt * 60;
        this.player.swayVel.y += (Math.sin(t * 0.7 + 1) * swayAmt * 0.7 - this.player.sway.y * 0.05) * dt * 60;
        this.player.sway.x += this.player.swayVel.x * dt * 60;
        this.player.sway.y += this.player.swayVel.y * dt * 60;
        this.player.swayVel.multiplyScalar(0.92);

        if (this.weaponGroup) {
            this.weaponGroup.rotation.z = this.player.sway.x * 0.4;
            this.weaponGroup.rotation.x = Math.PI + this.player.sway.y * 0.3;
        }
    }

    updateTimers(dt) {
        this.timeSinceFire += dt;
        this.windTimer += dt;
        if (this.windTimer > CONFIG.GAME.WIND_UPDATE / 1000) {
            this.windTimer = 0;
            this.randomizeWind();
        }

        if (this.isReloading) {
            this.reloadTimer -= dt;
            if (this.reloadTimer <= 0) {
                this.isReloading = false;
                this.ammo = weaponSystem.getEffectiveStats(this.weaponId).ammo;
                document.getElementById('reload-indicator').classList.add('hidden');
                uiManager.updateAmmo(this.ammo, this.ammo);
            }
        }

        if (this.boltOpen) {
            this.boltTimer -= dt;
            if (this.boltTimer <= 0) {
                this.boltOpen = false;
                if (this.weaponGroup) {
                    this.weaponGroup.rotation.y = Math.PI;
                }
            }
        }
    }

    updateMuzzleFlash(dt) {
        if (this.muzzleFlashTimer > 0) {
            this.muzzleFlashTimer -= dt;
            if (this.muzzleFlashTimer <= 0) {
                this.muzzleFlash.visible = false;
                this.muzzleFlashLight.visible = false;
            }
        }
    }

    updateBullets(dt) {
        const gravity = new THREE.Vector3(0, -9.81, 0);
        for (const b of this.bullets) {
            if (!b.alive) continue;

            b.vel.addScaledVector(gravity, dt);
            b.vel.x += this.wind.x * 0.003;
            b.vel.z += this.wind.y * 0.003;

            const prevPos = b.pos.clone();
            b.pos.addScaledVector(b.vel, dt);
            b.traveled += b.vel.length() * dt;

            if (!b.hitRegistered) {
                const seg = b.pos.clone().sub(prevPos);
                const segLen = seg.length();
                if (segLen > 0) {
                    const ray = new THREE.Raycaster(prevPos, seg.normalize(), 0, segLen + 0.1);
                    const hitObjects = [];
                    for (const t of this.targets) {
                        if (t.alive) hitObjects.push(...Object.values(t.hitParts));
                    }
                    const hits = ray.intersectObjects(hitObjects);
                    if (hits.length > 0) {
                        const h = hits[0];
                        const target = this.targets.find(t => t.id === h.object.userData.targetId);
                        if (target && target.alive) {
                            this.onHit(b, target, h.object.userData.hitzone, h.point);
                            b.alive = false;
                            b.hitRegistered = true;
                        }
                    }
                }
            }

            if (b.pos.y < 0) { this.spawnImpactDust(b.pos); b.alive = false; }
            if (b.traveled > b.weaponStats.range) b.alive = false;
        }

        this.bullets = this.bullets.filter(b => b.alive);
    }

    updateTargets(dt) {
        for (const t of this.targets) {
            if (!t.alive) continue;
            if (t.moving) {
                t.patrolAngle += t.speed * dt * 0.5;
                const nx = t.patrolCenter.x + Math.cos(t.patrolAngle) * t.patrolRadius;
                const nz = t.patrolCenter.z + Math.sin(t.patrolAngle) * t.patrolRadius;
                t.group.position.set(nx, 0, nz);
                t.group.rotation.y = t.patrolAngle + Math.PI / 2;
            }

            // Enemy sniper behavior
            if (t.isEnemy && t.type === 'sniper' && t.shootTimer !== undefined) {
                t.shootTimer -= dt * 1000;
                if (t.shootTimer <= 0) {
                    this.enemyShoot(t);
                    t.shootTimer = 3000 + Math.random() * 4000;
                }
            }
        }
    }

    enemyShoot(target) {
        const dir = this.player.pos.clone().sub(target.group.position).normalize();
        dir.x += (Math.random() - 0.5) * 0.1;
        dir.y += (Math.random() - 0.5) * 0.05;

        const flashGeo = new THREE.SphereGeometry(0.15, 5, 5);
        const flashMat = new THREE.MeshBasicMaterial({ color: 0xffcc00 });
        const flash = new THREE.Mesh(flashGeo, flashMat);
        flash.position.copy(target.group.position);
        flash.position.y = 1.1;
        this.scene.add(flash);
        setTimeout(() => this.scene.remove(flash), 120);

        uiManager.showSniperWarning();
    }

    onHit(bullet, target, zone, hitPoint) {
        const isHeadshot = zone === 'head';
        const dist = Math.round(bullet.pos.distanceTo(this.player.pos));

        // Start bullet cam
        this.startBulletCam(bullet, hitPoint, zone);

        // Kill target
        target.alive = false;
        setTimeout(() => {
            target.group.rotation.x = Math.PI / 2;
            target.group.position.y = -0.1;
        }, CONFIG.GAME.BULLET_CAM_DURATION * CONFIG.GAME.BULLET_CAM_SLOW * 0.5);

        // Score
        let pts = 100;
        if (isHeadshot) pts += 150;
        if (dist > 500) pts += 200;
        if (dist > 800) pts += 400;
        if (bullet.silent) pts += 100;
        this.score += pts;

        // Kill notification
        uiManager.showKillNotification(isHeadshot, dist, pts);

        // Mission tracking
        this.killCount++;
        if (isHeadshot) {
            this.headshotStreak++;
        } else {
            this.headshotStreak = 0;
        }
        if (bullet.silent) this.stealthKills++;

        this.checkMissionObjectives({ kill: true, headshot: isHeadshot, dist, type: target.type, silent: bullet.silent });
    }

    startBulletCam(bullet, hitPoint, zone) {
        this.bulletCamActive = true;
        this.bulletCamTimer = CONFIG.GAME.BULLET_CAM_DURATION / 1000;

        const fromPos = bullet.pos.clone();
        fromPos.y += 0.05;
        this.bulletCamFollowPos.copy(fromPos);
        this.bulletCamFollowDir.copy(hitPoint).sub(fromPos).normalize();

        this.bulletCamObj.position.copy(fromPos);
        this.bulletCamObj.lookAt(hitPoint);

        document.getElementById('bullet-cam-overlay').classList.remove('hidden');
        document.getElementById('scope-overlay').classList.add('hidden');
    }

    updateBulletCam(dt) {
        this.bulletCamTimer -= dt * CONFIG.GAME.BULLET_CAM_SLOW * 60;
        if (this.bulletCamTimer <= 0) {
            this.stopBulletCam();
            return;
        }

        // Move camera towards hit point slowly
        this.bulletCamFollowPos.addScaledVector(this.bulletCamFollowDir, 4 * dt);
        this.bulletCamObj.position.lerp(this.bulletCamFollowPos, 0.06);

        // Look at target area
        const lookAt = this.bulletCamFollowPos.clone().addScaledVector(this.bulletCamFollowDir, 1.5);
        this.bulletCamObj.lookAt(lookAt);
    }

    stopBulletCam() {
        this.bulletCamActive = false;
        document.getElementById('bullet-cam-overlay').classList.add('hidden');
        if (this.player.isAiming) {
            document.getElementById('scope-overlay').classList.remove('hidden');
        }
    }

    spawnImpactDust(pos) {
        const geo = new THREE.SphereGeometry(0.3, 4, 4);
        const mat = new THREE.MeshBasicMaterial({ color: 0xaa9977, transparent: true, opacity: 0.7 });
        const dust = new THREE.Mesh(geo, mat);
        dust.position.copy(pos);
        dust.position.y = Math.max(0.15, pos.y);
        this.scene.add(dust);
        let t = 0;
        const animate = () => {
            t += 0.016;
            dust.material.opacity -= 0.02;
            dust.scale.multiplyScalar(1.04);
            if (t > 0.6) { this.scene.remove(dust); return; }
            requestAnimationFrame(animate);
        };
        animate();
    }

    checkMissionObjectives(event) {
        if (!this.mission || !this.missionActive) return;

        let allDone = true;
        for (const obj of this.mission.objectives) {
            if (obj._done) continue;
            let progress = false;

            if (obj.type === 'kill') {
                if (event.kill && (!obj.distance || (event.dist >= obj.distance[0] && event.dist <= obj.distance[1]))) {
                    obj._count = (obj._count || 0) + 1;
                    if (obj._count >= obj.count) obj._done = true;
                    progress = true;
                }
            } else if (obj.type === 'headshot') {
                if (event.headshot && (!obj.targetType || event.type === obj.targetType)) {
                    obj._count = (obj._count || 0) + 1;
                    if (obj._count >= obj.count) obj._done = true;
                    progress = true;
                }
            } else if (obj.type === 'stealth_kill') {
                if (event.kill && event.silent) {
                    obj._count = (obj._count || 0) + 1;
                    if (obj._count >= obj.count) obj._done = true;
                    progress = true;
                }
            } else if (obj.type === 'timed_kill') {
                if (event.kill) {
                    obj._count = (obj._count || 0) + 1;
                    const elapsed = this.mission.timeLimit - this.missionTimer;
                    if (obj._count >= obj.count && elapsed <= obj.timeLimit) {
                        obj._done = true;
                    }
                    progress = true;
                }
            } else if (obj.type === 'headshot_streak') {
                if (event.headshot) {
                    if (this.headshotStreak >= obj.count) obj._done = true;
                    progress = true;
                } else if (event.kill && !event.headshot) {
                    // Reset streak on non-headshot kill
                }
            }

            if (!obj._done) allDone = false;
        }

        uiManager.updateMissionProgress(this.mission, this.killCount);

        if (allDone) {
            this.completeMission();
        }
    }

    completeMission() {
        this.missionActive = false;
        this.state = 'complete';
        document.exitPointerLock();

        if (this.mission.reward && this.mission.reward.unlock) {
            unlockMission(this.mission.reward.unlock);
        }
        this.totalScore += this.score;

        setTimeout(() => {
            uiManager.showMissionComplete(this.mission, this.score, this.killCount, this.headshotStreak);
        }, CONFIG.GAME.BULLET_CAM_DURATION * 0.5);
    }

    failMission(reason) {
        this.missionActive = false;
        this.missionFailed = true;
        this.state = 'failed';
        document.exitPointerLock();
        uiManager.showMissionFailed(reason);
    }

    startMission(missionId) {
        const mDef = getMission(missionId);
        if (!mDef) return;

        this.mission = JSON.parse(JSON.stringify(mDef));
        this.mission.objectives.forEach(o => { o._count = 0; o._done = false; });
        this.missionActive = true;
        this.missionFailed = false;
        this.killCount = 0;
        this.headshotStreak = 0;
        this.stealthKills = 0;
        this.score = 0;
        this.missionTimer = mDef.timeLimit || 9999;
        this.timedKillTimer = 0;

        // Reset player position
        this.player.pos.set(0, 6, 80);
        this.player.yaw = Math.PI;
        this.player.pitch = -0.05;
        this.player.isAiming = false;

        // Build weapon
        this.buildWeaponVisual();
        const stats = weaponSystem.getEffectiveStats(this.weaponId);
        this.ammo = stats.ammo;
        this.isReloading = false;
        this.boltOpen = false;

        // Spawn targets
        this.spawnTargets(mDef);

        // Randomize wind
        this.randomizeWind();

        this.state = 'playing';
        this.canvas.requestPointerLock();

        document.getElementById('main-menu').classList.add('hidden');
        document.getElementById('mission-select').classList.add('hidden');
        document.getElementById('weapon-menu').classList.add('hidden');
        document.getElementById('hud').classList.remove('hidden');
        document.getElementById('scope-overlay').classList.add('hidden');
        document.getElementById('crosshair').style.display = '';

        uiManager.updateMissionHUD(this.mission);
        uiManager.updateAmmo(this.ammo, stats.ammo);
        uiManager.updateWeaponName(CONFIG.WEAPONS[this.weaponId].name);
        uiManager.updateWind(this.wind);
    }

    pause() {
        this.state = 'paused';
        document.exitPointerLock();
        document.getElementById('pause-menu').classList.remove('hidden');
    }

    resume() {
        this.state = 'playing';
        document.getElementById('pause-menu').classList.add('hidden');
        this.canvas.requestPointerLock();
    }

    onResize() {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.mainCamera.aspect = window.innerWidth / window.innerHeight;
        this.mainCamera.updateProjectionMatrix();
        this.bulletCamObj.aspect = window.innerWidth / window.innerHeight;
        this.bulletCamObj.updateProjectionMatrix();
    }
}

const game = new SniperGame();
