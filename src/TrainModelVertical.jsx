import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';

const STEAM_COUNT = 60;
const VERTICAL_GAUGE = 0.28;

// Reusable vertical track material
const verticalRailMaterial = new THREE.MeshStandardMaterial({
    color: '#3a3228',
    metalness: 0.95,
    roughness: 0.25,
    emissive: '#8a6a34',
    emissiveIntensity: 0.22,
});

function createVerticalGroundAlpha() {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 4;
    const ctx = canvas.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 256, 0);
    g.addColorStop(0, '#000');
    g.addColorStop(0.25, '#000');
    g.addColorStop(0.42, '#d8d8d8');
    g.addColorStop(0.5, '#f0f0f0');
    g.addColorStop(0.58, '#d8d8d8');
    g.addColorStop(0.75, '#000');
    g.addColorStop(1, '#000');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 4);
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
}

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

export function VerticalTracksBackground() {
    const groundAlpha = useMemo(() => createVerticalGroundAlpha(), []);

    return (
        <group position={[0, 0, -0.65]}>
            <mesh position={[0, 0, -0.02]} renderOrder={-2}>
                <planeGeometry args={[6, 32]} />
                <meshStandardMaterial
                    color="#0c0c0e"
                    roughness={0.28}
                    metalness={0.65}
                    alphaMap={groundAlpha}
                    transparent
                    depthWrite={false}
                />
            </mesh>

            {[-VERTICAL_GAUGE, VERTICAL_GAUGE].map((xOffset) => (
                <mesh key={xOffset} position={[xOffset, 0, 0.01]} material={verticalRailMaterial} renderOrder={-1}>
                    <boxGeometry args={[0.032, 32, 0.035]} />
                </mesh>
            ))}

            <mesh position={[0, 0, -0.005]} renderOrder={-1}>
                <planeGeometry args={[VERTICAL_GAUGE * 2.8, 32]} />
                <meshStandardMaterial
                    color="#12100d"
                    roughness={0.8}
                    metalness={0.2}
                    transparent
                    opacity={0.4}
                />
            </mesh>
        </group>
    );
}

