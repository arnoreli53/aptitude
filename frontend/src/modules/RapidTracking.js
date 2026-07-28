import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as THREE from 'three';
import { Camera, Gamepad2, MousePointer2 } from 'lucide-react';
import { getGamepad, getSettings, saveResult } from '../utils/storage';
import { formatTime, ModuleMenu, ModuleResults } from './cbtCommon';
import { useGamepad } from '../hooks/useGamepad';
import './RapidTracking.css';

const PHOTOS_REQUIRED = 3;

const TARGETS = [
  { id: 'building', label: 'RED-ROOF BUILDING', aimHeight: 0.72 },
  { id: 'person', label: 'PERSON', aimHeight: 0.82 },
  { id: 'truck', label: 'LAND VEHICLE', aimHeight: 0.52 },
  { id: 'helicopter', label: 'HELICOPTER', aimHeight: 0.18 },
  { id: 'tank', label: 'TANK', aimHeight: 0.5 },
  { id: 'boat', label: 'BOAT', aimHeight: 0.42 },
  { id: 'radar', label: 'RADAR STATION', aimHeight: 0.9 },
  { id: 'jet', label: 'FAST AIRCRAFT', aimHeight: 0.05 }
];

const TARGET_BY_ID = Object.fromEntries(TARGETS.map((target) => [target.id, target]));

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const shuffle = (items) => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const normaliseAngle = (angle) => {
  let next = angle;
  while (next > Math.PI) next -= Math.PI * 2;
  while (next < -Math.PI) next += Math.PI * 2;
  return next;
};

const terrainHeight = (x, z) => {
  const rolling = (
    Math.sin(x * 0.19) * 0.48
    + Math.cos(z * 0.16) * 0.42
    + Math.sin((x + z) * 0.34) * 0.18
  );
  const lakeDepression = Math.exp(-(((x + 3.4) ** 2) / 18 + ((z - 2.7) ** 2) / 9)) * 1.15;
  return rolling - lakeDepression - 0.32;
};

const addMesh = (parent, geometry, material, options = {}) => {
  const mesh = new THREE.Mesh(geometry, material);
  const {
    position = [0, 0, 0],
    rotation = [0, 0, 0],
    scale = [1, 1, 1],
    castShadow = true,
    receiveShadow = true
  } = options;
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.scale.set(...scale);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  parent.add(mesh);
  return mesh;
};

const createMaterials = () => ({
  grass: new THREE.MeshStandardMaterial({ color: 0x557b45, roughness: 0.95 }),
  grassDark: new THREE.MeshStandardMaterial({ color: 0x365532, roughness: 1 }),
  grassLight: new THREE.MeshStandardMaterial({ color: 0x718b50, roughness: 1 }),
  water: new THREE.MeshStandardMaterial({
    color: 0x527f8e,
    roughness: 0.28,
    metalness: 0.08,
    transparent: true,
    opacity: 0.92
  }),
  road: new THREE.MeshStandardMaterial({ color: 0x62635f, roughness: 1 }),
  roadLine: new THREE.MeshStandardMaterial({ color: 0xd2c89a, roughness: 0.9 }),
  concrete: new THREE.MeshStandardMaterial({ color: 0x9a9685, roughness: 0.95 }),
  pale: new THREE.MeshStandardMaterial({ color: 0xb8b39f, roughness: 0.9 }),
  olive: new THREE.MeshStandardMaterial({ color: 0x576143, roughness: 0.88 }),
  oliveDark: new THREE.MeshStandardMaterial({ color: 0x343d2b, roughness: 0.92 }),
  grey: new THREE.MeshStandardMaterial({ color: 0x747b78, roughness: 0.72, metalness: 0.12 }),
  darkGrey: new THREE.MeshStandardMaterial({ color: 0x303534, roughness: 0.82 }),
  black: new THREE.MeshStandardMaterial({ color: 0x151918, roughness: 0.88 }),
  glass: new THREE.MeshStandardMaterial({
    color: 0x44646a,
    roughness: 0.18,
    metalness: 0.12
  }),
  rust: new THREE.MeshStandardMaterial({ color: 0x77634b, roughness: 0.95 }),
  tan: new THREE.MeshStandardMaterial({ color: 0xa88f69, roughness: 0.95 }),
  skin: new THREE.MeshStandardMaterial({ color: 0xa77e64, roughness: 0.9 }),
  white: new THREE.MeshStandardMaterial({ color: 0xd9d9d2, roughness: 0.72 }),
  red: new THREE.MeshStandardMaterial({ color: 0x8d3028, roughness: 0.82 }),
  trunk: new THREE.MeshStandardMaterial({ color: 0x4c3d2e, roughness: 1 }),
  mountain: new THREE.MeshStandardMaterial({ color: 0x697368, roughness: 1 }),
  mountainFar: new THREE.MeshStandardMaterial({ color: 0x7d837b, roughness: 1 })
});

const createBuilding = (materials, target = true) => {
  const group = new THREE.Group();
  addMesh(group, new THREE.BoxGeometry(1.45, 0.78, 1.08), materials.pale, {
    position: [0, 0.39, 0]
  });
  addMesh(group, new THREE.ConeGeometry(0.98, 0.5, 4), materials.red, {
    position: [0, 1.03, 0],
    rotation: [0, Math.PI / 4, 0]
  });
  addMesh(group, new THREE.BoxGeometry(0.28, 0.5, 0.04), materials.darkGrey, {
    position: [0, 0.28, 0.56]
  });
  [-0.42, 0.42].forEach((x) => {
    addMesh(group, new THREE.BoxGeometry(0.26, 0.24, 0.04), materials.glass, {
      position: [x, 0.58, 0.56]
    });
  });
  if (!target) group.scale.setScalar(0.82);
  return group;
};

