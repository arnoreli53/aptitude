import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSettings, saveResult } from '../utils/storage';
import { bevelIn, bevelOut, randInt, shuffle, pick,
         ModuleMenu, ModuleResults, AnswerChoices, CBTReasonShell } from './cbtCommon';

// Digit Recognition: memorize string, then answer questions about it.
const generateDigits = (n) => Array.from({ length: n }, () => randInt(0, 9)).join('');

const questionAbout = (digits) => {
  const n = digits.length;
  const type = pick(['first', 'last', 'position', 'count']);
  if (type === 'first') {
    const correct = digits[0];
    const distractors = shuffle('0123456789'.replace(correct, '').split('')).slice(0, 4);
    return { text: 'What was the FIRST digit shown?', answer: correct, options: shuffle([correct, ...distractors]) };
  }
  if (type === 'last') {
    const correct = digits[n - 1];
    const distractors = shuffle('0123456789'.replace(correct, '').split('')).slice(0, 4);
    return { text: 'What was the LAST digit shown?', answer: correct, options: shuffle([correct, ...distractors]) };
  }
  if (type === 'position') {
    const pos = randInt(1, n);
    const correct = digits[pos - 1];
    const distractors = shuffle('0123456789'.replace(correct, '').split('')).slice(0, 4);
    return { text: `What digit was in position ${pos}?`, answer: correct, options: shuffle([correct, ...distractors]) };
  }
  const target = pick(digits.split(''));
  const count = digits.split('').filter(d => d === target).length;
  const distractors = shuffle([0, 1, 2, 3, 4, 5].filter(v => v !== count)).slice(0, 4);
  return { text: `How many times did the digit ${target} appear?`, answer: String(count), options: shuffle([String(count), ...distractors.map(String)]) };
};

const DigitRecognition = () => {
  const navigate = useNavigate();
  const [stage, setStage] = useState('menu');
  const [mode, setMode] = useState(null);
  const [difficulty, setDifficulty] = useState(null);
  const [cfg, setCfg] = useState(null);
  const [digits, setDigits] = useState('');
  const [q, setQ] = useState(null);
  const [showPhase, setShowPhase] = useState('show'); // show | answer
  const [idx, setIdx] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [showRemaining, setShowRemaining] = useState(0);
  const [responses, setResponses] = useState([]);
  const timerRef = useRef(null);
  const showRef = useRef(null);

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (showRef.current) clearInterval(showRef.current);
  }, []);

  const start = () => {
    const c = getSettings().digitRecognition[difficulty];
    setCfg(c); setRemaining(c.testDuration);
    setIdx(0); setCorrect(0); setResponses([]);
    beginQuestion(c);
    setStage('test');
    timerRef.current = setInterval(() => setRemaining(r => (r <= 1 ? (end(), 0) : r - 1)), 1000);
  };

  const beginQuestion = (c) => {
    const d = generateDigits(c.digitCount);
    setDigits(d);
    setQ(questionAbout(d));
    setShowPhase('show');
    setShowRemaining(c.showTime);
    if (showRef.current) clearInterval(showRef.current);
    showRef.current = setInterval(() => setShowRemaining(t => {
      if (t <= 0.1) { clearInterval(showRef.current); setShowPhase('answer'); return 0; }
      return t - 0.1;
    }), 100);
  };

  const end = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (showRef.current) clearInterval(showRef.current);
    setStage('results');
  };

  const answer = (opt) => {
    const isRight = String(opt) === String(q.answer);
    setResponses(prev => [...prev, {
      prompt: q.text,
      detail: `Sequence: ${digits}`,
      given: opt,
      answer: q.answer,
      correct: isRight
    }]);
    const newCorrect = isRight ? correct + 1 : correct;
    const newIdx = idx + 1;
    setCorrect(newCorrect);
    if (newIdx >= cfg.questionCount) { setIdx(newIdx); end(); return; }
    setIdx(newIdx); beginQuestion(cfg);
  };

  useEffect(() => {
    if (stage === 'results' && mode === 'assessment' && idx > 0) {
      const acc = (correct / idx) * 100;
      saveResult('Digit Recognition', mode, difficulty, { accuracy: acc, correct, total: idx });
    }
  }, [stage]); // eslint-disable-line

  if (stage === 'menu') return (
    <ModuleMenu title="Digit Recognition - Setup"
      description="A string of digits will be displayed briefly. Memorise it, then answer a question about the digits. Work quickly and accurately."
      mode={mode} setMode={setMode} difficulty={difficulty} setDifficulty={setDifficulty}
      onCancel={() => navigate('/')} onStart={start} />
  );

  if (stage === 'results') {
    const acc = idx ? (correct / idx) * 100 : 0;
    return <ModuleResults title="Digit Recognition - Results"
      rows={[['Correct', `${correct} / ${idx}`], ['Accuracy', `${acc.toFixed(1)}%`]]}
      overallScore={acc} summary={responses} onRetry={() => setStage('menu')} onDashboard={() => navigate('/')} />;
  }

  return (
    <CBTReasonShell title="Digit Recognition - Testing" testTag="DR"
      practice={mode === 'practice'} remaining={remaining}
      questionNum={idx + 1} questionCount={cfg.questionCount}>
      {showPhase === 'show' ? (
        <div className="flex flex-col items-center justify-center py-16 bg-black" style={bevelIn}>
          <div className="text-white text-[10px] mb-6 font-bold">MEMORISE THIS SEQUENCE</div>
          <div className="text-white text-6xl font-mono font-bold tracking-widest" data-testid="digit-sequence">{digits}</div>
          <div className="mt-6 text-[#FFCC00] text-xs font-mono">Shown for {showRemaining.toFixed(1)}s more</div>
        </div>
      ) : (
        <div className="bg-[#C0C0C0] p-4" style={bevelIn}>
          <div className="text-black text-sm font-bold mb-3">{q.text}</div>
          <AnswerChoices options={q.options} onPick={answer} />
        </div>
      )}
    </CBTReasonShell>
  );
};

export default DigitRecognition;
