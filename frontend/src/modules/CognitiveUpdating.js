import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSettings, saveResult } from '../utils/storage';
import { ModuleAnswerSummary } from './cbtCommon';

const PRESSURE_MIN_OK = 90;
const PRESSURE_MAX_OK = 110;
const FUEL_DIFF_LIMIT = 50;
const SPEED_DIFF_LIMIT = 10;
const SENSOR_TOLERANCE = 2;
const CAMERA_TOLERANCE = 3;
const COMMS_ENTRY_WINDOW = 15;
const TASK_FEEDBACK_SECONDS = 3;
const COMMS_RESPONSE_WINDOW = 5;
const TICK_MS = 100;

const RATE_SCALE_BY_DIFFICULTY = {
  easy: 0.3,
  medium: 0.42,
  hard: 0.55
};

const TABS = ['Message', 'Engine', 'Navigation', 'Sensor', 'Mission', 'System'];

const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomSeconds = (minimum, maximum) => {
  const low = Math.max(0.1, Math.min(Number(minimum) || 0, Number(maximum) || 0));
  const high = Math.max(low, Math.max(Number(minimum) || 0, Number(maximum) || 0));
  return Math.round((low + Math.random() * (high - low)) * 10) / 10;
};
const dispenserDelay = (cfg) => randomSeconds(
  cfg?.dispenserLightMin ?? 6,
  cfg?.dispenserLightMax ?? 10
);
const missionResetDelay = (cfg) => randomSeconds(
  cfg?.missionResetMin ?? 26,
  cfg?.missionResetMax ?? 42
);
const missionLeadDelay = (cfg) => randomSeconds(
  cfg?.missionLeadMin ?? 72,
  cfg?.missionLeadMax ?? 96
);
const randDigits = (n) => Array(n).fill(0).map(() => randInt(0, 9)).join('');
const pad2 = (n) => String(Math.floor(n)).padStart(2, '0');
const pad3 = (n) => String(Math.floor(n)).padStart(3, '0');
const formatClock = (date) => `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
const formatTime = (seconds) => `${pad2(Math.floor(Math.max(0, seconds) / 60))}:${pad2(Math.floor(Math.max(0, seconds) % 60))}`;
const clockFromStart = (startDate, seconds) => {
  const base = startDate || new Date();
  return formatClock(new Date(base.getTime() + Math.max(0, seconds) * 1000));
};

// ============ SHARED STYLE HELPERS ============
const cbtFont = { fontFamily: "'Arial', 'Helvetica', sans-serif" };
const OUTER_BG = '#000080';       // navy
const PANEL_BG = '#B0B0B0';       // classic grey
const PANEL_BG_DARK = '#909090';  // darker grey for inner
const BORDER_DARK = '#000060';
const TEXT_DARK = '#000000';
const TEXTURE_BG = {
  backgroundColor: '#777777',
  backgroundImage: 'linear-gradient(45deg, rgba(255,255,255,.08) 25%, transparent 25%, transparent 75%, rgba(255,255,255,.08) 75%), linear-gradient(45deg, rgba(0,0,0,.08) 25%, transparent 25%, transparent 75%, rgba(0,0,0,.08) 75%)',
  backgroundPosition: '0 0, 3px 3px',
  backgroundSize: '6px 6px'
};

// Old CBT bevel style (light top-left, dark bottom-right)
const bevelOut = { borderStyle: 'outset', borderWidth: '2px', borderColor: '#DDDDDD' };
const bevelIn = { borderStyle: 'inset', borderWidth: '2px', borderColor: '#606060' };

const CognitiveUpdating = () => {
  const navigate = useNavigate();
  const [stage, setStage] = useState('menu');
  const [mode, setMode] = useState(null);
  const [difficulty, setDifficulty] = useState(null);
  const [config, setConfig] = useState(null);

  // Time state
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [clockDisplay, setClockDisplay] = useState('00:00:00');
  const [testStartAt, setTestStartAt] = useState(null);
  const timeElapsedRef = useRef(0);
  const testStartAtRef = useRef(null);

  // Panel state (each side picks one of 6 tabs)
  const [leftTab, setLeftTab] = useState('System');
  const [rightTab, setRightTab] = useState('Mission');

  // Hydraulic system
  const [pressure, setPressure] = useState(100);
  const [pumpOn, setPumpOn] = useState(false);
  const pumpOnRef = useRef(false);
  const pressureRef = useRef(100);

  // Fuel tanks
  const initialTanks = [
    { volume: 450, active: true },
    { volume: 450, active: false },
    { volume: 450, active: false }
  ];
  const [tanks, setTanks] = useState(initialTanks);
  const tanksRef = useRef(initialTanks);

  // Airspeed
  const [speedRequired, setSpeedRequired] = useState(100);
  const [speedCurrent, setSpeedCurrent] = useState(100);
  const speedRequiredRef = useRef(100);
  const speedCurrentRef = useRef(100);

  // Sensors, cameras, comms, parcel
  const [sensors, setSensors] = useState([]);
  const sensorsRef = useRef([]);
  const [cameras, setCameras] = useState([]);
  const camerasRef = useRef([]);
  const [commsCode, setCommsCode] = useState({
    target: '', entered: '', timeRemaining: 0,
    submitted: false, correct: false, active: false, responseDue: false, respondedAt: null,
    startsAt: null, started: false, responseDueAt: null, resetAt: null,
    cycle: 0, promptKey: null
  });
  const commsCodeRef = useRef(commsCode);
  const [parcel, setParcel] = useState({
    targetLat: '', targetLon: '', targetTime: '',
    enteredLat: '', enteredLon: '', enteredTime: '',
    currentField: null, dispenserPrepared: false,
    dispenserLights: 0, dispenserNextLightAt: null,
    dropped: false, dropTimeSec: 0, droppedAtSec: null
  });
  const [messageState, setMessageState] = useState({
    queue: [],
    current: null,
    revealed: {},
    cleared: false,
    resetAt: null
  });
  const messageStateRef = useRef(messageState);

  // Video recording (Mission panel)
  const [video, setVideo] = useState({
    magnification: '', range: '', bearing: '', duration: ''
  });
  const [videoField, setVideoField] = useState(null);

  // Scoring
  const scoreRef = useRef({
    pressureInRangeTicks: 0,
    fuelBalancedTicks: 0,
    speedInRangeTicks: 0,
    sensorHits: 0,
    cameraHits: 0,
    commsHit: 0,
    dispenserHit: 0,
    parcelHit: 0,
    commsTasks: 0,
    commsCompleted: 0,
    commsCorrect: 0,
    parcelTasks: 0,
    parcelCompleted: 0,
    parcelCorrect: 0,
    totalTicks: 0
  });
  const speedEventRef = useRef([]);

  const [finalScore, setFinalScore] = useState(null);
  const resultSavedRef = useRef(false);
  const gameLoopRef = useRef(null);

  useEffect(() => {
    return () => { if (gameLoopRef.current) clearInterval(gameLoopRef.current); };
  }, []);

  useEffect(() => { pumpOnRef.current = pumpOn; }, [pumpOn]);
  useEffect(() => { pressureRef.current = pressure; }, [pressure]);
  useEffect(() => { tanksRef.current = tanks; }, [tanks]);
  useEffect(() => { speedCurrentRef.current = speedCurrent; }, [speedCurrent]);
  useEffect(() => { speedRequiredRef.current = speedRequired; }, [speedRequired]);
  useEffect(() => { timeElapsedRef.current = timeElapsed; }, [timeElapsed]);
  useEffect(() => { sensorsRef.current = sensors; }, [sensors]);
  useEffect(() => { camerasRef.current = cameras; }, [cameras]);
  useEffect(() => { commsCodeRef.current = commsCode; }, [commsCode]);
  useEffect(() => { messageStateRef.current = messageState; }, [messageState]);
  useEffect(() => { testStartAtRef.current = testStartAt; }, [testStartAt]);

  const commitMessageState = (nextState) => {
    messageStateRef.current = nextState;
    setMessageState(nextState);
  };

  const updateMessageState = (updater) => {
    const nextState = updater(messageStateRef.current);
    commitMessageState(nextState);
    return nextState;
  };

  const removeTaskMessages = ({ group, key } = {}) => {
    updateMessageState((current) => {
      const matches = (message) => Boolean(
        message && ((group && message.group === group) || (key && message.key === key))
      );
      return {
        ...current,
        queue: current.queue.filter((message) => !matches(message)),
        current: matches(current.current) ? null : current.current,
        revealed: Object.fromEntries(
          Object.entries(current.revealed || {}).filter(([, message]) => !matches(message))
        )
      };
    });
  };

  const enqueueTaskMessage = (message) => {
    updateMessageState((current) => ({
      ...current,
      queue: [...current.queue, message].sort((a, b) => a.at - b.at || a.order - b.order)
    }));
  };

  const commitCommsCode = (nextCode) => {
    commsCodeRef.current = nextCode;
    setCommsCode(nextCode);
  };

  const generateInitialData = (cfg, startDate) => {
    const testDur = cfg.testDuration;
    const newSensors = [];
    for (let t = 120; t <= testDur - 2; t += 120) {
      newSensors.push({
        id: `air-${t}`,
        name: 'Air Sensor',
        targetSec: t,
        activated: false, activatedAt: null, missed: false,
        resetAt: null, cleared: false
      });
    }
    for (let t = 240; t <= testDur - 2; t += 240) {
      newSensors.push({
        id: `ground-${t}`,
        name: 'Ground Sensor',
        targetSec: t,
        activated: false, activatedAt: null, missed: false,
        resetAt: null, cleared: false
      });
    }
    newSensors.sort((a, b) => a.targetSec - b.targetSec || a.name.localeCompare(b.name));

    const cameraSlots = [
      Math.floor(testDur * 0.35),
      Math.floor(testDur * 0.68)
    ];
    const newCameras = ['Alpha Camera', 'Bravo Camera'].map((name, i) => ({
      id: `camera-${i}`,
      name,
      targetSec: Math.max(20, Math.min(cameraSlots[i], testDur - 5)),
      activated: false, activatedAt: null, missed: false,
      resetAt: null, cleared: false
    }));

    const dropTimeSec = randInt(Math.floor(testDur * 0.5), Math.floor(testDur * 0.8));
    const newParcel = {
      targetLat: randDigits(6),
      targetLon: randDigits(6),
      targetTime: clockFromStart(startDate, dropTimeSec).replace(/:/g, ''),
      targetTimeSec: dropTimeSec,
      enteredLat: '', enteredLon: '', enteredTime: '',
      currentField: 'time', dispenserPrepared: true,
      dispenserLights: 0, dispenserNextLightAt: dispenserDelay(cfg),
      dropped: false, dropTimeSec, droppedAtSec: null
    };

    const newCommsCode = {
      target: randDigits(3), entered: '',
      timeRemaining: cfg.commsCodeCountdown,
      submitted: false, correct: false, active: false, responseDue: false, respondedAt: null,
      startsAt: null, started: false, responseDueAt: null, resetAt: null,
      cycle: 0, promptKey: 'comms-0'
    };

    const speedEvents = [0.28, 0.52, 0.76].map((pct, i) => ({
      targetSec: Math.floor(testDur * pct),
      required: [90, 110, 100][i]
    }));

    return { newSensors, newCameras, newParcel, newCommsCode, speedEvents };
  };

  const buildMessageQueue = ({ newParcel, newCommsCode, newCameras }, cfg) => {
    const firstAt = Math.max(4, Math.floor(cfg.testDuration * 0.06));
    const commsStartAt = Math.min(
      cfg.testDuration - cfg.commsCodeCountdown - 5,
      firstAt + 21 + newCameras.length * 7
    );
    const rows = [
      { at: firstAt, key: 'time', label: 'Time:', value: newParcel.targetTime, field: 'time', group: 'drop' },
      { at: firstAt + 7, key: 'lat', label: 'Latitude:', value: newParcel.targetLat, field: 'lat', group: 'drop' },
      { at: firstAt + 14, key: 'lon', label: 'Longitude:', value: newParcel.targetLon, field: 'lon', group: 'drop' },
      ...newCameras.map((camera, i) => ({
        at: Math.max(firstAt + 21 + i * 7, camera.targetSec - 25),
        key: camera.id,
        label: `${camera.name}:`,
        value: clockFromStart(testStartAtRef.current, camera.targetSec),
        group: 'camera'
      })),
      {
        at: Math.max(1, commsStartAt),
        key: 'comms-0',
        label: 'Code:',
        value: newCommsCode.target,
        group: 'comms'
      }
    ];
    const queue = rows
      .map((item, order) => ({ ...item, at: Math.max(1, Math.min(item.at, cfg.testDuration - 2)), order }))
      .sort((a, b) => a.at - b.at || a.order - b.order);
    return {
      queue,
      commsStartAt: queue.find((item) => item.key === 'comms-0')?.at ?? null
    };
  };

  const startTest = (selectedMode, selectedDifficulty) => {
    const settings = getSettings();
    const cfg = settings.cognitiveUpdating[selectedDifficulty];
    setMode(selectedMode);
    setDifficulty(selectedDifficulty);
    setConfig(cfg);
    const freshTanks = [
      { volume: 450, active: true },
      { volume: 450, active: false },
      { volume: 450, active: false }
    ];
    setPressure(100); pressureRef.current = 100;
    setPumpOn(false); pumpOnRef.current = false;
    setTanks(freshTanks); tanksRef.current = freshTanks;
    setSpeedRequired(100); speedRequiredRef.current = 100;
    setSpeedCurrent(100); speedCurrentRef.current = 100;
    setTimeElapsed(0); timeElapsedRef.current = 0;
    const startDate = new Date();
    setTestStartAt(startDate); testStartAtRef.current = startDate;
    setClockDisplay(formatClock(startDate));
    setLeftTab('System'); setRightTab('Mission');
    setFinalScore(null);
    resultSavedRef.current = false;
    setVideo({ magnification: '', range: '', bearing: '', duration: '' });
    setVideoField(null);

    const generated = generateInitialData(cfg, startDate);
    const { newSensors, newCameras, newParcel, newCommsCode, speedEvents } = generated;
    setSensors(newSensors); sensorsRef.current = newSensors;
    setCameras(newCameras); camerasRef.current = newCameras;
    setParcel(newParcel);
    speedEventRef.current = speedEvents;
    const { queue, commsStartAt } = buildMessageQueue(generated, cfg);
    const scheduledCommsCode = { ...newCommsCode, startsAt: commsStartAt };
    commitCommsCode(scheduledCommsCode);
    const initialMessageState = { queue, current: null, revealed: {}, cleared: false, resetAt: null };
    commitMessageState(initialMessageState);
    scoreRef.current = {
      pressureInRangeTicks: 0, fuelBalancedTicks: 0,
      speedInRangeTicks: 0, sensorHits: 0, cameraHits: 0,
      commsHit: 0, dispenserHit: 0, parcelHit: 0,
      commsTasks: 1, commsCompleted: 0, commsCorrect: 0,
      parcelTasks: 1, parcelCompleted: 0, parcelCorrect: 0,
      totalTicks: 0
    };
    setStage('instructions');
  };

  const beginTest = () => { setStage('test'); startGameLoop(); };

  const startGameLoop = () => {
    if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    gameLoopRef.current = setInterval(() => {
      const tickSec = TICK_MS / 1000;
      const newElapsed = timeElapsedRef.current + tickSec;
      timeElapsedRef.current = newElapsed;
      setTimeElapsed(newElapsed);
      if (newElapsed >= config.testDuration) { endTest(); return; }
      setClockDisplay(clockFromStart(testStartAtRef.current, newElapsed));
      const rateScale = RATE_SCALE_BY_DIFFICULTY[difficulty] || 0.42;

      const pChange = pumpOnRef.current ? config.pumpFillRate * rateScale * tickSec : -config.pressureDriftRate * rateScale * tickSec;
      const newPressure = Math.max(60, Math.min(140, pressureRef.current + pChange));
      pressureRef.current = newPressure;
      setPressure(newPressure);

      const newTanks = tanksRef.current.map(t => t.active
        ? { ...t, volume: Math.max(0, t.volume - config.fuelDrainRate * rateScale * tickSec) } : t);
      tanksRef.current = newTanks;
      setTanks(newTanks);

      const sDrift = -config.speedDriftRate * rateScale * tickSec;
      const newSpeed = Math.max(50, Math.min(200, speedCurrentRef.current + sDrift));
      speedCurrentRef.current = newSpeed;
      setSpeedCurrent(newSpeed);

      const nextSpeedEvent = speedEventRef.current[0];
      if (nextSpeedEvent && newElapsed >= nextSpeedEvent.targetSec) {
        speedRequiredRef.current = nextSpeedEvent.required;
        setSpeedRequired(nextSpeedEvent.required);
        speedEventRef.current = speedEventRef.current.slice(1);
      }

      const messageSnapshot = messageStateRef.current;
      if (messageSnapshot.queue.length && (!messageSnapshot.current || newElapsed - messageSnapshot.current.at >= 5)) {
        const [nextMessage, ...rest] = messageSnapshot.queue;
        if (newElapsed >= nextMessage.at) {
          const nextState = {
            ...messageSnapshot,
            queue: rest,
            current: nextMessage,
            revealed: { ...messageSnapshot.revealed, [nextMessage.key]: nextMessage }
          };
          commitMessageState(nextState);
        }
      }

      const parcelResetSnapshot = messageStateRef.current;
      if (parcelResetSnapshot.resetAt && newElapsed >= parcelResetSnapshot.resetAt) {
        const remaining = config.testDuration - newElapsed;
        const maximumLightPreparation = (config.dispenserLightMax || 5) * 6;
        const minimumMissionWindow = Math.max(
          30,
          (config.missionLeadMin || 40) * 0.8,
          maximumLightPreparation + 8
        );
        if (remaining > minimumMissionWindow) {
          const nextDropSec = Math.min(
            config.testDuration - 5,
            newElapsed + missionLeadDelay(config)
          );
          const nextParcel = {
            targetLat: randDigits(6),
            targetLon: randDigits(6),
            targetTime: clockFromStart(testStartAtRef.current, nextDropSec).replace(/:/g, ''),
            targetTimeSec: nextDropSec,
            enteredLat: '', enteredLon: '', enteredTime: '',
            currentField: 'time', dispenserPrepared: true,
            dispenserLights: 0,
            dispenserNextLightAt: newElapsed + dispenserDelay(config),
            dropped: false, dropTimeSec: nextDropSec, droppedAtSec: null
          };
          setParcel(nextParcel);
          scoreRef.current.parcelTasks += 1;
          const cycleKey = Math.floor(newElapsed * 10);
          const queue = [
            { at: newElapsed + 2, key: `time-${cycleKey}`, label: 'Time:', value: nextParcel.targetTime, field: 'time', group: 'drop', order: 0 },
            { at: newElapsed + 7, key: `lat-${cycleKey}`, label: 'Latitude:', value: nextParcel.targetLat, field: 'lat', group: 'drop', order: 1 },
            { at: newElapsed + 12, key: `lon-${cycleKey}`, label: 'Longitude:', value: nextParcel.targetLon, field: 'lon', group: 'drop', order: 2 }
          ];
          commitMessageState({
            ...parcelResetSnapshot,
            queue: [...parcelResetSnapshot.queue, ...queue].sort((a, b) => a.at - b.at || a.order - b.order),
            current: null,
            resetAt: null
          });
        } else {
          setParcel({
            targetLat: '', targetLon: '', targetTime: '', targetTimeSec: null,
            enteredLat: '', enteredLon: '', enteredTime: '',
            currentField: null, dispenserPrepared: false,
            dispenserLights: 0, dispenserNextLightAt: null,
            dropped: false, dropTimeSec: null, droppedAtSec: null
          });
          commitMessageState({ ...parcelResetSnapshot, current: null, resetAt: null });
        }
      }

      setParcel(prev => {
        if (
          prev.dropped
          || prev.dispenserNextLightAt == null
          || newElapsed < prev.dispenserNextLightAt
        ) return prev;
        const lights = Math.min(6, prev.dispenserLights + 1);
        return {
          ...prev,
          dispenserLights: lights,
          dispenserNextLightAt: lights >= 6
            ? null
            : newElapsed + dispenserDelay(config)
        };
      });

      let sensorStateChanged = false;
      const nextSensors = sensorsRef.current.map((sensor) => {
        if (sensor.cleared) return sensor;
        if (sensor.activated && sensor.resetAt != null && newElapsed >= sensor.resetAt) {
          sensorStateChanged = true;
          return { ...sensor, resetAt: null, cleared: true };
        }
        if (!sensor.activated && newElapsed > sensor.targetSec + SENSOR_TOLERANCE) {
          sensorStateChanged = true;
          return {
            ...sensor,
            activated: true,
            activatedAt: null,
            missed: true,
            resetAt: newElapsed + TASK_FEEDBACK_SECONDS
          };
        }
        return sensor;
      });
      if (sensorStateChanged) {
        sensorsRef.current = nextSensors;
        setSensors(nextSensors);
      }

      let cameraStateChanged = false;
      let cameraInterfaceReset = false;
      const clearedCameraKeys = [];
      const nextCameras = camerasRef.current.map((camera) => {
        if (camera.cleared) return camera;
        if (camera.activated && camera.resetAt != null && newElapsed >= camera.resetAt) {
          cameraStateChanged = true;
          cameraInterfaceReset = true;
          clearedCameraKeys.push(camera.id);
          return { ...camera, resetAt: null, cleared: true };
        }
        if (!camera.activated && newElapsed > camera.targetSec + CAMERA_TOLERANCE) {
          cameraStateChanged = true;
          return {
            ...camera,
            activated: true,
            activatedAt: null,
            missed: true,
            resetAt: newElapsed + TASK_FEEDBACK_SECONDS
          };
        }
        return camera;
      });
      if (cameraStateChanged) {
        camerasRef.current = nextCameras;
        setCameras(nextCameras);
      }
      clearedCameraKeys.forEach((key) => removeTaskMessages({ key }));
      if (cameraInterfaceReset) {
        setVideo({ magnification: '', range: '', bearing: '', duration: '' });
        setVideoField(null);
      }

      const currentComms = commsCodeRef.current;
      if (currentComms.resetAt != null && newElapsed >= currentComms.resetAt) {
        const countdown = Math.max(
          COMMS_ENTRY_WINDOW + 1,
          config.commsCodeInterval || config.commsCodeCountdown
        );
        const startsAt = newElapsed + 1;
        const enoughTime = config.testDuration - startsAt > countdown + COMMS_RESPONSE_WINDOW;
        if (enoughTime) {
          let target = randDigits(3);
          while (target === currentComms.target) target = randDigits(3);
          const cycle = currentComms.cycle + 1;
          const promptKey = `comms-${cycle}`;
          commitCommsCode({
            target,
            entered: '',
            timeRemaining: countdown,
            submitted: false,
            correct: false,
            active: false,
            responseDue: false,
            respondedAt: null,
            startsAt,
            started: false,
            responseDueAt: null,
            resetAt: null,
            cycle,
            promptKey
          });
          scoreRef.current.commsTasks += 1;
          enqueueTaskMessage({
            at: startsAt,
            key: promptKey,
            label: 'Code:',
            value: target,
            group: 'comms',
            order: 0
          });
        } else {
          commitCommsCode({
            target: '',
            entered: '',
            timeRemaining: 0,
            submitted: false,
            correct: false,
            active: false,
            responseDue: false,
            respondedAt: null,
            startsAt: null,
            started: false,
            responseDueAt: null,
            resetAt: null,
            cycle: currentComms.cycle,
            promptKey: null
          });
        }
      } else if (
        !currentComms.started &&
        currentComms.startsAt != null &&
        newElapsed >= currentComms.startsAt &&
        messageStateRef.current.revealed?.[currentComms.promptKey]
      ) {
        commitCommsCode({ ...currentComms, active: true, started: true });
      } else if (currentComms.active) {
        const nextTime = currentComms.timeRemaining - tickSec;
        if (nextTime <= 0) {
          commitCommsCode({
            ...currentComms,
            timeRemaining: 0,
            active: false,
            responseDue: true,
            responseDueAt: newElapsed
          });
        } else {
          commitCommsCode({ ...currentComms, timeRemaining: nextTime });
        }
      } else if (
        currentComms.responseDue &&
        currentComms.responseDueAt != null &&
        newElapsed - currentComms.responseDueAt >= COMMS_RESPONSE_WINDOW
      ) {
        scoreRef.current.commsCompleted += 1;
        removeTaskMessages({ group: 'comms' });
        commitCommsCode({
          ...currentComms,
          responseDue: false,
          respondedAt: newElapsed,
          correct: false,
          resetAt: newElapsed + TASK_FEEDBACK_SECONDS
        });
      }

      scoreRef.current.totalTicks++;
      if (newPressure >= PRESSURE_MIN_OK && newPressure <= PRESSURE_MAX_OK) scoreRef.current.pressureInRangeTicks++;
      const volumes = newTanks.map(t => t.volume);
      const fuelDiff = Math.max(...volumes) - Math.min(...volumes);
      if (fuelDiff < FUEL_DIFF_LIMIT) scoreRef.current.fuelBalancedTicks++;
      if (Math.abs(newSpeed - speedRequiredRef.current) < SPEED_DIFF_LIMIT) scoreRef.current.speedInRangeTicks++;
    }, TICK_MS);
  };

  const endTest = () => {
    if (gameLoopRef.current) { clearInterval(gameLoopRef.current); gameLoopRef.current = null; }
    const finalSensors = sensorsRef.current.map(s => !s.activated ? { ...s, activated: true, missed: true } : s);
    const finalCameras = camerasRef.current.map(c => !c.activated ? { ...c, activated: true, missed: true } : c);
    sensorsRef.current = finalSensors;
    camerasRef.current = finalCameras;
    setSensors(finalSensors);
    setCameras(finalCameras);
    const total = scoreRef.current.totalTicks || 1;
    const pressureScore = Math.min(100, (scoreRef.current.pressureInRangeTicks / total) * 100);
    const fuelScore = Math.min(100, (scoreRef.current.fuelBalancedTicks / total) * 100);
    const speedScore = Math.min(100, (scoreRef.current.speedInRangeTicks / total) * 100);
    const sensorScore = finalSensors.length ? (scoreRef.current.sensorHits / finalSensors.length) * 100 : 100;
    const cameraScore = finalCameras.length ? (scoreRef.current.cameraHits / finalCameras.length) * 100 : 100;
    const commsTasks = scoreRef.current.commsTasks;
    const parcelTasks = scoreRef.current.parcelTasks;
    const commsScore = commsTasks ? (scoreRef.current.commsCorrect / commsTasks) * 100 : 100;
    const parcelReleaseScore = parcelTasks ? (scoreRef.current.parcelCompleted / parcelTasks) * 100 : 100;
    const parcelAccuracyScore = parcelTasks ? (scoreRef.current.parcelCorrect / parcelTasks) * 100 : 100;
    const missionScore = (parcelReleaseScore + parcelAccuracyScore) / 2;
    setFinalScore({
      pressureScore,
      fuelScore,
      speedScore,
      sensorScore,
      cameraScore,
      commsScore,
      missionScore,
      commsTasks,
      commsCompleted: scoreRef.current.commsCompleted,
      commsCorrect: scoreRef.current.commsCorrect,
      parcelTasks,
      parcelCompleted: scoreRef.current.parcelCompleted,
      parcelCorrect: scoreRef.current.parcelCorrect
    });
    setStage('results');
  };

  useEffect(() => {
    if (stage === 'results' && mode === 'assessment' && finalScore && !resultSavedRef.current) {
      const sensorsCorrect = sensors.filter(s => s.activated && !s.missed).length;
      const camerasCorrect = cameras.filter(c => c.activated && !c.missed).length;
      const totalAcc = (finalScore.pressureScore + finalScore.fuelScore + finalScore.speedScore + finalScore.sensorScore + finalScore.cameraScore + finalScore.commsScore + finalScore.missionScore) / 7;
      saveResult('Cognitive Updating', mode, difficulty, {
        accuracy: totalAcc,
        pressureScore: finalScore.pressureScore,
        fuelScore: finalScore.fuelScore,
        speedScore: finalScore.speedScore,
        sensorsCorrect, totalSensors: sensors.length,
        camerasCorrect, totalCameras: cameras.length,
        parcelDropped: finalScore.parcelCompleted > 0,
        parcelsCompleted: finalScore.parcelCompleted,
        totalParcels: finalScore.parcelTasks,
        commsSuccess: finalScore.commsCorrect === finalScore.commsTasks,
        commsCorrect: finalScore.commsCorrect,
        totalCommsCodes: finalScore.commsTasks
      });
      resultSavedRef.current = true;
    }
  }, [stage, finalScore, mode, difficulty, sensors, cameras]);

  // Handlers
  const togglePump = () => setPumpOn(p => !p);
  const handleTankToggle = (idx) => {
    setTanks(prev => {
      const upd = prev.map((t, i) => ({ ...t, active: i === idx }));
      tanksRef.current = upd;
      return upd;
    });
  };
  const handleSpeedChange = (delta) => {
    setSpeedCurrent(prev => {
      const v = Math.max(50, Math.min(200, prev + delta));
      speedCurrentRef.current = v;
      return v;
    });
  };
  const handleActivateSensor = (idx) => {
    setSensors(prev => {
      const nextSensors = prev.map((s, i) => {
        if (i !== idx || s.activated) return s;
        const diff = Math.abs(timeElapsedRef.current - s.targetSec);
        const hit = diff <= SENSOR_TOLERANCE;
        if (hit) scoreRef.current.sensorHits++;
        return {
          ...s,
          activated: true,
          activatedAt: timeElapsedRef.current,
          missed: !hit,
          resetAt: timeElapsedRef.current + TASK_FEEDBACK_SECONDS
        };
      });
      sensorsRef.current = nextSensors;
      return nextSensors;
    });
  };
  const handleActivateCamera = (idx) => {
    setCameras(prev => {
      const nextCameras = prev.map((c, i) => {
        if (i !== idx || c.activated) return c;
        const diff = Math.abs(timeElapsedRef.current - c.targetSec);
        const hit = diff <= CAMERA_TOLERANCE;
        if (hit) scoreRef.current.cameraHits++;
        return {
          ...c,
          activated: true,
          activatedAt: timeElapsedRef.current,
          missed: !hit,
          resetAt: timeElapsedRef.current + TASK_FEEDBACK_SECONDS
        };
      });
      camerasRef.current = nextCameras;
      return nextCameras;
    });
  };
  const handleCommsDigit = (digit) => {
    const currentCode = commsCodeRef.current;
    const inEntryWindow = currentCode.active &&
      currentCode.timeRemaining <= COMMS_ENTRY_WINDOW &&
      currentCode.timeRemaining > 0;
    if (!inEntryWindow || currentCode.submitted) return;
    if (currentCode.entered.length >= currentCode.target.length) return;
    const entered = currentCode.entered + digit;
    commitCommsCode({
      ...currentCode,
      entered,
      submitted: entered.length === currentCode.target.length,
      correct: entered.length === currentCode.target.length
        ? entered === currentCode.target
        : false
    });
  };
  const handleCommsResponse = () => {
    const currentCode = commsCodeRef.current;
    if (!currentCode.responseDue || currentCode.respondedAt != null) return;
    const correct = currentCode.entered === currentCode.target;
    scoreRef.current.commsCompleted += 1;
    if (correct) {
      scoreRef.current.commsCorrect += 1;
      scoreRef.current.commsHit = 1;
    }
    removeTaskMessages({ group: 'comms' });
    commitCommsCode({
      ...currentCode,
      responseDue: false,
      respondedAt: timeElapsedRef.current,
      correct,
      resetAt: timeElapsedRef.current + TASK_FEEDBACK_SECONDS
    });
  };

  useEffect(() => {
    if (stage !== 'test') return undefined;
    const onKeyDown = (event) => {
      if (!/^\d$/.test(event.key)) return;
      const missionVisible = leftTab === 'Mission' || rightTab === 'Mission';
      const systemVisible = leftTab === 'System' || rightTab === 'System';
      if (missionVisible && parcel.currentField && !parcel.dropped) {
        handleParcelDigit(event.key);
        return;
      }
      if (systemVisible) handleCommsDigit(event.key);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [stage, leftTab, rightTab, parcel.currentField, parcel.dropped]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleParcelDigit = (digit) => {
    setParcel(prev => {
      if (prev.dropped || !prev.currentField) return prev;
      const field = prev.currentField;
      const currentVal = field === 'lat' ? prev.enteredLat : field === 'lon' ? prev.enteredLon : prev.enteredTime;
      if (currentVal.length >= 6) return prev;
      const nv = currentVal + digit;
      const key = field === 'lat' ? 'enteredLat' : field === 'lon' ? 'enteredLon' : 'enteredTime';
      return { ...prev, [key]: nv };
    });
  };
  const selectParcelField = (field) => setParcel(prev => (
    prev.dispenserPrepared && !prev.dropped ? { ...prev, currentField: field } : prev
  ));
  const parcelDrop = () => setParcel(prev => {
    const fieldsFilled = prev.enteredLat.length === 6 && prev.enteredLon.length === 6 && prev.enteredTime.length === 6;
    if (prev.dropped || prev.dispenserLights < 6 || !fieldsFilled) return prev;
    const enteredCorrect = prev.enteredLat === prev.targetLat && prev.enteredLon === prev.targetLon && prev.enteredTime === prev.targetTime;
    const timingCorrect = Math.abs(timeElapsedRef.current - prev.dropTimeSec) <= CAMERA_TOLERANCE;
    const taskCorrect = enteredCorrect && timingCorrect;
    scoreRef.current.parcelCompleted += 1;
    if (taskCorrect) {
      scoreRef.current.parcelCorrect += 1;
      scoreRef.current.parcelHit = 1;
    }
    scoreRef.current.dispenserHit = 1;
    const keptMessages = Object.fromEntries(
      Object.entries(messageStateRef.current.revealed || {}).filter(([, msg]) => msg.group !== 'drop')
    );
    const clearedState = {
      ...messageStateRef.current,
      current: null,
      revealed: keptMessages,
      resetAt: timeElapsedRef.current + missionResetDelay(config)
    };
    messageStateRef.current = clearedState;
    setMessageState(clearedState);
    return { ...prev, dropped: true, droppedAtSec: timeElapsedRef.current };
  });

  const handleVideoDigit = (digit) => {
    if (!videoField) return;
    setVideo(prev => ({ ...prev, [videoField]: (prev[videoField] + digit).slice(0, 4) }));
  };

  // Warnings (derived, not stored)
  const computeWarnings = () => {
    if (stage !== 'test') return [];
    const w = [];
    if (pressure < PRESSURE_MIN_OK || pressure > PRESSURE_MAX_OK) w.push({ text: 'Check Pressure', red: true });
    const volumes = tanks.map(t => t.volume);
    const fuelDiff = Math.max(...volumes) - Math.min(...volumes);
    if (fuelDiff >= FUEL_DIFF_LIMIT) w.push({ text: 'Engine Panel', red: true });
    else if (fuelDiff >= FUEL_DIFF_LIMIT - 10) w.push({ text: 'Engine Panel', red: false });
    const spdDiff = Math.abs(speedCurrent - speedRequired);
    if (spdDiff >= SPEED_DIFF_LIMIT) w.push({ text: 'Air Speed Warning', red: true });
    const sensorOverdue = sensors.some(s => !s.activated && (timeElapsed - s.targetSec) > 0);
    const sensorSoon = sensors.some(s => !s.activated && (s.targetSec - timeElapsed) <= 5 && (s.targetSec - timeElapsed) >= 0);
    if (sensorOverdue) w.push({ text: 'Sensor Panel', red: true });
    else if (sensorSoon) w.push({ text: 'Sensor Panel', red: false });
    const cameraOverdue = cameras.some(c => !c.activated && (timeElapsed - c.targetSec) > 0);
    const cameraSoon = cameras.some(c => !c.activated && (c.targetSec - timeElapsed) <= 8 && (c.targetSec - timeElapsed) >= 0);
    const parcelSoon = !parcel.dropped && Math.abs(parcel.dropTimeSec - timeElapsed) <= 15;
    const commsUrgent = (commsCode.active && commsCode.timeRemaining <= COMMS_ENTRY_WINDOW) || commsCode.responseDue;
    const dispenserReady = parcel.dispenserPrepared && parcel.dispenserLights >= 6 && !parcel.dropped;
    if (cameraOverdue) w.push({ text: 'Objective Warning', red: true });
    else if (cameraSoon || parcelSoon || commsUrgent || dispenserReady) w.push({ text: 'Objective Warning', red: false });
    return w;
  };

  // ============ MENU / INSTRUCTIONS / RESULTS ============
  if (stage === 'menu') {
    return (
      <div className="min-h-screen bg-[#000080] flex items-center justify-center p-6" style={cbtFont}>
        <div className="w-[720px] bg-[#B0B0B0]" style={bevelOut}>
          <div className="bg-[#800000] text-white text-center py-1 text-sm font-bold">Cognitive Updating Test - Setup</div>
          <div className="p-6 text-black text-sm">
            <p className="mb-4">Continuous multitasking simulation. Manage hydraulic pressure, fuel balance, and airspeed while completing timed sensor, camera, parcel-drop and communications tasks. All systems run concurrently.</p>
            <div className="bg-[#008000] text-white text-center py-0.5 text-xs font-bold">Mode</div>
            <div className="p-2 grid grid-cols-2 gap-2 mb-3" style={bevelIn}>
              {[{ v: 'practice', l: 'Practice' }, { v: 'assessment', l: 'Assessment' }].map(o => (
                <button key={o.v} data-testid={`${o.v}-mode-btn`} onClick={() => setMode(o.v)}
                  className={`py-1 text-xs font-bold ${mode === o.v ? 'bg-[#008000] text-white' : 'bg-[#C0C0C0] text-black'}`}
                  style={bevelOut}>{o.l}</button>
              ))}
            </div>
            {mode && (<>
              <div className="bg-[#008000] text-white text-center py-0.5 text-xs font-bold">Difficulty</div>
              <div className="p-2 grid grid-cols-3 gap-2 mb-3" style={bevelIn}>
                {['easy', 'medium', 'hard'].map(d => (
                  <button key={d} data-testid={`difficulty-${d}-btn`} onClick={() => setDifficulty(d)}
                    className={`py-1 text-xs font-bold uppercase ${difficulty === d ? 'bg-[#008000] text-white' : 'bg-[#C0C0C0] text-black'}`}
                    style={bevelOut}>{d}</button>
                ))}
              </div>
            </>)}
            <div className="flex gap-2 mt-4">
              <button data-testid="back-to-dashboard" onClick={() => navigate('/')} className="flex-1 bg-[#C0C0C0] text-black py-1 text-xs font-bold" style={bevelOut}>Cancel</button>
              {mode && difficulty && (
                <button data-testid="start-test-btn" onClick={() => startTest(mode, difficulty)} className="flex-1 bg-[#008000] text-white py-1 text-xs font-bold" style={bevelOut}>Continue &gt;&gt;</button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (stage === 'instructions') {
    return (
      <div className="min-h-screen bg-[#000080] flex items-center justify-center p-6" style={cbtFont}>
        <div className="w-[720px] bg-[#B0B0B0]" style={bevelOut}>
          <div className="bg-[#800000] text-white text-center py-1 text-sm font-bold">Cognitive Updating Test - Instructions</div>
          <div className="p-6 text-black text-sm space-y-2 leading-relaxed">
            <div><b>CONTINUOUS OBJECTIVES</b></div>
            <div>• System panel: keep hydraulic pressure between 90 and 110 using pump ON/OFF.</div>
            <div>• Engine panel: keep fuel tank difference below 50L by rotating active tanks.</div>
            <div>• Navigation panel: keep current within 10 kts of required using +/− controls.</div>
            <div className="pt-1"><b>TIMED OBJECTIVES</b></div>
            <div>• Sensor panel: activate sensors at their scheduled times (±2 sec).</div>
            <div>• Mission panel: activate cameras and drop parcel per Message panel information.</div>
            <div>• System panel: enter Communications Code before its countdown expires.</div>
            <div className="pt-2 text-[#800000]"><b>All systems continue running when hidden. No backspace on number entry.</b></div>
          </div>
          <div className="p-3 border-t border-[#606060] flex justify-end">
            <button data-testid="begin-instruction-phase-btn" onClick={beginTest} className="bg-[#008000] text-white px-6 py-1 text-xs font-bold" style={bevelOut}>Begin Test &gt;&gt;</button>
          </div>
        </div>
      </div>
    );
  }

  if (stage === 'results') {
    const totalScore = finalScore ? ((finalScore.pressureScore + finalScore.fuelScore + finalScore.speedScore + finalScore.sensorScore + finalScore.cameraScore + finalScore.commsScore + finalScore.missionScore) / 7) : 0;
    const sensorsCorrect = sensors.filter(s => s.activated && !s.missed).length;
    const camerasCorrect = cameras.filter(c => c.activated && !c.missed).length;
    const summary = finalScore ? [
      { prompt: 'Hydraulic pressure maintained in range', given: `${finalScore.pressureScore.toFixed(1)}%`, answer: 'Keep pressure between 90 and 110', correct: finalScore.pressureScore >= 50 },
      { prompt: 'Fuel tanks balanced', given: `${finalScore.fuelScore.toFixed(1)}%`, answer: `Keep tank difference under ${FUEL_DIFF_LIMIT}`, correct: finalScore.fuelScore >= 50 },
      { prompt: 'Airspeed maintained near target', given: `${finalScore.speedScore.toFixed(1)}%`, answer: `Stay within ${SPEED_DIFF_LIMIT} kt of required speed`, correct: finalScore.speedScore >= 50 },
      { prompt: 'Air/Ground sensors activated on time', given: `${sensorsCorrect} / ${sensors.length}`, answer: `${sensors.length} / ${sensors.length}`, correct: sensorsCorrect === sensors.length },
      { prompt: 'Mission cameras activated on time', given: `${camerasCorrect} / ${cameras.length}`, answer: `${cameras.length} / ${cameras.length}`, correct: camerasCorrect === cameras.length },
      {
        prompt: 'Parcel-drop tasks completed correctly',
        given: `${finalScore.parcelCorrect} / ${finalScore.parcelTasks}`,
        answer: `${finalScore.parcelTasks} / ${finalScore.parcelTasks}`,
        correct: finalScore.parcelCorrect === finalScore.parcelTasks
      },
      {
        prompt: 'Communications-code tasks completed correctly',
        given: `${finalScore.commsCorrect} / ${finalScore.commsTasks}`,
        answer: `${finalScore.commsTasks} / ${finalScore.commsTasks}`,
        correct: finalScore.commsCorrect === finalScore.commsTasks
      }
    ] : [];
    return (
      <div className="min-h-screen bg-[#000080] flex items-center justify-center p-6" style={cbtFont}>
        <div className="w-[720px] bg-[#B0B0B0]" style={bevelOut}>
          <div className="bg-[#800000] text-white text-center py-1 text-sm font-bold">Cognitive Updating Test - Results</div>
          <div className="p-4 text-black text-sm space-y-1">
            {[
              ['Hydraulic Pressure Time-In-Range', `${finalScore?.pressureScore.toFixed(1)}%`],
              ['Fuel Balance Time-In-Range', `${finalScore?.fuelScore.toFixed(1)}%`],
              ['Airspeed Time-In-Range', `${finalScore?.speedScore.toFixed(1)}%`],
              ['Sensor Timing Score', `${finalScore?.sensorScore.toFixed(1)}%`],
              ['Camera Timing Score', `${finalScore?.cameraScore.toFixed(1)}%`],
              ['Mission Dispenser Score', `${finalScore?.missionScore.toFixed(1)}%`],
              ['Comms Code Score', `${finalScore?.commsScore.toFixed(1)}%`],
              ['Sensors Correct', `${sensorsCorrect} / ${sensors.length}`],
              ['Cameras Correct', `${camerasCorrect} / ${cameras.length}`],
              ['Parcel Drops', `${finalScore?.parcelCompleted} / ${finalScore?.parcelTasks} completed`],
              ['Comms Codes', `${finalScore?.commsCorrect} / ${finalScore?.commsTasks} correct`]
            ].map(([l, v], i) => (
              <div key={i} className="flex justify-between px-3 py-1 bg-white" style={bevelIn} data-testid={`result-${i}`}>
                <span>{l}</span><span className="font-mono">{v}</span>
              </div>
            ))}
            <div className="flex justify-between px-3 py-2 bg-[#000060] text-white mt-2" style={bevelIn}>
              <span className="font-bold">OVERALL SCORE</span>
              <span className="font-mono font-bold text-lg" data-testid="overall-score">{totalScore.toFixed(1)}%</span>
            </div>
            <ModuleAnswerSummary summary={summary} />
          </div>
          <div className="p-3 flex gap-2 justify-end border-t border-[#606060]">
            <button data-testid="return-menu-btn" onClick={() => { setStage('menu'); setFinalScore(null); }} className="bg-[#C0C0C0] text-black px-4 py-1 text-xs font-bold" style={bevelOut}>Try Again</button>
            <button data-testid="return-dashboard-btn" onClick={() => navigate('/')} className="bg-[#C0C0C0] text-black px-4 py-1 text-xs font-bold" style={bevelOut}>Dashboard</button>
          </div>
        </div>
      </div>
    );
  }

  // ============ TEST STAGE ============
  const warnings = computeWarnings();
  const timeRemaining = Math.max(0, config.testDuration - timeElapsed);

  const renderPanel = (which) => {
    const activeTab = which === 'left' ? leftTab : rightTab;
    switch (activeTab) {
      case 'System':
        return <SystemPanel pressure={pressure} pumpOn={pumpOn} onPump={togglePump} commsCode={commsCode} onCommsDigit={handleCommsDigit} onCommsResponse={handleCommsResponse} />;
      case 'Mission':
        return <MissionPanel parcel={parcel} onFieldSelect={selectParcelField} onDigit={handleParcelDigit} onDrop={parcelDrop} cameras={cameras} onActivateCamera={handleActivateCamera} timeElapsed={timeElapsed} testStartAt={testStartAt} video={video} videoField={videoField} onVideoField={setVideoField} onVideoDigit={handleVideoDigit} />;
      case 'Message':
        return <MessagePanel messageState={messageState} />;
      case 'Engine':
        return <EnginePanel tanks={tanks} onToggle={handleTankToggle} />;
      case 'Navigation':
        return <NavigationPanel required={speedRequired} current={speedCurrent} onChange={handleSpeedChange} />;
      case 'Sensor':
        return <SensorPanel sensors={sensors} timeElapsed={timeElapsed} onActivate={handleActivateSensor} />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#000080] p-3" style={cbtFont}>
      <div className="max-w-[1250px] mx-auto bg-[#000080] border-2 border-white">
        {/* Title bar */}
        <div className="bg-[#800000] text-white text-center py-1 text-sm font-bold border-b border-[#000060]">
          Cognitive Updating Test - Testing
        </div>

        <div className="p-2">
          {/* Warning + Clock */}
          <div className="flex gap-2 mb-2">
            <div className="flex-1 border-2 border-white bg-black">
              <div className="bg-[#808000] text-white text-center py-0.5 text-base leading-tight font-bold border-b border-white">Warning Panel</div>
              <div className="bg-black h-28 px-2 py-1 overflow-hidden" data-testid="warning-list">
                <div className="grid grid-cols-3 gap-x-4 gap-y-0.5 text-[11px]">
                  {warnings.map((w, i) => (
                    <div key={i} className={w.red ? 'text-[#FF3333]' : 'text-[#FFCC00]'}>{w.text}</div>
                  ))}
                </div>
              </div>
            </div>
            <div className="w-36 border-2 border-white bg-black">
              <div className="bg-[#008080] text-white text-center py-0.5 text-base leading-tight font-bold border-b border-white">Clock</div>
              <div className="bg-black h-28 flex items-center justify-center">
                <span className="text-white font-mono text-lg" data-testid="clock-display">{clockDisplay}</span>
              </div>
            </div>
          </div>

          {/* Two MFDI + Two content panels */}
          <div className="grid grid-cols-2 gap-2">
            {/* LEFT COLUMN */}
            <div>
              <MFDI side="left" active={leftTab} onSelect={setLeftTab} />
              <div className="mt-4 border-2 border-white bg-[#777777]" style={TEXTURE_BG}>
                <div className="bg-[#800000] text-white text-center py-0.5 text-base leading-tight font-bold border-b border-white">{leftTab}</div>
                <div className="p-8 min-h-[590px]">{renderPanel('left')}</div>
              </div>
            </div>
            {/* RIGHT COLUMN */}
            <div>
              <MFDI side="right" active={rightTab} onSelect={setRightTab} />
              <div className="mt-4 border-2 border-white bg-[#777777]" style={TEXTURE_BG}>
                <div className="bg-[#008000] text-white text-center py-0.5 text-base leading-tight font-bold border-b border-white">{rightTab}</div>
                <div className="p-8 min-h-[590px]">{renderPanel('right')}</div>
              </div>
            </div>
          </div>

          {/* Status bar */}
          <div className="mt-2 bg-[#B0B0B0] text-black text-[11px] px-2 py-0.5 flex justify-between" style={bevelIn}>
            <span>{mode.toUpperCase()} / {difficulty.toUpperCase()}</span>
            <span>Elapsed: {formatTime(timeElapsed)} / {formatTime(config.testDuration)}</span>
            <span data-testid="time-remaining">Remaining: {formatTime(timeRemaining)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============ MFDI (Multifunction Display Index) ============
const MFDI = ({ side, active, onSelect }) => (
  <div className="border-2 border-white bg-[#777777]" style={TEXTURE_BG}>
    <div className={`${active === 'Mission' ? 'bg-[#008000]' : 'bg-[#800000]'} text-white text-center py-0.5 text-xs font-bold border-b border-white`}>Multifunction Display Index</div>
    <div className="p-2 grid grid-cols-3 gap-x-8 gap-y-2">
      {TABS.map(t => (
        <PillButton key={t} testid={`${side}-tab-${t.toLowerCase()}`} active={active === t} onClick={() => onSelect(t)}>
          {t}
        </PillButton>
      ))}
    </div>
  </div>
);

const PillButton = ({ children, active, onClick, testid, disabled }) => (
  <button
    data-testid={testid}
    onClick={onClick}
    disabled={disabled}
    className={`text-lg leading-none font-bold py-1 px-3 border-2 shadow-inner ${
      active ? 'bg-[#00A000] text-white border-[#004000]' : 'bg-[#C00000] text-white border-[#600000]'
    } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
    style={{
      borderRadius: '999px',
      backgroundImage: active
        ? 'linear-gradient(#72ff72 0%, #13e513 45%, #008a00 55%, #19c319 100%)'
        : 'linear-gradient(#ffc4c4 0%, #ff6464 45%, #b00000 55%, #f06060 100%)'
    }}
  >
    {children}
  </button>
);

