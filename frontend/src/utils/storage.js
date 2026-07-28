// Local persistence for CBAT Academy settings, calibration, and score history.
import { getResultAccuracy } from './cbatScoring';
import { deleteAttempts, syncAttempt } from '../services/cloudAttempts';

const STORAGE_KEYS = {
  SETTINGS: 'aviation_aptitude_settings',
  RESULTS: 'aviation_aptitude_results',
  HISTORY: 'aviation_aptitude_history',
  GAMEPAD: 'aviation_aptitude_gamepad'
};

export const HISTORY_CHANGED_EVENT = 'cbat-history-changed';

const notifyHistoryChanged = () => {
  window.dispatchEvent(new CustomEvent(HISTORY_CHANGED_EVENT));
};

// Default gamepad calibration
export const DEFAULT_GAMEPAD = {
  deadzone: 0.1,
  sensitivity: 1.0,
  invertX: false,
  invertY: false,
  invertPedals: false,
  axisX: 0,
  axisY: 1,
  axisPedals: 2,
  pedalSensitivity: 1.0,
  buttonAction: 0
};

export const getGamepad = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.GAMEPAD);
    if (stored) return { ...DEFAULT_GAMEPAD, ...JSON.parse(stored) };
  } catch (e) { console.error(e); }
  return { ...DEFAULT_GAMEPAD };
};

export const saveGamepad = (cfg) => {
  try {
    localStorage.setItem(STORAGE_KEYS.GAMEPAD, JSON.stringify(cfg));
    return true;
  } catch (e) { console.error(e); return false; }
};

