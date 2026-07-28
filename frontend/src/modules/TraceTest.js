import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSettings, saveResult } from '../utils/storage';
import { formatClock, pick, ModuleMenu, ModuleResults, formatTime } from './cbtCommon';

// RAF CBAT Trace Test 1 - Mimic pilot's controls.
// KEY RULE: If aircraft is FACING YOU and turns YOUR RIGHT, that's the PILOT'S LEFT,
// so you press LEFT arrow (mirrored).
// In later stages, 3 aircraft (red/blue/yellow) present, colors swap randomly,
// candidate must always control the currently-RED aircraft.

const MANEUVERS = [
  // Each maneuver defines the aircraft orientation and the required INPUT
  // Input is what the candidate must press. It's the PILOT's input (mirrored if aircraft faces candidate).
  { name: 'Rolling right (facing away)',   facing: 'away',    turn: 'right', input: 'RIGHT' },
  { name: 'Rolling left (facing away)',    facing: 'away',    turn: 'left',  input: 'LEFT' },
  { name: 'Rolling right (facing you)',    facing: 'toward',  turn: 'right', input: 'LEFT'  }, // mirrored
  { name: 'Rolling left (facing you)',     facing: 'toward',  turn: 'left',  input: 'RIGHT' }, // mirrored
  { name: 'Climbing (facing away)',        facing: 'away',    turn: 'up',    input: 'UP' },
  { name: 'Diving (facing away)',          facing: 'away',    turn: 'down',  input: 'DOWN' },
  { name: 'Climbing (facing you)',         facing: 'toward',  turn: 'up',    input: 'DOWN' }, // mirrored
  { name: 'Diving (facing you)',           facing: 'toward',  turn: 'down',  input: 'UP' }    // mirrored
];
const TRACE_ASSET_BASE = '/assets/trace-test/';

const generate = (multipleAircraft) => {
  const m = pick(MANEUVERS);
  if (!multipleAircraft) return { ...m, colors: { red: 0, blue: null, yellow: null } };
  // Multi-aircraft: 3 aircraft, only ONE is red (the one to control)
  const positions = [0, 1, 2];
  const red = pick(positions);
  const remaining = positions.filter(p => p !== red);
  return { ...m, colors: { red, blue: remaining[0], yellow: remaining[1] } };
};

const ControlLegend = () => (
  <div className="absolute left-[600px] top-[224px] w-[72px] h-[106px] border border-white bg-black text-white text-xs font-bold p-2">
    {[
      ['←', 'Left'],
      ['→', 'Right'],
      ['↑', 'Push'],
      ['↓', 'Pull']
    ].map(([icon, label]) => (
      <div key={label} className="flex items-center gap-2 h-[22px]">
        <span className="w-[18px] h-[18px] bg-[#D8D8D8] text-black border border-white flex items-center justify-center text-sm leading-none">{icon}</span>
        <span>{label}</span>
      </div>
    ))}
  </div>
);

const TraceAircraft = ({ color, scene, x, y, scale = 1, delay = 0 }) => {
  const roll = scene.turn === 'right' ? 28 : scene.turn === 'left' ? -28 : 0;
  const pitch = scene.turn === 'up' ? -18 : scene.turn === 'down' ? 18 : 0;
  const away = scene.facing === 'away';
  const rotation = roll + (away ? 0 : 180);
  const fill = color;
  return (
    <g transform={`translate(${x} ${y + pitch + delay}) rotate(${rotation}) scale(${scale})`} opacity={color === '#CC0000' ? 1 : 0.85}>
      <path d="M0 -76 C-12 -34 -12 36 0 82 C12 36 12 -34 0 -76 Z" fill={fill} stroke="#111" strokeWidth="2" />
      <path d="M-92 2 L-14 -16 L14 -16 L92 2 L16 18 L-16 18 Z" fill={fill} stroke="#111" strokeWidth="2" />
      <path d="M-37 60 L0 36 L37 60 L16 74 L-16 74 Z" fill={fill} stroke="#111" strokeWidth="2" />
      <ellipse cx="0" cy="-31" rx="13" ry="22" fill="#385CA8" stroke="#D6E4FF" strokeWidth="1.5" />
      <circle cx="0" cy="0" r="4" fill="#333" />
    </g>
  );
};

