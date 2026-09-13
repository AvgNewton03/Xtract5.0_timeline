import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';

const STEAM_COUNT = 60;

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

export default function TrainModelVertical({ scrollProgress = 0, velocity = 0, isTransitioning = false }) {
    const groupRef = useRef();
    const passingLightRef = useRef();
    const underGlowLightRef = useRef();
    const headLightRef = useRef();

    const steamGroupRef = useRef();
    const steamGeometryRef = useRef();
    const steamMaterialRef = useRef();
    const steamDataRef = useRef([]);

    // Stable tracking state
    const currentY = useRef(2.0);
    const currentZ = useRef(-0.5);
    const currentScale = useRef(2.6);
    const currentSpeed = useRef(0);

    const { scene } = useGLTF('/assets/train2.glb');
    const smokeTexture = useMemo(() => createSmokeTexture(), []);

    useEffect(() => {
        const geo = steamGeometryRef.current;
        if (!geo) return;

        const positions = new Float32Array(STEAM_COUNT * 3);
        const data = [];

        for (let i = 0; i < STEAM_COUNT; i++) {
            const spawnX = (Math.random() - 0.5) * 0.15;
            const spawnY = 1.0 + Math.random() * 4.0;
            const spawnZ = 0.2 + (Math.random() - 0.5) * 0.5;

            positions[i * 3] = spawnX;
            positions[i * 3 + 1] = spawnY;
            positions[i * 3 + 2] = spawnZ;

            data.push({
                baseX: spawnX,
                baseY: spawnY,
                baseZ: spawnZ,
                vx: (Math.random() - 0.5) * 0.15,
                vy: 0.6 + Math.random() * 1.0,
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
                child.material.envMapIntensity = 0.65;
                child.material.roughness = Math.max(child.material.roughness || 0.35, 0.38);
                child.material.metalness = Math.min((child.material.metalness || 0.2) + 0.35, 0.9);
            }
        });
    }, [scene]);

    useFrame((state, delta) => {
        if (!groupRef.current) return;

        const progress = THREE.MathUtils.clamp(scrollProgress, 0, 1.0);

        const dockedY = 1.6;
        const dockedZ = -0.5;
        const dockedScaleVal = 2.6;

        // Pulled exit distance closer (-8.0) to avoid explosive speed jumps
        const exitY = -8.0;
        const exitZ = 1.5;

        let targetYVal, targetZVal, targetScaleVal;
        let dampSpeed = 2.2;

        if (progress < 0.85) {
            // District Stops 1-5
            targetYVal = dockedY - progress * 0.6;
            targetZVal = dockedZ;
            targetScaleVal = dockedScaleVal;
        } else if (progress < 0.98) {
            // Stop 6 (The Capitol)
            targetYVal = dockedY - 0.8;
            targetZVal = dockedZ;
            targetScaleVal = dockedScaleVal;
        } else {
            // Virtual Exit Step: Slower damping (0.8) for a cinematic rollout
            targetYVal = exitY;
            targetZVal = exitZ;
            targetScaleVal = dockedScaleVal * 1.1;
            dampSpeed = 0.8;
        }

        // Context-aware Interpolation
        currentY.current = THREE.MathUtils.damp(currentY.current, targetYVal, dampSpeed, delta);
        currentZ.current = THREE.MathUtils.damp(currentZ.current, targetZVal, dampSpeed, delta);
        currentScale.current = THREE.MathUtils.damp(currentScale.current, targetScaleVal, dampSpeed, delta);

        const motionDelta = Math.abs(targetYVal - currentY.current);
        const rawSpeed = motionDelta * 2 + (isTransitioning ? 0.3 : 0);
        currentSpeed.current = THREE.MathUtils.damp(currentSpeed.current, rawSpeed, 3, delta);
        const speed = currentSpeed.current;

        const idleHover = Math.sin(state.clock.elapsedTime * 2.5) * 0.005;
        const scrollShake = Math.sin(state.clock.elapsedTime * 35.0) * 0.002 * Math.min(speed, 1.0);

        groupRef.current.position.set(
            idleHover + scrollShake,
            currentY.current,
            currentZ.current
        );

        groupRef.current.scale.set(
            currentScale.current,
            currentScale.current,
            currentScale.current
        );

        // Standard 3D Rotations
        const baseRotX = -Math.PI / 4;
        const baseRotY = Math.PI / 2;
        const baseRotZ = Math.PI / 2;

        const mouseTargetRotX = baseRotX - state.pointer.y * 0.02;
        const mouseTargetRotY = baseRotY + state.pointer.x * 0.03;
        const mouseTargetRotZ = baseRotZ + state.pointer.x * 0.05;

        groupRef.current.rotation.x = THREE.MathUtils.damp(groupRef.current.rotation.x, mouseTargetRotX, 3, delta);
        groupRef.current.rotation.y = THREE.MathUtils.damp(groupRef.current.rotation.y, mouseTargetRotY, 3, delta);
        groupRef.current.rotation.z = THREE.MathUtils.damp(groupRef.current.rotation.z, mouseTargetRotZ, 3, delta);

        if (steamGroupRef.current) {
            steamGroupRef.current.position.copy(groupRef.current.position);
        }

        const cycle = (state.clock.elapsedTime * 0.7) % Math.PI;
        const breathe = Math.pow(Math.sin(cycle), 4);
        const targetFogOpacity = 0.12 + breathe * 0.3 + Math.min(speed * 0.25, 0.4);

        if (steamMaterialRef.current) {
            steamMaterialRef.current.opacity = THREE.MathUtils.damp(
                steamMaterialRef.current.opacity,
                targetFogOpacity,
                2,
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
                p.life += delta * speedBoost * 0.5;

                if (p.life >= p.maxLife) {
                    p.life = 0;
                    posArr[i * 3] = p.baseX + (Math.sin(state.clock.elapsedTime * 8 + i) * 0.15);
                    posArr[i * 3 + 1] = p.baseY;
                    posArr[i * 3 + 2] = p.baseZ;
                } else {
                    posArr[i * 3] += p.vx * delta;
                    posArr[i * 3 + 1] += p.vy * delta * speedBoost;
                    posArr[i * 3 + 2] += p.vz * delta;
                }
            }
            posAttr.needsUpdate = true;
        }

        if (passingLightRef.current) {
            const lightCycleSpeed = 4.0 + speed * 6.0;
            const lightY = 8.0 - ((state.clock.elapsedTime * lightCycleSpeed) % 22.0);
            passingLightRef.current.position.set(1.5, lightY, 1.8);
            passingLightRef.current.intensity = Math.sin(state.clock.elapsedTime * 12) > 0.2 ? 1.4 + speed * 1.0 : 0.4;
        }

        if (underGlowLightRef.current) {
            const flicker = Math.sin(state.clock.elapsedTime * 20.0) * 0.12 + 0.88;
            underGlowLightRef.current.intensity = (0.7 + speed * 0.8) * flicker;
        }

        if (headLightRef.current) {
            const visorJitter = Math.sin(state.clock.elapsedTime * 18.0) * 0.06 + 0.94;
            headLightRef.current.intensity = 1.5 * visorJitter;
        }
    });

    return (
        <>
            <pointLight
                ref={passingLightRef}
                color="#ffe2a0"
                intensity={1.2}
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
                        opacity={0.3}
                        depthWrite={false}
                        blending={THREE.NormalBlending}
                    />
                </points>
            </group>

            <group ref={groupRef}>
                <primitive object={scene} />

                <pointLight
                    ref={headLightRef}
                    position={[0, -1.2, 0.2]}
                    color="#ffdfa0"
                    distance={5.0}
                    decay={2}
                    intensity={1.5}
                />

                <pointLight
                    ref={underGlowLightRef}
                    position={[0, 0, 0.1]}
                    color="#d4af37"
                    distance={3.5}
                    decay={2}
                    intensity={0.9}
                />

                <ContactShadows
                    position={[0, 0, -0.22]}
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