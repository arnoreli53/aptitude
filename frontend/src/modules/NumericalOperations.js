import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSettings, saveResult } from '../utils/storage';
import { bevelIn, randInt, pick,
         ModuleMenu, ModuleResults, CBTReasonShell } from './cbtCommon';

const generateExpr = (difficulty) => {
  const complexity = difficulty === 'easy' ? 1 : difficulty === 'medium' ? 2 : 3;
  if (complexity === 1) {
    const a = randInt(1, 12); const b = randInt(1, 12);
    const op = pick(['+', '-', '×']);
    const answer = op === '+' ? a + b : op === '-' ? a - b : a * b;
    return { expr: `${a} ${op} ${b}`, answer };
  }
  if (complexity === 2) {
    const a = randInt(10, 50); const b = randInt(2, 12);
    const op = pick(['+', '-', '×', '÷']);
    let answer;
    if (op === '÷') { const r = a * b; return { expr: `${r} ÷ ${b}`, answer: a }; }
    answer = op === '+' ? a + b : op === '-' ? a - b : a * b;
    return { expr: `${a} ${op} ${b}`, answer };
  }
  // hard: two ops
  const a = randInt(5, 25); const b = randInt(2, 12); const c = randInt(2, 10);
  const ans = a * b + c;
  return { expr: `${a} × ${b} + ${c}`, answer: ans };
};

const NumericalOperations = () => {
  const navigate = useNavigate();
  const [stage, setStage] = useState('menu');
  const [mode, setMode] = useState(null);
  const [difficulty, setDifficulty] = useState(null);
  const [cfg, setCfg] = useState(null);
  const [q, setQ] = useState(null);
  const [idx, setIdx] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [input, setInput] = useState('');
  const [responses, setResponses] = useState([]);
  const timerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => () => timerRef.current && clearInterval(timerRef.current), []);

  const start = () => {
    const c = getSettings().numericalOperations[difficulty];
    setCfg(c); setRemaining(c.testDuration);
    setIdx(0); setCorrect(0); setResponses([]); setQ(generateExpr(difficulty));
    setInput('');
    setStage('test');
    timerRef.current = setInterval(() => setRemaining(r => (r <= 1 ? (end(), 0) : r - 1)), 1000);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const end = () => { if (timerRef.current) clearInterval(timerRef.current); setStage('results'); };

  const submit = (e) => {
    e.preventDefault();
    if (input === '') return;
    const isRight = Number(input) === q.answer;
    setResponses(prev => [...prev, {
      prompt: `${q.expr} =`,
      given: input,
      answer: q.answer,
      correct: isRight
    }]);
    const newCorrect = isRight ? correct + 1 : correct;
    const newIdx = idx + 1;
    setCorrect(newCorrect);
    if (newIdx >= cfg.questionCount) { setIdx(newIdx); end(); return; }
    setIdx(newIdx); setQ(generateExpr(difficulty)); setInput('');
    setTimeout(() => inputRef.current?.focus(), 30);
  };

  useEffect(() => {
    if (stage === 'results' && mode === 'assessment' && idx > 0) {
      const acc = (correct / idx) * 100;
      saveResult('Numerical Operations', mode, difficulty, { accuracy: acc, correct, total: idx });
    }
  }, [stage]); // eslint-disable-line

  if (stage === 'menu') return (
    <ModuleMenu title="Numerical Operations - Setup"
      description="Rapid mental arithmetic: addition, subtraction, multiplication, division. Type the answer and press Enter. Work as quickly and as accurately as possible."
      mode={mode} setMode={setMode} difficulty={difficulty} setDifficulty={setDifficulty}
      onCancel={() => navigate('/')} onStart={start} />
  );

  if (stage === 'results') {
    const acc = idx ? (correct / idx) * 100 : 0;
    return <ModuleResults title="Numerical Operations - Results"
      rows={[['Correct', `${correct} / ${idx}`], ['Accuracy', `${acc.toFixed(1)}%`]]}
      overallScore={acc} summary={responses} onRetry={() => setStage('menu')} onDashboard={() => navigate('/')} />;
  }

  return (
    <CBTReasonShell title="Numerical Operations Test - Testing" testTag="NOT"
      practice={mode === 'practice'} remaining={remaining}
      questionNum={idx + 1} questionCount={cfg.questionCount}>
      <div className="flex flex-col items-center justify-center py-8">
        <div className="text-black text-5xl font-mono font-bold mb-6" data-testid="num-op-expr">{q.expr} =</div>
        <form onSubmit={submit} className="flex items-center gap-3">
          <label className="text-black text-sm font-bold">Your Answer:</label>
          <input
            ref={inputRef}
            data-testid="num-op-input"
            type="number"
            value={input}
            onChange={e => setInput(e.target.value)}
            className="w-32 bg-white text-black font-mono text-xl px-2 py-1 text-center"
            style={bevelIn}
            autoFocus
          />
          <button data-testid="num-op-submit" type="submit"
            className="bg-[#008000] text-white px-4 py-1 text-xs font-bold"
            style={{ borderStyle: 'outset', borderWidth: '2px', borderColor: '#DDDDDD' }}>ENTER</button>
        </form>
        <div className="mt-6 text-[10px] text-black">Press ENTER or click the button to submit</div>
      </div>
    </CBTReasonShell>
  );
};

export default NumericalOperations;
