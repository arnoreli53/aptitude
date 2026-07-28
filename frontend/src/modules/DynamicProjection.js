import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getSettings, saveResult } from '../utils/storage';
import { ModuleMenu, ModuleResults } from './cbtCommon';

const DISPLAY_SIZE = 930;
const DISPLAY_CENTER = DISPLAY_SIZE / 2;
const WORLD_SCALE = DISPLAY_SIZE / 100;
const CONTROLLED_IDS = ['CA-A', 'CA-N', 'CA-G'];

const AIRCRAFT_TEMPLATE = [
  {
    id: 'CA-A',
    color: '#D50B2F',
    x: 25,
    y: 80,
    alt: 25,
    targetAlt: 25,
    heading: 20,
    turnDirection: 1,
    turnRemaining: 0,
    speed: 1.25,
    mission: 'alpha',
    gateIndex: 0
  },
  {
    id: 'CA-N',
    color: '#FFF100',
    x: 80,
    y: 82,
    alt: 70,
    targetAlt: 70,
    heading: 330,
    turnDirection: -1,
    turnRemaining: 0,
    speed: 1.2,
    mission: 'numeric',
    gateIndex: 0
  },
  {
    id: 'CA-G',
    color: '#16D85A',
    x: 19,
    y: 26,
    alt: 45,
    targetAlt: 45,
    heading: 92,
    turnDirection: 1,
    turnRemaining: 0,
    speed: 1.4,
    mission: 'intercept',
    gateIndex: 0
  },
  {
    id: 'UA',
    color: '#FFFFFF',
    x: 76,
    y: 25,
    alt: 47,
    targetAlt: 47,
    heading: 235,
    turnDirection: 1,
    turnRemaining: 0,
    speed: 0.95,
    mission: 'unknown',
    gateIndex: 0
  }
];

const GATES = [
  { label: 'A', kind: 'alpha', order: 0, x: 35, y: 49, angle: -54 },
  { label: 'B', kind: 'alpha', order: 1, x: 56, y: 60, angle: -42 },
  { label: 'C', kind: 'alpha', order: 2, x: 72, y: 34, angle: 18 },
  { label: 'D', kind: 'alpha', order: 3, x: 48, y: 20, angle: 54 },
  { label: '1', kind: 'numeric', order: 0, x: 65, y: 52, angle: 34 },
  { label: '2', kind: 'numeric', order: 1, x: 72, y: 27, angle: -32 },
  { label: '3', kind: 'numeric', order: 2, x: 46, y: 27, angle: 48 },
  { label: '4', kind: 'numeric', order: 3, x: 30, y: 45, angle: -12 }
];

const DANGER_AREAS = [
  { id: 'D-30', x: 66, y: 68, radius: 5.2, alt: 30, outline: 'black' },
  { id: 'D-20', x: 37, y: 35, radius: 4.6, alt: 20, outline: 'white' }
];

const DIFFICULTY = {
  easy: { speedScale: 0.82, turnRate: 58, altitudeRate: 4.5 },
  medium: { speedScale: 1, turnRate: 52, altitudeRate: 4 },
  hard: { speedScale: 1.16, turnRate: 46, altitudeRate: 3.5 }
};

const cloneAircraft = () => AIRCRAFT_TEMPLATE.map((aircraft) => ({ ...aircraft }));
const normalizeBearing = (bearing) => ((bearing % 360) + 360) % 360;
const pad3 = (value) => String(Math.round(normalizeBearing(Number(value) || 0))).padStart(3, '0');
const padAltitude = (value) => String(Math.max(0, Math.round(Number(value) || 0))).padStart(3, '0');
const distanceBetween = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const toDisplay = (x, y) => ({ x: x * WORLD_SCALE, y: y * WORLD_SCALE });
const polar = (radius, bearing) => {
  const radians = (bearing - 90) * Math.PI / 180;
  return {
    x: DISPLAY_CENTER + Math.cos(radians) * radius,
    y: DISPLAY_CENTER + Math.sin(radians) * radius
  };
};

const activeIdsForPhase = (phase) => {
  if (phase === 1) return ['CA-A'];
  if (phase === 2) return ['CA-A', 'CA-N'];
  return ['CA-A', 'CA-N', 'CA-G', 'UA'];
};

const visibleGatesForPhase = (phase) => {
  if (phase === 1) return GATES.filter((gate) => gate.kind === 'alpha' && gate.order < 2);
  return GATES.filter((gate) => gate.kind !== 'alpha' || gate.order < 4);
};

