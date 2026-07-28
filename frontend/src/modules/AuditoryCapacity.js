import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useNavigate } from 'react-router-dom';
import { getSettings, saveResult } from '../utils/storage';
import {
  ModuleMenu,
  ModuleResults,
  CFASTShell,
  CFASTOptions,
  CFASTAnswerInput,
  formatTime,
  pick,
  randInt,
  shuffle
} from './cbtCommon';
import { useGamepad } from '../hooks/useGamepad';

const SHAPES = ['circle', 'square', 'triangle'];
const COLOURS = [
  { name: 'red', hex: '#C00000' },
  { name: 'green', hex: '#00A000' },
  { name: 'yellow', hex: '#D6D000' }
];
const CALLSIGNS = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo'];
const RULE_TTL = 18;
const TUNNEL_RADIUS = 3.4;
const TUNNEL_DEPTH = 96;

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const shapeLabel = (shape) => `${shape.colour.name} ${shape.kind}`;
const matchesRule = (shape, rule) => (
  rule && shape.colour.name === rule.colour && shape.kind === rule.kind
);

const makeDigits = (len) => Array.from({ length: len }, () => randInt(0, 9));

const buildQuestion = (digits) => {
  const type = pick(['first', 'last', 'position', 'count']);
  if (type === 'first') {
    const ans = String(digits[0]);
    return { text: 'What was the FIRST digit called?', answer: ans, options: shuffle([ans, ...shuffle('0123456789'.split('').filter(d => d !== ans)).slice(0, 4)]) };
  }
  if (type === 'last') {
    const ans = String(digits[digits.length - 1]);
    return { text: 'What was the LAST digit called?', answer: ans, options: shuffle([ans, ...shuffle('0123456789'.split('').filter(d => d !== ans)).slice(0, 4)]) };
  }
  if (type === 'position') {
    const pos = randInt(1, digits.length);
    const ans = String(digits[pos - 1]);
    return { text: `What was the digit at position ${pos}?`, answer: ans, options: shuffle([ans, ...shuffle('0123456789'.split('').filter(d => d !== ans)).slice(0, 4)]) };
  }
  const target = pick(digits);
  const count = digits.filter(d => d === target).length;
  const distractors = shuffle([0, 1, 2, 3, 4, 5].filter(v => v !== count)).slice(0, 4);
  return { text: `How many times was the digit ${target} called?`, answer: String(count), options: shuffle([String(count), ...distractors.map(String)]) };
};

const makeShape = (id, z, progress) => ({
  id,
  z,
  x: (Math.random() - 0.5) * (0.35 + progress * 0.55),
  y: (Math.random() - 0.5) * (0.35 + progress * 0.55),
  kind: pick(SHAPES),
  colour: pick(COLOURS),
  scored: false
});

const speaks = () => Boolean(window.speechSynthesis);

