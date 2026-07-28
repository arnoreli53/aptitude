import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getSettings, saveResult } from '../utils/storage';
import { ModuleMenu, ModuleResults, formatTime, pick, randInt, shuffle } from './cbtCommon';

const MAP_SIZE = 8;
const STUDY_DURATION = { easy: 24, medium: 18, hard: 14 };
const QUESTIONS_PER_ROUND = { easy: 2, medium: 3, hard: 3 };
const SPEED_DOT_STEP = { slow: 0.078, medium: 0.055, fast: 0.035 };
const SPEED_FACTOR = { slow: 0.72, medium: 1, fast: 1.42 };
const OBJECT_DEFINITIONS = {
  farm: { singular: 'farm', plural: 'farms', colour: '#D6A07C' },
  truck: { singular: 'truck', plural: 'trucks', colour: '#747B55' },
  troops: { singular: 'troops', plural: 'troops', colour: '#171B2D' },
  trees: { singular: 'tree group', plural: 'tree groups', colour: '#1F4D16' }
};
const OBJECT_TYPES = Object.keys(OBJECT_DEFINITIONS);
const ALTITUDE_PROFILE_IDS = [
  'level-climb-descend',
  'climb-level-descend',
  'descend-level-climb',
  'level-descend-climb'
];
const ROUTE_TEMPLATES = [
  [
    { x: 0.15, z: 6.55 },
    { x: 1.7, z: 6.05 },
    { x: 4.45, z: 3.55 },
    { x: 6.85, z: 0.15 }
  ],
  [
    { x: 6.85, z: 6.7 },
    { x: 5.8, z: 4.8 },
    { x: 2.15, z: 3.15 },
    { x: 0.1, z: 0.45 }
  ],
  [
    { x: 1.05, z: 6.95 },
    { x: 1.55, z: 4.65 },
    { x: 5.8, z: 2.55 },
    { x: 6.25, z: 0.05 }
  ],
  [
    { x: 6.55, z: 6.9 },
    { x: 4.7, z: 5.25 },
    { x: 3.1, z: 2.25 },
    { x: 0.25, z: 0.6 }
  ]
];

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const roundTo = (value, places = 2) => Number(value.toFixed(places));
const cellKey = ({ x, z }) => `${x}:${z}`;

const cubicPoint = (controls, t) => {
  const inverse = 1 - t;
  const [a, b, c, d] = controls;
  return {
    x: (inverse ** 3) * a.x + 3 * (inverse ** 2) * t * b.x + 3 * inverse * (t ** 2) * c.x + (t ** 3) * d.x,
    z: (inverse ** 3) * a.z + 3 * (inverse ** 2) * t * b.z + 3 * inverse * (t ** 2) * c.z + (t ** 3) * d.z
  };
};

const altitudeAt = (profileId, t) => {
  if (profileId === 'climb-level-descend') {
    if (t < 0.34) return 0.85 + (t / 0.34) * 1.7;
    if (t < 0.68) return 2.55;
    return 2.55 - ((t - 0.68) / 0.32) * 1.15;
  }
  if (profileId === 'descend-level-climb') {
    if (t < 0.32) return 2.45 - (t / 0.32) * 1.35;
    if (t < 0.66) return 1.1;
    return 1.1 + ((t - 0.66) / 0.34) * 1.45;
  }
  if (profileId === 'level-descend-climb') {
    if (t < 0.3) return 2.15;
    if (t < 0.62) return 2.15 - ((t - 0.3) / 0.32) * 1.25;
    return 0.9 + ((t - 0.62) / 0.38) * 1.25;
  }
  if (t < 0.3) return 1.05;
  if (t < 0.64) return 1.05 + ((t - 0.3) / 0.34) * 1.45;
  return 2.5 - ((t - 0.64) / 0.36) * 0.1;
};

const sampleRoute = (controls, speedPattern) => {
  const samples = [];
  let t = 0;
  while (t < 1 && samples.length < 160) {
    samples.push({ t, ...cubicPoint(controls, t) });
    const segment = Math.min(2, Math.floor(t * 3));
    t += SPEED_DOT_STEP[speedPattern[segment]];
  }
  samples.push({ t: 1, ...cubicPoint(controls, 1) });
  return samples;
};

const jitterRoute = (template) => template.map((point, index) => {
  if (index === 0 || index === template.length - 1) return { ...point };
  return {
    x: roundTo(clamp(point.x + (Math.random() - 0.5) * 0.6, 0.5, 6.5)),
    z: roundTo(clamp(point.z + (Math.random() - 0.5) * 0.6, 0.5, 6.5))
  };
});

const createHills = (pathControls) => {
  const routeCentre = cubicPoint(pathControls, 0.52);
  const direction = Math.random() < 0.5 ? -1 : 1;
  return [
    {
      x: roundTo(clamp(routeCentre.x + direction * 0.75, 1.4, 5.6)),
      z: roundTo(clamp(routeCentre.z + 0.25, 1.4, 5.6)),
      radius: 1.18
    },
    {
      x: roundTo(clamp(routeCentre.x - direction * 2.2, 1.2, 5.8)),
      z: roundTo(clamp(routeCentre.z - 1.65, 1.2, 5.8)),
      radius: 0.72
    }
  ];
};

const isClearOfHills = (cell, hills) => hills.every((hill) => (
  Math.hypot(cell.x - hill.x, cell.z - hill.z) > hill.radius + 0.65
));

const availableCells = (hills, occupied = new Set()) => {
  const cells = [];
  for (let z = 1; z < MAP_SIZE - 1; z += 1) {
    for (let x = 1; x < MAP_SIZE - 1; x += 1) {
      const cell = { x, z };
      if (!occupied.has(cellKey(cell)) && isClearOfHills(cell, hills)) cells.push(cell);
    }
  }
  return cells;
};

