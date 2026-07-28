import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSettings, saveResult } from '../utils/storage';
import { randInt, pick, shuffle, ModuleMenu, ModuleResults } from './cbtCommon';

// RAF CBAT Table Reading (MATF)
// Part 1: Cross-reference two values in a symmetric -10 to +10 reference grid.
// Part 2: Use three values to look up drift correction on the reference charts.
const AXIS_VALUES = Array.from({ length: 21 }, (_, index) => index - 10);

const formatSigned = (value) => value > 0 ? `+${value}` : String(value);

const buildGrid = () => {
  const grid = {};
  AXIS_VALUES.forEach((row) => {
    AXIS_VALUES.forEach((column) => {
      grid[`${row},${column}`] = 10 - Math.abs(row - column);
    });
  });
  return grid;
};

const genPart1 = (grid) => {
  const r = randInt(-10, 10);
  const c = randInt(-10, 10);
  const answer = grid[`${r},${c}`];
  const distractors = shuffle(AXIS_VALUES.filter((value) => value !== answer)).slice(0, 4);
  const options = shuffle([answer, ...distractors]).map(String);
  return { part: 1, firstValue: r, secondValue: c, options, answer: String(answer) };
};

// Part 2 remains a training approximation until an authoritative chart is available.
const buildPart2Chart = () => {
  const chart = {};
  const speeds = [80, 120, 160, 200];
  const winds = [10, 20, 30, 40];
  const angles = [30, 60, 90, 120];
  speeds.forEach(s => {
    winds.forEach(w => {
      angles.forEach(a => {
        // Drift = round((wind * sin(angle) / speed) * 60)
        const drift = Math.round((w * Math.sin(a * Math.PI / 180) / s) * 60);
        chart[`${s},${w},${a}`] = drift;
      });
    });
  });
  return { chart, speeds, winds, angles };
};

const genPart2 = (p2) => {
  const s = pick(p2.speeds);
  const w = pick(p2.winds);
  const a = pick(p2.angles);
  const answer = p2.chart[`${s},${w},${a}`];
  const distractors = new Set();
  while (distractors.size < 4) {
    const jitter = randInt(-4, 4);
    if (jitter !== 0) distractors.add(answer + jitter);
  }
  const options = shuffle([answer, ...distractors]).map(String);
  return { part: 2, speed: s, wind: w, angle: a, options, answer: String(answer) };
};

const MatfChoices = ({ q, selectedIndex, onSelect }) => (
  <div className="w-full max-w-[180px] justify-self-center text-[16px] sm:text-[18px]">
    {q.part === 2 && (
      <div className="mb-3 leading-tight">
        <div>What is the</div>
        <div>Dri. Cor. ?</div>
      </div>
    )}
    <div className="space-y-2">
      {q.options.map((option, index) => (
        <button
          key={`${option}-${index}`}
          type="button"
          data-testid={`tr-answer-${index}`}
          onClick={() => onSelect(index)}
          className="grid w-full grid-cols-[28px_1fr] items-center gap-3 text-left text-white focus:outline-none"
          aria-pressed={selectedIndex === index}
        >
          <span
            className={`flex h-7 w-7 items-center justify-center border border-[#8a8a8a] text-black ${
              selectedIndex === index ? 'bg-white outline outline-2 outline-[#ffff00]' : 'bg-[#c0c0c0]'
            }`}
          >
            {index + 1}
          </span>
          <span>{option}</span>
        </button>
      ))}
    </div>
  </div>
);

const PartOneValues = ({ q }) => (
  <div className="grid w-full max-w-[260px] grid-cols-2 border border-white text-center">
    <div className="flex h-16 items-center justify-center border-b border-r border-white px-3 leading-tight">First<br />Value</div>
    <div className="flex h-16 items-center justify-center border-b border-white px-3 leading-tight">Second<br />Value</div>
    <div className="flex h-16 items-center justify-center border-r border-white text-2xl" data-testid="tr-first">
      {formatSigned(q.firstValue)}
    </div>
    <div className="flex h-16 items-center justify-center text-2xl" data-testid="tr-second">
      {formatSigned(q.secondValue)}
    </div>
  </div>
);

const PartTwoValues = ({ q }) => (
  <div className="grid w-full max-w-[390px] grid-cols-3 border border-white text-center">
    {['Air Speed', 'Wind Velocity', 'Wind Angle'].map((label, index) => (
      <div key={label} className={`flex h-16 items-center justify-center border-b border-white px-2 leading-tight ${index < 2 ? 'border-r' : ''}`}>
        {label}
      </div>
    ))}
    <div className="flex h-16 items-center justify-center border-r border-white text-2xl" data-testid="tr-p2-speed">{q.speed}</div>
    <div className="flex h-16 items-center justify-center border-r border-white text-2xl" data-testid="tr-p2-wind">{q.wind}</div>
    <div className="flex h-16 items-center justify-center text-2xl" data-testid="tr-p2-angle">{q.angle}</div>
  </div>
);

