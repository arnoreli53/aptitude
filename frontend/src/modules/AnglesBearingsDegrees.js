import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSettings, saveResult } from '../utils/storage';
import { ModuleMenu, ModuleResults, formatTime, pad3, pick, randInt, shuffle } from './cbtCommon';

const BLUE = '#000080';
const WHITE = '#F5F5F5';
const BLACK = '#000000';

const normalizeDeg = (deg) => ((Math.round(deg) % 360) + 360) % 360;
const degToPoint = (cx, cy, r, bearing) => ({
  x: cx + Math.sin((bearing * Math.PI) / 180) * r,
  y: cy - Math.cos((bearing * Math.PI) / 180) * r
});
const fmtDeg = (n) => `${pad3(normalizeDeg(n) || 360)}°`;
const fmtAngle = (n) => `${pad3(Math.round(n))}°`;

const optionSteps = (progress) => {
  if (progress < 0.35) return [30, -25, 15, -40];
  if (progress < 0.7) return [20, -15, 10, -25];
  return [10, -5, 5, -15];
};

const makeOptions = (answer, progress, formatter, clampAngle = false) => {
  const opts = new Set([formatter(answer)]);
  for (const step of optionSteps(progress)) {
    let value = answer + step;
    if (clampAngle) value = Math.max(5, Math.min(175, value));
    opts.add(formatter(value));
  }
  let guard = 0;
  while (opts.size < 5 && guard < 50) {
    guard++;
    const jitter = randInt(5, progress < 0.7 ? 35 : 18) * (Math.random() < 0.5 ? -1 : 1);
    let value = answer + jitter;
    if (clampAngle) value = Math.max(5, Math.min(175, value));
    opts.add(formatter(value));
  }
  return shuffle([...opts]).slice(0, 5);
};

const genAngleQ = (progress) => {
  const angle = randInt(10, 170);
  const base = progress < 0.25 ? 0 : randInt(0, 350);
  const options = makeOptions(angle, progress, fmtAngle, true);
  return {
    type: 'Angles',
    angle,
    base,
    options,
    answer: fmtAngle(angle),
    prompt: ''
  };
};

const genBearingQ = (progress) => {
  const target = pick(['A', 'B', 'C']);
  const targetBearing = Math.round(randInt(0, 71) * 5);
  const bearings = { [target]: targetBearing };
  ['A', 'B', 'C'].forEach((label) => {
    if (label !== target) {
      let next = normalizeDeg(targetBearing + pick([85, 135, 190, 245]) + randInt(-15, 15));
      if (next === 0) next = 360;
      bearings[label] = next;
    }
  });
  const options = makeOptions(targetBearing || 360, progress, fmtDeg, false);
  return {
    type: 'Bearings',
    target,
    bearings,
    options,
    answer: fmtDeg(targetBearing || 360),
    prompt: `Bearing of ${target}`
  };
};

const ChoiceColumn = ({ question, onAnswer }) => (
  <div className="flex flex-col gap-5 text-white text-[22px]" data-testid="abd-options">
    {question.prompt && <div className="mb-10 text-center text-[22px]" data-testid="abd-prompt">{question.prompt}</div>}
    {question.options.map((option, i) => (
      <button
        key={option}
        data-testid={`abd-choice-${i}`}
        onClick={() => onAnswer(option)}
        className="flex items-center gap-5 text-left"
      >
        <span className="w-8 h-8 bg-[#B8B8B8] text-black border-2 border-[#EEEEEE] shadow-inner flex items-center justify-center font-bold">
          {i + 1}
        </span>
        <span className="font-mono">{option}</span>
      </button>
    ))}
  </div>
);

const AngleDisplay = ({ question }) => {
  const cx = 330;
  const cy = 315;
  const r = 190;
  const p1 = degToPoint(cx, cy, r, question.base);
  const p2 = degToPoint(cx, cy, r, question.base + question.angle);
  const arcStart = degToPoint(cx, cy, 48, question.base);
  const arcEnd = degToPoint(cx, cy, 48, question.base + question.angle);
  const largeArc = question.angle > 180 ? 1 : 0;

  return (
    <svg viewBox="0 0 660 600" className="w-full h-full">
      <rect width="660" height="600" fill={BLACK} />
      <line x1={cx} y1={cy} x2={p1.x} y2={p1.y} stroke={WHITE} strokeWidth="2" />
      <line x1={cx} y1={cy} x2={p2.x} y2={p2.y} stroke={WHITE} strokeWidth="2" />
      <path
        d={`M ${arcStart.x} ${arcStart.y} A 48 48 0 ${largeArc} 1 ${arcEnd.x} ${arcEnd.y}`}
        fill="none"
        stroke={WHITE}
        strokeWidth="1.5"
      />
    </svg>
  );
};

const BearingDisplay = ({ question }) => {
  const cx = 330;
  const cy = 300;
  const r = 275;
  const ticks = Array.from({ length: 36 }, (_, i) => i * 10);

  return (
    <svg viewBox="0 0 660 600" className="w-full h-full">
      <rect width="660" height="600" fill={BLACK} />
      <circle cx={cx} cy={cy} r={r} fill={BLACK} stroke={WHITE} strokeWidth="1" />
      {ticks.map((deg) => {
        const outer = degToPoint(cx, cy, r + 1, deg);
        const inner = degToPoint(cx, cy, deg % 30 === 0 ? r - 22 : r - 12, deg);
        return <line key={deg} x1={outer.x} y1={outer.y} x2={inner.x} y2={inner.y} stroke={WHITE} strokeWidth="1" />;
      })}
      <text x={cx - 40} y={cy - r - 20} fill={WHITE} fontSize="24">360</text>
      <text x={cx + r + 28} y={cy + 5} fill={WHITE} fontSize="24">090</text>
      <text x={cx - 10} y={cy + r + 28} fill={WHITE} fontSize="24">180</text>
      <text x={cx - r - 60} y={cy + 5} fill={WHITE} fontSize="24">270</text>
      <line x1={cx - 24} y1={cy} x2={cx + 24} y2={cy} stroke={WHITE} strokeWidth="1" />
      <line x1={cx} y1={cy - 24} x2={cx} y2={cy + 24} stroke={WHITE} strokeWidth="1" />
      {['A', 'B', 'C'].map((label) => {
        const p = degToPoint(cx, cy, r * 0.7, question.bearings[label]);
        return (
          <g key={label}>
            <circle cx={p.x} cy={p.y} r="4" fill={WHITE} />
            <text x={p.x + 15} y={p.y + 7} fill={WHITE} fontSize="23">{label}</text>
          </g>
        );
      })}
    </svg>
  );
};

