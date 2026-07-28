const DOMAIN_LABELS = {
  StrgcTM: 'Strategic Task Management',
  Percpt: 'Visual & Auditory Perception',
  'STM/C': 'Short Term Memory / Capacity',
  SpaR: 'Spatial Reasoning',
  SymR: 'Symbolic Reasoning',
  Psych: 'Psychomotor Ability',
  PA: 'Psychomotor Ability',
  CIP: 'Central Information Processing',
  VR: 'Verbal Reasoning',
  NR: 'Numerical Reasoning',
  SR: 'Spatial Reasoning',
  WR: 'Work Rate',
  AC: 'Attention Capability',
  'Prcpt-STM': 'Perception / Short Term Memory',
  'Strg-CIP': 'Strategic Task Management / Central Information Processing'
};

const moduleRef = (id, weight = 1, label = null) => ({ id, weight, label });
const externalRef = (label, weight = 1) => ({ id: null, weight, label });

const domain = (code, weight, tests, required, modules) => ({
  code,
  label: DOMAIN_LABELS[code] || code,
  weight,
  tests,
  required,
  modules
});

const role = ({
  id,
  organization,
  roleName,
  shortName,
  overallCutoff,
  domains,
  model = 'weighted-index',
  overallRows = [],
  note = ''
}) => ({
  id,
  organization,
  roleName,
  shortName: shortName || roleName,
  overallCutoff,
  domains,
  model,
  overallRows,
  note
});

const CUT = (weight = 1) => moduleRef('cognitive-updating', weight);
const SAT = (weight = 1) => moduleRef('situational-awareness', weight);
const TRT = (weight = 1) => moduleRef('target-recognition', weight);
const MATF = (weight = 1) => moduleRef('table-reading', weight);
const ACT = (weight = 1) => moduleRef('auditory-capacity', weight);
const TRAC2 = (weight = 1) => moduleRef('trace-test-2', weight);
const INSC = (weight = 1) => moduleRef('instrument-comprehension', weight);
const TRAC1 = (weight = 1) => moduleRef('trace-test', weight);
const SLT = (weight = 1) => moduleRef('system-logic', weight);
const ANT = (weight = 1) => moduleRef('airborne-numerical', weight);
const SMA = (weight = 1) => moduleRef('sensory-motor', weight);
const RTT = (weight = 1) => moduleRef('rapid-tracking', weight);
const CLAN = (weight = 1) => moduleRef('colours-letters-numbers', weight);
const FLAG = (weight = 1) => moduleRef('figures-logistics-groups', weight);
const SIT = (weight = 1) => moduleRef('spatial-integration', weight);
const DAD = (weight = 1) => moduleRef('directions-distances', weight);
const ABD = (weight = 1) => moduleRef('angles-bearings-degrees', weight);
const DPT = (weight = 1) => moduleRef('dynamic-projection', weight);
const VIG = (weight = 1) => moduleRef('vigilance', weight);
const RCOG = (weight = 1) => moduleRef('digit-recognition', weight);
const VLT = (weight = 1) => moduleRef('verbal-logic', weight);
const NOP = (weight = 1) => moduleRef('numerical-operations', weight);
const VISS = (weight = 1) => moduleRef('visual-search', weight);
const VISUALISATION = (weight = 1) => moduleRef('visualisation-tests', weight);

const RAF_PILOT_DOMAINS = [
  domain('StrgcTM', 15, '3(CUT), SAT', 4, [CUT(3), SAT()]),
  domain('Percpt', 15, 'TRT, MATF', 4, [TRT(), MATF()]),
  domain('STM/C', 12, '2(ACT), TRAC 2', 2, [ACT(2), TRAC2()]),
  domain('SpaR', 16, 'INSC, TRAC 1', 5, [INSC(), TRAC1()]),
  domain('SymR', 11, 'SLT, 3(ANT)', 4, [SLT(), ANT(3)]),
  domain('Psych', 16, 'SMA, RTT', 4, [SMA(), RTT()]),
  domain('CIP', 15, 'CLAN', 5, [CLAN()])
];