const createUtilityShed = (materials) => {
  const group = new THREE.Group();
  addMesh(group, new THREE.BoxGeometry(1.15, 0.58, 0.82), materials.tan, {
    position: [0, 0.29, 0]
  });
  addMesh(group, new THREE.BoxGeometry(1.28, 0.12, 0.94), materials.darkGrey, {
    position: [0, 0.64, 0]
  });
  addMesh(group, new THREE.BoxGeometry(0.32, 0.42, 0.04), materials.oliveDark, {
    position: [0, 0.23, 0.43]
  });
  group.scale.setScalar(0.82);
  return group;
};

const createPerson = (materials) => {
  const group = new THREE.Group();
  addMesh(group, new THREE.SphereGeometry(0.13, 12, 8), materials.skin, {
    position: [0, 0.94, 0]
  });
  addMesh(group, new THREE.CylinderGeometry(0.11, 0.17, 0.46, 8), materials.olive, {
    position: [0, 0.64, 0]
  });
  [-1, 1].forEach((side) => {
    addMesh(group, new THREE.CylinderGeometry(0.045, 0.045, 0.43, 7), materials.skin, {
      position: [side * 0.19, 0.65, 0],
      rotation: [0, 0, side * 0.35]
    });
    addMesh(group, new THREE.CylinderGeometry(0.055, 0.055, 0.48, 7), materials.darkGrey, {
      position: [side * 0.1, 0.25, 0],
      rotation: [0, 0, side * 0.18]
    });
  });
  group.scale.setScalar(1.35);
  return group;
};

const createTruck = (materials) => {
  const group = new THREE.Group();
  addMesh(group, new THREE.BoxGeometry(1.2, 0.34, 0.56), materials.olive, {
    position: [-0.12, 0.42, 0]
  });
  addMesh(group, new THREE.BoxGeometry(0.48, 0.48, 0.56), materials.oliveDark, {
    position: [0.67, 0.5, 0]
  });
  addMesh(group, new THREE.BoxGeometry(0.05, 0.22, 0.42), materials.glass, {
    position: [0.925, 0.58, 0]
  });
  [-0.48, 0.5].forEach((x) => {
    [-0.34, 0.34].forEach((z) => {
      addMesh(group, new THREE.CylinderGeometry(0.16, 0.16, 0.11, 12), materials.black, {
        position: [x, 0.2, z],
        rotation: [Math.PI / 2, 0, 0]
      });
    });
  });
  return group;
};

const createHelicopter = (materials) => {
  const group = new THREE.Group();
  const body = addMesh(group, new THREE.SphereGeometry(0.58, 16, 10), materials.olive, {
    scale: [1.38, 0.72, 0.72]
  });
  body.position.y = 0.05;
  addMesh(group, new THREE.SphereGeometry(0.42, 14, 9), materials.glass, {
    position: [0.36, 0.12, 0],
    scale: [1, 0.68, 0.7]
  });
  addMesh(group, new THREE.BoxGeometry(1.4, 0.14, 0.16), materials.oliveDark, {
    position: [-1.05, 0.12, 0],
    rotation: [0, 0, -0.09]
  });
  addMesh(group, new THREE.ConeGeometry(0.25, 0.54, 4), materials.oliveDark, {
    position: [-1.73, 0.27, 0],
    rotation: [0, 0, Math.PI / 2]
  });
  const mainRotor = new THREE.Group();
  mainRotor.position.y = 0.66;
  addMesh(mainRotor, new THREE.BoxGeometry(3.1, 0.035, 0.08), materials.darkGrey);
  addMesh(mainRotor, new THREE.BoxGeometry(0.08, 0.035, 3.1), materials.darkGrey);
  group.add(mainRotor);
  const tailRotor = new THREE.Group();
  tailRotor.position.set(-1.68, 0.34, 0.11);
  addMesh(tailRotor, new THREE.BoxGeometry(0.04, 0.72, 0.07), materials.darkGrey);
  addMesh(tailRotor, new THREE.BoxGeometry(0.04, 0.07, 0.72), materials.darkGrey);
  group.add(tailRotor);
  [-0.43, 0.43].forEach((z) => {
    addMesh(group, new THREE.BoxGeometry(1.24, 0.055, 0.055), materials.darkGrey, {
      position: [-0.05, -0.48, z]
    });
  });
  group.userData.rotors = [
    { object: mainRotor, axis: 'y', rate: 15 },
    { object: tailRotor, axis: 'x', rate: 19 }
  ];
  return group;
};

const createTank = (materials) => {
  const group = new THREE.Group();
  addMesh(group, new THREE.BoxGeometry(1.35, 0.34, 0.76), materials.oliveDark, {
    position: [0, 0.3, 0]
  });
  addMesh(group, new THREE.BoxGeometry(1.12, 0.28, 0.66), materials.olive, {
    position: [0.04, 0.58, 0]
  });
  addMesh(group, new THREE.CylinderGeometry(0.34, 0.42, 0.24, 12), materials.olive, {
    position: [0.08, 0.82, 0]
  });
  addMesh(group, new THREE.CylinderGeometry(0.055, 0.07, 1.25, 10), materials.oliveDark, {
    position: [0.8, 0.88, 0],
    rotation: [0, 0, Math.PI / 2]
  });
  [-0.39, 0.39].forEach((z) => {
    addMesh(group, new THREE.BoxGeometry(1.42, 0.23, 0.14), materials.black, {
      position: [0, 0.23, z]
    });
  });
  return group;
};

const createBoat = (materials) => {
  const group = new THREE.Group();
  addMesh(group, new THREE.ConeGeometry(0.58, 1.7, 4), materials.rust, {
    position: [0, 0.18, 0],
    rotation: [0, 0, -Math.PI / 2],
    scale: [1, 1, 0.68]
  });
  addMesh(group, new THREE.BoxGeometry(0.66, 0.42, 0.58), materials.white, {
    position: [-0.15, 0.48, 0]
  });
  addMesh(group, new THREE.BoxGeometry(0.34, 0.17, 0.6), materials.glass, {
    position: [0.2, 0.6, 0]
  });
  addMesh(group, new THREE.CylinderGeometry(0.035, 0.035, 0.76, 8), materials.darkGrey, {
    position: [-0.2, 1.0, 0]
  });
  return group;
};