// ============ SYSTEM PANEL (Hydraulics + Pump + Comms Code) ============
const SystemPanel = ({ pressure, pumpOn, onPump, commsCode, onCommsDigit, onCommsResponse }) => {
  const pressurePct = Math.max(0, Math.min(100, ((pressure - 60) / 80) * 100));
  const commsCanEnter = commsCode.active && commsCode.timeRemaining <= COMMS_ENTRY_WINDOW && commsCode.timeRemaining > 0 && !commsCode.submitted;

  return (
    <div className="relative h-[520px]">
      <div className="absolute left-4 top-2 w-[220px] bg-black border-2 border-white">
        <div className="bg-[#000060] text-white text-center py-0.5 text-base leading-tight font-bold border-b border-white">Hydraulic Pressure</div>
        <div className="p-7 flex gap-2">
          <div className="relative w-32 h-72 bg-white border border-black">
            <div className="absolute inset-0 flex flex-col text-[10px] font-bold text-black">
              <div className="flex-1 bg-white flex items-center justify-center border-b border-black text-xl leading-5">High<br/>Pressure</div>
              <div className="flex-1 bg-[#008000] text-white flex items-center justify-center border-b border-black">Correct<br/>Pressure</div>
              <div className="flex-1 bg-white flex items-center justify-center text-xl leading-5">Low<br/>Pressure</div>
            </div>
            <div className="absolute right-0 top-0 bottom-0 w-3 bg-white border-l border-black">
              <div className="absolute bottom-0 w-3 bg-[#FF9900]" style={{ height: `${pressurePct}%` }}></div>
            </div>
          </div>
          <div className="flex flex-col justify-between text-xl text-white">
            <span>130</span><span>110</span><span>90</span><span>70</span>
          </div>
        </div>
      </div>

      <div className="absolute left-[305px] top-[150px] w-[220px] bg-black border-2 border-white">
          <div className="bg-[#000060] text-white text-center py-0.5 text-base leading-tight font-bold border-b border-white">Hydraulic Pump</div>
          <div className="p-4 flex gap-3 justify-center">
            <button
              data-testid="pump-on-btn"
              onClick={onPump}
              className={`px-5 py-1 text-lg leading-none font-bold border-2 ${pumpOn ? 'bg-[#00A000] text-black border-[#004000]' : 'bg-[#C00000] text-black border-[#600000]'}`}
              style={{ borderRadius: '999px', backgroundImage: pumpOn ? 'linear-gradient(#77ff77,#0c0)' : 'linear-gradient(#ffc6c6,#f45,#c00)' }}
            >ON</button>
            <button
              data-testid="pump-off-btn"
              onClick={onPump}
              className={`px-5 py-1 text-lg leading-none font-bold border-2 ${!pumpOn ? 'bg-[#00A000] text-black border-[#004000]' : 'bg-[#C00000] text-black border-[#600000]'}`}
              style={{ borderRadius: '999px', backgroundImage: !pumpOn ? 'linear-gradient(#77ff77,#0c0)' : 'linear-gradient(#ffc6c6,#f45,#c00)' }}
            >OFF</button>
          </div>
        </div>

        <div className="absolute left-[260px] bottom-6 w-[300px] bg-black border-2 border-white text-white">
          <div className="bg-[#000060] text-white text-center py-0.5 text-base leading-tight font-bold border-b border-white">Communications Code</div>
          <div className="p-3">
            <div className="flex items-center gap-2 mb-2 justify-center">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className="w-8 h-8 bg-white text-black flex items-center justify-center font-mono text-xl font-bold"
                  style={bevelIn}
                  data-testid={`comms-entry-${i}`}
                >
                  {commsCode.entered[i] || ''}
                </div>
              ))}
              <div className={`w-7 h-7 rounded-full border border-black ${
                commsCode.responseDue ? 'bg-[#FFFF00]' : commsCode.respondedAt != null ? (commsCode.correct ? 'bg-[#00FF00]' : 'bg-[#FF0000]') : commsCanEnter || commsCode.submitted ? 'bg-[#00FF00]' : 'bg-[#606060]'
              }`} data-testid="comms-status"></div>
            </div>
            <div className="text-[11px] flex items-center gap-2 justify-center mb-2">
              <span className="text-lg">Time Left:</span>
              <div className="flex gap-0.5">
                {pad3(commsCode.timeRemaining).split('').map((d, i) => (
                  <div key={i} className="w-8 h-8 bg-white text-black flex items-center justify-center font-mono text-xl font-bold" style={bevelIn} data-testid={i === 2 ? 'comms-timer' : undefined}>
                    {d}
                  </div>
                ))}
              </div>
            </div>
            {commsCode.responseDue ? (
              <button data-testid="comms-response-btn" onClick={onCommsResponse} className="w-full py-1 text-lg font-bold bg-[#C0C0C0] text-black" style={bevelOut}>PRESS</button>
            ) : (
            <div className="grid grid-cols-5 gap-1">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map(n => (
                <button
                  key={n}
                  data-testid={`comms-digit-${n}`}
                  onClick={() => onCommsDigit(String(n))}
                  disabled={!commsCanEnter}
                  className="py-1 text-xs font-bold bg-[#C0C0C0] text-black disabled:opacity-40"
                  style={bevelOut}
                >{n}</button>
              ))}
            </div>
            )}
          </div>
        </div>
    </div>
  );
};

