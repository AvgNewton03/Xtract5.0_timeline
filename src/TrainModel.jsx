import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';

const STEAM_COUNT = 60;

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

export default function TrainModel({ scrollProgress, velocity = 0, isTransitioning = false }) {
    const groupRef = useRef();
    const passingLightRef = useRef();
    const underGlowLightRef = useRef();
    const headLightRef = useRef();

    // Steam & Fog refs
    const steamGroupRef = useRef();
    const steamGeometryRef = useRef();
    const steamMaterialRef = useRef();
    const steamDataRef = useRef([]);

    const currentSpeed = useRef(0);
    const { scene } = useGLTF('/assets/train2.glb');
    const smokeTexture = useMemo(() => createSmokeTexture(), []);

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

    useFrame((state, delta) => {
        if (!groupRef.current) return;

        const currentScroll = typeof scrollProgress === 'number' && !isNaN(scrollProgress)
            ? scrollProgress
            : 0;

        // 1. Calculate & dampen velocity
        const rawVelocity = Math.abs(velocity) * 8 + (isTransitioning ? 0.6 : 0);
        currentSpeed.current = THREE.MathUtils.damp(currentSpeed.current, rawVelocity, 6, delta);
        const speed = currentSpeed.current;

        // Calibrated coordinates
        const baseDockedX = -4;
        const startX = -13.0;
        const exitX = 14.0; // Clears the screen completely past the right edge
        const targetY = -0.55;

        // 2. PARALLAX EFFECT 1: Scroll Inertia Drag
        const inertiaX = Math.min(speed * 0.05, 0.15);
        const effectiveDockedX = baseDockedX - inertiaX;

        // 3. PARALLAX EFFECT 2: Mouse Pointer Reactivity
        const mouseTargetRotY = Math.PI + state.pointer.x * 0.02;
        const mouseTargetRotX = -state.pointer.y * 0.015;
        const mouseTargetZ = state.pointer.x * 0.1;

        groupRef.current.rotation.x = THREE.MathUtils.damp(groupRef.current.rotation.x, mouseTargetRotX, 4, delta);
        groupRef.current.rotation.y = THREE.MathUtils.damp(groupRef.current.rotation.y, mouseTargetRotY, 4, delta);
        groupRef.current.position.z = THREE.MathUtils.damp(groupRef.current.position.z, mouseTargetZ, 4, delta);

        // 4. Multi-Phase Scrollable Motion
        if (currentScroll < 0.10) {
            // Entrance Phase (0.00 -> 0.10)
            const progress = currentScroll / 0.10;
            groupRef.current.position.x = startX + progress * (baseDockedX - startX);
            groupRef.current.position.y = targetY;
        } else if (currentScroll <= 0.84) {
            // Docked Cruise across all 6 districts (0.10 -> 0.84)
            groupRef.current.position.x = effectiveDockedX;
            const idleHover = Math.sin(state.clock.elapsedTime * 2.5) * 0.005;
            const scrollShake = Math.sin(state.clock.elapsedTime * 35.0) * 0.002 * Math.min(speed, 1.0);
            groupRef.current.position.y = targetY + idleHover + scrollShake;
        } else {
            // Scrollable Grounded Departure (0.84 -> 1.00)
            const exitProgress = Math.min((currentScroll - 0.84) / 0.16, 1.0);
            // Gentle linear acceleration curve: scrubbed strictly by your scroll
            groupRef.current.position.x = baseDockedX + exitProgress * (exitX - baseDockedX);
            const exitRumble = Math.sin(state.clock.elapsedTime * 30.0) * 0.003;
            groupRef.current.position.y = targetY + exitRumble;
        }

        groupRef.current.rotation.z = 0;

        // 5. Follow train position for trailing steam
        if (steamGroupRef.current) {
            steamGroupRef.current.position.copy(groupRef.current.position);
        }

        // 6. Time-to-time breathing fog pulse
        const cycle = (state.clock.elapsedTime * 0.7) % Math.PI;
        const timeToTimeWave = Math.pow(Math.sin(cycle), 4);
        const targetFogOpacity = 0.12 + timeToTimeWave * 0.4 + Math.min(speed * 0.25, 0.35);

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
            const speedBoost = 1.0 + speed * 4.0;

            for (let i = 0; i < STEAM_COUNT; i++) {
                const p = pData[i];
                p.life += delta * speedBoost * 0.6;

                if (p.life >= p.maxLife) {
                    p.life = 0;
                    posArr[i * 3] = p.baseX + (Math.sin(state.clock.elapsedTime * 8 + i) * 0.2);
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

        // 7. Trackside Passing Light
        if (passingLightRef.current) {
            const lightCycleSpeed = 5.0 + speed * 10.0;
            const lightX = 8.0 - ((state.clock.elapsedTime * lightCycleSpeed) % 22.0);
            passingLightRef.current.position.set(lightX, targetY + 1.2, 1.8);
            passingLightRef.current.intensity = Math.sin(state.clock.elapsedTime * 12) > 0.2 ? 1.4 + speed * 1.0 : 0.4;
        }

        // 8. Flickering Maglev Arc Underglow
        if (underGlowLightRef.current) {
            const flicker = Math.sin(state.clock.elapsedTime * 20.0) * 0.12 + 0.88;
            const microDrop = Math.sin(state.clock.elapsedTime * 45.0) > 0.85 ? 0.5 : 1.0;
            underGlowLightRef.current.intensity = (0.7 + speed * 0.8) * flicker * microDrop;
        }

        // 9. Cockpit Visor Beam
        if (headLightRef.current) {
            const visorJitter = Math.sin(state.clock.elapsedTime * 18.0) * 0.06 + 0.94;
            headLightRef.current.intensity = 1.5 * visorJitter;
        }
    });

    return (
        <>
            {/* High-speed passing beacon light */}
            <pointLight
                ref={passingLightRef}
                color="#ffe2a0"
                intensity={1.2}
                distance={7.5}
                decay={2}
            />

            {/* Trailing Procedural Steam / Fog */}
            <group ref={steamGroupRef}>
                <points>
                    <bufferGeometry ref={steamGeometryRef} />
                    <pointsMaterial
                        ref={steamMaterialRef}
                        map={smokeTexture}
                        size={1.35}
                        sizeAttenuation={true}
                        transparent={true}
                        opacity={0.3}
                        depthWrite={false}
                        blending={THREE.NormalBlending}
                    />
                </points>
            </group>

            <group ref={groupRef} scale={[5.2, 5.2, 5.2]}>
                <primitive object={scene} />

                {/* Cockpit Forward Projection Beam */}
                <pointLight
                    ref={headLightRef}
                    position={[0.95, 0.05, 0]}
                    color="#ffdfa0"
                    distance={4.5}
                    decay={2}
                    intensity={1.5}
                />

                {/* Flickering Maglev Undercarriage Glow */}
                <pointLight
                    ref={underGlowLightRef}
                    position={[0, -0.05, 0.1]}
                    color="#d4af37"
                    distance={3.5}
                    decay={2}
                    intensity={0.9}
                />

                {/* Ground Hover Shadow */}
                <ContactShadows
                    position={[-0.4, -0.22, 0]}
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