const TraceVideo = ({ scene, multiAircraft, feedback }) => {
  const aircraft = multiAircraft
    ? [
        { pos: 0, x: 112, y: 206 },
        { pos: 1, x: 190, y: 205 },
        { pos: 2, x: 265, y: 206 }
      ]
    : [{ pos: 0, x: 170, y: 205 }];
  const colorAt = (pos) => {
    if (!multiAircraft) return '#CC0000';
    if (scene.colors.red === pos) return '#CC0000';
    if (scene.colors.blue === pos) return '#153BCE';
    return '#D6BE12';
  };
  return (
    <div className="absolute left-[226px] top-[147px] w-[337px] h-[338px] border border-white overflow-hidden bg-black" data-testid="tt1-scene">
      <img
        src={`${TRACE_ASSET_BASE}sky-reference.jpg`}
        alt=""
        draggable={false}
        className="absolute inset-0 w-full h-full object-cover opacity-75"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#453554]/45" />
      <svg viewBox="0 0 337 338" className="absolute inset-0 w-full h-full">
        {aircraft.map((plane, i) => (
          <TraceAircraft
            key={plane.pos}
            color={colorAt(plane.pos)}
            scene={scene}
            x={plane.x}
            y={plane.y}
            scale={multiAircraft ? 0.72 : 0.95}
            delay={i * -12}
          />
        ))}
      </svg>
      {feedback && (
        <div className={`absolute inset-0 flex items-center justify-center ${feedback === 'right' ? 'bg-[#00FF00]' : 'bg-[#FF0000]'} bg-opacity-20`}>
          <span className={`text-3xl font-bold ${feedback === 'right' ? 'text-[#00FF00]' : 'text-[#FF6666]'}`}>
            {feedback === 'right' ? 'CORRECT' : 'WRONG'}
          </span>
        </div>
      )}
    </div>
  );
};

