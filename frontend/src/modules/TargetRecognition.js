import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSettings, saveResult } from '../utils/storage';
import { pick, randInt, shuffle, ModuleMenu, ModuleResults } from './cbtCommon';
import './TargetRecognition.css';

const BLUE = '#000080';
const RED_BAR = '#800000';
const GREEN_BAR = '#008000';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
const SCAN_TYPES = ['tank', 'aircraft', 'twoWheel'];
const DIRECTIONS = ['North', 'East', 'South', 'West'];
const DIR_DEG = { North: 0, East: 90, South: 180, West: 270 };

const TIMING = {
  easy: { lightMs: 4200, scanStep: 0.022, systemRowMs: 1800, forcedLight: 6, forcedScan: 4 },
  medium: { lightMs: 3400, scanStep: 0.03, systemRowMs: 1450, forcedLight: 7, forcedScan: 5 },
  hard: { lightMs: 2700, scanStep: 0.04, systemRowMs: 1150, forcedLight: 8, forcedScan: 6 }
};

const LIGHTS = [
  { name: 'red', color: '#E00000' },
  { name: 'green', color: '#00D000' },
  { name: 'blue', color: '#1222D7' }
];

const AFFILIATIONS = [
  { id: 'hostile', label: 'Hostile', color: '#9B3733' },
  { id: 'friendly', label: 'Friendly', color: '#596E9C' },
  { id: 'neutral', label: 'Neutral', color: '#A3A43B' }
];

const SCENE_KINDS = [
  { id: 'truck', label: 'Trucks', shape: 'circle' },
  { id: 'tank', label: 'Tanks', shape: 'square' },
  { id: 'building', label: 'Buildings', shape: 'triangle' }
];

const EMPTY_SCORE = {
  light: 0,
  scan: 0,
  system: 0,
  scene: 0,
  lightMiss: 0,
  scanMiss: 0,
  systemMiss: 0,
  sceneMiss: 0
};

const PANEL_TEXTURE = {
  backgroundColor: '#676767',
  backgroundImage: [
    'linear-gradient(45deg, rgba(255,255,255,.08) 25%, transparent 25%, transparent 75%, rgba(255,255,255,.08) 75%)',
    'linear-gradient(45deg, rgba(0,0,0,.13) 25%, transparent 25%, transparent 75%, rgba(0,0,0,.13) 75%)'
  ].join(','),
  backgroundPosition: '0 0, 3px 3px',
  backgroundSize: '6px 6px'
};

const SCAN_NOISE = Array.from({ length: 210 }, (_, index) => ({
  x: (index * 47 + 13) % 120,
  y: (index * 29 + Math.floor(index / 7) * 11) % 70,
  shade: index % 3 === 0 ? '#B8B8B8' : '#686868'
}));

const randCode = () => Array.from({ length: 4 }, () => CODE_CHARS[randInt(0, CODE_CHARS.length - 1)]).join('');
const genLights = () => Array.from({ length: 3 }, () => pick(LIGHTS));
const lightsMatch = (first, second) => first.every((light, index) => light.name === second[index]?.name);

const makeUniqueCode = (used) => {
  let code = randCode();
  while (used.has(code)) code = randCode();
  used.add(code);
  return code;
};

const makeSystemRows = (target) => {
  const used = new Set([target]);
  const rows = Array.from({ length: 48 }, () => (
    Array.from({ length: 3 }, () => makeUniqueCode(used))
  ));
  const targetRow = randInt(0, 8);
  const targetColumn = randInt(0, 2);
  rows[targetRow][targetColumn] = target;
  return rows;
};

const makeSceneSlots = () => shuffle(
  Array.from({ length: 70 }, (_, index) => {
    const column = index % 10;
    const row = Math.floor(index / 10);
    return {
      x: 5.5 + column * 9.8 + randInt(-1, 1),
      y: 7 + row * 14.2 + randInt(-1, 1)
    };
  }).filter((slot) => !(slot.x < 16 && slot.y < 20))
);

