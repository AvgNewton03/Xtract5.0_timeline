import { useRef, useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';

const STEAM_COUNT = 60;

// Framing. The model spans ±0.95 along x and sits on y ≈ -0.181 (local units).
const HALF_LENGTH = 0.95;
const MODEL_FLOOR = -0.181;
const YAW = 0.32; // ~18°: nose swings toward camera so the front face reads
const TRACK_DIR = new THREE.Vector3(Math.cos(YAW), 0, Math.sin(YAW));
const CAMERA_POS = [0, 0.75, 5];
const CAMERA_TARGET = [0, -0.25, 0];
const NOSE_AT = 0.54; // first stop: nose just past centre, clear of the copy column
const TRAVEL = 0.05; // total drift from first stop to last — it only edges forward
const START_BACK = 1.6; // how far down the line (viewport widths) the train starts

// The run between stops
const TRAVEL_TIME = 1.6; // seconds of running per stop change
const SURGE = 0.025; // how far (viewport widths) the train eases ahead of its berth mid-run
const RUN_SPEED = 16; // peak speed the scenery streams past, units/s

// Final stop: the train pulls in, holds, then departs and the track dissolves behind it
const DEPART_DELAY = 1.8; // seconds after arriving at the last stop
const DEPART_ACCEL = 2.6; // units/s² — a slow pull away that builds

// Track shared by both rails; the clip plane follows the departing train's tail
// (points behind it along TRACK_DIR are cut away). 1e3 = nothing clipped.
const railClip = new THREE.Plane(TRACK_DIR.clone(), 1e3);
const railMaterial = new THREE.MeshStandardMaterial({
    color: '#3a3228',
    metalness: 0.95,
    roughness: 0.25,
    emissive: '#8a6a34',
    emissiveIntensity: 0.18,
    transparent: true,
    clippingPlanes: [railClip],
});

// Deterministic soft radial smoke texture
function createSmokeTexture() {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(225, 205, 175, 0.8)');
    gradient.addColorStop(0.35, 'rgba(165, 145, 120, 0.35)');
    gradient.addColorStop(0.7, 'rgba(70, 60, 50, 0.08)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
}

// Platform alpha: solid in front of the track, dissolving a few units behind it
// so the ground melts into the background plate instead of ending in a hard edge.
function createGroundAlpha() {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = 4;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    // canvas top = far (behind the track), bottom = near the camera
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, '#000');
    g.addColorStop(0.28, '#000');
    g.addColorStop(0.43, '#d8d8d8');
    g.addColorStop(0.5, '#f0f0f0');
    g.addColorStop(1, '#c8c8c8');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 4, 256);
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
}

