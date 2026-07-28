import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSettings, saveResult } from '../utils/storage';
import { ModuleMenu, ModuleResults, formatTime, pick, shuffle } from './cbtCommon';

const BLUE = '#000080';
const SKY = '#22B6E6';
const GROUND = '#A86616';
const HEADINGS = [0, 90, 180, 270];
const HEADING_NAMES = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' };
const PITCH_NAMES = { '-1': 'descending', 0: 'level', 1: 'climbing' };
const BANK_NAMES = { '-1': 'banked left', 0: 'wings level', 1: 'banked right' };

const degToRad = (degrees) => (degrees * Math.PI) / 180;
const polar = (cx, cy, radius, degrees) => ({
  x: cx + Math.sin(degToRad(degrees)) * radius,
  y: cy - Math.cos(degToRad(degrees)) * radius
});

const stateKey = ({ heading, pitch, bank }) => `${heading}:${pitch}:${bank}`;

const PART_ONE_STATES = [
  ...HEADINGS.map((heading) => ({ heading, pitch: 0, bank: 0 })),
  ...[90, 270].flatMap((heading) => [-1, 1].map((pitch) => ({ heading, pitch, bank: 0 }))),
  ...[0, 180].flatMap((heading) => [-1, 1].map((bank) => ({ heading, pitch: 0, bank })))
];

const makePart1 = () => {
  const correct = { ...pick(PART_ONE_STATES) };
  const oppositeHeading = (correct.heading + 180) % 360;
  let candidates;

  if (correct.pitch !== 0) {
    candidates = [
      { ...correct, pitch: -correct.pitch },
      { ...correct, pitch: 0 },
      { heading: oppositeHeading, pitch: correct.pitch, bank: 0 },
      { heading: oppositeHeading, pitch: -correct.pitch, bank: 0 },
      { heading: (correct.heading + 90) % 360, pitch: 0, bank: 0 }
    ];
  } else if (correct.bank !== 0) {
    candidates = [
      { ...correct, bank: -correct.bank },
      { ...correct, bank: 0 },
      { heading: oppositeHeading, pitch: 0, bank: correct.bank },
      { heading: oppositeHeading, pitch: 0, bank: -correct.bank },
      { heading: (correct.heading + 90) % 360, pitch: 0, bank: 0 }
    ];
  } else {
    const attitudeChanges = [90, 270].includes(correct.heading)
      ? [{ ...correct, pitch: 1 }, { ...correct, pitch: -1 }]
      : [{ ...correct, bank: 1 }, { ...correct, bank: -1 }];
    candidates = [
      ...attitudeChanges,
      { heading: oppositeHeading, pitch: 0, bank: 0 },
      { heading: (correct.heading + 90) % 360, pitch: 0, bank: 0 },
      { heading: (correct.heading + 270) % 360, pitch: 0, bank: 0 }
    ];
  }

  const distractors = shuffle(
    candidates.filter((candidate, index, all) => (
      stateKey(candidate) !== stateKey(correct) &&
      all.findIndex((item) => stateKey(item) === stateKey(candidate)) === index
    ))
  ).slice(0, 4);
  const options = shuffle([correct, ...distractors]);

  return {
    part: 1,
    ...correct,
    options,
    correctIndex: options.findIndex((option) => stateKey(option) === stateKey(correct))
  };
};

const describeTurn = (turn) => (
  turn === 0 ? 'maintaining direction' : turn > 0 ? 'turning right' : 'turning left'
);

const describeVertical = (vertical, altitude) => {
  const formattedAltitude = altitude.toLocaleString('en-US');
  if (vertical === 0) return `level at ${formattedAltitude} feet`;
  return `${vertical > 0 ? 'climbing' : 'descending'} through ${formattedAltitude} feet`;
};

const statementFor = ({ speed, heading, altitude, vertical, turn }) => (
  `Flying at ${speed} knots, ${describeTurn(turn)}, heading ${HEADING_NAMES[heading]} and ${describeVertical(vertical, altitude)}.`
);

const makePart2 = () => {
  const state = {
    speed: pick([100, 150, 200, 250, 300]),
    heading: pick(HEADINGS),
    altitude: pick([3200, 3800, 4500, 5200, 6700, 7400]),
    vertical: pick([-1, 0, 1]),
    turn: pick([-1, 0, 1])
  };
  state.pitch = state.vertical;
  state.bank = state.turn;

  const alternateSpeed = state.speed === 300 ? 250 : state.speed + 50;
  const alternateAltitude = state.altitude >= 7000 ? state.altitude - 500 : state.altitude + 500;
  const alternateVertical = state.vertical === 0 ? 1 : -state.vertical;
  const alternateTurn = state.turn === 0 ? 1 : -state.turn;
  const candidateStates = [
    { ...state },
    { ...state, speed: alternateSpeed },
    { ...state, heading: (state.heading + 90) % 360 },
    { ...state, vertical: alternateVertical, pitch: alternateVertical },
    { ...state, turn: alternateTurn, bank: alternateTurn },
    { ...state, altitude: alternateAltitude }
  ];
  const correct = candidateStates[0];
  const distractors = shuffle(candidateStates.slice(1)).slice(0, 4);
  const options = shuffle([correct, ...distractors]).map((optionState) => ({
    state: optionState,
    text: statementFor(optionState)
  }));

  return {
    part: 2,
    ...state,
    options,
    correctIndex: options.findIndex((option) => option.state === correct)
  };
};