const createObjects = (difficulty, hills) => {
  const total = difficulty === 'easy' ? 5 : difficulty === 'medium' ? 6 : 7;
  const types = [...OBJECT_TYPES];
  while (types.length < total) types.push(pick(OBJECT_TYPES));
  const cells = shuffle(availableCells(hills)).slice(0, total);
  return shuffle(types).map((type, index) => ({
    id: `${type}-${index}`,
    type,
    x: cells[index].x,
    z: cells[index].z,
    rotation: randInt(0, 3) * 90
  }));
};

const createRound = (difficulty) => {
  const pathControls = jitterRoute(pick(ROUTE_TEMPLATES));
  const hills = createHills(pathControls);
  const objects = createObjects(difficulty, hills);
  const targetTypes = [...new Set(objects.map((object) => object.type))];
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    objects,
    hills,
    pathControls,
    speedPattern: shuffle(['slow', 'medium', 'fast']),
    altitudeProfile: pick(ALTITUDE_PROFILE_IDS),
    targetSequence: shuffle(['scene', 'aircraft', ...targetTypes]),
    truthPattern: shuffle([true, false, true, false])
  };
};

const chooseEmptyCell = (objects, hills) => {
  const occupied = new Set(objects.map(cellKey));
  return pick(availableCells(hills, occupied));
};

const alterObjectType = (objects, hills, targetType) => {
  const next = objects.map((object) => ({ ...object }));
  const targetIndexes = next
    .map((object, index) => ({ object, index }))
    .filter(({ object }) => object.type === targetType)
    .map(({ index }) => index);
  const method = pick(targetIndexes.length > 1 ? ['move', 'remove', 'add'] : ['move', 'add', 'remove']);
  const definition = OBJECT_DEFINITIONS[targetType];

  if (method === 'remove') {
    next.splice(pick(targetIndexes), 1);
    return {
      objects: next,
      note: `The number of ${definition.plural} does not match the study map.`
    };
  }

  const cell = chooseEmptyCell(next, hills);
  if (method === 'add') {
    next.push({
      id: `${targetType}-extra-${Math.random().toString(36).slice(2)}`,
      type: targetType,
      x: cell.x,
      z: cell.z,
      rotation: randInt(0, 3) * 90
    });
    return {
      objects: next,
      note: `An extra ${definition.singular} appears in the landscape.`
    };
  }

  const movedIndex = pick(targetIndexes);
  next[movedIndex] = { ...next[movedIndex], x: cell.x, z: cell.z };
  return {
    objects: next,
    note: `The ${definition.singular} is in a different position from the study map.`
  };
};

const alterFlight = (round, display) => {
  const alteration = pick(['path', 'speed', 'altitude']);
  if (alteration === 'speed') {
    const speedPattern = [...display.speedPattern];
    const first = speedPattern.indexOf('slow');
    const second = speedPattern.indexOf('fast');
    [speedPattern[first], speedPattern[second]] = [speedPattern[second], speedPattern[first]];
    return {
      ...display,
      speedPattern,
      note: 'The aircraft speed changes occur in different parts of the route.'
    };
  }
  if (alteration === 'altitude') {
    const altitudeProfile = pick(ALTITUDE_PROFILE_IDS.filter((profile) => profile !== display.altitudeProfile));
    return {
      ...display,
      altitudeProfile,
      note: 'The aircraft climb and descent profile does not match the altitude chart.'
    };
  }

  const pathControls = display.pathControls.map((point) => ({ ...point }));
  const pointIndex = Math.random() < 0.5 ? 1 : 2;
  const shift = pathControls[pointIndex].x < MAP_SIZE / 2 ? 1.65 : -1.65;
  pathControls[pointIndex].x = roundTo(clamp(pathControls[pointIndex].x + shift, 0.45, 6.55));
  return {
    ...display,
    pathControls,
    note: 'The aircraft follows a different ground track from the dotted flight-path map.'
  };
};

const makeRecallQuestion = (round, questionIndex) => {
  const target = round.targetSequence[questionIndex % round.targetSequence.length];
  const targetAccurate = round.truthPattern[questionIndex % round.truthPattern.length];
  let display = {
    objects: round.objects.map((object) => ({ ...object })),
    pathControls: round.pathControls.map((point) => ({ ...point })),
    speedPattern: [...round.speedPattern],
    altitudeProfile: round.altitudeProfile
  };
  const notes = [];

  if (target === 'scene') {
    if (!targetAccurate) {
      if (Math.random() < 0.58) {
        const changedType = pick([...new Set(round.objects.map((object) => object.type))]);
        const changed = alterObjectType(display.objects, round.hills, changedType);
        display.objects = changed.objects;
        notes.push(changed.note);
      } else {
        const changed = alterFlight(round, display);
        display = { ...changed };
        notes.push(changed.note);
      }
    }
  } else if (target === 'aircraft') {
    if (!targetAccurate) {
      const changed = alterFlight(round, display);
      display = { ...changed };
      notes.push(changed.note);
    } else if (Math.random() < 0.5) {
      const changedType = pick([...new Set(round.objects.map((object) => object.type))]);
      const changed = alterObjectType(display.objects, round.hills, changedType);
      display.objects = changed.objects;
      notes.push(changed.note);
    }
  } else {
    if (!targetAccurate) {
      const changed = alterObjectType(display.objects, round.hills, target);
      display.objects = changed.objects;
      notes.push(changed.note);
    }
    if (Math.random() < 0.55) {
      const unrelatedTypes = [...new Set(round.objects.map((object) => object.type))]
        .filter((type) => type !== target);
      if (unrelatedTypes.length && Math.random() < 0.72) {
        const changed = alterObjectType(display.objects, round.hills, pick(unrelatedTypes));
        display.objects = changed.objects;
        notes.push(changed.note);
      } else {
        const changed = alterFlight(round, display);
        display = { ...changed };
        notes.push(changed.note);
      }
    }
  }

  const prompt = target === 'scene'
    ? 'Is this complete scene accurate?'
    : target === 'aircraft'
      ? 'Is the aircraft flight accurate?'
      : target === 'troops'
        ? 'Are the troops accurate?'
        : `Is the ${OBJECT_DEFINITIONS[target].singular} accurate?`;
  const answer = targetAccurate ? 'YES' : 'NO';
  const explanation = targetAccurate
    ? target === 'scene'
      ? 'All ground objects and the aircraft flight match the study displays.'
      : target === 'aircraft'
        ? 'The route, speed changes and altitude profile match. Ground-object errors do not affect an aircraft-only question.'
        : `The number and positions of the ${OBJECT_DEFINITIONS[target].plural} match. Unrelated errors do not affect this question.`
    : notes[0];

  return {
    id: `${round.id}-q${questionIndex}-${Math.random().toString(36).slice(2)}`,
    target,
    prompt,
    answer,
    explanation,
    display,
    notes
  };
};

