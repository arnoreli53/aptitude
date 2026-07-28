import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getSettings, saveResult } from '../utils/storage';
import {
  cbtFont,
  formatClock,
  randInt,
  pick,
  shuffle,
  ModuleMenu,
  ModuleResults
} from './cbtCommon';

const ROWS = 'ABCDEFGHIJ'.split('');
const COLS = Array.from({ length: 10 }, (_, index) => index);

const UNIT_TYPES = [
  { name: 'Command Post', plural: 'Command Posts', code: 'Cp' },
  { name: 'Tank', plural: 'Tanks', code: 'Tk' },
  { name: 'Artillery', plural: 'Artillery Units', code: 'Ar' },
  { name: 'Infantry', plural: 'Infantry Units', code: 'In' },
  { name: 'Supply Vehicle', plural: 'Supply Vehicles', code: 'Sv' },
  { name: 'Air Defence', plural: 'Air Defence Units', code: 'Ad' }
];

const AFFILIATIONS = [
  { name: 'Friendly', color: '#f5d64b' },
  { name: 'Hostile', color: '#f04a45' },
  { name: 'Unknown', color: '#ffffff' }
];

const DIRECTIONS = [
  { name: 'North', short: 'N', rotation: 0 },
  { name: 'North East', short: 'NE', rotation: 45 },
  { name: 'East', short: 'E', rotation: 90 },
  { name: 'South East', short: 'SE', rotation: 135 },
  { name: 'South', short: 'S', rotation: 180 },
  { name: 'South West', short: 'SW', rotation: 225 },
  { name: 'West', short: 'W', rotation: 270 },
  { name: 'North West', short: 'NW', rotation: 315 }
];

const UNIT_CALLSIGNS = [
  'Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot',
  'Golf', 'Hotel', 'India', 'Juliet', 'Kilo', 'Lima'
];

const CONTROLLER_CALLSIGNS = [
  'LEEDS', 'YORK', 'BRISTOL', 'DERBY',
  'EXETER', 'LINCOLN', 'OXFORD', 'DOVER'
];

const EVENT_TIMING = {
  easy: 3000,
  medium: 2500,
  hard: 2100
};

const QUESTIONS_PER_ROUND = 4;

const coordinateOf = ({ row, col }) => `${ROWS[row]}${col}`;

const takeCoordinate = (used) => {
  let index;
  do {
    index = randInt(0, 99);
  } while (used.has(index));
  used.add(index);
  return { row: Math.floor(index / 10), col: index % 10 };
};

const randomCoordinate = () => `${pick(ROWS)}${randInt(0, 9)}`;

const makeOptions = (answer, candidates, minimum = 5) => {
  const answerText = String(answer);
  const values = [answerText];

  candidates.forEach((candidate) => {
    const text = String(candidate);
    if (text !== answerText && !values.includes(text)) values.push(text);
  });

  let attempts = 0;
  while (values.length < minimum && attempts < 100) {
    const fallback = randomCoordinate();
    if (!values.includes(fallback)) values.push(fallback);
    attempts += 1;
  }

  return shuffle(values.slice(0, Math.max(2, minimum)));
};

const makeCountOptions = (answer, maximum) => {
  const candidates = [];
  for (let value = 0; value <= Math.max(maximum, 5); value += 1) {
    if (value !== answer) candidates.push(value);
  }
  return makeOptions(answer, shuffle(candidates), 5);
};

const unitDetail = (unit) => (
  `${unit.callsign} was the ${unit.affiliation.name.toLowerCase()} ` +
  `${unit.type.name.toLowerCase()} at ${coordinateOf(unit)}, moving ${unit.direction.name.toLowerCase()}.`
);

const controllerDetail = (controller) => (
  `${controller.callsign} was at ${coordinateOf(controller)}, moving ` +
  `${controller.direction.name.toLowerCase()}, with waypoint ${coordinateOf(controller.waypoint)} ` +
  `at ${controller.waypointTime}, altitude ${controller.altitude.toLocaleString()} feet, ` +
  `and communication ${controller.channel}.`
);