const DialShell = ({ cx, cy, radius, children }) => (
  <>
    <circle cx={cx} cy={cy} r={radius + 9} fill="#747474" stroke="#F2F2F2" strokeWidth="2" />
    <circle cx={cx} cy={cy} r={radius} fill="#050505" stroke="#D8D8D8" strokeWidth="4" />
    {children}
  </>
);

const DialTicks = ({
  cx,
  cy,
  radius,
  start = 0,
  end = 360,
  step = 10,
  majorEvery = 30
}) => {
  const count = Math.round((end - start) / step);
  return Array.from({ length: count }, (_, index) => start + index * step).map((degrees) => {
    const outer = polar(cx, cy, radius - 2, degrees);
    const major = Math.abs(degrees - start) % majorEvery === 0;
    const inner = polar(cx, cy, radius - (major ? 18 : 10), degrees);
    return (
      <line
        key={degrees}
        x1={outer.x}
        y1={outer.y}
        x2={inner.x}
        y2={inner.y}
        stroke="white"
        strokeWidth={major ? 3 : 1.3}
      />
    );
  });
};

const AttitudeIndicator = ({ bank = 0, pitch = 0 }) => {
  const cx = 120;
  const cy = 120;
  const radius = 105;
  const bankDegrees = bank * 22;
  const horizonY = cy + pitch * 31;
  const clipId = `insc-ai-${bank}-${pitch}`;

  return (
    <svg
      viewBox="0 0 240 240"
      className="h-full w-full"
      role="img"
      aria-label={`Attitude indicator: ${PITCH_NAMES[pitch]}, ${BANK_NAMES[bank]}`}
      data-testid="insc-attitude"
      data-pitch={pitch}
      data-bank={bank}
    >
      <defs>
        <clipPath id={clipId}><circle cx={cx} cy={cy} r={radius} /></clipPath>
      </defs>
      <circle cx={cx} cy={cy} r="115" fill="#737373" stroke="white" strokeWidth="2" />
      <g clipPath={`url(#${clipId})`} transform={`rotate(${-bankDegrees} ${cx} ${cy})`}>
        <rect x="-60" y="-80" width="360" height={horizonY + 80} fill={SKY} />
        <rect x="-60" y={horizonY} width="360" height="330" fill={GROUND} />
        <line x1="-50" y1={horizonY} x2="290" y2={horizonY} stroke="white" strokeWidth="4" />
        {[-2, -1, 1, 2].map((mark) => {
          const y = horizonY + mark * 20;
          const halfWidth = Math.abs(mark) === 2 ? 36 : 25;
          return (
            <g key={mark}>
              <line x1={cx - halfWidth} y1={y} x2={cx + halfWidth} y2={y} stroke="white" strokeWidth="2" />
              <text x={cx - halfWidth - 9} y={y + 4} fill="white" fontSize="10" textAnchor="end">{Math.abs(mark) * 10}</text>
              <text x={cx + halfWidth + 9} y={y + 4} fill="white" fontSize="10">{Math.abs(mark) * 10}</text>
            </g>
          );
        })}
      </g>
      {[-60, -30, 0, 30, 60].map((degrees) => {
        const point = polar(cx, cy, 96, degrees);
        return <circle key={degrees} cx={point.x} cy={point.y} r={degrees === 0 ? 4 : 2.5} fill="white" />;
      })}
      <polygon points="120,18 112,31 128,31" fill="white" />
      <path
        d="M48 117 H94 L108 128 H132 L146 117 H192 M120 111 V135"
        fill="none"
        stroke="#FFF600"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={cx} cy={cy} r="5" fill="#FFF600" stroke="#111" strokeWidth="1.5" />
      <circle cx={cx} cy={cy} r={radius} fill="none" stroke="#111" strokeWidth="3" />
    </svg>
  );
};