const MatfQuestionScreen = ({
  q,
  mode,
  problemNumber,
  selectedIndex,
  onSelect,
  onSubmit
}) => (
  <section
    className="mx-auto flex min-h-[600px] w-full max-w-[1000px] flex-col overflow-hidden border-2 border-white bg-[#000080] text-white sm:aspect-[4/3] sm:min-h-0"
    data-testid="matf-question-screen"
    style={{ fontFamily: "'Arial', 'Helvetica', sans-serif" }}
  >
    <header className="grid h-11 shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b-2 border-white px-4 text-sm sm:text-xl">
      <div>{mode === 'practice' ? 'Practice ' : ''}Problem {problemNumber}</div>
      <div>MAT-F Part {q.part === 1 ? 'One' : 'Two'}</div>
      <div />
    </header>

    <div className="relative flex min-h-0 flex-1 flex-col">
      {q.part === 2 && (
        <div className="px-6 pt-5 text-center text-sm sm:text-lg">
          Use information from the four MAT-F PART TWO tables to answer:-
        </div>
      )}

      <div className="grid flex-1 grid-cols-1 content-start items-center gap-7 px-6 pb-24 pt-8 sm:grid-cols-[minmax(270px,1fr)_180px] sm:content-center sm:gap-20 sm:px-[17%] sm:pb-28 sm:pt-4">
        <div className="flex justify-center">
          {q.part === 1 ? <PartOneValues q={q} /> : <PartTwoValues q={q} />}
        </div>
        <MatfChoices q={q} selectedIndex={selectedIndex} onSelect={onSelect} />
      </div>

      <div className="absolute inset-x-0 bottom-12 text-center text-lg sm:bottom-20 sm:text-xl">
        Your Answer&nbsp; [&nbsp; {selectedIndex === null ? '\u00a0' : selectedIndex + 1}&nbsp; ]
      </div>
    </div>

    <button
      type="button"
      onClick={onSubmit}
      disabled={selectedIndex === null}
      className="h-12 shrink-0 border-t-2 border-white bg-[#000080] text-center text-sm text-white disabled:text-[#b5b5d8] sm:text-lg"
    >
      Enter or change your answer, then press ENTER
    </button>
  </section>
);