const buildEvents = (units, controllers, difficulty) => {
  const duration = EVENT_TIMING[difficulty] || EVENT_TIMING.medium;
  const unitEvents = shuffle(units).map((unit) => ({
    kind: 'unit',
    duration,
    unit,
    header: 'TACTICAL PICTURE UPDATE',
    message: `${unit.callsign.toUpperCase()}   ${unit.affiliation.name.toUpperCase()} ` +
      `${unit.type.name.toUpperCase()}   TRACK ${unit.direction.name.toUpperCase()}`,
    voice: `${unit.callsign}. ${unit.affiliation.name} ${unit.type.name}. ` +
      `Tracking ${unit.direction.name}.`
  }));

  const controllerEvents = shuffle(controllers.flatMap((controller) => ([
    {
      kind: 'controller-navigation',
      duration: duration + 350,
      controller,
      header: 'CONTROLLER NAVIGATION UPDATE',
      message: `${controller.callsign}   POSITION SHOWN   TRACK ${controller.direction.name.toUpperCase()}`,
      voice: `Controller ${controller.callsign}. Tracking ${controller.direction.name}. ` +
        `Next waypoint ${coordinateOf(controller.waypoint)} at ${controller.waypointTime}.`
    },
    {
      kind: 'controller-altitude',
      duration,
      controller,
      header: 'CONTROLLER ALTITUDE UPDATE',
      message: `${controller.callsign}   ALTITUDE ${controller.altitude.toLocaleString()} FEET`,
      voice: `Controller ${controller.callsign}. Altitude ${controller.altitude} feet.`
    },
    {
      kind: 'controller-channel',
      duration,
      controller,
      header: 'CONTROLLER COMMUNICATION UPDATE',
      message: `${controller.callsign}   COMMUNICATION ${controller.channel}`,
      voice: `Controller ${controller.callsign}. Communication ${controller.channel}.`
    }
  ])));

  const events = [];
  while (unitEvents.length || controllerEvents.length) {
    if (unitEvents.length) events.push(unitEvents.shift());
    if (controllerEvents.length) events.push(controllerEvents.shift());
  }

  return [
    {
      kind: 'standby',
      duration: 1200,
      header: 'PREPARE FOR SITUATIONAL UPDATE',
      message: 'OBSERVE EACH UPDATE. ALL INFORMATION WILL BE REMOVED.',
      voice: 'Prepare for situational update.'
    },
    ...events
  ];
};

const generateRound = (unitCount, difficulty) => {
  const used = new Set();
  const callsigns = shuffle(UNIT_CALLSIGNS).slice(0, unitCount);
  const types = shuffle(Array.from(
    { length: unitCount },
    (_, index) => UNIT_TYPES[index % UNIT_TYPES.length]
  ));
  const affiliations = shuffle(Array.from(
    { length: unitCount },
    (_, index) => AFFILIATIONS[index % AFFILIATIONS.length]
  ));

  const units = callsigns.map((callsign, index) => ({
    ...takeCoordinate(used),
    callsign,
    type: types[index],
    affiliation: affiliations[index],
    direction: pick(DIRECTIONS)
  }));

  const controllerNames = shuffle(CONTROLLER_CALLSIGNS).slice(0, 2);
  const channelNumbers = shuffle(Array.from({ length: 18 }, (_, index) => index + 1));
  const controllers = controllerNames.map((callsign, index) => {
    const position = takeCoordinate(used);
    const waypoint = takeCoordinate(used);
    const waypointTimestamp = Date.now() + randInt(240, 780) * 1000;
    return {
      ...position,
      callsign,
      waypoint,
      waypointTimestamp,
      waypointTime: formatClock(new Date(waypointTimestamp)),
      altitude: randInt(6, 28) * 1000,
      direction: pick(DIRECTIONS),
      channel: `CHANNEL ${channelNumbers[index]}`
    };
  });

  return {
    units,
    controllers,
    events: buildEvents(units, controllers, difficulty)
  };
};

