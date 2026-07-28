import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSettings, saveResult } from '../utils/storage';
import { formatTime, randInt, pick, shuffle, ModuleMenu, ModuleResults } from './cbtCommon';

// RAF System Logic:
// The real task presents an index of information tabs. Only two pages may be
// open at once, and questions require joining facts across pages.
const TABS = [
  {
    id: 0,
    title: 'Oil Flow',
    color: '#008000',
    kind: 'diagram',
    body: [
      'Oil flows from the Oil Tank into the Oil Lifter.',
      'The Oil Lifter supplies oil to the Oil Burner.',
      'The Oil Burner cannot draw oil directly from the Oil Tank.'
    ]
  },
  {
    id: 1,
    title: 'Oil Tank',
    color: '#800000',
    body: [
      'The main oil tank capacity is 300 litres.',
      'The reserve tank capacity is 150 litres.',
      'The reserve tank is only used when the main tank is empty.'
    ]
  },
  {
    id: 2,
    title: 'Oil Lifter',
    color: '#008000',
    body: [
      'Oil lifter uses a pump to store a small amount of oil in a 3-litre reservoir.',
      'Pump in oil lifter draws 0.1 litres every second until its reservoir is full.',
      'The pump stops automatically when the lifter reservoir is full.'
    ]
  },
  {
    id: 3,
    title: 'Oil Burner',
    color: '#800000',
    body: [
      'The oil burner consumes 3 litres of oil every hour.',
      'The oil burner is normally on for approximately 10 hours every day.',
      'The burner must be supplied by the lifter reservoir.'
    ]
  },
  {
    id: 4,
    title: 'Heat Zones',
    color: '#008000',
    body: [
      'Zone Alpha requires 2 heater units.',
      'Zone Bravo requires 3 heater units.',
      'Zone Charlie requires 4 heater units.'
    ]
  },
  {
    id: 5,
    title: 'Heater Units',
    color: '#800000',
    body: [
      'Each heater unit costs 12 credits per hour to operate.',
      'Only occupied zones require heater units.',
      'Unused zones are shut down overnight.'
    ]
  },
  {
    id: 6,
    title: 'Water Tank',
    color: '#008000',
    body: [
      'The water tank capacity is 240 litres.',
      'Cooling requires 8 litres of water per minute.',
      'The refill pump supplies 4 litres per minute.'
    ]
  },
  {
    id: 7,
    title: 'Cooling Loop',
    color: '#800000',
    body: [
      'The cooling loop runs for 15 minutes after every burner cycle.',
      'Water lost during cooling is replaced by the refill pump.',
      'Cooling cannot run if the tank contains less than 80 litres.'
    ]
  },
  {
    id: 8,
    title: 'Filter',
    color: '#008000',
    body: [
      'The filter removes 20 litres of oil sludge before replacement.',
      'Each 100 litres of burned oil produces 2 litres of sludge.',
      'A blocked filter stops the oil lifter.'
    ]
  },
  {
    id: 9,
    title: 'Valve A',
    color: '#800000',
    body: [
      'Valve A opens when the lifter reservoir reaches 2 litres.',
      'Valve A closes when reservoir level drops below 1 litre.',
      'Valve A feeds only the oil burner.'
    ]
  },
  {
    id: 10,
    title: 'Valve B',
    color: '#008000',
    body: [
      'Valve B opens only during maintenance mode.',
      'When Valve B is open, oil bypasses the burner.',
      'Maintenance mode lasts 20 minutes.'
    ]
  },
  {
    id: 11,
    title: 'Power Supply',
    color: '#800000',
    body: [
      'The pump draws 4 units of power.',
      'The oil burner draws 9 units of power.',
      'Maximum available system power is 15 units.'
    ]
  },
  {
    id: 12,
    title: 'Warning Rules',
    color: '#008000',
    body: [
      'A low oil warning appears below 40 litres.',
      'A high heat warning appears above 85 degrees.',
      'A pump warning appears if reservoir filling exceeds 45 seconds.'
    ]
  },
  {
    id: 13,
    title: 'Daily Schedule',
    color: '#800000',
    body: [
      'The burner starts at 08:00.',
      'The burner stops at 18:00.',
      'Maintenance mode starts at 22:00.'
    ]
  },
  {
    id: 14,
    title: 'Costs',
    color: '#008000',
    body: [
      'Oil costs 2 credits per litre.',
      'Water costs 1 credit per 10 litres.',
      'Power costs 3 credits per unit-hour.'
    ]
  }
];