const mapCoordinate = (value) => 42 + ((value + 0.5) / MAP_SIZE) * 336;
const mapRadius = (value) => (value / MAP_SIZE) * 336;

const MapGrid = ({ clipId }) => (
  <g clipPath={`url(#${clipId})`}>
    <rect x="42" y="27" width="336" height="336" fill="#3D7412" />
    {Array.from({ length: MAP_SIZE + 1 }, (_, index) => {
      const coordinate = 42 + (index / MAP_SIZE) * 336;
      return (
        <g key={index}>
          <line x1={coordinate} y1="27" x2={coordinate} y2="363" stroke="#172A08" strokeWidth="1" />
          <line x1="42" y1={27 + (index / MAP_SIZE) * 336} x2="378" y2={27 + (index / MAP_SIZE) * 336} stroke="#172A08" strokeWidth="1" />
        </g>
      );
    })}
  </g>
);

const MapObject = ({ object, scale = 1 }) => {
  const x = mapCoordinate(object.x);
  const y = 27 + ((object.z + 0.5) / MAP_SIZE) * 336;
  const rotation = `rotate(${object.rotation} ${x} ${y})`;

  if (object.type === 'farm') {
    return (
      <g transform={rotation}>
        <rect x={x - 13 * scale} y={y - 10 * scale} width={26 * scale} height={20 * scale} fill="#D49A75" stroke="#5B3424" strokeWidth="1.5" />
        <path d={`M ${x - 16 * scale} ${y - 10 * scale} L ${x} ${y - 22 * scale} L ${x + 16 * scale} ${y - 10 * scale} Z`} fill="#88523B" />
      </g>
    );
  }
  if (object.type === 'truck') {
    return (
      <g transform={rotation}>
        <rect x={x - 16 * scale} y={y - 8 * scale} width={23 * scale} height={14 * scale} fill="#858C62" stroke="#333722" strokeWidth="1.5" />
        <rect x={x + 7 * scale} y={y - 5 * scale} width={9 * scale} height={11 * scale} fill="#A0A67A" stroke="#333722" strokeWidth="1.5" />
        <circle cx={x - 9 * scale} cy={y + 8 * scale} r={3 * scale} fill="#222" />
        <circle cx={x + 10 * scale} cy={y + 8 * scale} r={3 * scale} fill="#222" />
      </g>
    );
  }
  if (object.type === 'troops') {
    return (
      <g fill="#11162D">
        {[-8, 0, 8].flatMap((dx) => [-7, 3].map((dy) => (
          <circle key={`${dx}-${dy}`} cx={x + dx * scale} cy={y + dy * scale} r={3.2 * scale} />
        )))}
      </g>
    );
  }
  return (
    <g fill="#153F10" stroke="#0B2507" strokeWidth="1">
      {[-10, 0, 10].map((dx, index) => (
        <g key={dx} transform={`translate(${x + dx * scale} ${y + (index % 2) * 5 * scale}) scale(${scale})`}>
          <rect x="-1.5" y="3" width="3" height="11" fill="#4B321B" stroke="none" />
          <path d="M0 -14 L-8 4 H8 Z M0 -7 L-9 9 H9 Z" />
        </g>
      ))}
    </g>
  );
};

const CircularMapBase = ({ round, clipId, children }) => (
  <svg viewBox="0 0 420 405" className="h-full w-full" aria-hidden="true">
    <defs>
      <clipPath id={clipId}><circle cx="210" cy="195" r="168" /></clipPath>
    </defs>
    <MapGrid clipId={clipId} />
    <g clipPath={`url(#${clipId})`}>
      {round.hills.map((hill, index) => (
        <circle
          key={index}
          cx={mapCoordinate(hill.x)}
          cy={27 + ((hill.z + 0.5) / MAP_SIZE) * 336}
          r={mapRadius(hill.radius)}
          fill="#5C8E24"
          stroke="#6C9D32"
          strokeWidth="2"
        />
      ))}
      {children}
    </g>
    <circle cx="210" cy="195" r="168" fill="none" stroke="#050505" strokeWidth="4" />
    <text x="210" y="18" fill="white" fontSize="15" fontWeight="700" textAnchor="middle">N</text>
    <path d="M210 22 L203 34 H217 Z" fill="white" />
  </svg>
);

const ObjectMap = ({ round }) => (
  <div className="sit-map-display" data-testid="sit-object-map">
    <CircularMapBase round={round} clipId={`sit-object-${round.id}`}>
      {round.objects.map((object) => <MapObject key={object.id} object={object} />)}
    </CircularMapBase>
    <div className="sit-map-legend">
      {OBJECT_TYPES.map((type) => (
        <div key={type}><span style={{ background: OBJECT_DEFINITIONS[type].colour }} />{OBJECT_DEFINITIONS[type].plural}</div>
      ))}
    </div>
  </div>
);

