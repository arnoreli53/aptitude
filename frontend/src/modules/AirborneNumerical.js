import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSettings, saveResult } from '../utils/storage';
import { formatTime, randInt, pick,
         ModuleMenu } from './cbtCommon';

// Airborne Numerical Test — aligned to the RAF CBAT ANT guide screenshot.
// Layout:
//   - Dark navy background (#000060)
//   - Top blue bar: "Airborne Numerical Test - Instructions"
//   - Left column: Menu (2 items) + Green instruction box + Green Speed=Distance/Time box
//   - Right column: White grid map + Black Mission/Task box + Green Journey table
//   - Bottom bar: Practice x of y | Answer (Time) : [HHMM boxes] | Time Left MM:SS

const NODES = ['Victor', 'Xray', 'Yankee', 'Zulu', 'Whiskey'];

// Fixed geometric positions on the white map to mimic the screenshot
const POSITIONS = {
  Victor:  { x: 155, y: 205 },
  Xray:    { x: 415, y: 105 },
  Yankee:  { x: 555, y: 205 },
  Zulu:    { x: 645, y: 305 },
  Whiskey: { x: 355, y: 355 }
};

// Distances between adjacent nodes from the RAF ANT reference map.
const BASE_EDGES = {
  'Victor|Xray':    81,
  'Xray|Yankee':    42,
  'Victor|Yankee':  68,
  'Victor|Whiskey': 59,
  'Whiskey|Zulu':   71,
  'Yankee|Zulu':    36
};

const getDist = (edges, a, b) => edges[`${a}|${b}`] || edges[`${b}|${a}`] || null;

// Internal speed options, expressed in miles per minute.
const SPEED_WEIGHT_ROWS = [
  { weight: 100, mpm: 1 },
  { weight: 200, mpm: 2 },
  { weight: 300, mpm: 3 },
  { weight: 400, mpm: 4 },
  { weight: 500, mpm: 5 },
  { weight: 600, mpm: 6 },
  { weight: 700, mpm: 7 }
];

const FUEL_ROWS = [
  { speedMpm: 1, fuelLpm: 0.4 },
  { speedMpm: 2, fuelLpm: 0.7 },
  { speedMpm: 3, fuelLpm: 1.1 },
  { speedMpm: 4, fuelLpm: 1.6 },
  { speedMpm: 5, fuelLpm: 2.2 },
  { speedMpm: 6, fuelLpm: 2.9 },
  { speedMpm: 7, fuelLpm: 3.7 }
];

const ROUTES = [
  ['Yankee', 'Zulu', 'Whiskey'],
  ['Whiskey', 'Zulu', 'Yankee'],
  ['Victor', 'Yankee', 'Zulu'],
  ['Victor', 'Whiskey', 'Zulu'],
  ['Xray', 'Yankee', 'Zulu'],
  ['Victor', 'Xray', 'Yankee'],
  ['Xray', 'Victor', 'Whiskey'],
  ['Zulu', 'Yankee', 'Xray']
];

const QUESTION_TYPES = ['arrival', 'latestDeparture', 'journeyTime', 'fuelUsed'];

const makeQuestionEdges = () => Object.fromEntries(
  Object.entries(BASE_EDGES).map(([key, value]) => [key, Math.max(24, value + randInt(-18, 18))])
);
const makeFuelRows = () => FUEL_ROWS.map((row) => ({
  ...row,
  fuelLpm: Number(Math.max(0.2, row.fuelLpm + randInt(-2, 3) / 10).toFixed(1))
}));

const minutesToClock = (minutes) => {
  const wrapped = ((minutes % (24 * 60)) + (24 * 60)) % (24 * 60);
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return { h, m, str: `${String(h).padStart(2, '0')}${String(m).padStart(2, '0')}` };
};

