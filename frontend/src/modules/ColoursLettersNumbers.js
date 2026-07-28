import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSettings, saveResult } from '../utils/storage';
import { bevelIn, bevelOut, formatTime, randInt, pick, shuffle,
         ModuleMenu, ModuleResults, CBTReasonShell } from './cbtCommon';

// Colours Letters and Numbers - multitasking:
// - Match 4 corner strings (A/B/C/D)
// - Track colored blocks / diamond / square
// - Solve arithmetic
const LETTERS = 'JKLMNPQRSTVWXYZ'.split('');
const COLORS = ['#FF3333', '#FFCC00', '#00AA00', '#4488FF', '#800080', '#FFFFFF'];
const CORNER_LABELS = ['A', 'B', 'C', 'D'];

const genString = (len) => Array.from({ length: len }, () => pick(LETTERS)).join('');

const generateTask = (cfg) => {
  const type = pick(['string', 'color', 'math']);
  if (type === 'string') {
    // Build target + 3 slight variations
    const target = genString(cfg.stringLength);
    const variants = [target];
    while (variants.length < 4) {
      const chars = target.split('');
      const swapAt = randInt(1, cfg.stringLength - 2);
      chars[swapAt] = pick(LETTERS.filter(l => l !== chars[swapAt]));
      variants.push(chars.join(''));
    }
    const corners = shuffle(variants);
    const answerIdx = corners.indexOf(target);
    return { type, target, corners, answer: CORNER_LABELS[answerIdx] };
  }
  if (type === 'color') {
    const seq = Array.from({ length: 3 }, () => pick(COLORS));
    const target = pick(seq);
    const corners = shuffle([target, ...shuffle(COLORS.filter(c => c !== target)).slice(0, 3)]);
    const answerIdx = corners.indexOf(target);
    return { type, seq, target,
      corners,
      answer: CORNER_LABELS[answerIdx],
      colorMode: true };
  }
  // math
  const a = randInt(2, 12); const b = randInt(2, 12);
  const op = pick(['+', '×', '-']);
  const ans = op === '+' ? a + b : op === '×' ? a * b : a - b;
  const distractors = shuffle([ans + 1, ans - 1, ans + randInt(2, 5), ans - randInt(2, 5)]).slice(0, 3);
  const corners = shuffle([ans, ...distractors]);
  const answerIdx = corners.indexOf(ans);
  return { type, expr: `${a} ${op} ${b}`, answer: CORNER_LABELS[answerIdx], corners };
};