const FlightPathMap = ({ round }) => {
  const samples = sampleRoute(round.pathControls, round.speedPattern);
  return (
    <div className="sit-map-display" data-testid="sit-flight-map">
      <CircularMapBase round={round} clipId={`sit-flight-${round.id}`}>
        {samples.map((sample, index) => (
          <circle
            key={index}
            cx={mapCoordinate(sample.x)}
            cy={27 + ((sample.z + 0.5) / MAP_SIZE) * 336}
            r={index === 0 || index === samples.length - 1 ? 5.2 : 3.6}
            fill="#111447"
          />
        ))}
        <path
          d={`M ${mapCoordinate(samples[samples.length - 1].x) - 8} ${27 + ((samples[samples.length - 1].z + 0.5) / MAP_SIZE) * 336 - 4} l 15 4 l -12 9 z`}
          fill="#F4E54B"
          stroke="#111"
          strokeWidth="1"
        />
      </CircularMapBase>
      <div className="sit-speed-key">
        Dot spacing: <strong>closer = faster</strong>
      </div>
    </div>
  );
};

const AltitudeChart = ({ round }) => {
  const samples = sampleRoute(round.pathControls, round.speedPattern);
  return (
    <svg
      viewBox="0 0 820 270"
      className="h-full w-full"
      role="img"
      aria-label="Aircraft speed and altitude chart"
      data-testid="sit-altitude-chart"
    >
      <rect width="820" height="270" fill="#F5F5F3" />
      <text x="410" y="25" fill="#111" fontSize="17" fontWeight="700" textAnchor="middle">AIRCRAFT SPEED &amp; ALTITUDE</text>
      <line x1="68" y1="42" x2="68" y2="228" stroke="#111" strokeWidth="4" />
      <line x1="68" y1="228" x2="786" y2="228" stroke="#111" strokeWidth="4" />
      <text x="24" y="54" fill="#111" fontSize="12" fontWeight="700">HIGH</text>
      <text x="28" y="226" fill="#111" fontSize="12" fontWeight="700">LOW</text>
      <text x="68" y="252" fill="#111" fontSize="12" fontWeight="700">ENTRY</text>
      <text x="746" y="252" fill="#111" fontSize="12" fontWeight="700">EXIT</text>
      {samples.map((sample, index) => {
        const x = 82 + sample.t * 682;
        const altitude = altitudeAt(round.altitudeProfile, sample.t);
        const y = 218 - ((altitude - 0.65) / 2.15) * 158;
        return <circle key={index} cx={x} cy={y} r="5.3" fill="#E8252B" />;
      })}
    </svg>
  );
};

const mapToWorld = ({ x, z }, y = 0) => new THREE.Vector3(
  (x - 3.5) * 1.8,
  y,
  (z - 3.5) * 1.68
);

const material = (colour, options = {}) => new THREE.MeshStandardMaterial({
  color: colour,
  roughness: options.roughness ?? 0.78,
  metalness: options.metalness ?? 0.02
});

const addMesh = (group, geometry, meshMaterial, position, options = {}) => {
  const mesh = new THREE.Mesh(geometry, meshMaterial);
  mesh.position.set(position[0], position[1], position[2]);
  if (options.rotation) mesh.rotation.set(...options.rotation);
  if (options.scale) mesh.scale.set(...options.scale);
  mesh.castShadow = options.castShadow !== false;
  mesh.receiveShadow = options.receiveShadow !== false;
  group.add(mesh);
  return mesh;
};

const makeFarm3D = () => {
  const group = new THREE.Group();
  addMesh(group, new THREE.BoxGeometry(0.9, 0.58, 0.72), material(0xd7b18c), [0, 0.29, 0]);
  addMesh(group, new THREE.ConeGeometry(0.68, 0.38, 4), material(0x81533e), [0, 0.76, 0], { rotation: [0, Math.PI / 4, 0] });
  addMesh(group, new THREE.BoxGeometry(0.18, 0.34, 0.04), material(0x523727), [0, 0.18, 0.38]);
  addMesh(group, new THREE.BoxGeometry(0.22, 0.18, 0.04), material(0x90c5d3), [-0.26, 0.36, 0.38]);
  return group;
};

const makeTruck3D = () => {
  const group = new THREE.Group();
  addMesh(group, new THREE.BoxGeometry(0.85, 0.4, 0.5), material(0x536840), [-0.12, 0.37, 0]);
  addMesh(group, new THREE.BoxGeometry(0.36, 0.47, 0.5), material(0x71855a), [0.48, 0.4, 0]);
  addMesh(group, new THREE.BoxGeometry(0.2, 0.16, 0.02), material(0xa8d2da), [0.58, 0.49, 0.26]);
  const wheelMaterial = material(0x171717, { roughness: 0.95 });
  [-0.38, 0.38].forEach((x) => {
    [-0.29, 0.29].forEach((z) => {
      addMesh(group, new THREE.CylinderGeometry(0.12, 0.12, 0.08, 12), wheelMaterial, [x, 0.14, z], { rotation: [Math.PI / 2, 0, 0] });
    });
  });
  return group;
};

const makeTroops3D = () => {
  const group = new THREE.Group();
  const bodyMaterial = material(0x3b4930);
  const headMaterial = material(0xc6a57d);
  [[-0.28, -0.2], [0.1, -0.22], [-0.08, 0.18], [0.34, 0.18], [-0.42, 0.2]].forEach(([x, z]) => {
    addMesh(group, new THREE.CylinderGeometry(0.08, 0.1, 0.42, 8), bodyMaterial, [x, 0.25, z]);
    addMesh(group, new THREE.SphereGeometry(0.09, 10, 7), headMaterial, [x, 0.52, z]);
  });
  return group;
};

const makeTrees3D = () => {
  const group = new THREE.Group();
  const trunkMaterial = material(0x53351f);
  const leaves = material(0x265b20);
  [[-0.36, 0.06, 0.86], [0, -0.16, 1.05], [0.36, 0.1, 0.76]].forEach(([x, z, height]) => {
    addMesh(group, new THREE.CylinderGeometry(0.055, 0.07, height * 0.45, 8), trunkMaterial, [x, height * 0.225, z]);
    addMesh(group, new THREE.ConeGeometry(0.28, height * 0.76, 10), leaves, [x, height * 0.72, z]);
  });
  return group;
};