const TraceTest = () => {
  const navigate = useNavigate();
  const [stage, setStage] = useState('menu');
  const [mode, setMode] = useState(null);
  const [difficulty, setDifficulty] = useState(null);
  const [cfg, setCfg] = useState(null);
  const [scene, setScene] = useState(null);
  const [idx, setIdx] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [responses, setResponses] = useState([]);
  const [feedback, setFeedback] = useState(null); // 'right' | 'wrong' | null
  const [elapsed, setElapsed] = useState(0);
  const [clockDisplay, setClockDisplay] = useState('00:00:00');
  const timerRef = useRef(null);

  useEffect(() => () => timerRef.current && clearInterval(timerRef.current), []);

  const start = () => {
    const c = getSettings().traceTest[difficulty];
    setCfg(c); setElapsed(0);
    setIdx(0); setCorrect(0); setResponses([]);
    setScene(generate(difficulty !== 'easy'));
    setStage('test');
    timerRef.current = setInterval(() => setElapsed(e => {
      setClockDisplay(formatClock(new Date()));
      if (e + 1 >= c.testDuration) { end(); return c.testDuration; }
      return e + 1;
    }), 1000);
  };

  const end = () => { if (timerRef.current) clearInterval(timerRef.current); setStage('results'); };

  const answer = (input) => {
    const isRight = input === scene.input;
    setResponses(prev => [...prev, {
      prompt: scene.name,
      detail: `Aircraft facing ${scene.facing}; motion ${scene.turn}`,
      given: input,
      answer: scene.input,
      correct: isRight
    }]);
    const newCorrect = isRight ? correct + 1 : correct;
    setCorrect(newCorrect);
    setFeedback(isRight ? 'right' : 'wrong');
    setTimeout(() => {
      setFeedback(null);
      const newIdx = idx + 1;
      if (newIdx >= cfg.questionCount) { setIdx(newIdx); end(); return; }
      setIdx(newIdx);
      setScene(generate(difficulty !== 'easy'));
    }, 500);
  };

  // Arrow key support
  useEffect(() => {
    if (stage !== 'test' || !scene || feedback) return;
    const kd = (e) => {
      if (e.key === 'ArrowLeft')  answer('LEFT');
      if (e.key === 'ArrowRight') answer('RIGHT');
      if (e.key === 'ArrowUp')    answer('UP');
      if (e.key === 'ArrowDown')  answer('DOWN');
    };
    window.addEventListener('keydown', kd);
    return () => window.removeEventListener('keydown', kd);
  }, [stage, scene, feedback]); // eslint-disable-line

  useEffect(() => {
    if (stage === 'results' && mode === 'assessment' && idx > 0) {
      const acc = (correct / idx) * 100;
      saveResult('Trace Test 1', mode, difficulty, { accuracy: acc, correct, total: idx });
    }
  }, [stage]); // eslint-disable-line

  if (stage === 'menu') return (
    <ModuleMenu title="Trace Test 1 - Setup"
      description="Watch the RED aircraft's motion and mimic the PILOT's controls (not yours!) using ARROW KEYS or buttons. If aircraft faces YOU and turns your right, the pilot's control is LEFT — press LEFT. In harder rounds, 3 aircraft appear and colors swap: always control the currently-RED one."
      mode={mode} setMode={setMode} difficulty={difficulty} setDifficulty={setDifficulty}
      onCancel={() => navigate('/')} onStart={start} />
  );

  if (stage === 'results') {
    const acc = idx ? (correct / idx) * 100 : 0;
    return <ModuleResults title="Trace Test 1 - Results"
      rows={[['Correct', `${correct} / ${idx}`], ['Accuracy', `${acc.toFixed(1)}%`]]}
      overallScore={acc} summary={responses} onRetry={() => setStage('menu')} onDashboard={() => navigate('/')} />;
  }

  const remaining = Math.max(0, cfg.testDuration - elapsed);

  const multiAircraft = difficulty !== 'easy';

  return (
    <div className="h-screen overflow-hidden bg-black flex items-center justify-center" style={{ fontFamily: "'Arial', 'Helvetica', sans-serif" }}>
      <div
        className="relative bg-[#000080] border border-white overflow-hidden text-white"
        style={{
          width: 790,
          height: 630,
          transform: 'scale(min(calc((100vw - 8px) / 790), calc((100vh - 8px) / 630)))',
          transformOrigin: 'center'
        }}
      >
        <img
          src={`${TRACE_ASSET_BASE}trac11-reference.jpg`}
          alt=""
          draggable={false}
          className="absolute inset-0 w-full h-full opacity-20 select-none pointer-events-none"
        />
        <div className="absolute left-0 top-0 w-full h-[28px] border-b border-white flex items-center justify-center text-sm">
          Trace Test 1 - Testing
        </div>
        <TraceVideo scene={scene} multiAircraft={multiAircraft} feedback={feedback} />
        <ControlLegend />
        <div className="absolute left-0 right-0 bottom-[28px] h-px bg-white" />
        <div className="absolute left-0 right-0 bottom-0 h-[28px] bg-black text-[#CCCCCC] text-[11px] flex items-center justify-between px-3">
          <span>{multiAircraft ? 'Track the aircraft currently coloured red' : 'Mimic the red aircraft pilot controls'}</span>
          <span className="font-mono">Q {idx + 1}/{cfg.questionCount} | {formatTime(remaining)}</span>
        </div>
      </div>
    </div>
  );
};

export default TraceTest;