const RAF_WSO_DOMAINS = [
  domain('StrgcTM', 33, '2(CUT), SAT, SIT', 4, [CUT(2), SAT(), SIT()]),
  domain('Percpt', 13, '2(TRT), MATF', 4, [TRT(2), MATF()]),
  domain('STM/C', 8, 'ACT', 2, [ACT()]),
  domain('SpaR', 14, 'DAD, INSC', 4, [DAD(), INSC()]),
  domain('SymR', 17, 'SLT, ANT', 4, [SLT(), ANT()]),
  domain('Psych', 5, 'RTT', 4, [RTT()]),
  domain('CIP', 10, 'CLAN', 4, [CLAN()])
];

const ATCO_DOMAINS = [
  domain('StrgcTM', 49, '2(CUT), SAT', 3, [CUT(2), SAT()]),
  domain('Percpt', 14, 'MATF, TRT', 2, [MATF(), TRT()]),
  domain('STM/C', 8, '2(ACT), TRAC 2', 3, [ACT(2), TRAC2()]),
  domain('SpaR', 9, 'TRAC 1, 2(SIT)', 3, [TRAC1(), SIT(2)]),
  domain('SymR', 10, 'SLT, ANT', 2, [SLT(), ANT()]),
  domain('CIP', 10, 'CLAN', 3, [CLAN()])
];