const HeadingIndicator = ({ heading = 0 }) => {
  const cx = 120;
  const cy = 120;
  const radius = 105;
  const labels = [
    { text: 'N', degrees: 0 },
    { text: '3', degrees: 30 },
    { text: '6', degrees: 60 },
    { text: 'E', degrees: 90 },
    { text: '12', degrees: 120 },
    { text: '15', degrees: 150 },
    { text: 'S', degrees: 180 },
    { text: '21', degrees: 210 },
    { text: '24', degrees: 240 },
    { text: 'W', degrees: 270 },
    { text: '30', degrees: 300 },
    { text: '33', degrees: 330 }
  ];

  return (
    <svg
      viewBox="0 0 240 240"
      className="h-full w-full"
      role="img"
      aria-label={`Heading indicator: ${HEADING_NAMES[heading]}`}
      data-testid="insc-compass"
      data-heading={heading}
    >
      <DialShell cx={cx} cy={cy} radius={radius}>
        <g transform={`rotate(${-heading} ${cx} ${cy})`}>
          <DialTicks cx={cx} cy={cy} radius={radius} step={5} majorEvery={30} />
          {labels.map(({ text, degrees }) => {
            const point = polar(cx, cy, 76, degrees);
            return (
              <text
                key={text}
                x={point.x}
                y={point.y + 8}
                fill="white"
                fontSize={text.length === 1 ? 24 : 18}
                fontWeight="700"
                textAnchor="middle"
                transform={`rotate(${degrees} ${point.x} ${point.y})`}
              >
                {text}
              </text>
            );
          })}
        </g>
      </DialShell>
      <polygon points="120,14 112,30 128,30" fill="#FFEC00" stroke="#111" strokeWidth="1" />
      <g fill="#E3241B" stroke="#5D0905" strokeWidth="2" strokeLinejoin="round">
        <path d="M120 52 L110 104 L52 124 L55 139 L108 129 L106 170 L84 183 L87 193 L120 185 L153 193 L156 183 L134 170 L132 129 L185 139 L188 124 L130 104 Z" />
      </g>
      <path d="M120 58 V181" stroke="#FF786F" strokeWidth="2" />
      <circle cx={cx} cy={cy} r="5" fill="#FFF600" stroke="#111" />
    </svg>
  );
};

const AirspeedIndicator = ({ speed }) => {
  const cx = 120;
  const cy = 120;
  const radius = 105;
  const needleAngle = 270 + speed * 0.9;
  const needle = polar(cx, cy, 76, needleAngle);
  const labels = Array.from({ length: 8 }, (_, index) => index * 50);

  return (
    <svg
      viewBox="0 0 240 240"
      className="h-full w-full"
      role="img"
      aria-label={`Airspeed indicator: ${speed} knots`}
      data-testid="insc-speed"
      data-speed={speed}
    >
      <DialShell cx={cx} cy={cy} radius={radius}>
        <DialTicks cx={cx} cy={cy} radius={radius} step={11.25} majorEvery={45} />
        {labels.map((value) => {
          const point = polar(cx, cy, 76, 270 + value * 0.9);
          return (
            <text key={value} x={point.x} y={point.y + 6} fill="white" fontSize="17" fontWeight="700" textAnchor="middle">
              {value}
            </text>
          );
        })}
        <text x={cx} y="81" fill="white" fontSize="13" fontWeight="700" textAnchor="middle">AIRSPEED</text>
        <text x={cx} y="98" fill="white" fontSize="11" textAnchor="middle">KNOTS</text>
        <line x1={cx} y1={cy} x2={needle.x} y2={needle.y} stroke="#FFF600" strokeWidth="8" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="8" fill="#FFF600" stroke="#111" strokeWidth="2" />
      </DialShell>
    </svg>
  );
};

const Altimeter = ({ altitude }) => {
  const cx = 120;
  const cy = 120;
  const radius = 105;
  const thousandsAngle = (altitude / 1000) * 36;
  const hundredsAngle = ((altitude % 1000) / 100) * 36;
  const thousandsTip = polar(cx, cy, 54, thousandsAngle);
  const hundredsTip = polar(cx, cy, 82, hundredsAngle);

  return (
    <svg
      viewBox="0 0 240 240"
      className="h-full w-full"
      role="img"
      aria-label={`Altimeter: ${altitude} feet`}
      data-testid="insc-altimeter"
      data-altitude={altitude}
    >
      <DialShell cx={cx} cy={cy} radius={radius}>
        <DialTicks cx={cx} cy={cy} radius={radius} step={3.6} majorEvery={36} />
        {Array.from({ length: 10 }, (_, value) => {
          const point = polar(cx, cy, 77, value * 36);
          return (
            <text key={value} x={point.x} y={point.y + 7} fill="white" fontSize="20" fontWeight="700" textAnchor="middle">
              {value}
            </text>
          );
        })}
        <text x={cx} y="76" fill="white" fontSize="12" fontWeight="700" textAnchor="middle">ALTIMETER</text>
        <text x={cx} y="93" fill="white" fontSize="10" textAnchor="middle">THOUSANDS OF FEET</text>
        <line x1={cx} y1={cy} x2={thousandsTip.x} y2={thousandsTip.y} stroke="#FFF600" strokeWidth="11" strokeLinecap="round" />
        <line x1={cx} y1={cy} x2={hundredsTip.x} y2={hundredsTip.y} stroke="white" strokeWidth="6" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="8" fill="#FFF600" stroke="#111" strokeWidth="2" />
      </DialShell>
    </svg>
  );
};