const scoreForStats = ({ gates, intercepts, violations }) => {
  const successes = gates + intercepts * 2;
  if (!successes) return 0;
  return Math.max(0, Math.round(100 * successes / (successes + violations)));
};

const DigitReadout = ({ value, testId }) => (
  <div className="flex gap-[0.22cqw]" data-testid={testId}>
    {String(value).padStart(3, ' ').slice(-3).split('').map((digit, index) => (
      <span
        key={index}
        className="flex h-[2.4cqw] w-[2.4cqw] items-center justify-center border border-[#555555] bg-[#171717] font-mono text-[1.7cqw] font-bold text-[#BDBDBD]"
      >
        {digit}
      </span>
    ))}
  </div>
);

const HeaderMeters = ({ remaining, duration }) => {
  const timePercent = duration ? Math.max(0, remaining / duration * 100) : 0;
  const progressPercent = duration ? Math.min(100, (duration - remaining) / duration * 100) : 0;
  return (
    <div className="h-full border-b-2 border-r-2 border-white px-[0.55cqw] py-[0.35cqw] text-[0.88cqw] leading-none text-white">
      <div className="grid h-1/2 grid-cols-[4.2cqw_1fr] items-center">
        <span className="text-center">Time</span>
        <div className="h-[0.9cqw] border border-white bg-[#15152E] p-[0.08cqw]">
          <div className="h-full bg-[#BFC8DA]" style={{ width: `${timePercent}%` }} />
        </div>
      </div>
      <div className="grid h-1/2 grid-cols-[4.2cqw_1fr] items-center">
        <span className="text-center">Progress</span>
        <div className="h-[0.9cqw] border border-white bg-[#15152E] p-[0.08cqw]">
          <div className="h-full bg-[#18A44D]" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>
    </div>
  );
};

const MissionDot = ({ color, outlined = false }) => (
  <span
    className="inline-block h-[1.25cqw] w-[1.25cqw] shrink-0 rounded-full border-[0.2cqw] border-black"
    style={{ backgroundColor: color, borderColor: outlined ? '#FFFFFF' : '#090909' }}
  />
);

const DptLegend = () => (
  <div
    className="h-full border-r-2 border-white bg-[#000080] text-black"
    data-testid="dpt-legend"
  >
    <div className="h-[62.4%] bg-[#C9DAEC] text-[0.94cqw]">
      <div className="grid h-[8.3%] grid-cols-[7.5cqw_1fr] border-b border-black">
        <div className="flex items-center justify-center bg-white text-center leading-tight">CA<br />Mission</div>
        <div className="flex flex-col justify-center gap-[0.35cqw] px-[0.8cqw]">
          <div className="flex items-center gap-[0.65cqw]"><MissionDot color="#D50B2F" /> CA-A&nbsp; : &nbsp;Alphabetical Order</div>
          <div className="flex items-center gap-[0.65cqw]"><MissionDot color="#FFF100" /> CA-N&nbsp; : &nbsp;Numerical Order</div>
        </div>
      </div>

      <div className="grid h-[5.5%] grid-cols-[7.5cqw_1fr] border-b border-black">
        <div className="flex items-center justify-center bg-white">UA</div>
        <div className="flex items-center px-[0.8cqw]"><MissionDot color="#FFFFFF" /></div>
      </div>

      <div className="grid h-[18.1%] grid-cols-[7.5cqw_1fr] border-b border-black">
        <div className="flex items-center justify-center bg-white text-center leading-snug">Danger<br />Areas</div>
        <div className="flex flex-col justify-center gap-[0.8cqw] px-[0.9cqw]">
          <div className="flex items-center gap-[1.4cqw]">
            <span className="h-[2.65cqw] w-[2.65cqw] rounded-full border-[0.2cqw] border-white bg-[#9D0909]" />
            <span>2000 ft (020)</span>
          </div>
          <div className="flex items-center gap-[1.4cqw]">
            <span className="h-[2.65cqw] w-[2.65cqw] rounded-full border-[0.2cqw] border-black bg-[#9D0909]" />
            <span>3000 ft (030)</span>
          </div>
        </div>
      </div>

      <div className="grid h-[24.7%] grid-cols-[7.5cqw_1fr] border-b border-black">
        <div className="flex items-center justify-center bg-white text-center leading-snug">Range<br />Rings</div>
        <div className="flex items-center overflow-hidden">
          <svg viewBox="0 0 250 140" className="h-full w-full" aria-label="Range ring spacing">
            {[35, 125, 215].map((x) => (
              <path key={x} d={`M${x} -8 C${x - 25} 40 ${x - 25} 100 ${x} 148`} fill="none" stroke="#050530" strokeWidth="2" />
            ))}
            <line x1="35" y1="68" x2="125" y2="68" stroke="#FF2020" strokeWidth="2" />
            <path d="M35 68 L45 62 M35 68 L45 74 M125 68 L115 62 M125 68 L115 74" fill="none" stroke="#FF2020" strokeWidth="2" />
            <line x1="125" y1="68" x2="215" y2="68" stroke="#FF2020" strokeWidth="2" />
            <path d="M125 68 L135 62 M125 68 L135 74 M215 68 L205 62 M215 68 L205 74" fill="none" stroke="#FF2020" strokeWidth="2" />
            <text x="80" y="59" textAnchor="middle" fontSize="16">10 nms</text>
            <text x="170" y="59" textAnchor="middle" fontSize="16">5 nms</text>
          </svg>
        </div>
      </div>

      <div className="flex h-[10.6%] flex-col justify-center border-b-[0.5cqw] border-[#000080] bg-white px-[0.55cqw] text-[0.85cqw] leading-[1.45]">
        <div>Avoid Danger Areas vertically by 1000 ft (010).</div>
        <div>Avoid other aircraft laterally by 5 nms.</div>
        <div>Avoid other aircraft vertically by 3000 ft (030).</div>
      </div>

      <div className="h-[32.8%] bg-white px-[0.6cqw] py-[0.45cqw] text-[0.84cqw] leading-[1.55]">
        <div>Bearings are given in degrees:</div>
        <div>&bull; 1&deg; will show as 001.</div>
        <div>&bull; 10&deg; will show as 010.</div>
        <div>&bull; 100&deg; will show as 100.</div>
        <div className="mt-[1.1cqw]">Height is given in hundreds of feet:</div>
        <div>&bull; 100ft will show as 001.</div>
        <div>&bull; 1000ft will show as 010.</div>
        <div>&bull; 10000ft will show as 100.</div>
      </div>
    </div>
  </div>
);

