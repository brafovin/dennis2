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
        this.fadingTracers = [];
        this.dustParticles = null;

        this.score = 0;
        this.totalScore = 0;
        this.killLog = [];
        this.missionStartTime = 0;
        this.sessionXP = 0;
        this.sessionXPBreak = { killXP:0, headshotXP:0, distanceXP:0, stealthXP:0, missionXP:0 };
    }

    // ── XP / Rang-System ───────────────────────────────────────────────────
    awardXP(amount, category) {
        try {
            const data = this._loadRankData();
            const prevTotal = data.totalXP || 0;

            data.totalXP       = prevTotal + amount;
            data[category]     = (data[category] || 0) + amount;

            this.sessionXP                        += amount;
            this.sessionXPBreak[category]          = (this.sessionXPBreak[category] || 0) + amount;

            const oldIdx = this._rankIndex(prevTotal);
            const newIdx = this._rankIndex(data.totalXP);
            if (newIdx > oldIdx) {
                data.rankId = CONFIG.RANKS[newIdx].id;
                setTimeout(() => uiManager.showRankUp(CONFIG.RANKS[newIdx]), 600);
            }

            localStorage.setItem('sniperRank', JSON.stringify(data));
        } catch(_) {}
    }

    _loadRankData() {
        try { return JSON.parse(localStorage.getItem('sniperRank') || '{}'); } catch(_) { return {}; }
    }

    _rankIndex(xp) {
        let idx = 0;
        for (let i = 0; i < CONFIG.RANKS.length; i++) {
            if (xp >= CONFIG.RANKS[i].xp) idx = i; else break;
        }
        return idx;
    }

    init() {
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.12;
        this.renderer.outputEncoding = THREE.sRGBEncoding;

        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2(0xbcd8e8, 0.0016);

        this.mainCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.05, 2000);
        this.mainCamera.position.copy(this.player.pos);

        this.bulletCamObj = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.01, 2000);

        // ── Lighting ───────────────────────────────────────────────────────
        const ambient = new THREE.AmbientLight(0xd0e8ff, 0.40);
        this.scene.add(ambient);

        // Primary sun (warm afternoon angle)
        const sun = new THREE.DirectionalLight(0xfff0cc, 1.4);
        sun.position.set(180, 350, 120);
        sun.castShadow = true;
        sun.shadow.mapSize.width  = 2048;
        sun.shadow.mapSize.height = 2048;
        sun.shadow.camera.near   = 1;
        sun.shadow.camera.far    = 1800;
        sun.shadow.camera.left   = -500;
        sun.shadow.camera.right  =  500;
        sun.shadow.camera.top    =  500;
        sun.shadow.camera.bottom = -500;
        sun.shadow.bias = -0.0003;
        sun.shadow.radius = 2.5;
        this.scene.add(sun);

        // Sky / ground hemisphere
        const hemi = new THREE.HemisphereLight(0x88aadd, 0x5a7a3a, 0.42);
        this.scene.add(hemi);

        // Subtle fill light from opposite side
        const fill = new THREE.DirectionalLight(0x8899bb, 0.22);
        fill.position.set(-200, 120, -300);
        this.scene.add(fill);

        this.buildEnvironment();
        this._buildEnvMap();
        this.bindInput();

        window.addEventListener('resize', () => this.onResize());
        this.randomizeWind();
        this.loop();
    }

    buildEnvironment() {
        // ── Sky dome ───────────────────────────────────────────────────────
        const skyGeo = new THREE.SphereGeometry(1450, 24, 12);
        skyGeo.scale(-1, 1, 1);
        const skyMat = new THREE.ShaderMaterial({
            uniforms: {
                topColor:   { value: new THREE.Color(0x1a4499) },
                midColor:   { value: new THREE.Color(0x5aa0cc) },
                horizColor: { value: new THREE.Color(0xbcd8e8) },
                sunDir:     { value: new THREE.Vector3(180, 350, 120).normalize() },
                sunColor:   { value: new THREE.Color(0xfff8e0) },
            },
            vertexShader: `
                varying vec3 vNorm;
                void main() {
                    vNorm = normalize(position);
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 topColor;
                uniform vec3 midColor;
                uniform vec3 horizColor;
                uniform vec3 sunDir;
                uniform vec3 sunColor;
                varying vec3 vNorm;
                void main() {
                    float y = vNorm.y;
                    float t = max(0.0, y);
                    float h = clamp(-y * 3.0 + 0.3, 0.0, 1.0);
                    vec3 col = mix(mix(horizColor, midColor, min(1.0, t * 2.5)), topColor, min(1.0, t * 1.3));
                    col = mix(col, horizColor, h);
                    float sd = dot(vNorm, sunDir);
                    float disc   = smoothstep(0.9992, 0.9998, sd);
                    float corona = smoothstep(0.985,  0.9992, sd) * 0.45;
                    float glow   = smoothstep(0.90,   0.985,  sd) * 0.12;
                    col += sunColor * (disc + corona + glow);
                    gl_FragColor = vec4(col, 1.0);
                }
            `,
            side: THREE.BackSide,
            depthWrite: false,
        });
        this._skyMat = skyMat;
        this.scene.add(new THREE.Mesh(skyGeo, skyMat));

        // ── Clouds (simple flat quads) ─────────────────────────────────────
        const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false });
        const cloudDefs = [
            [0, 280, -400, 120, 30], [-200, 260, -600, 90, 25],
            [300, 270, -800, 140, 35], [-350, 265, -300, 80, 22],
            [150, 255, -1000, 160, 40], [-100, 275, -1100, 110, 28],
        ];
        for (const [cx, cy, cz, cw, ch] of cloudDefs) {
            const cGeo = new THREE.PlaneGeometry(cw, ch);
            const cloud = new THREE.Mesh(cGeo, cloudMat.clone());
            cloud.position.set(cx, cy, cz);
            cloud.rotation.x = -Math.PI / 2 + 0.15;
            this.scene.add(cloud);
        }

        // ── Ground ─────────────────────────────────────────────────────────
        const groundGeo = new THREE.PlaneGeometry(CONFIG.LEVEL.SIZE, CONFIG.LEVEL.SIZE, 4, 4);
        const grassTex = this._makeGrassTex();
        grassTex.repeat.set(80, 80);
        const groundMat = new THREE.MeshStandardMaterial({
            map: grassTex,
            bumpMap: grassTex, bumpScale: 0.08,
            roughness: 0.92, metalness: 0.0,
        });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);

        // Dirt patches
        const dirtMat = new THREE.MeshStandardMaterial({ color: 0x8a7450, roughness: 0.95 });
        for (const [dx, dz, ds] of [[0, -50, 14], [0, -500, 20], [0, -1000, 30]]) {
            const dGeo = new THREE.PlaneGeometry(ds, ds * 0.7);
            const d = new THREE.Mesh(dGeo, dirtMat);
            d.rotation.x = -Math.PI / 2;
            d.position.set(dx, 0.005, dz);
            this.scene.add(d);
        }

        // Road (asphalt look)
        const roadTex = this._makeRoadTex();
        roadTex.repeat.set(1, 50);
        const roadMat = new THREE.MeshStandardMaterial({ map: roadTex, bumpMap: roadTex, bumpScale: 0.03, color: 0x888880, roughness: 0.92, metalness: 0.0 });
        const roadGeo = new THREE.PlaneGeometry(6, 1400);
        const road = new THREE.Mesh(roadGeo, roadMat);
        road.rotation.x = -Math.PI / 2;
        road.position.set(0, 0.012, -600);
        road.receiveShadow = true;
        this.scene.add(road);

        // Road center line
        const lineGeo = new THREE.PlaneGeometry(0.2, 1400);
        const lineMat = new THREE.MeshBasicMaterial({ color: 0xe8e060 });
        const line = new THREE.Mesh(lineGeo, lineMat);
        line.rotation.x = -Math.PI / 2;
        line.position.set(0, 0.015, -600);
        this.scene.add(line);

        // ── Sniper nest ────────────────────────────────────────────────────
        const nestMat = new THREE.MeshStandardMaterial({ color: 0x706050, roughness: 0.88, metalness: 0.05 });
        const nestGeo = new THREE.BoxGeometry(10, 6, 8);
        const nest = new THREE.Mesh(nestGeo, nestMat);
        nest.position.set(0, 0, 80);
        nest.castShadow = true;
        nest.receiveShadow = true;
        this.scene.add(nest);

        // Nest ledge / wall
        const ledgeGeo = new THREE.BoxGeometry(10, 0.9, 0.5);
        const ledge = new THREE.Mesh(ledgeGeo, nestMat);
        ledge.position.set(0, 3.45, 75.75);
        this.scene.add(ledge);

        // Sandbags
        for (let i = -2; i <= 2; i++) {
            this.addSandbag(i * 1.4, 3.05, 76);
        }

        // ── Buildings ──────────────────────────────────────────────────────
        const buildingDefs = [
            { x: 35,  z: -100, w: 12, h: 18, d: 10, c: 0x9a8878, rc: 0x7a6858 },
            { x: -40, z: -120, w: 10, h: 14, d: 10, c: 0x8a9878, rc: 0x6a7858 },
            { x: 50,  z: -200, w: 14, h: 20, d: 12, c: 0xa09080, rc: 0x806050 },
            { x: -55, z: -220, w: 16, h: 16, d: 12, c: 0x9a8870, rc: 0x786848 },
            { x: 60,  z: -350, w: 12, h: 22, d: 10, c: 0x88887a, rc: 0x686858 },
            { x: -60, z: -380, w: 18, h: 18, d: 14, c: 0x909888, rc: 0x707868 },
            { x: 80,  z: -500, w: 16, h: 24, d: 14, c: 0x807870, rc: 0x605848 },
            { x: -80, z: -520, w: 14, h: 20, d: 12, c: 0x908878, rc: 0x706858 },
            { x: 100, z: -700, w: 20, h: 28, d: 16, c: 0x706a60, rc: 0x504840 },
            { x:-100, z: -750, w: 18, h: 22, d: 14, c: 0x787868, rc: 0x585848 },
            { x: 120, z: -900, w: 16, h: 20, d: 14, c: 0x706860, rc: 0x504840 },
        ];
        for (const def of buildingDefs) this.addBuilding(def);

        // ── Trees ──────────────────────────────────────────────────────────
        const treeDefs = [
            [-15,-80,1.0], [18,-90,1.1], [-25,-160,0.9], [22,-170,1.2],
            [-30,-300,1.0], [35,-310,1.1], [-45,-450,0.8], [40,-460,1.3],
            [-50,-600,1.0], [55,-590,0.9], [-60,-750,1.1], [65,-760,1.0],
            [-70,-870,1.2], [70,-880,0.85], [-80,-950,1.0], [80,-960,1.15],
            [-22,-130,0.9], [28,-240,1.0], [-38,-340,1.1], [42,-430,0.95],
        ];
        for (const [tx, tz, ts] of treeDefs) this.addTree(tx, tz, ts);

        // ── Rocks & cover ──────────────────────────────────────────────────
        const rockPos = [
            [-10,-130], [12,-145], [-18,-290], [20,-280],
            [-25,-420], [28,-410], [-35,-560], [38,-570],
            [-48,-680], [45,-700],
        ];
        for (const [rx, rz] of rockPos) this.addRock(rx, rz);

        // Concrete barriers / bollards
        this.addBarrier(0, -100, 8, 1.8);
        this.addBarrier(-15, -200, 5, 1.5);
        this.addBarrier(18, -300, 6, 1.6);

        // Distant hills (background)
        const hillMat = new THREE.MeshStandardMaterial({ color: 0x5a7050, roughness: 1 });
        for (const [hx, hz, hr, hh] of [
            [400, -800, 180, 60], [-500, -900, 220, 80], [200, -1100, 160, 55],
            [-300, -1000, 200, 70], [0, -1200, 250, 90],
        ]) {
            const hGeo = new THREE.SphereGeometry(hr, 10, 6, 0, Math.PI * 2, 0, Math.PI / 3);
            const hill = new THREE.Mesh(hGeo, hillMat);
            hill.position.set(hx, -hr * 0.55 + hh * 0.3, hz);
            hill.scale.y = 0.28 + Math.random() * 0.1;
            this.scene.add(hill);
        }

        // ── Street lamps along road ────────────────────────────────────────
        for (let lz = -100; lz >= -880; lz -= 80) {
            this.addStreetLamp(-4.5, lz);
            if (lz - 40 >= -900) this.addStreetLamp(4.5, lz - 40);
        }

        // ── Parked cars near buildings ─────────────────────────────────────
        this.addCar( 30,  -95,  0.05, 0x4a5a7a);
        this.addCar(-38, -115, Math.PI - 0.1, 0x7a3a30);
        this.addCar( 48, -185,  0.15, 0x3a5a3a);
        this.addCar(-52, -215, -0.08, 0x7a7a50);
        this.addCar( 62, -330, -0.05, 0x5a3a2a);
        this.addCar(-65, -370, Math.PI + 0.1, 0x2a4a6a);

        this.addSunFlare();
        this.addDust();

        // ── Muzzle flash light ─────────────────────────────────────────────
        const flashLight = new THREE.PointLight(0xffcc44, 5, 3);
        flashLight.visible = false;
        this.scene.add(flashLight);
        this.muzzleFlashLight = flashLight;
    }

    addBuilding(def) {
        const { x, z, w, h, d, c, rc } = def;

        if (!this._texConc) this._texConc = this._makeConcTex();
        const mat    = new THREE.MeshStandardMaterial({ color: c, map: this._texConc, bumpMap: this._texConc, bumpScale: 0.04, roughness: 0.82, metalness: 0.05 });
        const roofMat= new THREE.MeshStandardMaterial({ color: rc, roughness: 0.80, metalness: 0.08 });
        const darkMat= new THREE.MeshStandardMaterial({ color: 0x0e1218, roughness: 0.12, metalness: 0.65 });
        const frameMat=new THREE.MeshStandardMaterial({ color: 0xccbbaa, roughness: 0.75 });

        // Main body
        const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        body.position.set(x, h / 2, z);
        body.castShadow = true;
        body.receiveShadow = true;
        this.scene.add(body);
        this.environmentMeshes.push(body);

        // Roof ledge
        const ledgeGeo = new THREE.BoxGeometry(w + 0.6, 0.5, d + 0.6);
        const ledge = new THREE.Mesh(ledgeGeo, roofMat);
        ledge.position.set(x, h + 0.25, z);
        ledge.castShadow = true;
        this.scene.add(ledge);

        // Roof
        const roofGeo = new THREE.BoxGeometry(w - 0.3, 0.3, d - 0.3);
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.position.set(x, h + 0.65, z);
        this.scene.add(roof);

        // Corner columns (slightly darker to suggest structure)
        const colMat = new THREE.MeshStandardMaterial({ color: ((c & 0xfefefe) >> 1), roughness: 0.85 });
        for (const [cx, cz] of [[-w/2, -d/2], [w/2, -d/2], [-w/2, d/2], [w/2, d/2]]) {
            const colGeo = new THREE.BoxGeometry(0.7, h + 0.1, 0.7);
            const col = new THREE.Mesh(colGeo, colMat);
            col.position.set(x + cx, h / 2, z + cz);
            col.castShadow = true;
            this.scene.add(col);
        }

        // Windows with frames
        const rows = Math.floor(h / 3.8);
        const cols = Math.floor(w / 3.2);
        const startX = x - w / 2 + 1.8;
        for (let r = 1; r <= rows - 1; r++) {
            for (let col = 0; col < cols - 1; col++) {
                const wx = startX + col * 3.2;
                const wy = r * 3.8 - 0.5;
                const wz = z + d / 2;

                // Window glass (some windows are lit)
                const glassGeo = new THREE.BoxGeometry(1.3, 1.6, 0.08);
                const lit = Math.random() < 0.16;
                const gMat = lit
                    ? new THREE.MeshStandardMaterial({ color: 0x2a2410, emissive: 0xffcb66, emissiveIntensity: 0.85, roughness: 0.4, metalness: 0.1 })
                    : darkMat;
                const glass = new THREE.Mesh(glassGeo, gMat);
                glass.position.set(wx, wy, wz + 0.01);
                this.scene.add(glass);

                // Window frame
                const frameGeo = new THREE.BoxGeometry(1.55, 1.85, 0.06);
                const frame = new THREE.Mesh(frameGeo, frameMat);
                frame.position.set(wx, wy, wz);
                this.scene.add(frame);

                // Window sill
                const sillGeo = new THREE.BoxGeometry(1.6, 0.1, 0.18);
                const sill = new THREE.Mesh(sillGeo, frameMat);
                sill.position.set(wx, wy - 0.93, wz + 0.05);
                this.scene.add(sill);
            }
        }

        // Door
        const doorGeo = new THREE.BoxGeometry(1.4, 2.4, 0.08);
        const door = new THREE.Mesh(doorGeo, new THREE.MeshStandardMaterial({ color: 0x4a3820, roughness: 0.85 }));
        door.position.set(x, 1.2, z + d / 2 + 0.01);
        this.scene.add(door);
        const doorFrameGeo = new THREE.BoxGeometry(1.7, 2.7, 0.06);
        const doorFrame = new THREE.Mesh(doorFrameGeo, frameMat);
        doorFrame.position.set(x, 1.35, z + d / 2);
        this.scene.add(doorFrame);
    }

    addSandbag(x, y, z) {
        const geo = new THREE.BoxGeometry(1.15, 0.52, 0.52);
        const mat = new THREE.MeshStandardMaterial({ color: 0xb8a472, roughness: 0.94, metalness: 0 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, y, z);
        mesh.rotation.y = (Math.random() - 0.5) * 0.15;
        mesh.castShadow = true;
        this.scene.add(mesh);
    }

    addTree(x, z, scale = 1.0) {
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3220, roughness: 0.95, metalness: 0 });
        const foliage1Mat = new THREE.MeshStandardMaterial({ color: 0x2d5822, roughness: 0.95 });
        const foliage2Mat = new THREE.MeshStandardMaterial({ color: 0x3a6a28, roughness: 0.95 });

        const trunkH = 2.8 * scale;
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18 * scale, 0.26 * scale, trunkH, 7), trunkMat);
        trunk.position.set(x, trunkH / 2, z);
        trunk.castShadow = true;
        this.scene.add(trunk);

        // Multi-layer foliage
        const layerDefs = [
            { r: 2.0 * scale, h: 3.2 * scale, y: trunkH + 0.8 * scale, mat: foliage1Mat },
            { r: 1.5 * scale, h: 2.4 * scale, y: trunkH + 2.2 * scale, mat: foliage2Mat },
            { r: 1.0 * scale, h: 1.8 * scale, y: trunkH + 3.2 * scale, mat: foliage1Mat },
        ];
        for (const l of layerDefs) {
            const cone = new THREE.Mesh(new THREE.ConeGeometry(l.r, l.h, 8), l.mat);
            cone.position.set(x, l.y, z);
            cone.rotation.y = Math.random() * Math.PI;
            cone.castShadow = true;
            this.scene.add(cone);
        }
    }

    addRock(x, z) {
        const s = 0.8 + Math.random() * 0.9;
        const mat = new THREE.MeshStandardMaterial({
            color: 0x787870,
            roughness: 0.92,
            metalness: 0.04,
        });
        const geo = new THREE.DodecahedronGeometry(s, 0);
        // Flatten rocks
        const rock = new THREE.Mesh(geo, mat);
        rock.scale.y = 0.55 + Math.random() * 0.2;
        rock.position.set(x, s * 0.28, z);
        rock.rotation.y = Math.random() * Math.PI;
        rock.castShadow = true;
        rock.receiveShadow = true;
        this.scene.add(rock);
    }

    addBarrier(x, z, width, height) {
        const mat = new THREE.MeshStandardMaterial({ color: 0x8a8880, roughness: 0.88, metalness: 0.06 });
        const geo = new THREE.BoxGeometry(width, height, 0.36);
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, height / 2, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.scene.add(mesh);

        // Barrier chevron stripe
        const stripeMat = new THREE.MeshBasicMaterial({ color: 0xffcc00 });
        for (let i = 0; i < 3; i++) {
            const sGeo = new THREE.BoxGeometry(0.4, height * 0.7, 0.38);
            const s = new THREE.Mesh(sGeo, stripeMat);
            s.position.set(x - width / 2 + 1 + i * 2.8, height / 2, z);
            this.scene.add(s);
        }
    }

    _makeTexture(size, fn) {
        const cv = document.createElement('canvas');
        cv.width = cv.height = size;
        const ctx = cv.getContext('2d');
        fn(ctx, size);
        const tex = new THREE.CanvasTexture(cv);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        return tex;
    }

    _makeGrassTex() {
        return this._makeTexture(512, (ctx, s) => {
            ctx.fillStyle = '#4a6a38';
            ctx.fillRect(0, 0, s, s);
            for (let i = 0; i < 700; i++) {
                const x = Math.random() * s, y = Math.random() * s;
                const r = 5 + Math.random() * 20;
                const hue = 88 + Math.random() * 30;
                const lit = 26 + Math.random() * 16;
                ctx.fillStyle = `hsl(${hue},44%,${lit}%)`;
                ctx.beginPath();
                ctx.ellipse(x, y, r, r * 0.55, Math.random() * Math.PI, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 0.55;
            for (let i = 0; i < 2500; i++) {
                const x = Math.random() * s, y = Math.random() * s;
                const a = (Math.random() - 0.5) * 0.5;
                const l = 4 + Math.random() * 9;
                ctx.strokeStyle = `hsl(${93 + Math.random() * 22},48%,${28 + Math.random() * 16}%)`;
                ctx.lineWidth = 0.6;
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(x + Math.sin(a) * l, y - Math.cos(a) * l);
                ctx.stroke();
            }
            ctx.globalAlpha = 1;
        });
    }

    _makeConcTex() {
        return this._makeTexture(512, (ctx, s) => {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, s, s);
            for (let i = 0; i < 8000; i++) {
                const v = 30 + Math.floor(Math.random() * 80);
                ctx.fillStyle = `rgba(${v},${v},${v},${0.04 + Math.random() * 0.06})`;
                ctx.fillRect(Math.random() * s, Math.random() * s, 1 + Math.random() * 3, 1 + Math.random() * 3);
            }
            ctx.globalAlpha = 0.1;
            for (let i = 1; i <= 10; i++) {
                const y = (s / 10) * i;
                ctx.strokeStyle = '#666';
                ctx.lineWidth = 0.6;
                ctx.beginPath();
                ctx.moveTo(0, y + (Math.random() - 0.5) * 2);
                ctx.lineTo(s, y + (Math.random() - 0.5) * 2);
                ctx.stroke();
            }
            ctx.globalAlpha = 0.07;
            for (let c = 0; c < 5; c++) {
                let px = Math.random() * s, py = Math.random() * s;
                ctx.strokeStyle = '#444';
                ctx.lineWidth = 0.7;
                ctx.beginPath();
                ctx.moveTo(px, py);
                for (let st = 0; st < 10; st++) {
                    px += (Math.random() - 0.5) * 24;
                    py += Math.random() * 18;
                    ctx.lineTo(px, py);
                }
                ctx.stroke();
            }
            ctx.globalAlpha = 1;
        });
    }

    _makeRoadTex() {
        return this._makeTexture(256, (ctx, s) => {
            ctx.fillStyle = '#1e1e18';
            ctx.fillRect(0, 0, s, s);
            for (let i = 0; i < 5000; i++) {
                const v = 32 + Math.floor(Math.random() * 52);
                ctx.fillStyle = `rgba(${v},${v},${Math.max(0, v - 5)},0.55)`;
                ctx.fillRect(Math.random() * s, Math.random() * s, 0.5 + Math.random() * 2, 0.5 + Math.random() * 2);
            }
            ctx.globalAlpha = 0.28;
            for (let t = 0; t < 2; t++) {
                ctx.fillStyle = '#080806';
                ctx.fillRect(s * 0.26 + t * s * 0.48 - 8, 0, 16, s);
            }
            ctx.globalAlpha = 1;
        });
    }

    addSunFlare() {
        const tex = this._makeTexture(128, (ctx, s) => {
            const g = ctx.createRadialGradient(s/2, s/2, 0, s/2, s/2, s/2);
            g.addColorStop(0.0, 'rgba(255,250,235,0.95)');
            g.addColorStop(0.2, 'rgba(255,242,200,0.55)');
            g.addColorStop(0.5, 'rgba(255,224,160,0.16)');
            g.addColorStop(1.0, 'rgba(255,224,160,0.0)');
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, s, s);
        });
        const mat = new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, depthTest: false });
        const sprite = new THREE.Sprite(mat);
        const dir = new THREE.Vector3(180, 350, 120).normalize();
        sprite.position.copy(dir.multiplyScalar(1250));
        sprite.scale.set(340, 340, 1);
        this.scene.add(sprite);
    }

    addDust() {
        const N = 460;
        const positions = new Float32Array(N * 3);
        for (let i = 0; i < N; i++) {
            positions[i*3]   = (Math.random() - 0.5) * 190;
            positions[i*3+1] = Math.random() * 28 + 0.5;
            positions[i*3+2] = 80 - Math.random() * 280;
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const tex = this._makeTexture(32, (ctx, s) => {
            const g = ctx.createRadialGradient(s/2, s/2, 0, s/2, s/2, s/2);
            g.addColorStop(0, 'rgba(255,255,245,1)');
            g.addColorStop(1, 'rgba(255,255,245,0)');
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, s, s);
        });
        const mat = new THREE.PointsMaterial({ size: 0.45, map: tex, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
        const pts = new THREE.Points(geo, mat);
        pts.frustumCulled = false;
        this.scene.add(pts);
        this.dustParticles = pts;
    }

    _buildEnvMap() {
        try {
            const envScene = new THREE.Scene();
            const g = new THREE.SphereGeometry(10, 24, 12);
            g.scale(-1, 1, 1);
            envScene.add(new THREE.Mesh(g, this._skyMat));
            const pmrem = new THREE.PMREMGenerator(this.renderer);
            const rt = pmrem.fromScene(envScene, 0.04);
            this.scene.environment = rt.texture;
            pmrem.dispose();
            g.dispose();
        } catch (_) {}
    }

    _initBulletTracer(b) {
        const maxPts = 64;
        const arr = new Float32Array(maxPts * 3);
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
        geo.setDrawRange(0, 0);
        const col = (b.tracerColor !== undefined) ? b.tracerColor : 0xffd27a;
        const mat = new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
        const line = new THREE.Line(geo, mat);
        line.frustumCulled = false;
        this.scene.add(line);
        const headCol = new THREE.Color(col).lerp(new THREE.Color(0xffffff), 0.55);
        const headMat = new THREE.MeshBasicMaterial({ color: headCol, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), headMat);
        head.frustumCulled = false;
        this.scene.add(head);
        b.trail = [];
        b.trailMax = maxPts;
        b.trailLine = line;
        b.tracerHead = head;
    }

    _writeTrail(b) {
        const arr = b.trailLine.geometry.attributes.position.array;
        for (let i = 0; i < b.trail.length; i++) {
            arr[i*3]   = b.trail[i].x;
            arr[i*3+1] = b.trail[i].y;
            arr[i*3+2] = b.trail[i].z;
        }
        b.trailLine.geometry.attributes.position.needsUpdate = true;
        b.trailLine.geometry.setDrawRange(0, b.trail.length);
    }

    _retireTracer(b) {
        if (!b.trailLine) return;
        b.trail.push(b.pos.clone());
        if (b.trail.length > b.trailMax) b.trail.shift();
        this._writeTrail(b);
        this.fadingTracers.push({ line: b.trailLine, head: b.tracerHead, ttl: 2.5, max: 2.5 });
        b.trailLine = null;
        b.tracerHead = null;
        b.trail = null;
    }

    _updateFadingTracers(dt) {
        for (let i = this.fadingTracers.length - 1; i >= 0; i--) {
            const f = this.fadingTracers[i];
            f.ttl -= dt;
            const a = Math.max(0, f.ttl / f.max);
            f.line.material.opacity = a * 0.9;
            if (f.head) f.head.material.opacity = a;
            if (f.ttl <= 0) {
                this.scene.remove(f.line);
                f.line.geometry.dispose();
                f.line.material.dispose();
                if (f.head) {
                    this.scene.remove(f.head);
                    f.head.geometry.dispose();
                    f.head.material.dispose();
                }
                this.fadingTracers.splice(i, 1);
            }
        }
    }

    _updateDust(dt) {
        if (!this.dustParticles) return;
        const arr = this.dustParticles.geometry.attributes.position.array;
        const tt = performance.now() * 0.0003;
        for (let i = 0; i < arr.length; i += 3) {
            arr[i+1] += dt * 0.35;
            arr[i]   += Math.sin(tt + i) * dt * 0.25;
            if (arr[i+1] > 30) arr[i+1] = 0.5;
        }
        this.dustParticles.geometry.attributes.position.needsUpdate = true;
    }

    addStreetLamp(x, z) {
        const poleMat = new THREE.MeshStandardMaterial({ color: 0x888880, roughness: 0.65, metalness: 0.55 });
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 0.3, 8), poleMat);
        base.position.set(x, 0.15, z);
        this.scene.add(base);
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, 7.2, 8), poleMat);
        pole.position.set(x, 3.9, z);
        pole.castShadow = true;
        this.scene.add(pole);
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.8, 6), poleMat);
        arm.position.set(x + 0.9, 7.5, z);
        arm.rotation.z = Math.PI / 2;
        this.scene.add(arm);
        const housingMat = new THREE.MeshStandardMaterial({ color: 0x505050, roughness: 0.5, metalness: 0.7 });
        const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.18, 0.28, 8), housingMat);
        housing.position.set(x + 1.8, 7.3, z);
        this.scene.add(housing);
        const lensMat = new THREE.MeshBasicMaterial({ color: 0xfff5aa });
        const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.06, 8), lensMat);
        lens.position.set(x + 1.8, 7.1, z);
        this.scene.add(lens);
    }

    addCar(x, z, ry, colorHex) {
        const group = new THREE.Group();
        group.position.set(x, 0, z);
        group.rotation.y = ry;
        const bodyMat  = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.28, metalness: 0.65 });
        const glassMat = new THREE.MeshStandardMaterial({ color: 0x334455, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.6 });
        const tireMat  = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
        const rimMat   = new THREE.MeshStandardMaterial({ color: 0xbbbbbb, roughness: 0.3, metalness: 0.8 });
        const bumpMat  = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.75 });
        const bodyLow  = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.7, 4.2), bodyMat);
        bodyLow.position.set(0, 0.65, 0);
        bodyLow.castShadow = true;
        group.add(bodyLow);
        const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.65, 2.2), bodyMat);
        cabin.position.set(0, 1.33, -0.1);
        cabin.castShadow = true;
        group.add(cabin);
        const frontWin = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.52, 0.06), glassMat);
        frontWin.position.set(0, 1.33, -1.18);
        group.add(frontWin);
        const rearWin = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.52, 0.06), glassMat);
        rearWin.position.set(0, 1.33, 0.99);
        group.add(rearWin);
        const wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.22, 12);
        const rimGeo   = new THREE.CylinderGeometry(0.18, 0.18, 0.24, 8);
        for (const [wx, wz] of [[-0.9, -1.3], [0.9, -1.3], [-0.9, 1.3], [0.9, 1.3]]) {
            const wheel = new THREE.Mesh(wheelGeo, tireMat);
            wheel.position.set(wx, 0.32, wz);
            wheel.rotation.z = Math.PI / 2;
            group.add(wheel);
            const rim = new THREE.Mesh(rimGeo, rimMat);
            rim.position.set(wx, 0.32, wz);
            rim.rotation.z = Math.PI / 2;
            group.add(rim);
        }
        const frontBump = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.24, 0.1), bumpMat);
        frontBump.position.set(0, 0.42, -2.15);
        group.add(frontBump);
        const rearBump = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.24, 0.1), bumpMat);
        rearBump.position.set(0, 0.42, 2.15);
        group.add(rearBump);
        this.scene.add(group);
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

        // FP weapon position — lower right, slight inward lean
        this.weaponGroup.position.set(0.20, -0.165, -0.36);
        this.weaponGroup.rotation.y = Math.PI;
        this.weaponGroup.rotation.z = -0.04;

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
            if (e.code === 'KeyB' && this.state === 'playing') this.cycleAmmo();
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
            windMult:    stats.windMult,
            gravityMult: stats.gravityMult,
            pierceLeft:  stats.pierce,
            incendiary:  stats.incendiary,
            tracerColor: stats.tracerColor,
            hitTargets:  new Set(),
        };
        this.bullets.push(bullet);
        this._initBulletTracer(bullet);

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

    cycleAmmo() {
        if (this.bulletCamActive || this.isReloading) return;
        const ids = Object.keys(CONFIG.AMMO);
        const lo  = weaponSystem.getLoadout(this.weaponId);
        const idx = ids.indexOf(lo.ammoType);
        const next = ids[(idx + 1) % ids.length];
        weaponSystem.setAmmo(this.weaponId, next);
        uiManager.updateAmmoType(CONFIG.AMMO[next]);
        uiManager.flashAmmoType();
    }

    spawnFire(target) {
        const light = new THREE.PointLight(0xff6618, 3, 7);
        light.position.copy(target.group.position);
        light.position.y = 1.2;
        this.scene.add(light);

        if (!this._fireTex) {
            this._fireTex = this._makeTexture(32, (ctx, s) => {
                const g = ctx.createRadialGradient(s/2, s/2, 0, s/2, s/2, s/2);
                g.addColorStop(0.0, 'rgba(255,235,150,1)');
                g.addColorStop(0.5, 'rgba(255,120,20,0.7)');
                g.addColorStop(1.0, 'rgba(120,20,0,0)');
                ctx.fillStyle = g;
                ctx.fillRect(0, 0, s, s);
            });
        }

        const sprites = [];
        for (let i = 0; i < 6; i++) {
            const m = new THREE.SpriteMaterial({ map: this._fireTex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
            const sp = new THREE.Sprite(m);
            sp.scale.set(0.55, 0.85, 1);
            sp.position.set((Math.random() - 0.5) * 0.45, 0.7 + Math.random() * 0.7, (Math.random() - 0.5) * 0.35);
            target.group.add(sp);
            sprites.push(sp);
        }

        let life = 0;
        const dur = 2.8;
        const anim = () => {
            life += 0.033;
            light.intensity = 2.2 + Math.sin(life * 26) * 1.4;
            for (const sp of sprites) {
                sp.position.y += 0.013;
                sp.material.opacity = Math.max(0, 1 - life / dur);
            }
            if (life >= dur) {
                this.scene.remove(light);
                for (const sp of sprites) target.group.remove(sp);
                return;
            }
            requestAnimationFrame(anim);
        };
        anim();
    }

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
        this._updateFadingTracers(dt);
        this._updateDust(dt);
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

        const swayAmt = 0.0006 * stabMult * swayMult * aimMult * (stats.swayMult || 1);
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

            b.vel.addScaledVector(gravity, dt * (b.gravityMult || 1));
            b.vel.x += this.wind.x * 0.003 * (b.windMult || 1);
            b.vel.z += this.wind.y * 0.003 * (b.windMult || 1);

            const prevPos = b.pos.clone();
            b.pos.addScaledVector(b.vel, dt);
            b.traveled += b.vel.length() * dt;

            if (b.trail) {
                b.trail.push(b.pos.clone());
                if (b.trail.length > b.trailMax) b.trail.shift();
                this._writeTrail(b);
                if (b.tracerHead) b.tracerHead.position.copy(b.pos);
            }

            if (b.alive) {
                const seg = b.pos.clone().sub(prevPos);
                const segLen = seg.length();
                if (segLen > 0) {
                    const ray = new THREE.Raycaster(prevPos, seg.clone().normalize(), 0, segLen + 0.1);
                    const hitObjects = [];
                    for (const t of this.targets) {
                        if (t.alive && !b.hitTargets.has(t.id)) hitObjects.push(...Object.values(t.hitParts));
                    }
                    const hits = ray.intersectObjects(hitObjects);
                    if (hits.length > 0) {
                        const h = hits[0];
                        const target = this.targets.find(t => t.id === h.object.userData.targetId);
                        if (target && target.alive) {
                            b.hitTargets.add(target.id);
                            this.onHit(b, target, h.object.userData.hitzone, h.point);
                            // Panzerbrechende Munition durchschlägt mehrere Ziele
                            b.pierceLeft = (b.pierceLeft || 1) - 1;
                            if (b.pierceLeft <= 0) {
                                b.alive = false;
                                b.hitRegistered = true;
                            }
                        }
                    }
                }
            }

            if (b.pos.y < 0) { this.spawnImpactDust(b.pos); b.alive = false; }
            if (b.traveled > b.weaponStats.range) b.alive = false;
        }

        const stillAlive = [];
        for (const b of this.bullets) {
            if (b.alive) stillAlive.push(b);
            else this._retireTracer(b);
        }
        this.bullets = stillAlive;
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
        const elapsedSec = Math.round((Date.now() - this.missionStartTime) / 100) / 10;

        // Start bullet cam (only once per shot — the first kill of a piercing round)
        if (!this.bulletCamActive) this.startBulletCam(bullet, hitPoint, zone);

        // Brandmunition entzündet das Ziel
        if (bullet.incendiary) this.spawnFire(target);

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
        if (bullet.incendiary) pts += 50;
        this.score += pts;

        // ── XP awards ────────────────────────────────────────────────────
        this.awardXP(CONFIG.XP.KILL, 'killXP');
        if (isHeadshot) this.awardXP(CONFIG.XP.HEADSHOT, 'headshotXP');
        if (bullet.silent) this.awardXP(CONFIG.XP.SILENT, 'stealthXP');
        if      (dist >= 1000) this.awardXP(CONFIG.XP.DIST_1000, 'distanceXP');
        else if (dist >=  900) this.awardXP(CONFIG.XP.DIST_900,  'distanceXP');
        else if (dist >=  600) this.awardXP(CONFIG.XP.DIST_600,  'distanceXP');
        else if (dist >=  300) this.awardXP(CONFIG.XP.DIST_300,  'distanceXP');
        else if (dist >=  100) this.awardXP(CONFIG.XP.DIST_100,  'distanceXP');

        // Kill log entry
        this.killLog.push({
            n:       this.killLog.length + 1,
            dist,
            time:    elapsedSec,
            zone:    isHeadshot ? 'KOPF' : zone === 'leg' ? 'BEIN' : 'KÖRPER',
            weapon:  CONFIG.WEAPONS[this.weaponId].name,
            mission: this.mission ? this.mission.name : '—',
            silent:  bullet.silent,
            pts,
        });

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

        // Persist best mission time + award mission XP
        const elapsed = Math.round((Date.now() - this.missionStartTime) / 100) / 10;
        try {
            const best = JSON.parse(localStorage.getItem('sniperBest') || '{}');
            const isFirstClear = !best[this.mission.id];
            if (isFirstClear || elapsed < best[this.mission.id].time) {
                best[this.mission.id] = { time: elapsed, kills: this.killCount, score: this.score };
                localStorage.setItem('sniperBest', JSON.stringify(best));
            }
            this.awardXP(CONFIG.XP.MISSION_DONE, 'missionXP');
            if (isFirstClear) this.awardXP(CONFIG.XP.FIRST_CLEAR, 'missionXP');
        } catch(_) {}

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
        this.killLog = [];
        this.missionStartTime = Date.now();
        this.sessionXP = 0;
        this.sessionXPBreak = { killXP:0, headshotXP:0, distanceXP:0, stealthXP:0, missionXP:0 };

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
        uiManager.updateAmmoType(weaponSystem.getAmmo(this.weaponId));
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