const PartOneReference = ({ grid }) => (
  <section className="mx-auto mt-8 w-full max-w-[1060px] border-2 border-white bg-[#d8d8d8]">
    <div className="border-b-2 border-white bg-[#000080] px-4 py-2 text-center text-base font-bold text-white">
      MAT-F Part One Reference Table
    </div>
    <div className="min-w-0 max-w-full overflow-x-auto bg-white p-1">
      <table className="mx-auto min-w-[950px] border-collapse bg-white text-center font-mono text-[13px] text-black" data-testid="tr-grid">
        <thead>
          <tr>
            <th className="h-8 min-w-10 border-2 border-black bg-[#eeeeee]" />
            {AXIS_VALUES.map((column) => (
              <th key={column} className="h-8 min-w-10 border-2 border-black bg-[#eeeeee] font-normal">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {AXIS_VALUES.map((row) => (
            <tr key={row}>
              <th className="h-8 min-w-10 border-2 border-black bg-[#eeeeee] font-normal">{row}</th>
              {AXIS_VALUES.map((column) => (
                <td key={column} className="h-8 min-w-10 border border-black bg-white">
                  {grid[`${row},${column}`]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </section>
);

const PartTwoReference = ({ reference }) => (
  <section className="mx-auto mt-8 w-full max-w-[1060px] border-2 border-white bg-white">
    <div className="border-b-2 border-white bg-[#000080] px-4 py-2 text-center text-base font-bold text-white">
      MAT-F Part Two Reference Tables
    </div>
    <div className="grid grid-cols-1 gap-4 p-4 text-black sm:grid-cols-2">
      {reference.speeds.map((speed) => (
        <table key={speed} className="w-full border-collapse text-center font-mono text-sm">
          <caption className="border-2 border-b-0 border-black bg-[#eeeeee] py-1 font-bold">Air Speed {speed}</caption>
          <thead>
            <tr>
              <th className="border-2 border-black bg-[#eeeeee]">Wind / Angle</th>
              {reference.angles.map((angle) => <th key={angle} className="border-2 border-black bg-[#eeeeee]">{angle}</th>)}
            </tr>
          </thead>
          <tbody>
            {reference.winds.map((wind) => (
              <tr key={wind}>
                <th className="border-2 border-black bg-[#eeeeee]">{wind}</th>
                {reference.angles.map((angle) => (
                  <td key={angle} className="border border-black">{reference.chart[`${speed},${wind},${angle}`]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ))}
    </div>
  </section>
);

const TableReading = () => {
  const navigate = useNavigate();
  const [stage, setStage] = useState('menu');
  const [mode, setMode] = useState(null);
  const [difficulty, setDifficulty] = useState(null);
  const [cfg, setCfg] = useState(null);
  const gridRef = useRef(null);
  const p2Ref = useRef(null);
  const [q, setQ] = useState(null);
  const [idx, setIdx] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [responses, setResponses] = useState([]);
  const [elapsed, setElapsed] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => () => timerRef.current && clearInterval(timerRef.current), []);

  const start = () => {
    const c = getSettings().tableReading[difficulty];
    setCfg(c); setElapsed(0);
    setIdx(0); setCorrect(0); setResponses([]);
    setSelectedIndex(null);
    gridRef.current = buildGrid();
    p2Ref.current = buildPart2Chart();
    setQ(genPart1(gridRef.current));
    setStage('test');
    timerRef.current = setInterval(() => setElapsed(e => {
      if (e + 1 >= c.testDuration) { end(); return c.testDuration; }
      return e + 1;
    }), 1000);
  };

  const end = () => { if (timerRef.current) clearInterval(timerRef.current); setStage('results'); };

  const answer = (opt) => {
    const isRight = opt === q.answer;
    setResponses(prev => [...prev, {
      prompt: q.part === 1
        ? `First Value ${formatSigned(q.firstValue)}, Second Value ${formatSigned(q.secondValue)}`
        : `Air Speed ${q.speed}, Wind Velocity ${q.wind}, Wind Angle ${q.angle}`,
      given: opt,
      answer: q.answer,
      correct: isRight
    }]);
    const newCorrect = isRight ? correct + 1 : correct;
    const newIdx = idx + 1;
    setCorrect(newCorrect);
    if (newIdx >= cfg.questionCount) { setIdx(newIdx); end(); return; }
    setIdx(newIdx);
    setSelectedIndex(null);
    const partOneCount = Math.ceil(cfg.questionCount / 2);
    if (newIdx < partOneCount) setQ(genPart1(gridRef.current));
    else setQ(genPart2(p2Ref.current));
  };

  useEffect(() => {
    if (stage !== 'test' || !q) return;
    const kd = (e) => {
      const k = parseInt(e.key, 10);
      if (k >= 1 && k <= q.options.length) {
        e.preventDefault();
        setSelectedIndex(k - 1);
        return;
      }
      if (e.key === 'Enter' && selectedIndex !== null) {
        e.preventDefault();
        answer(q.options[selectedIndex]);
      }
    };
    window.addEventListener('keydown', kd);
    return () => window.removeEventListener('keydown', kd);
  }, [stage, q, selectedIndex]); // eslint-disable-line

  useEffect(() => {
    if (stage === 'results' && mode === 'assessment' && idx > 0) {
      const acc = (correct / idx) * 100;
      saveResult('Table Reading', mode, difficulty, { accuracy: acc, correct, total: idx });
    }
  }, [stage]); // eslint-disable-line

  if (stage === 'menu') return (
    <ModuleMenu title="Table Reading Test - Setup"
      description="Cross-reference values in look-up tables. Part 1 uses a grid from -10 to +10 on both axes. Part 2 uses Air Speed, Wind Velocity and Wind Angle tables. Select an answer with 1-5, then press Enter."
      mode={mode} setMode={setMode} difficulty={difficulty} setDifficulty={setDifficulty}
      onCancel={() => navigate('/')} onStart={start} />
  );

  if (stage === 'results') {
    const acc = idx ? (correct / idx) * 100 : 0;
    return <ModuleResults title="Table Reading - Results"
      rows={[['Correct', `${correct} / ${idx}`], ['Accuracy', `${acc.toFixed(1)}%`]]}
      overallScore={acc} summary={responses} onRetry={() => setStage('menu')} onDashboard={() => navigate('/')} />;
  }

  const partOneCount = Math.ceil(cfg.questionCount / 2);
  const problemNumber = q.part === 1 ? idx + 1 : idx - partOneCount + 1;
  const submitSelected = () => {
    if (selectedIndex === null) return;
    answer(q.options[selectedIndex]);
  };

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#000008] px-3 py-4 sm:px-6">
      <MatfQuestionScreen
        q={q}
        mode={mode}
        problemNumber={problemNumber}
        selectedIndex={selectedIndex}
        onSelect={setSelectedIndex}
        onSubmit={submitSelected}
      />
      {q.part === 1
        ? <PartOneReference grid={gridRef.current} />
        : <PartTwoReference reference={p2Ref.current} />}
    </main>
  );
};

export default TableReading;
