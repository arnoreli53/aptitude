import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MODULE_BY_ID } from '../constants/modules';
import {
  CFAST_TOTAL_MODULE_IDS,
  SCORE_CRITERIA,
  SCORE_CRITERIA_BY_ID,
  SCORE_ORGANIZATIONS
} from '../data/cbatScoreRequirements';
import { cbtFont, CFASTButton } from '../modules/cbtCommon';
import { getHistory } from '../utils/storage';
import {
  SCORE_BASIS_OPTIONS,
  buildModuleScoreMap,
  calculateCriteriaScore
} from '../utils/cbatScoring';

const statusPresentation = {
  meets: {
    label: 'MEETS TRAINING ESTIMATE',
    className: 'border-[#08752f] bg-[#e9f7ee] text-[#075523]'
  },
  below: {
    label: 'BELOW SELECTED REQUIREMENTS',
    className: 'border-[#a11616] bg-[#fff0f0] text-[#871111]'
  },
  insufficient: {
    label: 'MORE ASSESSMENTS NEEDED',
    className: 'border-[#9a7100] bg-[#fff8dd] text-[#705100]'
  }
};

const formatScore = (value, digits = 1) => (
  Number.isFinite(value) ? value.toFixed(digits) : '--'
);

const StanineTrack = ({ achieved, required, testId }) => (
  <div
    className="relative h-8 min-w-[360px] overflow-hidden bg-white"
    data-testid={testId}
    aria-label={`Estimated stanine ${achieved ?? 'not available'}; required stanine ${required}`}
  >
    {achieved !== null && achieved !== undefined && (
      <div
        className="absolute inset-y-1 left-0 bg-[#147230]"
        style={{ width: `${(achieved / 9) * 100}%` }}
        data-testid={`${testId}-achieved`}
      />
    )}
    <div className="absolute inset-0 grid grid-cols-9">
      {Array.from({ length: 9 }, (_, index) => (
        <div key={index} className="border-r border-black last:border-r-0" />
      ))}
    </div>
    <div
      className="absolute inset-y-0 z-10 w-[3px] bg-[#e00000]"
      style={{ left: `calc(${((required - 1) / 9) * 100}% - 1px)` }}
      data-testid={`${testId}-required`}
    />
  </div>
);

const StanineHeading = () => (
  <div>
    <div className="border-b border-black py-1">Stanine</div>
    <div className="grid grid-cols-9">
      {Array.from({ length: 9 }, (_, index) => (
        <span key={index} className="border-r border-black py-1 font-normal last:border-r-0">{index + 1}</span>
      ))}
    </div>
  </div>
);

const ResultValue = ({ achieved, required }) => {
  if (achieved === null || achieved === undefined) return <span className="text-[#666666]">--</span>;
  return (
    <span className={achieved >= required ? 'font-bold text-[#075523]' : 'font-bold text-[#a11616]'}>
      {achieved} / {required}
    </span>
  );
};

