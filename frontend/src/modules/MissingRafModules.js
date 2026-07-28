import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSettings, saveResult } from '../utils/storage';
import {
  CFASTAnswerInput,
  CFASTOptions,
  CFASTPanel,
  CFASTShell,
  ModuleMenu,
  ModuleResults,
  formatTime,
  pick,
  randInt,
  shuffle
} from './cbtCommon';

const letters = 'ABCDE';
const dirs = ['North', 'East', 'South', 'West'];
const turnRight = (d) => dirs[(dirs.indexOf(d) + 1) % 4];
const turnLeft = (d) => dirs[(dirs.indexOf(d) + 3) % 4];
const opposite = (d) => dirs[(dirs.indexOf(d) + 2) % 4];

const GenericQuestionModule = ({
  title,
  settingsKey,
  description,
  makeQuestion,
  renderQuestion,
  resultName
}) => {
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

  const start = () => {
    const nextCfg = getSettings()[settingsKey][difficulty];
    setCfg(nextCfg);
    setRemaining(nextCfg.testDuration);
    setIdx(0);
    setCorrect(0);
    setResponses([]);
    setQuestion(makeQuestion(nextCfg, 0));
    setStage('test');
    timerRef.current = setInterval(() => {
      setRemaining((r) => (r <= 1 ? (end(), 0) : r - 1));
    }, 1000);
  };

  const end = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setStage('results');
  };

  const answer = (_, answerIdx) => {
    const isRight = answerIdx === question.correctIndex;
    setResponses(prev => [...prev, {
      prompt: question.prompt || question.text || question.question || title,
      detail: question.detail,
      given: question.options[answerIdx],
      answer: question.options[question.correctIndex],
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
    setQuestion(makeQuestion(cfg, nextIdx));
  };

  useEffect(() => {
    if (stage === 'results' && mode === 'assessment' && idx > 0) {
      saveResult(resultName, mode, difficulty, { accuracy: (correct / idx) * 100, correct, total: idx });
    }
  }, [stage]); // eslint-disable-line react-hooks/exhaustive-deps

  if (stage === 'menu') {
    return (
      <ModuleMenu
        title={`${title} - Setup`}
        description={description}
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
        title={`${title} - Results`}
        rows={[['Correct', `${correct} / ${idx}`], ['Accuracy', `${acc.toFixed(1)}%`]]}
        overallScore={acc}
        summary={responses}
        onRetry={() => setStage('menu')}
        onDashboard={() => navigate('/')}
      />
    );
  }

  return (
    <CFASTShell
      title={title}
      mode={mode}
      difficulty={difficulty}
      questionNum={idx + 1}
      questionCount={cfg.questionCount}
      remaining={remaining}
    >
      {renderQuestion(question)}
      <div className="mt-4 flex justify-between items-start gap-4">
        <CFASTOptions options={question.options} />
        <CFASTAnswerInput options={question.options} onSubmit={answer} optionCount={question.options.length} />
      </div>
    </CFASTShell>
  );
};

const makeDadQuestion = () => {
  const startDirection = pick(dirs);
  const legs = [];
  let facing = startDirection;
  let x = 0;
  let y = 0;
  const stepCount = randInt(4, 6);
  for (let i = 0; i < stepCount; i++) {
    const turn = i === 0 ? 'continues' : pick(['turns right', 'turns left', 'turns back']);
    if (turn === 'turns right') facing = turnRight(facing);
    if (turn === 'turns left') facing = turnLeft(facing);
    if (turn === 'turns back') facing = opposite(facing);
    const dist = randInt(2, 9) * 100;
    legs.push({ turn, facing, dist });
    if (facing === 'North') y += dist;
    if (facing === 'South') y -= dist;
    if (facing === 'East') x += dist;
    if (facing === 'West') x -= dist;
  }
  const askDistance = Math.random() < 0.6;
  const distance = Math.round(Math.sqrt(x * x + y * y));
  const bearing =
    Math.abs(x) > Math.abs(y)
      ? (x > 0 ? 'East' : 'West')
      : (y > 0 ? 'North' : 'South');
  const answer = askDistance ? `${distance} miles` : bearing;
  const wrongDistances = shuffle([distance + 100, Math.max(0, distance - 100), Math.abs(x) + Math.abs(y), Math.max(Math.abs(x), Math.abs(y))])
    .filter((v, i, a) => v !== distance && a.indexOf(v) === i)
    .slice(0, 4)
    .map((v) => `${v} miles`);
  const options = shuffle(askDistance ? [answer, ...wrongDistances] : [answer, ...dirs.filter((d) => d !== answer)]).slice(0, 5);
  return {
    text: `A ship leaves harbour facing ${startDirection}. It ${legs.map((l, i) => `${i === 0 ? 'sails' : l.turn + ' and sails'} ${l.facing.toLowerCase()} for ${l.dist} miles`).join(', ')}.`,
    prompt: askDistance ? 'How far is the ship from the harbour?' : 'Which direction is the ship from the harbour?',
    options,
    correctIndex: options.indexOf(answer)
  };
};

const DirectionsAndDistances = () => (
  <GenericQuestionModule
    title="Directions and Distances"
    settingsKey="directionsDistances"
    resultName="Directions and Distances"
    description="Read a confusing sequence of directions and distances, then answer distance-from-start or direction-from-start questions."
    makeQuestion={makeDadQuestion}
    renderQuestion={(q) => (
      <div className="grid grid-cols-[1fr_300px] gap-4">
        <CFASTPanel title="Navigation Text">
          <p className="text-white text-lg leading-relaxed">{q.text}</p>
        </CFASTPanel>
        <CFASTPanel title="Question">
          <p className="text-white text-lg">{q.prompt}</p>
        </CFASTPanel>
      </div>
    )}
  />
);

const VLT_TOPICS = [
  {
    title: 'Food and Mental Alertness',
    pages: [
      { title: 'Energy Foods', color: '#8E0000', text: 'Energy foods are either sugars or starches. Sugars are simple carbohydrates and starches are complex carbohydrates, both of which are found in either a natural form or a refined form. Refined carbohydrates are foods that have been processed.\n\nFruit is a good source of natural sugar whereas white rice and white pasta are good examples of refined starch.' },
      { title: 'Food Colour', color: '#7A5400', text: 'Different colours of food are associated with different minerals. Green foods are rich in iron. Red foods are rich in lycopene. Yellow foods usually contain natural sugars but are not normally rich in iron.\n\nBroccoli is green. Garlic is white. Tomatoes are red. Grapes and bananas are fruit.' },
      { title: 'Food and Mental Alertness', color: '#006000', text: 'Different foods have different effects on our mental abilities. For example, foods that are rich in iron are particularly good for the brain.\n\nFoods rich in natural starch are good for sustained concentration because they release energy gradually and keep blood sugar levels constant. In contrast, eating foods rich in refined sugar will give a sudden energy boost followed by a sharp decline in mental alertness.' }
    ],
    questions: [
      { question: 'Which type of food is particularly good for the brain?', answer: 'Broccoli', distractors: ['Garlic', 'Tomatoes', 'Grapes', 'Bananas'] },
      { question: 'Which food is most likely to give a sudden boost followed by lower alertness?', answer: 'Refined sugar', distractors: ['Natural starch', 'Green food', 'Iron rich food', 'Broccoli'] },
      { question: 'Which description best fits white pasta?', answer: 'Refined starch', distractors: ['Natural sugar', 'Green food', 'Red food', 'Natural starch'] }
    ]
  },
  {
    title: 'Renewable Energy',
    pages: [
      { title: 'Regions', color: '#8E0000', text: 'Yorkshire wind turbines use the standard mainland generator class. Scottish wind turbines use highland-rated generator components. Coastal sites use reinforced towers but keep the same generator class as their region.' },
      { title: 'Mechanical Systems', color: '#006000', text: 'EG 100 and EG 200 engines are used to power wind turbines. EG 100 engines are fitted to highland-rated turbines. EG 200 engines are fitted to standard mainland turbines. TX engines are used for coal generation only.' },
      { title: 'Turbine Components', color: '#7A5400', text: 'The EG 100 engine is used on wind turbines in Scotland. The other wind turbine engine is used everywhere else. Reinforced towers do not change the engine fitted to a wind turbine.' },
      { title: 'Maintenance', color: '#004C7A', text: 'EG 200 engines use silver coolant and are inspected every six months. EG 100 engines use blue coolant and are inspected every three months. TX engines follow a separate coal station maintenance cycle.' }
    ],
    questions: [
      { question: 'Which engine is used to power the Yorkshire wind turbines?', answer: 'EG 200', distractors: ['EG 100', 'TX engine', 'Blue coolant', 'Reinforced tower'] },
      { question: 'Which coolant would be used by a standard mainland wind turbine?', answer: 'Silver coolant', distractors: ['Blue coolant', 'TX coolant', 'No coolant', 'Highland coolant'] },
      { question: 'How often are Yorkshire wind turbine engines inspected?', answer: 'Every six months', distractors: ['Every three months', 'Every month', 'Every year', 'They are not inspected'] }
    ]
  }
];

const makeVltQuestion = (idx) => {
  const topic = VLT_TOPICS[idx % VLT_TOPICS.length];
  const prompt = topic.questions[Math.floor(idx / VLT_TOPICS.length) % topic.questions.length];
  const options = shuffle([prompt.answer, ...prompt.distractors]).slice(0, 5);
  return { ...topic, ...prompt, options, correctIndex: options.indexOf(prompt.answer) };
};

const VltInfoPage = ({ page }) => (
  <div className="border-2 border-white bg-black p-1">
    <div className="min-h-[185px] border border-[#B0B0B0] p-3 text-white" style={{
      backgroundColor: page.color,
      backgroundImage: 'linear-gradient(45deg, rgba(255,255,255,.05) 25%, transparent 25%, transparent 75%, rgba(255,255,255,.05) 75%), linear-gradient(45deg, rgba(0,0,0,.08) 25%, transparent 25%, transparent 75%, rgba(0,0,0,.08) 75%)',
      backgroundPosition: '0 0, 3px 3px',
      backgroundSize: '6px 6px'
    }}>
      <div className="font-mono text-sm font-bold underline mb-3">{page.title}</div>
      <p className="font-mono text-[15px] leading-tight whitespace-pre-line">{page.text}</p>
    </div>
  </div>
);

const VerbalLogic = () => {
  const navigate = useNavigate();
  const [stage, setStage] = useState('menu');
  const [mode, setMode] = useState(null);
  const [difficulty, setDifficulty] = useState(null);
  const [cfg, setCfg] = useState(null);
  const [idx, setIdx] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [question, setQuestion] = useState(null);
  const [openPages, setOpenPages] = useState([0, 2]);
  const [answerValue, setAnswerValue] = useState('');
  const [responses, setResponses] = useState([]);
  const timerRef = useRef(null);

  useEffect(() => () => timerRef.current && clearInterval(timerRef.current), []);

  const start = () => {
    const nextCfg = getSettings().verbalLogic[difficulty];
    setCfg(nextCfg);
    setIdx(0);
    setCorrect(0);
    setResponses([]);
    setRemaining(nextCfg.testDuration);
    setQuestion(makeVltQuestion(0));
    setOpenPages([0, 2]);
    setAnswerValue('');
    setStage('test');
    timerRef.current = setInterval(() => setRemaining((r) => (r <= 1 ? (end(), 0) : r - 1)), 1000);
  };

  const end = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setStage('results');
  };

  const selectPage = (pageIndex) => {
    setOpenPages((prev) => prev.includes(pageIndex) ? prev : [prev[1], pageIndex].filter((v) => v != null));
  };

  const submitAnswer = (letter) => {
    const answerIndex = letters.indexOf(letter.toUpperCase());
    if (answerIndex < 0 || answerIndex >= question.options.length) return;
    const isRight = answerIndex === question.correctIndex;
    setResponses(prev => [...prev, {
      prompt: question.question,
      detail: `Open pages at answer: ${openPages.map(i => question.pages[i]?.title).filter(Boolean).join(', ')}`,
      given: `${letters[answerIndex]}. ${question.options[answerIndex]}`,
      answer: `${letters[question.correctIndex]}. ${question.options[question.correctIndex]}`,
      correct: isRight
    }]);
    const nextCorrect = isRight ? correct + 1 : correct;
    const nextIdx = idx + 1;
    setCorrect(nextCorrect);
    setAnswerValue('');
    if (nextIdx >= cfg.questionCount) {
      setIdx(nextIdx);
      end();
      return;
    }
    setIdx(nextIdx);
    const nextQuestion = makeVltQuestion(nextIdx);
    setQuestion(nextQuestion);
    setOpenPages([0, Math.min(2, nextQuestion.pages.length - 1)]);
  };

  useEffect(() => {
    const onKeyDown = (event) => {
      if (stage !== 'test') return;
      const key = event.key.toUpperCase();
      if (letters.includes(key)) submitAnswer(key);
      if (event.key === 'Enter' && answerValue) submitAnswer(answerValue);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  useEffect(() => {
    if (stage === 'results' && mode === 'assessment' && idx > 0) {
      saveResult('Verbal Logic', mode, difficulty, { accuracy: (correct / idx) * 100, correct, total: idx });
    }
  }, [stage]); // eslint-disable-line react-hooks/exhaustive-deps

  if (stage === 'menu') {
    return (
      <ModuleMenu
        title="Verbal Logic Test - Setup"
        description="Read broad-subject information pages, keep only two pages open at once, then answer inference questions by joining clues across pages."
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
        title="Verbal Logic - Results"
        rows={[['Correct', `${correct} / ${idx}`], ['Accuracy', `${acc.toFixed(1)}%`]]}
        overallScore={acc}
        summary={responses}
        onRetry={() => setStage('menu')}
        onDashboard={() => navigate('/')}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#000080] text-white p-1" style={{ fontFamily: "'Arial', 'Helvetica', sans-serif" }}>
      <div className="max-w-[1000px] mx-auto border-2 border-white bg-[#000080] min-h-[640px]">
        <div className="h-8 border-b-2 border-white flex items-center justify-center text-sm font-bold">
          Verbal Logic Test - Instructions
        </div>
        <div className="grid grid-cols-[1fr_190px] gap-3 p-3 pb-2">
          <div className="space-y-2">
            {openPages.map((pageIndex) => (
              <VltInfoPage key={pageIndex} page={question.pages[pageIndex]} />
            ))}
          </div>
          <div className="border-2 border-white p-3 min-h-[398px]" style={{
            backgroundColor: '#6C6C6C',
            backgroundImage: 'linear-gradient(45deg, rgba(255,255,255,.08) 25%, transparent 25%, transparent 75%, rgba(255,255,255,.08) 75%), linear-gradient(45deg, rgba(0,0,0,.09) 25%, transparent 25%, transparent 75%, rgba(0,0,0,.09) 75%)',
            backgroundPosition: '0 0, 3px 3px',
            backgroundSize: '6px 6px'
          }}>
            <div className="font-bold mb-3">Index</div>
            <div className="space-y-1">
              {question.pages.map((page, i) => (
                <button key={page.title} onClick={() => selectPage(i)} className="grid grid-cols-[24px_1fr] gap-2 text-left w-full">
                  <span className="bg-white text-black text-center font-bold leading-5 h-5">{i + 1}</span>
                  <span className={`font-mono text-sm leading-tight ${openPages.includes(i) ? 'underline' : ''}`}>{page.title}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="mx-3 border-2 border-white bg-black p-3 min-h-[155px]">
          <div className="font-mono text-[15px] mb-2">{question.question}</div>
          <div className="space-y-1">
            {question.options.map((option, i) => (
              <button key={option} onClick={() => submitAnswer(letters[i])} className="grid grid-cols-[48px_1fr] gap-3 text-left font-mono text-[15px] w-full">
                <span className="border border-white text-center">{letters[i]}</span>
                <span>{option}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="h-10 mt-3 bg-black border-t-2 border-white grid grid-cols-3 items-center px-5 text-sm">
          <div>Question: {idx + 1} of {cfg.questionCount}</div>
          <form onSubmit={(e) => { e.preventDefault(); submitAnswer(answerValue); }} className="flex items-center justify-center gap-3">
            <span className="text-[#CCCC00]">Answer :</span>
            <input value={answerValue} onChange={(e) => setAnswerValue(e.target.value.toUpperCase().replace(/[^A-E]/g, '').slice(0, 1))}
              className="w-14 bg-black border-b-2 border-[#CCCC00] text-white text-center outline-none uppercase" autoFocus data-testid="vlt-answer-input" />
          </form>
          <div className="text-right text-[#CCCC00]">Time Left: {formatTime(remaining)}</div>
        </div>
      </div>
    </div>
  );
};

const makeVisualisationQuestion = (_, idx) => {
  const testTwo = idx % 2 === 1;
  const answer = testTwo ? 'B' : 'C';
  const options = ['A', 'B', 'C', 'D', 'E'];
  return {
    testTwo,
    correctIndex: options.indexOf(answer),
    options,
    prompt: testTwo
      ? 'Which lower shape is made when the labelled sides are joined?'
      : 'Which option matches the two 3D shapes after mental rotation?'
  };
};

const visualisationHitZones = {
  rotated: [
    { label: 'A', left: 12.7, top: 28.1, width: 21.2, height: 26.5 },
    { label: 'B', left: 39.4, top: 28.1, width: 21.2, height: 26.5 },
    { label: 'C', left: 65.6, top: 28.1, width: 21.2, height: 26.5 },
    { label: 'D', left: 27.8, top: 59.2, width: 21.2, height: 26.9 },
    { label: 'E', left: 54.8, top: 59.2, width: 21.2, height: 26.9 }
  ],
  assembly: [
    { label: 'A', left: 4.5, top: 28.6, width: 27.8, height: 30.4 },
    { label: 'B', left: 36.1, top: 28.6, width: 30.6, height: 30.4 },
    { label: 'C', left: 69.1, top: 28.6, width: 26.8, height: 30.4 },
    { label: 'D', left: 13.4, top: 65.8, width: 31.1, height: 29.9 },
    { label: 'E', left: 52.6, top: 65.8, width: 32.8, height: 29.9 }
  ]
};

const VisualisationImageOptions = ({ q, type, onAnswer }) => (
  <>
    {visualisationHitZones[type].map((zone) => (
      <button
        key={zone.label}
        aria-label={`Answer ${zone.label}`}
        onClick={() => onAnswer(q.options.indexOf(zone.label))}
        className="absolute rounded-sm border-2 border-transparent focus-visible:border-[#0066cc] focus-visible:outline-none focus-visible:bg-[#0066cc]/10"
        style={{
          left: `${zone.left}%`,
          top: `${zone.top}%`,
          width: `${zone.width}%`,
          height: `${zone.height}%`
        }}
      />
    ))}
  </>
);

const RotatedShapesScreen = ({ q, idx, total, onAnswer }) => (
  <div className="min-h-screen bg-[#DCDCDC] p-8" style={{ fontFamily: "'Arial', 'Helvetica', sans-serif" }}>
    <div className="w-[700px] max-w-full mx-auto">
      <div className="h-9 mx-[70px] rounded-b-md bg-gradient-to-b from-[#D9D9D9] to-[#8B8B8B] border border-[#999] grid grid-cols-[1fr_110px] text-white text-sm font-bold">
        <div className="flex items-center px-2">Visualization #2 - Rotated Shapes , Item : {idx + 1}/{total}</div>
        <div className="flex items-center justify-center border-l border-[#999]">Help</div>
      </div>
      <div className="relative mx-auto mt-2 w-[700px] max-w-full">
        <img
          src="/assets/visualisation/rotated-shapes-reference.png"
          alt="Rotated shapes answer options"
          className="block w-full h-auto select-none"
          draggable="false"
        />
        <VisualisationImageOptions q={q} type="rotated" onAnswer={onAnswer} />
      </div>
    </div>
  </div>
);

const AssemblyScreen = ({ q, onAnswer }) => (
  <div className="min-h-screen bg-white p-0" style={{ fontFamily: "'Arial', 'Helvetica', sans-serif" }}>
    <div className="relative w-[418px] max-w-full mx-auto bg-white">
      <img
        src="/assets/visualisation/shape-assembly-reference.jpg"
        alt="Shape assembly answer options"
        className="block w-full h-auto select-none"
        draggable="false"
      />
      <VisualisationImageOptions q={q} type="assembly" onAnswer={onAnswer} />
    </div>
  </div>
);

const VisualisationTests = () => {
  const navigate = useNavigate();
  const [stage, setStage] = useState('menu');
  const [mode, setMode] = useState(null);
  const [difficulty, setDifficulty] = useState(null);
  const [cfg, setCfg] = useState(null);
  const [idx, setIdx] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [q, setQ] = useState(null);
  const [remaining, setRemaining] = useState(0);
  const [responses, setResponses] = useState([]);
  const timerRef = useRef(null);

  useEffect(() => () => timerRef.current && clearInterval(timerRef.current), []);

  const start = () => {
    const nextCfg = getSettings().visualisationTests[difficulty];
    setCfg(nextCfg);
    setIdx(0);
    setCorrect(0);
    setResponses([]);
    setQ(makeVisualisationQuestion(nextCfg, 0));
    setRemaining(nextCfg.testDuration);
    setStage('test');
    timerRef.current = setInterval(() => setRemaining((r) => (r <= 1 ? (end(), 0) : r - 1)), 1000);
  };
  const end = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setStage('results');
  };
  const answer = (answerIdx) => {
    const isRight = answerIdx === q.correctIndex;
    setResponses(prev => [...prev, {
      prompt: q.prompt,
      detail: q.testTwo ? 'Labelled-side shape assembly' : 'Rotated 3D shapes',
      given: q.options[answerIdx],
      answer: q.options[q.correctIndex],
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
    setQ(makeVisualisationQuestion(cfg, nextIdx));
  };

  useEffect(() => {
    const onKeyDown = (event) => {
      if (stage !== 'test') return;
      const key = event.key.toUpperCase();
      const answerIdx = q?.options.indexOf(key);
      if (answerIdx >= 0) answer(answerIdx);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  useEffect(() => {
    if (stage === 'results' && mode === 'assessment' && idx > 0) {
      saveResult('Visualisation Tests', mode, difficulty, { accuracy: (correct / idx) * 100, correct, total: idx });
    }
  }, [stage]); // eslint-disable-line react-hooks/exhaustive-deps

  if (stage === 'menu') return (
    <ModuleMenu
      title="Visualisation Tests - Setup"
      description="RAF-style visualisation practice: rotated 3D shapes with reference dots and labelled-side shape assembly."
      mode={mode}
      setMode={setMode}
      difficulty={difficulty}
      setDifficulty={setDifficulty}
      onCancel={() => navigate('/')}
      onStart={start}
    />
  );
  if (stage === 'results') {
    const acc = idx ? (correct / idx) * 100 : 0;
    return <ModuleResults title="Visualisation Tests - Results" rows={[['Correct', `${correct} / ${idx}`], ['Accuracy', `${acc.toFixed(1)}%`]]} overallScore={acc} summary={responses} onRetry={() => setStage('menu')} onDashboard={() => navigate('/')} />;
  }

  return (
    <div>
      <div className="fixed right-3 top-3 z-10 bg-black/70 text-white px-2 py-1 text-xs">Time Left: {formatTime(remaining)}</div>
      {q.testTwo ? <AssemblyScreen q={q} onAnswer={answer} /> : <RotatedShapesScreen q={q} idx={idx} total={cfg.questionCount} onAnswer={answer} />}
    </div>
  );
};

const makeFlagProblem = () => {
  const a = randInt(4, 18);
  const b = randInt(2, 9);
  const op = pick(['+', '-', 'x']);
  const answer = op === '+' ? a + b : op === '-' ? a - b : a * b;
  return { text: `${a} ${op} ${b}`, answer: String(answer) };
};

const callsigns = ['BRAVO', 'KILO', 'TANGO', 'ECHO', 'SIERRA'];
const zones = [
  { name: 'GREEN', color: '#4F9545', x: 56, y: 24, shape: 'oval' },
  { name: 'YELLOW', color: '#B7B14A', x: 70, y: 27, shape: 'triangle' },
  { name: 'RED', color: '#9F4040', x: 83, y: 14, shape: 'rect' }
];

const flagInputBoxes = Array.from({ length: 4 }, (_, i) => i);
const FlagAircraft = ({ x, y, callsign, circled = true, heading = 0, showCallsign = false }) => (
  <g transform={`translate(${x} ${y}) rotate(${heading})`}>
    {circled && <circle cx="0" cy="0" r="12" fill="none" stroke="#2453B8" strokeWidth="2" />}
    <path d="M0 -8 L4 4 L0 1 L-4 4 Z" fill="#274E9B" stroke="#5276E0" strokeWidth="1.5" />
    {showCallsign && (
      <g transform={`rotate(${-heading}) translate(-18 -24)`}>
        <rect x="0" y="0" width="38" height="13" fill="#619862" opacity="0.9" />
        <text x="19" y="10" fill="white" fontSize="11" textAnchor="middle" fontWeight="bold">{callsign.slice(0, 2)}</text>
      </g>
    )}
  </g>
);

const FlagZone = ({ zone }) => {
  const x = zone.x * 10;
  const y = zone.y * 5;
  if (zone.shape === 'oval') {
    return <ellipse cx={x} cy={y} rx="24" ry="33" fill={zone.color} transform={`rotate(22 ${x} ${y})`} opacity="0.9" />;
  }
  if (zone.shape === 'triangle') {
    return <polygon points={`${x - 38},${y + 12} ${x + 37},${y - 38} ${x + 8},${y + 45}`} fill={zone.color} opacity="0.9" />;
  }
  return <rect x={x - 42} y={y - 23} width="84" height="46" rx="11" fill={zone.color} transform={`rotate(-31 ${x} ${y})`} opacity="0.95" />;
};

const FlagKeypad = ({ answerBuf, onDigit, onEnter, onZone, onYesNo }) => (
  <div className="absolute right-0 top-[140px] w-[134px] bg-black px-2 py-7">
    <div className="space-y-1 mb-5">
      {flagInputBoxes.map((i) => (
        <div key={i} className="w-9 h-7 border-2 border-[#888888] ml-0 bg-[#161616] text-white text-center font-mono">
          {answerBuf[i] || ''}
        </div>
      ))}
    </div>
    <div className="grid grid-cols-3 gap-1 mb-2">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
        <button key={n} onClick={() => onDigit(String(n))} className="h-25px h-7 rounded-md bg-[#A9A9A9] text-[#333333] font-bold border border-[#777777]">{n}</button>
      ))}
      <button onClick={onEnter} className="h-7 rounded-md bg-[#A9A9A9] text-[#333333] font-bold border border-[#777777]">↵</button>
      <button onClick={() => onDigit('0')} className="h-7 rounded-md bg-[#A9A9A9] text-[#333333] font-bold border border-[#777777]">0</button>
      <button onClick={onEnter} className="h-7 rounded-md bg-[#A9A9A9] text-[#333333] font-bold border border-[#777777]">•</button>
    </div>
    <div className="grid grid-cols-3 gap-1 mb-2">
      <button onClick={() => onZone('GREEN')} className="h-26px h-7 rounded-md border-2 border-[#BDBDBD] bg-black flex items-center justify-center"><span className="w-4 h-4 rounded-full bg-[#15A537]"></span></button>
      <button onClick={() => onZone('YELLOW')} className="h-7 rounded-md border-2 border-[#BDBDBD] bg-black flex items-center justify-center"><span className="w-0 h-0 border-l-[9px] border-r-[9px] border-b-[16px] border-l-transparent border-r-transparent border-b-[#B6AD37]"></span></button>
      <button onClick={() => onZone('RED')} className="h-7 rounded-md border-2 border-[#BDBDBD] bg-black flex items-center justify-center"><span className="w-17px w-5 h-4 bg-[#A83C3C] rounded-sm"></span></button>
    </div>
    <div className="grid grid-cols-2 gap-7">
      <button onClick={() => onYesNo(false)} className="bg-[#0000F0] text-white border-2 border-white rounded-md h-8 text-xs font-bold">NO</button>
      <button onClick={() => onYesNo(true)} className="bg-[#0000F0] text-white border-2 border-white rounded-md h-8 text-xs font-bold">YES</button>
    </div>
  </div>
);

const FiguresLogisticsGroups = () => {
  const navigate = useNavigate();
  const [stage, setStage] = useState('menu');
  const [mode, setMode] = useState(null);
  const [difficulty, setDifficulty] = useState(null);
  const [cfg, setCfg] = useState(null);
  const [remaining, setRemaining] = useState(0);
  const [problem, setProblem] = useState(makeFlagProblem());
  const [answerBuf, setAnswerBuf] = useState('');
  const [correct, setCorrect] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [responses, setResponses] = useState([]);
  const [zoneTarget, setZoneTarget] = useState(pick(zones));
  const [groupTarget, setGroupTarget] = useState(pick(callsigns));
  const [groupQuestion, setGroupQuestion] = useState({ callsign: 'TZ', answer: true });
  const timerRef = useRef(null);

  const planes = useMemo(() => [
    { id: groupTarget, x: 330, y: 360, heading: 0, circled: true, showCallsign: true },
    { id: 'CA', x: zoneTarget.x * 10, y: zoneTarget.y * 5, heading: 42, circled: true, showCallsign: false },
    { id: 'JP', x: 225, y: 350, heading: 62, circled: true, showCallsign: false },
    { id: 'UA', x: 485, y: 160, heading: 0, circled: true, showCallsign: false },
    { id: 'NM', x: 300, y: 78, heading: 90, circled: true, showCallsign: false }
  ], [groupTarget, zoneTarget]);

  useEffect(() => () => timerRef.current && clearInterval(timerRef.current), []);

  const start = () => {
    const nextCfg = getSettings().figuresLogisticsGroups[difficulty];
    setCfg(nextCfg);
    setRemaining(nextCfg.testDuration);
    setCorrect(0);
    setAttempts(0);
    setResponses([]);
    setProblem(makeFlagProblem());
    setZoneTarget(pick(zones));
    setGroupTarget(pick(callsigns));
    setGroupQuestion({ callsign: pick(callsigns).slice(0, 2), answer: Math.random() > 0.5 });
    setStage('test');
    timerRef.current = setInterval(() => setRemaining((r) => (r <= 1 ? (end(), 0) : r - 1)), 1000);
  };
  const end = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setStage('results');
  };
  const mark = (hit, entry) => {
    if (entry) setResponses(prev => [...prev, { ...entry, correct: hit }]);
    setAttempts((a) => a + 1);
    if (hit) setCorrect((c) => c + 1);
  };
  const submitMath = () => {
    if (!answerBuf) return;
    mark(answerBuf === problem.answer, {
      prompt: `${problem.a} ${problem.op} ${problem.b}`,
      given: answerBuf,
      answer: problem.answer
    });
    setAnswerBuf('');
    setProblem(makeFlagProblem());
  };
  const addDigit = (digit) => {
    setAnswerBuf((v) => v.length >= 4 ? v : v + digit);
  };
  const chooseZone = (name) => {
    mark(name === zoneTarget.name, {
      prompt: 'Identify the coloured zone containing the circled aircraft',
      given: name,
      answer: zoneTarget.name
    });
    setZoneTarget(pick(zones));
  };
  const answerGroup = (yes) => {
    mark(yes === groupQuestion.answer, {
      prompt: `Is the remembered aircraft callsign ${groupQuestion.callsign}?`,
      given: yes ? 'YES' : 'NO',
      answer: groupQuestion.answer ? 'YES' : 'NO'
    });
    const nextCallsign = pick(callsigns);
    setGroupTarget(nextCallsign);
    setGroupQuestion({ callsign: nextCallsign.slice(0, 2), answer: Math.random() > 0.35 });
  };

  useEffect(() => {
    if (stage === 'results' && mode === 'assessment' && attempts > 0) {
      saveResult('Figures, Logistics and Groups', mode, difficulty, { accuracy: (correct / attempts) * 100, correct, total: attempts });
    }
  }, [stage]); // eslint-disable-line react-hooks/exhaustive-deps

  if (stage === 'menu') return (
    <ModuleMenu
      title="Figures, Logistics and Groups - Setup"
      description="Multitask between quick mental arithmetic, aircraft entering coloured zones, and callsign recall."
      mode={mode}
      setMode={setMode}
      difficulty={difficulty}
      setDifficulty={setDifficulty}
      onCancel={() => navigate('/')}
      onStart={start}
    />
  );
  if (stage === 'results') {
    const acc = attempts ? (correct / attempts) * 100 : 0;
    return <ModuleResults title="Figures, Logistics and Groups - Results" rows={[['Correct', `${correct} / ${attempts}`], ['Accuracy', `${acc.toFixed(1)}%`]]} overallScore={acc} summary={responses} onRetry={() => setStage('menu')} onDashboard={() => navigate('/')} />;
  }
  return (
    <div className="min-h-screen bg-[#4B4B4B] text-black p-0" style={{ fontFamily: "'Arial', 'Helvetica', sans-serif" }}>
      <div className="max-w-[1024px] mx-auto h-[768px] bg-[#4B4B4B] overflow-hidden">
        <div className="h-6 bg-[#B3B3B3] border-b border-[#333333] grid grid-cols-[140px_1fr_72px] items-center">
          <div className="px-1 text-[9px]">
            <div className="grid grid-cols-[30px_1fr] items-center h-2.5"><span>Time</span><div className="border border-[#777] h-2"><div className="h-full bg-[#DCDCDC]" style={{ width: `${Math.max(0, remaining / cfg.testDuration * 100)}%` }}></div></div></div>
            <div className="grid grid-cols-[30px_1fr] items-center h-2.5"><span>Progress</span><div className="border border-[#777] h-2"><div className="h-full bg-[#58B86C]" style={{ width: `${Math.min(100, attempts / cfg.questionCount * 100)}%` }}></div></div></div>
          </div>
          <div className="text-center text-xs font-bold">Figures, Logistics and Groups - Instructions</div>
          <div className="text-[8px] text-[#1C4EA8] font-bold text-right pr-1">ROYAL<br />AIR FORCE</div>
        </div>
        <div className="relative h-[708px] bg-[#242424] border-l-8 border-black border-b-8 border-black">
          <svg viewBox="0 0 1024 708" className="absolute inset-0 w-full h-full">
            <rect width="1024" height="708" fill="#242424" />
            {zones.map((zone) => <FlagZone key={zone.name} zone={zone} />)}
            <rect x="786" y="233" width="82" height="32" rx="7" fill="#A74242" transform="rotate(17 827 249)" opacity="0.95" />
            {planes.map((plane) => (
              <FlagAircraft key={plane.id} x={plane.x} y={plane.y} callsign={plane.id} heading={plane.heading} circled={plane.circled} showCallsign={plane.showCallsign} />
            ))}
          </svg>
          <div className="absolute left-[267px] top-[190px] w-[466px] bg-[#66A9C9] rounded-md px-3 py-3 text-[11px] leading-loose">
            <div className="font-bold underline mb-1">Figures, Logistics and Groups</div>
            <div>This is a test of your ability to multi-task.</div>
            <div>You have to do three tasks involving monitoring aircraft movement, mental arithmetic, and memory.</div>
            <div className="mt-2 font-bold">Figures: {problem.text}</div>
            <div>Groups: Is {groupQuestion.callsign} currently on the screen?</div>
          </div>
          <FlagKeypad answerBuf={answerBuf} onDigit={addDigit} onEnter={submitMath} onZone={chooseZone} onYesNo={answerGroup} />
        </div>
        <div className="h-[54px] bg-[#4B4B4B] flex items-center justify-center">
          <button className="bg-[#2C9CC8] text-white rounded-md px-4 py-2 text-xs font-bold border border-[#14637F]">More instructions ➜</button>
        </div>
      </div>
    </div>
  );
};

export {
  DirectionsAndDistances,
  FiguresLogisticsGroups,
  VerbalLogic,
  VisualisationTests
};