const QUESTION_BANK = [
  {
    tabs: [1, 3],
    text: 'The oil burner is on for approximately 10 hours every day. How long would a full main tank of oil last?',
    answer: '10 days',
    distractors: ['5 days', '15 days', '30 days', '100 days']
  },
  {
    tabs: [2],
    text: 'How long does the pump take to fill an empty 3-litre lifter reservoir?',
    answer: '30 seconds',
    distractors: ['3 seconds', '15 seconds', '45 seconds', '60 seconds']
  },
  {
    tabs: [3, 14],
    text: 'How much does oil cost for one normal 10-hour burner day?',
    answer: '60 credits',
    distractors: ['30 credits', '90 credits', '120 credits', '300 credits']
  },
  {
    tabs: [4, 5],
    text: 'How many credits per hour are needed to heat Zone Bravo?',
    answer: '36 credits',
    distractors: ['12 credits', '24 credits', '48 credits', '60 credits']
  },
  {
    tabs: [6, 7],
    text: 'How much water is consumed during one 15-minute cooling loop before refill is considered?',
    answer: '120 litres',
    distractors: ['60 litres', '80 litres', '160 litres', '240 litres']
  },
  {
    tabs: [8, 3],
    text: 'After how many litres of burned oil must the 20-litre sludge filter be replaced?',
    answer: '1000 litres',
    distractors: ['100 litres', '200 litres', '500 litres', '2000 litres']
  },
  {
    tabs: [2, 12],
    text: 'If the lifter reservoir is empty, should a pump warning appear during a normal fill?',
    answer: 'No',
    distractors: ['Yes', 'Only below 40 litres', 'Only above 85 degrees', 'Only in maintenance']
  },
  {
    tabs: [11],
    text: 'Can the pump and oil burner operate together without exceeding maximum power?',
    answer: 'Yes',
    distractors: ['No', 'Only in maintenance', 'Only with Valve B open', 'Only when cooling runs']
  },
  {
    tabs: [10, 13],
    text: 'At what time does oil bypass the burner during the normal daily schedule?',
    answer: '22:00',
    distractors: ['08:00', '18:00', '20:00', 'Never']
  },
  {
    tabs: [9, 2],
    text: 'At what lifter reservoir level does Valve A first open?',
    answer: '2 litres',
    distractors: ['1 litre', '3 litres', '0.1 litres', '40 litres']
  }
];

const alpha = 'ABCDE';

const makeQuestion = () => {
  const item = pick(QUESTION_BANK);
  const options = shuffle([item.answer, ...item.distractors]).slice(0, 5);
  return {
    ...item,
    options,
    answerLetter: alpha[options.indexOf(item.answer)]
  };
};