const makeScene = (distractorCount = 10) => {
  const slots = makeSceneSlots();
  const targetKind = pick(SCENE_KINDS).id;
  const targetAffiliation = pick(AFFILIATIONS).id;
  const targetDirection = pick(DIRECTIONS);
  const modifier = pick([null, null, 'damaged', 'highPriority']);
  const specificCount = randInt(2, 4);
  const unknownCount = randInt(3, 5);
  const semanticCount = Math.min(48, 34 + distractorCount);
  const items = [];
  let nextItemId = 0;
  const nextId = () => `scene-${nextItemId++}`;

  const matchesCriteria = (item) => (
    item.kind === targetKind
    && item.affiliation === targetAffiliation
    && item.direction === targetDirection
    && (!modifier || item[modifier])
  );

  const nextSlot = () => slots.shift() || { x: randInt(5, 95), y: randInt(7, 93) };
  for (let index = 0; index < specificCount; index += 1) {
    items.push({
      id: nextId(),
      ...nextSlot(),
      type: 'semantic',
      kind: targetKind,
      affiliation: targetAffiliation,
      direction: targetDirection,
      damaged: modifier === 'damaged' || Math.random() < 0.08,
      highPriority: modifier === 'highPriority' || Math.random() < 0.08
    });
  }

  for (let index = 0; index < unknownCount; index += 1) {
    items.push({
      id: nextId(),
      ...nextSlot(),
      type: 'unknown'
    });
  }

  for (let index = items.length; index < semanticCount; index += 1) {
    let item;
    do {
      item = {
        id: nextId(),
        ...nextSlot(),
        type: 'semantic',
        kind: pick(SCENE_KINDS).id,
        affiliation: pick(AFFILIATIONS).id,
        direction: pick([...DIRECTIONS, null, null]),
        damaged: Math.random() < 0.13,
        highPriority: Math.random() < 0.14
      };
    } while (matchesCriteria(item));
    items.push(item);
  }

  for (let index = 0; index < 7; index += 1) {
    items.push({
      id: nextId(),
      ...nextSlot(),
      type: 'beacon'
    });
  }

  const affiliationLabel = AFFILIATIONS.find((item) => item.id === targetAffiliation).label.toLowerCase();
  const kindLabel = SCENE_KINDS.find((item) => item.id === targetKind).label.toLowerCase();
  const modifierLabel = modifier === 'highPriority' ? 'high priority ' : modifier ? `${modifier} ` : '';
  const specificLabel = `All ${modifierLabel}${affiliationLabel} ${kindLabel} traveling ${targetDirection}`;
  const specificMatches = items.filter(matchesCriteria).map((item) => item.id);
  const unknownMatches = items.filter((item) => item.type === 'unknown').map((item) => item.id);
  const specificTasks = [{
    id: 'specific-0',
    label: specificLabel,
    matches: specificMatches
  }];
  const usedTaskLabels = new Set([specificLabel]);
  shuffle(items.filter((item) => item.type === 'semantic' && item.direction)).forEach((seed) => {
    if (specificTasks.length >= 9) return;
    let taskModifier = null;
    if (seed.highPriority && Math.random() < 0.5) taskModifier = 'highPriority';
    else if (seed.damaged && Math.random() < 0.5) taskModifier = 'damaged';
    const seedAffiliation = AFFILIATIONS.find((item) => item.id === seed.affiliation).label.toLowerCase();
    const seedKind = SCENE_KINDS.find((item) => item.id === seed.kind).label.toLowerCase();
    const taskModifierLabel = taskModifier === 'highPriority'
      ? 'high priority '
      : taskModifier === 'damaged' ? 'damaged ' : '';
    const label = `All ${taskModifierLabel}${seedAffiliation} ${seedKind} traveling ${seed.direction}`;
    if (usedTaskLabels.has(label)) return;
    const matches = items.filter((item) => (
      item.type === 'semantic'
      && item.kind === seed.kind
      && item.affiliation === seed.affiliation
      && item.direction === seed.direction
      && (!taskModifier || item[taskModifier])
    )).map((item) => item.id);
    if (!matches.length) return;
    usedTaskLabels.add(label);
    specificTasks.push({
      id: `specific-${specificTasks.length}`,
      label,
      matches
    });
  });
  const distractors = Array.from({ length: 23 }, (_, index) => ({
    id: index,
    type: pick(['polygon', 'hexagon', 'line']),
    x: randInt(5, 95),
    y: randInt(7, 94),
    size: randInt(16, 42),
    rotation: randInt(0, 180),
    color: pick(AFFILIATIONS).color
  }));

  return {
    items: shuffle(items),
    distractors,
    tasks: [
      { id: 'unknown', label: 'Unknown', matches: unknownMatches },
      ...specificTasks
    ]
  };
};

const Panel = ({
  title,
  header = RED_BAR,
  children,
  className = '',
  bodyClass = '',
  testId,
  style
}) => (
  <section
    className={`absolute overflow-hidden border-2 border-white bg-black ${className}`}
    data-testid={testId}
    style={style}
  >
    <div
      className="border-b border-white text-center font-bold text-white"
      style={{
        height: '2.1cqw',
        backgroundColor: header,
        fontSize: '1.45cqw',
        lineHeight: '2.02cqw'
      }}
    >
      {title}
    </div>
    <div className={`relative overflow-hidden ${bodyClass}`} style={{ height: 'calc(100% - 2.1cqw)' }}>
      {children}
    </div>
  </section>
);

const Light = ({ light, size }) => (
  <span
    className="block shrink-0 rounded-full border border-[#044500]"
    style={{
      width: size,
      height: size,
      background: `radial-gradient(circle at 35% 30%, #FFFFFF 0%, ${light.color} 19%, ${light.color} 56%, #003000 100%)`,
      boxShadow: `0 0 0.55cqw ${light.color}55`
    }}
  />
);