const VerticalSpeedIndicator = ({ vertical }) => {
  const cx = 100;
  const cy = 100;
  const radius = 86;
  const needleAngle = vertical > 0 ? 315 : vertical < 0 ? 225 : 270;
  const needle = polar(cx, cy, 61, needleAngle);

  return (
    <svg
      viewBox="0 0 200 200"
      className="h-full w-full"
      role="img"
      aria-label={`Vertical speed: ${PITCH_NAMES[vertical]}`}
      data-testid="insc-vertical"
      data-vertical={vertical}
    >
      <DialShell cx={cx} cy={cy} radius={radius}>
        {[210, 225, 240, 255, 270, 285, 300, 315, 330].map((degrees) => {
          const outer = polar(cx, cy, 80, degrees);
          const inner = polar(cx, cy, degrees % 45 === 0 ? 62 : 69, degrees);
          return <line key={degrees} x1={outer.x} y1={outer.y} x2={inner.x} y2={inner.y} stroke="white" strokeWidth={degrees % 45 === 0 ? 3 : 1.5} />;
        })}
        <text x="42" y="103" fill="white" fontSize="18" fontWeight="700" textAnchor="middle">0</text>
        <text x="63" y="47" fill="white" fontSize="15" fontWeight="700" textAnchor="middle">UP</text>
        <text x="59" y="158" fill="white" fontSize="14" fontWeight="700" textAnchor="middle">DOWN</text>
        <text x={cx} y="57" fill="white" fontSize="12" fontWeight="700" textAnchor="middle">VERTICAL</text>
        <text x={cx} y="72" fill="white" fontSize="12" fontWeight="700" textAnchor="middle">SPEED</text>
        <line x1={cx} y1={cy} x2={needle.x} y2={needle.y} stroke="#FFF600" strokeWidth="8" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="7" fill="#FFF600" stroke="#111" />
      </DialShell>
    </svg>
  );
};

const TurnIndicator = ({ turn }) => {
  const bankDegrees = turn * 24;
  return (
    <svg
      viewBox="0 0 200 200"
      className="h-full w-full"
      role="img"
      aria-label={`Turn indicator: ${describeTurn(turn)}`}
      data-testid="insc-turn"
      data-turn={turn}
    >
      <DialShell cx={100} cy={100} radius={86}>
        <text x="49" y="54" fill="white" fontSize="22" fontWeight="700" textAnchor="middle">L</text>
        <text x="151" y="54" fill="white" fontSize="22" fontWeight="700" textAnchor="middle">R</text>
        <path d="M42 76 L53 67 M158 76 L147 67" stroke="white" strokeWidth="4" strokeLinecap="round" />
        <g transform={`rotate(${bankDegrees} 100 100)`} fill="none" stroke="#FFF600" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M55 99 H88 L100 112 L112 99 H145" />
          <path d="M100 83 V116" />
        </g>
        <text x="100" y="132" fill="white" fontSize="10" textAnchor="middle">2 MIN TURN</text>
        <path d="M58 146 Q100 164 142 146" fill="none" stroke="white" strokeWidth="3" />
        <circle cx="100" cy="154" r="8" fill="#FFF600" stroke="#111" strokeWidth="2" />
      </DialShell>
    </svg>
  );
};

const TunnelBackdrop = () => (
  <g aria-hidden="true">
    <rect width="360" height="220" fill="#A7ABAE" />
    <polygon points="0,0 180,68 360,0" fill="#D4D7D8" />
    <polygon points="0,220 180,152 360,220" fill="#747A7E" />
    <polygon points="0,0 180,68 180,152 0,220" fill="#92979A" />
    <polygon points="360,0 180,68 180,152 360,220" fill="#BABEC0" />
    <rect x="145" y="76" width="70" height="68" fill="#6F7477" stroke="#E8EAEA" strokeWidth="3" />
    <path d="M0 36 L145 83 M360 36 L215 83 M0 184 L145 137 M360 184 L215 137" stroke="#E4E6E7" strokeWidth="3" />
    <path d="M60 0 L154 77 M300 0 L206 77 M60 220 L154 143 M300 220 L206 143" stroke="#666C70" strokeWidth="2" />
  </g>
);