const makeObject3D = (object) => {
  const group = object.type === 'farm'
    ? makeFarm3D()
    : object.type === 'truck'
      ? makeTruck3D()
      : object.type === 'troops'
        ? makeTroops3D()
        : makeTrees3D();
  const position = mapToWorld(object);
  group.position.copy(position);
  group.rotation.y = THREE.MathUtils.degToRad(object.rotation);
  return group;
};

const makeAircraft3D = () => {
  const group = new THREE.Group();
  const yellow = material(0xf4dd24, { roughness: 0.38, metalness: 0.12 });
  const dark = material(0x333333, { roughness: 0.45 });
  addMesh(group, new THREE.BoxGeometry(0.16, 0.14, 0.86), yellow, [0, 0, 0]);
  addMesh(group, new THREE.BoxGeometry(1.02, 0.055, 0.22), yellow, [0, 0, 0.04]);
  addMesh(group, new THREE.BoxGeometry(0.48, 0.05, 0.17), yellow, [0, 0.03, 0.34]);
  addMesh(group, new THREE.BoxGeometry(0.05, 0.28, 0.2), yellow, [0, 0.14, 0.33]);
  addMesh(group, new THREE.SphereGeometry(0.09, 12, 8), dark, [0, 0.08, -0.27], { scale: [0.8, 0.65, 1.7] });
  group.scale.setScalar(1.3);
  return group;
};

const LandscapeScene = ({ round, question }) => {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    let animationFrame;
    let renderer;
    let resizeObserver;
    let disposed = false;
    try {
      const width = mount.clientWidth || 960;
      const height = mount.clientHeight || 720;
      renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFShadowMap;
      renderer.domElement.setAttribute('data-testid', 'sit-landscape-canvas');
      mount.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x8fb8ca);
      scene.fog = new THREE.Fog(0x9cb8ae, 15, 31);
      const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 70);
      const frameCamera = (frameWidth, frameHeight) => {
        const aspect = frameWidth / frameHeight;
        camera.aspect = aspect;
        if (aspect < 0.8) {
          camera.fov = 78;
          camera.position.set(0, 16.5, 16.5);
          camera.lookAt(0, 0, -0.2);
        } else {
          camera.fov = 50;
          camera.position.set(0, 8.1, 14.8);
          camera.lookAt(0, 0.6, -1.4);
        }
        camera.updateProjectionMatrix();
      };
      frameCamera(width, height);

      scene.add(new THREE.HemisphereLight(0xd5edff, 0x496423, 2.1));
      const sunlight = new THREE.DirectionalLight(0xfff1cf, 2.6);
      sunlight.position.set(-7, 13, 8);
      sunlight.castShadow = true;
      sunlight.shadow.mapSize.set(1024, 1024);
      sunlight.shadow.camera.left = -12;
      sunlight.shadow.camera.right = 12;
      sunlight.shadow.camera.top = 12;
      sunlight.shadow.camera.bottom = -12;
      scene.add(sunlight);

      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(23, 23),
        material(0x5f871f, { roughness: 0.94 })
      );
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = true;
      scene.add(ground);

      const grid = new THREE.GridHelper(15.3, MAP_SIZE, 0xcbd8a9, 0xa8bc7a);
      grid.position.y = 0.015;
      grid.material.transparent = true;
      grid.material.opacity = 0.58;
      scene.add(grid);

      for (let index = 0; index < 10; index += 1) {
        const x = -11 + index * 2.45;
        const heightScale = 1.6 + ((index * 7) % 5) * 0.28;
        const mountain = new THREE.Mesh(
          new THREE.ConeGeometry(1.85, heightScale, 7),
          material(index % 2 ? 0x79806c : 0x8b8069, { roughness: 1 })
        );
        mountain.position.set(x, heightScale / 2 - 0.1, -10.1 - (index % 2) * 0.7);
        mountain.receiveShadow = true;
        scene.add(mountain);
        const snow = new THREE.Mesh(
          new THREE.ConeGeometry(0.56, heightScale * 0.34, 7),
          material(0xe8e6da, { roughness: 0.92 })
        );
        snow.position.set(x, heightScale - heightScale * 0.17 - 0.1, mountain.position.z);
        scene.add(snow);
      }

      round.hills.forEach((hill) => {
        const hillGeometry = new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
        const hillMesh = new THREE.Mesh(hillGeometry, material(0x6e972d, { roughness: 1 }));
        const world = mapToWorld(hill);
        hillMesh.position.set(world.x, -0.03, world.z);
        hillMesh.scale.set(hill.radius * 1.75, hill.radius * 0.95, hill.radius * 1.62);
        hillMesh.castShadow = true;
        hillMesh.receiveShadow = true;
        scene.add(hillMesh);
      });

      question.display.objects.forEach((object) => scene.add(makeObject3D(object)));

      const routePoints = Array.from({ length: 90 }, (_, index) => {
        const t = index / 89;
        const mapPoint = cubicPoint(question.display.pathControls, t);
        return mapToWorld(mapPoint, 1.05 + altitudeAt(question.display.altitudeProfile, t) * 1.08);
      });
      const pointOnRoute = (value) => {
        const safeValue = clamp(Number.isFinite(value) ? value : 0, 0, 1);
        const scaledIndex = safeValue * (routePoints.length - 1);
        const lowerIndex = Math.floor(scaledIndex);
        const upperIndex = Math.min(routePoints.length - 1, lowerIndex + 1);
        return routePoints[lowerIndex].clone().lerp(
          routePoints[upperIndex],
          scaledIndex - lowerIndex
        );
      };
      const aircraft = makeAircraft3D();
      scene.add(aircraft);

      let progress = 0.02;
      let replayPause = 0;
      let previousFrameTime = performance.now();
      const render = (frameTime = performance.now()) => {
        if (disposed) return;
        const delta = Math.min((frameTime - previousFrameTime) / 1000, 0.05);
        previousFrameTime = frameTime;
        if (replayPause > 0) {
          replayPause -= delta;
        } else {
          const segment = Math.min(2, Math.floor(progress * 3));
          progress += delta * 0.085 * SPEED_FACTOR[question.display.speedPattern[segment]];
          if (progress >= 1) {
            progress = 0;
            replayPause = 1.15;
          }
        }
        const point = pointOnRoute(progress);
        const next = pointOnRoute(progress + 0.005);
        aircraft.position.copy(point);
        aircraft.lookAt(next);
        aircraft.rotateY(Math.PI);
        renderer.render(scene, camera);
        mount.dataset.rendered = 'true';
        if (!disposed) animationFrame = window.requestAnimationFrame(render);
      };
      render();

      resizeObserver = new ResizeObserver(() => {
        const nextWidth = mount.clientWidth || width;
        const nextHeight = mount.clientHeight || height;
        renderer.setSize(nextWidth, nextHeight);
        frameCamera(nextWidth, nextHeight);
      });
      resizeObserver.observe(mount);

      return () => {
        disposed = true;
        window.cancelAnimationFrame(animationFrame);
        resizeObserver.disconnect();
        scene.traverse((object) => {
          object.geometry?.dispose?.();
          if (Array.isArray(object.material)) object.material.forEach((item) => item.dispose?.());
          else object.material?.dispose?.();
        });
        renderer.renderLists.dispose();
        renderer.dispose();
        renderer.forceContextLoss();
        renderer.domElement.remove();
      };
    } catch (error) {
      mount.dataset.error = error.message;
      return () => {
        disposed = true;
        if (animationFrame) window.cancelAnimationFrame(animationFrame);
        resizeObserver?.disconnect();
        renderer?.dispose();
        renderer?.forceContextLoss();
      };
    }
  }, [question, round]);

  return <div ref={mountRef} className="sit-landscape" data-testid="sit-landscape" />;
};