const buildQuestionGroups = (round) => {
  const { units, controllers } = round;

  const locationQuestions = units.flatMap((unit) => ([
    {
      text: `At which grid location was ${unit.callsign}?`,
      answer: coordinateOf(unit),
      options: makeOptions(
        coordinateOf(unit),
        shuffle(units.filter((candidate) => candidate !== unit).map(coordinateOf)),
        5
      ),
      detail: unitDetail(unit)
    },
    {
      text: `Which callsign was shown at ${coordinateOf(unit)}?`,
      answer: unit.callsign,
      options: makeOptions(unit.callsign, shuffle(UNIT_CALLSIGNS), 5),
      detail: unitDetail(unit)
    }
  ]));

  const detailQuestions = units.flatMap((unit) => ([
    {
      text: `What type of unit was ${unit.callsign}?`,
      answer: unit.type.name,
      options: makeOptions(unit.type.name, shuffle(UNIT_TYPES.map((type) => type.name)), 5),
      detail: unitDetail(unit)
    },
    {
      text: `Was ${unit.callsign} friendly, hostile or unknown?`,
      answer: unit.affiliation.name,
      options: shuffle(AFFILIATIONS.map((affiliation) => affiliation.name)),
      detail: unitDetail(unit)
    },
    {
      text: `In which direction was ${unit.callsign} moving?`,
      answer: unit.direction.name,
      options: makeOptions(unit.direction.name, shuffle(DIRECTIONS.map((direction) => direction.name)), 5),
      detail: unitDetail(unit)
    }
  ]));

  const controllerQuestions = controllers.flatMap((controller) => {
    const altitudeCandidates = Array.from(
      { length: 23 },
      (_, index) => `${(index + 6) * 1000} ft`
    );
    const timeCandidates = [-180, -120, -60, 60, 120, 180].map((offset) => (
      formatClock(new Date(controller.waypointTimestamp + offset * 1000))
    ));

    return [
      {
        text: `What was controller ${controller.callsign}'s location?`,
        answer: coordinateOf(controller),
        options: makeOptions(coordinateOf(controller), [], 5),
        detail: controllerDetail(controller)
      },
      {
        text: `What was ${controller.callsign}'s next waypoint?`,
        answer: coordinateOf(controller.waypoint),
        options: makeOptions(coordinateOf(controller.waypoint), [], 5),
        detail: controllerDetail(controller)
      },
      {
        text: `At what time was ${controller.callsign} due at its next waypoint?`,
        answer: controller.waypointTime,
        options: makeOptions(controller.waypointTime, shuffle(timeCandidates), 5),
        detail: controllerDetail(controller)
      },
      {
        text: `What altitude was controller ${controller.callsign} flying at?`,
        answer: `${controller.altitude} ft`,
        options: makeOptions(`${controller.altitude} ft`, shuffle(altitudeCandidates), 5),
        detail: controllerDetail(controller)
      },
      {
        text: `Which communication channel was assigned to ${controller.callsign}?`,
        answer: controller.channel,
        options: makeOptions(
          controller.channel,
          shuffle(Array.from({ length: 18 }, (_, index) => `CHANNEL ${index + 1}`)),
          5
        ),
        detail: controllerDetail(controller)
      },
      {
        text: `In which direction was controller ${controller.callsign} moving?`,
        answer: controller.direction.name,
        options: makeOptions(
          controller.direction.name,
          shuffle(DIRECTIONS.map((direction) => direction.name)),
          5
        ),
        detail: controllerDetail(controller)
      }
    ];
  });

  const affiliation = pick(AFFILIATIONS);
  const unitType = pick(UNIT_TYPES);
  const affiliationCount = units.filter(
    (unit) => unit.affiliation.name === affiliation.name
  ).length;
  const typeCount = units.filter((unit) => unit.type.name === unitType.name).length;
  const countQuestions = [
    {
      text: `How many ${affiliation.name.toUpperCase()} units were presented?`,
      answer: String(affiliationCount),
      options: makeCountOptions(affiliationCount, units.length),
      detail: `There were ${affiliationCount} ${affiliation.name.toLowerCase()} units in the tactical picture.`
    },
    {
      text: `How many ${unitType.plural.toUpperCase()} were presented?`,
      answer: String(typeCount),
      options: makeCountOptions(typeCount, units.length),
      detail: `There were ${typeCount} ${unitType.plural.toLowerCase()} in the tactical picture.`
    }
  ];

  return [
    shuffle(locationQuestions),
    shuffle(detailQuestions),
    shuffle(controllerQuestions),
    shuffle(countQuestions)
  ];
};

