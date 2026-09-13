import { useRef, useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { motion, AnimatePresence, MotionConfig } from 'framer-motion';
import { Canvas } from '@react-three/fiber';
import { Environment, useProgress } from '@react-three/drei';

import TrainModelHorizontal from './TrainModel';
import TrainModelVertical from './TrainModelVertical';
import { useIsMobile } from './hooks/useMediaQuery';
import { preparePlate } from './plates';

// Balanced exposure & higher sharpening factor on District 4 & 5 to defeat blurriness
const plates = {
  '/assets/District1Bg.jpeg': { exposure: 0.90, contrast: 1.15, saturation: 0.92, shade: 0.65, sharpen: 0.35 },
  '/assets/District2Bg.png': { exposure: 0.86, contrast: 1.14, saturation: 0.90, shade: 0.68, sharpen: 0.40 },
  '/assets/District3Bg.jpg': { exposure: 0.88, contrast: 1.16, saturation: 0.92, shade: 0.68, sharpen: 0.40 },
  '/assets/District4Bg.jpg': { exposure: 0.90, contrast: 1.25, saturation: 0.92, shade: 0.62, sharpen: 0.70 },
  '/assets/District5Bg.png': { exposure: 0.88, contrast: 1.28, saturation: 0.94, shade: 0.60, sharpen: 0.75 },
  '/assets/CapitolBg.jpg': { exposure: 0.80, contrast: 1.18, saturation: 0.90, shade: 0.75, sharpen: 0.40 },
};

const stops = [
  {
    id: 'd13',
    district: 'District 13',
    bg: '/assets/District1Bg.jpeg',
    seal: '/assets/District1.png',
    tint: '#cfcfcf',
    title: ['The', 'Reaping'],
    body: 'Your name has been drawn. The train leaves the station soon. Register before the Capitol claims your seat. Once you board, there’s no turning back.',
  },
  {
    id: 'd12',
    district: 'District 12',
    bg: '/assets/District2Bg.png',
    seal: '/assets/District2.png',
    tint: '#5fd0bf',
    title: ['The', 'Announcement'],
    body: 'The names have been read aloud in every District. Your team has been reaped. Check the list — are you standing among the chosen?',
  },
  {
    id: 'd9',
    district: 'District 9',
    bg: '/assets/District3Bg.jpg',
    seal: '/assets/District3.png',
    tint: '#b4c0a2',
    title: ['The', 'Arrival'],
    body: 'The train pulls into the Capitol. Bring your tools (laptops), your team, and whatever courage you have left. Final briefing before the gates open.',
  },
  {
    id: 'd8',
    district: 'District 8',
    bg: '/assets/District4Bg.jpg',
    seal: '/assets/District4.png',
    tint: '#c28d44',
    title: ['The Games', 'Begin'],
    body: 'The gong has sounded. The arena is yours — solve the clues, outlast the field, outwit the Gamemakers. May the odds be ever in your favor.',
  },
  {
    id: 'd1',
    district: 'District 1',
    bg: '/assets/District5Bg.png',
    seal: '/assets/District5.png',
    tint: '#b3ae5e',
    title: ['The Cannon', 'Fires'],
    body: 'The arena falls silent. Time’s up — pencils down, tools away. The Gamemakers are now tallying who truly survived.',
  },
  {
    id: 'capitol',
    district: 'The Capitol',
    bg: '/assets/CapitolBg.jpg',
    seal: '/assets/Capitol.png',
    tint: '#d9c9a3',
    title: ['The Victor’s', 'Crown'],
    body: 'The Capitol has decided. One tribute rises above the rest and is crowned Victor. Step forward and claim what’s yours.',
  },
];

const TOTAL = stops.length;
const VIRTUAL_TOTAL_STEPS = TOTAL + 1;

const MOBILE_NODE_PERCENTAGES = [26, 36, 46, 56, 66, 76];

const TRANSITION_MS = 950;
const EASE = [0.16, 1, 0.3, 1];
const pad = (n) => String(n).padStart(2, '0');

function Preloader({ progress, visible }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="preloader"
          className="absolute inset-0 z-[60] flex flex-col items-center justify-center bg-[var(--ink)]"
          exit={{ opacity: 0 }}
          transition={{ duration: 0.9, ease: EASE }}
        >
          <p className="font-display text-[16px] sm:text-[20px] tracking-[0.4em] pl-[0.4em] text-[var(--ivory)]">
            TIMELINE
          </p>
          <div className="mt-7 h-px w-44 bg-[var(--hair)] overflow-hidden">
            <motion.div
              className="h-full bg-[var(--gold)] origin-left"
              animate={{ scaleX: progress / 100 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            />
          </div>
          <p className="eyebrow mt-4 text-[var(--ivory-faint)] tabular-nums">{pad(Math.round(progress))} / 100</p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Clean transform without CSS blur or heavy scale shifts that trigger GPU downsampling
const bgVariants = {
  enter: ({ dir, isMobile }) => ({
    opacity: 0,
    scale: 1.04,
    x: isMobile ? '0%' : `${dir * 4}%`,
    y: isMobile ? `${dir * 8}%` : '0%',
  }),
  center: {
    opacity: 1,
    scale: 1,
    x: '0%',
    y: '0%',
  },
  exit: ({ dir, isMobile }) => ({
    opacity: 0,
    scale: 1.02,
    x: isMobile ? '0%' : `${dir * -3}%`,
    y: isMobile ? `${dir * -8}%` : '0%',
  }),
};

function Backdrop({ index, dir, plateUrls, isMobile }) {
  const activeIdx = Math.min(index, TOTAL - 1);
  const stop = stops[activeIdx];
  const customParam = useMemo(() => ({ dir, isMobile }), [dir, isMobile]);

  return (
    <div className="absolute inset-0 overflow-hidden bg-[#07080a]">
      <AnimatePresence initial={false} custom={customParam}>
        <motion.div
          key={stop.id}
          custom={customParam}
          variants={bgVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{
            duration: 1.2,
            ease: EASE,
            opacity: { duration: 0.9, ease: 'easeInOut' },
          }}
          className="absolute inset-0 bg-cover bg-center [image-rendering:-webkit-optimize-contrast] contrast-[1.05] saturate-[0.98]"
          style={{ backgroundImage: `url('${plateUrls[stop.bg] ?? stop.bg}')` }}
        />
      </AnimatePresence>

      {/* Desktop side vignetting to cradle 3D train and typography */}
      <div className="absolute inset-0 hidden lg:block bg-[linear-gradient(90deg,rgba(5,6,8,0.52)_0%,rgba(5,6,8,0.14)_22%,rgba(5,6,8,0.08)_45%,rgba(5,6,8,0.58)_75%,rgba(5,6,8,0.85)_100%)]" />

      {/* Atmospheric overhead shadow */}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,6,8,0.65)_0%,rgba(5,6,8,0.06)_20%,rgba(5,6,8,0.18)_65%,rgba(5,6,8,0.65)_100%)]" />

      {/* Mobile bottom readability shield (concentrated only over the bottom info deck) */}
      <div className="absolute inset-0 lg:hidden bg-[linear-gradient(0deg,rgba(5,6,8,0.92)_0%,rgba(5,6,8,0.72)_48%,rgba(5,6,8,0)_78%)]" />

      {/* Subtle radial center vignette */}
      <motion.div
        className="absolute inset-0 bg-[radial-gradient(ellipse_75%_65%_at_50%_100%,rgba(5,6,8,0.6),rgba(5,6,8,0.25)_50%,transparent_85%)] lg:bg-[radial-gradient(ellipse_55%_75%_at_78%_52%,rgba(5,6,8,0.68),rgba(5,6,8,0.32)_50%,transparent_85%)]"
        initial={false}
        animate={{ opacity: plates[stop.bg].shade }}
        transition={{ duration: 1.1, ease: 'easeInOut' }}
      />
    </div>
  );
}

function AmbientBackgroundFog({ isMobile }) {
  return (
    <div className="absolute inset-0 z-15 pointer-events-none overflow-hidden select-none">
      <svg className="w-0 h-0 absolute pointer-events-none">
        <defs>
          <filter id="ambient-fog-filter" x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency="0.015" numOctaves="3" seed="42" />
            <feDisplacementMap in="SourceGraphic" scale="35" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      </svg>

      <motion.div
        animate={isMobile ? { y: ['0%', '-50%'] } : { x: ['0%', '-50%'] }}
        transition={{ duration: 42, repeat: Infinity, ease: 'linear' }}
        style={{ filter: 'url(#ambient-fog-filter) blur(18px)' }}
        className="absolute bottom-0 inset-x-0 w-[200vw] h-[35%] flex items-end opacity-25"
      >
        <div className="w-1/2 h-full bg-gradient-to-t from-[#0e0c0a]/90 via-[#231e17]/30 to-transparent rounded-full" />
        <div className="w-1/2 h-full bg-gradient-to-t from-[#0e0c0a]/90 via-[#231e17]/30 to-transparent rounded-full" />
      </motion.div>

      <motion.div
        animate={{ opacity: [0.12, 0.22, 0.12] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute bottom-4 inset-x-0 w-full h-[38%] bg-[radial-gradient(ellipse_at_50%_80%,rgba(160,125,60,0.12)_0%,transparent_70%)] blur-3xl"
      />
    </div>
  );
}

function RealisticFogCurtain({ isVisible, isMobile, dir }) {
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
            className="absolute inset-0 z-25 overflow-hidden pointer-events-none"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.88, 0.88, 0] }}
              transition={{ duration: 0.95, times: [0, 0.4, 0.65, 1.0], ease: 'easeInOut' }}
              className="absolute inset-0 bg-gradient-to-b from-[#0c0a08]/85 via-[#1f1914]/80 to-[#0c0a08]/85 backdrop-blur-md"
            />

            {isMobile ? (
              <>
                <motion.div
                  initial={{ y: `${dir * -100}%`, opacity: 0 }}
                  animate={{
                    y: [`${dir * -100}%`, '0%', '0%', `${dir * 100}%`],
                    opacity: [0, 0.92, 0.92, 0],
                  }}
                  transition={{ duration: 1.05, times: [0, 0.38, 0.65, 1.0], ease: [0.22, 1, 0.36, 1] }}
                  style={{ filter: 'url(#realistic-cloud-filter) blur(16px)' }}
                  className="absolute inset-x-0 -top-24 h-[90vh] flex flex-col justify-around pointer-events-none"
                >
                  <div className="w-full h-[45%] bg-gradient-to-b from-[#181410] via-[#332b22] to-transparent opacity-85 rounded-full scale-125" />
                  <div className="w-full h-[50%] bg-gradient-to-b from-[#201a14] via-[#3d3326] to-transparent opacity-90 rounded-full scale-150" />
                </motion.div>

                <motion.div
                  initial={{ y: `${dir * 100}%`, opacity: 0 }}
                  animate={{
                    y: [`${dir * 100}%`, '0%', '0%', `${dir * -100}%`],
                    opacity: [0, 0.92, 0.92, 0],
                  }}
                  transition={{ duration: 1.05, times: [0, 0.38, 0.65, 1.0], ease: [0.22, 1, 0.36, 1] }}
                  style={{ filter: 'url(#realistic-cloud-filter) blur(16px)' }}
                  className="absolute inset-x-0 -bottom-24 h-[90vh] flex flex-col justify-around pointer-events-none"
                >
                  <div className="w-full h-[45%] bg-gradient-to-t from-[#181410] via-[#332b22] to-transparent opacity-85 rounded-full scale-125" />
                  <div className="w-full h-[50%] bg-gradient-to-t from-[#201a14] via-[#3d3326] to-transparent opacity-90 rounded-full scale-150" />
                </motion.div>
              </>
            ) : (
              <>
                <motion.div
                  initial={{ x: '-110%', opacity: 0 }}
                  animate={{
                    x: ['-110%', '0%', '0%', '-115%'],
                    opacity: [0, 0.92, 0.92, 0],
                  }}
                  transition={{ duration: 1.0, times: [0, 0.38, 0.65, 1.0], ease: [0.22, 1, 0.36, 1] }}
                  style={{ filter: 'url(#realistic-cloud-filter) blur(16px)' }}
                  className="absolute inset-y-0 -left-16 w-[90vw] flex flex-col justify-around pointer-events-none"
                >
                  <div className="w-full h-[45%] bg-gradient-to-r from-[#181410] via-[#332b22] to-transparent opacity-80 rounded-full scale-125" />
                  <div className="w-[95%] h-[50%] bg-gradient-to-r from-[#201a14] via-[#3d3326] to-transparent opacity-85 rounded-full scale-150" />
                  <div className="w-full h-[40%] bg-gradient-to-r from-[#14100d] via-[#2d251d] to-transparent opacity-75 rounded-full scale-125" />
                </motion.div>

                <motion.div
                  initial={{ x: '110%', opacity: 0 }}
                  animate={{
                    x: ['110%', '0%', '0%', '115%'],
                    opacity: [0, 0.92, 0.92, 0],
                  }}
                  transition={{ duration: 1.0, times: [0, 0.38, 0.65, 1.0], ease: [0.22, 1, 0.36, 1] }}
                  style={{ filter: 'url(#realistic-cloud-filter) blur(16px)' }}
                  className="absolute inset-y-0 -right-16 w-[90vw] flex flex-col justify-around pointer-events-none"
                >
                  <div className="w-full h-[45%] bg-gradient-to-l from-[#181410] via-[#332b22] to-transparent opacity-80 rounded-full scale-125" />
                  <div className="w-[95%] h-[50%] bg-gradient-to-l from-[#201a14] via-[#3d3326] to-transparent opacity-85 rounded-full scale-150" />
                  <div className="w-full h-[40%] bg-gradient-to-l from-[#14100d] via-[#2d251d] to-transparent opacity-80 rounded-full scale-125" />
                </motion.div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function Seal({ stop }) {
  return (
    <img
      src={stop.seal}
      alt={`${stop.district} seal`}
      className="h-12 sm:h-[62px] lg:h-[clamp(80px,6vw,104px)] w-auto object-contain"
      style={{ filter: `drop-shadow(0 0 24px ${stop.tint}70) drop-shadow(0 8px 18px rgba(0,0,0,0.85))` }}
    />
  );
}

function DesktopVerticalArrowRail({ index, onSelect }) {
  const activeIdx = Math.min(index, TOTAL - 1);

  return (
    <nav
      aria-label="Timeline stops"
      className="absolute z-40 hidden lg:block w-36 left-[var(--pad-x)] top-1/2 -translate-y-1/2 h-[min(54vh,440px)]"
    >
      <div className="relative w-full h-full select-none">
        <svg
          viewBox="0 0 30 440"
          preserveAspectRatio="none"
          className="absolute left-0 w-8 h-full overflow-visible pointer-events-none"
        >
          <defs>
            <filter id="desk-gold-glow" x="-40%" y="-10%" width="180%" height="120%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <linearGradient id="desk-beam-grad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(214,178,101,0.25)" />
              <stop offset="40%" stopColor="rgba(240,212,143,0.85)" />
              <stop offset="100%" stopColor="rgba(255,225,160,1)" />
            </linearGradient>
          </defs>

          {/* Top Tail Cap */}
          <line
            x1="8"
            y1="8"
            x2="22"
            y2="8"
            stroke="#f0d48f"
            strokeWidth="1.8"
            filter="url(#desk-gold-glow)"
          />

          {/* Guide Track Line */}
          <line
            x1="15"
            y1="8"
            x2="15"
            y2="422"
            stroke="rgba(214,178,101,0.22)"
            strokeWidth="1.2"
          />

          {/* Vertical Shaft (x1=15, x2=15 straight down) */}
          <motion.line
            x1="15"
            y1="8"
            x2="15"
            y2="422"
            stroke="url(#desk-beam-grad)"
            strokeWidth="1.6"
            strokeLinecap="round"
            filter="url(#desk-gold-glow)"
            animate={{ opacity: [0.75, 1, 0.75] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          />

          {/* Downward Arrowhead */}
          <polygon
            points="9,420 21,420 15,436"
            fill="#f0d48f"
            filter="url(#desk-gold-glow)"
          />
        </svg>

        {stops.map((s, i) => {
          const isActive = i === activeIdx;
          const topPercent = 8 + (i / (TOTAL - 1)) * 74;

          return (
            <div
              key={s.id}
              style={{ top: `${topPercent}%` }}
              className="absolute left-[15px] -translate-x-1/2 -translate-y-1/2 flex items-center"
            >
              <button
                type="button"
                onClick={() => onSelect(i)}
                aria-label={`${pad(i + 1)} — ${s.district}: ${s.title.join(' ')}`}
                aria-current={isActive ? 'step' : undefined}
                className="group relative flex items-center cursor-pointer focus:outline-none"
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center font-mono text-[10px] transition-all duration-300 ${isActive
                    ? 'bg-[#1b150d] border-2 border-[#f0d48f] text-[#ffeaad] font-bold shadow-[0_0_16px_rgba(240,212,143,0.9)] scale-110'
                    : i < activeIdx
                      ? 'bg-[#100e0b]/90 border border-[#d6b265]/60 text-[#d6b265] shadow-[0_2px_8px_rgba(0,0,0,0.85)] group-hover:scale-105'
                      : 'bg-[#0a0908]/90 border border-amber-500/30 text-[#857766] group-hover:border-[#d6b265] group-hover:text-[#ffeaad] shadow-[0_2px_8px_rgba(0,0,0,0.85)] group-hover:scale-105'
                    }`}
                >
                  {pad(i + 1)}
                </div>

                <span
                  className={`absolute left-9 pl-1 eyebrow text-[9.5px] tracking-[0.18em] whitespace-nowrap transition-all duration-300 pointer-events-none ${isActive
                    ? 'text-[var(--gold)] font-semibold opacity-100'
                    : 'text-[var(--ivory-faint)] opacity-0 group-hover:opacity-100 group-hover:text-[var(--ivory-dim)]'
                    }`}
                >
                  {s.district}
                </span>
              </button>
            </div>
          );
        })}
      </div>
    </nav>
  );
}

const lineReveal = {
  hidden: { y: '105%' },
  show: (i) => ({ y: '0%', transition: { duration: 0.95, ease: EASE, delay: 0.18 + i * 0.07 } }),
};

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: (i) => ({ opacity: 1, y: 0, transition: { duration: 0.85, ease: EASE, delay: 0.26 + i * 0.07 } }),
};

const sealIn = {
  hidden: { opacity: 0, scale: 0.82, rotate: -8, filter: 'blur(6px)' },
  show: { opacity: 1, scale: 1, rotate: 0, filter: 'blur(0px)', transition: { duration: 1.1, ease: EASE, delay: 0.1 } },
};

function StopCopy({ index }) {
  const activeIdx = Math.min(index, TOTAL - 1);
  const stop = stops[activeIdx];
  return (
    <AnimatePresence mode="wait">
      <motion.article
        key={stop.id}
        initial="hidden"
        animate="show"
        exit={{ opacity: 0, y: -6, transition: { duration: 0.22, ease: 'easeIn' } }}
        className="w-full"
        aria-live="polite"
      >
        <div className="flex items-center gap-4 lg:gap-6">
          <motion.div variants={sealIn} className="shrink-0">
            <Seal stop={stop} />
          </motion.div>
          <motion.span custom={0} variants={fadeUp} className="self-stretch my-2 w-px bg-[var(--hair)]" />
          <motion.div custom={0} variants={fadeUp} className="min-w-0 flex-1">
            <p className="eyebrow text-[var(--gold)] text-[10px] sm:text-xs">{stop.district}</p>
            <div className="mt-1.5 flex items-center gap-3">
              <span className="eyebrow tabular-nums text-[var(--ivory-faint)] text-[9px] sm:text-[10px]" style={{ letterSpacing: '0.18em' }}>
                <span className="text-[var(--ivory)]">{pad(activeIdx + 1)}</span> / {pad(TOTAL)}
              </span>
              <span className="h-px flex-1 bg-[var(--hair)]" />
            </div>
          </motion.div>
        </div>

        <h1 className="font-display mt-3 lg:mt-7 font-normal uppercase text-[var(--ivory)] leading-[1.12] lg:leading-[1.08] tracking-[0.015em] [text-shadow:0_2px_18px_rgba(0,0,0,0.6)] text-[clamp(1.35rem,5.2vw,2.05rem)] lg:text-[clamp(1.65rem,2.3vw,2.85rem)]">
          {stop.title.map((line, i) => (
            <span key={line} className="block overflow-hidden pb-[0.05em] whitespace-nowrap">
              <motion.span custom={i} variants={lineReveal} className="block">
                {line}
              </motion.span>
            </span>
          ))}
        </h1>

        <motion.span custom={1} variants={fadeUp} className="block mt-2 lg:mt-6 h-px w-10 bg-[var(--gold-soft)]" />

        <motion.p
          custom={2}
          variants={fadeUp}
          className="mt-2 lg:mt-5 text-[12.5px] sm:text-[14.5px] leading-[1.65] tracking-[0.015em] text-[rgba(236,230,218,0.88)] [text-shadow:0_1px_12px_rgba(0,0,0,0.9)] max-w-[32rem]"
        >
          {stop.body}
        </motion.p>
      </motion.article>
    </AnimatePresence>
  );
}

function NextStop({ index, onGo }) {
  const next = index < TOTAL - 1 ? stops[index + 1] : null;
  return (
    <button
      type="button"
      onClick={() => onGo(index < VIRTUAL_TOTAL_STEPS - 1 ? index + 1 : 0)}
      aria-label={next ? `Next stop: ${next.district}, ${next.title.join(' ')}` : 'Return to the first stop'}
      className="group ml-auto md:ml-0 flex items-center gap-3.5 sm:gap-5 min-w-0 cursor-pointer"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={index}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE, delay: 0.5 } }}
          exit={{ opacity: 0, y: -8, transition: { duration: 0.3, ease: 'easeIn' } }}
          className="flex min-w-0 flex-col items-end text-right"
        >
          <span className="eyebrow text-[9px] sm:text-[10px] text-[var(--ivory-faint)] tabular-nums">
            {next ? `Next stop · ${pad(index + 2)}` : index === TOTAL - 1 ? 'Departing Capitol' : 'End of the line'}
          </span>
          <span className="mt-1.5 max-w-full truncate font-display text-[14px] sm:text-[17px] leading-none tracking-[0.02em] text-[var(--ivory)] transition-colors duration-500 group-hover:text-white">
            {next ? (
              <>
                {next.district}
                <span className="hidden sm:inline">
                  <span className="mx-2 text-[var(--ivory-faint)]">—</span>
                  <span className="text-[var(--ivory-dim)]">{next.title.join(' ')}</span>
                </span>
              </>
            ) : (
              <>Back to {stops[0].district}</>
            )}
          </span>
        </motion.span>
      </AnimatePresence>
      <span className="grid shrink-0 place-items-center w-9 h-9 sm:w-11 sm:h-11 rounded-full border border-[var(--hair)] text-[var(--ivory-dim)] transition-colors duration-500 group-hover:border-[var(--gold-soft)] group-hover:text-[var(--gold)]">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
          aria-hidden="true"
          className={index < VIRTUAL_TOTAL_STEPS - 1 ? 'nudge' : 'rotate-180'}
        >
          <path d="M4 12h15M13 6l6 6-6 6" />
        </svg>
      </span>
    </button>
  );
}

export default function Timeline() {
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState(1);
  const [ready, setReady] = useState(false);
  const [hasMoved, setHasMoved] = useState(false);
  const [isFogActive, setIsFogActive] = useState(false);
  const [plateUrls, setPlateUrls] = useState({});
  const [platesReady, setPlatesReady] = useState(false);

  const isMobile = useIsMobile(768);
  const { progress, active } = useProgress();

  const indexRef = useRef(0);
  const lockUntil = useRef(0);
  const fogTimeoutRef = useRef(null);
  const wheelAcc = useRef(0);
  const lastWheel = useRef(0);
  const touchY = useRef(null);

  useEffect(() => {
    if (progress >= 100 && !active && platesReady) {
      const id = setTimeout(() => setReady(true), 350);
      return () => clearTimeout(id);
    }
  }, [progress, active, platesReady]);

  useEffect(() => {
    let cancelled = false;
    const made = [];
    (async () => {
      for (const url of new Set(stops.map((s) => s.bg))) {
        try {
          const out = await preparePlate(url, plates[url]);
          if (cancelled) {
            URL.revokeObjectURL(out);
            break;
          }
          made.push(out);
          setPlateUrls((prev) => ({ ...prev, [url]: out }));
        } catch {
          // fallback
        }
        await new Promise((r) => setTimeout(r, 0));
      }
      if (!cancelled) setPlatesReady(true);
    })();
    stops.forEach((s) => {
      if (s.seal) new Image().src = s.seal;
    });
    return () => {
      cancelled = true;
      made.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);

  const go = useCallback(
    (next) => {
      const now = performance.now();
      if (!ready || next < 0 || next >= VIRTUAL_TOTAL_STEPS || next === indexRef.current || now < lockUntil.current) return;
      lockUntil.current = now + TRANSITION_MS;
      setDir(next > indexRef.current ? 1 : -1);
      setHasMoved(true);
      indexRef.current = next;
      setIndex(next);

      setIsFogActive(true);
      if (fogTimeoutRef.current) clearTimeout(fogTimeoutRef.current);
      fogTimeoutRef.current = setTimeout(() => {
        setIsFogActive(false);
      }, 1050);
    },
    [ready]
  );

  useEffect(() => {
    const onWheel = (e) => {
      e.preventDefault();
      const now = performance.now();
      if (now < lockUntil.current) {
        lockUntil.current = Math.max(lockUntil.current, now + 160);
        wheelAcc.current = 0;
        return;
      }
      if (now - lastWheel.current > 220) wheelAcc.current = 0;
      lastWheel.current = now;
      wheelAcc.current += e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      if (Math.abs(wheelAcc.current) > 50) {
        go(indexRef.current + Math.sign(wheelAcc.current));
        wheelAcc.current = 0;
      }
    };
    const onKey = (e) => {
      if (['ArrowDown', 'ArrowRight', 'PageDown', ' '].includes(e.key)) {
        e.preventDefault();
        go(indexRef.current + 1);
      } else if (['ArrowUp', 'ArrowLeft', 'PageUp'].includes(e.key)) {
        e.preventDefault();
        go(indexRef.current - 1);
      } else if (e.key === 'Home') go(0);
      else if (e.key === 'End') go(VIRTUAL_TOTAL_STEPS - 1);
    };
    const onTouchStart = (e) => {
      touchY.current = e.touches[0].clientY;
    };
    const onTouchEnd = (e) => {
      if (touchY.current === null) return;
      const dy = touchY.current - e.changedTouches[0].clientY;
      if (Math.abs(dy) > 48) go(indexRef.current + Math.sign(dy));
      touchY.current = null;
    };

    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKey);
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchend', onTouchEnd);
      if (fogTimeoutRef.current) clearTimeout(fogTimeoutRef.current);
    };
  }, [go]);

  const scrollProgress = index / (VIRTUAL_TOTAL_STEPS - 1);

  return (
    <MotionConfig reducedMotion="user">
      <main className="relative h-[100svh] w-full overflow-clip select-none bg-[var(--ink)]">
        {/* Layer 1: Enhanced Background Plate */}
        <Backdrop index={index} dir={dir} plateUrls={plateUrls} isMobile={isMobile} />

        {/* Layer 2: Atmosphere Fog */}
        <AmbientBackgroundFog isMobile={isMobile} />

        {/* Transition Fog Curtain */}
        <RealisticFogCurtain isVisible={isFogActive} isMobile={isMobile} dir={dir} />

        {/* Layer 3: 3D Scene */}
        <div className="absolute inset-0 z-30 pointer-events-none">
          <Canvas
            dpr={[1, 1.5]}
            camera={{ position: [0, 0, 5], fov: 45 }}
            gl={{
              antialias: true,
              alpha: true,
              toneMappingExposure: 0.95,
              powerPreference: 'high-performance',
            }}
          >
            <ambientLight intensity={0.75} color="#e8d8c3" />
            <directionalLight position={[3, 5, 4]} intensity={2.6} color="#ffdf9e" />
            <directionalLight position={[-3, -2, 3]} intensity={1.6} color="#ff9e3b" />
            <pointLight position={[0, -1, 2]} intensity={1.2} color="#d4af37" />

            <Suspense fallback={null}>
              {isMobile ? (
                <TrainModelVertical
                  scrollProgress={scrollProgress}
                  velocity={hasMoved ? 0.3 : 0}
                  isTransitioning={isFogActive}
                />
              ) : (
                <TrainModelHorizontal
                  index={Math.min(index, TOTAL - 1)}
                  total={TOTAL}
                  ready={ready}
                />
              )}
            </Suspense>

            <Environment preset="night" />
          </Canvas>
        </div>

        {/* Layer 4: Grain */}
        <div className="absolute inset-0 z-[35] overflow-hidden pointer-events-none">
          <div className="grain" />
        </div>

        {/* Layer 5: UI Content Stack */}
        <motion.div
          className="absolute inset-0 z-40 pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: ready ? 1 : 0 }}
          transition={{ duration: 1.2, delay: 0.6, ease: 'easeOut' }}
        >
          {/* Header */}
          <header className="absolute top-[var(--pad-y)] inset-x-[var(--pad-x)] flex items-center justify-between pointer-events-auto">
            <div className="flex items-center gap-2.5 sm:gap-5">
              <span className="font-display text-[14px] sm:text-[20px] tracking-[0.32em] text-[var(--ivory)]">
                TIMELINE
              </span>
              <span className="hidden sm:block eyebrow text-[var(--ivory-faint)]">Xtract 5.0</span>
            </div>
          </header>

          {/* Desktop Left Rail */}
          <div className="pointer-events-auto">
            <DesktopVerticalArrowRail index={index} onSelect={go} />
          </div>

          {/* 1. TEXT INFO: Positioned above arrow on mobile */}
          <section className="absolute inset-x-[var(--pad-x)] bottom-[calc(var(--pad-y)+7.4rem)] max-w-[36rem] lg:bottom-auto lg:max-w-none lg:inset-x-auto lg:top-1/2 lg:-translate-y-1/2 lg:right-[calc(var(--pad-x)+0.5rem)] lg:w-[min(38rem,42vw)] pointer-events-auto">
            <StopCopy index={index} />
          </section>

          {/* 2. ARROW & NODES: Positioned below info text and above footer on mobile */}
          <div className="lg:hidden absolute bottom-[calc(var(--pad-y)+4.2rem)] inset-x-4 z-45 flex justify-center pointer-events-auto">
            <div className="relative w-full max-w-[350px] h-7 flex items-center select-none">
              <svg
                viewBox="0 0 350 20"
                className="w-full h-4 overflow-visible pointer-events-none"
              >
                <defs>
                  <filter id="golden-glow" x="-20%" y="-40%" width="140%" height="180%">
                    <feGaussianBlur stdDeviation="2.5" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                  <linearGradient id="beam-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="rgba(214,178,101,0.2)" />
                    <stop offset="40%" stopColor="rgba(240,212,143,0.85)" />
                    <stop offset="100%" stopColor="rgba(255,225,160,1)" />
                  </linearGradient>
                </defs>

                <line
                  x1="8"
                  y1="5"
                  x2="8"
                  y2="15"
                  stroke="#f0d48f"
                  strokeWidth="1.8"
                  filter="url(#golden-glow)"
                />

                <line
                  x1="8"
                  y1="10"
                  x2="334"
                  y2="10"
                  stroke="rgba(214,178,101,0.22)"
                  strokeWidth="1.2"
                />

                <motion.line
                  x1="8"
                  y1="10"
                  x2="334"
                  y2="10"
                  stroke="url(#beam-grad)"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  filter="url(#golden-glow)"
                  animate={{ opacity: [0.75, 1, 0.75] }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                />

                <polygon
                  points="334,5 348,10 334,15"
                  fill="#f0d48f"
                  filter="url(#golden-glow)"
                />
              </svg>

              {stops.map((s, i) => {
                const isActive = i === Math.min(index, TOTAL - 1);
                const leftPercent = MOBILE_NODE_PERCENTAGES[i];

                return (
                  <div
                    key={s.id}
                    style={{ left: `${leftPercent}%` }}
                    className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-auto"
                  >
                    <button
                      type="button"
                      onClick={() => go(i)}
                      title={s.district}
                      aria-label={`Jump to ${s.district}`}
                      className="group flex items-center justify-center cursor-pointer focus:outline-none transition-transform duration-200 hover:scale-110 active:scale-95"
                    >
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center font-mono text-[10px] transition-all duration-300 ${isActive
                          ? 'bg-[#1b150d] border-2 border-[#f0d48f] text-[#ffeaad] font-bold shadow-[0_0_14px_rgba(240,212,143,0.9)] scale-110'
                          : i < index
                            ? 'bg-[#100e0b]/90 border border-[#d6b265]/60 text-[#d6b265] shadow-[0_2px_8px_rgba(0,0,0,0.85)]'
                            : 'bg-[#0a0908]/90 border border-amber-500/30 text-[#857766] hover:border-[#d6b265] hover:text-[#ffeaad] shadow-[0_2px_8px_rgba(0,0,0,0.85)]'
                          }`}
                      >
                        {i + 1}
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. NEXT STOP FOOTER */}
          <footer className="absolute bottom-[var(--pad-y)] inset-x-[var(--pad-x)] flex items-center gap-6 pointer-events-auto">
            <span className="hidden md:block eyebrow text-[var(--ivory-faint)] whitespace-nowrap">
              A journey without return
            </span>
            <span className="hidden md:block h-px flex-1 bg-[var(--hair)]" />
            <NextStop index={index} onGo={go} />
          </footer>
        </motion.div>

        <Preloader progress={platesReady ? progress : Math.min(progress, 96)} visible={!ready} />
      </main>
    </MotionConfig>
  );
}