const RAF_ROLES = [
  role({
    id: 'raf-pilot',
    organization: 'raf',
    roleName: 'Pilot',
    overallCutoff: 128,
    domains: RAF_PILOT_DOMAINS
  }),
  role({
    id: 'raf-rpas',
    organization: 'raf',
    roleName: 'Remotely Piloted Air System (RPAS)',
    shortName: 'RPAS',
    overallCutoff: 100,
    domains: [
      domain('StrgcTM', 30, '2(CUT), SAT', 4, [CUT(2), SAT()]),
      domain('Percpt', 12, 'MATF, TRT', 4, [MATF(), TRT()]),
      domain('STM/C', 9, '2(ACT), TRAC 2', 4, [ACT(2), TRAC2()]),
      domain('SpaR', 15, '2(INSC), SIT', 4, [INSC(2), SIT()]),
      domain('SymR', 10, '2(ANT), SLT', 4, [ANT(2), SLT()]),
      domain('Psych', 9, 'SMA, RTT', 4, [SMA(), RTT()]),
      domain('CIP', 15, 'CLAN', 5, [CLAN()])
    ]
  }),
  role({
    id: 'raf-wso',
    organization: 'raf',
    roleName: 'Weapon Systems Officer (WSO)',
    shortName: 'WSO',
    overallCutoff: 100,
    domains: RAF_WSO_DOMAINS
  }),
  role({
    id: 'raf-air-ops-control-1',
    organization: 'raf',
    roleName: 'Air Operations (Control) Officer 1',
    shortName: 'Air Ops Controller 1',
    overallCutoff: 80,
    domains: ATCO_DOMAINS
  }),
  role({
    id: 'raf-air-ops-control-2',
    organization: 'raf',
    roleName: 'Air Operations (Control) Officer 2',
    shortName: 'Air Ops Controller 2',
    overallCutoff: 90,
    domains: [
      domain('StrgcTM', 27, '3(CUT), TRAC 2', 3, [CUT(3), TRAC2()]),
      domain('Percpt', 18, 'TRT, MATF', 3, [TRT(), MATF()]),
      domain('STM/C', 9, 'ACT', 2, [ACT()]),
      domain('SpaR', 20, 'SIT, TRAC 1, ABD5, DPT', 4, [SIT(), TRAC1(), ABD(), DPT()]),
      domain('SymR', 9, 'SLT, ANT', 3, [SLT(), ANT()]),
      domain('CIP', 17, 'CLAN', 3, [CLAN()])
    ]
  }),
  role({
    id: 'raf-air-ops-systems',
    organization: 'raf',
    roleName: 'Air Operations Systems Officer',
    shortName: 'Air Ops Systems',
    overallCutoff: 90,
    domains: [
      domain('StrgcTM', 20, 'CUT, ACT', 3, [CUT(), ACT()]),
      domain('Percpt', 21, 'TRT, VIGIL_SPEED', 3, [TRT(), VIG()]),
      domain('STM/C', 11, '2(TRAC 2), RCOG', 2, [TRAC2(2), RCOG()]),
      domain('SpaR', 14, '2(TRAC 1), SIT', 3, [TRAC1(2), SIT()]),
      domain('SymR', 20, 'SAT, ANT', 3, [SAT(), ANT()]),
      domain('CIP', 14, 'FLAG', 3, [FLAG()])
    ]
  }),
  role({
    id: 'raf-intelligence-officer',
    organization: 'raf',
    roleName: 'Intelligence Officer',
    shortName: 'Int Off',
    overallCutoff: 95,
    domains: [
      domain('Percpt', 10, 'MATF, TRT', 3, [MATF(), TRT()]),
      domain('STM/C', 13, 'SAT', 4, [SAT()]),
      domain('SpaR', 25, 'DAD, SIT', 4, [DAD(), SIT()]),
      domain('SymR', 41, 'SLT, VLT', 5, [SLT(), VLT()]),
      domain('CIP', 11, 'FLAG', 4, [FLAG()])
    ]
  }),
  role({
    id: 'raf-wsop-linguist',
    organization: 'raf',
    roleName: 'Weapon Systems Operator (Linguist)',
    shortName: 'WSOp (L)',
    overallCutoff: 90,
    domains: [
      domain('VR', 20, 'VLT', 5, [VLT()]),
      domain('NR', 7, 'SLT, NOP', 3, [SLT(), NOP()]),
      domain('SR', 22, 'ABD5, DAD', 3, [ABD(), DAD()]),
      domain('WR', 22, 'MATF, TRT', 3, [MATF(), TRT()]),
      domain('AC', 29, '2(FLAG), RCOG', 3, [FLAG(2), RCOG()])
    ]
  }),
  role({
    id: 'raf-wsop-isr',
    organization: 'raf',
    roleName: 'Weapon Systems Operator (ISR)',
    shortName: 'WSOp (ISR)',
    overallCutoff: 90,
    domains: [
      domain('StrgcTM', 9, 'CUT', 3, [CUT()]),
      domain('Percpt', 20, '2(TRT), VISS', 4, [TRT(2), VISS()]),
      domain('STM/C', 16, 'ACT, SIT', 2, [ACT(), SIT()]),
      domain('SpaR', 22, 'ABD5, DAD, TRAC 1', 4, [ABD(), DAD(), TRAC1()]),
      domain('SymR', 22, 'ANT, SLT', 5, [ANT(), SLT()]),
      domain('CIP', 11, 'FLAG', 4, [FLAG()])
    ]
  }),
  role({
    id: 'raf-wsop-rw',
    organization: 'raf',
    roleName: 'Weapon Systems Operator (Rotary Wing)',
    shortName: 'WSOp (RW)',
    overallCutoff: 90,
    domains: [
      domain('StrgcTM', 14, 'CUT', 3, [CUT()]),
      domain('Percpt', 20, '2(TRT), MATF', 4, [TRT(2), MATF()]),
      domain('STM/C', 16, '2(ACT), SIT', 2, [ACT(2), SIT()]),
      domain('SpaR', 22, 'TRAC 1, DAD', 4, [TRAC1(), DAD()]),
      domain('SymR', 14, 'ANT', 2, [ANT()]),
      domain('CIP', 14, 'FLAG', 2, [FLAG()])
    ]
  }),
  role({
    id: 'raf-wsop-me',
    organization: 'raf',
    roleName: 'Weapon Systems Operator (Mission Equipment)',
    shortName: 'WSOp (ME)',
    overallCutoff: 90,
    domains: [
      domain('Prcpt-STM', 44, '2(MATF), TRT, 2(CUT)', 4, [MATF(2), TRT(), CUT(2)]),
      domain('SpaR', 11, 'DAD, GSPA', 3, [DAD(), externalRef('GSPA')]),
      domain('SymR', 36, 'SLT, VLT', 4, [SLT(), VLT()]),
      domain('Strg-CIP', 9, 'FLAG', 3, [FLAG()])
    ],
    note: 'GSPA is named by the guide but is not identified or implemented in this trainer.'
  })
];