const PushButton = ({ onClick, testId }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label="Confirm target match"
    data-testid={testId}
    className="relative z-10 h-[4.8cqw] w-[5.7cqw] shrink-0 border-2 border-[#255B5B] focus:outline-none"
    style={{
      background: 'linear-gradient(#179A94, #096662)',
      boxShadow: '0.65cqw 0.65cqw 0.55cqw rgba(0,0,0,.38)'
    }}
  />
);

const LightPanel = ({ title, lights, target = false, onMatch, style }) => (
  <Panel
    title={title}
    header={target ? GREEN_BAR : RED_BAR}
    bodyClass="flex items-center justify-center"
    testId={`tr-${title.toLowerCase().replace(' ', '-')}`}
    style={style}
  >
    {!target && <div className="absolute inset-0" style={PANEL_TEXTURE} />}
    <div className={`relative z-10 flex items-center ${target ? 'gap-[0.75cqw]' : 'gap-[1.8cqw]'}`}>
      {lights.map((light, index) => (
        <Light key={`${light.name}-${index}`} light={light} size={target ? '2.45cqw' : '3.05cqw'} />
      ))}
    </div>
    {!target && <div className="relative z-10 ml-[2.1cqw]"><PushButton onClick={onMatch} testId="tr-light-match-button" /></div>}
  </Panel>
);

const ScanArtwork = ({ type }) => (
  <>
    {SCAN_NOISE.map((dot, index) => (
      <circle key={index} cx={dot.x} cy={dot.y} r="0.52" fill={dot.shade} opacity="0.68" />
    ))}
    <g fill="#DADADA" stroke="#DADADA" opacity="0.92">
      {type === 'tank' && (
        <>
          <rect x="27" y="38" width="57" height="10" />
          <rect x="40" y="28" width="27" height="13" />
          <line x1="64" y1="32" x2="101" y2="21" strokeWidth="4" />
          <circle cx="38" cy="52" r="4" />
          <circle cx="56" cy="52" r="4" />
          <circle cx="76" cy="52" r="4" />
        </>
      )}
      {type === 'aircraft' && (
        <>
          <path d="M15 38 L57 30 L104 38 L60 46 Z" />
          <path d="M58 11 L67 35 L58 60 L49 35 Z" />
          <path d="M24 50 L47 44 L41 59 Z" />
        </>
      )}
      {type === 'twoWheel' && (
        <>
          <circle cx="37" cy="51" r="10" fill="none" strokeWidth="4" />
          <circle cx="84" cy="51" r="10" fill="none" strokeWidth="4" />
          <path d="M37 51 L55 31 L70 51 L50 51 L63 51 L84 51" fill="none" strokeWidth="4" />
          <circle cx="59" cy="23" r="5" />
        </>
      )}
    </g>
  </>
);

const ScanIcon = ({ type, scanProgress = null }) => {
  const scanY = scanProgress === null ? 0 : 4 + scanProgress * 49;
  return (
    <svg viewBox="0 0 120 70" className="h-full w-full" preserveAspectRatio="none">
      <rect width="120" height="70" fill={scanProgress === null ? '#090909' : '#3B3B3B'} />
      {scanProgress === null ? (
        <ScanArtwork type={type} />
      ) : (
        <>
          <defs>
            <clipPath id="trt-scan-window">
              <rect x="0" y={scanY} width="120" height="14" />
            </clipPath>
          </defs>
          <g clipPath="url(#trt-scan-window)">
            <rect width="120" height="70" fill="#090909" />
            <ScanArtwork type={type} />
          </g>
          <line x1="0" y1={scanY} x2="120" y2={scanY} stroke="#BEBEBE" strokeWidth="0.8" />
          <line x1="0" y1={scanY + 14} x2="120" y2={scanY + 14} stroke="#BEBEBE" strokeWidth="0.8" />
        </>
      )}
    </svg>
  );
};

const ScanPanel = ({ title, type, target = false, onMatch, scanProgress, style }) => (
  <Panel
    title={title}
    header={target ? GREEN_BAR : RED_BAR}
    bodyClass={`flex items-center ${target ? 'justify-center bg-black' : 'justify-between px-[0.65cqw]'}`}
    testId={`tr-${title.toLowerCase().replace(' ', '-')}`}
    style={style}
  >
    {!target && <div className="absolute inset-0" style={PANEL_TEXTURE} />}
    <div
      className={`relative z-10 overflow-hidden border border-[#AFAFAF] bg-[#303030] ${
        target ? 'h-[5.7cqw] w-[9.1cqw]' : 'h-[6.7cqw] w-[15.8cqw]'
      }`}
    >
      <ScanIcon type={type} scanProgress={target ? null : scanProgress} />
    </div>
    {!target && <PushButton onClick={onMatch} testId="tr-scan-match-button" />}
  </Panel>
);