const formatClockValue = ({ h, m }) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
const parseClockAnswer = (value) => {
  if (!/^\d{4}$/.test(value)) return null;
  const h = Number(value.slice(0, 2));
  const m = Number(value.slice(2));
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
};
const formatAnswerForDisplay = (value, label) => {
  if (!value) return 'No answer';
  if (label === 'Time' && /^\d{4}$/.test(value)) return `${value.slice(0, 2)}:${value.slice(2)}`;
  return value;
};
const minuteDifference = (question, given) => {
  if (!given) return null;
  if (['journeyTime', 'fuelUsed'].includes(question.questionType)) {
    const n = Number(given);
    if (!Number.isFinite(n)) return null;
    return Math.abs(n - Number(question.answer));
  }
  const givenMinutes = parseClockAnswer(given);
  if (givenMinutes == null) return null;
  const correctMinutes = question.answerMinutes;
  const raw = Math.abs(givenMinutes - correctMinutes);
  return Math.min(raw, (24 * 60) - raw);
};
const scoreFromDifference = (diff) => {
  if (diff == null) return 0;
  if (diff >= 5) return 0;
  return Math.max(0, 100 - diff * 10);
};
const scoreAnswer = (question, given) => {
  const diff = minuteDifference(question, given);
  return { diff, score: scoreFromDifference(diff), correct: diff === 0 };
};
const differenceText = (question, given) => {
  if (!given) return 'No answer';
  const diff = minuteDifference(question, given);
  if (diff == null) return question.answerLabel === 'Time' ? 'Invalid time' : 'Invalid';
  const unit = question.questionType === 'fuelUsed'
    ? 'L'
    : 'min';
  return `${diff} ${unit}`;
};

const generateQuestion = () => {
  const edges = makeQuestionEdges();
  const speedRows = SPEED_WEIGHT_ROWS.map((row) => ({ ...row }));
  const fuelRows = makeFuelRows();
  const speedRow = pick(speedRows);
  const weight = speedRow.weight;
  const speedMpm = speedRow.mpm;
  const fuelLpm = fuelRows.find((row) => row.speedMpm === speedMpm)?.fuelLpm || pick(fuelRows).fuelLpm;
  const path = pick(ROUTES);
  const start = path[0];
  const dest = path[path.length - 1];
  const questionType = pick(QUESTION_TYPES);
  const weatherSegment = questionType === 'fuelUsed' ? null : (Math.random() < 0.25 ? randInt(0, path.length - 2) : null);

  // Total distance along path
  let totalDist = 0;
  let journeyMin = 0;
  const segments = [];
  for (let i = 0; i < path.length - 1; i++) {
    const d = getDist(edges, path[i], path[i + 1]);
    const segmentDist = d != null ? d : 60;
    totalDist += segmentDist;
    const segmentSpeed = weatherSegment === i ? speedMpm * 0.5 : speedMpm;
    const rawMinutes = segmentDist / segmentSpeed;
    journeyMin += rawMinutes;
    segments.push({
      from: path[i],
      to: path[i + 1],
      distance: segmentDist,
      speed: segmentSpeed,
      weather: weatherSegment === i,
      rawMinutes
    });
  }
  journeyMin = Math.round(journeyMin);
  const fuelUsed = Math.round(journeyMin * fuelLpm);

  const nowH = randInt(6, 20);
  const nowM = randInt(0, 59);
  const nowMinutes = nowH * 60 + nowM;
  const arrival = minutesToClock(nowMinutes + journeyMin);
  const latestDeparture = minutesToClock(nowMinutes - journeyMin);

  const answer =
    questionType === 'arrival' ? arrival.str :
    questionType === 'latestDeparture' ? latestDeparture.str :
    questionType === 'fuelUsed' ? String(fuelUsed) :
    String(journeyMin);
  const answerMinutes =
    questionType === 'arrival' ? ((nowMinutes + journeyMin) % (24 * 60)) :
    questionType === 'latestDeparture' ? (((nowMinutes - journeyMin) % (24 * 60)) + (24 * 60)) % (24 * 60) :
    journeyMin;
  const calculation = [
    `Speed & Parcel Weight chart: ${weight} kg = ${speedMpm} miles per minute.`,
    ...(questionType === 'fuelUsed'
      ? [`Speed & Fuel Consumption table: ${speedMpm} miles per minute = ${fuelLpm} L per minute.`]
      : []),
    ...segments.map((s) => `${s.from} to ${s.to}: ${s.distance} miles / ${s.speed}${s.weather ? ' miles per minute (50% bad weather speed)' : ' miles per minute'} = ${s.rawMinutes.toFixed(1)} minutes.`),
    `Total journey time = ${segments.map((s) => s.rawMinutes.toFixed(1)).join(' + ')} = ${journeyMin} minutes after rounding.`,
    questionType === 'arrival'
      ? `Arrival time = ${formatClockValue({ h: nowH, m: nowM })} + ${journeyMin} minutes = ${formatClockValue(arrival)}.`
      : questionType === 'latestDeparture'
        ? `Latest departure = ${formatClockValue({ h: nowH, m: nowM })} - ${journeyMin} minutes = ${formatClockValue(latestDeparture)}.`
        : questionType === 'fuelUsed'
          ? `Fuel used = ${journeyMin} minutes x ${fuelLpm} L per minute = ${fuelUsed} L after rounding.`
        : `Answer = ${journeyMin} minutes.`
  ];

  return {
    edges, speedRows, fuelRows, weight, speedMpm, fuelLpm, start, dest, path, totalDist,
    weatherSegment, questionType, journeyMin, fuelUsed, segments, calculation, answerMinutes,
    timeNow: { h: nowH, m: nowM },
    arrival, latestDeparture,
    answer,
    answerLabel: questionType === 'journeyTime' ? 'Minutes' : questionType === 'fuelUsed' ? 'Litres' : 'Time',
    taskText:
      questionType === 'arrival' ? 'Calculate arrival time.' :
      questionType === 'latestDeparture' ? 'Calculate latest departure time.' :
      questionType === 'fuelUsed' ? 'Calculate fuel used.' :
      'Calculate journey time.'
  };
};

