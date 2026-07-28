import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSettings, saveResult } from '../utils/storage';
import { bevelIn, formatClock,
         CBTPanel, CBTTestShell, ModuleMenu, ModuleResults } from './cbtCommon';
import { useGamepad } from '../hooks/useGamepad';

// RAF Sensory Motor Apparatus:
// Keep a drifting red dot aligned with the crosshairs in the centre of the display.
// Real hardware uses joystick for vertical movement and foot pedals for lateral
// movement. Browser controls map to gamepad axes, arrow keys, or mouse.
const W = 560;
const H = 420;
const CENTER = { x: W / 2, y: H / 2 };
const GOOD_RADIUS = 18;

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

const SensoryMotor = () => {
  const navigate = useNavigate();
  const [stage, setStage] = useState('menu');
  const [mode, setMode] = useState(null);
  const [difficulty, setDifficulty] = useState(null);
  const [config, setConfig] = useState(null);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [clockDisplay, setClockDisplay] = useState('00:00:00');
  const [dot, setDot] = useState(CENTER);
  const [scoreTicks, setScoreTicks] = useState({ aligned: 0, total: 0, sumError: 0 });
  const [inputMode, setInputMode] = useState('KEYBOARD');
  const timerRef = useRef(null);
  const rafRef = useRef(null);
  const containerRef = useRef(null);
  const keysRef = useRef({ left: false, right: false, up: false, down: false });
  const stateRef = useRef({
    dot: { ...CENTER },
    velocity: { x: 36, y: -24 },
    driftPhase: 0,
    aligned: 0,
    total: 0,
    sumError: 0
  });
  const configRef = useRef(null);
  const { connected, stateRef: gpRef } = useGamepad();

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (stage !== 'test') return;
      if (e.key === 'ArrowLeft') keysRef.current.left = true;
      if (e.key === 'ArrowRight') keysRef.current.right = true;
      if (e.key === 'ArrowUp') keysRef.current.up = true;
      if (e.key === 'ArrowDown') keysRef.current.down = true;
    };
    const onKeyUp = (e) => {
      if (e.key === 'ArrowLeft') keysRef.current.left = false;
      if (e.key === 'ArrowRight') keysRef.current.right = false;
      if (e.key === 'ArrowUp') keysRef.current.up = false;
      if (e.key === 'ArrowDown') keysRef.current.down = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [stage]);

  const startTest = (m, d) => {
    const cfg = getSettings().sensoryMotor[d];
    setMode(m); setDifficulty(d); setConfig(cfg); configRef.current = cfg;
    setTimeElapsed(0);
    setScoreTicks({ aligned: 0, total: 0, sumError: 0 });
    setDot(CENTER);
    stateRef.current = {
      dot: { ...CENTER },
      velocity: { x: 34 + cfg.targetSpeed * 0.18, y: -26 - cfg.targetSpeed * 0.12 },
      driftPhase: 0,
      aligned: 0,
      total: 0,
      sumError: 0
    };
    setStage('test');

    timerRef.current = setInterval(() => {
      setTimeElapsed(t => {
        const nt = t + 1;
        setClockDisplay(formatClock(new Date()));
        if (nt >= cfg.testDuration) { endTest(); return cfg.testDuration; }
        return nt;
      });
    }, 1000);

    let lastT = performance.now();
    const loop = (t) => {
      const dt = Math.min(0.05, (t - lastT) / 1000);
      lastT = t;
      const st = stateRef.current;
      const c = configRef.current;
      st.driftPhase += dt;

      // Autonomous drift: the dot wanders continuously away from centre.
      st.velocity.x += Math.sin(st.driftPhase * 1.7) * c.targetSpeed * dt * 0.55;
      st.velocity.y += Math.cos(st.driftPhase * 1.3) * c.targetSpeed * dt * 0.55;

      let ix = 0;
      let iy = 0;
      if (gpRef.current && gpRef.current.axes) {
        const pedalInput = gpRef.current.pedals || 0;
        ix += Math.abs(pedalInput) > 0.02 ? pedalInput : (gpRef.current.axes[0] || 0);
        iy += gpRef.current.axes[1] || 0;
        if (Math.abs(ix) > 0.05 || Math.abs(iy) > 0.05) {
          setInputMode(Math.abs(pedalInput) > 0.05 ? 'PEDALS/RUDDER' : 'GAMEPAD');
        }
      }
      if (keysRef.current.left) { ix -= 1; setInputMode('KEYBOARD'); }
      if (keysRef.current.right) { ix += 1; setInputMode('KEYBOARD'); }
      if (keysRef.current.up) { iy -= 1; setInputMode('KEYBOARD'); }
      if (keysRef.current.down) { iy += 1; setInputMode('KEYBOARD'); }

      const controlPower = c.targetSpeed * 2.2;
      st.dot.x += (st.velocity.x + ix * controlPower) * dt;
      st.dot.y += (st.velocity.y + iy * controlPower) * dt;

      // Bounces simulate the dot straying but staying within the instrument.
      if (st.dot.x < 10 || st.dot.x > W - 10) st.velocity.x *= -0.85;
      if (st.dot.y < 10 || st.dot.y > H - 10) st.velocity.y *= -0.85;
      st.dot.x = clamp(st.dot.x, 10, W - 10);
      st.dot.y = clamp(st.dot.y, 10, H - 10);

      const err = Math.hypot(st.dot.x - CENTER.x, st.dot.y - CENTER.y);
      st.total += 1;
      st.sumError += err;
      if (err <= GOOD_RADIUS) st.aligned += 1;

      setDot({ ...st.dot });
      setScoreTicks({ aligned: st.aligned, total: st.total, sumError: st.sumError });
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  };

  const handleMouseMove = (e) => {
    if (!containerRef.current || stage !== 'test') return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    const y = ((e.clientY - rect.top) / rect.height) * H;
    const st = stateRef.current;
    const dx = x - st.dot.x;
    const dy = y - st.dot.y;
    st.dot.x = clamp(st.dot.x + dx * 0.08, 10, W - 10);
    st.dot.y = clamp(st.dot.y + dy * 0.08, 10, H - 10);
    setInputMode('MOUSE');
  };

  const endTest = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setStage('results');
  };

  useEffect(() => {
    if (stage === 'results' && mode === 'assessment') {
      const alignAcc = scoreTicks.total ? (scoreTicks.aligned / scoreTicks.total) * 100 : 0;
      const avgError = scoreTicks.total ? scoreTicks.sumError / scoreTicks.total : 0;
      saveResult('Sensory Motor Apparatus', mode, difficulty, {
        accuracy: alignAcc,
        averageError: avgError,
        alignedTicks: scoreTicks.aligned,
        totalTicks: scoreTicks.total
      });
    }
  }, [stage]); // eslint-disable-line

  if (stage === 'menu') return (
    <ModuleMenu title="Sensory Motor Apparatus Test - Setup"
      description="Keep the red dot aligned with the centre crosshairs. Use joystick/gamepad axes, arrow keys, or mouse. The dot will drift by itself and you must correct it continuously."
      mode={mode} setMode={setMode} difficulty={difficulty} setDifficulty={setDifficulty}
      onCancel={() => navigate('/')} onStart={() => startTest(mode, difficulty)} />
  );

  if (stage === 'results') {
    const alignAcc = scoreTicks.total ? (scoreTicks.aligned / scoreTicks.total) * 100 : 0;
    const avgError = scoreTicks.total ? scoreTicks.sumError / scoreTicks.total : 0;
    return <ModuleResults title="Sensory Motor Apparatus - Results"
      rows={[
        ['Aligned Time', `${alignAcc.toFixed(1)}%`],
        ['Average Error', `${avgError.toFixed(1)} px`],
        ['Input Samples', String(scoreTicks.total)]
      ]}
      overallScore={alignAcc}
      summary={[
        { prompt: 'Red dot aligned with centre crosshairs', given: `${scoreTicks.aligned} aligned samples`, answer: `${scoreTicks.total} total samples`, correct: alignAcc >= 50 },
        { prompt: 'Red dot outside alignment tolerance', given: `${Math.max(0, scoreTicks.total - scoreTicks.aligned)} missed samples`, answer: '0 missed samples is ideal', correct: scoreTicks.total === scoreTicks.aligned }
      ]}
      onRetry={() => setStage('menu')} onDashboard={() => navigate('/')} />;
  }

  const remaining = Math.max(0, config.testDuration - timeElapsed);
  const err = Math.hypot(dot.x - CENTER.x, dot.y - CENTER.y);
  const alignAcc = scoreTicks.total ? (scoreTicks.aligned / scoreTicks.total) * 100 : 0;

  return (
    <CBTTestShell title="Sensory Motor Apparatus - Testing" warnings={[]} clockDisplay={clockDisplay}
      mode={mode} difficulty={difficulty} elapsed={timeElapsed} remaining={remaining}>
      <div className="grid grid-cols-4 gap-2">
        <div className="col-span-3">
          <CBTPanel title="Alignment Display">
            <div
              ref={containerRef}
              onMouseMove={handleMouseMove}
              className="relative bg-black overflow-hidden cursor-none"
              style={{ width: '100%', height: `${H}px`, ...bevelIn }}
              data-testid="sm-area"
            >
              <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 w-full h-full">
                <line x1={CENTER.x - 70} y1={CENTER.y} x2={CENTER.x + 70} y2={CENTER.y} stroke="#AA0000" strokeWidth="1.5" />
                <line x1={CENTER.x} y1={CENTER.y - 70} x2={CENTER.x} y2={CENTER.y + 70} stroke="#AA0000" strokeWidth="1.5" />
                <line x1={CENTER.x - 16} y1={CENTER.y} x2={CENTER.x + 16} y2={CENTER.y} stroke="#FF3333" strokeWidth="2.5" />
                <line x1={CENTER.x} y1={CENTER.y - 16} x2={CENTER.x} y2={CENTER.y + 16} stroke="#FF3333" strokeWidth="2.5" />
                <circle cx={CENTER.x} cy={CENTER.y} r={GOOD_RADIUS} fill="none" stroke="#550000" strokeWidth="1" strokeDasharray="3 3" />
                <circle cx={dot.x} cy={dot.y} r="7" fill="#FF0000" stroke="#FFAAAA" strokeWidth="1" data-testid="sm-red-dot" />
              </svg>
            </div>
          </CBTPanel>
        </div>
        <div>
          <CBTPanel title="Status">
            <div className="text-white text-xs space-y-1 font-mono">
              <div className="flex justify-between"><span className="text-[#AACCFF]">Input</span><span>{connected ? inputMode : inputMode}</span></div>
              <div className="flex justify-between"><span className="text-[#AACCFF]">Error</span><span data-testid="sm-error">{err.toFixed(0)} px</span></div>
              <div className="flex justify-between"><span className="text-[#AACCFF]">Aligned</span><span data-testid="sm-aligned">{alignAcc.toFixed(0)}%</span></div>
              <div className="flex justify-between"><span className="text-[#AACCFF]">Control</span><span>{connected ? 'GAMEPAD OK' : 'KEYS/MOUSE'}</span></div>
            </div>
            <div className="mt-3 bg-black border border-[#4444AA] p-2 text-[10px] text-[#AACCFF]">
              Joystick/pull up moves vertically. Pedal movement is mapped to left/right. Keep the red dot on the crosshair.
            </div>
          </CBTPanel>
        </div>
      </div>
    </CBTTestShell>
  );
};

export default SensoryMotor;