const SideJet = ({ heading, pitch }) => {
  const facingWest = heading === 270;
  const pitchRotation = pitch * (facingWest ? 13 : -13);
  const transform = `translate(180 116) rotate(${pitchRotation}) scale(${facingWest ? -1 : 1} 1)`;

  return (
    <g transform={transform} strokeLinejoin="round">
      <ellipse cx="2" cy="46" rx="116" ry="15" fill="#555A5D" opacity="0.35" />
      <path d="M-108 4 C-58 -14 24 -20 100 -8 L122 0 L101 9 C35 21 -54 20 -112 11 Z" fill="#E1261C" stroke="#620B07" strokeWidth="4" />
      <path d="M-72 -5 L-55 -47 L-34 -47 L-18 -9 Z" fill="#C31912" stroke="#620B07" strokeWidth="4" />
      <path d="M-73 12 L-49 31 L-18 17 Z" fill="#B61610" stroke="#620B07" strokeWidth="3" />
      <path d="M6 6 L-30 38 L52 18 L77 5 Z" fill="#D51D16" stroke="#620B07" strokeWidth="3" />
      <path d="M35 -13 C43 -34 72 -34 89 -11 Z" fill="#B9ECF6" stroke="#F8FFFF" strokeWidth="3" />
      <path d="M55 -30 L58 -12 M-99 2 L-114 -10" stroke="#FF8B85" strokeWidth="3" />
      <ellipse cx="-99" cy="8" rx="10" ry="7" fill="#252525" stroke="#F17870" strokeWidth="2" />
      <path d="M96 -7 L121 0 L96 7" fill="#F04A40" />
    </g>
  );
};

const FrontJet = ({ bank }) => (
  <g transform={`translate(180 112) rotate(${-bank * 24})`} strokeLinejoin="round">
    <ellipse cx="0" cy="57" rx="123" ry="16" fill="#555A5D" opacity="0.35" />
    <path d="M-139 3 L-31 -26 L-15 -24 L0 35 L15 -24 L31 -26 L139 3 L127 18 L29 10 L18 46 L-18 46 L-29 10 L-127 18 Z" fill="#E1261C" stroke="#620B07" strokeWidth="4" />
    <path d="M-45 -8 L-18 -55 L-5 -50 L0 -9 L5 -50 L18 -55 L45 -8" fill="#BF1710" stroke="#620B07" strokeWidth="4" />
    <path d="M-19 -22 C-15 -45 15 -45 19 -22 L13 11 L-13 11 Z" fill="#B9ECF6" stroke="white" strokeWidth="3" />
    <path d="M-31 1 L-16 17 L-43 22 Z M31 1 L16 17 L43 22 Z" fill="#2B2B2B" stroke="#620B07" strokeWidth="2" />
    <ellipse cx="0" cy="37" rx="18" ry="12" fill="#F34B41" stroke="#620B07" strokeWidth="3" />
    <path d="M0 49 L-9 35 L9 35 Z" fill="#FF817A" />
  </g>
);

const RearJet = ({ bank }) => (
  <g transform={`translate(180 111) rotate(${bank * 24})`} strokeLinejoin="round">
    <ellipse cx="0" cy="58" rx="122" ry="15" fill="#555A5D" opacity="0.35" />
    <path d="M-140 4 L-30 -24 L-14 -20 L0 28 L14 -20 L30 -24 L140 4 L125 18 L29 10 L19 42 L-19 42 L-29 10 L-125 18 Z" fill="#D91E16" stroke="#620B07" strokeWidth="4" />
    <path d="M-44 -8 L-24 -61 L-8 -52 L0 -15 L8 -52 L24 -61 L44 -8" fill="#B81610" stroke="#620B07" strokeWidth="4" />
    <path d="M-59 2 L-25 36 L-10 20 L10 20 L25 36 L59 2" fill="#C21912" stroke="#620B07" strokeWidth="3" />
    <ellipse cx="-12" cy="27" rx="10" ry="13" fill="#222" stroke="#FF857E" strokeWidth="3" />
    <ellipse cx="12" cy="27" rx="10" ry="13" fill="#222" stroke="#FF857E" strokeWidth="3" />
    <circle cx="-12" cy="30" r="4" fill="#FFD34D" />
    <circle cx="12" cy="30" r="4" fill="#FFD34D" />
  </g>
);

const AircraftView = ({ state }) => (
  <svg
    viewBox="0 0 360 220"
    className="h-full w-full"
    role="img"
    aria-label={`Aircraft flying ${HEADING_NAMES[state.heading]}, ${PITCH_NAMES[state.pitch]}, ${BANK_NAMES[state.bank]}`}
  >
    <TunnelBackdrop />
    {state.heading === 90 && <SideJet heading={state.heading} pitch={state.pitch} />}
    {state.heading === 270 && <SideJet heading={state.heading} pitch={state.pitch} />}
    {state.heading === 180 && <FrontJet bank={state.bank} />}
    {state.heading === 0 && <RearJet bank={state.bank} />}
  </svg>
);

