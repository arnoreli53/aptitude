import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSettings, saveResult } from '../utils/storage';
import { cbtFont, formatClock, randInt,
         CBTPanel, CBTTestShell, ModuleMenu, ModuleResults } from './cbtCommon';

// RAF CBAT Vigilance Test
// - 9x9 grid, stars appear randomly.
// - White (routine) stars: eliminate by typing ROW then COL.
// - Yellow (priority) stars: eliminate ASAP for BONUS points.
// - Grid becomes more cluttered over time.
const Vigilance = () => {
  const navigate = useNavigate();
  const [stage, setStage] = useState('menu');
  const [mode, setMode] = useState(null);
  const [difficulty, setDifficulty] = useState(null);
  const [cfg, setCfg] = useState(null);
  const [grid, setGrid] = useState(Array(81).fill(null)); // null | 'routine' | 'priority'
  const [rowInput, setRowInput] = useState('');
  const [colInput, setColInput] = useState('');
  const [stats, setStats] = useState({ routineHits: 0, priorityHits: 0, misses: 0, wrong: 0, totalStars: 0, priorityMisses: 0 });
  const [responses, setResponses] = useState([]);
  const [elapsed, setElapsed] = useState(0);
  const [clockDisplay, setClockDisplay] = useState('00:00:00');
  const timerRef = useRef(null);
  const spawnRef = useRef(null);
  const rowInputRef = useRef(null);
  const colInputRef = useRef(null);
  const statsRef = useRef({ routineHits: 0, priorityHits: 0, misses: 0, wrong: 0, totalStars: 0, priorityMisses: 0 });
  const gridRef = useRef(Array(81).fill(null));

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (spawnRef.current) clearInterval(spawnRef.current);
  }, []);

  const spawnStar = () => {
    // Find empty cell
    const emptyCells = [];
    gridRef.current.forEach((v, i) => { if (v === null) emptyCells.push(i); });
    if (emptyCells.length === 0) return;
    const idx = emptyCells[Math.floor(Math.random() * emptyCells.length)];
    const isPriority = Math.random() < 0.2;
    const type = isPriority ? 'priority' : 'routine';
    gridRef.current[idx] = { type, at: Date.now() };
    setGrid([...gridRef.current]);
    statsRef.current.totalStars += 1;
    setStats({ ...statsRef.current });

    // Priority stars expire quickly (worth bonus but time-limited)
    if (isPriority) {
      setTimeout(() => {
        if (gridRef.current[idx] && gridRef.current[idx].type === 'priority') {
          gridRef.current[idx] = null;
          setGrid([...gridRef.current]);
          statsRef.current.priorityMisses += 1;
          statsRef.current.misses += 1;
          setStats({ ...statsRef.current });
        }
      }, 6000);
    }
  };

  const start = () => {
    const c = getSettings().vigilance[difficulty];
    setCfg(c); setElapsed(0);
    gridRef.current = Array(81).fill(null);
    setGrid([...gridRef.current]);
    setRowInput(''); setColInput('');
    setResponses([]);
    statsRef.current = { routineHits: 0, priorityHits: 0, misses: 0, wrong: 0, totalStars: 0, priorityMisses: 0 };
    setStats({ ...statsRef.current });
    setStage('test');
    timerRef.current = setInterval(() => {
      setElapsed(e => {
        const ne = e + 1;
        setClockDisplay(formatClock(new Date()));
        if (ne >= c.testDuration) { end(); return c.testDuration; }
        return ne;
      });
    }, 1000);
    spawnRef.current = setInterval(spawnStar, c.refreshInterval * 1000);
  };

  useEffect(() => {
    if (stage !== 'test') return;
    const frame = requestAnimationFrame(() => rowInputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [stage]);

  const end = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (spawnRef.current) clearInterval(spawnRef.current);
    setStage('results');
  };

  const focusRowInput = () => {
    requestAnimationFrame(() => rowInputRef.current?.focus());
  };

  const submit = () => {
    const r = parseInt(rowInput, 10);
    const c = parseInt(colInput, 10);
    if (!(r >= 1 && r <= 9 && c >= 1 && c <= 9)) {
      setRowInput('');
      setColInput('');
      focusRowInput();
      return;
    }
    const idx = (r - 1) * 9 + (c - 1);
    const cell = gridRef.current[idx];
    setResponses(prev => [...prev, {
      prompt: `Enter row/column coordinate`,
      given: `${r},${c}`,
      answer: cell ? `${cell.type} star at ${r},${c}` : 'A coordinate containing a star',
      correct: Boolean(cell)
    }]);
    if (cell) {
      if (cell.type === 'priority') statsRef.current.priorityHits += 1;
      else                          statsRef.current.routineHits += 1;
      gridRef.current[idx] = null;
      setGrid([...gridRef.current]);
    } else {
      statsRef.current.wrong += 1;
    }
    setStats({ ...statsRef.current });
    setRowInput(''); setColInput('');
    focusRowInput();
  };

  const handleRowKeyDown = (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    if (rowInput) colInputRef.current?.focus();
  };

  const handleColKeyDown = (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    submit();
  };

  useEffect(() => {
    if (stage === 'results' && mode === 'assessment') {
      // Priority stars = 3 points, routine = 1, wrong = -1, priority miss = -1
      const raw = statsRef.current.priorityHits * 3 + statsRef.current.routineHits - statsRef.current.wrong - statsRef.current.priorityMisses;
      const maxRaw = statsRef.current.totalStars * 1.5;
      const acc = maxRaw > 0 ? Math.max(0, Math.min(100, (raw / maxRaw) * 100)) : 0;
      saveResult('Vigilance', mode, difficulty, {
        accuracy: acc,
        routineHits: statsRef.current.routineHits,
        priorityHits: statsRef.current.priorityHits,
        wrong: statsRef.current.wrong,
        priorityMisses: statsRef.current.priorityMisses,
        totalStars: statsRef.current.totalStars
      });
    }
  }, [stage]); // eslint-disable-line

  if (stage === 'menu') return (
    <ModuleMenu title="Vigilance Test - Setup"
      description="A 9×9 grid will fill with stars. Eliminate each star by entering its ROW then COLUMN. YELLOW priority stars are worth 3× and disappear quickly — hit them ASAP! White routine stars are worth 1×. Wrong coordinates lose points."
      mode={mode} setMode={setMode} difficulty={difficulty} setDifficulty={setDifficulty}
      onCancel={() => navigate('/')} onStart={start} />
  );

  if (stage === 'results') {
    const raw = stats.priorityHits * 3 + stats.routineHits - stats.wrong - stats.priorityMisses;
    const maxRaw = stats.totalStars * 1.5;
    const acc = maxRaw > 0 ? Math.max(0, Math.min(100, (raw / maxRaw) * 100)) : 0;
    return <ModuleResults title="Vigilance - Results"
      rows={[
        ['Total Stars',       String(stats.totalStars)],
        ['Routine Hits',      `${stats.routineHits} (× 1 pt)`],
        ['Priority Hits',     `${stats.priorityHits} (× 3 pts)`],
        ['Wrong Coord',       String(stats.wrong)],
        ['Priority Misses',   String(stats.priorityMisses)],
        ['Score',             `${raw} / ${Math.round(maxRaw)}`]
      ]}
      overallScore={acc} summary={responses} onRetry={() => setStage('menu')} onDashboard={() => navigate('/')} />;
  }

  const remaining = Math.max(0, cfg.testDuration - elapsed);

  return (
    <CBTTestShell title="Vigilance Test - Testing" warnings={[]} clockDisplay={clockDisplay}
      mode={mode} difficulty={difficulty} elapsed={elapsed} remaining={remaining}>
      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,1fr)_230px]">
        <div className="min-w-0">
          <CBTPanel title="Scan Matrix - Eliminate ALL stars">
            <div className="bg-black p-2 border border-[#4444AA]">
              <table className="w-full table-fixed border-collapse font-mono text-sm" data-testid="vg-grid">
                <thead>
                  <tr>
                    <th className="h-8 w-10 bg-[#000060] text-white"></th>
                    {Array.from({ length: 9 }, (_, i) => (
                      <th key={i} className="h-8 border border-[#333] bg-[#000060] px-1 text-white">{i + 1}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 9 }, (_, r) => (
                    <tr key={r}>
                      <th className="h-[52px] border border-[#333] bg-[#000060] px-1 text-white">{r + 1}</th>
                      {Array.from({ length: 9 }, (_, c) => {
                        const idx = r * 9 + c;
                        const cell = grid[idx];
                        return (
                          <td key={c} className="relative h-[52px] border border-[#333] bg-[#000018] text-center">
                            {cell && (
                              <span className={`text-3xl font-bold leading-none ${cell.type === 'priority' ? 'text-[#FFCC00] animate-pulse' : 'text-white'}`}
                                data-testid={`vg-star-${r + 1}-${c + 1}`}>✱</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CBTPanel>
        </div>
        <div className="space-y-2">
          <CBTPanel title="Enter Coordinates">
            <div className="text-white text-xs mb-2">
              Type ROW → COL (1-9). Press ENTER.
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-[#AACCFF] mb-1">Row</label>
                <input ref={rowInputRef} data-testid="vg-row-input" value={rowInput}
                  onChange={e => setRowInput(e.target.value.replace(/[^1-9]/g, '').slice(0, 1))}
                  onKeyDown={handleRowKeyDown}
                  className="w-full bg-black text-white font-mono text-lg px-2 py-1 border border-white text-center focus:outline-none" autoFocus />
              </div>
              <div>
                <label className="block text-[10px] text-[#AACCFF] mb-1">Col</label>
                <input ref={colInputRef} data-testid="vg-col-input" value={colInput}
                  onChange={e => setColInput(e.target.value.replace(/[^1-9]/g, '').slice(0, 1))}
                  onKeyDown={handleColKeyDown}
                  className="w-full bg-black text-white font-mono text-lg px-2 py-1 border border-white text-center focus:outline-none" />
              </div>
            </div>
            <button data-testid="vg-submit-loc" onClick={submit}
              className="w-full mt-2 bg-[#008000] text-white py-1 text-xs font-bold border-2 border-[#00B000]">
              ELIMINATE STAR
            </button>
          </CBTPanel>
          <CBTPanel title="Score">
            <div className="text-white text-[11px] space-y-0.5 font-mono">
              <div className="flex justify-between"><span className="text-[#AACCFF]">Total Stars</span><span data-testid="vg-total">{stats.totalStars}</span></div>
              <div className="flex justify-between"><span className="text-white">Routine ✓</span><span className="text-[#00FF00]" data-testid="vg-routine">{stats.routineHits}</span></div>
              <div className="flex justify-between"><span className="text-[#FFCC00]">Priority ✓ (3×)</span><span className="text-[#FFCC00]" data-testid="vg-priority">{stats.priorityHits}</span></div>
              <div className="flex justify-between"><span className="text-[#FF6666]">Wrong Coord</span><span className="text-[#FF3333]" data-testid="vg-wrong">{stats.wrong}</span></div>
              <div className="flex justify-between"><span className="text-[#FF6666]">Priority Miss</span><span className="text-[#FF3333]" data-testid="vg-priority-miss">{stats.priorityMisses}</span></div>
            </div>
          </CBTPanel>
          <div className="bg-[#000030] border border-[#4444AA] p-2 text-[10px] text-[#AACCFF]">
            <div className="text-[#FFCC00] font-bold mb-0.5">TIP</div>
            Priority (yellow) stars expire in 6s. Hit them first!
          </div>
        </div>
      </div>
    </CBTTestShell>
  );
};

export default Vigilance;