const TestStyles = () => (
  <style>{`
    .sit-test-root {
      align-items: center;
      background: #000;
      display: flex;
      font-family: Arial, Helvetica, sans-serif;
      inset: 0;
      justify-content: center;
      position: fixed;
      z-index: 100;
    }
    .sit-frame {
      background: #000080;
      border: 2px solid #d8d8e8;
      color: #fff;
      container-type: inline-size;
      height: min(100dvh, 75vw);
      overflow: hidden;
      width: min(100vw, 133.333dvh);
    }
    .sit-title-bar {
      align-items: center;
      background: #000073;
      border-bottom: 1px solid #d8d8e8;
      display: flex;
      font-size: clamp(11px, 1.45cqw, 17px);
      font-weight: 700;
      height: 5.5%;
      justify-content: space-between;
      padding-inline: 1.4cqw;
    }
    .sit-study-frame {
      display: flex;
      flex-direction: column;
    }
    .sit-study-grid {
      display: grid;
      flex: 1;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      grid-template-rows: minmax(0, 1fr) 33%;
      min-height: 0;
    }
    .sit-study-panel {
      background: #000080;
      display: flex;
      flex-direction: column;
      min-height: 0;
    }
    .sit-study-panel:nth-child(1) {
      border-right: 1px solid #d8d8e8;
    }
    .sit-study-panel-chart {
      border-top: 1px solid #d8d8e8;
      grid-column: 1 / -1;
    }
    .sit-panel-heading {
      background: #08089a;
      border-bottom: 1px solid #b9b9d5;
      flex: 0 0 auto;
      font-size: clamp(10px, 1.25cqw, 15px);
      font-weight: 700;
      padding: .38cqw 1cqw;
      text-align: center;
    }
    .sit-map-display {
      flex: 1;
      min-height: 0;
      position: relative;
    }
    .sit-map-display > svg {
      display: block;
      margin: auto;
      max-width: 100%;
    }
    .sit-map-legend {
      bottom: .35cqw;
      display: flex;
      flex-wrap: wrap;
      font-size: clamp(9px, 1.08cqw, 12px);
      gap: .35cqw 1.1cqw;
      justify-content: center;
      left: 0;
      position: absolute;
      right: 0;
    }
    .sit-map-legend div {
      align-items: center;
      display: flex;
      gap: .3cqw;
    }
    .sit-map-legend span {
      border: 1px solid #fff;
      display: inline-block;
      height: 1cqw;
      min-height: 8px;
      min-width: 8px;
      width: 1cqw;
    }
    .sit-speed-key {
      bottom: .5cqw;
      font-size: clamp(8px, 1cqw, 12px);
      left: 0;
      position: absolute;
      right: 0;
      text-align: center;
    }
    .sit-study-footer {
      align-items: center;
      background: #050515;
      border-top: 1px solid #d8d8e8;
      display: grid;
      flex: 0 0 6%;
      font-size: clamp(10px, 1.25cqw, 15px);
      grid-template-columns: 1fr auto 1fr;
      padding-inline: 1.3cqw;
    }
    .sit-ready-button {
      align-items: center;
      background: #c6c6b1;
      border: 2px outset #f0f0df;
      color: #111;
      display: flex;
      font-size: clamp(10px, 1.1cqw, 13px);
      font-weight: 700;
      gap: .45cqw;
      padding: .28cqw .75cqw;
    }
    .sit-recall-frame {
      position: relative;
    }
    .sit-landscape {
      background: #8fb8ca;
      inset: 0;
      position: absolute;
    }
    .sit-landscape canvas {
      display: block;
      height: 100%;
      width: 100%;
    }
    .sit-recall-top {
      align-items: center;
      background: rgba(0, 0, 91, .96);
      border-bottom: 1px solid #fff;
      display: flex;
      font-size: clamp(10px, 1.3cqw, 16px);
      font-weight: 700;
      height: 5.5%;
      inset: 0 0 auto;
      justify-content: space-between;
      padding-inline: 1.4cqw;
      position: absolute;
      z-index: 2;
    }
    .sit-compass {
      align-items: center;
      background: rgba(0, 0, 30, .74);
      border: 1px solid #fff;
      display: flex;
      flex-direction: column;
      font-size: clamp(11px, 1.45cqw, 17px);
      font-weight: 700;
      height: 5.2cqw;
      justify-content: center;
      left: 1.4cqw;
      max-height: 58px;
      max-width: 58px;
      min-height: 38px;
      min-width: 38px;
      position: absolute;
      top: 7cqw;
      width: 5.2cqw;
      z-index: 2;
    }
    .sit-compass::before {
      border-bottom: 1.1cqw solid #fff;
      border-left: .65cqw solid transparent;
      border-right: .65cqw solid transparent;
      content: "";
      height: 0;
      width: 0;
    }
    .sit-question-band {
      align-items: center;
      background: rgba(0, 0, 89, .97);
      border-top: 2px solid #fff;
      bottom: 0;
      display: grid;
      gap: 1.6cqw;
      grid-template-columns: minmax(0, 1fr) auto;
      left: 0;
      min-height: 16%;
      padding: 1.1cqw 2cqw;
      position: absolute;
      right: 0;
      z-index: 2;
    }
    .sit-question-card {
      background: #c9c9ad;
      border: 2px outset #eeeece;
      color: #111;
      font-size: clamp(14px, 2cqw, 24px);
      font-weight: 700;
      padding: 1.05cqw 1.4cqw;
    }
    .sit-answer-buttons {
      display: grid;
      gap: .7cqw;
      grid-template-columns: repeat(2, minmax(6.5cqw, 1fr));
    }
    .sit-answer-button {
      background: #c9c9ad;
      border: 3px outset #eeeece;
      color: #111;
      font-size: clamp(13px, 1.65cqw, 20px);
      font-weight: 700;
      min-height: 4.6cqw;
      padding-inline: 1.25cqw;
    }
    .sit-answer-button:active {
      border-style: inset;
    }
    .sit-answer-button:focus-visible,
    .sit-ready-button:focus-visible {
      outline: 4px solid #ffff00;
      outline-offset: 2px;
    }
    @media (max-aspect-ratio: 4 / 5) {
      .sit-frame {
        height: 100dvh;
        width: 100vw;
      }
      .sit-study-frame {
        overflow-y: auto;
      }
      .sit-title-bar {
        flex: 0 0 44px;
      }
      .sit-study-grid {
        display: block;
        flex: 0 0 auto;
      }
      .sit-study-panel {
        border-bottom: 1px solid #d8d8e8;
        height: 410px;
      }
      .sit-study-panel:nth-child(1) {
        border-right: 0;
      }
      .sit-study-panel-chart {
        height: 245px;
      }
      .sit-study-footer {
        bottom: 0;
        flex: 0 0 52px;
        position: sticky;
        z-index: 3;
      }
      .sit-map-legend {
        font-size: 10px;
      }
      .sit-question-band {
        display: block;
        min-height: 22%;
        padding: 10px;
      }
      .sit-question-card {
        font-size: 16px;
        margin-bottom: 9px;
        padding: 10px;
      }
      .sit-answer-buttons {
        gap: 9px;
      }
      .sit-answer-button {
        min-height: 44px;
      }
      .sit-recall-top {
        height: 44px;
      }
      .sit-compass {
        top: 58px;
      }
    }
  `}</style>
);