const RadarGate = ({ gate }) => {
  const point = toDisplay(gate.x, gate.y);
  const radians = gate.angle * Math.PI / 180;
  const dx = Math.cos(radians) * 22;
  const dy = Math.sin(radians) * 22;
  return (
    <g data-testid={`dpt-gate-${gate.label.toLowerCase()}`}>
      <line
        x1={point.x - dx}
        y1={point.y - dy}
        x2={point.x + dx}
        y2={point.y + dy}
        stroke="#6F77D8"
        strokeWidth="1.4"
      />
      <circle cx={point.x - dx} cy={point.y - dy} r="5" fill="#FF7A00" />
      <circle cx={point.x + dx} cy={point.y + dy} r="5" fill="#FF7A00" />
      <text x={point.x + dx + 8} y={point.y + dy - 5} fill="white" fontSize="22">{gate.label}</text>
    </g>
  );
};

const AircraftTrack = ({ aircraft, selected, onSelect }) => {
  const point = toDisplay(aircraft.x, aircraft.y);
  const headingRadians = aircraft.heading * Math.PI / 180;
  const backX = -Math.sin(headingRadians);
  const backY = Math.cos(headingRadians);
  const crossX = Math.cos(headingRadians);
  const crossY = Math.sin(headingRadians);
  const isUnknown = aircraft.id === 'UA';

  return (
    <g
      role={isUnknown ? undefined : 'button'}
      aria-label={isUnknown ? 'Unknown aircraft' : `Select ${aircraft.id}`}
      onClick={isUnknown ? undefined : () => onSelect(aircraft.id)}
      className={isUnknown ? '' : 'cursor-pointer'}
      data-testid={`dpt-aircraft-${aircraft.id.toLowerCase()}`}
    >
      {!isUnknown && [1, 2, 3, 4].map((step) => {
        const trailX = point.x + backX * (14 + step * 6);
        const trailY = point.y + backY * (14 + step * 6);
        const halfWidth = 5 - step * 0.45;
        return (
          <line
            key={step}
            x1={trailX - crossX * halfWidth}
            y1={trailY - crossY * halfWidth}
            x2={trailX + crossX * halfWidth}
            y2={trailY + crossY * halfWidth}
            stroke="#C7BD12"
            strokeWidth="1.3"
          />
        );
      })}
      {selected && <circle cx={point.x} cy={point.y} r="17" fill="none" stroke="#6F78D4" strokeWidth="2" />}
      <circle cx={point.x} cy={point.y} r={isUnknown ? 6 : 11} fill="#15152F" stroke="#050510" strokeWidth="2" />
      <circle cx={point.x} cy={point.y} r={isUnknown ? 4 : 6.5} fill={aircraft.color} />
      <circle cx={point.x} cy={point.y} r={isUnknown ? 18 : 25} fill="transparent" />
      <text x={point.x + 19} y={point.y - 4} fill="white" fontSize="21">{aircraft.id}</text>
      <text x={point.x + 19} y={point.y + 17} fill="white" fontSize="21">{padAltitude(aircraft.alt)}</text>
    </g>
  );
};

