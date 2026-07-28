import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getModuleHistory, getHistory, clearHistory, clearModuleHistory } from '../utils/storage';
import { cbtFont, CFASTButton } from '../modules/cbtCommon';
import { MODULE_BY_ID } from '../constants/modules';
import { getResultAccuracy } from '../utils/cbatScoring';

const ScoreHistory = () => {
  const navigate = useNavigate();
  const { moduleId } = useParams();
  const [, setRefresh] = useState(0);

  const moduleName = moduleId ? MODULE_BY_ID[moduleId]?.name : null;
  const history = moduleName ? getModuleHistory(moduleName) : getHistory();
  const sorted = [...history].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const totalAttempts = sorted.length;
  const assessmentAttempts = sorted.filter(h => h.mode === 'assessment');
  const assessmentScores = assessmentAttempts.map(getResultAccuracy).filter(score => score !== null);
  const avgAcc = assessmentScores.length
    ? assessmentScores.reduce((sum, score) => sum + score, 0) / assessmentScores.length
    : 0;
  const bestScore = assessmentScores.length
    ? Math.max(...assessmentScores)
    : 0;

  const doClear = () => {
    if (window.confirm(`Clear ALL score history${moduleName ? ` for ${moduleName}` : ''}?`)) {
      if (moduleName) {
        clearModuleHistory(moduleName);
      } else {
        clearHistory();
      }
      setRefresh(r => r + 1);
    }
  };

  // Build sparkline of assessment scores (chronological, oldest to newest)
  const sparkline = [...assessmentAttempts]
    .reverse()
    .map(getResultAccuracy)
    .filter(score => score !== null);
  const spWidth = 400;
  const spHeight = 60;
  const points = sparkline.map((v, i) => {
    const x = sparkline.length > 1 ? (i / (sparkline.length - 1)) * spWidth : spWidth / 2;
    const y = spHeight - (v / 100) * spHeight;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="min-h-[calc(100vh-40px)] bg-[#000018] p-4" style={cbtFont}>
      <div className="max-w-5xl mx-auto border border-[#4444AA]">
        <div className="bg-[#0000B0] text-white text-center py-1 text-sm font-bold">
          SCORE HISTORY {moduleName ? `— ${moduleName}` : '— ALL MODULES'}
        </div>
        <div className="bg-[#000030] p-4 text-white">
          {/* Summary tiles */}
          <div className="grid grid-cols-4 gap-2 mb-4">
            <div className="bg-black border border-[#4444AA] p-3 text-center">
              <div className="text-[10px] text-[#AACCFF] mb-1">TOTAL ATTEMPTS</div>
              <div className="text-2xl font-mono font-bold" data-testid="hist-total">{totalAttempts}</div>
            </div>
            <div className="bg-black border border-[#4444AA] p-3 text-center">
              <div className="text-[10px] text-[#AACCFF] mb-1">ASSESSMENTS</div>
              <div className="text-2xl font-mono font-bold" data-testid="hist-assessments">{assessmentAttempts.length}</div>
            </div>
            <div className="bg-black border border-[#4444AA] p-3 text-center">
              <div className="text-[10px] text-[#AACCFF] mb-1">AVG SCORE</div>
              <div className="text-2xl font-mono font-bold text-[#00FF00]" data-testid="hist-avg">
                {avgAcc.toFixed(1)}%
              </div>
            </div>
            <div className="bg-black border border-[#4444AA] p-3 text-center">
              <div className="text-[10px] text-[#AACCFF] mb-1">BEST SCORE</div>
              <div className="text-2xl font-mono font-bold text-[#FFCC00]" data-testid="hist-best">
                {bestScore.toFixed(1)}%
              </div>
            </div>
          </div>

          {/* Sparkline */}
          {sparkline.length > 0 && (
            <div className="bg-black border border-[#4444AA] p-3 mb-4">
              <div className="text-[10px] text-[#AACCFF] mb-2">SCORE TREND (oldest → newest)</div>
              <svg viewBox={`0 0 ${spWidth} ${spHeight}`} className="w-full" style={{ height: '80px' }}>
                <line x1="0" y1={spHeight * 0.5} x2={spWidth} y2={spHeight * 0.5} stroke="#333366" strokeDasharray="2 2" />
                <line x1="0" y1={spHeight * 0.25} x2={spWidth} y2={spHeight * 0.25} stroke="#333366" strokeDasharray="2 2" />
                {sparkline.length > 1 && <polyline points={points} fill="none" stroke="#00FF00" strokeWidth="2" />}
                {sparkline.map((v, i) => {
                  const x = sparkline.length > 1 ? (i / (sparkline.length - 1)) * spWidth : spWidth / 2;
                  const y = spHeight - (v / 100) * spHeight;
                  return <circle key={i} cx={x} cy={y} r="3" fill="#FFCC00" />;
                })}
              </svg>
              <div className="flex justify-between text-[9px] text-[#AACCFF] mt-1">
                <span>0%</span><span>50%</span><span>100%</span>
              </div>
            </div>
          )}

          {/* Attempts table */}
          <div className="bg-black border border-[#4444AA]">
            <div className="bg-[#0000B0] text-white text-center py-0.5 text-xs font-bold border-b border-[#4444AA]">Recent Attempts</div>
            <div className="overflow-x-auto" style={{ maxHeight: '400px' }}>
              <table className="w-full text-xs font-mono">
                <thead className="bg-[#000050] sticky top-0">
                  <tr>
                    <th className="text-left px-2 py-1 border-r border-[#4444AA]">Date/Time</th>
                    {!moduleName && <th className="text-left px-2 py-1 border-r border-[#4444AA]">Module</th>}
                    <th className="text-left px-2 py-1 border-r border-[#4444AA]">Mode</th>
                    <th className="text-left px-2 py-1 border-r border-[#4444AA]">Difficulty</th>
                    <th className="text-right px-2 py-1">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.length === 0 && (
                    <tr><td colSpan={5} className="text-center text-[#AACCFF] py-4">No attempts recorded yet.</td></tr>
                  )}
                  {sorted.map((h, i) => (
                    <tr key={h.id} className={i % 2 ? 'bg-[#001030]' : 'bg-black'} data-testid={`hist-row-${i}`}>
                      <td className="px-2 py-1 border-r border-[#222266]">{new Date(h.timestamp).toLocaleString()}</td>
                      {!moduleName && <td className="px-2 py-1 border-r border-[#222266]">{h.moduleName}</td>}
                      <td className="px-2 py-1 border-r border-[#222266] uppercase">{h.mode}</td>
                      <td className="px-2 py-1 border-r border-[#222266] uppercase">{h.difficulty}</td>
                      <td className="px-2 py-1 text-right">
                        {getResultAccuracy(h) !== null ? (
                          <span className={getResultAccuracy(h) >= 70 ? 'text-[#00FF00]' : getResultAccuracy(h) >= 40 ? 'text-[#FFCC00]' : 'text-[#FF3333]'}>
                            {getResultAccuracy(h).toFixed(1)}%
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-3 flex gap-2 justify-end">
            {!moduleName && <CFASTButton testid="hist-score-view" onClick={() => navigate('/scores')}>Role Score View</CFASTButton>}
            <CFASTButton testid="hist-clear" onClick={doClear}>Clear History</CFASTButton>
            <CFASTButton testid="hist-back" onClick={() => navigate('/')}>Back to Dashboard</CFASTButton>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScoreHistory;
