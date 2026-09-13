import React, { useRef, useState, useEffect, Suspense } from 'react';
import { motion, AnimatePresence, useScroll, useSpring, useVelocity } from 'framer-motion';
import { Canvas } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import TrainModel from './TrainModel';

const districtData = [
  {
    id: 1,
    bg: '/assets/District1Bg.jpeg',
    districtSeal: '/assets/District1.png',
    textCard: '/assets/Text1.png',
    title: 'The Reaping',
    district: 'District 13',
  },
  {
    id: 2,
    bg: '/assets/District2Bg.png',
    districtSeal: '/assets/District2.png',
    textCard: '/assets/Text2.png',
    title: 'The Announcement',
    district: 'District 12',
  },
  {
    id: 3,
    bg: '/assets/District3Bg.jpg',
    districtSeal: '/assets/District3.png',
    textCard: '/assets/Text3.png',
    title: 'The Arrival',
    district: 'District 9',
  },
  {
    id: 4,
    bg: '/assets/District4Bg.jpg',
    districtSeal: '/assets/District4.png',
    textCard: '/assets/Text4.png',
    title: 'The Games Begin',
    district: 'District 8',
  },
  {
    id: 5,
    bg: '/assets/District5Bg.png',
    districtSeal: '/assets/District5.png',
    textCard: '/assets/Text5.png',
    title: 'The Cannon Fires',
    district: 'District 1',
  },
  {
    id: 6,
    bg: '/assets/CapitolBg.jpg',
    districtSeal: '/assets/Capitol.png',
    textCard: '/assets/Text6.png',
    title: 'The Victors Crown',
    district: 'The Capitol',
  },
];

