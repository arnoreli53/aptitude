import React from 'react';
import { useNavigate } from 'react-router-dom';
import { getModuleHistory } from '../utils/storage';
import { getResultAccuracy } from '../utils/cbatScoring';
import { cbtFont } from '../modules/cbtCommon';
import { MODULES, MODULE_CATEGORIES } from '../constants/modules';

const scoreColor = (avg) => avg >= 70 ? '#00FF00' : avg >= 40 ? '#FFCC00' : '#FF3333';

const Dashboard = () => {
  const navigate = useNavigate();

  const getStats = (moduleName) => {
    const all = getModuleHistory(moduleName);
    const assessments = all.filter(h => h.mode === 'assessment');
    const assessmentScores = assessments.map(getResultAccuracy).filter(score => score !== null);
    if (all.length === 0) return null;
    const avg = assessmentScores.length ? assessmentScores.reduce((sum, score) => sum + score, 0) / assessmentScores.length : 0;
    const best = assessmentScores.length ? Math.max(...assessmentScores) : 0;
    return {
      attempts: all.length,
      assessments: assessments.length,
      avg, best,
      last: new Date(all[all.length - 1].timestamp).toLocaleDateString()
    };
  };

  // Global battery average - only average modules that have completed assessments
  const allStats = MODULES.map(m => getStats(m.name)).filter(Boolean);
  const scoredStats = allStats.filter(s => s.assessments > 0);
  const overallAvg = scoredStats.length
    ? scoredStats.reduce((s, m) => s + m.avg, 0) / scoredStats.length : 0;
  const totalAttempts = allStats.reduce((s, m) => s + m.attempts, 0);

  return (
    <div className="min-h-[calc(100vh-40px)] bg-[#000018] p-4" style={cbtFont}>
      <div className="max-w-6xl mx-auto border border-[#4444AA]">
        <div className="bg-[#0000B0] text-white text-center py-1 text-sm font-bold">
          CBAT TRAINING MODULES - SELECT TEST
        </div>
        <div className="bg-[#000030] p-3 text-white">
          {/* Overall summary bar */}
          <div className="grid grid-cols-4 gap-2 mb-3">
            <div className="bg-black border border-[#4444AA] p-2">
              <div className="text-[10px] text-[#AACCFF]">BATTERY AVG</div>
              <div className="text-2xl font-mono font-bold" style={{ color: scoreColor(overallAvg) }} data-testid="battery-avg">
                {overallAvg.toFixed(1)}%
              </div>
            </div>
            <div className="bg-black border border-[#4444AA] p-2">
              <div className="text-[10px] text-[#AACCFF]">TOTAL ATTEMPTS</div>
              <div className="text-2xl font-mono font-bold" data-testid="battery-attempts">{totalAttempts}</div>
            </div>
            <div className="bg-black border border-[#4444AA] p-2">
              <div className="text-[10px] text-[#AACCFF]">MODULES TRIED</div>
              <div className="text-2xl font-mono font-bold" data-testid="battery-tried">{allStats.length} / {MODULES.length}</div>
            </div>
            <div className="bg-black border border-[#4444AA] p-2 flex items-center justify-center gap-2">
              <button data-testid="nav-score-view" onClick={() => navigate('/scores')}
                className="bg-[#0000A0] text-white text-xs px-3 py-1 border-2 border-[#4444AA] hover:bg-[#0000CC]">SCORE VIEW</button>
              <button data-testid="nav-gamepad" onClick={() => navigate('/gamepad')}
                className="bg-[#0000A0] text-white text-xs px-3 py-1 border-2 border-[#4444AA] hover:bg-[#0000CC]">GAMEPAD</button>
            </div>
          </div>

          <div className="text-[11px] text-[#AACCFF] mb-2">
            Select a module to begin training. {MODULES.length} training modules are available.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
            {MODULES.map((module) => {
              const stats = getStats(module.name);
              const catColor = MODULE_CATEGORIES[module.category];
              return (
                <div key={module.id} className="bg-[#000030] border border-[#4444AA]" data-testid={`module-card-${module.id}`}>
                  <div className="text-white text-[10px] font-bold px-2 py-0.5 flex justify-between items-center"
                    style={{ backgroundColor: catColor }}>
                    <span>{module.category}</span>
                    <span className="text-[#00FF00]">READY</span>
                  </div>
                  <button
                    data-testid={`module-start-${module.id}`}
                    onClick={() => navigate(`/module/${module.id}`)}
                    className="text-left w-full p-2 hover:bg-[#000050]">
                    <div className="text-white text-xs font-bold mb-1">{module.name}</div>
                    {stats ? (
                      <div className="space-y-0.5 text-[10px] text-white font-mono">
                        <div className="flex justify-between">
                          <span className="text-[#AACCFF]">AVG SCORE</span>
                          <span className="font-bold" style={{ color: scoreColor(stats.avg) }}
                            data-testid={`module-avg-${module.id}`}>
                            {stats.avg.toFixed(1)}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#AACCFF]">BEST</span>
                          <span className="text-[#FFCC00]">{stats.best.toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#AACCFF]">ATTEMPTS</span>
                          <span>{stats.attempts}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-[10px] text-[#556677] italic">No attempts yet.</div>
                    )}
                  </button>
                  <button
                    data-testid={`module-history-${module.id}`}
                    onClick={(e) => { e.stopPropagation(); navigate(`/history/${module.id}`); }}
                    className="w-full bg-black text-[#AACCFF] text-[10px] py-0.5 border-t border-[#4444AA] hover:bg-[#0000A0] hover:text-white">
                    View Score History →
                  </button>
                </div>
              );
            })}
          </div>
        </div>
        <div className="bg-[#000050] px-3 py-0.5 flex justify-between text-[10px] text-white border-t border-[#4444AA]">
          <span>{MODULES.length} MODULES / CBAT BATTERY</span>
          <span>CBAT Prep / v2.1</span>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