const InfoPanel = ({ style }) => (
  <Panel title="Information" header={GREEN_BAR} bodyClass="bg-black px-[0.45cqw] py-[0.3cqw] text-white" style={style} testId="tr-information">
    <div className="grid grid-cols-3 gap-y-[0.3cqw] text-[0.93cqw] leading-none">
      <div><span className="mr-[0.25cqw] inline-block h-[1.05cqw] w-[1.05cqw] rounded-full border border-white align-middle" />Trucks</div>
      <div><span className="mr-[0.25cqw] inline-block h-[1.05cqw] w-[1.05cqw] border border-white align-middle" />Tanks</div>
      <div><span className="mr-[0.25cqw] inline-block h-0 w-0 border-b-[1.05cqw] border-l-[0.55cqw] border-r-[0.55cqw] border-b-white border-l-transparent border-r-transparent align-middle" />Buildings</div>
      <div><span className="mr-[0.3cqw] inline-block h-[0.65cqw] w-[0.65cqw] bg-[#D32A2A]" />Hostile</div>
      <div><span className="mr-[0.3cqw] inline-block h-[0.65cqw] w-[0.65cqw] bg-[#5873B5]" />Friendly</div>
      <div><span className="mr-[0.3cqw] inline-block h-[0.65cqw] w-[0.65cqw] bg-[#C5C940]" />Neutral</div>
      <div><span className="mr-[0.45cqw] inline-block text-[1.2cqw]">x</span>Damaged</div>
      <div className="col-span-2">
        <span className="mr-[0.35cqw] inline-block w-[2.2cqw] border-t border-white align-middle" />High Priority
      </div>
      <div><span className="mr-[0.3cqw] inline-block h-[0.85cqw] w-[0.85cqw] rounded-full bg-[#D00000]" />Beacon</div>
      <div className="col-span-2">
        <span className="mr-[0.45cqw] inline-block h-[0.8cqw] w-[0.8cqw] rotate-45 border border-[#DCDC42] align-middle" />Unknown
      </div>
    </div>
  </Panel>
);

