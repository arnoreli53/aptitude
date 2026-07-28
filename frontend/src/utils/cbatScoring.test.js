import { MODULE_BY_ID } from '../constants/modules';
import { SCORE_CRITERIA, SCORE_CRITERIA_BY_ID } from '../data/cbatScoreRequirements';
import {
  buildModuleScoreMap,
  calculateCriteriaScore,
  getResultAccuracy,
  scoreToEstimatedStanine
} from './cbatScoring';

describe('CBAT training score normalization', () => {
  test('reads accuracy and legacy overallScore values safely', () => {
    expect(getResultAccuracy({ accuracy: 72.5 })).toBe(72.5);
    expect(getResultAccuracy({ overallScore: 64 })).toBe(64);
    expect(getResultAccuracy({ accuracy: 130 })).toBe(100);
    expect(getResultAccuracy({ accuracy: -10 })).toBe(0);
    expect(getResultAccuracy({ accuracy: null })).toBeNull();
    expect(getResultAccuracy({})).toBeNull();
  });

  test('maps normalized percentages into nine equal training bands', () => {
    expect(scoreToEstimatedStanine(null)).toBeNull();
    expect(scoreToEstimatedStanine(0)).toBe(1);
    expect(scoreToEstimatedStanine(11.11)).toBe(1);
    expect(scoreToEstimatedStanine(11.12)).toBe(2);
    expect(scoreToEstimatedStanine(50)).toBe(5);
    expect(scoreToEstimatedStanine(89)).toBe(9);
    expect(scoreToEstimatedStanine(100)).toBe(9);
  });

  test('supports latest, best, and recent-three assessment bases', () => {
    const history = [
      { moduleName: 'Airborne Numerical', mode: 'assessment', accuracy: 40, timestamp: '2026-01-01T00:00:00Z' },
      { moduleName: 'Airborne Numerical', mode: 'assessment', accuracy: 60, timestamp: '2026-02-01T00:00:00Z' },
      { moduleName: 'Airborne Numerical', mode: 'assessment', accuracy: 80, timestamp: '2026-03-01T00:00:00Z' },
      { moduleName: 'Airborne Numerical', mode: 'practice', accuracy: 100, timestamp: '2026-04-01T00:00:00Z' }
    ];

    expect(buildModuleScoreMap(history, 'latest')['airborne-numerical'].accuracy).toBe(80);
    expect(buildModuleScoreMap(history, 'best')['airborne-numerical'].accuracy).toBe(80);
    expect(buildModuleScoreMap(history, 'recent3')['airborne-numerical'].accuracy).toBe(60);
  });
});

describe('CBAT criteria data and role calculations', () => {
  test('all weighted role matrices total 100 and reference valid modules', () => {
    SCORE_CRITERIA
      .filter((criterion) => criterion.model === 'weighted-index')
      .forEach((criterion) => {
        expect(criterion.domains.reduce((sum, domain) => sum + domain.weight, 0)).toBe(100);
        criterion.domains.forEach((domain) => {
          expect(domain.required).toBeGreaterThanOrEqual(1);
          expect(domain.required).toBeLessThanOrEqual(9);
          domain.modules.filter((module) => module.id).forEach((module) => {
            expect(MODULE_BY_ID[module.id]).toBeDefined();
          });
        });
      });
  });

  test('calculates the published weighted index formula', () => {
    const criterion = {
      id: 'test-role',
      model: 'weighted-index',
      overallCutoff: 100,
      note: '',
      domains: [
        {
          code: 'A',
          label: 'A',
          weight: 50,
          tests: 'ANT',
          required: 4,
          modules: [{ id: 'airborne-numerical', weight: 1 }]
        },
        {
          code: 'B',
          label: 'B',
          weight: 50,
          tests: 'SLT',
          required: 4,
          modules: [{ id: 'system-logic', weight: 1 }]
        }
      ]
    };
    const moduleScores = {
      'airborne-numerical': { accuracy: 75, stanine: 7 },
      'system-logic': { accuracy: 55, stanine: 5 }
    };
    const score = calculateCriteriaScore(criterion, moduleScores);

    expect(score.domains.map((domain) => domain.achieved)).toEqual([7, 5]);
    expect(score.overall).toBe(120);
    expect(score.status).toBe('meets');
  });

  test('does not produce a weighted index when an aptitude domain has no data', () => {
    const criterion = SCORE_CRITERIA_BY_ID['raf-pilot'];
    const score = calculateCriteriaScore(criterion, {
      'airborne-numerical': { accuracy: 80, stanine: 8 }
    });
    expect(score.overall).toBeNull();
    expect(score.status).toBe('insufficient');
  });

  test('calculates a CFAST pilot estimate when every inferred domain has data', () => {
    const criterion = SCORE_CRITERIA_BY_ID['cfast-pilot'];
    const moduleScores = {};
    criterion.domains.forEach((domain) => {
      domain.modules.forEach((module) => {
        moduleScores[module.id] = { accuracy: 70, stanine: 7 };
      });
    });
    const score = calculateCriteriaScore(criterion, moduleScores);
    expect(score.overall).toBe(7);
    expect(score.status).toBe('meets');
    expect(score.domains.every((domain) => domain.achieved === 7)).toBe(true);
  });
});