const NAVY_ROLES = [
  role({
    id: 'navy-pilot',
    organization: 'navy',
    roleName: 'Pilot',
    overallCutoff: 128,
    domains: RAF_PILOT_DOMAINS,
    note: 'The guide states that Royal Navy Pilot requirements are identical to RAF Pilot.'
  }),
  role({
    id: 'navy-wso',
    organization: 'navy',
    roleName: 'Weapon Systems Officer',
    shortName: 'WSO',
    overallCutoff: 100,
    domains: RAF_WSO_DOMAINS,
    note: 'The guide states that Royal Navy WSO requirements are identical to RAF WSO.'
  }),
  role({
    id: 'navy-observer',
    organization: 'navy',
    roleName: 'Observer',
    overallCutoff: 100,
    domains: [
      domain('VR', 16, 'SLT', 3, [SLT()]),
      domain('NR', 24, 'MATB 2 (ANT)', 4, [ANT()]),
      domain('SR', 16, 'TRAC 1, ABD4', 4, [TRAC1(), ABD()]),
      domain('WR', 22, 'VIG1, MATF', 4, [VIG(), MATF()]),
      domain('AC', 22, 'TRAC 2, CLAN', 5, [TRAC2(), CLAN()])
    ]
  }),
  role({
    id: 'navy-atco',
    organization: 'navy',
    roleName: 'Air Traffic Control Officer (ATCO)',
    shortName: 'ATCO',
    overallCutoff: 100,
    domains: ATCO_DOMAINS
  })
];

const CFAST_DOMAINS = [
  domain('StrgcTM', null, 'Not published', 4, [CUT(), SAT()]),
  domain('Percpt', null, 'Not published', 4, [TRT(), MATF(), VIG(), VISS()]),
  domain('STM/C', null, 'Not published', 2, [ACT(), TRAC2(), RCOG()]),
  domain('SpaR', null, 'Not published', 5, [DAD(), INSC(), SIT(), TRAC1(), ABD(), VISUALISATION()]),
  domain('SymR', null, 'Not published', 4, [SLT(), ANT(), VLT(), NOP()]),
  domain('CIP', null, 'Not published', 5, [FLAG(), DPT()]),
  domain('PA', null, 'Not published', 4, [SMA(), RTT()])
];

const CFAST_ROLES = [
  role({
    id: 'cfast-pilot',
    organization: 'cfast',
    roleName: 'Pilot (PLT)',
    model: 'cfast-stanine',
    overallCutoff: 4,
    overallRows: [{ id: 'total', label: 'Total Score', required: 4 }],
    domains: CFAST_DOMAINS,
    note: 'CFAST does not publish the tests used for each domain. Domain-to-module mappings in this trainer are inferred.'
  }),
  role({
    id: 'cfast-acso',
    organization: 'cfast',
    roleName: 'Air Combat Systems Officer',
    shortName: 'ACSO',
    model: 'cfast-stanine',
    overallCutoff: 4,
    overallRows: [{ id: 'total', label: 'Total Score', required: 4 }],
    domains: [],
    note: 'The guide publishes only the overall cutoff and does not name the contributing tests.'
  }),
  role({
    id: 'cfast-aec',
    organization: 'cfast',
    roleName: 'Aerospace Control (AEC)',
    shortName: 'AEC',
    model: 'cfast-stanine',
    overallCutoff: 4,
    overallRows: [
      { id: 'total-1', label: 'Total Score 1', required: 4 },
      { id: 'total-2', label: 'Total Score 2', required: 4 }
    ],
    domains: [],
    note: 'The guide publishes two overall cutoffs but does not identify how the two scores are composed.'
  })
];

export const SCORE_ORGANIZATIONS = [
  { id: 'cfast', label: 'Canadian Forces (CFAST)' },
  { id: 'raf', label: 'Royal Air Force (CBAT)' },
  { id: 'navy', label: 'Royal Navy (FAA)' }
];

export const SCORE_CRITERIA = [
  ...CFAST_ROLES,
  ...RAF_ROLES,
  ...NAVY_ROLES
];

export const SCORE_CRITERIA_BY_ID = Object.fromEntries(
  SCORE_CRITERIA.map((criterion) => [criterion.id, criterion])
);

export const CFAST_TOTAL_MODULE_IDS = [
  'airborne-numerical',
  'angles-bearings-degrees',
  'auditory-capacity',
  'cognitive-updating',
  'digit-recognition',
  'directions-distances',
  'dynamic-projection',
  'figures-logistics-groups',
  'instrument-comprehension',
  'numerical-operations',
  'rapid-tracking',
  'sensory-motor',
  'situational-awareness',
  'spatial-integration',
  'system-logic',
  'table-reading',
  'target-recognition',
  'trace-test',
  'trace-test-2',
  'verbal-logic',
  'vigilance',
  'visual-search',
  'visualisation-tests'
];