const CfastScoreChart = ({ score }) => {
  const rows = [
    ...score.totalRows.map((row) => ({ ...row, code: row.label, label: row.label, isTotal: true })),
    ...score.domains
  ];

  return (
    <div className="overflow-x-auto border-2 border-black bg-white">
      <table className="w-full min-w-[780px] border-collapse text-sm text-black" data-testid="score-requirements-chart">
        <thead>
          <tr className="bg-white">
            <th className="w-[220px] border-b-2 border-r border-black px-2 py-1">Battery</th>
            <th className="w-[280px] border-b-2 border-r border-black px-2 py-1">Domain</th>
            <th className="border-b-2 border-r border-black p-0"><StanineHeading /></th>
            <th className="w-[90px] border-b-2 border-black px-2 py-1">Estimate</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row.code}-${index}`} className={row.isTotal ? 'border-b-2 border-black' : 'border-b border-[#b0b0b0]'}>
              {index === 0 && (
                <th rowSpan={rows.length} className="border-r border-black px-2 py-2 text-left align-top font-normal">
                  {score.criterion.roleName}
                </th>
              )}
              <td className="border-r border-black px-2 py-2">
                <div className="font-bold">{row.code}</div>
                {!row.isTotal && <div className="text-xs text-[#555555]">{row.label}</div>}
              </td>
              <td className="border-r border-black p-0">
                <StanineTrack achieved={row.achieved} required={row.required} testId={`stanine-${row.code.replace(/[^A-Za-z0-9]/g, '-')}`} />
              </td>
              <td className="px-2 py-2 text-center"><ResultValue achieved={row.achieved} required={row.required} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const WeightedScoreChart = ({ score }) => (
  <div className="overflow-x-auto border-2 border-black bg-white">
    <table className="w-full min-w-[1120px] border-collapse text-[13px] text-black" data-testid="score-requirements-chart">
      <thead>
        <tr className="bg-white">
          <th className="w-[170px] border-b-2 border-r border-black px-2 py-1">Battery</th>
          <th className="w-[190px] border-b-2 border-r border-black px-2 py-1">Domain</th>
          <th className="w-[70px] border-b-2 border-r border-black px-2 py-1">Weight</th>
          <th className="w-[230px] border-b-2 border-r border-black px-2 py-1">Tests</th>
          <th className="border-b-2 border-r border-black p-0"><StanineHeading /></th>
          <th className="w-[105px] border-b-2 border-r border-black px-2 py-1">Index</th>
          <th className="w-[85px] border-b-2 border-black px-2 py-1">Estimate</th>
        </tr>
      </thead>
      <tbody>
        {score.domains.map((row, index) => (
          <tr key={row.code} className="border-b border-[#b0b0b0] last:border-b-0" data-testid={`score-domain-${row.code}`}>
            {index === 0 && (
              <th rowSpan={score.domains.length} className="border-r border-black px-2 py-2 text-left align-top font-normal">
                {score.criterion.shortName}
              </th>
            )}
            <td className="border-r border-black px-2 py-2">
              <div className="font-bold">{row.code}</div>
              <div className="text-[11px] leading-tight text-[#555555]">{row.label}</div>
            </td>
            <td className="border-r border-black px-2 py-2 text-center">{row.weight}x</td>
            <td className="border-r border-black px-2 py-2 font-mono">{row.tests}</td>
            <td className="border-r border-black p-0">
              <StanineTrack achieved={row.achieved} required={row.required} testId={`stanine-${row.code.replace(/[^A-Za-z0-9]/g, '-')}`} />
            </td>
            {index === 0 && (
              <td rowSpan={score.domains.length} className="border-r border-black px-2 py-2 align-top">
                <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                  <span>Cutoff</span>
                  <strong className="text-right">{score.criterion.overallCutoff}</strong>
                  <span>Current</span>
                  <strong className="text-right" data-testid="score-current-index">
                    {formatScore(score.overall, 0)}
                  </strong>
                </div>
              </td>
            )}
            <td className="px-2 py-2 text-center"><ResultValue achieved={row.achieved} required={row.required} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const SummaryStrip = ({ score }) => {
  const presentation = statusPresentation[score.status];
  const metDomains = score.domains.filter((domain) => domain.meets).length;
  return (
    <div className="grid grid-cols-1 border border-black bg-white text-black sm:grid-cols-4">
      <div className={`border-b p-3 sm:border-b-0 sm:border-r ${presentation.className}`}>
        <div className="text-[10px] font-bold">STATUS</div>
        <div className="mt-1 text-sm font-bold" data-testid="score-status">{presentation.label}</div>
      </div>
      <div className="border-b border-black p-3 sm:border-b-0 sm:border-r">
        <div className="text-[10px] text-[#555555]">{score.overallLabel.toUpperCase()}</div>
        <div className="mt-1 font-mono text-2xl font-bold" data-testid="score-overall">
          {score.criterion.model === 'cfast-stanine' ? formatScore(score.overall, 0) : formatScore(score.overall, 0)}
          <span className="ml-1 text-sm font-normal text-[#555555]">/ {score.criterion.overallCutoff}</span>
        </div>
      </div>
      <div className="border-b border-black p-3 sm:border-b-0 sm:border-r">
        <div className="text-[10px] text-[#555555]">DOMAINS AT REQUIREMENT</div>
        <div className="mt-1 font-mono text-2xl font-bold">
          {metDomains} / {score.domains.length || '--'}
        </div>
      </div>
      <div className="p-3">
        <div className="text-[10px] text-[#555555]">ASSESSMENT COVERAGE</div>
        <div className="mt-1 font-mono text-2xl font-bold" data-testid="score-coverage">
          {score.coverage.available} / {score.coverage.total}
        </div>
      </div>
    </div>
  );
};

const modulesForCriterion = (criterion) => {
  const ids = criterion.domains.length
    ? criterion.domains.flatMap((domain) => domain.modules.map((module) => module.id).filter(Boolean))
    : CFAST_TOTAL_MODULE_IDS;
  return [...new Set(ids)];
};

const ContributionTable = ({ criterion, score, moduleScores, onOpenModule }) => {
  const moduleIds = modulesForCriterion(criterion);
  return (
    <div className="border border-[#4444AA] bg-[#000018]">
      <div className="border-b border-[#4444AA] bg-[#0000B0] px-3 py-1 text-xs font-bold text-white">
        Module Contributions
      </div>
      <div className="max-h-[390px] overflow-auto">
        <table className="w-full min-w-[720px] border-collapse text-xs text-white">
          <thead className="sticky top-0 bg-[#000050]">
            <tr>
              <th className="border-r border-[#4444AA] px-2 py-2 text-left">Module</th>
              <th className="border-r border-[#4444AA] px-2 py-2 text-right">Training Score</th>
              <th className="border-r border-[#4444AA] px-2 py-2 text-center">Est. Stanine</th>
              <th className="border-r border-[#4444AA] px-2 py-2 text-left">Used In</th>
              <th className="px-2 py-2 text-center">Assessment Data</th>
            </tr>
          </thead>
          <tbody>
            {moduleIds.map((moduleId, index) => {
              const module = MODULE_BY_ID[moduleId];
              const moduleScore = moduleScores[moduleId];
              const domains = score.domains
                .filter((domain) => domain.modules.some((ref) => ref.id === moduleId))
                .map((domain) => domain.code)
                .join(', ');
              return (
                <tr key={moduleId} className={index % 2 ? 'bg-[#001030]' : 'bg-black'}>
                  <td className="border-r border-[#222266] px-2 py-2">{module?.name || moduleId}</td>
                  <td className="border-r border-[#222266] px-2 py-2 text-right font-mono">
                    {moduleScore ? `${moduleScore.accuracy.toFixed(1)}%` : '--'}
                  </td>
                  <td className="border-r border-[#222266] px-2 py-2 text-center font-mono">
                    {moduleScore?.stanine || '--'}
                  </td>
                  <td className="border-r border-[#222266] px-2 py-2">{domains || 'Overall estimate'}</td>
                  <td className="px-2 py-1 text-center">
                    {moduleScore
                      ? `${moduleScore.usedAttempts} of ${moduleScore.assessmentAttempts}`
                      : (
                        <button
                          type="button"
                          onClick={() => onOpenModule(moduleId)}
                          className="border border-[#7777bb] bg-[#0000a0] px-3 py-1 text-white hover:bg-[#0000cc]"
                        >
                          Start assessment
                        </button>
                      )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const ScoreView = () => {
  const navigate = useNavigate();
  const [history] = useState(() => getHistory());
  const [organizationId, setOrganizationId] = useState('cfast');
  const [criterionId, setCriterionId] = useState('cfast-pilot');
  const [basis, setBasis] = useState('recent3');

  const roles = SCORE_CRITERIA.filter((item) => item.organization === organizationId);
  const criterion = SCORE_CRITERIA_BY_ID[criterionId] || roles[0];
  const moduleScores = useMemo(() => buildModuleScoreMap(history, basis), [history, basis]);
  const score = useMemo(() => calculateCriteriaScore(criterion, moduleScores), [criterion, moduleScores]);

  const changeOrganization = (nextOrganization) => {
    const nextRole = SCORE_CRITERIA.find((item) => item.organization === nextOrganization);
    setOrganizationId(nextOrganization);
    setCriterionId(nextRole.id);
  };

  return (
    <div className="min-h-[calc(100vh-40px)] bg-[#000018] p-3 sm:p-4" style={cbtFont}>
      <main className="mx-auto max-w-[1260px] border border-[#4444AA]">
        <header className="bg-[#0000B0] px-3 py-1 text-center text-sm font-bold text-white">
          CBAT ROLE SCORE VIEW
        </header>

        <div className="space-y-4 bg-[#d6d6d6] p-3 sm:p-4">
          <section className="grid grid-cols-1 border border-black bg-white sm:grid-cols-3">
            <label className="border-b border-black p-3 sm:border-b-0 sm:border-r">
              <span className="mb-1 block text-[10px] font-bold text-[#333333]">CRITERIA</span>
              <select
                value={organizationId}
                onChange={(event) => changeOrganization(event.target.value)}
                className="w-full border border-black bg-white px-2 py-1.5 text-sm text-black"
                data-testid="score-organization"
              >
                {SCORE_ORGANIZATIONS.map((organization) => (
                  <option key={organization.id} value={organization.id}>{organization.label}</option>
                ))}
              </select>
            </label>
            <label className="border-b border-black p-3 sm:border-b-0 sm:border-r">
              <span className="mb-1 block text-[10px] font-bold text-[#333333]">ROLE</span>
              <select
                value={criterion.id}
                onChange={(event) => setCriterionId(event.target.value)}
                className="w-full border border-black bg-white px-2 py-1.5 text-sm text-black"
                data-testid="score-role"
              >
                {roles.map((item) => <option key={item.id} value={item.id}>{item.roleName}</option>)}
              </select>
            </label>
            <label className="p-3">
              <span className="mb-1 block text-[10px] font-bold text-[#333333]">SCORE BASIS</span>
              <select
                value={basis}
                onChange={(event) => setBasis(event.target.value)}
                className="w-full border border-black bg-white px-2 py-1.5 text-sm text-black"
                data-testid="score-basis"
              >
                {SCORE_BASIS_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
              </select>
            </label>
          </section>

          <SummaryStrip score={score} />

          <section>
            <div className="mb-1 flex items-end justify-between gap-3">
              <div>
                <h1 className="text-lg font-bold text-black">{criterion.roleName}</h1>
                <div className="text-xs text-[#444444]">
                  Red line: published requirement. Green bar: estimated training stanine.
                </div>
              </div>
              <div className="hidden text-right text-[10px] text-[#555555] sm:block">
                {criterion.organization === 'cfast' ? 'CFAST' : criterion.organization === 'raf' ? 'RAF CBAT' : 'Royal Navy FAA'}
              </div>
            </div>
            {criterion.model === 'cfast-stanine'
              ? <CfastScoreChart score={score} />
              : <WeightedScoreChart score={score} />}
          </section>

          <section className="border border-[#9a7100] bg-[#fff8dd] p-3 text-xs leading-relaxed text-[#4d3900]">
            <strong>Training estimate only.</strong> Official CBAT/CFAST stanines are norm-referenced.
            This page maps local 0-100 assessment scores into nine equal training bands; it cannot
            reproduce an official stanine without the service's normative data. Requirements may change.
            {criterion.note && <span className="ml-1">{criterion.note}</span>}
            <a
              href="https://rafcbat.wordpress.com/results-and-scores/"
              target="_blank"
              rel="noreferrer"
              className="ml-1 font-bold underline"
            >
              Guide source
            </a>
          </section>

          <ContributionTable
            criterion={criterion}
            score={score}
            moduleScores={moduleScores}
            onOpenModule={(moduleId) => navigate(`/module/${moduleId}`)}
          />

          <div className="flex flex-wrap justify-end gap-2">
            <CFASTButton testid="score-history" onClick={() => navigate('/history')}>Attempt History</CFASTButton>
            <CFASTButton testid="score-dashboard" onClick={() => navigate('/')}>Dashboard</CFASTButton>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ScoreView;