const StudyScreen = ({
  round,
  mode,
  difficulty,
  roundNumber,
  remaining,
  studyRemaining,
  onReady
}) => (
  <div className="sit-test-root" data-testid="sit-study-screen">
    <TestStyles />
    <main className="sit-frame sit-study-frame">
      <header className="sit-title-bar">
        <span>SPATIAL INTEGRATION TEST - STUDY</span>
        <span>Round {roundNumber} | {formatTime(remaining)}</span>
      </header>
      <div className="sit-study-grid">
        <section className="sit-study-panel">
          <div className="sit-panel-heading">OBJECT MAP</div>
          <ObjectMap round={round} />
        </section>
        <section className="sit-study-panel">
          <div className="sit-panel-heading">AIRCRAFT FLIGHT PATH</div>
          <FlightPathMap round={round} />
        </section>
        <section className="sit-study-panel sit-study-panel-chart">
          <AltitudeChart round={round} />
        </section>
      </div>
      <footer className="sit-study-footer">
        <span>{mode === 'practice' ? 'Practice' : 'Assessment'} | {difficulty.toUpperCase()}</span>
        <strong data-testid="sit-study-timer">Study time: {formatTime(studyRemaining)}</strong>
        <span className="flex justify-end">
          {mode === 'practice' && (
            <button type="button" className="sit-ready-button" onClick={onReady} data-testid="sit-ready-button" title="Begin questions">
              READY <ArrowRight size={15} aria-hidden="true" />
            </button>
          )}
        </span>
      </footer>
    </main>
  </div>
);

const RecallScreen = ({
  round,
  question,
  questionNumber,
  questionCount,
  roundNumber,
  remaining,
  onAnswer
}) => (
  <div className="sit-test-root" data-testid="sit-recall-screen">
    <TestStyles />
    <main className="sit-frame sit-recall-frame">
      <LandscapeScene round={round} question={question} />
      <header className="sit-recall-top">
        <span>SPATIAL INTEGRATION TEST - TESTING</span>
        <span>Round {roundNumber} | Question {questionNumber} of {questionCount} | {formatTime(remaining)}</span>
      </header>
      <div className="sit-compass" aria-label="View looking north"><span>N</span></div>
      <section className="sit-question-band">
        <div className="sit-question-card" data-testid="sit-question">{question.prompt}</div>
        <div className="sit-answer-buttons">
          <button type="button" className="sit-answer-button" data-testid="sit-answer-yes" onClick={() => onAnswer('YES')}>YES</button>
          <button type="button" className="sit-answer-button" data-testid="sit-answer-no" onClick={() => onAnswer('NO')}>NO</button>
        </div>
      </section>
    </main>
  </div>
);