const ProjectionDisplay = ({
  aircraft,
  dangerAreas,
  gates,
  onSelect,
  selectedId
}) => {
  const bearings = useMemo(() => Array.from({ length: 36 }, (_, index) => index * 10), []);
  return (
    <svg
      viewBox={`0 0 ${DISPLAY_SIZE} ${DISPLAY_SIZE}`}
      preserveAspectRatio="xMidYMid meet"
      className="block h-full w-full bg-[#1B1B4B]"
      data-testid="dpt-projection-display"
    >
      <rect width={DISPLAY_SIZE} height={DISPLAY_SIZE} fill="#1B1B4B" />
      {[80, 160, 240, 320, 400, 480].map((radius) => (
        <circle key={radius} cx={DISPLAY_CENTER} cy={DISPLAY_CENTER} r={radius} fill="none" stroke="#07072A" strokeWidth="1.7" />
      ))}
      {bearings.map((bearing) => {
        const inner = polar(461, bearing);
        const outer = polar(481, bearing);
        const label = polar(435, bearing);
        return (
          <g key={bearing}>
            <line x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke="white" strokeWidth="4" />
            <text x={label.x} y={label.y + 7} fill="white" fontSize="21" textAnchor="middle">
              {bearing === 0 ? '360' : String(bearing).padStart(3, '0')}
            </text>
          </g>
        );
      })}
      <line x1={DISPLAY_CENTER - 10} y1={DISPLAY_CENTER} x2={DISPLAY_CENTER + 10} y2={DISPLAY_CENTER} stroke="#7777DD" strokeWidth="1.4" />
      <line x1={DISPLAY_CENTER} y1={DISPLAY_CENTER - 10} x2={DISPLAY_CENTER} y2={DISPLAY_CENTER + 10} stroke="#7777DD" strokeWidth="1.4" />

      {dangerAreas.map((area) => {
        const point = toDisplay(area.x, area.y);
        return (
          <circle
            key={area.id}
            cx={point.x}
            cy={point.y}
            r={area.radius * WORLD_SCALE}
            fill="#8E0909"
            stroke={area.outline === 'black' ? '#050505' : '#FFFFFF'}
            strokeWidth="3"
            data-testid={`dpt-danger-${area.id.toLowerCase()}`}
          />
        );
      })}
      {gates.map((gate) => <RadarGate key={`${gate.kind}-${gate.label}`} gate={gate} />)}
      {aircraft.map((track) => (
        <AircraftTrack
          key={track.id}
          aircraft={track}
          selected={track.id === selectedId}
          onSelect={onSelect}
        />
      ))}
    </svg>
  );
};