const createRadar = (materials) => {
  const group = new THREE.Group();
  addMesh(group, new THREE.CylinderGeometry(0.52, 0.66, 0.34, 10), materials.concrete, {
    position: [0, 0.17, 0]
  });
  addMesh(group, new THREE.CylinderGeometry(0.09, 0.12, 1.0, 8), materials.darkGrey, {
    position: [0, 0.83, 0]
  });
  const dish = new THREE.Group();
  dish.position.set(0, 1.28, 0);
  dish.rotation.set(-0.4, 0.35, 0);
  addMesh(dish, new THREE.CircleGeometry(0.5, 18), materials.grey, {
    rotation: [0, Math.PI, 0]
  });
  addMesh(dish, new THREE.CylinderGeometry(0.035, 0.035, 0.55, 8), materials.darkGrey, {
    position: [0, 0, 0.24],
    rotation: [Math.PI / 2, 0, 0]
  });
  group.add(dish);
  group.userData.dish = dish;
  return group;
};

const createJet = (materials) => {
  const group = new THREE.Group();
  addMesh(group, new THREE.CylinderGeometry(0.17, 0.28, 1.65, 12), materials.grey, {
    rotation: [0, 0, -Math.PI / 2]
  });
  addMesh(group, new THREE.ConeGeometry(0.18, 0.58, 12), materials.grey, {
    position: [1.1, 0, 0],
    rotation: [0, 0, -Math.PI / 2]
  });
  addMesh(group, new THREE.BoxGeometry(0.88, 0.055, 2.05), materials.grey, {
    position: [-0.08, 0, 0]
  });
  addMesh(group, new THREE.BoxGeometry(0.5, 0.08, 0.85), materials.darkGrey, {
    position: [-0.7, 0.22, 0]
  });
  addMesh(group, new THREE.BoxGeometry(0.42, 0.58, 0.07), materials.grey, {
    position: [-0.66, 0.28, 0],
    rotation: [0, 0, 0.18]
  });
  addMesh(group, new THREE.SphereGeometry(0.2, 12, 8), materials.glass, {
    position: [0.48, 0.17, 0],
    scale: [1.5, 0.62, 0.64]
  });
  group.scale.setScalar(1.12);
  return group;
};

const createTargetModel = (id, materials) => {
  switch (id) {
    case 'building': return createBuilding(materials);
    case 'person': return createPerson(materials);
    case 'truck': return createTruck(materials);
    case 'helicopter': return createHelicopter(materials);
    case 'tank': return createTank(materials);
    case 'boat': return createBoat(materials);
    case 'radar': return createRadar(materials);
    case 'jet': return createJet(materials);
    default: return new THREE.Group();
  }
};

