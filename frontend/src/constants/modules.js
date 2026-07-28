export const MODULE_CATEGORIES = {
  REASONING: '#0000B0',
  SPATIAL: '#006000',
  MEMORY: '#806000',
  MULTITASK: '#800000',
  PSYCHOMOTOR: '#600080',
  ATTENTION: '#008080'
};

export const MODULES = [
  { id: 'airborne-numerical', name: 'Airborne Numerical', category: 'REASONING', settingsKey: 'airborneNumerical' },
  { id: 'angles-bearings-degrees', name: 'Angles, Bearings & Degrees', category: 'SPATIAL', settingsKey: 'anglesBearingsDegrees' },
  { id: 'auditory-capacity', name: 'Auditory Capacity', category: 'MEMORY', settingsKey: 'auditoryCapacity' },
  { id: 'cognitive-updating', name: 'Cognitive Updating', category: 'MULTITASK', settingsKey: 'cognitiveUpdating' },
  { id: 'colours-letters-numbers', name: 'Colours, Letters & Numbers', category: 'MULTITASK', settingsKey: 'coloursLettersNumbers' },
  { id: 'digit-recognition', name: 'Digit Recognition', category: 'MEMORY', settingsKey: 'digitRecognition' },
  { id: 'directions-distances', name: 'Directions and Distances', category: 'SPATIAL', settingsKey: 'directionsDistances' },
  { id: 'dynamic-projection', name: 'Dynamic Projection', category: 'MULTITASK', settingsKey: 'dynamicProjection' },
  { id: 'figures-logistics-groups', name: 'Figures, Logistics and Groups', category: 'MULTITASK', settingsKey: 'figuresLogisticsGroups' },
  { id: 'instrument-comprehension', name: 'Instrument Comprehension', category: 'SPATIAL', settingsKey: 'instrumentComprehension' },
  { id: 'mathematics-reasoning', name: 'Mathematics Reasoning', category: 'REASONING', settingsKey: 'mathematicsReasoning' },
  { id: 'numerical-operations', name: 'Numerical Operations', category: 'REASONING', settingsKey: 'numericalOperations' },
  { id: 'rapid-tracking', name: 'Rapid Tracking', category: 'PSYCHOMOTOR', settingsKey: 'rapidTracking' },
  { id: 'sensory-motor', name: 'Sensory Motor Apparatus', category: 'PSYCHOMOTOR', settingsKey: 'sensoryMotor' },
  { id: 'situational-awareness', name: 'Situational Awareness', category: 'MULTITASK', settingsKey: 'situationalAwareness' },
  { id: 'spatial-integration', name: 'Spatial Integration', category: 'SPATIAL', settingsKey: 'spatialIntegration' },
  { id: 'system-logic', name: 'System Logic', category: 'REASONING', settingsKey: 'systemLogic' },
  { id: 'table-reading', name: 'Table Reading', category: 'REASONING', settingsKey: 'tableReading' },
  { id: 'target-recognition', name: 'Target Recognition', category: 'MULTITASK', settingsKey: 'targetRecognition' },
  { id: 'trace-test', name: 'Trace Test 1', category: 'SPATIAL', settingsKey: 'traceTest' },
  { id: 'trace-test-2', name: 'Trace Test 2', category: 'SPATIAL', settingsKey: 'traceTest2' },
  { id: 'verbal-logic', name: 'Verbal Logic', category: 'REASONING', settingsKey: 'verbalLogic' },
  { id: 'vigilance', name: 'Vigilance', category: 'ATTENTION', settingsKey: 'vigilance' },
  { id: 'visual-search', name: 'Visual Search', category: 'ATTENTION', settingsKey: 'visualSearch' },
  { id: 'visualisation-tests', name: 'Visualisation Tests', category: 'SPATIAL', settingsKey: 'visualisationTests' }
];

export const MODULE_BY_ID = Object.fromEntries(MODULES.map((module) => [module.id, module]));
export const MODULE_BY_SETTINGS_KEY = Object.fromEntries(MODULES.map((module) => [module.settingsKey, module]));