const DirectionButton = ({ direction, active, onClick, axis }) => {
  const Icon = direction === 'left'
    ? ArrowLeft
    : direction === 'right'
      ? ArrowRight
      : direction === 'up'
        ? ArrowUp
        : ArrowDown;
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${direction[0].toUpperCase()}${direction.slice(1)} ${axis}`}
      aria-label={`${direction} ${axis}`}
      className={`flex h-[2.55cqw] w-[2.55cqw] items-center justify-center border ${
        active ? 'border-white bg-[#404040] text-white' : 'border-[#555555] bg-[#202020] text-[#777777]'
      }`}
    >
      <Icon className="h-[1.55cqw] w-[1.55cqw]" strokeWidth={3} />
    </button>
  );
};

const DynamicProjection = () => {
  const navigate = useNavigate();
  const [stage, setStage] = useState('menu');
  const [mode, setMode] = useState(null);
  const [difficulty, setDifficulty] = useState(null);
  const [cfg, setCfg] = useState(null);
  const [aircraft, setAircraft] = useState(() => cloneAircraft());
  const [selectedId, setSelectedId] = useState('CA-A');
  const [phase, setPhase] = useState(1);
  const [remaining, setRemaining] = useState(0);
  const [turnDirection, setTurnDirection] = useState(1);
  const [verticalDirection, setVerticalDirection] = useState(1);
  const [commandField, setCommandField] = useState(null);
  const [headingInput, setHeadingInput] = useState('');
  const [altitudeInput, setAltitudeInput] = useState('');
  const [events, setEvents] = useState([]);
  const [stats, setStats] = useState({ gates: 0, intercepts: 0, violations: 0, commands: 0 });

  const aircraftRef = useRef(aircraft);
  const selectedIdRef = useRef(selectedId);
  const cfgRef = useRef(cfg);
  const startTimeRef = useRef(0);
  const lastFrameRef = useRef(0);
  const rafRef = useRef(null);
  const eventsRef = useRef([]);
  const statsRef = useRef(stats);
  const contactsRef = useRef(new Set());
  const savedRef = useRef(false);

  useEffect(() => {
    aircraftRef.current = aircraft;
  }, [aircraft]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  const addEvent = useCallback((event) => {
    const next = [...eventsRef.current, event];
    eventsRef.current = next;
    setEvents(next);
  }, []);

  const incrementStat = useCallback((field, amount = 1) => {
    const next = { ...statsRef.current, [field]: statsRef.current[field] + amount };
    statsRef.current = next;
    setStats(next);
  }, []);

  const start = () => {
    const nextCfg = getSettings().dynamicProjection[difficulty];
    const nextAircraft = cloneAircraft();
    cfgRef.current = nextCfg;
    aircraftRef.current = nextAircraft;
    selectedIdRef.current = 'CA-A';
    eventsRef.current = [];
    statsRef.current = { gates: 0, intercepts: 0, violations: 0, commands: 0 };
    contactsRef.current = new Set();
    savedRef.current = false;
    startTimeRef.current = performance.now();
    lastFrameRef.current = startTimeRef.current;
    setCfg(nextCfg);
    setAircraft(nextAircraft);
    setSelectedId('CA-A');
    setPhase(1);
    setRemaining(nextCfg.testDuration);
    setTurnDirection(1);
    setVerticalDirection(1);
    setCommandField(null);
    setHeadingInput('');
    setAltitudeInput('');
    setEvents([]);
    setStats(statsRef.current);
    setStage('test');
  };

  useEffect(() => {
    if (stage !== 'test') return undefined;

    const tick = (now) => {
      const activeCfg = cfgRef.current;
      if (!activeCfg) return;
      const elapsed = (now - startTimeRef.current) / 1000;
      const nextRemaining = Math.max(0, Math.ceil(activeCfg.testDuration - elapsed));
      const nextPhase = Math.min(3, Math.floor(elapsed / (activeCfg.testDuration / 3)) + 1);
      setRemaining((current) => current === nextRemaining ? current : nextRemaining);
      setPhase((current) => current === nextPhase ? current : nextPhase);

      if (nextRemaining <= 0) {
        setStage('results');
        return;
      }

      if (now - lastFrameRef.current < 32) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const delta = Math.min(0.08, (now - lastFrameRef.current) / 1000);
      lastFrameRef.current = now;
      const activeIds = new Set(activeIdsForPhase(nextPhase));
      const tuning = DIFFICULTY[difficulty] || DIFFICULTY.medium;
      let nextAircraft = aircraftRef.current.map((aircraftState) => {
        if (!activeIds.has(aircraftState.id)) return aircraftState;
        const next = { ...aircraftState };

        if (next.id === 'UA') {
          next.alt = 47 + Math.sin(elapsed / 7) * 8;
          if (next.x < 3 || next.x > 97 || next.y < 3 || next.y > 97) {
            next.heading = normalizeBearing(next.heading + 145);
          }
        } else {
          const turnStep = Math.min(next.turnRemaining, tuning.turnRate * delta);
          if (turnStep > 0) {
            next.heading = normalizeBearing(next.heading + next.turnDirection * turnStep);
            next.turnRemaining -= turnStep;
          }
          const altitudeDelta = next.targetAlt - next.alt;
          const altitudeStep = Math.sign(altitudeDelta) * Math.min(Math.abs(altitudeDelta), tuning.altitudeRate * delta);
          next.alt += altitudeStep;
        }

        const radians = next.heading * Math.PI / 180;
        const speed = next.speed * tuning.speedScale;
        next.x += Math.sin(radians) * speed * delta;
        next.y -= Math.cos(radians) * speed * delta;

        if (next.id !== 'UA' && (next.x < 0 || next.x > 100 || next.y < 0 || next.y > 100)) {
          const contactKey = `boundary-${next.id}`;
          if (!contactsRef.current.has(contactKey)) {
            contactsRef.current.add(contactKey);
            incrementStat('violations');
            addEvent({
              prompt: `${next.id} left radar coverage`,
              detail: 'The aircraft crossed the display boundary and was returned on the opposite edge.',
              given: 'Aircraft left controlled airspace',
              answer: 'Keep aircraft within radar coverage',
              correct: false
            });
          }
          next.x = (next.x + 100) % 100;
          next.y = (next.y + 100) % 100;
        } else {
          contactsRef.current.delete(`boundary-${next.id}`);
        }
        return next;
      });

      const visibleGates = visibleGatesForPhase(nextPhase);
      nextAircraft = nextAircraft.map((aircraftState) => {
        if (!activeIds.has(aircraftState.id) || !['alpha', 'numeric'].includes(aircraftState.mission)) return aircraftState;
        const missionGates = visibleGates.filter((gate) => gate.kind === aircraftState.mission);
        const completeMission = GATES.filter((gate) => gate.kind === aircraftState.mission);
        if (!missionGates.length) return aircraftState;
        let next = aircraftState;
        missionGates.forEach((gate) => {
          const contactKey = `gate-${aircraftState.id}-${gate.label}`;
          const inGate = distanceBetween(aircraftState, gate) <= 3.2;
          if (inGate && !contactsRef.current.has(contactKey)) {
            contactsRef.current.add(contactKey);
            const expected = completeMission[aircraftState.gateIndex % completeMission.length];
            if (gate.label === expected.label) {
              next = { ...next, gateIndex: (aircraftState.gateIndex + 1) % completeMission.length };
              incrementStat('gates');
              addEvent({
                prompt: `${aircraftState.id} passed Gate ${gate.label}`,
                detail: `Gate ${gate.label} was the next ${aircraftState.mission === 'alpha' ? 'alphabetical' : 'numerical'} objective.`,
                given: `Gate ${gate.label}`,
                answer: `Gate ${gate.label}`,
                correct: true
              });
            } else {
              incrementStat('violations');
              addEvent({
                prompt: `${aircraftState.id} entered Gate ${gate.label} out of sequence`,
                detail: `${aircraftState.id} must pass gates in ${aircraftState.mission === 'alpha' ? 'alphabetical' : 'numerical'} order.`,
                given: `Gate ${gate.label}`,
                answer: `Gate ${expected.label}`,
                correct: false
              });
            }
          }
          if (!inGate) contactsRef.current.delete(contactKey);
        });
        return next;
      });

      const visibleDangers = DANGER_AREAS.slice(0, Math.max(0, nextPhase - 1));
      nextAircraft.filter((aircraftState) => activeIds.has(aircraftState.id) && aircraftState.id !== 'UA').forEach((aircraftState) => {
        visibleDangers.forEach((area) => {
          const contactKey = `danger-${aircraftState.id}-${area.id}`;
          const inside = distanceBetween(aircraftState, area) < area.radius;
          const verticalSeparation = Math.abs(aircraftState.alt - area.alt);
          const unsafe = inside && verticalSeparation < 10;
          if (unsafe && !contactsRef.current.has(contactKey)) {
            contactsRef.current.add(contactKey);
            incrementStat('violations');
            addEvent({
              prompt: `${aircraftState.id} conflicted with a danger area`,
              detail: `The ${padAltitude(area.alt)} danger area requires 010 vertical separation.`,
              given: `${Math.round(verticalSeparation * 100)} ft vertical separation`,
              answer: 'At least 1000 ft vertical separation',
              correct: false
            });
          }
          if (!unsafe) contactsRef.current.delete(contactKey);
        });
      });

      const activeTracks = nextAircraft.filter((aircraftState) => activeIds.has(aircraftState.id));
      for (let first = 0; first < activeTracks.length; first += 1) {
        for (let second = first + 1; second < activeTracks.length; second += 1) {
          const a = activeTracks[first];
          const b = activeTracks[second];
          if ([a.id, b.id].includes('CA-G') && [a.id, b.id].includes('UA')) continue;
          const pairId = [a.id, b.id].sort().join('-');
          const contactKey = `separation-${pairId}`;
          const lateral = distanceBetween(a, b);
          const vertical = Math.abs(a.alt - b.alt);
          const unsafe = lateral < 5 && vertical < 30;
          if (unsafe && !contactsRef.current.has(contactKey)) {
            contactsRef.current.add(contactKey);
            incrementStat('violations');
            addEvent({
              prompt: `${a.id} and ${b.id} lost separation`,
              detail: 'Maintain either 5 nms lateral separation or 030 vertical separation.',
              given: `${lateral.toFixed(1)} nms / ${Math.round(vertical * 100)} ft`,
              answer: '5 nms lateral or 3000 ft vertical',
              correct: false
            });
          }
          if (!unsafe) contactsRef.current.delete(contactKey);
        }
      }

      if (nextPhase === 3) {
        const interceptorIndex = nextAircraft.findIndex((aircraftState) => aircraftState.id === 'CA-G');
        const targetIndex = nextAircraft.findIndex((aircraftState) => aircraftState.id === 'UA');
        const interceptor = nextAircraft[interceptorIndex];
        const target = nextAircraft[targetIndex];
        if (interceptor && target && distanceBetween(interceptor, target) <= 4 && Math.abs(interceptor.alt - target.alt) <= 10) {
          incrementStat('intercepts');
          addEvent({
            prompt: 'CA-G intercepted the unknown aircraft',
            detail: 'The tracks closed within 4 nms with no more than 010 height difference.',
            given: 'Successful intercept',
            answer: 'Successful intercept',
            correct: true
          });
          nextAircraft[targetIndex] = {
            ...target,
            x: target.x < 50 ? 88 : 12,
            y: target.y < 50 ? 82 : 18,
            heading: normalizeBearing(target.heading + 125),
            alt: 35 + Math.random() * 35
          };
        }
      }

      aircraftRef.current = nextAircraft;
      setAircraft(nextAircraft);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [addEvent, difficulty, incrementStat, stage]);

  const chooseTurn = useCallback((direction) => {
    setTurnDirection(direction);
    setCommandField('heading');
  }, []);

  const chooseAltitude = useCallback((direction) => {
    setVerticalDirection(direction);
    setCommandField('altitude');
  }, []);

  const selectAircraft = useCallback((id) => {
    selectedIdRef.current = id;
    setSelectedId(id);
    setCommandField(null);
    setHeadingInput('');
    setAltitudeInput('');
  }, []);

  const commitCommand = useCallback(() => {
    const id = selectedIdRef.current;
    const aircraftIndex = aircraftRef.current.findIndex((aircraftState) => aircraftState.id === id);
    if (aircraftIndex < 0) return;
    const current = aircraftRef.current[aircraftIndex];
    let next = current;

    if (commandField === 'heading' && headingInput) {
      const turn = Math.min(359, Math.max(1, Number(headingInput)));
      next = {
        ...current,
        turnDirection,
        turnRemaining: turn
      };
      setHeadingInput('');
    } else if (commandField === 'altitude' && altitudeInput) {
      const requested = Math.min(120, Math.max(1, Number(altitudeInput)));
      const targetAlt = verticalDirection > 0
        ? Math.max(current.alt, requested)
        : Math.min(current.alt, requested);
      next = { ...current, targetAlt };
      setAltitudeInput('');
    } else {
      return;
    }

    const nextAircraft = [...aircraftRef.current];
    nextAircraft[aircraftIndex] = next;
    aircraftRef.current = nextAircraft;
    setAircraft(nextAircraft);
    incrementStat('commands');
  }, [altitudeInput, commandField, headingInput, incrementStat, turnDirection, verticalDirection]);

  useEffect(() => {
    if (stage !== 'test') return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Tab') {
        event.preventDefault();
        const activeControlled = CONTROLLED_IDS.filter((id) => activeIdsForPhase(phase).includes(id));
        const currentIndex = activeControlled.indexOf(selectedIdRef.current);
        selectAircraft(activeControlled[(currentIndex + 1) % activeControlled.length]);
        return;
      }
      if (event.key.toUpperCase() === 'A') selectAircraft('CA-A');
      if (event.key.toUpperCase() === 'N' && phase >= 2) selectAircraft('CA-N');
      if (event.key.toUpperCase() === 'G' && phase >= 3) selectAircraft('CA-G');
      if (event.key === 'ArrowLeft') chooseTurn(-1);
      if (event.key === 'ArrowRight') chooseTurn(1);
      if (event.key === 'ArrowUp') chooseAltitude(1);
      if (event.key === 'ArrowDown') chooseAltitude(-1);
      if (/^\d$/.test(event.key)) {
        if (commandField === 'heading') setHeadingInput((value) => value.length < 3 ? value + event.key : value);
        if (commandField === 'altitude') setAltitudeInput((value) => value.length < 3 ? value + event.key : value);
      }
      if (event.key === 'Enter') commitCommand();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [chooseAltitude, chooseTurn, commandField, commitCommand, phase, selectAircraft, stage]);

  useEffect(() => {
    if (stage !== 'results' || mode !== 'assessment' || savedRef.current) return;
    savedRef.current = true;
    const score = scoreForStats(statsRef.current);
    saveResult('Dynamic Projection', mode, difficulty, {
      accuracy: score,
      correct: statsRef.current.gates + statsRef.current.intercepts,
      total: statsRef.current.gates + statsRef.current.intercepts + statsRef.current.violations,
      gates: statsRef.current.gates,
      intercepts: statsRef.current.intercepts,
      violations: statsRef.current.violations
    });
  }, [difficulty, mode, stage]);

  if (stage === 'menu') {
    return (
      <ModuleMenu
        title="Dynamic Projection Test - Setup"
        description="Control the moving aircraft on the projection display. Click a callsign or press A, N, G, or Tab to select it. Choose left or right, type a three-digit relative turn, and press Enter. Choose up or down, type a target height in hundreds of feet, and press Enter."
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
    const score = scoreForStats(stats);
    return (
      <ModuleResults
        title="Dynamic Projection - Results"
        rows={[
          ['Gates passed in order', stats.gates],
          ['Successful intercepts', stats.intercepts],
          ['Safety / sequence errors', stats.violations],
          ['Control commands', stats.commands]
        ]}
        overallScore={score}
        summary={events}
        onRetry={() => setStage('menu')}
        onDashboard={() => navigate('/')}
      />
    );
  }

  const activeIds = activeIdsForPhase(phase);
  const activeAircraft = aircraft.filter((aircraftState) => activeIds.includes(aircraftState.id));
  const visibleGates = visibleGatesForPhase(phase);
  const visibleDangers = DANGER_AREAS.slice(0, Math.max(0, phase - 1));
  const selectedAircraft = aircraft.find((aircraftState) => aircraftState.id === selectedId) || aircraft[0];
  const headingReadout = headingInput || pad3(selectedAircraft.heading);
  const altitudeReadout = altitudeInput || padAltitude(selectedAircraft.targetAlt);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black"
      style={{ fontFamily: "'Arial', 'Helvetica', sans-serif" }}
    >
      <div
        className="grid aspect-[5/4] max-h-screen grid-cols-[27.2%_72.8%] grid-rows-[4.6%_90.8%_4.6%] overflow-hidden border-2 border-white bg-[#000080]"
        style={{ width: 'min(100vw, 125vh)', containerType: 'inline-size' }}
        data-testid="dpt-screen"
      >
        <HeaderMeters remaining={remaining} duration={cfg.testDuration} />
        <div className="flex items-center justify-center border-b-2 border-white bg-[#000080] text-[1.65cqw] text-white">
          Dynamic Projection Test - Instructions
        </div>

        <DptLegend />
        <div className="min-h-0 min-w-0 overflow-hidden">
          <ProjectionDisplay
            aircraft={activeAircraft}
            dangerAreas={visibleDangers}
            gates={visibleGates}
            onSelect={selectAircraft}
            selectedId={selectedId}
          />
        </div>

        <div className="flex items-center border-t-2 border-white bg-black px-[1.1cqw] text-[1.65cqw] text-white">
          {mode === 'practice' ? 'Practice' : 'Test'} {phase} of 3
        </div>
        <div className="flex items-center justify-start gap-[0.7cqw] border-t-2 border-white bg-black px-[6cqw] text-white">
          <span
            className="h-[2.15cqw] w-[2.15cqw] border border-white"
            style={{ backgroundColor: selectedAircraft.color }}
          />
          <span className="mr-[4cqw] text-[1.7cqw]">{selectedAircraft.id}</span>
          <DirectionButton
            direction={turnDirection < 0 ? 'left' : 'right'}
            active={commandField === 'heading'}
            onClick={() => chooseTurn(commandField === 'heading' ? -turnDirection : turnDirection)}
            axis="turn"
          />
          <DigitReadout value={headingReadout} testId="dpt-heading-readout" />
          <div className="ml-[4.6cqw]">
            <DirectionButton
              direction={verticalDirection > 0 ? 'up' : 'down'}
              active={commandField === 'altitude'}
              onClick={() => chooseAltitude(commandField === 'altitude' ? -verticalDirection : verticalDirection)}
              axis="altitude"
            />
          </div>
          <DigitReadout value={altitudeReadout} testId="dpt-altitude-readout" />
        </div>
      </div>
    </div>
  );
};

export default DynamicProjection;