const SpatialIntegration = () => {
  const navigate = useNavigate();
  const [stage, setStage] = useState('menu');
  const [mode, setMode] = useState(null);
  const [difficulty, setDifficulty] = useState(null);
  const [config, setConfig] = useState(null);
  const [phase, setPhase] = useState('study');
  const [round, setRound] = useState(null);
  const [roundNumber, setRoundNumber] = useState(1);
  const [roundQuestionIndex, setRoundQuestionIndex] = useState(0);
  const [question, setQuestion] = useState(null);
  const [studyRemaining, setStudyRemaining] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [responses, setResponses] = useState([]);
  const answerLockRef = useRef(false);
  const answerRef = useRef(() => {});
  const savedRef = useRef(false);

  const studyDurationFor = (nextConfig = config) => (
    nextConfig?.studyDuration ?? STUDY_DURATION[difficulty]
  );
  const questionsPerRoundFor = (nextConfig = config) => (
    nextConfig?.questionsPerRound ?? QUESTIONS_PER_ROUND[difficulty]
  );

  const start = () => {
    const nextConfig = getSettings().spatialIntegration[difficulty];
    const nextRound = createRound(difficulty);
    savedRef.current = false;
    answerLockRef.current = false;
    setConfig(nextConfig);
    setRound(nextRound);
    setRoundNumber(1);
    setRoundQuestionIndex(0);
    setQuestion(null);
    setStudyRemaining(studyDurationFor(nextConfig));
    setRemaining(nextConfig.testDuration);
    setAnswered(0);
    setCorrect(0);
    setResponses([]);
    setPhase('study');
    setStage('test');
  };

  const finish = () => setStage('results');

  const beginRecall = () => {
    if (phase !== 'study' || !round) return;
    answerLockRef.current = false;
    setQuestion(makeRecallQuestion(round, roundQuestionIndex));
    setPhase('recall');
  };

  const answer = (given) => {
    if (answerLockRef.current || !question || !config) return;
    answerLockRef.current = true;
    const isRight = given === question.answer;
    const nextAnswered = answered + 1;
    const nextCorrect = isRight ? correct + 1 : correct;
    const nextRoundQuestion = roundQuestionIndex + 1;

    setResponses((previous) => [...previous, {
      prompt: question.prompt,
      detail: question.target === 'scene'
        ? 'Complete landscape and aircraft comparison'
        : question.target === 'aircraft'
          ? 'Aircraft route, speed and altitude comparison'
          : `${OBJECT_DEFINITIONS[question.target].singular} count and position comparison`,
      given,
      answer: question.answer,
      correct: isRight,
      explanation: question.explanation
    }]);
    setAnswered(nextAnswered);
    setCorrect(nextCorrect);

    if (nextAnswered >= config.questionCount) {
      finish();
      return;
    }

    if (nextRoundQuestion >= questionsPerRoundFor()) {
      const nextRound = createRound(difficulty);
      setRound(nextRound);
      setRoundNumber((current) => current + 1);
      setRoundQuestionIndex(0);
      setQuestion(null);
      setStudyRemaining(studyDurationFor());
      setPhase('study');
      answerLockRef.current = false;
      return;
    }

    setRoundQuestionIndex(nextRoundQuestion);
    setQuestion(makeRecallQuestion(round, nextRoundQuestion));
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
    if (stage !== 'test' || phase !== 'study') return undefined;
    if (studyRemaining <= 0) {
      beginRecall();
      return undefined;
    }
    const timer = window.setTimeout(() => {
      setStudyRemaining((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [phase, stage, studyRemaining]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (stage !== 'test') return undefined;
    const priorBodyOverflow = document.body.style.overflow;
    const priorHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = priorBodyOverflow;
      document.documentElement.style.overflow = priorHtmlOverflow;
    };
  }, [stage]);

  useEffect(() => {
    if (stage !== 'test') return undefined;
    const onKeyDown = (event) => {
      if (phase === 'study' && mode === 'practice' && (event.key === 'Enter' || event.key === 'ArrowRight')) {
        event.preventDefault();
        beginRecall();
        return;
      }
      if (phase !== 'recall') return;
      if (event.key.toLowerCase() === 'y' || event.key === '1') {
        event.preventDefault();
        answerRef.current('YES');
      } else if (event.key.toLowerCase() === 'n' || event.key === '2') {
        event.preventDefault();
        answerRef.current('NO');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mode, phase, stage]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (stage !== 'results' || mode !== 'assessment' || answered === 0 || savedRef.current) return;
    savedRef.current = true;
    saveResult('Spatial Integration', mode, difficulty, {
      accuracy: (correct / answered) * 100,
      correct,
      total: answered
    });
  }, [answered, correct, difficulty, mode, stage]);

  if (stage === 'menu') {
    return (
      <ModuleMenu
        title="Spatial Integration - Setup"
        description="Study a ground-object map, aircraft route, and speed/altitude chart. Then judge the accuracy of a perspective landscape from memory."
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
        title="Spatial Integration - Results"
        rows={[['Correct', `${correct} / ${answered}`], ['Accuracy', `${accuracy.toFixed(1)}%`]]}
        overallScore={accuracy}
        summary={responses}
        onRetry={() => setStage('menu')}
        onDashboard={() => navigate('/')}
      />
    );
  }

  if (phase === 'study') {
    return (
      <StudyScreen
        round={round}
        mode={mode}
        difficulty={difficulty}
        roundNumber={roundNumber}
        remaining={remaining}
        studyRemaining={studyRemaining}
        onReady={beginRecall}
      />
    );
  }

  return (
    <RecallScreen
      round={round}
      question={question}
      questionNumber={answered + 1}
      questionCount={config.questionCount}
      roundNumber={roundNumber}
      remaining={remaining}
      onAnswer={answer}
    />
  );
};

export default SpatialIntegration;
