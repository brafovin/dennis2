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
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.05;
        this.renderer.outputEncoding = THREE.sRGBEncoding;

        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2(0xb8d4e8, 0.0018);

        this.mainCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.05, 2000);
        this.mainCamera.position.copy(this.player.pos);

        this.bulletCamObj = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.01, 2000);

        // ── Lighting ───────────────────────────────────────────────────────
        const ambient = new THREE.AmbientLight(0xd0e8ff, 0.55);
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
        this.scene.add(sun);

        // Sky / ground hemisphere
        const hemi = new THREE.HemisphereLight(0x88aadd, 0x5a7a3a, 0.55);
        this.scene.add(hemi);

        // Subtle fill light from opposite side
        const fill = new THREE.DirectionalLight(0x8899bb, 0.22);
        fill.position.set(-200, 120, -300);
        this.scene.add(fill);

        this.buildEnvironment();
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
                topColor:    { value: new THREE.Color(0x2255aa) },
                midColor:    { value: new THREE.Color(0x7ab2d4) },
                horizColor:  { value: new THREE.Color(0xc8dce8) },
            },
            vertexShader: `
                varying float vY;
                void main() {
                    vY = normalize(position).y;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 topColor;
                uniform vec3 midColor;
                uniform vec3 horizColor;
                varying float vY;
                void main() {
                    float t = max(0.0, vY);
                    float h = max(0.0, -vY * 3.0 + 0.3);
                    vec3 col = mix(mix(horizColor, midColor, min(1.0, t * 2.5)), topColor, min(1.0, t * 1.3));
                    col = mix(col, horizColor, clamp(h, 0.0, 1.0));
                    gl_FragColor = vec4(col, 1.0);
                }
            `,
            side: THREE.BackSide,
            depthWrite: false,
        });
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
        const groundGeo = new THREE.PlaneGeometry(CONFIG.LEVEL.SIZE, CONFIG.LEVEL.SIZE, 60, 60);
        // Subtle vertex color variation
        const posAttr = groundGeo.attributes.position;
        const colors = [];
        for (let i = 0; i < posAttr.count; i++) {
            const n = (Math.sin(posAttr.getX(i) * 0.04) * Math.cos(posAttr.getZ(i) * 0.06) + 1) * 0.5;
            colors.push(0.30 + n * 0.06, 0.44 + n * 0.08, 0.20 + n * 0.04);
        }
        groundGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        const groundMat = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.90, metalness: 0.0,
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
        const roadMat = new THREE.MeshStandardMaterial({ color: 0x5a5a52, roughness: 0.92, metalness: 0.0 });
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

        // ── Muzzle flash light ─────────────────────────────────────────────
        const flashLight = new THREE.PointLight(0xffcc44, 5, 3);
        flashLight.visible = false;
        this.scene.add(flashLight);
        this.muzzleFlashLight = flashLight;
    }

    addBuilding(def) {
        const { x, z, w, h, d, c, rc } = def;

        const mat    = new THREE.MeshStandardMaterial({ color: c,  roughness: 0.82, metalness: 0.05 });
        const roofMat= new THREE.MeshStandardMaterial({ color: rc, roughness: 0.80, metalness: 0.08 });
        const darkMat= new THREE.MeshStandardMaterial({ color: 0x181818, roughness: 0.5, metalness: 0.3 });
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

                // Window glass
                const glassGeo = new THREE.BoxGeometry(1.3, 1.6, 0.08);
                const glass = new THREE.Mesh(glassGeo, darkMat);
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