const RapidTrackingScene = ({
  cfg,
  targetRef,
  controlsRef,
  roundRef,
  sceneApiRef,
  gamepadStateRef,
  triggerRef,
  triggerButton
}) => {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: 'high-performance'
      });
    } catch (error) {
      mount.dataset.webgl = 'unavailable';
      return undefined;
    }

    let disposed = false;
    let animationFrame = 0;
    let elapsed = 0;
    let lastFrame = performance.now();
    let routeAngle = 0.18;
    let userYaw = 0;
    let userPitch = -0.2;
    let previousTrigger = false;
    const materials = createMaterials();
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(68, 4 / 3, 0.08, 120);
    const targetGroups = new Map();
    const occluders = [];
    const raycaster = new THREE.Raycaster();

    scene.background = new THREE.Color(0xa9c2c5);
    scene.fog = new THREE.Fog(0xa9b9b4, 20, 58);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.domElement.setAttribute('aria-label', 'Rapid tracking three-dimensional landscape');
    renderer.domElement.dataset.testid = 'rtt-canvas';
    mount.appendChild(renderer.domElement);
    mount.dataset.webgl = 'ready';

    scene.add(new THREE.HemisphereLight(0xdde8e9, 0x455038, 2.15));
    const sun = new THREE.DirectionalLight(0xfff1d2, 2.35);
    sun.position.set(-10, 18, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -22;
    sun.shadow.camera.right = 22;
    sun.shadow.camera.top = 22;
    sun.shadow.camera.bottom = -22;
    scene.add(sun);

    const terrainGeometry = new THREE.PlaneGeometry(76, 76, 48, 48);
    terrainGeometry.rotateX(-Math.PI / 2);
    const terrainPositions = terrainGeometry.attributes.position;
    for (let i = 0; i < terrainPositions.count; i += 1) {
      const x = terrainPositions.getX(i);
      const z = terrainPositions.getZ(i);
      terrainPositions.setY(i, terrainHeight(x, z));
    }
    terrainGeometry.computeVertexNormals();
    const terrain = addMesh(scene, terrainGeometry, materials.grass, {
      castShadow: false,
      receiveShadow: true
    });
    occluders.push(terrain);

    const lake = addMesh(scene, new THREE.CircleGeometry(4.1, 40), materials.water, {
      position: [-3.4, -0.48, 2.7],
      rotation: [-Math.PI / 2, 0, 0],
      castShadow: false
    });
    lake.scale.set(1.28, 0.72, 1);

    const roadGroup = new THREE.Group();
    for (let i = 0; i < 22; i += 1) {
      const z = -11 + i * 1.05;
      const x = 4.7 + Math.sin(z * 0.28) * 1.15;
      const nextZ = z + 1.05;
      const nextX = 4.7 + Math.sin(nextZ * 0.28) * 1.15;
      const angle = Math.atan2(nextX - x, nextZ - z);
      addMesh(roadGroup, new THREE.BoxGeometry(0.82, 0.045, 1.16), materials.road, {
        position: [x, terrainHeight(x, z) + 0.055, z],
        rotation: [0, angle, 0],
        castShadow: false
      });
      if (i % 2 === 0) {
        addMesh(roadGroup, new THREE.BoxGeometry(0.055, 0.052, 0.46), materials.roadLine, {
          position: [x, terrainHeight(x, z) + 0.083, z],
          rotation: [0, angle, 0],
          castShadow: false
        });
      }
    }
    scene.add(roadGroup);

    const mountainGroup = new THREE.Group();
    [
      [-25, -23, 8, 13], [-13, -29, 10, 17], [2, -32, 11, 19],
      [18, -28, 9, 16], [29, -18, 8, 14], [-30, 5, 9, 15],
      [30, 8, 10, 16], [-22, 27, 9, 15], [6, 32, 10, 18], [23, 26, 8, 14]
    ].forEach(([x, z, radius, height], index) => {
      addMesh(
        mountainGroup,
        new THREE.ConeGeometry(radius, height, 7),
        index % 2 ? materials.mountain : materials.mountainFar,
        {
          position: [x, height / 2 - 1.2, z],
          rotation: [0, index * 0.37, 0],
          castShadow: false,
          receiveShadow: true
        }
      );
    });
    scene.add(mountainGroup);
    occluders.push(mountainGroup);

    const treeGroup = new THREE.Group();
    [
      [-8, -8], [-6.5, -6.8], [-8.8, -5.6], [-3.2, -8.4], [0.2, -6.8],
      [2.1, -7.6], [8, -6], [9.2, -3.5], [7.7, 1.2], [9.2, 3.8],
      [7.4, 7.6], [4.2, 8.6], [1.6, 9.1], [-1.2, 8.8], [-7.4, 8.2],
      [-9.2, 5.8], [-8.4, 2.2], [-10, -1.4], [-1.5, -4.9], [1.4, -2.7]
    ].forEach(([x, z], index) => {
      const tree = new THREE.Group();
      const scale = 0.72 + (index % 4) * 0.1;
      addMesh(tree, new THREE.CylinderGeometry(0.1, 0.14, 0.75, 7), materials.trunk, {
        position: [0, 0.38, 0]
      });
      addMesh(tree, new THREE.ConeGeometry(0.48, 1.25, 8), index % 3 ? materials.grassDark : materials.grassLight, {
        position: [0, 1.15, 0]
      });
      tree.position.set(x, terrainHeight(x, z), z);
      tree.scale.setScalar(scale);
      treeGroup.add(tree);
    });
    scene.add(treeGroup);
    occluders.push(treeGroup);

    const settlement = new THREE.Group();
    [
      [-5.8, -2.7, 0.2], [-7.0, -3.5, -0.35], [2.3, 6.7, 0.1], [3.8, 6.2, -0.2]
    ].forEach(([x, z, rotation]) => {
      const building = createUtilityShed(materials);
      building.position.set(x, terrainHeight(x, z), z);
      building.rotation.y = rotation;
      settlement.add(building);
    });
    scene.add(settlement);
    occluders.push(settlement);

    TARGETS.forEach((definition) => {
      const group = createTargetModel(definition.id, materials);
      group.name = `rtt-target-${definition.id}`;
      group.userData.targetId = definition.id;
      targetGroups.set(definition.id, group);
      scene.add(group);
      occluders.push(group);
    });

    const movementScale = clamp(cfg.targetSpeed / 100, 0.58, 1.45);

    const updateTargets = (time, delta) => {
      const building = targetGroups.get('building');
      building.position.set(2.25, terrainHeight(2.25, 3.65), 3.65);
      building.rotation.y = -0.25;

      const radar = targetGroups.get('radar');
      radar.position.set(-7.15, terrainHeight(-7.15, -0.7), -0.7);
      radar.userData.dish.rotation.y += delta * 0.42 * movementScale;

      const personAngle = time * 0.2 * movementScale;
      const personX = 4.55 + Math.sin(personAngle) * 1.35;
      const personZ = -3.2 + Math.cos(personAngle) * 2.0;
      const person = targetGroups.get('person');
      person.position.set(personX, terrainHeight(personX, personZ), personZ);
      person.rotation.y = -personAngle + Math.PI / 2;

      const truckAngle = time * 0.19 * movementScale;
      const truckZ = Math.sin(truckAngle) * 7.8;
      const truckX = 4.7 + Math.sin(truckZ * 0.28) * 1.15;
      const truck = targetGroups.get('truck');
      truck.position.set(truckX, terrainHeight(truckX, truckZ) + 0.08, truckZ);
      truck.rotation.y = Math.atan2(
        Math.cos(truckAngle) * Math.cos(truckZ * 0.28) * 0.28,
        Math.cos(truckAngle)
      );

      const tankAngle = time * 0.11 * movementScale;
      const tankX = -5.2 + Math.sin(tankAngle) * 2.2;
      const tankZ = -4.5 + Math.cos(tankAngle) * 1.5;
      const tank = targetGroups.get('tank');
      tank.position.set(tankX, terrainHeight(tankX, tankZ) + 0.03, tankZ);
      tank.rotation.y = -tankAngle;

      const boatAngle = time * 0.16 * movementScale;
      const boat = targetGroups.get('boat');
      boat.position.set(
        -3.4 + Math.cos(boatAngle) * 2.35,
        -0.3 + Math.sin(time * 0.8) * 0.025,
        2.7 + Math.sin(boatAngle) * 1.45
      );
      boat.rotation.y = -boatAngle;

      const helicopterAngle = time * 0.23 * movementScale;
      const helicopter = targetGroups.get('helicopter');
      helicopter.position.set(
        Math.sin(helicopterAngle) * 5.3,
        3.0 + Math.sin(time * 0.54) * 0.42,
        Math.cos(helicopterAngle) * 4.5
      );
      helicopter.rotation.y = helicopterAngle + Math.PI / 2;

      const jetAngle = time * 0.52 * movementScale;
      const jet = targetGroups.get('jet');
      jet.position.set(
        Math.sin(jetAngle) * 9.2,
        5.6 + Math.sin(time * 0.34) * 0.85,
        Math.cos(jetAngle) * 8.2
      );
      jet.rotation.y = jetAngle;
      jet.rotation.z = -0.12;

      targetGroups.forEach((group) => {
        (group.userData.rotors || []).forEach(({ object, axis, rate }) => {
          object.rotation[axis] += delta * rate * movementScale;
        });
      });
    };

    const belongsTo = (object, group) => {
      let current = object;
      while (current) {
        if (current === group) return true;
        current = current.parent;
      }
      return false;
    };

    const evaluateTarget = () => {
      const targetId = targetRef.current;
      const definition = TARGET_BY_ID[targetId];
      const group = targetGroups.get(targetId);
      if (!definition || !group) {
        return {
          inView: false,
          visible: false,
          occluded: false,
          aligned: false,
          centered: false,
          distance: Infinity,
          ndcX: 0,
          ndcY: 0
        };
      }

      camera.updateMatrixWorld();
      group.updateWorldMatrix(true, true);
      const targetPoint = new THREE.Vector3(0, definition.aimHeight, 0);
      group.localToWorld(targetPoint);
      const projected = targetPoint.clone().project(camera);
      const inView = (
        projected.z >= -1 && projected.z <= 1
        && Math.abs(projected.x) <= 1
        && Math.abs(projected.y) <= 1
      );
      const width = Math.max(1, mount.clientWidth);
      const height = Math.max(1, mount.clientHeight);
      const distance = Math.hypot(projected.x * width * 0.5, projected.y * height * 0.5);
      let occluded = false;

      if (inView) {
        const direction = targetPoint.clone().sub(camera.position);
        const targetDistance = direction.length();
        direction.normalize();
        raycaster.set(camera.position, direction);
        const obstruction = raycaster
          .intersectObjects(occluders, true)
          .find((hit) => !belongsTo(hit.object, group) && hit.distance < targetDistance - 0.28);
        occluded = Boolean(obstruction);
      }

      const aligned = inView && distance <= cfg.targetRadius;
      const visible = inView && !occluded;
      return {
        inView,
        visible,
        occluded,
        aligned,
        centered: aligned && visible,
        distance,
        ndcX: projected.x,
        ndcY: projected.y
      };
    };

    const cueTarget = (targetId, exact = false) => {
      const definition = TARGET_BY_ID[targetId];
      const group = targetGroups.get(targetId);
      if (!definition || !group) return;
      group.updateWorldMatrix(true, true);
      camera.updateMatrixWorld();
      const point = new THREE.Vector3(0, definition.aimHeight, 0);
      group.localToWorld(point);
      const direction = point.sub(camera.position);
      const horizontalDistance = Math.hypot(direction.x, direction.z);
      const desiredYaw = Math.atan2(-direction.x, -direction.z);
      userYaw = normaliseAngle(desiredYaw - routeAngle);
      userPitch = Math.atan2(direction.y, horizontalDistance);
      if (!exact) {
        userYaw += (Math.random() - 0.5) * 0.16;
        userPitch += (Math.random() - 0.5) * 0.08;
      }
      userPitch = clamp(userPitch, -0.7, 0.48);
    };

    sceneApiRef.current = {
      evaluateTarget,
      cueTarget,
      renderer
    };
    mount.__rttEvaluateTarget = evaluateTarget;
    mount.__rttAimAtTarget = () => cueTarget(targetRef.current, true);

    const resize = () => {
      if (disposed) return;
      const width = Math.max(1, mount.clientWidth);
      const height = Math.max(1, mount.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.fov = width < height ? 84 : 68;
      camera.updateProjectionMatrix();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    resize();

    updateTargets(0, 0);
    camera.position.set(Math.sin(routeAngle) * 11.2, 4.35, Math.cos(routeAngle) * 11.2);
    camera.rotation.order = 'YXZ';
    camera.rotation.set(userPitch, routeAngle + userYaw, 0);
    camera.updateMatrixWorld();
    cueTarget(targetRef.current);

    const animate = (now) => {
      if (disposed) return;
      const delta = Math.min(0.05, Math.max(0, (now - lastFrame) / 1000));
      lastFrame = now;
      elapsed += delta;

      const controls = controlsRef.current;
      const gamepad = gamepadStateRef.current || {};
      const gamepadAxes = gamepad.axes || [0, 0];
      const keys = controls.keys || {};
      let inputX = 0;
      let inputY = 0;

      if (Math.abs(gamepadAxes[0] || 0) > 0.025 || Math.abs(gamepadAxes[1] || 0) > 0.025) {
        inputX += gamepadAxes[0] || 0;
        inputY += gamepadAxes[1] || 0;
      } else if (controls.pointerActive) {
        inputX += controls.pointerX * 0.78;
        inputY += controls.pointerY * 0.78;
      }

      if (keys.ArrowLeft || keys.KeyA) inputX -= 1;
      if (keys.ArrowRight || keys.KeyD) inputX += 1;
      if (keys.ArrowUp || keys.KeyW) inputY -= 1;
      if (keys.ArrowDown || keys.KeyS) inputY += 1;

      inputX = clamp(inputX, -1, 1);
      inputY = clamp(inputY, -1, 1);
      const turnRate = 0.88 + movementScale * 0.24;
      userYaw -= inputX * delta * turnRate;
      userPitch = clamp(userPitch - inputY * delta * turnRate * 0.72, -0.7, 0.48);

      routeAngle += delta * (0.028 + movementScale * 0.013);
      camera.position.set(
        Math.sin(routeAngle) * 11.2,
        4.25 + Math.sin(elapsed * 0.22) * 0.32,
        Math.cos(routeAngle) * 11.2
      );
      camera.rotation.set(userPitch, routeAngle + userYaw, -inputX * 0.025);
      camera.updateMatrixWorld();
      updateTargets(elapsed, delta);

      const observation = evaluateTarget();
      const round = roundRef.current;
      if (round && !round.finalized) {
        const sampleMs = delta * 1000;
        round.totalMs += sampleMs;
        if (observation.visible) round.visibleMs += sampleMs;
        if (observation.aligned) round.alignedMs += sampleMs;
        if (observation.centered) round.centeredMs += sampleMs;
      }

      const triggerPressed = Boolean(gamepad.buttons?.[triggerButton]);
      if (triggerPressed && !previousTrigger) triggerRef.current?.();
      previousTrigger = triggerPressed;

      renderer.render(scene, camera);
      if (!disposed) animationFrame = requestAnimationFrame(animate);
    };
    animationFrame = requestAnimationFrame(animate);

    return () => {
      disposed = true;
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      sceneApiRef.current = null;
      delete mount.__rttEvaluateTarget;
      delete mount.__rttAimAtTarget;
      const geometries = new Set();
      const disposableMaterials = new Set();
      scene.traverse((object) => {
        if (object.geometry) geometries.add(object.geometry);
        if (Array.isArray(object.material)) {
          object.material.forEach((material) => disposableMaterials.add(material));
        } else if (object.material) {
          disposableMaterials.add(object.material);
        }
      });
      geometries.forEach((geometry) => geometry.dispose());
      disposableMaterials.forEach((material) => material.dispose());
      renderer.renderLists.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, [
    cfg,
    controlsRef,
    gamepadStateRef,
    roundRef,
    sceneApiRef,
    targetRef,
    triggerButton,
    triggerRef
  ]);

  return <div ref={mountRef} className="rtt-webgl" data-testid="rtt-three-scene" />;
};

const emptyStats = () => ({
  validPhotos: 0,
  missedPhotos: 0,
  targetsCompleted: 0,
  targetsTimedOut: 0,
  alignedMs: 0,
  centeredMs: 0,
  visibleMs: 0,
  totalMs: 0
});

const RapidTracking = () => {
  const navigate = useNavigate();
  const [stage, setStage] = useState('menu');
  const [mode, setMode] = useState(null);
  const [difficulty, setDifficulty] = useState(null);
  const [cfg, setCfg] = useState(null);
  const [remaining, setRemaining] = useState(0);
  const [targetRemaining, setTargetRemaining] = useState(0);
  const [targetId, setTargetId] = useState(null);
  const [photos, setPhotos] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [flash, setFlash] = useState(false);
  const [trackingDisplay, setTrackingDisplay] = useState(0);
  const [responses, setResponses] = useState([]);
  const [result, setResult] = useState(null);
  const { connected, stateRef: gamepadStateRef } = useGamepad();

  const stageRef = useRef(stage);
  const modeRef = useRef(mode);
  const difficultyRef = useRef(difficulty);
  const cfgRef = useRef(cfg);
  const targetRef = useRef(null);
  const roundRef = useRef(null);
  const statsRef = useRef(emptyStats());
  const responsesRef = useRef([]);
  const sequenceRef = useRef([]);
  const sceneApiRef = useRef(null);
  const triggerRef = useRef(null);
  const runtimeRef = useRef({
    startedAt: 0,
    endAt: 0,
    targetDeadline: 0,
    targetWindow: 15,
    switchLocked: false,
    ended: false,
    targetSerial: 0,
    lastShotAt: -Infinity
  });
  const controlsRef = useRef({
    pointerX: 0,
    pointerY: 0,
    pointerActive: false,
    keys: {}
  });
  const pendingTimeoutsRef = useRef(new Set());
  const beginTargetRef = useRef(null);
  const endTestRef = useRef(null);
  const frameRef = useRef(null);

  stageRef.current = stage;
  modeRef.current = mode;
  difficultyRef.current = difficulty;
  cfgRef.current = cfg;

  const queueTimeout = useCallback((callback, delay) => {
    const timeout = window.setTimeout(() => {
      pendingTimeoutsRef.current.delete(timeout);
      callback();
    }, delay);
    pendingTimeoutsRef.current.add(timeout);
    return timeout;
  }, []);

  const clearPendingTimeouts = useCallback(() => {
    pendingTimeoutsRef.current.forEach((timeout) => window.clearTimeout(timeout));
    pendingTimeoutsRef.current.clear();
  }, []);

  const commitCurrentTarget = useCallback((completed, reason) => {
    const round = roundRef.current;
    if (!round || round.finalized) return null;
    round.finalized = true;

    const misses = Math.max(0, round.attempts - round.validPhotos);
    const stats = statsRef.current;
    stats.validPhotos += round.validPhotos;
    stats.missedPhotos += misses;
    stats.targetsCompleted += completed ? 1 : 0;
    stats.targetsTimedOut += completed ? 0 : 1;
    stats.alignedMs += round.alignedMs;
    stats.centeredMs += round.centeredMs;
    stats.visibleMs += round.visibleMs;
    stats.totalMs += round.totalMs;

    const trackingPercent = round.totalMs > 0 ? (round.alignedMs / round.totalMs) * 100 : 0;
    const response = {
      prompt: `Track the ${TARGET_BY_ID[round.targetId].label.toLowerCase()} and take three photographs`,
      given: `${round.validPhotos} of ${PHOTOS_REQUIRED} valid photographs`,
      answer: `${PHOTOS_REQUIRED} of ${PHOTOS_REQUIRED} valid photographs`,
      correct: completed,
      detail: `${trackingPercent.toFixed(0)}% centred tracking; ${round.attempts} trigger press${round.attempts === 1 ? '' : 'es'}`,
      explanation: completed
        ? 'Target completed before it changed.'
        : `${reason || 'Target changed'} with ${PHOTOS_REQUIRED - round.validPhotos} photograph${PHOTOS_REQUIRED - round.validPhotos === 1 ? '' : 's'} still required.`
    };
    responsesRef.current = [...responsesRef.current, response];
    setResponses(responsesRef.current);
    return response;
  }, []);

  const beginNextTarget = useCallback(() => {
    const runtime = runtimeRef.current;
    if (runtime.ended || performance.now() >= runtime.endAt) {
      endTestRef.current?.();
      return;
    }

    const activeTargets = TARGETS.slice(0, cfgRef.current.objectTypes);
    if (!sequenceRef.current.length) sequenceRef.current = shuffle(activeTargets.map(({ id }) => id));
    let nextTarget = sequenceRef.current.shift();
    if (nextTarget === targetRef.current && sequenceRef.current.length) {
      sequenceRef.current.push(nextTarget);
      nextTarget = sequenceRef.current.shift();
    }

    const now = performance.now();
    runtime.switchLocked = false;
    runtime.targetSerial += 1;
    runtime.targetDeadline = now + runtime.targetWindow * 1000;
    targetRef.current = nextTarget;
    roundRef.current = {
      targetId: nextTarget,
      serial: runtime.targetSerial,
      attempts: 0,
      validPhotos: 0,
      alignedMs: 0,
      centeredMs: 0,
      visibleMs: 0,
      totalMs: 0,
      finalized: false
    };
    setTargetId(nextTarget);
    setPhotos(0);
    setTargetRemaining(runtime.targetWindow);
    setTrackingDisplay(0);
    setFeedback('');
    sceneApiRef.current?.cueTarget(nextTarget);
  }, []);
  beginTargetRef.current = beginNextTarget;

  const endTest = useCallback(() => {
    const runtime = runtimeRef.current;
    if (runtime.ended) return;
    runtime.ended = true;
    runtime.switchLocked = true;
    clearPendingTimeouts();
    commitCurrentTarget(false, 'The test ended');

    const stats = { ...statsRef.current };
    const attempts = stats.validPhotos + stats.missedPhotos;
    const targetCount = stats.targetsCompleted + stats.targetsTimedOut;
    const photoAccuracy = attempts > 0 ? (stats.validPhotos / attempts) * 100 : 0;
    const trackingAccuracy = stats.totalMs > 0 ? (stats.alignedMs / stats.totalMs) * 100 : 0;
    const completionRate = targetCount > 0 ? (stats.targetsCompleted / targetCount) * 100 : 0;
    const overallScore = photoAccuracy * 0.45 + trackingAccuracy * 0.35 + completionRate * 0.2;
    const finalResult = {
      ...stats,
      attempts,
      targetCount,
      photoAccuracy,
      trackingAccuracy,
      completionRate,
      overallScore
    };
    setResult(finalResult);

    if (modeRef.current === 'assessment') {
      saveResult('Rapid Tracking', modeRef.current, difficultyRef.current, finalResult);
    }
    stageRef.current = 'results';
    setStage('results');
  }, [clearPendingTimeouts, commitCurrentTarget]);
  endTestRef.current = endTest;

  const triggerCamera = useCallback(() => {
    const runtime = runtimeRef.current;
    if (stageRef.current !== 'test' || runtime.ended || runtime.switchLocked) return;
    const now = performance.now();
    if (now - runtime.lastShotAt < 320) return;
    runtime.lastShotAt = now;

    const observation = sceneApiRef.current?.evaluateTarget();
    const round = roundRef.current;
    if (!observation || !round || round.finalized) return;
    round.attempts += 1;
    setFlash(true);
    queueTimeout(() => setFlash(false), 75);

    if (observation.centered) {
      round.validPhotos += 1;
      setPhotos(round.validPhotos);
      if (round.validPhotos >= PHOTOS_REQUIRED) {
        runtime.switchLocked = true;
        runtime.targetDeadline = Infinity;
        setFeedback('TARGET COMPLETE');
        commitCurrentTarget(true, 'Target completed');
        queueTimeout(() => beginTargetRef.current?.(), 650);
      } else {
        setFeedback(`PHOTO ${round.validPhotos} / ${PHOTOS_REQUIRED}`);
        const serial = round.serial;
        queueTimeout(() => {
          if (roundRef.current?.serial === serial && !runtimeRef.current.switchLocked) setFeedback('');
        }, 800);
      }
      return;
    }

    if (observation.occluded && observation.aligned) {
      setFeedback('TARGET OBSCURED');
    } else if (!observation.inView) {
      setFeedback('NO TARGET');
    } else {
      setFeedback('MISS');
    }
    const serial = round.serial;
    queueTimeout(() => {
      if (roundRef.current?.serial === serial && !runtimeRef.current.switchLocked) setFeedback('');
    }, 650);
  }, [commitCurrentTarget, queueTimeout]);
  triggerRef.current = triggerCamera;

  const start = () => {
    clearPendingTimeouts();
    const selectedCfg = getSettings().rapidTracking[difficulty];
    const targetWindow = selectedCfg.targetWindow || (
      difficulty === 'easy' ? 18 : difficulty === 'medium' ? 15 : 12
    );
    const now = performance.now();
    const nextCfg = { ...selectedCfg, targetWindow };
    cfgRef.current = nextCfg;
    setCfg(nextCfg);
    statsRef.current = emptyStats();
    responsesRef.current = [];
    sequenceRef.current = [];
    targetRef.current = null;
    roundRef.current = null;
    runtimeRef.current = {
      startedAt: now,
      endAt: now + nextCfg.testDuration * 1000,
      targetDeadline: 0,
      targetWindow,
      switchLocked: false,
      ended: false,
      targetSerial: 0,
      lastShotAt: -Infinity
    };
    controlsRef.current = {
      pointerX: 0,
      pointerY: 0,
      pointerActive: false,
      keys: {}
    };
    setResponses([]);
    setResult(null);
    setRemaining(nextCfg.testDuration);
    setFeedback('');
    setFlash(false);
    stageRef.current = 'test';
    setStage('test');
    beginNextTarget();
  };

  useEffect(() => {
    if (stage !== 'test') return undefined;
    const interval = window.setInterval(() => {
      const runtime = runtimeRef.current;
      if (runtime.ended) return;
      const now = performance.now();
      const testRemaining = Math.max(0, (runtime.endAt - now) / 1000);
      setRemaining(testRemaining);
      if (testRemaining <= 0) {
        endTestRef.current?.();
        return;
      }

      const currentRound = roundRef.current;
      if (currentRound && !currentRound.finalized) {
        const percent = currentRound.totalMs > 0
          ? (currentRound.alignedMs / currentRound.totalMs) * 100
          : 0;
        setTrackingDisplay(percent);
      }
      setTargetRemaining(Math.max(0, (runtime.targetDeadline - now) / 1000));

      if (!runtime.switchLocked && now >= runtime.targetDeadline) {
        runtime.switchLocked = true;
        runtime.targetDeadline = Infinity;
        setFeedback('TARGET CHANGED');
        commitCurrentTarget(false, 'Target time expired');
        queueTimeout(() => beginTargetRef.current?.(), 650);
      }
    }, 100);
    return () => window.clearInterval(interval);
  }, [commitCurrentTarget, queueTimeout, stage]);

  useEffect(() => {
    if (stage !== 'test') return undefined;
    const down = (event) => {
      const code = event.code;
      if (
        code === 'ArrowLeft' || code === 'ArrowRight' || code === 'ArrowUp' || code === 'ArrowDown'
        || code === 'KeyA' || code === 'KeyD' || code === 'KeyW' || code === 'KeyS'
        || code === 'Space' || code === 'Backspace'
      ) {
        event.preventDefault();
      }
      if (code === 'Backspace') return;
      if (code === 'Space') {
        if (!event.repeat) triggerRef.current?.();
        return;
      }
      controlsRef.current.keys[code] = true;
    };
    const up = (event) => {
      controlsRef.current.keys[event.code] = false;
    };
    window.addEventListener('keydown', down, { passive: false });
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [stage]);

  useEffect(() => () => {
    clearPendingTimeouts();
    runtimeRef.current.ended = true;
  }, [clearPendingTimeouts]);

  const handlePointerMove = (event) => {
    const frame = frameRef.current;
    if (!frame) return;
    const bounds = frame.getBoundingClientRect();
    controlsRef.current.pointerX = clamp(((event.clientX - bounds.left) / bounds.width) * 2 - 1, -1, 1);
    controlsRef.current.pointerY = clamp(((event.clientY - bounds.top) / bounds.height) * 2 - 1, -1, 1);
    controlsRef.current.pointerActive = true;
  };

  const handlePointerLeave = () => {
    controlsRef.current.pointerX = 0;
    controlsRef.current.pointerY = 0;
    controlsRef.current.pointerActive = false;
  };

  if (stage === 'menu') {
    return (
      <ModuleMenu
        title="Rapid Tracking Test - Setup"
        description="Track each named object from the moving aircraft view and take three centred photographs before the target changes. Targets may pass behind terrain or structures."
        mode={mode}
        setMode={setMode}
        difficulty={difficulty}
        setDifficulty={setDifficulty}
        onCancel={() => navigate('/')}
        onStart={start}
      />
    );
  }

  if (stage === 'results' && result) {
    return (
      <ModuleResults
        title="Rapid Tracking - Results"
        rows={[
          ['Valid Photographs', `${result.validPhotos}`],
          ['Missed Photographs', `${result.missedPhotos}`],
          ['Targets Completed', `${result.targetsCompleted} / ${result.targetCount}`],
          ['Photograph Accuracy', `${result.photoAccuracy.toFixed(1)}%`],
          ['Centred Tracking', `${result.trackingAccuracy.toFixed(1)}%`],
          ['Target Completion', `${result.completionRate.toFixed(1)}%`]
        ]}
        overallScore={result.overallScore}
        summary={responses}
        onRetry={() => setStage('menu')}
        onDashboard={() => navigate('/')}
      />
    );
  }

  const target = TARGET_BY_ID[targetId];
  const triggerButton = getGamepad().buttonAction;

  return (
    <main className="rtt-page">
      <section
        ref={frameRef}
        className="rtt-frame"
        data-testid="rtt-test-frame"
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        onPointerDown={(event) => {
          if (event.button === 0) triggerRef.current?.();
        }}
      >
        <header className="rtt-header">
          <div className="rtt-title">RAPID TRACKING TEST</div>
          <div className="rtt-header-readout">
            <span className="rtt-mode">{mode === 'practice' ? 'PRACTICE' : 'ASSESSMENT'}</span>
            <span data-testid="time-remaining">TIME {formatTime(Math.ceil(remaining))}</span>
          </div>
        </header>

        <div className="rtt-scene">
          <RapidTrackingScene
            cfg={cfg}
            targetRef={targetRef}
            controlsRef={controlsRef}
            roundRef={roundRef}
            sceneApiRef={sceneApiRef}
            gamepadStateRef={gamepadStateRef}
            triggerRef={triggerRef}
            triggerButton={triggerButton}
          />
          <div className="rtt-scene-vignette" aria-hidden="true" />
          <div className="rtt-crosshair" aria-hidden="true">
            <span className="rtt-crosshair-ring" />
            <span className="rtt-crosshair-horizontal" />
            <span className="rtt-crosshair-vertical" />
            <span className="rtt-crosshair-dot" />
          </div>
          <div className={`rtt-camera-flash ${flash ? 'is-active' : ''}`} aria-hidden="true" />
          <div className={`rtt-feedback ${feedback ? 'is-visible' : ''}`} data-testid="rtt-feedback">
            {feedback}
          </div>
        </div>

        <footer className="rtt-console">
          <div className="rtt-target-readout">
            <span className="rtt-console-label">TARGET</span>
            <strong data-testid="rtt-target-type">{target?.label || 'STANDBY'}</strong>
          </div>
          <div className="rtt-photo-status" aria-label={`${photos} of ${PHOTOS_REQUIRED} photographs`}>
            <Camera size={16} strokeWidth={1.8} aria-hidden="true" />
            {[0, 1, 2].map((index) => (
              <span
                key={index}
                className={`rtt-photo-lamp ${index < photos ? 'is-lit' : ''}`}
                data-testid={`rtt-photo-${index + 1}`}
              />
            ))}
          </div>
          <div className="rtt-tracking-readout">
            <span className="rtt-console-label">TRACK</span>
            <strong>{trackingDisplay.toFixed(0)}%</strong>
          </div>
          <div className="rtt-countdown-readout">
            <span className="rtt-console-label">CHANGE</span>
            <strong>{Math.ceil(targetRemaining)}s</strong>
          </div>
          <div className="rtt-input-readout" data-testid="rtt-input-mode">
            {connected ? <Gamepad2 size={16} aria-hidden="true" /> : <MousePointer2 size={15} aria-hidden="true" />}
            <span>{connected ? 'JOYSTICK' : 'POINTER'}</span>
          </div>
        </footer>
      </section>
    </main>
  );
};

export default RapidTracking;