const TestFrameStyles = () => (
  <style>{`
    .insc-test-root {
      align-items: center;
      background: #000;
      display: flex;
      font-family: Arial, Helvetica, sans-serif;
      inset: 0;
      justify-content: center;
      position: fixed;
      z-index: 100;
    }
    .insc-frame {
      container-type: inline-size;
      height: min(100dvh, 75vw);
      overflow: hidden;
      width: min(100vw, 133.333dvh);
    }
    .insc-part-one {
      background: ${BLUE};
      border: 2px solid #fff;
      display: grid;
      grid-template-rows: 36% 31% 33%;
    }
    .insc-part-one-top {
      align-items: center;
      display: grid;
      gap: 2.4cqw;
      grid-template-columns: 1fr 1fr .82fr;
      padding: 1.2cqw 3cqw .6cqw;
    }
    .insc-primary-gauge {
      aspect-ratio: 1;
      justify-self: center;
      max-height: 100%;
      width: min(26cqw, 100%);
    }
    .insc-answer-panel {
      background: #050505;
      border: 1px solid #fff;
      font-size: clamp(12px, 2cqw, 22px);
      line-height: 1.65;
      padding: 2cqw;
    }
    .insc-choice-row {
      display: grid;
      gap: 1.2cqw;
      min-height: 0;
      padding: .6cqw 1.2cqw;
    }
    .insc-choice-row-two {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      margin-inline: auto;
      width: 70%;
    }
    .insc-choice-row-three {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
    .insc-aircraft-choice {
      aspect-ratio: 18 / 11;
      background: #9ca0a2;
      border: 2px solid #fff;
      min-height: 0;
      overflow: hidden;
      position: relative;
    }
    .insc-aircraft-choice:focus-visible {
      outline: 4px solid #ffff00;
      outline-offset: -4px;
    }
    .insc-option-number {
      align-items: center;
      background: #c5c5c5;
      border: 2px outset #eee;
      bottom: .5cqw;
      color: #050505;
      display: flex;
      font-size: clamp(14px, 2.4cqw, 28px);
      font-weight: 700;
      height: clamp(24px, 3.7cqw, 42px);
      justify-content: center;
      left: .5cqw;
      position: absolute;
      width: clamp(24px, 3.7cqw, 42px);
    }
    .insc-part-two {
      background: #626262;
      border: 2px solid #fff;
      display: grid;
      grid-template-rows: 35% 23% 5% 37%;
    }
    .insc-gauge-row {
      align-items: center;
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      min-height: 0;
      padding-inline: 6cqw;
    }
    .insc-gauge-row-small {
      padding-inline: 11cqw;
    }
    .insc-large-gauge {
      aspect-ratio: 1;
      justify-self: center;
      max-height: 100%;
      width: min(25cqw, 100%);
    }
    .insc-small-gauge {
      aspect-ratio: 1;
      justify-self: center;
      max-height: 100%;
      width: min(18cqw, 100%);
    }
    .insc-status {
      align-items: center;
      background: #050505;
      border-block: 2px solid #fff;
      display: grid;
      font-size: clamp(10px, 1.8cqw, 20px);
      grid-template-columns: 1fr 1fr;
      padding-inline: 2cqw;
    }
    .insc-statements {
      background: ${BLUE};
      color: #fff;
      display: grid;
      font-size: clamp(11px, 1.65cqw, 19px);
      gap: .45cqw;
      grid-template-rows: repeat(5, minmax(0, 1fr));
      padding: .65cqw 1.5cqw;
    }
    .insc-statement {
      align-items: center;
      display: flex;
      min-height: 0;
      text-align: left;
      width: 100%;
    }
    .insc-statement:focus-visible {
      outline: 3px solid #ffff00;
      outline-offset: -2px;
    }
    @media (max-aspect-ratio: 4 / 5) {
      .insc-frame {
        height: 100dvh;
        width: 100vw;
      }
      .insc-part-one {
        grid-template-rows: 29% 25% 46%;
      }
      .insc-part-one-top {
        gap: 1cqw;
        grid-template-columns: 1fr 1fr;
        padding: 2cqw;
      }
      .insc-primary-gauge {
        width: min(42cqw, 100%);
      }
      .insc-answer-panel {
        grid-column: 1 / -1;
        line-height: 1.2;
        padding: 1cqw 2cqw;
      }
      .insc-choice-row-two {
        align-items: center;
        width: 100%;
      }
      .insc-choice-row-three {
        align-content: space-evenly;
        gap: 1cqw;
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .insc-choice-row-three .insc-aircraft-choice:last-child {
        grid-column: 1 / -1;
        justify-self: center;
        width: calc(50% - .5cqw);
      }
      .insc-part-two {
        grid-template-rows: 27% 20% 7% 46%;
      }
      .insc-gauge-row {
        padding-inline: 1cqw;
      }
      .insc-gauge-row-small {
        padding-inline: 4cqw;
      }
      .insc-large-gauge {
        width: min(32cqw, 100%);
      }
      .insc-small-gauge {
        width: min(28cqw, 100%);
      }
      .insc-status {
        font-size: clamp(10px, 3.3cqw, 14px);
        padding-inline: 2cqw;
      }
      .insc-statements {
        font-size: clamp(11px, 3.5cqw, 15px);
        gap: 1cqw;
        padding: 2cqw;
      }
    }
  `}</style>
);

