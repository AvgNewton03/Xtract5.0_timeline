import { useRef, useState, useEffect, useCallback, Suspense } from 'react';
import { motion, AnimatePresence, MotionConfig } from 'framer-motion';
import { Canvas } from '@react-three/fiber';
import { Environment, useProgress } from '@react-three/drei';

import TrainModelHorizontal from './TrainModel';
import TrainModelVertical from './TrainModelVertical';
import { useIsMobile } from './hooks/useMediaQuery';
import { preparePlate } from './plates';

const plates = {
  '/assets/District1Bg.jpeg': { exposure: 1.2, contrast: 1.1, saturation: 1.05, shade: 0.5 },
  '/assets/District2Bg.png': { exposure: 1.0, contrast: 1.08, saturation: 1.0, shade: 0.7 },
  '/assets/District3Bg.jpg': { exposure: 1.0, contrast: 1.08, saturation: 1.0, shade: 0.7 },
  '/assets/District4Bg.jpg': { exposure: 1.02, contrast: 1.08, saturation: 0.96, shade: 0.85 },
  '/assets/District5Bg.png': { exposure: 1.0, contrast: 1.06, saturation: 1.0, shade: 0.9 },
  '/assets/CapitolBg.jpg': { exposure: 0.76, contrast: 1.06, saturation: 0.92, shade: 1 },
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
          <p className="font-display text-[22px] tracking-[0.5em] pl-[0.5em] text-[var(--ivory)]">TIMELINE</p>
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

const bgVariants = {
  enter: (dir) => ({ opacity: 0, scale: 1.12, x: `${dir * 5}%`, filter: 'blur(6px)' }),
  center: { opacity: 1, scale: 1, x: '0%', filter: 'blur(0px)' },
  exit: (dir) => ({ opacity: 0, scale: 1.08, x: `${dir * -4}%`, filter: 'blur(6px)' }),
};

function Backdrop({ index, dir, plateUrls }) {
  const activeIdx = Math.min(index, TOTAL - 1);
  const stop = stops[activeIdx];
  return (
    <div className="absolute inset-0 overflow-hidden">
      <AnimatePresence initial={false} custom={dir}>
        <motion.div
          key={stop.id}
          custom={dir}
          variants={bgVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 1.6, ease: EASE, opacity: { duration: 1.1, ease: 'easeInOut' } }}
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url('${plateUrls[stop.bg] ?? stop.bg}')` }}
        />
      </AnimatePresence>

      <div className="absolute inset-0 hidden lg:block bg-[linear-gradient(90deg,rgba(7,8,10,0.25)_0%,rgba(7,8,10,0)_14%,rgba(7,8,10,0)_60%,rgba(7,8,10,0.6)_82%,rgba(7,8,10,0.76)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,8,10,0.55)_0%,rgba(7,8,10,0)_15%,rgba(7,8,10,0)_72%,rgba(7,8,10,0.6)_100%)]" />
      <div className="absolute inset-0 lg:hidden bg-[linear-gradient(180deg,rgba(7,8,10,0)_38%,rgba(7,8,10,0.86)_68%,rgba(7,8,10,0.96)_100%)]" />

      <motion.div
        className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_100%,rgba(7,8,10,0.85),rgba(7,8,10,0.5)_50%,transparent_80%)] lg:bg-[radial-gradient(ellipse_40%_60%_at_79%_52%,rgba(7,8,10,0.8),rgba(7,8,10,0.5)_50%,transparent_80%)]"
        initial={false}
        animate={{ opacity: plates[stop.bg].shade }}
        transition={{ duration: 1.1, ease: 'easeInOut' }}
      />
    </div>
  );
}

function SteamSweep({ index, dir, enabled }) {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <AnimatePresence>
        {enabled && (
          <motion.div
            key={index}
            initial={{ x: `${dir * -70}%`, opacity: 0 }}
            animate={{ x: `${dir * 70}%`, opacity: [0, 0.8, 0] }}
            transition={{ duration: 1.5, ease: [0.45, 0, 0.2, 1] }}
            className="absolute inset-y-[18%] -inset-x-[20%]"
            style={{
              background:
                'radial-gradient(ellipse 38% 42% at 50% 62%, rgba(150,132,106,0.4), transparent 70%), radial-gradient(ellipse 22% 26% at 38% 70%, rgba(214,190,150,0.2), transparent 70%)',
              filter: 'blur(36px)',
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function Seal({ stop }) {
  return (
    <img
      src={stop.seal}
      alt={`${stop.district} seal`}
      className="h-16 sm:h-[72px] lg:h-[clamp(84px,6.4vw,108px)] w-auto object-contain"
      style={{ filter: `drop-shadow(0 0 32px ${stop.tint}59) drop-shadow(0 10px 24px rgba(0,0,0,0.7))` }}
    />
  );
}

function Rail({ index, onSelect }) {
  return (
    <nav
      aria-label="Timeline stops"
      className="absolute z-40 hidden lg:block w-16 left-[var(--pad-x)] top-1/2 -translate-y-1/2 h-[min(46vh,380px)]"
    >
      <div className="absolute left-[4px] -top-8 -bottom-8 w-px bg-[var(--hair)]" />
      <motion.div
        className="absolute left-[4px] inset-y-0 w-px bg-[var(--gold-soft)] origin-top"
        animate={{ scaleY: Math.min(index, TOTAL - 1) / (TOTAL - 1) }}
        transition={{ duration: 1.1, ease: EASE }}
      />
      {stops.map((s, i) => {
        const active = i === Math.min(index, TOTAL - 1);
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelect(i)}
            aria-label={`${pad(i + 1)} — ${s.district}: ${s.title.join(' ')}`}
            aria-current={active ? 'step' : undefined}
            className="group absolute left-0 flex items-center gap-5 -translate-y-1/2 cursor-pointer py-1"
            style={{ top: `${(i / (TOTAL - 1)) * 100}%` }}
          >
            <span className="grid place-items-center w-[9px] h-[9px]">
              <motion.span
                className="block rounded-full"
                animate={{
                  width: active ? 9 : 5,
                  height: active ? 9 : 5,
                  backgroundColor: active ? '#ece6da' : i < index ? '#c9a86a' : 'rgba(236,230,218,0.35)',
                  boxShadow: active
                    ? '0 0 0 5px rgba(236,230,218,0.08), 0 0 18px rgba(236,230,218,0.55)'
                    : '0 0 0 0 rgba(0,0,0,0)',
                }}
                transition={{ duration: 0.6, ease: EASE }}
              />
            </span>
            <span
              className={`eyebrow tabular-nums transition-all duration-500 ${active
                ? 'text-[var(--ivory)]'
                : 'text-[var(--ivory-faint)] group-hover:text-[var(--ivory-dim)] [@media(max-height:760px)]:opacity-0 group-hover:opacity-100'
                }`}
              style={{ letterSpacing: '0.2em' }}
            >
              {pad(i + 1)}
            </span>
          </button>
        );
      })}
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
        <div className="flex items-center gap-5 lg:gap-6">
          <motion.div variants={sealIn} className="shrink-0">
            <Seal stop={stop} />
          </motion.div>
          <motion.span custom={0} variants={fadeUp} className="self-stretch my-3 w-px bg-[var(--hair)]" />
          <motion.div custom={0} variants={fadeUp} className="min-w-0 flex-1">
            <p className="eyebrow text-[var(--gold)]">{stop.district}</p>
            <div className="mt-3 flex items-center gap-4">
              <span className="eyebrow tabular-nums text-[var(--ivory-faint)]" style={{ letterSpacing: '0.2em' }}>
                <span className="text-[var(--ivory)]">{pad(activeIdx + 1)}</span> / {pad(TOTAL)}
              </span>
              <span className="h-px flex-1 bg-[var(--hair)]" />
            </div>
          </motion.div>
        </div>

        <h1 className="font-display mt-6 lg:mt-9 font-light uppercase text-[var(--ivory)] leading-[0.98] tracking-[0.04em] [text-shadow:0_2px_24px_rgba(0,0,0,0.45)] text-[clamp(2rem,8.4vw,3.2rem)] lg:text-[clamp(2.4rem,3.4vw,3.9rem)] [@media(max-height:520px)]:text-[1.8rem]">
          {stop.title.map((line, i) => (
            <span key={line} className="block overflow-hidden pb-[0.06em]">
              <motion.span custom={i} variants={lineReveal} className="block">
                {line}
              </motion.span>
            </span>
          ))}
        </h1>

        <motion.span custom={1} variants={fadeUp} className="block mt-5 lg:mt-7 h-px w-10 bg-[var(--gold-soft)]" />

        <motion.p
          custom={2}
          variants={fadeUp}
          className="mt-5 lg:mt-6 text-[14px] sm:text-[14.5px] leading-[1.75] tracking-[0.015em] text-[rgba(236,230,218,0.82)] [text-shadow:0_1px_14px_rgba(0,0,0,0.6)] max-w-[26rem] [@media(max-height:520px)]:hidden"
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
      className="group ml-auto md:ml-0 flex items-center gap-4 sm:gap-5 min-w-0 cursor-pointer"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={index}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE, delay: 0.5 } }}
          exit={{ opacity: 0, y: -8, transition: { duration: 0.3, ease: 'easeIn' } }}
          className="flex min-w-0 flex-col items-end text-right"
        >
          <span className="eyebrow text-[9.5px] text-[var(--ivory-faint)] tabular-nums">
            {next ? `Next stop · ${pad(index + 2)}` : index === TOTAL - 1 ? 'Departing Capitol' : 'End of the line'}
          </span>
          <span className="mt-2 max-w-full truncate font-display text-[17px] sm:text-[19px] leading-none tracking-[0.02em] text-[var(--ivory)] transition-colors duration-500 group-hover:text-white">
            {next ? (
              <>
                {next.district}
                <span className="hidden sm:inline">
                  <span className="mx-2 text-[var(--ivory-faint)]">—</span>
                  <span className="italic text-[var(--ivory-dim)]">{next.title.join(' ')}</span>
                </span>
              </>
            ) : (
              <>Back to {stops[0].district}</>
            )}
          </span>
        </motion.span>
      </AnimatePresence>
      <span className="grid shrink-0 place-items-center w-10 h-10 sm:w-11 sm:h-11 rounded-full border border-[var(--hair)] text-[var(--ivory-dim)] transition-colors duration-500 group-hover:border-[var(--gold-soft)] group-hover:text-[var(--gold)]">
        <svg
          width="16"
          height="16"
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
  const [plateUrls, setPlateUrls] = useState({});
  const [platesReady, setPlatesReady] = useState(false);

  const isMobile = useIsMobile(768);
  const { progress, active } = useProgress();

  const indexRef = useRef(0);
  const lockUntil = useRef(0);
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
    };
  }, [go]);

  const scrollProgress = index / (VIRTUAL_TOTAL_STEPS - 1);

  return (
    <MotionConfig reducedMotion="user">
      <main className="relative h-[100svh] w-full overflow-clip select-none bg-[var(--ink)]">
        <Backdrop index={index} dir={dir} plateUrls={plateUrls} />

        <div className="absolute inset-0 pointer-events-none">
          <div className="mist mist--low" />
        </div>
        <SteamSweep index={index} dir={dir} enabled={hasMoved} />

        <div className="absolute inset-0 z-30 pointer-events-none">
          <Canvas
            dpr={[1, 1.5]}
            camera={{ position: [0, 0, 5], fov: 45 }}
            gl={{ antialias: true, alpha: true, toneMappingExposure: 0.95, localClippingEnabled: true, powerPreference: "high-performance" }}
          >
            <ambientLight intensity={0.8} color="#e8d8c3" />
            <directionalLight position={[3, 5, 4]} intensity={2.6} color="#ffdf9e" />
            <directionalLight position={[-3, -2, 3]} intensity={1.6} color="#ff9e3b" />
            <pointLight position={[-2, -1, 2]} intensity={1.2} color="#d4af37" />

            <Suspense fallback={null}>
              {isMobile ? (
                <TrainModelVertical
                  scrollProgress={scrollProgress}
                  velocity={hasMoved ? 0.3 : 0}
                  isTransitioning={!ready}
                />
              ) : (
                <TrainModelHorizontal index={Math.min(index, TOTAL - 1)} total={TOTAL} ready={ready} />
              )}
            </Suspense>

            <Environment preset="night" />
          </Canvas>
        </div>

        <div className="absolute inset-0 z-[35] overflow-hidden pointer-events-none">
          <div className="grain" />
        </div>

        <motion.div
          className="absolute inset-0 z-40"
          initial={{ opacity: 0 }}
          animate={{ opacity: ready ? 1 : 0 }}
          transition={{ duration: 1.2, delay: 0.6, ease: 'easeOut' }}
        >
          <header className="absolute top-[var(--pad-y)] inset-x-[var(--pad-x)] flex items-center justify-between">
            <div className="flex items-center gap-3 sm:gap-5">
              <span className="font-display text-[18px] sm:text-[21px] tracking-[0.42em] text-[var(--ivory)]">TIMELINE</span>

              {/*<img
                src="/assets/arrow.png"
                alt="Arrow Divider"
                className="h-5 sm:h-6 w-auto object-contain filter drop-shadow-[0_0_12px_rgba(201,168,106,0.5)] opacity-90"
              />*/}

              <span className="hidden sm:block eyebrow text-[var(--ivory-faint)]">Xtract 5.0</span>
            </div>
          </header>

          <Rail index={index} onSelect={go} />

          <div className="lg:hidden absolute top-[calc(var(--pad-y)+2.25rem)] inset-x-[var(--pad-x)] flex gap-1">
            {stops.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => go(i)}
                aria-label={`${pad(i + 1)} — ${s.district}`}
                className="relative h-3 flex-1 cursor-pointer"
              >
                <span className="absolute inset-x-0 top-1/2 h-px bg-[var(--hair)] overflow-hidden">
                  <motion.span
                    className="absolute inset-0 bg-[var(--ivory)] origin-left"
                    animate={{ scaleX: i <= index ? 1 : 0 }}
                    transition={{ duration: 0.8, ease: EASE }}
                  />
                </span>
              </button>
            ))}
          </div>

          <section className="absolute inset-x-[var(--pad-x)] bottom-[calc(var(--pad-y)+3rem)] max-w-[36rem] lg:max-w-none lg:inset-x-auto lg:bottom-auto lg:right-[var(--pad-x)] lg:top-1/2 lg:-translate-y-1/2 lg:w-[min(30rem,34vw)]">
            <StopCopy index={index} />
          </section>

          <footer className="absolute bottom-[var(--pad-y)] inset-x-[var(--pad-x)] flex items-center gap-6">
            <span className="hidden md:block eyebrow text-[var(--ivory-faint)] whitespace-nowrap">A journey without return</span>
            <span className="hidden md:block h-px flex-1 bg-[var(--hair)]" />
            <NextStop index={index} onGo={go} />
          </footer>
        </motion.div>

        <Preloader progress={platesReady ? progress : Math.min(progress, 96)} visible={!ready} />
      </main>
    </MotionConfig>
  );
}