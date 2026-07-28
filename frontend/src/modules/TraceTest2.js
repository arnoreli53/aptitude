import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSettings, saveResult } from '../utils/storage';
import { bevelIn, bevelOut, randInt, pick, shuffle,
         ModuleMenu, ModuleResults, AnswerChoices, CBTReasonShell } from './cbtCommon';

// Trace Test 2 - watch aircraft trajectories, then answer recall questions.
const COLORS = [
  { name: 'Red',    hex: '#FF3333' },
  { name: 'Blue',   hex: '#4488FF' },
  { name: 'Silver', hex: '#CCCCCC' },
  { name: 'Yellow', hex: '#FFCC00' },
  { name: 'Green',  hex: '#00FF00' }
];

// Each aircraft has a start point + a maneuver (straight | left | right | climb | dive)
const generateScenario = (n, duration) => {
  const chosen = shuffle(COLORS).slice(0, n);
  return chosen.map((c, i) => ({
    color: c,
    startX: randInt(20, 280),
    startY: randInt(40, 200),
    dirDeg: randInt(-30, 30),
    speed: randInt(10, 30),
    maneuver: pick(['straight', 'left', 'right'])
  }));
};

// Question generators
const questionAbout = (aircraft) => {
  const t = pick(['no_change', 'which_left', 'which_right']);
  if (t === 'no_change') {
    const straightList = aircraft.filter(a => a.maneuver === 'straight');
    if (straightList.length === 0) return questionAbout(aircraft); // retry
    const target = pick(straightList);
    const options = shuffle(COLORS.map(c => c.name)).slice(0, 4);
    if (!options.includes(target.color.name)) options[0] = target.color.name;
    return { text: 'Which aircraft did NOT change direction?', answer: target.color.name, options: shuffle(options) };
  }
  if (t === 'which_left') {
    const leftList = aircraft.filter(a => a.maneuver === 'left');
    if (leftList.length === 0) return questionAbout(aircraft);
    const target = pick(leftList);
    const options = shuffle(COLORS.map(c => c.name)).slice(0, 4);
    if (!options.includes(target.color.name)) options[0] = target.color.name;
    return { text: 'Which aircraft turned LEFT?', answer: target.color.name, options: shuffle(options) };
  }
  const rightList = aircraft.filter(a => a.maneuver === 'right');
  if (rightList.length === 0) return questionAbout(aircraft);
  const target = pick(rightList);
  const options = shuffle(COLORS.map(c => c.name)).slice(0, 4);
  if (!options.includes(target.color.name)) options[0] = target.color.name;
  return { text: 'Which aircraft turned RIGHT?', answer: target.color.name, options: shuffle(options) };
};