const AirborneNumerical = () => {
  const navigate = useNavigate();
  const [stage, setStage] = useState('menu');
  const [mode, setMode] = useState(null);
  const [difficulty, setDifficulty] = useState(null);
  const [cfg, setCfg] = useState(null);
  const [q, setQ] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [responses, setResponses] = useState([]);
  const [idx, setIdx] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [scoreTotal, setScoreTotal] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [answerBuf, setAnswerBuf] = useState('');
  const [tab, setTab] = useState('intro'); // intro | fuel | weight
  const timerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => () => timerRef.current && clearInterval(timerRef.current), []);

  const start = () => {
    const c = getSettings().airborneNumerical[difficulty];
    const generated = Array.from({ length: c.questionCount }, () => generateQuestion());
    setCfg(c); setRemaining(c.testDuration);
    setIdx(0); setCorrect(0); setScoreTotal(0); setQuestions(generated); setResponses([]); setQ(generated[0]);
    setAnswerBuf('');
    setStage('test');
    timerRef.current = setInterval(() => setRemaining(r => (r <= 1 ? (end(), 0) : r - 1)), 1000);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const end = () => { if (timerRef.current) clearInterval(timerRef.current); setStage('results'); };

  const submit = () => {
    if (answerBuf.length !== q.answer.length) return;
    const graded = scoreAnswer(q, answerBuf);
    const isRight = graded.correct;
    const newCorrect = isRight ? correct + 1 : correct;
    const newScoreTotal = scoreTotal + graded.score;
    const newIdx = idx + 1;
    setCorrect(newCorrect);
    setScoreTotal(newScoreTotal);
    setResponses(prev => {
      const next = [...prev];
      next[idx] = { given: answerBuf, correct: isRight, diff: graded.diff, score: graded.score };
      return next;
    });
    setAnswerBuf('');
    if (newIdx >= cfg.questionCount) { setIdx(newIdx); end(); return; }
    setIdx(newIdx); setQ(questions[newIdx]);
    setTimeout(() => inputRef.current?.focus(), 30);
  };

  const handleKey = (e) => {
    if (e.key === 'Enter') { submit(); return; }
    if (/^[0-9]$/.test(e.key) && q && answerBuf.length < q.answer.length) setAnswerBuf(v => v + e.key);
  };

  useEffect(() => {
    if (stage === 'results' && mode === 'assessment' && idx > 0) {
      const totalQuestions = questions.length || idx;
      const acc = totalQuestions ? (scoreTotal / totalQuestions) : 0;
      saveResult('Airborne Numerical', mode, difficulty, { accuracy: acc, correct, total: idx, scoreTotal, totalQuestions });
    }
  }, [stage]); // eslint-disable-line

  if (stage === 'menu') return (
    <ModuleMenu title="Airborne Numerical Test - Setup"
      description="You operate a Remote Controlled Aerial Vehicle delivering parcels. Use the map, mission data, and fuel-consumption table to calculate arrival times, latest departure times, journey durations, or fuel used. Round answers to whole numbers."
      mode={mode} setMode={setMode} difficulty={difficulty} setDifficulty={setDifficulty}
      onCancel={() => navigate('/')} onStart={start} />
  );

  if (stage === 'results') {
    const totalQuestions = questions.length || idx;
    const acc = totalQuestions ? (scoreTotal / totalQuestions) : 0;
    return (
      <div className="min-h-screen bg-[#000060] text-white p-4" style={{ fontFamily: "'Arial', 'Helvetica', sans-serif" }}>
        <div className="max-w-[1180px] mx-auto border border-[#4444AA] bg-[#000030]">
          <div className="bg-[#0000B0] text-white text-center py-1 text-sm font-bold">Airborne Numerical - Test Summary</div>
          <div className="p-4">
            <div className="grid grid-cols-3 gap-2 mb-4 text-sm">
              <div className="bg-[#000050] border border-[#4444AA] p-2">Exact: <span className="font-mono">{correct} / {totalQuestions}</span></div>
              <div className="bg-[#000050] border border-[#4444AA] p-2">Average Score: <span className="font-mono">{acc.toFixed(1)}%</span></div>
              <div className="bg-[#000050] border border-[#4444AA] p-2">Questions Generated: <span className="font-mono">{questions.length}</span></div>
            </div>

            <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-2">
              {questions.map((question, i) => {
                const response = responses[i];
                const answered = Boolean(response);
                const given = response?.given || '';
                const correctAnswer = question.answer;
                const graded = response || { score: 0, diff: null, correct: false };
                const isCorrect = graded.correct === true;
                const scoreUnit = question.answerLabel === 'Time' || question.answerLabel === 'Minutes'
                  ? 'min'
                  : question.answerLabel === 'Litres'
                    ? 'L'
                    : 'miles per minute';
                return (
                  <div key={i} className="bg-[#000050] border border-[#4444AA]" data-testid={`ant-summary-${i}`}>
                    <div className={`px-3 py-1 text-sm font-bold flex justify-between ${isCorrect ? 'bg-[#006000]' : answered ? 'bg-[#800000]' : 'bg-[#606000]'}`}>
                      <span>Question {i + 1}: {question.taskText}</span>
                      <span>{answered ? `${graded.score} / 100` : 'UNANSWERED - 0 / 100'}</span>
                    </div>
                    <div className="p-3 grid grid-cols-[1fr_320px] gap-4 text-sm">
                      <div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 mb-3">
                          <div>Route: <span className="font-mono">{question.path.join(' → ')}</span></div>
                          <div>Distance: <span className="font-mono">{question.totalDist} miles</span></div>
                          <div>Parcel Weight: <span className="font-mono">{question.weight} kg</span></div>
                          <div>Speed: <span className="font-mono">{question.speedMpm} miles per minute</span></div>
                          <div>Fuel Rate: <span className="font-mono">{question.fuelLpm} L per minute</span></div>
                          <div>{question.questionType === 'latestDeparture' ? 'Required Arrival' : 'Time Now'}: <span className="font-mono">{formatClockValue(question.timeNow)}</span></div>
                          <div>Weather: <span className="font-mono">{question.weatherSegment == null ? 'None' : `${question.path[question.weatherSegment]} to ${question.path[question.weatherSegment + 1]} at 50% speed`}</span></div>
                        </div>
                        <div className="bg-black border border-[#4444AA] p-2">
                          <div className="font-bold mb-1">Calculation</div>
                          {question.calculation.map((line, lineIdx) => (
                            <div key={lineIdx} className="font-mono text-xs leading-relaxed">{line}</div>
                          ))}
                        </div>
                      </div>
                      <div className="bg-black border border-[#4444AA] p-2 space-y-2">
                        <div className="flex justify-between">
                          <span>Your Answer</span>
                          <span className="font-mono" data-testid={`ant-summary-given-${i}`}>{formatAnswerForDisplay(given, question.answerLabel)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Correct Answer</span>
                          <span className="font-mono" data-testid={`ant-summary-correct-${i}`}>{formatAnswerForDisplay(correctAnswer, question.answerLabel)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Difference</span>
                          <span className="font-mono" data-testid={`ant-summary-diff-${i}`}>{differenceText(question, given)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Question Score</span>
                          <span className="font-mono" data-testid={`ant-summary-score-${i}`}>{graded.score} / 100</span>
                        </div>
                        <div className="text-xs text-[#CCCC00] pt-2">
                          0 {scoreUnit} difference = 100, 1 = 90, 2 = 80, 3 = 70, 4 = 60, 5+ = 0.
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="bg-[#000030] p-3 border-t border-[#4444AA] flex justify-end gap-2">
            <button data-testid="return-menu-btn" onClick={() => setStage('menu')} className="text-white text-sm font-bold py-1 px-4 border-2 border-[#4444AA] bg-[#0000A0] hover:bg-[#0000CC]">Try Again</button>
            <button data-testid="return-dashboard-btn" onClick={() => navigate('/')} className="text-white text-sm font-bold py-1 px-4 border-2 border-[#4444AA] bg-[#0000A0] hover:bg-[#0000CC]">Dashboard</button>
          </div>
        </div>
      </div>
    );
  }

  const pathSet = new Set();
  for (let i = 0; i < q.path.length - 1; i++) {
    pathSet.add([q.path[i], q.path[i + 1]].sort().join('|'));
  }

  return (
    <div className="min-h-screen bg-[#000060] flex flex-col"
      style={{ fontFamily: "'Arial', 'Helvetica', sans-serif" }}
      tabIndex={0} onKeyDown={handleKey} ref={el => el && el.focus()}>
      {/* HEADER BAR */}
      <div className="bg-[#000060] text-white text-center py-1.5 text-sm border-b border-[#4444AA]">
        Airborne Numerical Test - Instructions
      </div>

      {/* MAIN AREA */}
      <div className="flex-1 grid grid-cols-2 gap-4 p-4">
        {/* LEFT COLUMN */}
        <div className="text-white space-y-4">
          {/* Menu */}
          <div>
            <div className="underline text-sm font-bold mb-2">Menu</div>
            <div className="space-y-1.5 text-sm">
              <button data-testid="an-menu-intro" onClick={() => setTab('intro')}
                className={`flex items-center gap-2 text-left ${tab === 'intro' ? 'font-bold' : ''}`}>
                <span className="inline-block w-4 h-4" style={{ backgroundColor: '#FFB0B0', border: '1px solid black' }}></span>
                <span>Introduction</span>
              </button>
              <button data-testid="an-menu-fuel" onClick={() => setTab('fuel')}
                className={`flex items-center gap-2 text-left ${tab === 'fuel' ? 'font-bold' : ''}`}>
                <span className="inline-block w-4 h-4" style={{ backgroundColor: '#8B4513', border: '1px solid black' }}></span>
                <span>Speed and Fuel Consumption</span>
              </button>
              <button data-testid="an-menu-weight" onClick={() => setTab('weight')}
                className={`flex items-center gap-2 text-left ${tab === 'weight' ? 'font-bold' : ''}`}>
                <span className="inline-block w-4 h-4" style={{ backgroundColor: '#8CC8EA', border: '1px solid black' }}></span>
                <span>Speed and Parcel Weight</span>
              </button>
            </div>
          </div>

          {/* Green content box */}
          <div className="bg-[#4C6B2F] text-white p-3 text-[13px] leading-snug border border-black" data-testid="an-content-box">
            {tab === 'intro' && (
              <>
                <p className="mb-2">You are the operator of a large Remote Controlled Aerial Vehicle.</p>
                <p className="mb-2">The Aerial Vehicle operates as part of a high-tech mail delivery service.</p>
                <p className="mb-2">Always assume refuelling and deliveries and collections take no time.</p>
                <p className="mb-2">Answer in whole numbers only. Always round up if the number is 0.5 or greater and round down if the answer is 0.49 or less.</p>
                <p>Work as quickly and as accurately as possible. However you will be given marks for estimated answers.</p>
              </>
            )}
            {tab === 'fuel' && (
              <>
                <div className="font-bold mb-2">Speed and Fuel Consumption</div>
                <table className="w-full text-[12px]">
                  <thead><tr><th className="border border-black px-1">Speed<br/>(miles per minute)</th><th className="border border-black px-1">Fuel<br/>(L per minute)</th></tr></thead>
                  <tbody>
                    {q.fuelRows.map(r => (
                      <tr key={r.speedMpm}><td className="border border-black text-center">{r.speedMpm}</td><td className="border border-black text-center">{r.fuelLpm}</td></tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
            {tab === 'weight' && (
              <div className="bg-white text-black" data-testid="an-speed-weight-chart">
                <svg viewBox="0 0 650 510" className="block h-auto w-full" role="img" aria-labelledby="ant-weight-chart-title">
                  <title id="ant-weight-chart-title">Speed and Parcel Weight bar chart</title>
                  <rect width="650" height="510" fill="white" />
                  <line x1="145" y1="45" x2="145" y2="390" stroke="black" strokeWidth="7" />
                  <line x1="145" y1="390" x2="585" y2="390" stroke="black" strokeWidth="7" />
                  {q.speedRows.map((row, index) => {
                    const x = 145 + index * 63;
                    const barHeight = row.mpm * 49;
                    const y = 390 - barHeight;
                    return (
                      <g key={row.weight}>
                        <line x1="120" y1={y} x2="145" y2={y} stroke="black" strokeWidth="7" />
                        <text x="108" y={y + 8} fontSize="24" fontWeight="700" textAnchor="end">{row.mpm}</text>
                        <rect
                          x={x}
                          y={y}
                          width="63"
                          height={barHeight}
                          fill={index % 2 === 0 ? '#8E8E8E' : '#B7B7B7'}
                          stroke="black"
                          strokeWidth="1.5"
                        />
                        <line x1={x + 63} y1="390" x2={x + 63} y2="418" stroke="black" strokeWidth="7" />
                        <text x={x + 31.5} y="425" fontSize="22" fontWeight="700" textAnchor="middle">{row.weight}</text>
                      </g>
                    );
                  })}
                  <text x="55" y="250" fontSize="25" fontWeight="700" textAnchor="middle" transform="rotate(-90 55 250)">MILES PER MINUTE</text>
                  <text x="365" y="485" fontSize="25" fontWeight="700" textAnchor="middle">PARCEL WEIGHT (KG)</text>
                </svg>
              </div>
            )}
          </div>

          {/* Speed formula box */}
          <div className="bg-[#4C6B2F] text-white px-4 py-3 inline-block border border-black text-lg font-serif" data-testid="an-formula">
            Speed = <span className="inline-block align-middle">
              <div className="border-b border-white px-2">Distance</div>
              <div className="text-center px-2">Time</div>
            </span>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-3">
          {/* White map */}
          <div className="bg-white border border-black relative" style={{ aspectRatio: '2/1' }} data-testid="an-map">
            {/* Grid */}
            <svg viewBox="0 0 800 400" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
              <defs>
                <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#DDDDDD" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="800" height="400" fill="url(#grid)" />

              {/* All edges + labels */}
              {Object.entries(q.edges).map(([k, d]) => {
                const [a, b] = k.split('|');
                const pa = POSITIONS[a];
                const pb = POSITIONS[b];
                const onPath = pathSet.has(k);
                const weatherEdge = q.weatherSegment != null
                  ? [q.path[q.weatherSegment], q.path[q.weatherSegment + 1]].sort().join('|')
                  : null;
                const hasWeather = weatherEdge === k;
                const mx = (pa.x + pb.x) / 2;
                const my = (pa.y + pb.y) / 2;
                return (
                  <g key={k}>
                    {onPath ? (
                      <>
                        <line x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke={hasWeather ? '#D08000' : 'black'} strokeWidth="4"
                          strokeDasharray={hasWeather ? '10 6' : undefined} />
                      </>
                    ) : (
                      <line x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke="black" strokeWidth="1" />
                    )}
                    <text x={mx} y={my - 6} fill={hasWeather ? '#A06000' : 'black'} fontSize="18" textAnchor="middle" fontWeight="normal" fontFamily="serif">{d}</text>
                    {hasWeather && <text x={mx} y={my + 14} fill="#A06000" fontSize="13" textAnchor="middle" fontFamily="serif">Bad weather 50%</text>}
                  </g>
                );
              })}
              {/* Path arrows overlay */}
              {q.path.map((n, i) => {
                if (i === q.path.length - 1) return null;
                const pa = POSITIONS[n];
                const pb = POSITIONS[q.path[i + 1]];
                const dx = pb.x - pa.x, dy = pb.y - pa.y;
                const len = Math.sqrt(dx * dx + dy * dy);
                const ux = dx / len, uy = dy / len;
                const tx = pb.x - ux * 25;
                const ty = pb.y - uy * 25;
                return (
                  <polygon key={i} points={`${tx - uy * 10},${ty + ux * 10} ${tx + ux * 15},${ty + uy * 15} ${tx + uy * 10},${ty - ux * 10}`} fill="black" />
                );
              })}

              {/* Nodes */}
              {NODES.map(n => {
                const p = POSITIONS[n];
                const isStart = n === q.start;
                const isDest = n === q.dest;
                const onPath = q.path.includes(n);
                const fill = isStart ? '#FF3333' : onPath ? '#AAAAAA' : 'white';
                return (
                  <g key={n} data-testid={`an-node-${n.toLowerCase()}`}>
                    <circle cx={p.x} cy={p.y} r="14" fill={fill} stroke="black" strokeWidth="2" />
                    <text x={p.x + 22} y={p.y + 5} fill="black" fontSize="18" fontFamily="serif" fontWeight="normal">{n}</text>
                    {isDest && (
                      <g transform={`translate(${p.x + 80} ${p.y - 30})`}>
                        <rect x="0" y="0" width="30" height="30" fill="#B0B0FF" stroke="black" strokeWidth="1" />
                        <path d="M 0 0 L 15 -8 L 45 -8 L 30 0 Z" fill="#8080CC" stroke="black" strokeWidth="1" />
                        <path d="M 30 0 L 45 -8 L 45 22 L 30 30 Z" fill="#6060AA" stroke="black" strokeWidth="1" />
                      </g>
                    )}
                  </g>
                );
              })}

              <text x="20" y="395" fill="black" fontSize="14" fontFamily="serif">All measurements in miles</text>
            </svg>
          </div>

          {/* Mission/Task black box */}
          <div className="bg-black text-white px-4 py-2 text-sm" data-testid="an-mission">
            <div><span className="font-bold">Mission:</span> Deliver parcel to {q.dest}.</div>
            <div><span className="font-bold">Task:</span> {q.taskText}</div>
          </div>

          {/* Green Journey table */}
          <div className="bg-[#4C6B2F] border border-black" data-testid="an-journey-table">
            <table className="w-full text-[12px] text-white font-serif border-collapse">
              <thead>
                <tr>
                  <th colSpan={3} className="border border-white py-0.5">Journey</th>
                  <th colSpan={2} className="border border-white py-0.5">Timings</th>
                  <th colSpan={2} className="border border-white py-0.5">Parcel</th>
                </tr>
                <tr>
                  <th className="border border-white px-1 py-0.5">Start point</th>
                  <th className="border border-white px-1 py-0.5">Destination</th>
                  <th className="border border-white px-1 py-0.5">Via</th>
                  <th className="border border-white px-1 py-0.5">Time Now</th>
                  <th className="border border-white px-1 py-0.5">{q.questionType === 'latestDeparture' ? 'Arrival' : 'Answer'}<br/>Time</th>
                  <th className="border border-white px-1 py-0.5">Yes/No</th>
                  <th className="border border-white px-1 py-0.5">Weight<br/>(kg)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-white text-center py-1" data-testid="an-tbl-start">{q.start}</td>
                  <td className="border border-white text-center py-1" data-testid="an-tbl-dest">{q.dest}</td>
                  <td className="border border-white text-center py-1" data-testid="an-tbl-via">{q.path.slice(1, -1).join(', ') || '—'}</td>
                  <td className="border border-white text-center py-1" data-testid="an-tbl-timenow">
                    {q.questionType === 'latestDeparture' ? '' : formatClockValue(q.timeNow)}
                  </td>
                  <td className="border border-white text-center py-1 bg-black w-16">
                    {q.questionType === 'latestDeparture' ? formatClockValue(q.timeNow) : '\u00a0'}
                  </td>
                  <td className="border border-white text-center py-1">Y</td>
                  <td className="border border-white text-center py-1">{q.weight}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* BOTTOM BAR */}
      <div className="bg-[#000060] border-t border-[#4444AA] px-4 py-2 flex items-center justify-between text-sm">
        <div className="text-[#CCCC00]" data-testid="an-progress">
          {mode === 'practice' ? 'Practice' : 'Question'}: {idx + 1} of {cfg.questionCount}
        </div>
        <div className="flex items-center gap-2 text-[#CCCC00]">
          <span>Answer ({q.answerLabel}) :</span>
          <div className="flex gap-0.5">
            {Array.from({ length: q.answer.length }).map((_, i) => (
              <div key={i} className="w-8 h-8 bg-white border border-black text-center flex items-center justify-center text-black font-mono text-lg"
                data-testid={`an-answer-digit-${i}`}>
                {answerBuf[i] || ''}
              </div>
            ))}
          </div>
          <input ref={inputRef} data-testid="an-answer-input"
            value={answerBuf}
            onChange={e => setAnswerBuf(e.target.value.replace(/\D/g, '').slice(0, q.answer.length))}
            className="w-0 h-0 opacity-0 absolute" autoFocus />
          <button data-testid="an-submit" onClick={submit}
            className="ml-2 bg-[#0000A0] text-white px-3 py-0.5 text-xs border border-[#4444AA] hover:bg-[#0000CC]">
            ENTER
          </button>
        </div>
        <div className="text-[#CCCC00]" data-testid="an-time-left">Time Left: {formatTime(remaining)}</div>
      </div>

      <div className="bg-[#000060] px-4 py-1 text-[10px] text-[#AACCFF] flex justify-between border-t border-[#222266]">
        <span>Type digits, Enter to submit. Time answers use HHMM. Entries cannot be corrected.</span>
        <button data-testid="an-cancel" onClick={() => navigate('/')} className="text-[#AACCFF] hover:text-white">← Dashboard</button>
      </div>
    </div>
  );
};

export default AirborneNumerical;