const AnglesBearingsDegrees = () => {
  const navigate = useNavigate();
  const [stage, setStage] = useState('menu');
  const [mode, setMode] = useState(null);
  const [difficulty, setDifficulty] = useState(null);
  const [cfg, setCfg] = useState(null);
  const [question, setQuestion] = useState(null);
  const [idx, setIdx] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [responses, setResponses] = useState([]);
  const timerRef = useRef(null);

  useEffect(() => () => timerRef.current && clearInterval(timerRef.current), []);

  const makeQuestion = (nextIdx, nextCfg = cfg) => {
    const total = nextCfg?.questionCount || 10;
    const progress = total <= 1 ? 0 : nextIdx / (total - 1);
    return nextIdx < total / 2 ? genAngleQ(progress) : genBearingQ(progress);
  };

  const start = () => {
    const nextCfg = getSettings().anglesBearingsDegrees[difficulty];
    setCfg(nextCfg);
    setRemaining(nextCfg.testDuration);
    setIdx(0);
    setCorrect(0);
    setResponses([]);
    setQuestion(makeQuestion(0, nextCfg));
    setStage('test');
    timerRef.current = setInterval(() => setRemaining((r) => (r <= 1 ? (end(), 0) : r - 1)), 1000);
  };

  const end = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setStage('results');
  };

  const handleAnswer = (option) => {
    const isRight = option === question.answer;
    setResponses(prev => [...prev, {
      prompt: question.type === 'Angles' ? 'Estimate the displayed angle' : question.prompt,
      detail: question.type === 'Angles' ? `Angle shown from base ${fmtDeg(question.base)}` : `Target ${question.target}`,
      given: option,
      answer: question.answer,
      correct: isRight
    }]);
    const nextCorrect = isRight ? correct + 1 : correct;
    const nextIdx = idx + 1;
    setCorrect(nextCorrect);
    if (nextIdx >= cfg.questionCount) {
      setIdx(nextIdx);
      end();
      return;
    }
    setIdx(nextIdx);
    setQuestion(makeQuestion(nextIdx));
  };

  useEffect(() => {
    const onKeyDown = (event) => {
      if (stage !== 'test') return;
      if (!/^[1-5]$/.test(event.key)) return;
      const option = question?.options[Number(event.key) - 1];
      if (option) handleAnswer(option);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  useEffect(() => {
    if (stage === 'results' && mode === 'assessment' && idx > 0) {
      saveResult('Angles, Bearings & Degrees', mode, difficulty, {
        accuracy: (correct / idx) * 100,
        correct,
        total: idx
      });
    }
  }, [stage]); // eslint-disable-line react-hooks/exhaustive-deps

  if (stage === 'menu') {
    return (
      <ModuleMenu
        title="Angles, Bearings & Degrees - Setup"
        description="Estimate angles and compass bearings from a sparse RAF-style display. Answers are multiple choice and become closer together as the run progresses."
        mode={mode}
        setMode={setMode}
        difficulty={difficulty}
        setDifficulty={setDifficulty}
        onCancel={() => navigate('/')}
        onStart={start}
      />
    );
  }

  if (stage === 'results') {
    const acc = idx ? (correct / idx) * 100 : 0;
    return (
      <ModuleResults
        title="Angles, Bearings & Degrees - Results"
        rows={[['Correct', `${correct} / ${idx}`], ['Accuracy', `${acc.toFixed(1)}%`]]}
        overallScore={acc}
        summary={responses}
        onRetry={() => setStage('menu')}
        onDashboard={() => navigate('/')}
      />
    );
  }

  return (
    <div className="min-h-screen text-white" style={{ backgroundColor: BLUE, fontFamily: "'Arial', 'Helvetica', sans-serif" }}>
      <div className="h-screen max-h-[768px] max-w-[1024px] mx-auto border-2 border-white flex flex-col" data-testid="abd-test-screen">
        <div className="h-11 border-b-2 border-white grid grid-cols-3 items-center px-6 text-[20px]">
          <div>{mode === 'practice' ? 'Practice' : 'Example'} {idx + 1} of {cfg.questionCount}</div>
          <div className="text-center">{question.type}</div>
          <div className="text-right text-[16px]">Time Left: {formatTime(remaining)}</div>
        </div>
        <div className="flex-1 grid grid-cols-[690px_1fr]">
          <div className="flex items-center justify-center">
            <div className={`${question.type === 'Bearings' ? 'w-[640px] h-[640px]' : 'w-[590px] h-[590px]'} border border-white bg-black`} data-testid="abd-display">
              {question.type === 'Angles' ? <AngleDisplay question={question} /> : <BearingDisplay question={question} />}
            </div>
          </div>
          <div className="flex items-center justify-center pr-12">
            <ChoiceColumn question={question} onAnswer={handleAnswer} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnglesBearingsDegrees;