export default function TrainModel({ index = 0, total = 1, ready = false }) {
    const groupRef = useRef();
    const passingLightRef = useRef();
    const underGlowLightRef = useRef();
    const headLightRef = useRef();

    // Steam & Fog refs
    const steamGroupRef = useRef();
    const steamGeometryRef = useRef();
    const steamMaterialRef = useRef();
    const steamDataRef = useRef([]);

    // Spring state: distance travelled along the track
    const sRef = useRef(null);
    const vRef = useRef(0);
    const arrivedRef = useRef(false);

    // Run state: when the last stop change started and which way
    const runRef = useRef({ start: -10, dir: 1, lastIndex: index });
    const surgeRef = useRef(0);
    const lightPhaseRef = useRef(0);

    // Departure state for the final stop
    const departRef = useRef({ active: false, start: 0, fromS: null });
    const groundMatRef = useRef();

    const { scene } = useGLTF('/assets/train2.glb');
    const smokeTexture = useMemo(() => createSmokeTexture(), []);
    const groundAlpha = useMemo(() => createGroundAlpha(), []);
    const viewport = useThree((s) => s.viewport);
    const pxWidth = useThree((s) => s.size.width);
    const camera = useThree((s) => s.camera);

    // Below 1024px the copy stacks under the train, so the train rides higher.
    const portrait = viewport.aspect < 1;
    const stacked = pxWidth < 1024;
    // Train height ≈ a third of the screen (viewport height is constant in world units)
    const scale = portrait ? 2.3 : viewport.aspect < 1.4 ? 3.3 : 3.8;
    const targetY = portrait ? 0.7 : stacked ? 0.55 : -0.45;
    const noseFraction = portrait ? 0.85 : stacked ? 0.72 : NOSE_AT;
    const groundY = targetY + MODEL_FLOOR * scale;
    const railGauge = 0.1 * scale;

    // Slightly elevated camera looking down the platform
    useEffect(() => {
        camera.position.set(...CAMERA_POS);
        camera.lookAt(...CAMERA_TARGET);
        camera.updateProjectionMatrix();
    }, [camera]);

    // Initialize steam particles in useEffect (safe for React 19 linter)
    useEffect(() => {
        const geo = steamGeometryRef.current;
        if (!geo) return;

        const positions = new Float32Array(STEAM_COUNT * 3);
        const data = [];

        for (let i = 0; i < STEAM_COUNT; i++) {
            const spawnX = -1.0 - Math.random() * 5.0;
            const spawnY = -0.52 + (Math.random() - 0.5) * 0.15;
            const spawnZ = 0.2 + (Math.random() - 0.5) * 0.5;

            positions[i * 3] = spawnX;
            positions[i * 3 + 1] = spawnY;
            positions[i * 3 + 2] = spawnZ;

            data.push({
                baseX: spawnX,
                baseY: spawnY,
                baseZ: spawnZ,
                vx: -(0.6 + Math.random() * 1.0),
                vy: 0.06 + Math.random() * 0.12,
                vz: (Math.random() - 0.5) * 0.15,
                life: Math.random() * 2.0,
                maxLife: 2.0 + Math.random() * 1.5,
            });
        }

        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        steamDataRef.current = data;
    }, []);

    // Metallic reflections for night atmosphere
    useEffect(() => {
        if (!scene) return;
        scene.traverse((child) => {
            if (child.isMesh && child.material) {
                child.material = child.material.clone();
                child.material.envMapIntensity = 0.65;
                child.material.roughness = Math.max(child.material.roughness || 0.35, 0.38);
                child.material.metalness = Math.min((child.material.metalness || 0.2) + 0.35, 0.9);
            }
        });
    }, [scene]);

    useFrame((state, rawDelta) => {
        const group = groupRef.current;
        if (!group) return;
        const delta = Math.min(rawDelta, 1 / 30);
        const t = state.clock.elapsedTime;
        const w = viewport.width;

        // 1. Where along the track the train should rest so its nose lands at
        //    `noseFraction` of the screen. The nose is nearer the camera than the
        //    z=0 plane, so undo the perspective push: screenX = x·Z / (Z − z).
        const step = total > 1 ? TRAVEL / (total - 1) : 0;
        const noseX = (noseFraction + index * step - 0.5) * w;
        const camZ = CAMERA_POS[2];
        const noseDist = noseX / (TRACK_DIR.x + (noseX * TRACK_DIR.z) / camZ);
        const dockS = noseDist - HALF_LENGTH * scale;
        const startS = dockS - START_BACK * w - 2 * HALF_LENGTH * scale;
        const target = ready ? dockS : startS;

        if (sRef.current === null) sRef.current = startS;

        // Final stop: after it pulls in, the train departs and the track dissolves behind it.
        const dep = departRef.current;
        const isFinal = ready && total > 1 && index === total - 1;
        if (isFinal && !dep.active) {
            dep.active = true;
            dep.start = t + DEPART_DELAY;
            dep.fromS = null;
        } else if (!isFinal && dep.active) {
            // Heading back. Still in view → it just reverses into its berth.
            // Already long gone → bring it in from down the line like the opening arrival.
            if (dep.fromS !== null && t - dep.start > 1.2) {
                sRef.current = startS;
                vRef.current = 0;
                arrivedRef.current = false;
                runRef.current.start = -10;
                runRef.current.lastIndex = index;
            }
            railMaterial.opacity = 0; // rails fade back in
            dep.active = false;
            dep.fromS = null;
        }
        const departT = dep.active ? t - dep.start : -1;
        const departing = departT >= 0;

        // Long, gentle arrival on first load; brisk surge between stops afterwards.
        if (!arrivedRef.current && ready && Math.abs(sRef.current - dockS) < 0.02) {
            arrivedRef.current = true;
        }
        const stiffness = arrivedRef.current ? 16 : 3.2;
        // Slightly over-damped between stops so it settles without any overshoot
        const damping = arrivedRef.current ? 8.5 : 3.4;

        const accel = stiffness * (target - sRef.current) - damping * vRef.current;
        vRef.current += accel * delta;
        sRef.current += vRef.current * delta;

        // Departure overrides the spring: constant acceleration from where it stood
        if (departing) {
            if (dep.fromS === null) dep.fromS = sRef.current;
            sRef.current = dep.fromS + Math.min(0.5 * DEPART_ACCEL * departT * departT, 60);
            vRef.current = departT < 8 ? DEPART_ACCEL * departT : 0;
        }

        // 2. The run between stops: the track streams past at speed while the train
        //    pulls ahead of its berth, then brakes back into it.
        const run = runRef.current;
        if (run.lastIndex !== index) {
            run.dir = index > run.lastIndex ? 1 : -1;
            run.lastIndex = index;
            run.start = t;
        }
        const p = THREE.MathUtils.clamp((t - run.start) / TRAVEL_TIME, 0, 1);
        const running = p < 1;
        const bump = running ? Math.sin(Math.PI * p) : 0; // speed profile 0 → 1 → 0
        // Even ease ahead and back — no snap
        const surgeTarget = running ? run.dir * SURGE * w * Math.sin(Math.PI * p) ** 2 : 0;
        surgeRef.current = THREE.MathUtils.damp(surgeRef.current, surgeTarget, 4, delta);
        const worldSpeed = bump * RUN_SPEED * run.dir;

        const speed = Math.min(Math.abs(vRef.current) + bump * 2.5, 3);

        // 3. Pointer parallax — a whisper, not a wobble
        const mouseTargetRotY = Math.PI - YAW + state.pointer.x * 0.015;
        group.rotation.y = THREE.MathUtils.damp(group.rotation.y, mouseTargetRotY, 4, delta);

        // Leans back as it pulls away, pitches forward as it brakes
        const runLean = running ? -run.dir * 0.003 * Math.sin(2 * Math.PI * p) : 0;
        const lean = THREE.MathUtils.clamp(accel * 0.0003 + runLean, -0.005, 0.005);
        group.rotation.z = THREE.MathUtils.damp(group.rotation.z, lean, 8, delta);

        // Sits on the rails: no idle float, only rumble while moving
        const rumble = (Math.sin(t * 34.0) * 0.001 + Math.sin(t * 13.0) * 0.0007) * Math.min(speed, 1.0);
        const along = sRef.current + surgeRef.current;
        group.position.set(TRACK_DIR.x * along, targetY + rumble, TRACK_DIR.z * along);
        group.scale.setScalar(scale);

        // Track dissolves behind the departing train's tail; the platform fades with it
        railClip.constant = departing ? -(along - HALF_LENGTH * scale - 0.2) : 1e3;
        railMaterial.opacity = THREE.MathUtils.damp(railMaterial.opacity, departing && departT > 3 ? 0 : 1, 2, delta);
        if (groundMatRef.current) {
            groundMatRef.current.opacity = THREE.MathUtils.damp(
                groundMatRef.current.opacity,
                departing && departT > 0.8 ? 0 : 1,
                1.2,
                delta
            );
        }

        // 3. Follow train position for trailing steam
        if (steamGroupRef.current) {
            steamGroupRef.current.position.copy(group.position);
        }

        // 4. Breathing steam that thickens while the train is moving
        const cycle = (t * 0.7) % Math.PI;
        const breathe = Math.pow(Math.sin(cycle), 4);
        const targetFogOpacity = 0.1 + breathe * 0.2 + Math.min(speed * 0.35, 0.4);

        if (steamMaterialRef.current) {
            steamMaterialRef.current.opacity = THREE.MathUtils.damp(
                steamMaterialRef.current.opacity,
                targetFogOpacity,
                3,
                delta
            );
        }

        if (
            steamGeometryRef.current &&
            steamGeometryRef.current.attributes.position &&
            steamDataRef.current.length > 0
        ) {
            const posAttr = steamGeometryRef.current.attributes.position;
            const posArr = posAttr.array;
            const pData = steamDataRef.current;
            const speedBoost = 1.0 + speed * 2.5;

            for (let i = 0; i < STEAM_COUNT; i++) {
                const p = pData[i];
                p.life += delta * speedBoost * 0.6;

                if (p.life >= p.maxLife) {
                    p.life = 0;
                    posArr[i * 3] = p.baseX + (Math.sin(t * 8 + i) * 0.2);
                    posArr[i * 3 + 1] = p.baseY;
                    posArr[i * 3 + 2] = p.baseZ;
                } else {
                    posArr[i * 3] += p.vx * delta * speedBoost;
                    posArr[i * 3 + 1] += p.vy * delta;
                    posArr[i * 3 + 2] += p.vz * delta;
                }
            }
            posAttr.needsUpdate = true;
        }

        // 5. Trackside passing light — sweeps faster while moving
        if (passingLightRef.current) {
            lightPhaseRef.current += (2.5 + Math.abs(worldSpeed)) * delta;
            const lightX = 8.0 - (lightPhaseRef.current % 22.0);
            passingLightRef.current.position.set(lightX, groundY + 1.6, 1.8);
            passingLightRef.current.intensity = 0.9 + speed * 0.8;
        }

        // 6. Flickering maglev underglow
        if (underGlowLightRef.current) {
            const flicker = Math.sin(t * 20.0) * 0.1 + 0.9;
            const microDrop = Math.sin(t * 45.0) > 0.9 ? 0.6 : 1.0;
            underGlowLightRef.current.intensity = (0.9 + speed * 0.6) * flicker * microDrop;
        }

        // 7. Cockpit visor beam
        if (headLightRef.current) {
            const visorJitter = Math.sin(t * 18.0) * 0.04 + 0.96;
            headLightRef.current.intensity = 1.8 * visorJitter;
        }
    });

    return (
        <>
            {/* Trackside passing beacon light */}
            <pointLight
                ref={passingLightRef}
                color="#ffe2a0"
                intensity={1.0}
                distance={7.5}
                decay={2}
            />

            {/* ---------- Platform & track (aligned with the train's heading) ---------- */}
            <group position={[0, groundY, 0]} rotation={[0, -YAW, 0]}>
                {/* Wet dark platform that fades into the plate behind */}
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.004, 0]} renderOrder={-1}>
                    <planeGeometry args={[80, 16]} />
                    <meshStandardMaterial
                        ref={groundMatRef}
                        color="#0c0c0e"
                        roughness={0.28}
                        metalness={0.65}
                        envMapIntensity={0.35}
                        transparent
                        alphaMap={groundAlpha}
                        depthWrite={false}
                    />
                </mesh>

                {/* Rails */}
                {[-railGauge, railGauge].map((z) => (
                    <mesh key={z} position={[0, 0.012, z]} material={railMaterial}>
                        <boxGeometry args={[80, 0.024, 0.028]} />
                    </mesh>
                ))}
            </group>

            {/* Trailing Procedural Steam / Fog — follows the track heading */}
            <group ref={steamGroupRef} rotation={[0, -YAW, 0]}>
                <points>
                    <bufferGeometry ref={steamGeometryRef} />
                    <pointsMaterial
                        ref={steamMaterialRef}
                        map={smokeTexture}
                        size={1.35}
                        sizeAttenuation={true}
                        transparent={true}
                        opacity={0.2}
                        depthWrite={false}
                        blending={THREE.NormalBlending}
                    />
                </points>
            </group>

            <group ref={groupRef} rotation={[0, Math.PI - YAW, 0]} scale={scale}>
                <primitive object={scene} />

                {/* Cockpit Forward Projection Beam */}
                <pointLight
                    ref={headLightRef}
                    position={[-0.98, 0.0, 0]}
                    color="#ffdfa0"
                    distance={4.5}
                    decay={2}
                    intensity={1.8}
                />

                {/* Undercarriage glow — pools warm light on the platform */}
                <pointLight
                    ref={underGlowLightRef}
                    position={[0, -0.14, 0.12]}
                    color="#d4af37"
                    distance={3.5}
                    decay={2}
                    intensity={0.9}
                />

                {/* Contact shadow pressed right against the underside */}
                <ContactShadows
                    position={[0, MODEL_FLOOR + 0.002, 0]}
                    opacity={0.85}
                    scale={[2.4, 0.7]}
                    blur={1.2}
                    far={0.35}
                    resolution={512}
                    color="#000000"
                />
            </group>
        </>
    );
}

useGLTF.preload('/assets/train2.glb');