// ================= CONTINUOUS AMBIENT BACKGROUND FOG (Z-15) =================
function AmbientBackgroundFog({ velocity = 0 }) {
  const dynamicBoost = Math.min(Math.abs(velocity) * 8, 1.5);

  return (
    <div className="absolute inset-0 z-15 pointer-events-none overflow-hidden select-none">
      {/* SVG Turbulence Filter for Natural Cloud Edges */}
      <svg className="w-0 h-0 absolute pointer-events-none">
        <defs>
          <filter id="ambient-fog-filter" x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency="0.015" numOctaves="3" seed="42" />
            <feDisplacementMap in="SourceGraphic" scale="45" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      </svg>

      {/* 1. Low Creeping Horizon Mist (Drifting Right to Left) */}
      <motion.div
        animate={{ x: ['0%', '-50%'] }}
        transition={{
          duration: 38 / (1 + dynamicBoost * 0.8),
          repeat: Infinity,
          ease: 'linear',
        }}
        style={{ filter: 'url(#ambient-fog-filter) blur(20px)' }}
        className="absolute bottom-0 inset-x-0 w-[200vw] h-[55%] flex items-end opacity-40"
      >
        <div className="w-1/2 h-full bg-gradient-to-t from-[#2c261e]/85 via-[#4a3f30]/40 to-transparent rounded-full scale-y-125" />
        <div className="w-1/2 h-full bg-gradient-to-t from-[#2c261e]/85 via-[#4a3f30]/40 to-transparent rounded-full scale-y-125" />
      </motion.div>

      {/* 2. Midground Rolling Atmospheric Clouds (Drifting Left to Right) */}
      <motion.div
        animate={{ x: ['-50%', '0%'] }}
        transition={{
          duration: 48 / (1 + dynamicBoost * 0.8),
          repeat: Infinity,
          ease: 'linear',
        }}
        style={{ filter: 'url(#ambient-fog-filter) blur(26px)' }}
        className="absolute top-1/4 inset-x-0 w-[200vw] h-[50%] flex items-center opacity-30"
      >
        <div className="w-1/2 h-3/4 bg-gradient-to-r from-transparent via-[#3b3327]/60 to-transparent rounded-full scale-125" />
        <div className="w-1/2 h-3/4 bg-gradient-to-r from-transparent via-[#3b3327]/60 to-transparent rounded-full scale-125" />
      </motion.div>

      {/* 3. Golden Amber Haze Currents (Catching District Ambient Lights) */}
      <motion.div
        animate={{
          x: ['-25%', '15%', '-25%'],
          opacity: [0.18, 0.32, 0.18],
        }}
        transition={{
          duration: 22,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="absolute bottom-12 inset-x-0 w-[150vw] h-[45%] bg-[radial-gradient(ellipse_at_45%_70%,rgba(214,178,101,0.22)_0%,transparent_70%)] blur-3xl"
      />
    </div>
  );
}

// ================= REALISTIC CLOUD & STEAM TRANSITION (Z-25) =================
function RealisticFogCurtain({ isVisible }) {
  return (
    <>
      <svg className="w-0 h-0 absolute pointer-events-none">
        <defs>
          <filter id="realistic-cloud-filter" x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="4" seed="23" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="65" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      </svg>

      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="absolute top-20 sm:top-24 inset-x-0 bottom-0 z-25 overflow-hidden pointer-events-none"
          >
            {/* Base Atmosphere Bleed with 10-15% transparency */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.86, 0.86, 0] }}
              transition={{ duration: 0.95, times: [0, 0.4, 0.65, 1.0], ease: 'easeInOut' }}
              className="absolute inset-0 bg-gradient-to-r from-[#141210]/85 via-[#29231c]/80 to-[#141210]/85 backdrop-blur-md"
            />

            {/* Left Billowing Steam Wave */}
            <motion.div
              initial={{ x: '-110%', opacity: 0 }}
              animate={{
                x: ['-110%', '0%', '0%', '-115%'],
                opacity: [0, 0.9, 0.9, 0],
              }}
              transition={{ duration: 0.95, times: [0, 0.38, 0.65, 1.0], ease: [0.22, 1, 0.36, 1] }}
              style={{ filter: 'url(#realistic-cloud-filter) blur(16px)' }}
              className="absolute inset-y-0 -left-16 w-[90vw] flex flex-col justify-around pointer-events-none"
            >
              <div className="w-full h-[45%] bg-gradient-to-r from-[#241f1a] via-[#453c30] to-transparent opacity-80 rounded-full scale-125" />
              <div className="w-[95%] h-[50%] bg-gradient-to-r from-[#322b22] via-[#544837] to-transparent opacity-85 rounded-full scale-150" />
              <div className="w-full h-[40%] bg-gradient-to-r from-[#1d1915] via-[#3a3127] to-transparent opacity-75 rounded-full scale-125" />
            </motion.div>

            {/* Right Billowing Steam Wave */}
            <motion.div
              initial={{ x: '110%', opacity: 0 }}
              animate={{
                x: ['110%', '0%', '0%', '115%'],
                opacity: [0, 0.9, 0.9, 0],
              }}
              transition={{ duration: 0.95, times: [0, 0.38, 0.65, 1.0], ease: [0.22, 1, 0.36, 1] }}
              style={{ filter: 'url(#realistic-cloud-filter) blur(16px)' }}
              className="absolute inset-y-0 -right-16 w-[90vw] flex flex-col justify-around pointer-events-none"
            >
              <div className="w-full h-[45%] bg-gradient-to-l from-[#241f1a] via-[#453c30] to-transparent opacity-80 rounded-full scale-125" />
              <div className="w-[95%] h-[50%] bg-gradient-to-l from-[#322b22] via-[#544837] to-transparent opacity-85 rounded-full scale-150" />
              <div className="w-full h-[40%] bg-gradient-to-l from-[#1d1915] via-[#3a3127] to-transparent opacity-75 rounded-full scale-125" />
            </motion.div>

            {/* Atmospheric Speed Wind Streaks */}
            <motion.div
              initial={{ opacity: 0, x: '80%' }}
              animate={{ opacity: [0, 0.65, 0], x: ['80%', '-40%', '-120%'] }}
              transition={{ duration: 0.85, ease: 'easeOut' }}
              className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-200/10 to-transparent blur-md"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default function Timeline() {
  const containerRef = useRef(null);
  const [scrollVal, setScrollVal] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isFogActive, setIsFogActive] = useState(false);
  const [currentVelocity, setCurrentVelocity] = useState(0);

  const activeIndexRef = useRef(0);
  const fogTimeoutRef = useRef(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  const smoothScroll = useSpring(scrollYProgress, {
    stiffness: 90,
    damping: 26,
    restDelta: 0.001,
  });

  const scrollVelocity = useVelocity(smoothScroll);

  useEffect(() => {
    const unsubScroll = smoothScroll.on('change', (latest) => {
      setScrollVal(latest);

      // Distribute equally across all 6 districts between 0.10 and 0.84
      const targetIdx =
        latest < 0.10
          ? 0
          : latest >= 0.84
            ? districtData.length - 1
            : Math.min(
              Math.floor(((latest - 0.10) / 0.74) * districtData.length),
              districtData.length - 1
            );

      if (targetIdx !== activeIndexRef.current) {
        activeIndexRef.current = targetIdx;
        setActiveIndex(targetIdx);

        setIsFogActive(true);
        if (fogTimeoutRef.current) clearTimeout(fogTimeoutRef.current);
        fogTimeoutRef.current = setTimeout(() => {
          setIsFogActive(false);
        }, 950);
      }
    });

    const unsubVelocity = scrollVelocity.on('change', (latestVel) => {
      setCurrentVelocity(latestVel);
    });

    return () => {
      unsubScroll();
      unsubVelocity();
      if (fogTimeoutRef.current) clearTimeout(fogTimeoutRef.current);
    };
  }, [smoothScroll, scrollVelocity]);

  // UI visible from docking through start of departure sequence (0.10 to 0.85)
  const showDistrictUI = scrollVal >= 0.10 && scrollVal < 0.85;

  return (
    <section ref={containerRef} className="relative w-full h-[900vh] bg-black">

      {/* Pinned Viewport Container */}
      <div className="sticky top-0 h-screen w-full overflow-hidden select-none bg-black">

        {/* ================= 1. MULTI-LAYER PRELOADED BACKGROUNDS (Z-0) ================= */}
        <div className="absolute inset-0 pointer-events-none">
          {districtData.map((item, idx) => (
            <motion.div
              key={item.id}
              initial={false}
              animate={{
                opacity: activeIndex === idx ? 1 : 0,
                scale: activeIndex === idx ? 1 : 1.035,
              }}
              transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-0 bg-cover bg-center bg-no-repeat"
              style={{ backgroundImage: `url('${item.bg}')` }}
            />
          ))}
        </div>

        {/* Ambient Film Vignettes (Z-10) */}
        <div className="absolute inset-0 bg-black/40 pointer-events-none z-10" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/75 pointer-events-none z-10" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_65%,rgba(214,178,101,0.14),transparent_65%)] pointer-events-none z-10" />

        {/* ================= 2. FLOWING AMBIENT BACKGROUND FOG (Z-15) ================= */}
        <AmbientBackgroundFog velocity={currentVelocity} />

        {/* ================= 3. REALISTIC FOG CURTAIN (Z-25, BEHIND TRAIN) ================= */}
        <RealisticFogCurtain isVisible={isFogActive} />

        {/* ================= 4. 3D TRAIN CANVAS (Z-30) ================= */}
        <div className="absolute inset-0 z-30 pointer-events-none">
          <Canvas
            camera={{ position: [0, 0, 5], fov: 45 }}
            gl={{ antialias: true, alpha: true, toneMappingExposure: 0.95 }}
          >
            <ambientLight intensity={0.8} color="#e8d8c3" />
            <directionalLight position={[3, 5, 4]} intensity={2.6} color="#ffdf9e" />
            <directionalLight position={[-3, -2, 3]} intensity={1.6} color="#ff9e3b" />
            <pointLight position={[-2, -1, 2]} intensity={1.2} color="#d4af37" />

            <Suspense fallback={null}>
              <TrainModel
                scrollProgress={scrollVal}
                velocity={currentVelocity}
                isTransitioning={isFogActive}
              />
            </Suspense>

            <Environment preset="night" />
          </Canvas>
        </div>

        {/* ================= 5. DISTRICT BADGE & TEXT CARD LOCKUP (Z-40) ================= */}
        <div className="absolute bottom-16 sm:bottom-20 md:bottom-24 right-4 sm:right-8 md:right-12 z-40 flex flex-col items-center pointer-events-none">
          <AnimatePresence mode="wait">
            {showDistrictUI && (
              <motion.div
                key={districtData[activeIndex].id}
                initial={{ opacity: 0, y: 16, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -16, scale: 0.97 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-col items-center pointer-events-auto"
              >
                {/* Scaled District Seal */}
                <img
                  src={districtData[activeIndex].districtSeal}
                  alt={districtData[activeIndex].district}
                  className="w-22 sm:w-26 md:w-30 h-auto object-contain filter drop-shadow-[0_0_25px_rgba(0,0,0,0.95)] select-none"
                />

                {/* Text Card anchored snugly beneath Seal */}
                <img
                  src={districtData[activeIndex].textCard}
                  alt={districtData[activeIndex].title}
                  className="-mt-2 sm:-mt-4 w-full max-w-[360px] sm:max-w-[420px] md:max-w-[480px] lg:max-w-[520px] h-auto object-contain filter drop-shadow-[0_0_40px_rgba(214,178,101,0.55)] brightness-120 contrast-105 select-none"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ================= 6. FIXED HEADER BAR (Z-50, STRICT TOP LAYER) ================= */}
        <div className="absolute top-0 inset-x-0 z-50 h-20 sm:h-24 bg-[#070707]/90 backdrop-blur-md border-b border-amber-500/20 flex items-center justify-center pointer-events-none shadow-[0_6px_30px_rgba(0,0,0,0.85)]">
          <h2 className="text-3xl sm:text-5xl font-serif tracking-[0.35em] text-[#d6b265] uppercase drop-shadow-[0_0_20px_rgba(214,178,101,0.5)]">
            TIMELINE
          </h2>
        </div>

      </div>
    </section>
  );
}