const AuditoryCapacity = () => {
  const navigate = useNavigate();
  const [stage, setStage] = useState('menu');
  const [phase, setPhase] = useState('play');
  const [mode, setMode] = useState(null);
  const [difficulty, setDifficulty] = useState(null);
  const [cfg, setCfg] = useState(null);
  const [remaining, setRemaining] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [score, setScore] = useState({
    shapesHit: 0,
    shapesMissed: 0,
    shapeErrors: 0,
    beepHits: 0,
    beepMisses: 0,
    numberHits: 0,
    numberMisses: 0
  });
  const [ballNumber, setBallNumber] = useState('');
  const [requiredNumber, setRequiredNumber] = useState('');
  const [activeRule, setActiveRule] = useState(null);
  const [callout, setCallout] = useState('');
  const [q, setQ] = useState(null);
  const [correctAns, setCorrectAns] = useState(0);
  const [totalQ, setTotalQ] = useState(0);
  const [responses, setResponses] = useState([]);
  const [inputMode, setInputMode] = useState('JOYSTICK READY');
  const [connected, setConnected] = useState(false);
  const [paused, setPaused] = useState(false);

  const threeMountRef = useRef(null);
  const threeRef = useRef(null);
  const containerRef = useRef(null);
  const cfgRef = useRef(null);
  const timerRef = useRef(null);
  const rafRef = useRef(null);
  const eventRef = useRef(null);
  const noiseRef = useRef(null);
  const elapsedRef = useRef(0);
  const remainingRef = useRef(0);
  const ballRef = useRef({ x: 0, y: 0 });
  const cameraRef = useRef({ x: 0, y: 0 });
  const worldRef = useRef({ z: 0, spin: 0, nextZ: 10, id: 1, beepDue: null, beepHit: false, nextBeepAt: 24 });
  const pausedRef = useRef(false);
  const shapesRef = useRef([]);
  const keysRef = useRef({ up: false, down: false, left: false, right: false });
  const scoreRef = useRef(score);
  const digitsRef = useRef([]);
  const digitIndexRef = useRef(0);
  const activeRuleRef = useRef(null);
  const requiredNumberRef = useRef('');
  const ballNumberRef = useRef('');
  const assignedCallsignsRef = useRef(['Alpha']);
  const gamepadButtonDownRef = useRef(false);
  const { connected: gamepadConnected, stateRef } = useGamepad();

  useEffect(() => setConnected(gamepadConnected), [gamepadConnected]);

  const syncScore = () => setScore({ ...scoreRef.current });

  const disposeThree = () => {
    const three = threeRef.current;
    if (!three) return;
    three.resizeObserver?.disconnect();
    three.renderer.dispose();
    three.ringGeometry?.dispose();
    three.ballGeometry?.dispose();
    Object.values(three.materials || {}).forEach((mat) => mat.dispose?.());
    three.mount?.removeChild(three.renderer.domElement);
    threeRef.current = null;
  };

  const makeShapeObject = (shape) => {
    const group = new THREE.Group();
    const material = new THREE.MeshBasicMaterial({
      color: shape.colour.hex,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95
    });
    if (shape.kind === 'circle') {
      const mesh = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.055, 12, 72), material);
      group.add(mesh);
    } else if (shape.kind === 'square') {
      const outer = new THREE.Shape()
        .moveTo(-0.78, -0.78).lineTo(0.78, -0.78).lineTo(0.78, 0.78).lineTo(-0.78, 0.78).lineTo(-0.78, -0.78);
      const hole = new THREE.Path()
        .moveTo(-0.58, -0.58).lineTo(-0.58, 0.58).lineTo(0.58, 0.58).lineTo(0.58, -0.58).lineTo(-0.58, -0.58);
      outer.holes.push(hole);
      group.add(new THREE.Mesh(new THREE.ShapeGeometry(outer), material));
    } else {
      const outer = new THREE.Shape()
        .moveTo(0, 0.9).lineTo(0.9, -0.72).lineTo(-0.9, -0.72).lineTo(0, 0.9);
      const hole = new THREE.Path()
        .moveTo(0, 0.52).lineTo(-0.5, -0.42).lineTo(0.5, -0.42).lineTo(0, 0.52);
      outer.holes.push(hole);
      group.add(new THREE.Mesh(new THREE.ShapeGeometry(outer), material));
    }
    group.userData = { id: shape.id, material };
    return group;
  };

  const initThree = () => {
    if (threeRef.current || !threeMountRef.current) return threeRef.current;
    const mount = threeMountRef.current;
    const width = mount.clientWidth || 960;
    const height = mount.clientHeight || 546;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.setClearColor(0x01040b, 1);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x01040b, 24, TUNNEL_DEPTH);
    const camera = new THREE.PerspectiveCamera(72, width / height, 0.1, 140);
    scene.add(new THREE.AmbientLight(0x59708d, 1.6));
    const light = new THREE.PointLight(0xffffff, 2.1, 26);
    scene.add(light);

    const ringGeometry = new THREE.TorusGeometry(TUNNEL_RADIUS, 0.025, 8, 112);
    const ringMaterial = new THREE.MeshBasicMaterial({ color: 0x6f8fb9, transparent: true, opacity: 0.55 });
    const rings = Array.from({ length: 36 }, (_, i) => {
      const ring = new THREE.Mesh(ringGeometry, ringMaterial);
      ring.position.z = i * 2.6;
      scene.add(ring);
      return ring;
    });

    const ribMaterial = new THREE.LineBasicMaterial({ color: 0x486584, transparent: true, opacity: 0.55 });
    const ribs = Array.from({ length: 16 }, (_, i) => {
      const angle = (i / 16) * Math.PI * 2;
      const points = [
        new THREE.Vector3(Math.cos(angle) * TUNNEL_RADIUS, Math.sin(angle) * TUNNEL_RADIUS, 0),
        new THREE.Vector3(Math.cos(angle) * TUNNEL_RADIUS, Math.sin(angle) * TUNNEL_RADIUS, TUNNEL_DEPTH)
      ];
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), ribMaterial);
      scene.add(line);
      return { line, angle };
    });

    const ballGeometry = new THREE.SphereGeometry(0.34, 32, 18);
    const ballMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.28, metalness: 0.1 });
    const ball = new THREE.Mesh(ballGeometry, ballMaterial);
    scene.add(ball);

    const shapeGroup = new THREE.Group();
    scene.add(shapeGroup);
    const shapeMeshes = new Map();
    const resizeObserver = new ResizeObserver(() => {
      const nextW = mount.clientWidth || width;
      const nextH = mount.clientHeight || height;
      renderer.setSize(nextW, nextH);
      camera.aspect = nextW / nextH;
      camera.updateProjectionMatrix();
    });
    resizeObserver.observe(mount);

    threeRef.current = {
      mount, renderer, scene, camera, light, rings, ribs, shapeGroup, shapeMeshes,
      ringGeometry, ballGeometry, materials: { ringMaterial, ribMaterial, ballMaterial },
      ball, resizeObserver
    };
    return threeRef.current;
  };

  const say = (text, opts = {}) => {
    setCallout(text);
    if (speaks()) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = opts.rate || cfgRef.current?.playbackSpeed || 1;
      utterance.volume = opts.volume || 1;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    }
    window.setTimeout(() => setCallout(''), opts.visibleMs || 1800);
  };

  const scheduleInstruction = (progress) => {
    if (!cfgRef.current) return;
    const callSignLayer = progress > 0.72;
    const assigned = assignedCallsignsRef.current;
    const incomingCallsign = callSignLayer ? pick(CALLSIGNS) : null;
    const shouldFollow = !callSignLayer || assigned.includes(incomingCallsign);
    const prefix = incomingCallsign ? `${incomingCallsign}, ` : '';
    const layerChoices = progress < 0.25
      ? ['digits']
      : progress < 0.45
        ? ['avoid', 'digits']
        : progress < 0.65
          ? ['avoid', 'number', 'digits']
          : ['avoid', 'number', 'digits', 'callsign'];
    const type = pick(layerChoices);

    if (type === 'avoid') {
      const rule = { colour: pick(COLOURS).name, kind: pick(SHAPES), expiresAt: elapsedRef.current + RULE_TTL };
      if (shouldFollow) {
        activeRuleRef.current = rule;
        setActiveRule(rule);
      }
      say(`${prefix}${shouldFollow ? 'Do not fly through next' : 'Ignore'} ${rule.colour} ${rule.kind}.`);
    } else if (type === 'number') {
      const next = String(randInt(1, 9));
      if (shouldFollow) {
        requiredNumberRef.current = next;
        setRequiredNumber(next);
      }
      say(`${prefix}${shouldFollow ? 'Change ball number to' : 'Ignore number'} ${next}.`);
    } else if (type === 'callsign') {
      assignedCallsignsRef.current = shuffle(CALLSIGNS).slice(0, progress > 0.85 ? 2 : 1);
      say(`Your call sign${assignedCallsignsRef.current.length > 1 ? 's are' : ' is'} ${assignedCallsignsRef.current.join(' and ')}.`);
    } else {
      const digit = digitsRef.current[digitIndexRef.current];
      if (digit !== undefined) {
        digitIndexRef.current += 1;
        say(String(digit), { visibleMs: 1000 });
      }
    }
  };

  const start = () => {
    const nextCfg = getSettings().auditoryCapacity[difficulty];
    cfgRef.current = nextCfg;
    setCfg(nextCfg);
    setStage('test');
    setPhase('play');
    setPaused(false);
    pausedRef.current = false;
    setRemaining(nextCfg.testDuration);
    setElapsed(0);
    elapsedRef.current = 0;
    remainingRef.current = nextCfg.testDuration;
    setBallNumber('');
    setRequiredNumber('');
    setActiveRule(null);
    setQ(null);
    setCorrectAns(0);
    setTotalQ(0);
    setResponses([]);
    assignedCallsignsRef.current = ['Alpha'];
    activeRuleRef.current = null;
    requiredNumberRef.current = '';
    ballNumberRef.current = '';
    digitsRef.current = makeDigits(nextCfg.sequenceLength);
    digitIndexRef.current = 0;
    scoreRef.current = {
      shapesHit: 0,
      shapesMissed: 0,
      shapeErrors: 0,
      beepHits: 0,
      beepMisses: 0,
      numberHits: 0,
      numberMisses: 0
    };
    syncScore();
    ballRef.current = { x: 0, y: 0 };
    cameraRef.current = { x: 0, y: 0 };
    worldRef.current = { z: 0, spin: 0, nextZ: 10, id: 1, beepDue: null, beepHit: false, nextBeepAt: 24 };
    shapesRef.current = [];

    timerRef.current = setInterval(() => {
      if (pausedRef.current) return;
      remainingRef.current = Math.max(0, remainingRef.current - 1);
      elapsedRef.current += 1;
      setRemaining(remainingRef.current);
      setElapsed(elapsedRef.current);
      if (remainingRef.current <= 0) endPlay();
    }, 1000);

    eventRef.current = setInterval(() => {
      if (pausedRef.current) return;
      const progress = 1 - (remainingRef.current / nextCfg.testDuration);
      scheduleInstruction(progress);
    }, 9500);

    startNoise(nextCfg);
    startLoop(nextCfg);
  };

  const startNoise = (nextCfg) => {
    if (difficulty === 'easy') return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const gain = ctx.createGain();
    gain.gain.value = difficulty === 'hard' ? 0.025 : 0.012;
    const bufferSize = 2 * ctx.sampleRate;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start();
    noiseRef.current = { ctx, source };
  };

  const startLoop = (nextCfg) => {
    let last = performance.now();
    const loop = (t) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      const progress = clamp((nextCfg.testDuration - remainingRef.current) / nextCfg.testDuration, 0, 1);
      if (!pausedRef.current) updateWorld(dt, progress, nextCfg);
      renderThree(progress);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  };

  const updateWorld = (dt, progress, nextCfg) => {
    const world = worldRef.current;
    const baseSpeed = difficulty === 'easy' ? 2.35 : difficulty === 'medium' ? 2.75 : 3.05;
    const speed = baseSpeed + progress * (difficulty === 'hard' ? 1.35 : 0.85);
    world.z += speed * dt;
    world.spin += dt * (0.12 + progress * 0.18);

    let ix = 0;
    let iy = 0;
    const pad = stateRef.current;
    if (pad?.axes) {
      ix += pad.axes[0] || 0;
      iy -= pad.axes[1] || 0;
      if (Math.abs(ix) > 0.04 || Math.abs(iy) > 0.04) setInputMode(connected ? 'JOYSTICK' : 'GAMEPAD');
    }
    if (keysRef.current.left) { ix -= 1; setInputMode('KEYBOARD'); }
    if (keysRef.current.right) { ix += 1; setInputMode('KEYBOARD'); }
    if (keysRef.current.up) { iy += 1; setInputMode('KEYBOARD'); }
    if (keysRef.current.down) { iy -= 1; setInputMode('KEYBOARD'); }
    const steer = 0.92 + progress * 0.18;
    ballRef.current.x = clamp(ballRef.current.x + ix * steer * dt, -0.92, 0.92);
    ballRef.current.y = clamp(ballRef.current.y + iy * steer * dt, -0.92, 0.92);
    const cameraLag = 1 - Math.exp(-dt * 4.2);
    cameraRef.current.x += (ballRef.current.x - cameraRef.current.x) * cameraLag;
    cameraRef.current.y += (ballRef.current.y - cameraRef.current.y) * cameraLag;

    const spacing = Math.max(5.2, 8.5 - progress * 2.2);
    while (world.nextZ - world.z < 22) {
      shapesRef.current.push(makeShape(world.id++, world.nextZ, progress));
      world.nextZ += spacing + Math.random() * 2.5;
    }

    for (const shape of shapesRef.current) {
      const dz = shape.z - world.z;
      if (shape.scored || dz > 0.12) continue;
      const distance = Math.hypot(shape.x - ballRef.current.x, shape.y - ballRef.current.y);
      const shouldAvoid = matchesRule(shape, activeRuleRef.current);
      if (distance < 0.3) {
        if (shouldAvoid) scoreRef.current.shapeErrors++;
        else scoreRef.current.shapesHit++;
        shape.scored = true;
      } else {
        if (!shouldAvoid) scoreRef.current.shapesMissed++;
        shape.scored = true;
      }
      syncScore();
    }
    shapesRef.current = shapesRef.current.filter(shape => shape.z - world.z > -2);
    if (activeRuleRef.current && elapsedRef.current > activeRuleRef.current.expiresAt) {
      activeRuleRef.current = null;
      setActiveRule(null);
    }

    if (progress > 0.3 && !world.beepDue && world.z > world.nextBeepAt) {
      world.beepDue = performance.now();
      world.beepHit = false;
      world.nextBeepAt += 18 - progress * 7;
      beep();
      window.setTimeout(() => {
        if (worldRef.current.beepDue && !worldRef.current.beepHit) {
          scoreRef.current.beepMisses++;
          syncScore();
          worldRef.current.beepDue = null;
        }
      }, 1500);
    }

    const triggerDown = Boolean(pad?.buttons?.[0] || pad?.buttons?.[7]);
    if (triggerDown && !gamepadButtonDownRef.current) handleTrigger();
    gamepadButtonDownRef.current = triggerDown;
  };

  const beep = () => {
    setCallout('BEEP');
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      const ctx = new AudioContext();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.frequency.value = 880;
      gain.gain.value = 0.08;
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.18);
    }
    window.setTimeout(() => setCallout(''), 500);
  };

  const handleTrigger = () => {
    const world = worldRef.current;
    if (!world.beepDue) return;
    const latency = performance.now() - world.beepDue;
    if (latency <= 1500) scoreRef.current.beepHits++;
    else scoreRef.current.beepMisses++;
    world.beepHit = true;
    world.beepDue = null;
    syncScore();
  };

  const renderThree = (progress) => {
    const three = initThree();
    if (!three) return;
    const { scene, camera, renderer, light, rings, ribs, ball, shapeGroup, shapeMeshes } = three;
    const world = worldRef.current;
    const cameraTrack = cameraRef.current;
    const ballX = ballRef.current.x * TUNNEL_RADIUS * 0.7;
    const ballY = ballRef.current.y * TUNNEL_RADIUS * 0.7;
    const ballZ = world.z + 4.2;
    const baseZ = Math.floor((world.z - 8) / 2.6) * 2.6;

    rings.forEach((ring, i) => {
      ring.position.z = baseZ + i * 2.6;
      ring.rotation.z = world.spin + i * 0.04;
      ring.material.opacity = 0.38 + progress * 0.18;
    });

    ribs.forEach(({ line, angle }) => {
      const positions = line.geometry.attributes.position;
      const wobble = Math.sin(world.z * 0.22 + angle * 3) * 0.08;
      const radius = TUNNEL_RADIUS + wobble;
      positions.setXYZ(0, Math.cos(angle) * radius, Math.sin(angle) * radius, world.z - 9);
      positions.setXYZ(1, Math.cos(angle) * radius, Math.sin(angle) * radius, world.z + TUNNEL_DEPTH);
      positions.needsUpdate = true;
    });

    const activeIds = new Set();
    shapesRef.current.forEach((shape) => {
      activeIds.add(shape.id);
      let mesh = shapeMeshes.get(shape.id);
      if (!mesh) {
        mesh = makeShapeObject(shape);
        shapeMeshes.set(shape.id, mesh);
        shapeGroup.add(mesh);
      }
      mesh.position.set(shape.x * TUNNEL_RADIUS * 0.72, shape.y * TUNNEL_RADIUS * 0.72, shape.z);
      mesh.rotation.z = world.spin * 0.8 + shape.id * 0.17;
      const dz = shape.z - world.z;
      mesh.visible = dz > -2 && dz < TUNNEL_DEPTH;
      const shouldAvoid = matchesRule(shape, activeRuleRef.current);
      mesh.scale.setScalar(shouldAvoid ? 1.15 : 1);
    });

    shapeMeshes.forEach((mesh, id) => {
      if (activeIds.has(id)) return;
      shapeGroup.remove(mesh);
      mesh.traverse((child) => {
        child.geometry?.dispose?.();
        child.material?.dispose?.();
      });
      shapeMeshes.delete(id);
    });

    ball.position.set(ballX, ballY, ballZ);
    ball.rotation.y += 0.04;
    light.position.set(ballX, ballY + 1.4, world.z + 2.8);

    const camX = cameraTrack.x * TUNNEL_RADIUS * 0.62;
    const camY = cameraTrack.y * TUNNEL_RADIUS * 0.62;
    camera.position.set(camX, camY, world.z - 2.2);
    camera.lookAt(ballX * 0.96, ballY * 0.96, world.z + 18);
    scene.fog.near = 26 - progress * 5;
    scene.fog.far = TUNNEL_DEPTH;
    renderer.render(scene, camera);
  };

  const endPlay = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (eventRef.current) clearInterval(eventRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    disposeThree();
    if (noiseRef.current) {
      noiseRef.current.source.stop();
      noiseRef.current.ctx.close();
      noiseRef.current = null;
    }
    if (speaks()) window.speechSynthesis.cancel();
    setPhase('answer');
    setQ(buildQuestion(digitsRef.current));
    setTotalQ(0);
    setCorrectAns(0);
    setResponses([]);
  };

  const answerQuestion = (opt) => {
    const right = String(opt) === String(q.answer);
    setResponses(prev => [...prev, {
      prompt: q.text,
      detail: `Digits heard: ${digitsRef.current.join(', ')}`,
      given: opt,
      answer: q.answer,
      correct: right
    }]);
    const nextTotal = totalQ + 1;
    setCorrectAns(c => c + (right ? 1 : 0));
    setTotalQ(nextTotal);
    if (nextTotal >= 3) {
      setStage('results');
      return;
    }
    setQ(buildQuestion(digitsRef.current));
  };

  const handleNumber = (digit) => {
    if (phase !== 'play' || pausedRef.current) return;
    ballNumberRef.current = digit;
    setBallNumber(digit);
    if (!requiredNumberRef.current) return;
    if (digit === requiredNumberRef.current) scoreRef.current.numberHits++;
    else scoreRef.current.numberMisses++;
    requiredNumberRef.current = '';
    setRequiredNumber('');
    syncScore();
  };

  useEffect(() => {
    const kd = (event) => {
      if (event.key === 'Escape' && stage === 'test' && phase === 'play') {
        event.preventDefault();
        pausedRef.current = !pausedRef.current;
        setPaused(pausedRef.current);
        return;
      }
      if (pausedRef.current) return;
      if (/^\d$/.test(event.key)) handleNumber(event.key);
      if (event.code === 'Space') handleTrigger();
      if (['ArrowUp', 'w', 'W'].includes(event.key)) keysRef.current.up = true;
      if (['ArrowDown', 's', 'S'].includes(event.key)) keysRef.current.down = true;
      if (['ArrowLeft', 'a', 'A'].includes(event.key)) keysRef.current.left = true;
      if (['ArrowRight', 'd', 'D'].includes(event.key)) keysRef.current.right = true;
    };
    const ku = (event) => {
      if (['ArrowUp', 'w', 'W'].includes(event.key)) keysRef.current.up = false;
      if (['ArrowDown', 's', 'S'].includes(event.key)) keysRef.current.down = false;
      if (['ArrowLeft', 'a', 'A'].includes(event.key)) keysRef.current.left = false;
      if (['ArrowRight', 'd', 'D'].includes(event.key)) keysRef.current.right = false;
    };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    return () => {
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
    };
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMouseMove = (event) => {
    if (!containerRef.current || phase !== 'play' || pausedRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    ballRef.current.x = clamp(((event.clientX - rect.left) / rect.width) * 2 - 1, -0.92, 0.92);
    ballRef.current.y = clamp(-(((event.clientY - rect.top) / rect.height) * 2 - 1), -0.92, 0.92);
    setInputMode('MOUSE');
  };

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (eventRef.current) clearInterval(eventRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (noiseRef.current) {
      noiseRef.current.source.stop();
      noiseRef.current.ctx.close();
    }
    disposeThree();
    if (speaks()) window.speechSynthesis.cancel();
  }, []);

  useEffect(() => {
    if (stage === 'results' && mode === 'assessment') {
      const shapeTotal = score.shapesHit + score.shapesMissed + score.shapeErrors;
      const beepTotal = score.beepHits + score.beepMisses;
      const numberTotal = score.numberHits + score.numberMisses;
      const motorAcc = shapeTotal ? (score.shapesHit / shapeTotal) * 100 : 0;
      const beepAcc = beepTotal ? (score.beepHits / beepTotal) * 100 : 100;
      const numberAcc = numberTotal ? (score.numberHits / numberTotal) * 100 : 100;
      const audioAcc = totalQ ? (correctAns / totalQ) * 100 : 0;
      saveResult('Auditory Capacity', mode, difficulty, {
        accuracy: (motorAcc + beepAcc + numberAcc + audioAcc) / 4,
        motorAccuracy: motorAcc,
        beepAccuracy: beepAcc,
        numberAccuracy: numberAcc,
        audioAccuracy: audioAcc,
        correctAns,
        totalQ
      });
    }
  }, [stage]); // eslint-disable-line react-hooks/exhaustive-deps

  if (stage === 'menu') {
    return (
      <ModuleMenu
        title="Auditory Capacity Test - Instructions"
        description="Fly the white ball through a tunnel using joystick, mouse, or arrow keys. Follow spoken instructions, react to beeps, change the ball number when told, remember digit sequences, and obey only your assigned call signs as the round progresses."
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
    const shapeTotal = score.shapesHit + score.shapesMissed + score.shapeErrors;
    const beepTotal = score.beepHits + score.beepMisses;
    const numberTotal = score.numberHits + score.numberMisses;
    const motorAcc = shapeTotal ? (score.shapesHit / shapeTotal) * 100 : 0;
    const beepAcc = beepTotal ? (score.beepHits / beepTotal) * 100 : 100;
    const numberAcc = numberTotal ? (score.numberHits / numberTotal) * 100 : 100;
    const audioAcc = totalQ ? (correctAns / totalQ) * 100 : 0;
    const overall = (motorAcc + beepAcc + numberAcc + audioAcc) / 4;
    return (
      <ModuleResults
        title="Auditory Capacity - Results"
        rows={[
          ['Shapes Passed', `${score.shapesHit} / ${shapeTotal}`],
          ['Shape Errors', String(score.shapeErrors)],
          ['Beep Response', `${score.beepHits} / ${beepTotal}`],
          ['Ball Number', `${score.numberHits} / ${numberTotal}`],
          ['Digit Questions', `${correctAns} / ${totalQ}`],
          ['Audio Accuracy', `${audioAcc.toFixed(1)}%`]
        ]}
        overallScore={overall}
        summary={[
          { prompt: 'Tunnel shape task', given: `${score.shapesHit} passed, ${score.shapesMissed} missed, ${score.shapeErrors} forbidden hits`, answer: 'Pass required shapes and avoid forbidden shapes', correct: motorAcc >= 50 },
          { prompt: 'Beep trigger task', given: `${score.beepHits} hits / ${beepTotal || 0}`, answer: 'Press trigger/space immediately after beep', correct: beepAcc >= 50 },
          { prompt: 'Ball number task', given: `${score.numberHits} correct / ${numberTotal || 0}`, answer: 'Press the instructed keyboard number', correct: numberAcc >= 50 },
          ...responses
        ]}
        onRetry={() => setStage('menu')}
        onDashboard={() => navigate('/')}
      />
    );
  }

  return (
    <CFASTShell
      title="Auditory Capacity Test - Testing"
      mode={mode}
      difficulty={difficulty}
      questionNum={phase === 'play' ? 1 : totalQ + 1}
      questionCount={phase === 'play' ? 1 : 3}
      remaining={phase === 'play' ? remaining : 0}
      showTimer={phase === 'play'}
    >
      {phase === 'play' && (
        <div data-act-remaining={remaining}>
          <div className="bg-[#000080] border border-white p-2">
            <div
              className={`relative h-[546px] border border-[#D6D600] overflow-hidden ${paused ? 'cursor-auto' : 'cursor-none'}`}
              ref={containerRef}
              onMouseMove={handleMouseMove}
              data-testid="act-tunnel"
            >
              <div ref={threeMountRef} className="absolute inset-0 w-full h-full bg-black" data-testid="act-three-scene" />
              <div className="absolute right-4 top-5 w-[200px] h-[60px] bg-[#555555]/80 rounded-md text-white flex flex-col items-center justify-center text-xl">
                <span>Seconds</span>
                <span className="font-mono">{Math.ceil(remaining)}</span>
              </div>
              <div className="absolute right-6 bottom-6 w-[170px] h-[28px] bg-[#555555]/80 rounded-md p-2">
                <div className="h-full bg-[#111] rounded-sm overflow-hidden">
                  <div className="h-full bg-[#BDBDBD]" style={{ width: `${cfg ? ((cfg.testDuration - remaining) / cfg.testDuration) * 100 : 0}%` }} />
                </div>
              </div>
              {callout && (
                <div className="absolute left-1/2 top-8 -translate-x-1/2 bg-black/75 text-[#FFFF66] text-2xl font-mono px-4 py-1 border border-[#FFFF66]" data-testid="act-callout">
                  {callout}
                </div>
              )}
              {paused && (
                <div className="absolute inset-0 bg-black/45 text-white flex items-center justify-center text-3xl font-mono" data-testid="act-paused">
                  PAUSED
                </div>
              )}
            </div>
          </div>
          <div className="mt-2 grid grid-cols-5 gap-2 text-[11px] text-white">
            <div className="bg-black border border-[#4444AA] px-2 py-1">Input: <span className="font-mono text-[#00FF00]">{inputMode}{connected ? ' CONNECTED' : ''}</span></div>
            <div className="bg-black border border-[#4444AA] px-2 py-1">Shapes: <span className="font-mono">{score.shapesHit}/{score.shapesHit + score.shapesMissed + score.shapeErrors}</span></div>
            <div className="bg-black border border-[#4444AA] px-2 py-1">Trigger: <span className="font-mono">{score.beepHits}/{score.beepHits + score.beepMisses}</span></div>
            <div className="bg-black border border-[#4444AA] px-2 py-1">Ball No: <span className="font-mono">{ballNumber || '-'}{requiredNumber ? ` -> ${requiredNumber}` : ''}</span></div>
            <div className="bg-black border border-[#4444AA] px-2 py-1">Rule: <span className="font-mono">{activeRule ? `Avoid ${activeRule.colour} ${activeRule.kind}` : 'All shapes'}</span></div>
          </div>
        </div>
      )}
      {phase === 'answer' && q && (
        <div className="max-w-lg mx-auto py-4">
          <div className="text-[#AACCFF] text-[11px] text-center mb-2">Question {totalQ + 1} of 3</div>
          <div className="text-white text-sm font-bold text-center mb-4" data-testid="ac-q-text">{q.text}</div>
          <div className="bg-[#000050] border border-[#4444AA] p-3">
            <div className="grid grid-cols-2 gap-3 items-center">
              <CFASTOptions options={q.options} prefix="ac-q-answer" />
              <div className="flex items-center justify-end">
                <CFASTAnswerInput options={q.options} onSubmit={answerQuestion} testid="ac-q-input" />
              </div>
            </div>
          </div>
        </div>
      )}
    </CFASTShell>
  );
};

export default AuditoryCapacity;