const AircraftChoice = ({ index, state, onAnswer }) => (
  <button
    type="button"
    onClick={() => onAnswer(index)}
    data-testid={`insc-aircraft-option-${index}`}
    data-heading={state.heading}
    data-pitch={state.pitch}
    data-bank={state.bank}
    className="insc-aircraft-choice"
    aria-label={`Option ${index + 1}`}
  >
    <AircraftView state={state} />
    <span className="insc-option-number">{index + 1}</span>
  </button>
);

const Part1Screen = ({ question, index, total, mode, remaining, onAnswer }) => (
  <div className="insc-test-root" data-testid="insc-test-screen" data-part="1">
    <TestFrameStyles />
    <main className="insc-frame insc-part-one text-white">
      <section className="insc-part-one-top">
        <div className="insc-primary-gauge"><AttitudeIndicator bank={question.bank} pitch={question.pitch} /></div>
        <div className="insc-primary-gauge"><HeadingIndicator heading={question.heading} /></div>
        <div className="insc-answer-panel">
          <div>{mode === 'practice' ? 'Practice' : 'Question'}: {index + 1} of {total}</div>
          <div>Your Answer:</div>
          <div className="text-[#FFFF00]">Time Left: {formatTime(remaining)}</div>
        </div>
      </section>
      <section className="insc-choice-row insc-choice-row-two">
        {question.options.slice(0, 2).map((option, optionIndex) => (
          <AircraftChoice key={stateKey(option)} index={optionIndex} state={option} onAnswer={onAnswer} />
        ))}
      </section>
      <section className="insc-choice-row insc-choice-row-three">
        {question.options.slice(2).map((option, optionIndex) => (
          <AircraftChoice
            key={stateKey(option)}
            index={optionIndex + 2}
            state={option}
            onAnswer={onAnswer}
          />
        ))}
      </section>
    </main>
  </div>
);

const Part2Screen = ({ question, index, total, mode, remaining, onAnswer }) => (
  <div className="insc-test-root" data-testid="insc-test-screen" data-part="2">
    <TestFrameStyles />
    <main className="insc-frame insc-part-two text-white">
      <section className="insc-gauge-row">
        <div className="insc-large-gauge"><Altimeter altitude={question.altitude} /></div>
        <div className="insc-large-gauge"><AttitudeIndicator bank={question.bank} pitch={question.pitch} /></div>
        <div className="insc-large-gauge"><AirspeedIndicator speed={question.speed} /></div>
      </section>
      <section className="insc-gauge-row insc-gauge-row-small">
        <div className="insc-small-gauge"><VerticalSpeedIndicator vertical={question.vertical} /></div>
        <div className="insc-small-gauge"><HeadingIndicator heading={question.heading} /></div>
        <div className="insc-small-gauge"><TurnIndicator turn={question.turn} /></div>
      </section>
      <section className="insc-status">
        <div>{mode === 'practice' ? 'Practice' : 'Question'}: {index + 1} of {total}</div>
        <div className="text-right">Your Answer: <span className="ml-[2cqw] text-[#FFFF00]">Time Left: {formatTime(remaining)}</span></div>
      </section>
      <section className="insc-statements">
        {question.options.map((option, optionIndex) => (
          <button
            type="button"
            key={option.text}
            onClick={() => onAnswer(optionIndex)}
            data-testid={`insc-statement-${optionIndex}`}
            className="insc-statement"
          >
            <span>{optionIndex + 1}.&nbsp; {option.text}</span>
          </button>
        ))}
      </section>
    </main>
  </div>
);