const Panel = ({ tab }) => (
  <div className="border border-white bg-[#000060]" data-testid={`sl-panel-${tab.id}`}>
    <div className="text-white text-center text-sm py-0.5 border-b border-white" style={{ backgroundColor: tab.color }}>
      {tab.title}
    </div>
    <div className="p-2" style={{ backgroundColor: tab.color }}>
      <div
        className="bg-[#F3F0DE] text-black min-h-[210px] p-8 text-sm leading-relaxed border border-[#999]"
        style={{
          backgroundImage: 'radial-gradient(rgba(0,0,0,0.06) 0.7px, transparent 0.7px)',
          backgroundSize: '4px 4px'
        }}
      >
        {tab.kind === 'diagram' ? (
          <div className="h-full flex flex-col items-center justify-center">
            <div className="font-bold mb-6">Oil Flow</div>
            <svg viewBox="0 0 520 150" className="w-full max-w-[520px]">
              <defs>
                <marker id="sl-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                  <path d="M0,0 L0,6 L6,3 z" fill="#333" />
                </marker>
              </defs>
              <rect x="20" y="85" width="130" height="45" rx="4" fill="#DDD" stroke="#999" />
              <rect x="200" y="20" width="130" height="45" rx="4" fill="#DDD" stroke="#999" />
              <rect x="370" y="85" width="130" height="45" rx="4" fill="#DDD" stroke="#999" />
              <text x="85" y="112" textAnchor="middle" fontSize="13">Oil Tank</text>
              <text x="265" y="48" textAnchor="middle" fontSize="13">Oil Lifter</text>
              <text x="435" y="112" textAnchor="middle" fontSize="13">Oil Burner</text>
              <path d="M150 108 L250 108 L250 68" fill="none" stroke="#333" markerEnd="url(#sl-arrow)" />
              <path d="M285 68 L285 108 L370 108" fill="none" stroke="#333" markerEnd="url(#sl-arrow)" />
            </svg>
          </div>
        ) : (
          <ul className="list-disc pl-5 space-y-5">
            {tab.body.map((line) => <li key={line}>{line}</li>)}
          </ul>
        )}
      </div>
    </div>
  </div>
);