const generateQuestions = (round, count) => {
  const groups = buildQuestionGroups(round);
  const selected = [];
  let groupIndex = randInt(0, groups.length - 1);

  while (selected.length < count && groups.some((group) => group.length)) {
    const group = groups[groupIndex % groups.length];
    if (group.length) selected.push(group.shift());
    groupIndex += 1;
  }

  return shuffle(selected);
};

const cancelSpeech = () => {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
};

const bevelled = {
  boxShadow: 'inset 2px 2px 2px rgba(255,255,255,0.42), inset -3px -3px 3px rgba(0,0,0,0.62)'
};

const inset = {
  boxShadow: 'inset 3px 3px 5px rgba(0,0,0,0.82), inset -2px -2px 2px rgba(255,255,255,0.18)'
};

const Compass = () => (
  <div
    className="absolute z-20 rounded-full border border-[#444] bg-[#555] text-white"
    style={{
      width: '5.1cqw',
      height: '5.1cqw',
      left: '-0.9cqw',
      top: '-1.5cqw',
      fontSize: 'clamp(5px, 0.58cqw, 8px)',
      boxShadow: '1px 2px 4px rgba(0,0,0,0.7)'
    }}
    aria-label="Compass"
  >
    <span className="absolute left-1/2 top-[3%] -translate-x-1/2">N</span>
    <span className="absolute right-[5%] top-1/2 -translate-y-1/2">E</span>
    <span className="absolute left-1/2 bottom-[2%] -translate-x-1/2">S</span>
    <span className="absolute left-[5%] top-1/2 -translate-y-1/2">W</span>
    <div className="absolute left-1/2 top-[20%] h-[31%] w-[2px] -translate-x-1/2 bg-white" />
    <div
      className="absolute left-1/2 top-[16%] -translate-x-1/2"
      style={{
        width: 0,
        height: 0,
        borderLeft: '0.38cqw solid transparent',
        borderRight: '0.38cqw solid transparent',
        borderBottom: '0.9cqw solid #222'
      }}
    />
    <div className="absolute left-1/2 top-1/2 h-[0.45cqw] w-[0.45cqw] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" />
  </div>
);

const TacticalMap = ({ event }) => {
  const unit = event?.kind === 'unit' ? event.unit : null;
  const controller = event?.kind === 'controller-navigation' ? event.controller : null;
  const marker = unit || controller;
  const markerColor = unit ? unit.affiliation.color : '#ffffff';
  const markerCode = unit ? unit.type.code : 'Cp';

  return (
    <div className="relative h-full min-w-0" data-testid="sa-map-panel">
      <Compass />
      <div
        className="absolute flex items-center justify-around text-[#e9e9e9]"
        style={{
          left: '5.8%',
          right: '2.1%',
          top: 0,
          height: '8%',
          fontSize: 'clamp(8px, 2.25cqw, 25px)',
          textShadow: '1px 2px 2px #333'
        }}
      >
        {COLS.map((col) => <span key={col}>{col}</span>)}
      </div>

      <div
        className="absolute flex flex-col items-center justify-around text-[#e9e9e9]"
        style={{
          left: 0,
          width: '5.6%',
          top: '8.2%',
          bottom: '4.4%',
          fontSize: 'clamp(8px, 2.25cqw, 25px)',
          textShadow: '1px 2px 2px #333'
        }}
      >
        {ROWS.map((row) => <span key={row}>{row}</span>)}
      </div>

      <div
        className="absolute grid grid-cols-10 grid-rows-10 border border-[#d8e0d8] bg-[#3f6b4c]"
        style={{ left: '5.8%', right: '2.1%', top: '8.2%', bottom: '4.4%', ...inset }}
        data-testid="sa-grid"
      >
        {ROWS.flatMap((row, rowIndex) => COLS.map((col) => {
          const isActive = marker && marker.row === rowIndex && marker.col === col;
          return (
            <div
              key={`${row}${col}`}
              className="relative flex min-h-0 min-w-0 items-center justify-center border-b border-r border-[#d7dfd7]"
              data-coordinate={`${row}${col}`}
            >
              {isActive && (
                <div
                  className="flex aspect-square w-[58%] items-center justify-center rounded-full border-[2px] bg-[#4c7457] font-bold"
                  style={{
                    borderColor: markerColor,
                    color: markerColor,
                    fontSize: 'clamp(6px, 1.25cqw, 15px)',
                    textShadow: '1px 1px 1px #222',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.75)'
                  }}
                  data-testid="sa-active-marker"
                  data-coordinate={coordinateOf(marker)}
                >
                  {markerCode}
                </div>
              )}
            </div>
          );
        }))}
      </div>

      <div
        className="absolute bottom-0 left-[22%] right-0 flex items-center justify-center gap-[2.2cqw] whitespace-nowrap text-[#ededed]"
        style={{ height: '4%', fontSize: 'clamp(6px, 1.02cqw, 12px)', textShadow: '1px 1px 1px #333' }}
      >
        <span>Yellow&nbsp; Friendly</span>
        <span>Red&nbsp; Hostile</span>
        <span>White&nbsp; Unknown</span>
        <span>1 cell = 2km</span>
      </div>
    </div>
  );
};

