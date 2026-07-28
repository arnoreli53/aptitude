import { MODULES, MODULE_BY_ID } from '../constants/modules';
import { CFAST_TOTAL_MODULE_IDS } from '../data/cbatScoreRequirements';

export const SCORE_BASIS_OPTIONS = [
  { id: 'recent3', label: 'Recent 3 assessment average' },
  { id: 'latest', label: 'Latest assessment' },
  { id: 'best', label: 'Best assessment' }
];

const clampPercent = (value) => Math.min(100, Math.max(0, Number(value)));
const isNumericScore = (value) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));

export const getResultAccuracy = (result) => {
  if (isNumericScore(result?.accuracy)) return clampPercent(result.accuracy);
  if (isNumericScore(result?.overallScore)) return clampPercent(result.overallScore);
  return null;
};

export const scoreToEstimatedStanine = (score) => {
  if (!isNumericScore(score)) return null;
  const normalized = clampPercent(score);
  return Math.min(9, Math.max(1, Math.ceil(normalized / (100 / 9))));
};

const scoreAttempts = (attempts, basis) => {
  const scored = attempts
    .filter((attempt) => attempt.mode === 'assessment')
    .map((attempt) => ({ ...attempt, normalizedAccuracy: getResultAccuracy(attempt) }))
    .filter((attempt) => attempt.normalizedAccuracy !== null)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  if (!scored.length) return null;

  let selected;
  if (basis === 'best') {
    selected = [scored.reduce((best, attempt) => (
      attempt.normalizedAccuracy > best.normalizedAccuracy ? attempt : best
    ))];
  } else if (basis === 'latest') {
    selected = scored.slice(0, 1);
  } else {
    selected = scored.slice(0, 3);
  }

  const accuracy = selected.reduce((sum, attempt) => sum + attempt.normalizedAccuracy, 0) / selected.length;
  return {
    accuracy,
    stanine: scoreToEstimatedStanine(accuracy),
    usedAttempts: selected.length,
    assessmentAttempts: scored.length,
    latestTimestamp: scored[0].timestamp
  };
};

export const buildModuleScoreMap = (history, basis = 'recent3') => {
  const scoreMap = {};
  MODULES.forEach((module) => {
    const attempts = history.filter((attempt) => attempt.moduleName === module.name);
    const score = scoreAttempts(attempts, basis);
    if (score) scoreMap[module.id] = { ...score, module };
  });
  return scoreMap;
};

const refKey = (ref) => ref.id || `external:${ref.label}`;

const describeRef = (ref) => {
  if (ref.id && MODULE_BY_ID[ref.id]) {
    return { id: ref.id, label: MODULE_BY_ID[ref.id].name, external: false };
  }
  return { id: null, label: ref.label || ref.id || 'Unmapped test', external: true };
};

export const calculateDomainScore = (domain, moduleScores) => {
  let weightedTotal = 0;
  let availableWeight = 0;
  const missing = [];
  const contributions = [];

  domain.modules.forEach((ref) => {
    const score = ref.id ? moduleScores[ref.id] : null;
    const descriptor = describeRef(ref);
    if (!score) {
      missing.push(descriptor);
      return;
    }
    weightedTotal += score.accuracy * ref.weight;
    availableWeight += ref.weight;
    contributions.push({
      ...descriptor,
      weight: ref.weight,
      accuracy: score.accuracy,
      stanine: score.stanine,
      assessmentAttempts: score.assessmentAttempts,
      usedAttempts: score.usedAttempts
    });
  });

  const accuracy = availableWeight ? weightedTotal / availableWeight : null;
  const achieved = scoreToEstimatedStanine(accuracy);
  return {
    ...domain,
    accuracy,
    achieved,
    meets: achieved !== null ? achieved >= domain.required : null,
    complete: missing.length === 0,
    contributions,
    missing
  };
};

const calculateTotalTrainingStanine = (moduleScores, moduleIds = CFAST_TOTAL_MODULE_IDS) => {
  const available = moduleIds.map((id) => moduleScores[id]).filter(Boolean);
  if (!available.length) return { accuracy: null, stanine: null, available: 0, total: moduleIds.length };
  const accuracy = available.reduce((sum, score) => sum + score.accuracy, 0) / available.length;
  return {
    accuracy,
    stanine: scoreToEstimatedStanine(accuracy),
    available: available.length,
    total: moduleIds.length
  };
};

const uniqueRefs = (domains) => {
  const refs = new Map();
  domains.forEach((domain) => {
    domain.modules.forEach((ref) => {
      if (!refs.has(refKey(ref))) refs.set(refKey(ref), ref);
    });
  });
  return [...refs.values()];
};

const buildCoverage = (refs, moduleScores) => {
  const available = refs.filter((ref) => ref.id && moduleScores[ref.id]);
  const missing = refs
    .filter((ref) => !ref.id || !moduleScores[ref.id])
    .map(describeRef);
  return {
    available: available.length,
    total: refs.length,
    complete: missing.length === 0,
    missing
  };
};

export const calculateCriteriaScore = (criterion, moduleScores) => {
  const domains = criterion.domains.map((item) => calculateDomainScore(item, moduleScores));
  const requiredRefs = criterion.domains.length
    ? uniqueRefs(criterion.domains)
    : CFAST_TOTAL_MODULE_IDS.map((id) => ({ id, weight: 1 }));
  const coverage = buildCoverage(requiredRefs, moduleScores);

  if (criterion.model === 'cfast-stanine') {
    const availableDomains = domains.filter((item) => item.achieved !== null);
    const totalTraining = calculateTotalTrainingStanine(moduleScores);
    const overallStanine = domains.length
      ? (availableDomains.length
        ? Math.round(availableDomains.reduce((sum, item) => sum + item.achieved, 0) / availableDomains.length)
        : null)
      : totalTraining.stanine;
    const totalRows = criterion.overallRows.map((row) => ({
      ...row,
      achieved: overallStanine,
      meets: overallStanine !== null ? overallStanine >= row.required : null
    }));
    const hasEveryDomain = domains.every((item) => item.achieved !== null);
    const hasOverall = totalRows.every((row) => row.achieved !== null);
    const enoughData = hasOverall && (!domains.length || hasEveryDomain);
    const meets = enoughData
      ? totalRows.every((row) => row.meets) && domains.every((item) => item.meets)
      : null;
    return {
      criterion,
      domains,
      totalRows,
      overall: overallStanine,
      overallLabel: 'Estimated total stanine',
      meets,
      status: meets === null ? 'insufficient' : meets ? 'meets' : 'below',
      provisional: !coverage.complete || criterion.note.length > 0,
      coverage
    };
  }

  const scoredDomains = domains.filter((item) => item.achieved !== null);
  const overall = scoredDomains.length === domains.length
    ? domains.reduce((sum, item) => sum + item.achieved * item.weight, 0) / 5
    : null;
  const enoughData = overall !== null;
  const meets = enoughData
    ? overall >= criterion.overallCutoff && domains.every((item) => item.meets)
    : null;

  return {
    criterion,
    domains,
    totalRows: [],
    overall,
    overallLabel: 'Estimated index',
    meets,
    status: meets === null ? 'insufficient' : meets ? 'meets' : 'below',
    provisional: !coverage.complete,
    coverage
  };
};