const SystemLogic = () => {
  const navigate = useNavigate();
  const [stage, setStage] = useState('menu');
  const [mode, setMode] = useState(null);
  const [difficulty, setDifficulty] = useState(null);
  const [cfg, setCfg] = useState(null);
  const [q, setQ] = useState(null);
  const [idx, setIdx] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [answer, setAnswer] = useState('');
  const [openTabs, setOpenTabs] = useState([1, 3]);
  const [tabsOpened, setTabsOpened] = useState(0);
  const [responses, setResponses] = useState([]);
  const timerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => () => timerRef.current && clearInterval(timerRef.current), []);

  const start = () => {
    const c = getSettings().systemLogic[difficulty];
    const first = makeQuestion();
    setCfg(c); setElapsed(0);
    setIdx(0); setCorrect(0); setTabsOpened(0);
    setResponses([]);
    setQ(first);
    setOpenTabs(first.tabs);
    setAnswer('');
    setStage('test');
    timerRef.current = setInterval(() => setElapsed(e => {
      if (e + 1 >= c.testDuration) { end(); return c.testDuration; }
      return e + 1;
    }), 1000);
    setTimeout(() => inputRef.current?.focus(), 60);
  };

  const end = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setStage('results');
  };

  const openTab = (id) => {
    setOpenTabs(prev => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id].slice(-2);
      return next;
    });
    setTabsOpened(v => v + 1);
  };

  const submit = (value = answer) => {
    const letter = String(value).trim().toUpperCase().slice(0, 1);
    if (!alpha.includes(letter)) return;
    const isRight = letter === q.answerLetter;
    setResponses(prev => [...prev, {
      prompt: q.question,
      detail: `Pages needed: ${q.tabs.map(id => TABS.find(t => t.id === id)?.title).filter(Boolean).join(', ')}`,
      given: `${letter}. ${q.options[alpha.indexOf(letter)] || ''}`,
      answer: `${q.answerLetter}. ${q.answer}`,
      correct: isRight
    }]);
    const newCorrect = isRight ? correct + 1 : correct;
    const newIdx = idx + 1;
    setCorrect(newCorrect);
    if (newIdx >= cfg.questionCount) { setIdx(newIdx); end(); return; }
    const next = makeQuestion();
    setIdx(newIdx);
    setQ(next);
    setOpenTabs(next.tabs);
    setAnswer('');
    setTimeout(() => inputRef.current?.focus(), 40);
  };

  useEffect(() => {
    if (stage === 'results' && mode === 'assessment' && idx > 0) {
      const acc = (correct / idx) * 100;
      saveResult('System Logic', mode, difficulty, { accuracy: acc, correct, total: idx, tabsOpened });
    }
  }, [stage]); // eslint-disable-line

  if (stage === 'menu') return (
    <ModuleMenu title="System Logic Test - Setup"
      description="Use the index to open information pages. Only two pages can be open at once. Join facts across the pages to answer each multiple-choice question."
      mode={mode} setMode={setMode} difficulty={difficulty} setDifficulty={setDifficulty}
      onCancel={() => navigate('/')} onStart={start} />
  );

  if (stage === 'results') {
    const acc = idx ? (correct / idx) * 100 : 0;
    return <ModuleResults title="System Logic - Results"
      rows={[['Correct', `${correct} / ${idx}`], ['Accuracy', `${acc.toFixed(1)}%`], ['Tabs Opened', String(tabsOpened)]]}
      overallScore={acc} summary={responses} onRetry={() => setStage('menu')} onDashboard={() => navigate('/')} />;
  }

  const remaining = Math.max(0, cfg.testDuration - elapsed);
  const visibleTabs = openTabs.map(id => TABS.find(t => t.id === id)).filter(Boolean);

  return (
    <div className="min-h-screen bg-[#000060] text-white flex flex-col"
      style={{ fontFamily: "'Arial', 'Helvetica', sans-serif" }}>
      <div className="text-center py-1 text-lg border-b border-white">
        System Logic Test - Instructions
      </div>

      <div className="flex-1 grid grid-cols-[1fr_220px] gap-2 p-2 pb-0 min-h-0">
        <div className="grid grid-rows-2 gap-2 min-h-0">
          {visibleTabs.map(tab => <Panel key={tab.id} tab={tab} />)}
          {visibleTabs.length < 2 && (
            <div className="border border-white bg-[#000030] flex items-center justify-center text-[#AACCFF]">
              Open another index page
            </div>
          )}
        </div>

        <div className="border border-white bg-[#555] p-2"
          style={{
            backgroundImage: 'linear-gradient(45deg, rgba(255,255,255,0.07) 25%, transparent 25%), linear-gradient(-45deg, rgba(255,255,255,0.05) 25%, transparent 25%)',
            backgroundSize: '6px 6px'
          }}
        >
          <div className="text-white text-center text-sm border-b border-[#AAA] pb-1 mb-3">Index</div>
          <div className="space-y-2">
            {TABS.map(tab => {
              const active = openTabs.includes(tab.id);
              return (
                <button
                  key={tab.id}
                  data-testid={`sl-tab-${tab.id}`}
                  onClick={() => openTab(tab.id)}
                  className={`w-full flex items-center gap-2 text-left text-sm ${active ? 'text-white' : 'text-[#E0E0E0] hover:text-white'}`}
                >
                  <span className="bg-white text-black font-bold font-mono px-1 min-w-6 text-center">{tab.id}</span>
                  <span>{tab.title}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="m-2 border border-white bg-black">
        <div className="px-2 py-2 font-mono text-sm" data-testid="sl-question-text">
          {q.text}
        </div>
        <div className="grid grid-cols-5 gap-3 px-3 pb-2">
          {q.options.map((opt, i) => (
            <button
              key={opt}
              data-testid={`sl-answer-${i}`}
              onClick={() => submit(alpha[i])}
              className="flex items-center gap-2 text-left font-mono text-sm hover:text-[#FFCC00]"
            >
              <span className="border border-white px-3 py-0.5 font-bold">{alpha[i]}</span>
              <span>{opt}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-black px-5 py-2 flex items-center justify-between border-t border-white">
        <div className="font-mono">Practice: {idx + 1} of {cfg.questionCount}</div>
        <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="flex items-center gap-3">
          <label className="text-[#FFCC00]">Answer :</label>
          <input
            ref={inputRef}
            data-testid="sl-answer-input"
            value={answer}
            onChange={e => {
              const v = e.target.value.toUpperCase().replace(/[^A-E]/g, '').slice(0, 1);
              setAnswer(v);
              if (v) setTimeout(() => submit(v), 40);
            }}
            className="bg-black text-white border-b border-[#FFCC00] w-16 text-center font-mono text-lg focus:outline-none uppercase"
            maxLength={1}
            autoFocus
          />
        </form>
        <div className="font-mono">Time Left: {formatTime(remaining)}</div>
      </div>
    </div>
  );
};

export default SystemLogic;