const DisplayField = ({ label, value, testId }) => (
  <div className="w-full text-center">
    <div
      className="mb-[0.25cqw] text-[#eeeeee]"
      style={{ fontSize: 'clamp(7px, 1.22cqw, 15px)', textShadow: '1px 1px 1px #444' }}
    >
      {label}
    </div>
    <div
      className="mx-auto flex h-[3.9cqw] max-h-[42px] min-h-[18px] w-[55%] items-center justify-center bg-[#242424] font-mono text-white"
      style={{
        ...inset,
        fontSize: 'clamp(8px, 1.75cqw, 20px)'
      }}
      data-testid={testId}
    >
      {value || ''}
    </div>
  </div>
);

const ControllerPanel = ({ event }) => {
  const isControllerEvent = event?.kind?.startsWith('controller-');
  const controller = isControllerEvent ? event.controller : null;
  const showNavigation = event?.kind === 'controller-navigation';
  const showAltitude = event?.kind === 'controller-altitude';
  const showChannel = event?.kind === 'controller-channel';

  return (
    <div
      className="relative h-full min-w-0 border-[#6c1414] bg-[#bd4b45]"
      style={{ borderWidth: '0.35cqw', ...bevelled }}
      data-testid="sa-controller-panel"
    >
      <div
        className="absolute right-[7%] top-[0.8%] z-10 font-bold tracking-wide text-white"
        style={{ fontSize: 'clamp(8px, 1.7cqw, 20px)' }}
        data-testid="sa-controller-name"
      >
        {controller?.callsign || ''}
      </div>

      <div
        className="absolute bottom-[3%] left-[6%] right-[6%] top-[5.5%] bg-[#858585]"
        style={{ ...bevelled, border: '1px solid #4a4a4a' }}
      >
        <div
          className="absolute left-[13%] right-[13%] top-[3%] text-center text-[#eeeeee]"
          style={{ fontSize: 'clamp(7px, 1.22cqw, 15px)', textShadow: '1px 1px 1px #444' }}
        >
          NEXT WAYPOINT
        </div>

        <div
          className="absolute left-[14%] right-[14%] top-[10%] flex h-[28%] items-center justify-center bg-[#282828]"
          style={inset}
          data-testid="sa-controller-waypoint"
        >
          {showNavigation && controller && (
            <div className="flex flex-col items-center justify-center text-white">
              <ArrowUp
                strokeWidth={4}
                className="text-[#08b52c]"
                style={{
                  width: '5.3cqw',
                  height: '5.3cqw',
                  maxWidth: '58px',
                  maxHeight: '58px',
                  minWidth: '18px',
                  minHeight: '18px',
                  transform: `rotate(${controller.direction.rotation}deg)`
                }}
                aria-hidden="true"
              />
              <span
                className="font-mono font-bold"
                style={{ fontSize: 'clamp(7px, 1.45cqw, 17px)', marginTop: '-0.4cqw' }}
              >
                {coordinateOf(controller.waypoint)}
              </span>
            </div>
          )}
        </div>

        <div className="absolute left-0 right-0 top-[40%]">
          <DisplayField
            label="NEXT WAYPOINT AT"
            value={showNavigation ? controller?.waypointTime : ''}
            testId="sa-controller-waypoint-time"
          />
        </div>

        <div className="absolute left-0 right-0 top-[56%]">
          <DisplayField
            label="ALTITUDE"
            value={showAltitude ? `${controller?.altitude}` : ''}
            testId="sa-controller-altitude"
          />
        </div>

        <div className="absolute left-0 right-0 top-[73%]">
          <DisplayField
            label="COMMUNICATION CHANNEL"
            value={showChannel ? controller?.channel.replace('CHANNEL ', '') : ''}
            testId="sa-controller-channel"
          />
        </div>
      </div>
    </div>
  );
};