// Default settings for all local aviation aptitude modules
export const DEFAULT_SETTINGS = {
  airborneNumerical: {
    easy:   { testDuration: 300, questionCount: 8 },
    medium: { testDuration: 240, questionCount: 12 },
    hard:   { testDuration: 180, questionCount: 16 }
  },
  anglesBearingsDegrees: {
    easy:   { testDuration: 180, questionCount: 10 },
    medium: { testDuration: 120, questionCount: 14 },
    hard:   { testDuration: 90,  questionCount: 20 }
  },
  auditoryCapacity: {
    easy:   { testDuration: 240, questionCount: 6,  sequenceLength: 4, playbackSpeed: 1.0 },
    medium: { testDuration: 240, questionCount: 8,  sequenceLength: 5, playbackSpeed: 1.2 },
    hard:   { testDuration: 240, questionCount: 10, sequenceLength: 6, playbackSpeed: 1.4 }
  },
  coloursLettersNumbers: {
    easy:   { testDuration: 240, questionCount: 12, stringLength: 5 },
    medium: { testDuration: 240, questionCount: 16, stringLength: 5 },
    hard:   { testDuration: 240, questionCount: 20, stringLength: 6 }
  },
  mathematicsReasoning: {
    easy:   { testDuration: 300, questionCount: 8 },
    medium: { testDuration: 240, questionCount: 12 },
    hard:   { testDuration: 180, questionCount: 16 }
  },
  instrumentComprehension: {
    easy:   { testDuration: 300, questionCount: 8 },
    medium: { testDuration: 240, questionCount: 12 },
    hard:   { testDuration: 180, questionCount: 16 }
  },
  digitRecognition: {
    easy:   { testDuration: 240, questionCount: 8,  digitCount: 6, showTime: 3.0 },
    medium: { testDuration: 240, questionCount: 10, digitCount: 8, showTime: 2.5 },
    hard:   { testDuration: 240, questionCount: 12, digitCount: 9, showTime: 2.0 }
  },
  directionsDistances: {
    easy:   { testDuration: 180, questionCount: 8 },
    medium: { testDuration: 150, questionCount: 12 },
    hard:   { testDuration: 120, questionCount: 16 }
  },
  dynamicProjection: {
    easy:   { testDuration: 180, questionCount: 8 },
    medium: { testDuration: 150, questionCount: 12 },
    hard:   { testDuration: 120, questionCount: 16 }
  },
  figuresLogisticsGroups: {
    easy:   { testDuration: 180, questionCount: 18 },
    medium: { testDuration: 240, questionCount: 30 },
    hard:   { testDuration: 300, questionCount: 45 }
  },
  cognitiveUpdating: {
    easy: {
      testDuration: 240, pressureDriftRate: 0.8, pumpFillRate: 1.2, fuelDrainRate: 0.7,
      speedDriftRate: 0.45, sensorEvents: 2, cameraEvents: 2, commsCodeCountdown: 90, commsCodeInterval: 60,
      dispenserLightMin: 7, dispenserLightMax: 11, missionResetMin: 30, missionResetMax: 48,
      missionLeadMin: 78, missionLeadMax: 105
    },
    medium: {
      testDuration: 180, pressureDriftRate: 1.2, pumpFillRate: 1.8, fuelDrainRate: 1.0,
      speedDriftRate: 0.75, sensorEvents: 3, cameraEvents: 3, commsCodeCountdown: 60, commsCodeInterval: 45,
      dispenserLightMin: 6, dispenserLightMax: 10, missionResetMin: 26, missionResetMax: 42,
      missionLeadMin: 72, missionLeadMax: 96
    },
    hard: {
      testDuration: 120, pressureDriftRate: 1.8, pumpFillRate: 2.4, fuelDrainRate: 1.35,
      speedDriftRate: 1.1, sensorEvents: 4, cameraEvents: 4, commsCodeCountdown: 45, commsCodeInterval: 30,
      dispenserLightMin: 5, dispenserLightMax: 9, missionResetMin: 22, missionResetMax: 36,
      missionLeadMin: 64, missionLeadMax: 86
    }
  },
  numericalOperations: {
    easy:   { testDuration: 90,  questionCount: 20 },
    medium: { testDuration: 90,  questionCount: 30 },
    hard:   { testDuration: 90,  questionCount: 40 }
  },
  situationalAwareness: {
    easy:   { testDuration: 300, questionCount: 8,  aircraftCount: 4 },
    medium: { testDuration: 240, questionCount: 10, aircraftCount: 6 },
    hard:   { testDuration: 180, questionCount: 12, aircraftCount: 8 }
  },
  sensoryMotor: {
    easy:   { testDuration: 60,  targetSpeed: 60,  reactionWindow: 1.5 },
    medium: { testDuration: 90,  targetSpeed: 100, reactionWindow: 1.2 },
    hard:   { testDuration: 120, targetSpeed: 150, reactionWindow: 0.9 }
  },
  rapidTracking: {
    easy:   { testDuration: 90,  targetSpeed: 60,  targetRadius: 40, objectTypes: 4, targetWindow: 18 },
    medium: { testDuration: 120, targetSpeed: 100, targetRadius: 30, objectTypes: 6, targetWindow: 15 },
    hard:   { testDuration: 150, targetSpeed: 150, targetRadius: 22, objectTypes: 8, targetWindow: 12 }
  },
  spatialIntegration: {
    easy:   { testDuration: 240, questionCount: 10, studyDuration: 24, questionsPerRound: 2 },
    medium: { testDuration: 180, questionCount: 14, studyDuration: 18, questionsPerRound: 3 },
    hard:   { testDuration: 150, questionCount: 18, studyDuration: 14, questionsPerRound: 3 }
  },
  systemLogic: {
    easy:   { testDuration: 600, questionCount: 8,  maxTabOpens: 30 },
    medium: { testDuration: 480, questionCount: 10, maxTabOpens: 40 },
    hard:   { testDuration: 360, questionCount: 12, maxTabOpens: 50 }
  },
  tableReading: {
    easy:   { testDuration: 180, questionCount: 12, gridSize: 8 },
    medium: { testDuration: 120, questionCount: 16, gridSize: 10 },
    hard:   { testDuration: 90,  questionCount: 20, gridSize: 12 }
  },
  targetRecognition: {
    easy:   { testDuration: 240, questionCount: 8,  distractorCount: 6 },
    medium: { testDuration: 240, questionCount: 12, distractorCount: 10 },
    hard:   { testDuration: 240, questionCount: 16, distractorCount: 14 }
  },
  traceTest: {
    easy:   { testDuration: 240, questionCount: 8 },
    medium: { testDuration: 180, questionCount: 12 },
    hard:   { testDuration: 150, questionCount: 16 }
  },
  traceTest2: {
    easy:   { testDuration: 240, questionCount: 4, aircraftCount: 2, animationDuration: 6 },
    medium: { testDuration: 240, questionCount: 6, aircraftCount: 3, animationDuration: 6 },
    hard:   { testDuration: 240, questionCount: 8, aircraftCount: 4, animationDuration: 6 }
  },
  verbalLogic: {
    easy:   { testDuration: 300, questionCount: 6 },
    medium: { testDuration: 420, questionCount: 10 },
    hard:   { testDuration: 600, questionCount: 14 }
  },
  vigilance: {
    easy:   { testDuration: 240, asteriskChance: 0.10, refreshInterval: 3.0 },
    medium: { testDuration: 300, asteriskChance: 0.08, refreshInterval: 2.0 },
    hard:   { testDuration: 360, asteriskChance: 0.06, refreshInterval: 1.5 }
  },
  visualSearch: {
    easy:   { testDuration: 180, questionCount: 10, distractorCount: 30 },
    medium: { testDuration: 150, questionCount: 14, distractorCount: 45 },
    hard:   { testDuration: 120, questionCount: 20, distractorCount: 60 }
  },
  visualisationTests: {
    easy:   { testDuration: 180, questionCount: 8 },
    medium: { testDuration: 150, questionCount: 12 },
    hard:   { testDuration: 120, questionCount: 16 }
  }
};

