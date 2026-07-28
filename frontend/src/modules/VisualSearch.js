import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSettings, saveResult } from '../utils/storage';
import { bevelIn, shuffle, ModuleMenu, ModuleResults, CBTReasonShell } from './cbtCommon';

// RAF Visual Search:
// Use cropped tile images from the RAF screenshot. Each image keeps its original
// black corner number. The target uses the same tile image but masks the number
// with question marks.
const BASE = '/assets/visual-search/';
const TILE_BANK = [
  { id: 'tile-10-A', label: 'A', number: 10, src: `${BASE}tile_10_A_0.png` },
  { id: 'tile-11-E', label: 'E', number: 11, src: `${BASE}tile_11_E_1.png` },
  { id: 'tile-12-K', label: 'K', number: 12, src: `${BASE}tile_12_K_2.png` },
  { id: 'tile-13-R', label: 'R', number: 13, src: `${BASE}tile_13_R_3.png` },
  { id: 'tile-14-B', label: 'B', number: 14, src: `${BASE}tile_14_B_4.png` },
  { id: 'tile-15-S', label: 'S', number: 15, src: `${BASE}tile_15_S_5.png` },
  { id: 'tile-16-I', label: 'I', number: 16, src: `${BASE}tile_16_I_6.png` },
  { id: 'tile-17-H', label: 'H', number: 17, src: `${BASE}tile_17_H_7.png` },
  { id: 'tile-18-G', label: 'G', number: 18, src: `${BASE}tile_18_G_8.png` },
  { id: 'tile-19-P', label: 'P', number: 19, src: `${BASE}tile_19_P_9.png` },
  { id: 'tile-20-E', label: 'E', number: 20, src: `${BASE}tile_20_E_10.png` },
  { id: 'tile-21-G', label: 'G', number: 21, src: `${BASE}tile_21_G_11.png` }
];

const pickTarget = (tiles, previousId) => {
  const candidates = tiles.filter(tile => tile.id !== previousId);
  return shuffle(candidates.length ? candidates : tiles)[0];
};

const TileImage = ({ tile, target = false, onClick, testId }) => (
  <button
    type="button"
    onClick={onClick}
    data-testid={testId}
    className="relative w-12 h-12"
    style={{ imageRendering: 'pixelated' }}
  >
    <img src={tile.src} alt="" className="w-12 h-12 block" draggable={false} />
    {target && (
      <span className="absolute left-[17px] top-[29px] w-[30px] h-[18px] bg-[#B8B8B8] text-black font-mono font-bold text-[16px] leading-none tracking-[-1px] flex items-center justify-center">
        ??
      </span>
    )}
  </button>
);

const VisualSearch = () => {
  const navigate = useNavigate();
  const [stage, setStage] = useState('menu');
  const [mode, setMode] = useState(null);
  const [difficulty, setDifficulty] = useState(null);
  const [cfg, setCfg] = useState(null);
  const [tiles, setTiles] = useState(TILE_BANK);
  const [target, setTarget] = useState(TILE_BANK[3]);
  const [idx, setIdx] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [input, setInput] = useState('');
  const [responses, setResponses] = useState([]);
  const timerRef = useRef(null);
  const inputRef = useRef(null);
  const targetRef = useRef(TILE_BANK[3]);

  useEffect(() => () => timerRef.current && clearInterval(timerRef.current), []);

  const newLayout = (previousTargetId = targetRef.current?.id) => {
    const shuffled = shuffle(TILE_BANK);
    const nextTarget = pickTarget(shuffled, previousTargetId);
    targetRef.current = nextTarget;
    setTiles(shuffled);
    setTarget(nextTarget);
    setInput('');
    setTimeout(() => inputRef.current?.focus(), 30);
  };

  const start = () => {
    const c = getSettings().visualSearch[difficulty];
    setCfg(c); setRemaining(c.testDuration);
    setIdx(0); setCorrect(0); setResponses([]);
    newLayout(null);
    setStage('test');
    timerRef.current = setInterval(() => setRemaining(r => (r <= 1 ? (end(), 0) : r - 1)), 1000);
  };

  const end = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setStage('results');
  };

  const submit = (value = input) => {
    const answer = String(value).trim();
    if (answer === '') return;
    const isRight = Number(answer) === targetRef.current.number;
    setResponses(prev => [...prev, {
      prompt: 'Enter the number on the matching visual-search tile',
      detail: `Target tile: ${targetRef.current.label}`,
      given: answer,
      answer: targetRef.current.number,
      correct: isRight
    }]);
    const newCorrect = isRight ? correct + 1 : correct;
    const newIdx = idx + 1;
    setCorrect(newCorrect);
    if (newIdx >= cfg.questionCount) { setIdx(newIdx); end(); return; }
    setIdx(newIdx);
    newLayout(targetRef.current.id);
  };

  useEffect(() => {
    if (stage === 'results' && mode === 'assessment' && idx > 0) {
      const acc = (correct / idx) * 100;
      saveResult('Visual Search', mode, difficulty, { accuracy: acc, correct, total: idx });
    }
  }, [stage]); // eslint-disable-line

  if (stage === 'menu') return (
    <ModuleMenu title="Visual Search - Setup"
      description="Find the matching RAF tile shown at the bottom. The target hides its black number with question marks. Enter the number from the matching tile. The tile positions randomise after every input."
      mode={mode} setMode={setMode} difficulty={difficulty} setDifficulty={setDifficulty}
      onCancel={() => navigate('/')} onStart={start} />
  );

  if (stage === 'results') {
    const acc = idx ? (correct / idx) * 100 : 0;
    return <ModuleResults title="Visual Search - Results"
      rows={[['Correct', `${correct} / ${idx}`], ['Accuracy', `${acc.toFixed(1)}%`]]}
      overallScore={acc} summary={responses} onRetry={() => setStage('menu')} onDashboard={() => navigate('/')} />;
  }

  return (
    <CBTReasonShell title="Visual Search - Instructions" testTag="VST"
      practice={mode === 'practice'} remaining={remaining}
      questionNum={idx + 1} questionCount={cfg.questionCount}>
      <div className="bg-[#000080] min-h-[430px] p-4 border border-[#000080]" style={bevelIn}>
        <div className="grid grid-cols-4 gap-x-4 gap-y-4 mx-auto w-max pt-1" data-testid="vs-grid">
          {tiles.map((tile, i) => (
            <TileImage
              key={`${tile.id}-${idx}-${i}`}
              tile={tile}
              testId={`vs-cell-${i}`}
              onClick={() => submit(tile.number)}
            />
          ))}
        </div>

        <div className="mt-20 flex justify-center">
          <TileImage tile={target} target testId="vs-target" />
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); submit(); }}
          className="mt-5 flex items-center justify-center gap-2"
        >
          <label className="text-white text-xs font-bold">Answer:</label>
          <input
            ref={inputRef}
            data-testid="vs-answer-input"
            value={input}
            onChange={e => setInput(e.target.value.replace(/[^\d]/g, '').slice(0, 2))}
            className="bg-[#000080] text-white border-b border-[#FFCC00] w-16 text-center font-mono text-lg focus:outline-none"
            autoFocus
          />
          <button data-testid="vs-submit" type="submit"
            className="bg-[#0000A0] text-white text-xs font-bold px-3 py-1 border-2 border-[#4444AA]">
            ENTER
          </button>
        </form>
      </div>
    </CBTReasonShell>
  );
};

export default VisualSearch;