const ColoursLettersNumbers = () => {
  const navigate = useNavigate();
  const [stage, setStage] = useState('menu');
  const [mode, setMode] = useState(null);
  const [difficulty, setDifficulty] = useState(null);
  const [cfg, setCfg] = useState(null);
  const [task, setTask] = useState(null);
  const [idx, setIdx] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [responses, setResponses] = useState([]);
  const timerRef = useRef(null);

  useEffect(() => () => timerRef.current && clearInterval(timerRef.current), []);

  const start = () => {
    const c = getSettings().coloursLettersNumbers[difficulty];
    setCfg(c); setRemaining(c.testDuration);
    setIdx(0); setCorrect(0); setResponses([]); setTask(generateTask(c));
    setStage('test');
    timerRef.current = setInterval(() => setRemaining(r => (r <= 1 ? (end(), 0) : r - 1)), 1000);
  };

  const end = () => { if (timerRef.current) clearInterval(timerRef.current); setStage('results'); };

  const pickCorner = (letter) => {
    const isRight = letter === task.answer;
    setResponses(prev => [...prev, {
      prompt: task.type === 'math' ? `Solve ${task.expr}` : task.type === 'color' ? 'Match the centre colour' : `Match ${task.target}`,
      given: `${letter}: ${task.corners[CORNER_LABELS.indexOf(letter)]}`,
      answer: `${task.answer}: ${task.corners[CORNER_LABELS.indexOf(task.answer)]}`,
      correct: isRight
    }]);
    const newCorrect = isRight ? correct + 1 : correct;
    const newIdx = idx + 1;
    setCorrect(newCorrect);
    if (newIdx >= cfg.questionCount) { setIdx(newIdx); end(); return; }
    setIdx(newIdx); setTask(generateTask(cfg));
  };

  useEffect(() => {
    if (stage === 'results' && mode === 'assessment' && idx > 0) {
      const acc = (correct / idx) * 100;
      saveResult('Colours, Letters & Numbers', mode, difficulty, { accuracy: acc, correct, total: idx });
    }
  }, [stage]); // eslint-disable-line

  if (stage === 'menu') return (
    <ModuleMenu title="Colours, Letters & Numbers - Setup"
      description="Multitasking test. Watch the central prompt (string match, colour, or arithmetic) and click the matching corner (A/B/C/D). Work as quickly and as accurately as possible."
      mode={mode} setMode={setMode} difficulty={difficulty} setDifficulty={setDifficulty}
      onCancel={() => navigate('/')} onStart={start} />
  );

  if (stage === 'results') {
    const acc = idx ? (correct / idx) * 100 : 0;
    return <ModuleResults title="Colours, Letters & Numbers - Results"
      rows={[['Correct', `${correct} / ${idx}`], ['Accuracy', `${acc.toFixed(1)}%`]]}
      overallScore={acc} summary={responses} onRetry={() => setStage('menu')} onDashboard={() => navigate('/')} />;
  }

  const Corner = ({ label, testid, cornerClass, children, onClick }) => (
    <button data-testid={testid} onClick={onClick}
      className={`bg-[#C0C0C0] text-black flex items-center justify-center font-mono font-bold text-lg p-4 ${cornerClass}`}
      style={bevelOut}>
      <div className="text-center">
        <div className="text-[10px] text-[#800000] font-bold mb-1">{label}</div>
        <div>{children}</div>
      </div>
    </button>
  );

  return (
    <CBTReasonShell title="Colours, Letters & Numbers - Testing" testTag="CLN"
      practice={mode === 'practice'} remaining={remaining}
      questionNum={idx + 1} questionCount={cfg.questionCount}>
      <div className="grid grid-cols-3 gap-2" style={{ minHeight: 320 }}>
        <Corner label="A" testid="cln-corner-A" onClick={() => pickCorner('A')}>
          {task.type === 'color'
            ? <div className="w-16 h-16" style={{ backgroundColor: task.corners[0] }}></div>
            : task.corners[0]}
        </Corner>
        <div className="flex items-center justify-center bg-black p-3" style={bevelIn}>
          {task.type === 'string' && (<>
            <div className="text-center">
              <div className="text-[#FFCC00] text-[10px] mb-2 font-bold">MATCH THIS STRING</div>
              <div className="text-white text-3xl font-mono font-bold tracking-widest">{task.target}</div>
            </div>
          </>)}
          {task.type === 'color' && (<>
            <div className="text-center">
              <div className="text-[#FFCC00] text-[10px] mb-2 font-bold">MATCH THIS COLOR</div>
              <div className="w-24 h-24 mx-auto" style={{ backgroundColor: task.target }}></div>
            </div>
          </>)}
          {task.type === 'math' && (<>
            <div className="text-center">
              <div className="text-[#FFCC00] text-[10px] mb-2 font-bold">SOLVE</div>
              <div className="text-white text-4xl font-mono font-bold">{task.expr} =</div>
            </div>
          </>)}
        </div>
        <Corner label="B" testid="cln-corner-B" onClick={() => pickCorner('B')}>
          {task.type === 'color'
            ? <div className="w-16 h-16" style={{ backgroundColor: task.corners[1] }}></div>
            : task.corners[1]}
        </Corner>
        <Corner label="C" testid="cln-corner-C" onClick={() => pickCorner('C')}>
          {task.type === 'color'
            ? <div className="w-16 h-16" style={{ backgroundColor: task.corners[2] }}></div>
            : task.corners[2]}
        </Corner>
        <div className="text-center bg-[#C0C0C0] flex items-center justify-center text-black text-[11px] p-3" style={bevelIn}>
          Click the corner that matches the centre prompt.
        </div>
        <Corner label="D" testid="cln-corner-D" onClick={() => pickCorner('D')}>
          {task.type === 'color'
            ? <div className="w-16 h-16" style={{ backgroundColor: task.corners[3] }}></div>
            : task.corners[3]}
        </Corner>
      </div>
    </CBTReasonShell>
  );
};

export default ColoursLettersNumbers;