const QuestionFooter = ({ question, questionNumber, questionCount, onAnswer }) => {
  if (!question) return null;
  return (
    <div className="flex h-full min-h-0 flex-col justify-center px-[1.2cqw] py-[0.45cqw]">
      <div
        className="mb-[0.35cqw] text-center font-bold leading-tight text-white"
        style={{ fontSize: 'clamp(7px, 1.2cqw, 15px)' }}
        data-testid="sa-question"
      >
        {questionNumber} / {questionCount}&nbsp;&nbsp; {question.text}
      </div>
      <div
        className="grid min-h-0 flex-1 gap-[0.55cqw]"
        style={{ gridTemplateColumns: `repeat(${question.options.length}, minmax(0, 1fr))` }}
      >
        {question.options.map((option, index) => (
          <button
            key={`${option}-${index}`}
            type="button"
            onClick={() => onAnswer(option)}
            className="min-w-0 overflow-hidden border border-[#bcbcbc] bg-[#626262] px-[0.35cqw] text-center font-bold text-white hover:bg-[#767676] focus:outline-none focus:ring-2 focus:ring-white"
            style={{
              ...bevelled,
              fontSize: 'clamp(6px, 0.95cqw, 12px)',
              lineHeight: 1.05
            }}
            data-testid={`sa-answer-${index}`}
          >
            <span className="mr-[0.3cqw] text-[#f0d764]">{String.fromCharCode(65 + index)}</span>
            <span>{option}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

const SituationConsole = ({
  event,
  phase,
  clockDisplay,
  question,
  questionNumber,
  questionCount,
  remaining,
  onAnswer
}) => {
  const headerText = phase === 'question'
    ? 'SITUATIONAL RECALL - ALL SOURCE INFORMATION REMOVED'
    : (event?.header || '');

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-black"
      style={cbtFont}
      data-testid="sa-test-screen"
      data-phase={phase}
      data-remaining={remaining}
    >
      <div
        className="relative overflow-hidden border-[2px] border-[#060675] bg-[#777]"
        style={{
          width: 'min(100vw, calc(100vh * 1.2482679))',
          height: 'min(100vh, calc(100vw / 1.2482679))',
          containerType: 'inline-size'
        }}
      >
        <div
          className="absolute left-0 right-0 top-0 flex items-center justify-center border-b-[2px] border-white bg-[#05055f] font-bold text-white"
          style={{ height: '4.5%', fontSize: 'clamp(9px, 1.55cqw, 18px)' }}
        >
          Situational Awareness Test - Testing
        </div>

        <div className="absolute bottom-0 left-0 right-0 top-[4.5%] bg-[#797979]">
          <div
            className="absolute flex items-center justify-center overflow-hidden bg-[#1d1d1d] px-[1cqw] font-bold text-[#efefef]"
            style={{
              left: '3.4%',
              top: '3.6%',
              width: '79.2%',
              height: '7.1%',
              ...inset,
              fontSize: 'clamp(7px, 1.15cqw, 14px)'
            }}
            data-testid="sa-announcement"
          >
            {headerText}
          </div>

          <div
            className="absolute flex items-center justify-center border border-[#333] bg-[#d2d0c7] font-mono text-black"
            style={{
              left: '84%',
              top: '3.6%',
              width: '13.5%',
              height: '7.1%',
              ...bevelled,
              fontSize: 'clamp(10px, 2.3cqw, 28px)'
            }}
            data-testid="sa-clock"
          >
            {clockDisplay}
          </div>

          <div
            className="absolute flex min-h-0 min-w-0"
            style={{ left: '3.4%', right: '2.4%', top: '13.2%', height: '69.4%' }}
          >
            <div className="h-full min-w-0" style={{ width: '58.8%' }}>
              <TacticalMap event={phase === 'study' ? event : null} />
            </div>
            <div className="h-full min-w-0" style={{ width: '8.2%' }} />
            <div className="h-full min-w-0" style={{ width: '33%' }}>
              <ControllerPanel event={phase === 'study' ? event : null} />
            </div>
          </div>

          <div
            className="absolute overflow-hidden bg-[#1d1d1d]"
            style={{ left: '2.4%', right: '2.2%', bottom: '2.6%', height: '11.3%', ...inset }}
            data-testid="sa-message-panel"
            aria-live="polite"
          >
            {phase === 'question' ? (
              <QuestionFooter
                question={question}
                questionNumber={questionNumber}
                questionCount={questionCount}
                onAnswer={onAnswer}
              />
            ) : (
              <div
                className="flex h-full items-center justify-center px-[2cqw] text-center font-bold text-white"
                style={{ fontSize: 'clamp(7px, 1.3cqw, 16px)' }}
                data-testid="sa-study-message"
              >
                {event?.message || ''}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const SituationalAwareness = () => {
  const navigate = useNavigate();
  const [stage, setStage] = useState('menu');
  const [mode, setMode] = useState(null);
  const [difficulty, setDifficulty] = useState(null);
  const [cfg, setCfg] = useState(null);
  const [round, setRound] = useState(null);
  const [roundQuestions, setRoundQuestions] = useState([]);
  const [roundQuestionIndex, setRoundQuestionIndex] = useState(0);
  const [phase, setPhase] = useState('study');
  const [eventIndex, setEventIndex] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [responses, setResponses] = useState([]);
  const [elapsed, setElapsed] = useState(0);
  const [clockNow, setClockNow] = useState(new Date());
  const answerLockRef = useRef(false);
  const savedRef = useRef(false);

  const finishTest = useCallback(() => {
    cancelSpeech();
    setStage('results');
  }, []);

  const beginRound = useCallback((configuration, answeredCount) => {
    const nextRound = generateRound(configuration.aircraftCount, difficulty);
    const questionCount = Math.min(
      QUESTIONS_PER_ROUND,
      configuration.questionCount - answeredCount
    );
    setRound(nextRound);
    setRoundQuestions(generateQuestions(nextRound, questionCount));
    setRoundQuestionIndex(0);
    setEventIndex(0);
    setPhase('study');
  }, [difficulty]);

  const start = () => {
    const configuration = getSettings().situationalAwareness[difficulty];
    savedRef.current = false;
    answerLockRef.current = false;
    setCfg(configuration);
    setAnswered(0);
    setCorrect(0);
    setResponses([]);
    setElapsed(0);
    setClockNow(new Date());
    setStage('test');
    beginRound(configuration, 0);
  };

  const currentEvent = phase === 'study' && round
    ? round.events[eventIndex]
    : null;
  const currentQuestion = phase === 'question'
    ? roundQuestions[roundQuestionIndex]
    : null;

  const submitAnswer = useCallback((option) => {
    if (!currentQuestion || !cfg || answerLockRef.current) return;
    answerLockRef.current = true;

    const isCorrect = option === currentQuestion.answer;
    const nextAnswered = answered + 1;
    setAnswered(nextAnswered);
    if (isCorrect) setCorrect((value) => value + 1);
    setResponses((items) => ([
      ...items,
      {
        prompt: currentQuestion.text,
        given: option,
        answer: currentQuestion.answer,
        correct: isCorrect,
        detail: currentQuestion.detail
      }
    ]));

    if (nextAnswered >= cfg.questionCount) {
      finishTest();
      return;
    }

    if (roundQuestionIndex + 1 < roundQuestions.length) {
      setRoundQuestionIndex((value) => value + 1);
      return;
    }

    beginRound(cfg, nextAnswered);
  }, [
    answered,
    beginRound,
    cfg,
    currentQuestion,
    finishTest,
    roundQuestionIndex,
    roundQuestions.length
  ]);

  useEffect(() => {
    answerLockRef.current = false;
  }, [phase, round, roundQuestionIndex]);

  useEffect(() => {
    if (stage !== 'test') return undefined;
    const app = document.querySelector('.App');
    const previous = {
      bodyOverflow: document.body.style.overflow,
      rootOverflow: document.documentElement.style.overflow,
      appOverflow: app?.style.overflow || '',
      appMaxWidth: app?.style.maxWidth || ''
    };

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    if (app) {
      app.style.overflow = 'hidden';
      app.style.maxWidth = '100vw';
    }

    return () => {
      document.body.style.overflow = previous.bodyOverflow;
      document.documentElement.style.overflow = previous.rootOverflow;
      if (app) {
        app.style.overflow = previous.appOverflow;
        app.style.maxWidth = previous.appMaxWidth;
      }
    };
  }, [stage]);

  useEffect(() => {
    if (stage !== 'test' || !cfg) return undefined;
    const timer = window.setInterval(() => {
      setClockNow(new Date());
      setElapsed((value) => Math.min(cfg.testDuration, value + 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cfg, stage]);

  useEffect(() => {
    if (stage === 'test' && cfg && elapsed >= cfg.testDuration) finishTest();
  }, [cfg, elapsed, finishTest, stage]);

  useEffect(() => {
    if (stage !== 'test' || phase !== 'study' || !round || !currentEvent) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      if (eventIndex + 1 >= round.events.length) {
        cancelSpeech();
        setEventIndex(-1);
        setPhase('question');
      } else {
        setEventIndex((value) => value + 1);
      }
    }, currentEvent.duration);

    return () => window.clearTimeout(timer);
  }, [currentEvent, eventIndex, phase, round, stage]);

  useEffect(() => {
    if (stage !== 'test' || phase !== 'study' || !currentEvent?.voice) return undefined;
    if (
      typeof window === 'undefined' ||
      !window.speechSynthesis ||
      typeof window.SpeechSynthesisUtterance !== 'function'
    ) {
      return undefined;
    }

    cancelSpeech();
    const utterance = new window.SpeechSynthesisUtterance(currentEvent.voice);
    utterance.rate = difficulty === 'hard' ? 1.08 : difficulty === 'easy' ? 0.9 : 1;
    utterance.pitch = 0.95;
    utterance.volume = 0.9;
    window.speechSynthesis.speak(utterance);

    return cancelSpeech;
  }, [currentEvent, difficulty, phase, stage]);

  useEffect(() => {
    if (stage !== 'test' || phase !== 'question' || !currentQuestion) return undefined;
    const handleKeyDown = (event) => {
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
      const optionIndex = 'ABCDE'.indexOf(event.key.toUpperCase());
      if (optionIndex < 0 || optionIndex >= currentQuestion.options.length) return;
      event.preventDefault();
      submitAnswer(currentQuestion.options[optionIndex]);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentQuestion, phase, stage, submitAnswer]);

  useEffect(() => () => cancelSpeech(), []);

  useEffect(() => {
    if (stage !== 'results' || mode !== 'assessment' || savedRef.current) return;
    savedRef.current = true;
    const accuracy = answered ? (correct / answered) * 100 : 0;
    saveResult('Situational Awareness', mode, difficulty, {
      accuracy,
      correct,
      total: answered
    });
  }, [answered, correct, difficulty, mode, stage]);

  if (stage === 'menu') {
    return (
      <ModuleMenu
        title="Situational Awareness Test - Setup"
        description="Memorise units on the A-J / 0-9 tactical grid and updates for two controller aircraft. Information is presented progressively through map, text and spoken cues, then removed before the recall questions. Turn sound on before starting."
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
    const accuracy = answered ? (correct / answered) * 100 : 0;
    return (
      <ModuleResults
        title="Situational Awareness - Results"
        rows={[
          ['Correct', `${correct} / ${answered}`],
          ['Accuracy', `${accuracy.toFixed(1)}%`]
        ]}
        overallScore={accuracy}
        summary={responses}
        onRetry={() => setStage('menu')}
        onDashboard={() => navigate('/')}
      />
    );
  }

  const remaining = Math.max(0, (cfg?.testDuration || 0) - elapsed);

  return (
    <SituationConsole
      event={currentEvent}
      phase={phase}
      clockDisplay={formatClock(clockNow)}
      question={currentQuestion}
      questionNumber={answered + 1}
      questionCount={cfg?.questionCount || 0}
      remaining={remaining}
      onAnswer={submitAnswer}
    />
  );
};

export default SituationalAwareness;
