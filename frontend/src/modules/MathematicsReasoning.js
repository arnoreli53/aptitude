import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSettings, saveResult } from '../utils/storage';
import { bevelIn, randInt, pick, shuffle,
         ModuleMenu, ModuleResults, AnswerChoices, CBTReasonShell } from './cbtCommon';

// Word problems: speed/distance/time, fuel consumption, etc.
const templates = [
  () => {
    const speed = pick([200, 250, 300, 400, 500]);
    const dist = speed * pick([2, 3, 4, 5]);
    const dist2 = dist * pick([1.5, 2, 2.5]);
    const hours = dist2 / speed;
    return {
      prompt: `An aircraft flies for ${dist} miles in ${dist / speed} hours. Travelling at the same speed how long will it take the aircraft to travel a further ${dist2} miles?`,
      answer: `${hours.toFixed(2)} hours`,
      distractors: [hours + 1, hours - 1, hours + 2, hours - 0.5].map(v => `${v.toFixed(2)} hours`)
    };
  },
  () => {
    const rate = pick([50, 80, 100, 150]);
    const hours = pick([2, 3, 4, 6, 8]);
    const total = rate * hours;
    return {
      prompt: `An aircraft consumes ${rate} litres of fuel per hour. How much fuel is consumed in ${hours} hours of flight?`,
      answer: `${total} litres`,
      distractors: [total + rate, total - rate, total * 1.1, total * 0.9].map(v => `${Math.round(v)} litres`)
    };
  },
  () => {
    const dist = randInt(200, 900);
    const time = randInt(2, 8);
    const speed = Math.round(dist / time);
    return {
      prompt: `An aircraft flies ${dist} miles in ${time} hours. What is the average speed?`,
      answer: `${speed} mph`,
      distractors: [speed + 20, speed - 20, speed + 50, speed - 50].map(v => `${v} mph`)
    };
  },
  () => {
    const load = pick([500, 800, 1000, 1200]);
    const flights = pick([3, 4, 5, 6]);
    const total = load * flights;
    return {
      prompt: `A cargo aircraft carries ${load} kg per flight. How much cargo does it deliver over ${flights} flights?`,
      answer: `${total} kg`,
      distractors: [total + load, total - load, total * 1.1, total * 0.9].map(v => `${Math.round(v)} kg`)
    };
  }
];

const generate = () => {
  const t = pick(templates)();
  return { ...t, options: shuffle([t.answer, ...t.distractors]) };
};

const MathematicsReasoning = () => {
  const navigate = useNavigate();
  const [stage, setStage] = useState('menu');
  const [mode, setMode] = useState(null);
  const [difficulty, setDifficulty] = useState(null);
  const [cfg, setCfg] = useState(null);
  const [q, setQ] = useState(null);
  const [idx, setIdx] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [responses, setResponses] = useState([]);
  const timerRef = useRef(null);

  useEffect(() => () => timerRef.current && clearInterval(timerRef.current), []);

  const start = () => {
    const c = getSettings().mathematicsReasoning[difficulty];
    setCfg(c); setRemaining(c.testDuration);
    setIdx(0); setCorrect(0); setResponses([]); setQ(generate());
    setStage('test');
    timerRef.current = setInterval(() => setRemaining(r => (r <= 1 ? (end(), 0) : r - 1)), 1000);
  };

  const end = () => { if (timerRef.current) clearInterval(timerRef.current); setStage('results'); };

  const answer = (opt) => {
    const isRight = opt === q.answer;
    setResponses(prev => [...prev, {
      prompt: q.prompt,
      given: opt,
      answer: q.answer,
      correct: isRight
    }]);
    const newCorrect = isRight ? correct + 1 : correct;
    const newIdx = idx + 1;
    setCorrect(newCorrect);
    if (newIdx >= cfg.questionCount) { setIdx(newIdx); end(); return; }
    setIdx(newIdx); setQ(generate());
  };

  useEffect(() => {
    if (stage === 'results' && mode === 'assessment' && idx > 0) {
      const acc = (correct / idx) * 100;
      saveResult('Mathematics Reasoning', mode, difficulty, { accuracy: acc, correct, total: idx });
    }
  }, [stage]); // eslint-disable-line

  if (stage === 'menu') return (
    <ModuleMenu title="Mathematics Reasoning - Setup"
      description="Solve numerical word problems involving time, speed, distance, fuel, and cargo. Mental arithmetic only. No calculators."
      mode={mode} setMode={setMode} difficulty={difficulty} setDifficulty={setDifficulty}
      onCancel={() => navigate('/')} onStart={start} />
  );

  if (stage === 'results') {
    const acc = idx ? (correct / idx) * 100 : 0;
    return <ModuleResults title="Mathematics Reasoning - Results"
      rows={[['Correct', `${correct} / ${idx}`], ['Accuracy', `${acc.toFixed(1)}%`]]}
      overallScore={acc} summary={responses} onRetry={() => setStage('menu')} onDashboard={() => navigate('/')} />;
  }

  return (
    <CBTReasonShell title="Mathematics Reasoning - Testing" testTag="MATB Mathematics"
      practice={mode === 'practice'} remaining={remaining}
      questionNum={idx + 1} questionCount={cfg.questionCount}>
      <div className="bg-white p-4 mb-3" style={bevelIn}>
        <div className="text-black text-sm leading-relaxed">{q.prompt}</div>
      </div>
      <div className="bg-[#C0C0C0] p-3" style={bevelIn}>
        <AnswerChoices options={q.options} onPick={answer} />
      </div>
    </CBTReasonShell>
  );
};

export default MathematicsReasoning;