const SystemPanel = ({ rows, rowDurationMs, onCode, style }) => {
  const loopRows = rows.length ? [...rows, ...rows] : [];
  const trackHeight = rows.length ? (loopRows.length / 19) * 100 : 100;
  const cycleDuration = Math.max(1, rows.length * rowDurationMs);
  return (
    <Panel title="System Panel" bodyClass="trt-system-viewport bg-[#3A3A3A] px-[0.8cqw]" style={style} testId="tr-system-panel">
      <div
        className="trt-system-track font-mono text-[#C9C9C9]"
        data-testid="tr-system-track"
        style={{
          height: `${trackHeight}%`,
          gridTemplateRows: `repeat(${Math.max(1, loopRows.length)}, minmax(0, 1fr))`,
          animationDuration: `${cycleDuration}ms`
        }}
      >
        {loopRows.map((row, loopIndex) => {
          const rowIndex = loopIndex % rows.length;
          const copyIndex = Math.floor(loopIndex / rows.length);
          return (
            <div
              key={`${copyIndex}-${rowIndex}`}
              className="trt-system-row grid min-h-0 grid-cols-3 items-center"
              data-system-row={rowIndex}
              data-system-copy={copyIndex}
            >
              {row.map((code, columnIndex) => (
                <button
                  type="button"
                  key={columnIndex}
                  data-testid={
                    copyIndex === 1
                      ? `tr-system-code-${rowIndex}-${columnIndex}`
                      : `tr-system-code-${rowIndex}-${columnIndex}-loop`
                  }
                  data-system-code={code}
                  onClick={() => onCode(code)}
                  className="trt-system-code min-w-0 bg-transparent text-left font-mono text-[#C9C9C9] focus:outline-none"
                  style={{ fontSize: '1.68cqw', letterSpacing: '0.28cqw' }}
                >
                  {code}
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </Panel>
  );
};

const SceneBackdrop = ({ distractors }) => (
  <svg viewBox="0 0 840 590" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
    <defs>
      <filter id="trt-noise" x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency="0.032 0.15" numOctaves="3" seed="12" />
        <feColorMatrix values="0.2 0 0 0 0.05  0 0.26 0 0 0.11  0 0 0.2 0 0.06  0 0 0 .34 0" />
      </filter>
    </defs>
    <rect width="840" height="590" fill="#263C2C" />
    <rect width="840" height="590" filter="url(#trt-noise)" opacity="0.75" />
    {distractors.map((item) => {
      const x = item.x * 8.4;
      const y = item.y * 5.9;
      if (item.type === 'line') {
        return (
          <line
            key={item.id}
            x1={x - item.size}
            y1={y + item.size / 2}
            x2={x + item.size}
            y2={y - item.size / 2}
            stroke={item.color}
            strokeWidth="2"
            opacity="0.34"
          />
        );
      }
      const sides = item.type === 'hexagon' ? 6 : 5;
      const points = Array.from({ length: sides }, (_, index) => {
        const angle = (index / sides) * Math.PI * 2 + item.rotation * Math.PI / 180;
        return `${x + Math.cos(angle) * item.size},${y + Math.sin(angle) * item.size}`;
      }).join(' ');
      return <polygon key={item.id} points={points} fill="none" stroke={item.color} strokeWidth="1.5" opacity="0.3" />;
    })}
    <g transform="translate(32 30)" opacity="0.88">
      <circle r="25" fill="#D7D7D7" stroke="#333333" strokeWidth="3" />
      <circle r="19" fill="#BEBEBE" stroke="#6A6A6A" />
      <text y="-11" textAnchor="middle" fill="#B02020" fontSize="9">N</text>
      <text x="12" y="3" textAnchor="middle" fill="#333333" fontSize="8">E</text>
      <text y="16" textAnchor="middle" fill="#333333" fontSize="8">S</text>
      <text x="-12" y="3" textAnchor="middle" fill="#333333" fontSize="8">W</text>
      <line x1="0" y1="6" x2="0" y2="-15" stroke="#D02020" strokeWidth="2" />
      <polygon points="0,-18 -4,-10 4,-10" fill="#D02020" />
    </g>
  </svg>
);

const SceneSymbol = ({ item, clicked, onClick }) => {
  const affiliation = AFFILIATIONS.find((entry) => entry.id === item.affiliation);
  const kind = SCENE_KINDS.find((entry) => entry.id === item.kind);
  const color = affiliation?.color || '#D0D047';

  return (
    <button
      type="button"
      onClick={() => onClick(item.id)}
      aria-label="Scene symbol"
      className={`absolute z-10 h-[4.1cqw] w-[4.1cqw] -translate-x-1/2 -translate-y-1/2 cursor-crosshair focus:outline-none ${
        clicked ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
      style={{
        left: `${item.x}%`,
        top: `${item.y}%`,
        transition: 'opacity 120ms linear',
        touchAction: 'manipulation'
      }}
      data-testid={`tr-scene-symbol-${item.id}`}
      data-scene-type={item.type}
      data-scene-kind={item.kind || ''}
      data-scene-affiliation={item.affiliation || ''}
      data-scene-direction={item.direction || ''}
      data-scene-damaged={item.damaged ? 'true' : 'false'}
      data-scene-priority={item.highPriority ? 'true' : 'false'}
    >
      <svg viewBox="0 0 48 48" className="h-full w-full overflow-visible">
        {item.type === 'unknown' && (
          <rect x="19" y="19" width="10" height="10" fill="none" stroke="#D6D642" strokeWidth="2.2" transform="rotate(45 24 24)" />
        )}
        {item.type === 'beacon' && (
          <>
            <circle cx="24" cy="24" r="6" fill="#C31818" opacity="0.38" />
            <circle cx="24" cy="24" r="3" fill="#E00000" />
          </>
        )}
        {item.type === 'semantic' && (
          <g opacity="0.72">
            {kind?.shape === 'circle' && <circle cx="24" cy="24" r="8" fill="none" stroke={color} strokeWidth="2.2" />}
            {kind?.shape === 'square' && <rect x="17" y="17" width="14" height="14" fill="none" stroke={color} strokeWidth="2.2" />}
            {kind?.shape === 'triangle' && <polygon points="24,14 34,33 14,33" fill="none" stroke={color} strokeWidth="2.2" />}
            {item.damaged && <text x="24" y="28" fill={color} fontSize="14" textAnchor="middle">x</text>}
            {item.highPriority && <line x1="5" y1="24" x2="43" y2="24" stroke={color} strokeWidth="2" />}
            {item.direction && (
              <g transform={`rotate(${DIR_DEG[item.direction]} 24 24)`}>
                <line x1="24" y1="41" x2="24" y2="7" stroke={color} strokeWidth="2" />
                <polygon points="24,4 19,13 29,13" fill={color} />
              </g>
            )}
          </g>
        )}
        <circle cx="24" cy="24" r="21" fill="transparent" />
      </svg>
    </button>
  );
};

const ScenePanel = ({ items, distractors, clickedIds, onSceneClick, style }) => (
  <Panel title="Scene Panel" bodyClass="bg-[#263C2C]" style={style} testId="tr-scene-panel">
    <SceneBackdrop distractors={distractors} />
    {items.map((item) => (
      <SceneSymbol
        key={item.id}
        item={item}
        clicked={clickedIds.has(item.id)}
        onClick={onSceneClick}
      />
    ))}
  </Panel>
);

const SceneTarget = ({ tasks, style }) => (
  <Panel title="Scene Target" header={GREEN_BAR} bodyClass="flex flex-col items-end justify-center bg-black px-[2.2cqw] text-[#DCDC42]" style={style} testId="tr-scene-target">
    {tasks.map((task) => (
      <div key={task.id} data-testid={`tr-scene-task-${task.id}`} style={{ fontSize: '1.55cqw', lineHeight: '1.9cqw' }}>{task.label}</div>
    ))}
  </Panel>
);

const SystemTarget = ({ code, style }) => (
  <Panel title="System Target" header={GREEN_BAR} bodyClass="flex items-center justify-center bg-black font-mono text-[#D0D0D0]" style={style} testId="tr-system-target">
    <span data-testid="tr-system-target-code" style={{ fontSize: '2.45cqw', letterSpacing: '0.5cqw' }}>{code}</span>
  </Panel>
);

const TargetRecognition = () => {
  const navigate = useNavigate();
  const [stage, setStage] = useState('menu');
  const [mode, setMode] = useState(null);
  const [difficulty, setDifficulty] = useState(null);
  const [cfg, setCfg] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [lightTarget, setLightTarget] = useState(genLights);
  const [lightPanel, setLightPanel] = useState(genLights);
  const [scanTarget, setScanTarget] = useState(() => pick(SCAN_TYPES));
  const [scanPanel, setScanPanel] = useState(() => pick(SCAN_TYPES));
  const [scanProgress, setScanProgress] = useState(0);
  const [systemTarget, setSystemTarget] = useState(randCode);
  const [systemRows, setSystemRows] = useState([]);
  const [sceneItems, setSceneItems] = useState([]);
  const [sceneDistractors, setSceneDistractors] = useState([]);
  const [sceneTasks, setSceneTasks] = useState([]);
  const [clickedSceneIds, setClickedSceneIds] = useState(new Set());
  const [score, setScore] = useState(EMPTY_SCORE);
  const [responses, setResponses] = useState([]);

  const cfgRef = useRef(null);
  const scoreRef = useRef(EMPTY_SCORE);
  const lightTargetRef = useRef(lightTarget);
  const scanTargetRef = useRef(scanTarget);
  const systemRowsRef = useRef([]);
  const sceneTasksRef = useRef([]);
  const sceneObjectiveQueueRef = useRef([]);
  const scenePartRef = useRef(1);
  const attemptedSceneRef = useRef(new Set());
  const clickedSceneRef = useRef(new Set());
  const lightCycleRef = useRef(0);
  const scanCycleRef = useRef(0);
  const systemScrollStartedAtRef = useRef(0);
  const savedRef = useRef(false);

  useEffect(() => {
    lightTargetRef.current = lightTarget;
  }, [lightTarget]);

  useEffect(() => {
    scanTargetRef.current = scanTarget;
  }, [scanTarget]);

  const syncScore = useCallback(() => setScore({ ...scoreRef.current }), []);

  const resetSystem = useCallback(() => {
    const target = randCode();
    const rows = makeSystemRows(target);
    setSystemTarget(target);
    setSystemRows(rows);
    systemRowsRef.current = rows;
    systemScrollStartedAtRef.current = performance.now();
  }, []);

  const advanceSystemTarget = useCallback(() => {
    const rows = systemRowsRef.current;
    if (!rows.length) return;
    const timing = TIMING[difficulty] || TIMING.medium;
    const elapsedMs = Math.max(0, performance.now() - systemScrollStartedAtRef.current);
    const phaseRows = (elapsedMs / timing.systemRowMs) % rows.length;
    const firstVisibleRow = (
      rows.length - Math.ceil(phaseRows) + rows.length
    ) % rows.length;
    const candidatePositions = shuffle([2, 3, 4, 5, 6, 7]);
    let nextTarget = null;
    for (const position of candidatePositions) {
      const row = rows[(firstVisibleRow + position) % rows.length];
      const candidates = shuffle(row.filter((code) => code !== systemTarget));
      if (candidates.length) {
        [nextTarget] = candidates;
        break;
      }
    }
    if (nextTarget) setSystemTarget(nextTarget);
  }, [difficulty, systemTarget]);

  const resetScene = useCallback((activeCfg = cfgRef.current) => {
    const scene = makeScene(activeCfg?.distractorCount || 10);
    setSceneItems(scene.items);
    setSceneDistractors(scene.distractors);
    const [firstTask, ...queuedTasks] = scene.tasks;
    const initialTasks = firstTask ? [firstTask] : [];
    setSceneTasks(initialTasks);
    sceneTasksRef.current = initialTasks;
    sceneObjectiveQueueRef.current = queuedTasks;
    attemptedSceneRef.current = new Set();
    clickedSceneRef.current = new Set();
    setClickedSceneIds(new Set());
  }, []);

  const activateNextSceneObjective = useCallback(() => {
    let nextTask = null;
    while (sceneObjectiveQueueRef.current.length && !nextTask) {
      const [candidate, ...remainingQueue] = sceneObjectiveQueueRef.current;
      sceneObjectiveQueueRef.current = remainingQueue;
      const remainingMatches = candidate.matches.filter((id) => !clickedSceneRef.current.has(id));
      if (remainingMatches.length) nextTask = { ...candidate, matches: remainingMatches };
    }
    if (!nextTask) return;

    const attempted = new Set(attemptedSceneRef.current);
    nextTask.matches.forEach((id) => attempted.delete(id));
    attemptedSceneRef.current = attempted;

    const nextTasks = [...sceneTasksRef.current, nextTask];
    sceneTasksRef.current = nextTasks;
    setSceneTasks(nextTasks);
  }, []);

  const start = () => {
    const nextCfg = getSettings().targetRecognition[difficulty];
    const nextLightTarget = genLights();
    const nextScanTarget = pick(SCAN_TYPES);
    cfgRef.current = nextCfg;
    scoreRef.current = { ...EMPTY_SCORE };
    lightTargetRef.current = nextLightTarget;
    scanTargetRef.current = nextScanTarget;
    scenePartRef.current = 1;
    lightCycleRef.current = 0;
    scanCycleRef.current = 0;
    savedRef.current = false;
    setCfg(nextCfg);
    setElapsed(0);
    setResponses([]);
    setScore({ ...EMPTY_SCORE });
    setLightTarget(nextLightTarget);
    setLightPanel(genLights());
    setScanTarget(nextScanTarget);
    setScanPanel(pick(SCAN_TYPES));
    setScanProgress(0);
    resetSystem();
    resetScene(nextCfg);
    setStage('test');
  };

  useEffect(() => {
    if (stage !== 'test') return undefined;
    const timing = TIMING[difficulty] || TIMING.medium;
    const elapsedTimer = setInterval(() => setElapsed((value) => value + 1), 1000);
    const lightTimer = setInterval(() => {
      lightCycleRef.current += 1;
      const shouldMatch = lightCycleRef.current % timing.forcedLight === 0;
      setLightPanel(shouldMatch ? lightTargetRef.current.map((light) => ({ ...light })) : genLights());
    }, timing.lightMs);
    const scanTimer = setInterval(() => {
      setScanProgress((progress) => {
        const next = progress + timing.scanStep;
        if (next < 1) return next;
        scanCycleRef.current += 1;
        const shouldMatch = scanCycleRef.current % timing.forcedScan === 0;
        setScanPanel(shouldMatch ? scanTargetRef.current : pick(SCAN_TYPES));
        return 0;
      });
    }, 100);
    return () => {
      clearInterval(elapsedTimer);
      clearInterval(lightTimer);
      clearInterval(scanTimer);
    };
  }, [difficulty, stage]);

  useEffect(() => {
    if (stage === 'test' && cfg && elapsed >= cfg.testDuration) setStage('results');
  }, [cfg, elapsed, stage]);

  useEffect(() => {
    if (stage !== 'test' || !cfg) return;
    const currentPart = Math.min(
      7,
      Math.floor(elapsed / Math.max(1, cfg.testDuration / 7)) + 1
    );
    while (scenePartRef.current < currentPart) {
      scenePartRef.current += 1;
      activateNextSceneObjective();
    }
  }, [activateNextSceneObjective, cfg, elapsed, stage]);

  const clickLightMatch = () => {
    const hit = lightsMatch(lightTarget, lightPanel);
    setResponses((current) => [...current, {
      prompt: 'Light Panel match',
      given: lightPanel.map((light) => light.name).join(', '),
      answer: lightTarget.map((light) => light.name).join(', '),
      correct: hit
    }]);
    if (hit) {
      scoreRef.current.light += 1;
      const nextTarget = genLights();
      lightTargetRef.current = nextTarget;
      setLightTarget(nextTarget);
    } else {
      scoreRef.current.lightMiss += 1;
    }
    syncScore();
  };

  const clickScanMatch = () => {
    const hit = scanTarget === scanPanel;
    setResponses((current) => [...current, {
      prompt: 'Scan Panel match',
      given: scanPanel,
      answer: scanTarget,
      correct: hit
    }]);
    if (hit) {
      scoreRef.current.scan += 1;
      const nextTarget = pick(SCAN_TYPES);
      scanTargetRef.current = nextTarget;
      setScanTarget(nextTarget);
    } else {
      scoreRef.current.scanMiss += 1;
    }
    syncScore();
  };

  const clickSystemCode = (code) => {
    const hit = code === systemTarget;
    setResponses((current) => [...current, {
      prompt: 'System code selection',
      given: code,
      answer: systemTarget,
      correct: hit
    }]);
    if (hit) {
      scoreRef.current.system += 1;
      advanceSystemTarget();
    } else {
      scoreRef.current.systemMiss += 1;
    }
    syncScore();
  };

  const clickScene = (id) => {
    if (attemptedSceneRef.current.has(id) || !sceneTasksRef.current.length) return;
    attemptedSceneRef.current.add(id);
    const matchingTasks = sceneTasksRef.current.filter((task) => task.matches.includes(id));
    const hit = matchingTasks.length > 0;
    const selected = sceneItems.find((item) => item.id === id);

    setResponses((current) => [...current, {
      prompt: 'Scene target selection',
      detail: sceneTasksRef.current.map((task) => task.label).join(' / '),
      given: selected?.type === 'semantic'
        ? `${selected.affiliation} ${selected.kind} ${selected.direction || ''}`.trim()
        : selected?.type || id,
      answer: hit ? matchingTasks.map((task) => task.label).join(' / ') : 'A displayed Scene Target',
      correct: hit
    }]);

    if (!hit) {
      scoreRef.current.sceneMiss += 1;
      syncScore();
      return;
    }

    scoreRef.current.scene += 1;
    clickedSceneRef.current.add(id);
    const clicked = new Set(clickedSceneRef.current);
    setClickedSceneIds(clicked);
    const remainingTasks = sceneTasksRef.current.filter((task) => (
      !task.matches.every((matchId) => clicked.has(matchId))
    ));
    sceneTasksRef.current = remainingTasks;
    setSceneTasks(remainingTasks);
    syncScore();
  };

  useEffect(() => {
    if (stage !== 'results' || mode !== 'assessment' || savedRef.current) return;
    savedRef.current = true;
    const latest = scoreRef.current;
    const hits = latest.light + latest.scan + latest.system + latest.scene;
    const misses = latest.lightMiss + latest.scanMiss + latest.systemMiss + latest.sceneMiss;
    saveResult('Target Recognition', mode, difficulty, {
      accuracy: hits + misses ? (hits / (hits + misses)) * 100 : 0,
      ...latest
    });
  }, [difficulty, mode, stage]);

  if (stage === 'menu') {
    return (
      <ModuleMenu
        title="Target Recognition Test - Setup"
        description="Monitor four simultaneous target tasks: Light, Scan, System, and Scene. Select a panel only when it matches its target, and click every symbol requested in Scene Target."
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
    const hits = score.light + score.scan + score.system + score.scene;
    const misses = score.lightMiss + score.scanMiss + score.systemMiss + score.sceneMiss;
    const accuracy = hits + misses ? (hits / (hits + misses)) * 100 : 0;
    return (
      <ModuleResults
        title="Target Recognition - Results"
        rows={[
          ['Light Hits', `${score.light} / ${score.light + score.lightMiss}`],
          ['Scan Hits', `${score.scan} / ${score.scan + score.scanMiss}`],
          ['System Hits', `${score.system} / ${score.system + score.systemMiss}`],
          ['Scene Hits', `${score.scene} / ${score.scene + score.sceneMiss}`]
        ]}
        overallScore={accuracy}
        summary={responses}
        onRetry={() => setStage('menu')}
        onDashboard={() => navigate('/')}
      />
    );
  }

  const testPart = Math.min(7, Math.floor(elapsed / Math.max(1, cfg.testDuration / 7)) + 1);
  const positions = {
    information: { left: '1.44%', top: '6.02%', width: '20.80%', height: '12.36%' },
    lightPanel: { left: '23.25%', top: '6.02%', width: '23.75%', height: '12.36%' },
    scanPanel: { left: '48.10%', top: '6.02%', width: '24.60%', height: '12.36%' },
    systemPanel: { left: '73.71%', top: '6.02%', width: '24.77%', height: '78.88%' },
    scenePanel: { left: '1.44%', top: '19.43%', width: '71.26%', height: '65.47%' },
    sceneTarget: { left: '1.44%', top: '86.06%', width: '57.99%', height: '12.57%' },
    lightTarget: { left: '60.35%', top: '86.06%', width: '11.75%', height: '12.57%' },
    scanTarget: { left: '73.12%', top: '86.06%', width: '10.40%', height: '12.57%' },
    systemTarget: { left: '84.53%', top: '86.06%', width: '13.95%', height: '12.57%' }
  };

  return (
    <main
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black"
      style={{ fontFamily: "'Arial', 'Helvetica', sans-serif" }}
    >
      <div
        className="relative aspect-[1183/947] max-h-screen overflow-hidden border-2 border-white"
        style={{ width: 'min(100vw, 124.92vh)', backgroundColor: BLUE, containerType: 'inline-size' }}
        data-testid="trt-screen"
      >
        <div
          className="absolute left-0 top-0 flex w-full items-center justify-center border-b-2 border-white text-white"
          style={{ height: '4.45%', fontSize: '1.65cqw' }}
        >
          Target Recognition Test - Testing ({testPart} of 7)
        </div>

        <InfoPanel style={positions.information} />
        <LightPanel title="Light Panel" lights={lightPanel} onMatch={clickLightMatch} style={positions.lightPanel} />
        <ScanPanel title="Scan Panel" type={scanPanel} scanProgress={scanProgress} onMatch={clickScanMatch} style={positions.scanPanel} />
        <SystemPanel
          rows={systemRows}
          rowDurationMs={(TIMING[difficulty] || TIMING.medium).systemRowMs}
          onCode={clickSystemCode}
          style={positions.systemPanel}
        />
        <ScenePanel
          items={sceneItems}
          distractors={sceneDistractors}
          clickedIds={clickedSceneIds}
          onSceneClick={clickScene}
          style={positions.scenePanel}
        />
        <SceneTarget tasks={sceneTasks} style={positions.sceneTarget} />
        <LightPanel title="Light Target" lights={lightTarget} target style={positions.lightTarget} />
        <ScanPanel title="Scan Target" type={scanTarget} target style={positions.scanTarget} />
        <SystemTarget code={systemTarget} style={positions.systemTarget} />
      </div>
    </main>
  );
};

export default TargetRecognition;