const TraceTest2 = () => {
  const navigate = useNavigate();
  const [stage, setStage] = useState('menu');
  const [mode, setMode] = useState(null);
  const [difficulty, setDifficulty] = useState(null);
  const [cfg, setCfg] = useState(null);
  const [aircraft, setAircraft] = useState([]);
  const [phase, setPhase] = useState('animate'); // animate | question
  const [t, setT] = useState(0);
  const [q, setQ] = useState(null);
  const [idx, setIdx] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [animRemaining, setAnimRemaining] = useState(0);
  const [responses, setResponses] = useState([]);
  const timerRef = useRef(null);
  const animRef = useRef(null);

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (animRef.current) clearInterval(animRef.current);
  }, []);

  const start = () => {
    const c = getSettings().traceTest2[difficulty];
    setCfg(c); setRemaining(c.testDuration);
    setIdx(0); setCorrect(0); setResponses([]);
    beginScenario(c);
    setStage('test');
    timerRef.current = setInterval(() => setRemaining(r => (r <= 1 ? (end(), 0) : r - 1)), 1000);
  };

  const beginScenario = (c) => {
    const scenario = generateScenario(c.aircraftCount, c.animationDuration);
    setAircraft(scenario);
    setPhase('animate');
    setT(0);
    setAnimRemaining(c.animationDuration);
    if (animRef.current) clearInterval(animRef.current);
    animRef.current = setInterval(() => {
      setT(tt => tt + 0.1);
      setAnimRemaining(r => {
        if (r <= 0.1) {
          clearInterval(animRef.current);
          setPhase('question');
          setQ(questionAbout(scenario));
          return 0;
        }
        return r - 0.1;
      });
    }, 100);
  };

  const end = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (animRef.current) clearInterval(animRef.current);
    setStage('results');
  };

  const answer = (opt) => {
    const isRight = opt === q.answer;
    setResponses(prev => [...prev, {
      prompt: q.text,
      detail: aircraft.map(a => `${a.color.name}: ${a.maneuver}`).join(', '),
      given: opt,
      answer: q.answer,
      correct: isRight
    }]);
    const newCorrect = isRight ? correct + 1 : correct;
    const newIdx = idx + 1;
    setCorrect(newCorrect);
    if (newIdx >= cfg.questionCount) { setIdx(newIdx); end(); return; }
    setIdx(newIdx); beginScenario(cfg);
  };

  useEffect(() => {
    if (stage === 'results' && mode === 'assessment' && idx > 0) {
      const acc = (correct / idx) * 100;
      saveResult('Trace Test 2', mode, difficulty, { accuracy: acc, correct, total: idx });
    }
  }, [stage]); // eslint-disable-line

  if (stage === 'menu') return (
    <ModuleMenu title="Trace Test 2 - Setup"
      description="Watch aircraft in flight. Remember their trajectories. Then answer a question about which changed direction. Do not blink!"
      mode={mode} setMode={setMode} difficulty={difficulty} setDifficulty={setDifficulty}
      onCancel={() => navigate('/')} onStart={start} />
  );

  if (stage === 'results') {
    const acc = idx ? (correct / idx) * 100 : 0;
    return <ModuleResults title="Trace Test 2 - Results"
      rows={[['Correct', `${correct} / ${idx}`], ['Accuracy', `${acc.toFixed(1)}%`]]}
      overallScore={acc} summary={responses} onRetry={() => setStage('menu')} onDashboard={() => navigate('/')} />;
  }

  const halfway = (cfg?.animationDuration || 6) / 2;

  return (
    <CBTReasonShell title="Trace Test 2 - Testing" testTag="TT2"
      practice={mode === 'practice'} remaining={remaining}
      questionNum={idx + 1} questionCount={cfg.questionCount}>
      {phase === 'animate' && (
        <div className="bg-[#001030] p-3" style={bevelIn}>
          <div className="text-[#FFCC00] text-[10px] mb-2 font-bold">WATCH THE AIRCRAFT ({animRemaining.toFixed(1)}s)</div>
          <svg viewBox="0 0 320 240" width="100%" height="320" className="bg-[#001030]">
            {/* Horizon */}
            <line x1="0" y1="180" x2="320" y2="180" stroke="#4488FF" strokeWidth="0.5" opacity="0.5" />
            {aircraft.map((a, i) => {
              const applied = t > halfway ? t - halfway : 0;
              const turnDeg = a.maneuver === 'left' ? -30 : a.maneuver === 'right' ? 30 : 0;
              const currDir = a.dirDeg + (turnDeg * (applied / halfway));
              const rad = currDir * Math.PI / 180;
              // Two-phase movement: straight phase and turn phase
              let cx, cy;
              if (t <= halfway) {
                const r0 = a.dirDeg * Math.PI / 180;
                cx = a.startX + Math.cos(r0) * a.speed * t;
                cy = a.startY + Math.sin(r0) * a.speed * t;
              } else {
                const r0 = a.dirDeg * Math.PI / 180;
                const midX = a.startX + Math.cos(r0) * a.speed * halfway;
                const midY = a.startY + Math.sin(r0) * a.speed * halfway;
                cx = midX + Math.cos(rad) * a.speed * applied;
                cy = midY + Math.sin(rad) * a.speed * applied;
              }
              return (
                <g key={i}>
                  {/* Trail */}
                  <line x1={a.startX} y1={a.startY} x2={cx} y2={cy}
                    stroke={a.color.hex} strokeWidth="1" strokeDasharray="2 2" opacity="0.5" />
                  {/* Aircraft */}
                  <g transform={`translate(${cx}, ${cy}) rotate(${currDir})`}>
                    <polygon points="-6,4 6,0 -6,-4" fill={a.color.hex} stroke="white" strokeWidth="0.5" />
                  </g>
                  <text x={cx + 8} y={cy - 6} fill={a.color.hex} fontSize="9" fontWeight="bold">{a.color.name}</text>
                </g>
              );
            })}
          </svg>
        </div>
      )}
      {phase === 'question' && q && (
        <div className="bg-[#C0C0C0] p-4" style={bevelIn}>
          <div className="text-black text-sm font-bold mb-3">{q.text}</div>
          <AnswerChoices options={q.options} onPick={answer} />
        </div>
      )}
    </CBTReasonShell>
  );
};

export default TraceTest2;