export default function TrainModelVertical({ scrollProgress = 0, velocity = 0, isTransitioning = false }) {
    const groupRef = useRef();
    const passingLightRef = useRef();
    const underGlowLightRef = useRef();
    const headLightRef = useRef();

    const steamGroupRef = useRef();
    const steamGeometryRef = useRef();
    const steamMaterialRef = useRef();
    const steamDataRef = useRef([]);

    // Base state tracking (Top -> Bottom)
    const currentY = useRef(2.45);
    const currentZ = useRef(-0.35);
    const currentScale = useRef(2.45);
    const currentSpeed = useRef(0);
    const prevProgress = useRef(scrollProgress);
    const lightPhaseRef = useRef(0);

    const { scene } = useGLTF('/assets/train2.glb');
    const smokeTexture = useMemo(() => createSmokeTexture(), []);

    useEffect(() => {
        const geo = steamGeometryRef.current;
        if (!geo) return;

        const positions = new Float32Array(STEAM_COUNT * 3);
        const data = [];

        // Steam spawns behind the train tail (above the train in a downwards travel)
        for (let i = 0; i < STEAM_COUNT; i++) {
            const spawnX = (Math.random() - 0.5) * 0.2;
            const spawnY = 1.2 + Math.random() * 2.5;
            const spawnZ = 0.2 + (Math.random() - 0.5) * 0.4;

            positions[i * 3] = spawnX;
            positions[i * 3 + 1] = spawnY;
            positions[i * 3 + 2] = spawnZ;

            data.push({
                baseX: spawnX,
                baseY: spawnY,
                baseZ: spawnZ,
                vx: (Math.random() - 0.5) * 0.15,
                vy: 0.6 + Math.random() * 1.2, // Drifts upward
                vz: (Math.random() - 0.5) * 0.15,
                life: Math.random() * 2.0,
                maxLife: 2.0 + Math.random() * 1.5,
            });
        }

        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        steamDataRef.current = data;
    }, []);

    useEffect(() => {
        if (!scene) return;
        scene.traverse((child) => {
            if (child.isMesh && child.material) {
                child.material = child.material.clone();
                child.material.envMapIntensity = 0.7;
                child.material.roughness = Math.max(child.material.roughness || 0.35, 0.38);
                child.material.metalness = Math.min((child.material.metalness || 0.2) + 0.35, 0.9);
            }
        });
    }, [scene]);

    useFrame((state, delta) => {
        if (!groupRef.current) return;

        const t = state.clock.elapsedTime;
        const progress = THREE.MathUtils.clamp(scrollProgress, 0, 1.0);

        // Docked resting baseline positioned near top view, heading downwards
        const dockedY = 2.45;
        const dockedZ = -0.35;
        const dockedScaleVal = 2.45;
        const exitY = -8.5;
        const exitZ = 1.5;

        let targetYVal, targetZVal, targetScaleVal;
        let dampSpeed = 2.4;

        if (progress < 0.85) {
            targetYVal = dockedY - progress * 0.45;
            targetZVal = dockedZ;
            targetScaleVal = dockedScaleVal;
        } else if (progress < 0.98) {
            targetYVal = dockedY - 0.65;
            targetZVal = dockedZ;
            targetScaleVal = dockedScaleVal;
        } else {
            // Exit out through the bottom
            targetYVal = exitY;
            targetZVal = exitZ;
            targetScaleVal = dockedScaleVal * 1.1;
            dampSpeed = 0.8;
        }

        currentY.current = THREE.MathUtils.damp(currentY.current, targetYVal, dampSpeed, delta);
        currentZ.current = THREE.MathUtils.damp(currentZ.current, targetZVal, dampSpeed, delta);
        currentScale.current = THREE.MathUtils.damp(currentScale.current, targetScaleVal, dampSpeed, delta);

        // Speed calculation
        const progressDelta = Math.abs(progress - prevProgress.current) / Math.max(delta, 0.001);
        prevProgress.current = progress;

        const motionDelta = Math.abs(targetYVal - currentY.current);
        const scrollInputVel = Math.abs(velocity);

        const rawSpeed = motionDelta < 0.008 && progressDelta < 0.01 && scrollInputVel < 0.02
            ? 0
            : motionDelta * 3.0 + progressDelta * 0.4 + scrollInputVel * 1.2 + (isTransitioning ? 0.35 : 0);

        currentSpeed.current = THREE.MathUtils.damp(currentSpeed.current, rawSpeed, 6.0, delta);
        const speed = currentSpeed.current < 0.02 ? 0 : currentSpeed.current;
        const isMoving = speed > 0;

        // ================= CHATTER & POSITION =================
        const lateralJitter = isMoving
            ? (Math.sin(t * 48.0) * 0.0035 + Math.sin(t * 26.0) * 0.002) * Math.min(speed * 1.8, 1.2)
            : 0;

        const verticalHeave = isMoving
            ? Math.sin(t * 32.0) * 0.0025 * Math.min(speed * 1.5, 1.0)
            : 0;

        groupRef.current.position.set(
            lateralJitter,
            currentY.current + verticalHeave,
            currentZ.current
        );

        groupRef.current.scale.set(
            currentScale.current,
            currentScale.current,
            currentScale.current
        );

        // ================= ROTATION: POINTING DOWNWARD =================
        const baseRotX = Math.PI / 2;
        const baseRotY = Math.PI / 2; // Nose pointed DOWN towards the bottom of the screen
        const baseRotZ = 0;

        const carriageRoll = isMoving ? Math.sin(t * 11.0) * 0.014 * Math.min(speed * 1.6, 1.0) : 0;
        const inertialPitch = isMoving ? Math.min(speed * 0.02, 0.04) : 0;
        const yawWiggle = isMoving ? Math.sin(t * 19.0) * 0.01 * Math.min(speed * 1.4, 0.8) : 0;

        const mouseTargetRotX = baseRotX + inertialPitch - state.pointer.y * 0.02;
        const mouseTargetRotY = baseRotY + yawWiggle;
        const mouseTargetRotZ = baseRotZ + carriageRoll - state.pointer.x * 0.02;

        groupRef.current.rotation.x = THREE.MathUtils.damp(groupRef.current.rotation.x, mouseTargetRotX, 5, delta);
        groupRef.current.rotation.y = THREE.MathUtils.damp(groupRef.current.rotation.y, mouseTargetRotY, 5, delta);
        groupRef.current.rotation.z = THREE.MathUtils.damp(groupRef.current.rotation.z, mouseTargetRotZ, 5, delta);

        if (steamGroupRef.current) {
            steamGroupRef.current.position.copy(groupRef.current.position);
        }

        const targetFogOpacity = isMoving
            ? 0.16 + Math.min(speed * 0.35, 0.45)
            : 0.06;

        if (steamMaterialRef.current) {
            steamMaterialRef.current.opacity = THREE.MathUtils.damp(
                steamMaterialRef.current.opacity,
                targetFogOpacity,
                2.5,
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
            const speedBoost = isMoving ? 1.0 + speed * 2.8 : 0.4;

            for (let i = 0; i < STEAM_COUNT; i++) {
                const p = pData[i];
                p.life += delta * speedBoost * 0.55;

                if (p.life >= p.maxLife) {
                    p.life = 0;
                    posArr[i * 3] = p.baseX + (Math.sin(t * 8 + i) * 0.15);
                    posArr[i * 3 + 1] = p.baseY;
                    posArr[i * 3 + 2] = p.baseZ;
                } else {
                    posArr[i * 3] += p.vx * delta;
                    posArr[i * 3 + 1] += p.vy * delta * speedBoost; // floats upward in rearview
                    posArr[i * 3 + 2] += p.vz * delta;
                }
            }
            posAttr.needsUpdate = true;
        }

        // Passing light sweeps upwards as train drives downwards
        if (passingLightRef.current) {
            if (isMoving) {
                lightPhaseRef.current += (4.0 + speed * 8.0) * delta;
                const lightY = -6.0 + (lightPhaseRef.current % 20.0);
                passingLightRef.current.position.set(VERTICAL_GAUGE + 0.15, lightY, 1.8);
                passingLightRef.current.intensity = Math.sin(t * 12) > 0.2 ? 1.2 + speed * 1.2 : 0.3;
            } else {
                passingLightRef.current.intensity = THREE.MathUtils.damp(passingLightRef.current.intensity, 0, 4, delta);
            }
        }

        if (underGlowLightRef.current) {
            const flicker = isMoving ? Math.sin(t * 30.0) * 0.15 + 0.85 : 1.0;
            underGlowLightRef.current.intensity = (0.8 + (isMoving ? speed * 0.8 : 0)) * flicker;
        }

        if (headLightRef.current) {
            const visorJitter = isMoving ? Math.sin(t * 22.0) * 0.05 + 0.95 : 1.0;
            headLightRef.current.intensity = (1.5 + (isMoving ? Math.min(speed * 0.4, 0.6) : 0)) * visorJitter;
        }
    });

    return (
        <>
            <VerticalTracksBackground />

            <pointLight
                ref={passingLightRef}
                color="#ffe2a0"
                intensity={0}
                distance={7.5}
                decay={2}
            />

            <group ref={steamGroupRef}>
                <points>
                    <bufferGeometry ref={steamGeometryRef} />
                    <pointsMaterial
                        ref={steamMaterialRef}
                        map={smokeTexture}
                        size={1.35}
                        sizeAttenuation={true}
                        transparent={true}
                        opacity={0.06}
                        depthWrite={false}
                        blending={THREE.NormalBlending}
                    />
                </points>
            </group>

            <group ref={groupRef}>
                <primitive object={scene} />

                {/* Downward cockpit nose projector (pointing down towards -Y) */}
                <pointLight
                    ref={headLightRef}
                    position={[0, -1.2, 0.2]}
                    color="#ffdfa0"
                    distance={5.0}
                    decay={2}
                    intensity={1.5}
                />

                {/* Rail undercarriage glow */}
                <pointLight
                    ref={underGlowLightRef}
                    position={[0, 0, -0.2]}
                    color="#d4af37"
                    distance={3.5}
                    decay={2}
                    intensity={0.8}
                />

                <ContactShadows
                    position={[0, 0, -0.25]}
                    opacity={0.55}
                    scale={7.5}
                    blur={2.0}
                    far={2.5}
                    color="#050302"
                />
            </group>
        </>
    );
}

useGLTF.preload('/assets/train2.glb');