const ALL_MODULES = Object.keys(DEFAULT_SETTINGS);

export const getSettings = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (stored) {
      const parsed = JSON.parse(stored);
      const merged = {};
      ALL_MODULES.forEach(m => {
        merged[m] = {
          easy: { ...DEFAULT_SETTINGS[m].easy, ...(parsed[m]?.easy || {}) },
          medium: { ...DEFAULT_SETTINGS[m].medium, ...(parsed[m]?.medium || {}) },
          hard: { ...DEFAULT_SETTINGS[m].hard, ...(parsed[m]?.hard || {}) }
        };
      });
      return merged;
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }
  return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
};

export const saveSettings = (settings) => {
  try {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    return true;
  } catch (error) {
    console.error('Error saving settings:', error);
    return false;
  }
};

export const saveResult = (moduleName, mode, difficulty, result) => {
  try {
    const history = getHistory();
    const normalizedAccuracy = getResultAccuracy(result);
    const newResult = {
      id: Date.now().toString(),
      moduleName, mode, difficulty,
      timestamp: new Date().toISOString(),
      ...result,
      ...(normalizedAccuracy !== null ? { accuracy: normalizedAccuracy } : {})
    };
    history.push(newResult);
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
    notifyHistoryChanged();
    void syncAttempt(newResult).then(({ error }) => {
      if (error) console.warn('Cloud score sync unavailable:', error.message);
    }).catch((error) => {
      console.warn('Cloud score sync unavailable:', error.message);
    });
    return true;
  } catch (error) {
    console.error('Error saving result:', error);
    return false;
  }
};

export const getHistory = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.HISTORY);
    if (stored) return JSON.parse(stored);
  } catch (error) {
    console.error('Error loading history:', error);
  }
  return [];
};

export const getModuleHistory = (moduleName) => {
  return getHistory().filter(item => item.moduleName === moduleName);
};

export const mergeHistory = (incomingHistory) => {
  try {
    const merged = new Map();
    incomingHistory.forEach((item) => merged.set(String(item.id), item));
    getHistory().forEach((item) => merged.set(String(item.id), item));
    const history = Array.from(merged.values()).sort(
      (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
    );
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
    notifyHistoryChanged();
    return history;
  } catch (error) {
    console.error('Error merging history:', error);
    return getHistory();
  }
};

export const clearHistory = () => {
  try {
    localStorage.removeItem(STORAGE_KEYS.HISTORY);
    notifyHistoryChanged();
    void deleteAttempts().then(({ error }) => {
      if (error) console.warn('Cloud history could not be cleared:', error.message);
    }).catch((error) => {
      console.warn('Cloud history could not be cleared:', error.message);
    });
    return true;
  } catch (error) {
    console.error('Error clearing history:', error);
    return false;
  }
};

export const clearModuleHistory = (moduleName) => {
  try {
    const kept = getHistory().filter(item => item.moduleName !== moduleName);
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(kept));
    notifyHistoryChanged();
    void deleteAttempts(moduleName).then(({ error }) => {
      if (error) console.warn('Cloud module history could not be cleared:', error.message);
    }).catch((error) => {
      console.warn('Cloud module history could not be cleared:', error.message);
    });
    return true;
  } catch (error) {
    console.error('Error clearing module history:', error);
    return false;
  }
};

export const resetSettings = () => saveSettings(DEFAULT_SETTINGS);