// ============ MISSION PANEL (Load Drop + Video Recording) ============
const DigitBox = ({ ch, testId }) => (
  <div className="w-8 h-8 bg-[#202020] text-white flex items-center justify-center font-mono text-base font-bold border border-white" data-testid={testId}>{ch}</div>
);

const MissionPanel = ({ parcel, onFieldSelect, onDigit, onDrop, cameras, onActivateCamera, timeElapsed, testStartAt, video, videoField, onVideoField, onVideoDigit }) => {
  const fieldsFilled = parcel.enteredTime.length === 6 && parcel.enteredLat.length === 6 && parcel.enteredLon.length === 6;
  const visibleCameras = cameras
    .map((camera, index) => ({ camera, index }))
    .filter(({ camera }) => !camera.cleared);
  const renderDigits = (val, len, testIdBase) => {
    const digits = val.padEnd(len, ' ').split('');
    return digits.map((d, i) => <DigitBox key={i} ch={d === ' ' ? '' : d} testId={i === 0 ? testIdBase : undefined} />);
  };

  return (
    <div className="space-y-2">
      <div className="w-[420px] mx-auto bg-black border-2 border-white text-white">
        <div className="bg-[#000060] text-white text-center py-0.5 text-base leading-tight font-bold border-b border-white">Load Drop Interface</div>
        <div className="p-2 space-y-0 text-xl">
          <div className="grid grid-cols-[108px_1fr_34px] items-center border border-white">
            <span className="px-2 border-r border-white">Time</span>
            <div className="flex gap-1 px-2" data-testid="parcel-input-time">{renderDigits(parcel.enteredTime, 6, undefined)}</div>
            <button data-testid="parcel-select-time" onClick={() => onFieldSelect('time')} className={`w-7 h-7 border ${parcel.currentField === 'time' ? 'bg-[#8cb6ff]' : 'bg-[#4169E1]'}`} style={{ borderRadius: '999px', borderColor: '#2442a8' }}></button>
          </div>
          <div className="grid grid-cols-[108px_1fr_34px] items-center border-x border-b border-white">
            <span className="px-2 border-r border-white">Latitude</span>
            <div className="flex gap-1 px-2" data-testid="parcel-input-lat">{renderDigits(parcel.enteredLat, 6, undefined)}</div>
            <button data-testid="parcel-select-lat" onClick={() => onFieldSelect('lat')} className={`w-7 h-7 border ${parcel.currentField === 'lat' ? 'bg-[#8cb6ff]' : 'bg-[#4169E1]'}`} style={{ borderRadius: '999px', borderColor: '#2442a8' }}></button>
          </div>
          <div className="grid grid-cols-[108px_1fr_34px] items-center border-x border-b border-white">
            <span className="px-2 border-r border-white">Longitude</span>
            <div className="flex gap-1 px-2" data-testid="parcel-input-lon">{renderDigits(parcel.enteredLon, 6, undefined)}</div>
            <button data-testid="parcel-select-lon" onClick={() => onFieldSelect('lon')} className={`w-7 h-7 border ${parcel.currentField === 'lon' ? 'bg-[#8cb6ff]' : 'bg-[#4169E1]'}`} style={{ borderRadius: '999px', borderColor: '#2442a8' }}></button>
          </div>
          <div className="grid grid-cols-10 gap-0.5 mt-2">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
              <button key={n} data-testid={`parcel-digit-${n}`} onClick={() => onDigit(String(n))} className="py-0.5 text-xs font-bold bg-[#C0C0C0] text-black" style={bevelOut}>{n}</button>
            ))}
          </div>
          <div className="text-[11px] text-[#CCCCCC] pt-1">Keyboard digits enter into the selected blue field.</div>
        </div>
      </div>

      <div className="w-full bg-black border-2 border-white text-white">
        <div className="bg-[#000060] text-white text-center py-0.5 text-base leading-tight font-bold border-b border-white">Load Drop Dispenser</div>
        <div className="p-4 flex items-center gap-4 text-xl">
          <span>Activate</span>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5, 6].map(n => (
              <div key={n} className="text-center">
                <div
                  className={`w-7 h-7 rounded-full border border-black ${parcel.dispenserLights >= n ? 'bg-[#00FF00]' : 'bg-[#C0C0C0]'}`}
                  data-testid={`parcel-light-${n}`}
                ></div>
                <div className="text-base leading-none mt-1">{n}</div>
              </div>
            ))}
          </div>
          <button data-testid="parcel-drop-btn" onClick={onDrop} disabled={parcel.dispenserLights < 6 || parcel.dropped || !fieldsFilled}
            className={`ml-auto px-5 py-1 text-xl leading-none font-bold ${parcel.dropped ? 'bg-[#00A000]' : 'bg-[#C0C0C0]'} text-black disabled:opacity-40`}
            style={{ borderRadius: '999px' }}>{parcel.dropped ? 'RELEASED' : 'RELEASE'}</button>
        </div>
      </div>

      <div className="w-[445px] mx-auto bg-black border-2 border-white text-white">
        <div className="bg-[#000060] text-white text-center py-0.5 text-base leading-tight font-bold border-b border-white">Video Recording Interface</div>
        <div className="p-2 space-y-1 text-sm">
          {visibleCameras.length === 0 && (
            <div className="py-3 text-center text-[#C0C0C0]" data-testid="camera-idle">NO PENDING CAMERA TASK</div>
          )}
          {visibleCameras.map(({ camera: c, index: i }) => {
            const timeLeft = c.targetSec - timeElapsed;
            const statusText = c.activated ? (c.missed ? 'MISS' : 'OK') : timeLeft > 0 ? clockFromStart(testStartAt, c.targetSec) : `+${Math.abs(Math.floor(timeLeft))}s`;
            const statusColor = c.activated ? (c.missed ? 'text-[#CC0000]' : 'text-[#008000]') : timeLeft < 0 ? 'text-[#CC0000]' : timeLeft <= 5 ? 'text-[#996600]' : 'text-black';
            return (
              <div key={c.id} className="flex items-center gap-2" data-testid={`camera-row-${i}`}>
                <span className="w-24">{c.name}</span>
                <span className={`font-mono ${statusColor}`} data-testid={`camera-time-${i}`}>{statusText}</span>
                <button
                  data-testid={`camera-activate-${i}`}
                  onClick={() => onActivateCamera(i)}
                  disabled={c.activated}
                  className={`ml-auto px-3 py-0.5 text-xs font-bold ${c.activated ? (c.missed ? 'bg-[#C00000]' : 'bg-[#00A000]') : 'bg-[#C00000]'} text-white disabled:opacity-70`}
                  style={{ borderRadius: '999px' }}
                >ACTIVATE</button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ============ MESSAGE PANEL ============
const MessagePanel = ({ messageState }) => {
  const revealed = Object.values(messageState.revealed || {}).sort((a, b) => a.at - b.at || a.order - b.order);
  return (
    <div className="bg-black border-2 border-white text-white h-[500px] p-3">
      <div className="bg-[#000060] text-white text-center py-0.5 text-base leading-tight font-bold border border-white mb-3">Message Display</div>
      <div className="text-lg leading-tight">
        {revealed.length === 0 ? (
          <div className="h-20 flex items-center justify-center text-[#CCCCCC] border border-[#444444]" data-testid="msg-blank">NO MESSAGE</div>
        ) : (
          <div className="border border-[#444444] bg-[#080808]" data-testid="msg-list">
            {revealed.map((msg) => (
              <div key={msg.key} className="grid grid-cols-[120px_1fr] gap-3 px-2 py-1 border-b border-[#333333] last:border-b-0">
                <span className="text-[#CCCCCC]">{msg.label}</span>
                <span className="font-mono text-white" data-testid={`msg-${msg.key}`}>{msg.value}</span>
              </div>
            ))}
          </div>
        )}
        <div className="border-t border-white pt-2 mt-3 text-base">
          Sensor schedule: Air Sensor every 02:00. Ground Sensor every 04:00.
        </div>
      </div>
    </div>
  );
};

// ============ ENGINE PANEL ============
const EnginePanel = ({ tanks, onToggle }) => {
  const volumes = tanks.map(t => t.volume);
  const diff = Math.max(...volumes) - Math.min(...volumes);
  return (
    <div className="text-black">
      <div className="bg-white p-4 border-4 border-black">
        <div className="grid grid-cols-3 gap-10">
          {tanks.map((t, i) => {
            const pct = Math.max(0, Math.min(100, (t.volume / 450) * 100));
            return (
              <div key={i} className="text-center">
                <div className="text-2xl mb-3 uppercase">TANK {i + 1}</div>
                <div className="relative mx-auto w-28 h-60 bg-white border-4 border-black mb-2">
                  <div className="absolute left-0 right-0 bottom-0 bg-[#ff7f27]" style={{ height: `${pct}%` }} />
                  {[20, 40, 60, 80].map(mark => (
                    <div key={mark} className="absolute left-0 right-0 border-t-4 border-black" style={{ bottom: `${mark}%` }}></div>
                  ))}
                </div>
                <div className="font-mono text-2xl text-black" data-testid={`tank-volume-${i}`}>{Math.round(t.volume)}L</div>
                <button
                  data-testid={`tank-toggle-${i}`}
                  onClick={() => onToggle(i)}
                  className="mt-2 px-5 py-1 text-2xl bg-white text-black border-4 border-black"
                >{t.active ? 'ON' : 'OFF'}</button>
              </div>
            );
          })}
        </div>
        <div className="mt-5 text-center text-2xl">Current Status</div>
        <div className="mt-2 p-2 flex justify-between text-black border-2 border-black">
          <span>Max - Min Difference</span>
          <span className={`font-mono font-bold ${diff < FUEL_DIFF_LIMIT ? 'text-[#008000]' : 'text-[#CC0000]'}`} data-testid="fuel-diff">{Math.round(diff)}L</span>
        </div>
      </div>
    </div>
  );
};

// ============ NAVIGATION PANEL ============
const NavigationPanel = ({ required, current, onChange }) => {
  const diff = Math.abs(current - required);
  return (
    <div className="text-black">
      <div className="bg-white border-4 border-black w-[545px] mx-auto">
          <div className="grid grid-cols-2">
            <div className="text-center border-r-4 border-black">
              <div className="text-2xl py-4 border-b-4 border-black">Required Air Speed</div>
              <div className="font-mono text-4xl py-20" data-testid="speed-required">{Math.round(required)} knots</div>
            </div>
            <div className="text-center">
              <div className="text-2xl py-4 border-b-4 border-black">Current Air Speed</div>
              <div className={`font-mono text-4xl py-20 ${diff < SPEED_DIFF_LIMIT ? 'text-black' : 'text-[#CC0000]'}`} data-testid="speed-current">{Math.round(current)} knots</div>
            </div>
          </div>
      </div>
      <div className="w-[545px] mx-auto flex justify-center gap-12 pt-5">
        <button data-testid="speed-increase-btn" onClick={() => onChange(1)} className="w-14 h-14 text-5xl leading-none bg-white text-black border-4 border-black rounded-full flex items-center justify-center">+</button>
        <button data-testid="speed-decrease-btn" onClick={() => onChange(-1)} className="w-14 h-14 text-5xl leading-none bg-white text-black border-4 border-black rounded-full flex items-center justify-center">−</button>
      </div>
      <div className="w-[545px] mx-auto mt-4 p-2 bg-white text-black flex justify-between border-2 border-black">
        <span>Difference</span>
        <span className={`font-mono font-bold ${diff < SPEED_DIFF_LIMIT ? 'text-[#008000]' : 'text-[#CC0000]'}`} data-testid="speed-diff">{Math.round(diff)} kts</span>
        </div>
    </div>
  );
};

// ============ SENSOR PANEL ============
const SensorPanel = ({ sensors, timeElapsed, onActivate }) => {
  const visibleSensors = sensors
    .map((sensor, index) => ({ sensor, index }))
    .filter(({ sensor }) => !sensor.cleared);

  return (
    <div className="bg-black border-2 border-white text-white h-[500px]">
      <div className="bg-[#000060] text-white text-center py-0.5 text-base leading-tight font-bold border-b border-white">Sensors</div>
      <div className="p-4 space-y-3 text-lg">
        <div className="grid grid-cols-2 gap-4">
          <div className="border border-white p-3">
            <div className="text-center border-b border-white mb-2">Air Sensor</div>
            <div className="text-center font-mono">Every 02:00</div>
          </div>
          <div className="border border-white p-3">
            <div className="text-center border-b border-white mb-2">Ground Sensor</div>
            <div className="text-center font-mono">Every 04:00</div>
          </div>
        </div>
        <div className="space-y-2">
          {visibleSensors.length === 0 && (
            <div className="text-center text-[#C0C0C0] border border-white p-4" data-testid="sensor-idle">NO PENDING SENSOR TASK</div>
          )}
          {visibleSensors.map(({ sensor: s, index: i }) => {
            const timeLeft = s.targetSec - timeElapsed;
            let statusText, statusColor;
            if (s.activated) {
              statusText = s.missed ? 'MISSED' : 'ACTIVATED';
              statusColor = s.missed ? 'text-[#CC0000]' : 'text-[#008000]';
            } else if (timeLeft > 0) {
              statusText = `Time Left: ${formatTime(timeLeft)}`;
              statusColor = timeLeft <= 5 ? 'text-[#FFCC00]' : 'text-white';
            } else {
              statusText = `OVERDUE +${Math.abs(Math.floor(timeLeft))}s`;
              statusColor = 'text-[#CC0000]';
            }
            return (
              <div key={s.id} className="flex items-center gap-3 bg-black border border-white p-2 text-white" data-testid={`sensor-row-${i}`}>
                <span className="w-28 font-bold">{s.name}</span>
                <button
                  data-testid={`sensor-activate-${i}`}
                  onClick={() => onActivate(i)}
                  disabled={s.activated}
                  className={`px-4 py-1 text-sm font-bold text-white ${s.activated ? (s.missed ? 'bg-[#C00000]' : 'bg-[#00A000]') : 'bg-[#C00000]'} disabled:opacity-70`}
                  style={{ borderRadius: '999px' }}
                >ACTIVATE</button>
                <span className={`ml-auto font-mono ${statusColor}`} data-testid={`sensor-time-${i}`}>{statusText}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default CognitiveUpdating;