const InstrumentComprehension = () => {
  const navigate = useNavigate();
  const [stage, setStage] = useState('menu');
  const [mode, setMode] = useState(null);
  const [difficulty, setDifficulty] = useState(null);
  const [config, setConfig] = useState(null);
  const [question, setQuestion] = useState(null);
  const [index, setIndex] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [responses, setResponses] = useState([]);
  const answerLockRef = useRef(false);
  const answerRef = useRef(() => {});
  const savedRef = useRef(false);

  const nextQuestion = (nextIndex, nextConfig = config) => {
    const partOneCount = Math.ceil(nextConfig.questionCount / 2);
    return nextIndex < partOneCount ? makePart1() : makePart2();
  };

  const start = () => {
    const nextConfig = getSettings().instrumentComprehension[difficulty];
    savedRef.current = false;
    answerLockRef.current = false;
    setConfig(nextConfig);
    setRemaining(nextConfig.testDuration);
    setIndex(0);
    setCorrect(0);
    setResponses([]);
    setQuestion(nextQuestion(0, nextConfig));
    setStage('test');
  };

  const finish = () => {
    setStage('results');
  };

  const answer = (answerIndex) => {
    if (answerLockRef.current || !question || !config) return;
    answerLockRef.current = true;

    const isRight = answerIndex === question.correctIndex;
    const correctOption = question.options[question.correctIndex];
    const givenOption = question.options[answerIndex];
    const nextCorrect = isRight ? correct + 1 : correct;
    const nextIndex = index + 1;

    setResponses((previous) => [...previous, {
      prompt: question.part === 1
        ? 'Match the attitude and heading instruments to the aircraft view'
        : 'Select the statement that matches all six instruments',
      detail: question.part === 1
        ? `Heading ${HEADING_NAMES[question.heading]}, ${PITCH_NAMES[question.pitch]}, ${BANK_NAMES[question.bank]}`
        : `${question.speed} knots, heading ${HEADING_NAMES[question.heading]}, ${describeVertical(question.vertical, question.altitude)}, ${describeTurn(question.turn)}`,
      given: question.part === 1
        ? `Option ${answerIndex + 1}: heading ${HEADING_NAMES[givenOption.heading]}, ${PITCH_NAMES[givenOption.pitch]}, ${BANK_NAMES[givenOption.bank]}`
        : `${answerIndex + 1}. ${givenOption.text}`,
      answer: question.part === 1
        ? `Option ${question.correctIndex + 1}: heading ${HEADING_NAMES[correctOption.heading]}, ${PITCH_NAMES[correctOption.pitch]}, ${BANK_NAMES[correctOption.bank]}`
        : `${question.correctIndex + 1}. ${correctOption.text}`,
      correct: isRight
    }]);
    setCorrect(nextCorrect);

    if (nextIndex >= config.questionCount) {
      setIndex(nextIndex);
      finish();
      return;
    }

    setIndex(nextIndex);
    setQuestion(nextQuestion(nextIndex));
    answerLockRef.current = false;
  };

  answerRef.current = answer;

  useEffect(() => {
    if (stage !== 'test') return undefined;
    const timer = window.setInterval(() => {
      setRemaining((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [stage]);

  useEffect(() => {
    if (stage === 'test' && config && remaining === 0) finish();
  }, [config, remaining, stage]);

  useEffect(() => {
    if (stage !== 'test') return undefined;
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [stage]);

  useEffect(() => {
    if (stage !== 'test') return undefined;
    const onKeyDown = (event) => {
      if (!/^[1-5]$/.test(event.key)) return;
      event.preventDefault();
      answerRef.current(Number(event.key) - 1);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [stage]);

  useEffect(() => {
    if (stage !== 'results' || mode !== 'assessment' || index === 0 || savedRef.current) return;
    savedRef.current = true;
    saveResult('Instrument Comprehension', mode, difficulty, {
      accuracy: (correct / index) * 100,
      correct,
      total: index
    });
  }, [correct, difficulty, index, mode, stage]);

  if (stage === 'menu') {
    return (
      <ModuleMenu
        title="Instrument Comprehension - Setup"
        description="Read aircraft attitude and heading, then interpret the standard six-instrument display. Each question has one answer and cannot be changed."
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
    const accuracy = index ? (correct / index) * 100 : 0;
    return (
      <ModuleResults
        title="Instrument Comprehension - Results"
        rows={[['Correct', `${correct} / ${index}`], ['Accuracy', `${accuracy.toFixed(1)}%`]]}
        overallScore={accuracy}
        summary={responses}
        onRetry={() => setStage('menu')}
        onDashboard={() => navigate('/')}
      />
    );
  }

  return question.part === 1
    ? (
      <Part1Screen
        question={question}
        index={index}
        total={config.questionCount}
        mode={mode}
        remaining={remaining}
        onAnswer={answer}
      />
    )
    : (
      <Part2Screen
        question={question}
        index={index}
        total={config.questionCount}
        mode={mode}
        remaining={remaining}
        onAnswer={answer}
      />
    );
};

export default InstrumentComprehension;
